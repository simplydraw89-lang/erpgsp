-- Outgoing payment obligations. A newly executed payment is always unpaid;
-- marking it paid is a separate, reviewed update proposal.
create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  payment_number text not null,
  payee_name text not null,
  description text not null,
  invoice_date date not null,
  due_on date not null,
  amount numeric(18,2) not null check (amount > 0),
  status text not null default 'unpaid' check (status in ('unpaid','paid')),
  paid_on date,
  payment_method text check (payment_method in ('transfer','cash','other')),
  reference_number text,
  notes text,
  row_version integer not null default 1 check (row_version > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, payment_number),
  check (due_on >= invoice_date),
  check (paid_on is null or paid_on >= invoice_date),
  check (
    (status = 'unpaid' and paid_on is null and payment_method is null)
    or (status = 'paid' and paid_on is not null and payment_method is not null)
  )
);
create index payment_records_org_status_due_idx
  on public.payment_records(organization_id,status,due_on);
create index payment_records_org_invoice_date_idx
  on public.payment_records(organization_id,invoice_date);
create index payment_records_org_paid_date_idx
  on public.payment_records(organization_id,paid_on) where paid_on is not null;
create index payment_records_created_by_idx on public.payment_records(created_by);

alter table public.approval_policies drop constraint approval_policies_record_type_check;
alter table public.approval_policies add constraint approval_policies_record_type_check
  check (record_type in ('client','project','work_item','account','employee','tax_record','asset','payment'));
alter table public.workflow_documents drop constraint workflow_documents_record_type_check;
alter table public.workflow_documents add constraint workflow_documents_record_type_check
  check (record_type in ('client','project','work_item','account','employee','tax_record','asset','payment'));
alter table public.approval_requests drop constraint approval_requests_module_key_check;
alter table public.approval_requests add constraint approval_requests_module_key_check
  check (module_key in ('crm','operasional','keuangan','sdm','perpajakan','manajemen','asset','pembayaran'));
alter table public.integration_sources drop constraint integration_sources_module_key_check;
alter table public.integration_sources add constraint integration_sources_module_key_check
  check (module_key in ('crm','operasional','keuangan','sdm','perpajakan','manajemen','asset','pembayaran'));

create or replace function gsp_private.record_config(p_type text) returns jsonb
language sql immutable set search_path = '' as $$
  select case when p_type = 'payment' then
    '{"module":"pembayaran","table":"payment_records","writers":["owner","finance"],"readers":["owner","director","finance","auditor"],"required":["payment_number","payee_name","description","invoice_date","due_on","amount","status"],"fields":["payment_number","payee_name","description","invoice_date","due_on","amount","status","paid_on","payment_method","reference_number","notes"]}'::jsonb
  else (
    select case p_type
      when 'client' then '{"module":"crm","table":"crm_clients","writers":["owner","director","operations","staff"],"readers":["owner","director","finance","hr","operations","auditor","staff"],"required":["name","status"],"fields":["name","company_name","email","phone","status","notes"]}'::jsonb
      when 'project' then '{"module":"crm","table":"crm_projects","writers":["owner","director","operations"],"readers":["owner","director","finance","hr","operations","auditor","staff"],"required":["code","name","status"],"fields":["code","name","client_id","starts_on","ends_on","status"]}'::jsonb
      when 'work_item' then '{"module":"operasional","table":"operational_work_items","writers":["owner","director","operations","staff"],"readers":["owner","director","finance","hr","operations","auditor","staff"],"required":["title","priority","status"],"fields":["title","description","priority","due_on","project_id","assigned_to","status"]}'::jsonb
      when 'account' then '{"module":"keuangan","table":"finance_accounts","writers":["owner","finance"],"readers":["owner","director","finance","auditor"],"required":["code","name","account_type","normal_balance"],"fields":["code","name","account_type","normal_balance","is_active"]}'::jsonb
      when 'employee' then '{"module":"sdm","table":"hr_employees","writers":["owner","hr"],"readers":["owner","director","hr"],"required":["employee_number","full_name","employment_status"],"fields":["employee_number","full_name","email","job_title","department","started_on","employment_status"]}'::jsonb
      when 'tax_record' then '{"module":"perpajakan","table":"tax_records","writers":["owner","finance"],"readers":["owner","director","finance","auditor"],"required":["tax_period","tax_type","tax_base","tax_amount","status"],"fields":["tax_period","tax_type","reference_number","tax_base","tax_amount","due_on","status","notes"]}'::jsonb
      when 'asset' then '{"module":"asset","table":"company_assets","writers":["owner","finance","operations"],"readers":["owner","director","finance","operations","auditor","staff"],"required":["code","name","category","purchase_cost","condition","status"],"fields":["code","name","category","serial_number","location","custodian_id","acquired_on","purchase_cost","condition","status","notes"]}'::jsonb
    end
  ) end;
$$;

alter table public.payment_records enable row level security;
create policy payment_records_read on public.payment_records
  for select to authenticated
  using (public.can_read_workflow(organization_id,'payment'));

revoke all on public.payment_records from public,anon,authenticated;
grant select on public.payment_records to authenticated;

create or replace function gsp_private.validate_payload(p_org uuid,p_type text,p_payload jsonb) returns void
language plpgsql set search_path = '' as $$
declare cfg jsonb:=gsp_private.record_config(p_type); k text; v text; n numeric;
begin
  if cfg is null or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>32768 then
    raise exception 'Jenis atau ukuran dokumen tidak valid.';
  end if;
  for k in select jsonb_object_keys(p_payload) loop
    if not (cfg->'fields') ? k then raise exception 'Kolom tidak diizinkan: %',k; end if;
    if p_payload->k <> 'null'::jsonb and jsonb_typeof(p_payload->k) not in ('string','number','boolean') then raise exception 'Nilai kolom tidak valid: %',k; end if;
    if length(p_payload->>k)>2000 then raise exception 'Isi kolom terlalu panjang: %',k; end if;
  end loop;
  for k in select jsonb_array_elements_text(cfg->'required') loop
    if nullif(btrim(p_payload->>k),'') is null then raise exception 'Kolom wajib diisi: %',k; end if;
  end loop;
  for k,v in select key,value from jsonb_each_text(p_payload) loop
    if v is null then continue; end if;
    if k in ('starts_on','ends_on','due_on','started_on','acquired_on','invoice_date','paid_on') then
      if v !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Tanggal tidak valid.'; end if;
      perform v::date;
    end if;
    if k in ('purchase_cost','tax_base','tax_amount','amount') then
      n:=v::numeric;
      if n<0 or n>9999999999999999.99 or n<>round(n,2) then raise exception 'Nilai uang tidak valid (maksimal dua desimal).'; end if;
    end if;
    if k='email' and v !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Format email tidak valid.'; end if;
    if k in ('custodian_id','assigned_to') and not exists(select 1 from public.organization_members where organization_id=p_org and user_id=v::uuid) then
      raise exception 'Penanggung jawab harus anggota organisasi ini.';
    end if;
    if k='client_id' and not exists(select 1 from public.crm_clients where organization_id=p_org and id=v::uuid) then raise exception 'Klien tidak ditemukan di organisasi ini.'; end if;
    if k='project_id' and not exists(select 1 from public.crm_projects where organization_id=p_org and id=v::uuid) then raise exception 'Proyek tidak ditemukan di organisasi ini.'; end if;
  end loop;
  if p_type='client' and (p_payload->>'status') not in ('prospect','client','inactive') then raise exception 'Status kontak tidak valid.'; end if;
  if p_type='project' then
    if (p_payload->>'status') not in ('planned','active','on_hold','completed','cancelled') then raise exception 'Status proyek tidak valid.'; end if;
    if (p_payload->>'ends_on')::date < (p_payload->>'starts_on')::date then raise exception 'Tanggal selesai mendahului tanggal mulai.'; end if;
  end if;
  if p_type='work_item' and ((p_payload->>'status') not in ('todo','in_progress','blocked','done') or (p_payload->>'priority') not in ('low','normal','high','urgent')) then raise exception 'Status/prioritas pekerjaan tidak valid.'; end if;
  if p_type='account' and ((p_payload->>'account_type') not in ('asset','liability','equity','revenue','expense') or (p_payload->>'normal_balance') is distinct from case when (p_payload->>'account_type') in ('liability','equity','revenue') then 'credit' else 'debit' end) then raise exception 'Jenis akun/saldo normal tidak valid.'; end if;
  if p_type='employee' and (p_payload->>'employment_status') not in ('active','on_leave','resigned') then raise exception 'Status karyawan tidak valid.'; end if;
  if p_type='tax_record' and ((p_payload->>'tax_period') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or (p_payload->>'tax_type') not in ('ppn','pph21','pph23','pph4_2','pph25','pph29','other') or (p_payload->>'status') not in ('draft','reviewed','reported')) then raise exception 'Catatan pajak tidak valid.'; end if;
  if p_type='asset' and ((p_payload->>'condition') not in ('good','needs_service','damaged') or (p_payload->>'status') not in ('active','in_repair','retired')) then raise exception 'Kondisi/status aset tidak valid.'; end if;
  if p_type='payment' then
    if (p_payload->>'amount')::numeric <= 0 then raise exception 'Jumlah pembayaran harus lebih besar dari nol.'; end if;
    if (p_payload->>'status') not in ('unpaid','paid') then raise exception 'Status pembayaran tidak valid.'; end if;
    if (p_payload->>'due_on')::date < (p_payload->>'invoice_date')::date then raise exception 'Tanggal jatuh tempo mendahului tanggal tagihan.'; end if;
    if p_payload->>'status'='paid' and ((p_payload->>'paid_on') is null or coalesce(p_payload->>'payment_method','') not in ('transfer','cash','other')) then raise exception 'Tanggal dan metode pembayaran wajib saat menandai lunas.'; end if;
    if p_payload->>'status'='paid' and (p_payload->>'paid_on')::date < (p_payload->>'invoice_date')::date then raise exception 'Tanggal pembayaran mendahului tanggal tagihan.'; end if;
    if p_payload->>'status'='unpaid' and (p_payload->>'paid_on' is not null or p_payload->>'payment_method' is not null) then raise exception 'Tagihan belum lunas tidak boleh memiliki tanggal/metode pembayaran.'; end if;
  end if;
end $$;

create or replace function public.save_workflow_draft(p_org uuid,p_type text,p_payload jsonb,p_document_id uuid default null,p_expected_version integer default null,p_target_id uuid default null,p_target_version integer default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare d public.workflow_documents; cfg jsonb:=gsp_private.record_config(p_type); current_version integer; current_status text;
begin
  perform gsp_private.check_writer(p_org,p_type);
  if p_type='payment' then
    if p_document_id is null and p_target_id is null and p_payload->>'status' is distinct from 'unpaid' then
      raise exception 'Tagihan baru harus dimulai dengan status belum lunas.';
    end if;
    if p_target_id is not null then
      execute 'select status from public.payment_records where id=$1 and organization_id=$2' into current_status using p_target_id,p_org;
      if current_status='paid' then raise exception 'Pembayaran yang sudah lunas tidak dapat diubah.'; end if;
    end if;
  end if;
  perform gsp_private.validate_payload(p_org,p_type,p_payload);
  if p_document_id is null then
    d.organization_id:=p_org; d.record_type:=p_type; d.module_key:=cfg->>'module';
    d.operation:=case when p_target_id is null then 'create' else 'update' end;
    d.target_id:=coalesce(p_target_id,gen_random_uuid()); d.base_version:=0;
    if p_target_id is not null then
      execute format('select row_version from public.%I where id=$1 and organization_id=$2',cfg->>'table') into current_version using p_target_id,p_org;
      if current_version is null then raise exception 'Record tujuan tidak ditemukan.'; end if;
      if current_version is distinct from p_target_version then raise exception 'Versi record berubah sejak formulir dibuka. Muat ulang.'; end if;
      d.base_version:=current_version;
    end if;
    insert into public.workflow_documents(organization_id,record_type,module_key,operation,target_id,base_version,title,payload,created_by)
    values(p_org,p_type,d.module_key,d.operation,d.target_id,d.base_version,
      coalesce(p_payload->>'name',p_payload->>'title',p_payload->>'full_name',p_payload->>'tax_period',p_payload->>'payment_number'),p_payload,auth.uid()) returning * into d;
  else
    select * into d from public.workflow_documents where id=p_document_id for update;
    if d.id is null or d.organization_id<>p_org or d.record_type<>p_type or d.created_by<>auth.uid() then raise exception 'Draft tidak dapat diakses.'; end if;
    if d.state<>'draft' then raise exception 'Dokumen terkunci setelah diajukan.'; end if;
    if p_expected_version is distinct from d.version then raise exception 'Versi draft berubah. Muat ulang sebelum menyimpan.'; end if;
    if p_type='payment' and d.operation='create' and p_payload->>'status' is distinct from 'unpaid' then raise exception 'Tagihan baru harus dimulai dengan status belum lunas.'; end if;
    if d.operation='update' and p_target_id is not null and p_target_id is distinct from d.target_id then raise exception 'Record tujuan berbeda dari draft.'; end if;
    if p_type='payment' and d.operation='update' then
      execute 'select status from public.payment_records where id=$1 and organization_id=$2' into current_status using d.target_id,p_org;
      if current_status='paid' then raise exception 'Pembayaran yang sudah lunas tidak dapat diubah.'; end if;
    end if;
    update public.workflow_documents set payload=p_payload,
      title=coalesce(p_payload->>'name',p_payload->>'title',p_payload->>'full_name',p_payload->>'tax_period',p_payload->>'payment_number'),
      version=version+1,updated_at=now() where id=d.id returning * into d;
  end if;
  perform gsp_private.log_document(d,'draft_saved',jsonb_build_object('payload',d.payload));
  return d.id;
end $$;

create or replace function public.submit_workflow_document(p_document_id uuid,p_expected_version integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare d public.workflow_documents; pol public.approval_policies; reviewer text; request_id uuid; amount numeric;
begin
  select * into d from public.workflow_documents where id=p_document_id for update;
  if d.id is null then raise exception 'Dokumen tidak ditemukan.'; end if;
  perform gsp_private.check_writer(d.organization_id,d.record_type);
  if d.created_by<>auth.uid() then raise exception 'Hanya pembuat draft dapat mengajukan.'; end if;
  if d.state<>'draft' or d.version is distinct from p_expected_version then raise exception 'Status atau versi dokumen berubah.'; end if;
  perform gsp_private.validate_payload(d.organization_id,d.record_type,d.payload);
  perform gsp_private.check_target(d);
  select * into pol from public.approval_policies where organization_id=d.organization_id and record_type=d.record_type;
  if pol.id is null then raise exception 'Kebijakan persetujuan belum diatur. Hubungi owner.'; end if;
  amount:=coalesce((d.payload->>'purchase_cost')::numeric,(d.payload->>'tax_amount')::numeric,(d.payload->>'amount')::numeric,0);
  reviewer:=case when pol.escalation_amount is not null and amount>=pol.escalation_amount then pol.escalation_role else pol.reviewer_role end;
  if not exists(select 1 from public.organization_members where organization_id=d.organization_id and role=reviewer and user_id<>auth.uid()) then
    raise exception 'Belum ada pemeriksa % yang berbeda dari pengaju. Owner perlu mengatur kebijakan atau keanggotaan.',reviewer;
  end if;
  insert into public.approval_requests(organization_id,module_key,record_type,record_id,requested_by,required_role,document_id,document_version,document_snapshot,policy_snapshot)
  values(d.organization_id,d.module_key,d.record_type,d.target_id::text,auth.uid(),reviewer,d.id,d.version,gsp_private.document_snapshot(d),to_jsonb(pol)) returning id into request_id;
  update public.workflow_documents set state='submitted',submitted_at=now(),updated_at=now() where id=d.id;
  perform gsp_private.log_document(d,'submitted',jsonb_build_object('request_id',request_id,'reviewer_role',reviewer,'policy_version',pol.version));
  return request_id;
end $$;

create or replace function public.set_approval_policy(p_org uuid,p_type text,p_reviewer text,p_threshold numeric default null,p_escalation text default 'owner',p_expected_version integer default null) returns void
language plpgsql security definer set search_path = '' as $$
declare pol public.approval_policies;
begin
  if not public.has_org_role(p_org,array['owner']) then raise exception 'Hanya owner dapat mengatur kebijakan.' using errcode='42501'; end if;
  if gsp_private.record_config(p_type) is null then raise exception 'Jenis dokumen tidak valid.'; end if;
  if p_threshold is not null and p_type not in ('asset','tax_record','payment') then raise exception 'Eskalasi nominal hanya tersedia untuk aset, pajak, dan pembayaran.'; end if;
  if p_threshold is not null and (p_threshold<0 or p_threshold>9999999999999999.99 or p_threshold<>round(p_threshold,2)) then raise exception 'Batas nominal tidak valid.'; end if;
  if not (gsp_private.record_config(p_type)->'readers') ? p_reviewer or not (gsp_private.record_config(p_type)->'readers') ? p_escalation then raise exception 'Peran pemeriksa tidak memiliki akses baca modul.'; end if;
  select * into pol from public.approval_policies where organization_id=p_org and record_type=p_type for update;
  if pol.id is null then
    if p_expected_version is not null then raise exception 'Kebijakan berubah. Muat ulang.'; end if;
    insert into public.approval_policies(organization_id,record_type,reviewer_role,escalation_amount,escalation_role) values(p_org,p_type,p_reviewer,p_threshold,p_escalation) returning * into pol;
  else
    if pol.version is distinct from p_expected_version then raise exception 'Versi kebijakan berubah. Muat ulang.'; end if;
    update public.approval_policies set reviewer_role=p_reviewer,escalation_amount=p_threshold,escalation_role=p_escalation,version=version+1,updated_at=now() where id=pol.id returning * into pol;
  end if;
  insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id,details)
    values(p_org,auth.uid(),'policy_updated','approval_policy',pol.id::text,to_jsonb(pol));
end $$;

create or replace function gsp_private.seed_policies() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.approval_policies(organization_id,record_type)
    select new.id,t from unnest(array['client','project','work_item','account','employee','tax_record','asset','payment']) t;
  return new;
end $$;

insert into public.approval_policies(organization_id,record_type)
  select o.id,'payment' from public.organizations o
  on conflict (organization_id,record_type) do nothing;

create trigger audit_payment_records after insert or update or delete on public.payment_records
  for each row execute function public.audit_module_record('payment','pembayaran');

-- The workflow RPCs remain the only client write path.
revoke all on public.payment_records from public,anon,authenticated;
grant select on public.payment_records to authenticated;

notify pgrst, 'reload schema';
