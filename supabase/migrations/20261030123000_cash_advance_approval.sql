-- Project and business-trip cash advances require an ordered Manager -> Finance
-- review. The final execution creates the unpaid disbursement obligation.

alter table public.organization_members drop constraint if exists organization_members_role_check;
alter table public.organization_members add constraint organization_members_role_check
  check (role in ('owner','director','manager','finance','hr','operations','auditor','staff'));

alter table public.approval_requests drop constraint if exists approval_requests_required_role_check;
alter table public.approval_requests add constraint approval_requests_required_role_check
  check (required_role in ('owner','director','manager','finance','hr','operations'));
alter table public.approval_requests
  add column approval_step smallint not null default 1 check (approval_step > 0);
drop index if exists public.approval_requests_document_version_uq;
create unique index approval_requests_document_version_step_uq
  on public.approval_requests(document_id,document_version,approval_step)
  where document_id is not null;

alter table public.approval_policies drop constraint if exists approval_policies_record_type_check;
alter table public.approval_policies add constraint approval_policies_record_type_check
  check (record_type in ('client','project','work_item','account','employee','tax_record','asset','payment','advance'));
alter table public.approval_policies drop constraint if exists approval_policies_reviewer_role_check;
alter table public.approval_policies add constraint approval_policies_reviewer_role_check
  check (reviewer_role in ('owner','director','manager','finance','hr','operations'));
alter table public.approval_policies drop constraint if exists approval_policies_escalation_role_check;
alter table public.approval_policies add constraint approval_policies_escalation_role_check
  check (escalation_role in ('owner','director','manager','finance','hr','operations'));
alter table public.approval_policies add constraint approval_policies_advance_fixed_stages_check
  check (record_type <> 'advance' or
    (reviewer_role='manager' and escalation_role='finance' and escalation_amount is null));

alter table public.workflow_documents drop constraint if exists workflow_documents_record_type_check;
alter table public.workflow_documents add constraint workflow_documents_record_type_check
  check (record_type in ('client','project','work_item','account','employee','tax_record','asset','payment','advance'));

create table public.cash_advances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  advance_number text not null,
  purpose_type text not null check (purpose_type in ('project','business_trip')),
  project_id uuid,
  trip_destination text,
  departure_on date,
  return_on date,
  description text not null,
  amount numeric(18,2) not null check (amount > 0),
  needed_on date not null,
  settlement_due_on date not null,
  advance_status text not null default 'approved'
    check (advance_status in ('approved','disbursed','settled')),
  row_version integer not null default 1 check (row_version > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,advance_number),
  foreign key (organization_id,project_id)
    references public.crm_projects(organization_id,id),
  check (
    (purpose_type='project' and project_id is not null and trip_destination is null and departure_on is null and return_on is null)
    or
    (purpose_type='business_trip' and project_id is null and nullif(btrim(trip_destination),'') is not null
      and departure_on is not null and return_on is not null and return_on >= departure_on)
  ),
  check (settlement_due_on >= coalesce(return_on,needed_on))
);
create index cash_advances_org_status_idx on public.cash_advances(organization_id,advance_status,created_at desc);
create index cash_advances_project_idx on public.cash_advances(organization_id,project_id) where project_id is not null;

alter table public.payment_records
  add column cash_advance_id uuid unique references public.cash_advances(id);

alter table public.cash_advances enable row level security;
create policy cash_advances_read on public.cash_advances
  for select to authenticated using (public.can_read_workflow(organization_id,'advance'));
revoke all on public.cash_advances from public,anon,authenticated;
grant select on public.cash_advances to authenticated;
revoke all on public.payment_records from public,anon,authenticated;
grant select on public.payment_records to authenticated;

create trigger audit_cash_advances after insert or update or delete on public.cash_advances
  for each row execute function public.audit_module_record('cash_advance','pembayaran');

create or replace function gsp_private.record_config(p_type text) returns jsonb
language sql immutable set search_path = '' as $$
  select case
    when p_type='payment' then
      '{"module":"pembayaran","table":"payment_records","writers":["owner","finance"],"readers":["owner","director","finance","auditor"],"required":["payment_number","payee_name","description","invoice_date","due_on","amount","status"],"fields":["payment_number","payee_name","description","invoice_date","due_on","amount","status","paid_on","payment_method","reference_number","notes"]}'::jsonb
    when p_type='advance' then
      '{"module":"pembayaran","table":"cash_advances","writers":["owner","director","manager","finance","hr","operations","auditor","staff"],"readers":["owner","director","manager","finance","hr","operations","auditor","staff"],"required":["advance_number","purpose_type","description","amount","needed_on","settlement_due_on"],"fields":["advance_number","purpose_type","project_id","trip_destination","departure_on","return_on","description","amount","needed_on","settlement_due_on"]}'::jsonb
    else (
      select case p_type
        when 'client' then '{"module":"crm","table":"crm_clients","writers":["owner","director","operations","staff"],"readers":["owner","director","finance","hr","operations","auditor","staff","manager"],"required":["name","status"],"fields":["name","company_name","email","phone","status","notes"]}'::jsonb
        when 'project' then '{"module":"crm","table":"crm_projects","writers":["owner","director","operations"],"readers":["owner","director","finance","hr","operations","auditor","staff","manager"],"required":["code","name","status"],"fields":["code","name","client_id","starts_on","ends_on","status"]}'::jsonb
        when 'work_item' then '{"module":"operasional","table":"operational_work_items","writers":["owner","director","operations","staff"],"readers":["owner","director","finance","hr","operations","auditor","staff","manager"],"required":["title","priority","status"],"fields":["title","description","priority","due_on","project_id","assigned_to","status"]}'::jsonb
        when 'account' then '{"module":"keuangan","table":"finance_accounts","writers":["owner","finance"],"readers":["owner","director","finance","auditor"],"required":["code","name","account_type","normal_balance"],"fields":["code","name","account_type","normal_balance","is_active"]}'::jsonb
        when 'employee' then '{"module":"sdm","table":"hr_employees","writers":["owner","hr"],"readers":["owner","director","hr"],"required":["employee_number","full_name","employment_status"],"fields":["employee_number","full_name","email","job_title","department","started_on","employment_status"]}'::jsonb
        when 'tax_record' then '{"module":"perpajakan","table":"tax_records","writers":["owner","finance"],"readers":["owner","director","finance","auditor"],"required":["tax_period","tax_type","tax_base","tax_amount","status"],"fields":["tax_period","tax_type","reference_number","tax_base","tax_amount","due_on","status","notes"]}'::jsonb
        when 'asset' then '{"module":"asset","table":"company_assets","writers":["owner","finance","operations"],"readers":["owner","director","finance","operations","auditor","staff"],"required":["code","name","category","purchase_cost","condition","status"],"fields":["code","name","category","serial_number","location","custodian_id","acquired_on","purchase_cost","condition","status","notes"]}'::jsonb
      end
    )
  end;
$$;

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
    if k in ('starts_on','ends_on','due_on','started_on','acquired_on','invoice_date','paid_on','needed_on','settlement_due_on','departure_on','return_on') then
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
  if p_type='advance' then
    if p_payload->>'purpose_type' not in ('project','business_trip') then raise exception 'Jenis keperluan kasbon tidak valid.'; end if;
    if (p_payload->>'amount')::numeric <= 0 then raise exception 'Jumlah kasbon harus lebih besar dari nol.'; end if;
    if p_payload->>'purpose_type'='project' and nullif(p_payload->>'project_id','') is null then raise exception 'Pilih proyek untuk kasbon proyek.'; end if;
    if p_payload->>'purpose_type'='business_trip' and (nullif(btrim(p_payload->>'trip_destination'),'') is null or nullif(p_payload->>'departure_on','') is null or nullif(p_payload->>'return_on','') is null) then
      raise exception 'Tujuan, tanggal berangkat, dan tanggal kembali wajib untuk advance perjalanan dinas.';
    end if;
    if p_payload->>'purpose_type'='business_trip' and (p_payload->>'return_on')::date < (p_payload->>'departure_on')::date then raise exception 'Tanggal kembali mendahului tanggal berangkat.'; end if;
    if (p_payload->>'settlement_due_on')::date < coalesce((p_payload->>'return_on')::date,(p_payload->>'needed_on')::date) then raise exception 'Batas pertanggungjawaban tidak boleh sebelum perjalanan atau tanggal dana dibutuhkan.'; end if;
  end if;
end $$;

create or replace function public.save_workflow_draft(p_org uuid,p_type text,p_payload jsonb,p_document_id uuid default null,p_expected_version integer default null,p_target_id uuid default null,p_target_version integer default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare d public.workflow_documents; cfg jsonb:=gsp_private.record_config(p_type); current_version integer; current_status text;
begin
  perform gsp_private.check_writer(p_org,p_type);
  if p_type='payment' and p_document_id is null and p_target_id is null and p_payload->>'status' is distinct from 'unpaid' then raise exception 'Tagihan baru harus dimulai dengan status belum lunas.'; end if;
  if p_target_id is not null and p_type in ('payment','advance') then
    if p_type='payment' then
      execute 'select status from public.payment_records where id=$1 and organization_id=$2' into current_status using p_target_id,p_org;
      if current_status='paid' then raise exception 'Pembayaran yang sudah lunas tidak dapat diubah.'; end if;
    else
      raise exception 'Kasbon yang sudah disetujui tidak dapat diubah. Ajukan kasbon baru jika masih diperlukan.';
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
      coalesce(p_payload->>'name',p_payload->>'title',p_payload->>'full_name',p_payload->>'tax_period',p_payload->>'payment_number',p_payload->>'advance_number'),p_payload,auth.uid()) returning * into d;
  else
    select * into d from public.workflow_documents where id=p_document_id for update;
    if d.id is null or d.organization_id<>p_org or d.record_type<>p_type or d.created_by<>auth.uid() then raise exception 'Draft tidak dapat diakses.'; end if;
    if d.state<>'draft' then raise exception 'Dokumen terkunci setelah diajukan.'; end if;
    if p_expected_version is distinct from d.version then raise exception 'Versi draft berubah. Muat ulang sebelum menyimpan.'; end if;
    if p_type='payment' and d.operation='create' and p_payload->>'status' is distinct from 'unpaid' then raise exception 'Tagihan baru harus dimulai dengan status belum lunas.'; end if;
    if d.operation='update' and p_target_id is not null and p_target_id is distinct from d.target_id then raise exception 'Record tujuan berbeda dari draft.'; end if;
    update public.workflow_documents set payload=p_payload,
      title=coalesce(p_payload->>'name',p_payload->>'title',p_payload->>'full_name',p_payload->>'tax_period',p_payload->>'payment_number',p_payload->>'advance_number'),
      version=version+1,updated_at=now() where id=d.id returning * into d;
  end if;
  perform gsp_private.log_document(d,'draft_saved',jsonb_build_object('payload',d.payload));
  return d.id;
end $$;

create or replace function public.submit_workflow_document(p_document_id uuid,p_expected_version integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare d public.workflow_documents; pol public.approval_policies; reviewer text; request_id uuid; amount numeric; snapshot jsonb;
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
  if d.record_type='advance' then
    if not exists (
      select 1 from public.organization_members m
      join public.organization_members f on f.organization_id=m.organization_id and f.role='finance'
      where m.organization_id=d.organization_id and m.role='manager'
        and m.user_id<>auth.uid() and f.user_id<>auth.uid() and f.user_id<>m.user_id
    ) then raise exception 'Pengajuan kasbon membutuhkan akun Manager dan Accounting & Finance yang berbeda dari pengaju.'; end if;
    reviewer:='manager';
    snapshot:=to_jsonb(pol)||jsonb_build_object('approval_stages',jsonb_build_array('manager','finance'));
  else
    amount:=coalesce((d.payload->>'purchase_cost')::numeric,(d.payload->>'tax_amount')::numeric,(d.payload->>'amount')::numeric,0);
    reviewer:=case when pol.escalation_amount is not null and amount>=pol.escalation_amount then pol.escalation_role else pol.reviewer_role end;
    if not exists(select 1 from public.organization_members where organization_id=d.organization_id and role=reviewer and user_id<>auth.uid()) then
      raise exception 'Belum ada pemeriksa % yang berbeda dari pengaju. Owner perlu mengatur kebijakan atau keanggotaan.',reviewer;
    end if;
    snapshot:=to_jsonb(pol);
  end if;
  insert into public.approval_requests(organization_id,module_key,record_type,record_id,requested_by,required_role,document_id,document_version,document_snapshot,policy_snapshot,approval_step)
  values(d.organization_id,d.module_key,d.record_type,d.target_id::text,auth.uid(),reviewer,d.id,d.version,gsp_private.document_snapshot(d),snapshot,1) returning id into request_id;
  update public.workflow_documents set state='submitted',submitted_at=now(),updated_at=now() where id=d.id;
  perform gsp_private.log_document(d,'submitted',jsonb_build_object('request_id',request_id,'reviewer_role',reviewer,'approval_stages',case when d.record_type='advance' then jsonb_build_array('manager','finance') else jsonb_build_array(reviewer) end,'policy_version',pol.version));
  return request_id;
end $$;

create or replace function public.review_approval_request(p_request_id uuid,p_decision text,p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare d public.workflow_documents; r public.approval_requests; doc_id uuid; next_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_decision is null or p_decision not in ('approved','rejected') or nullif(btrim(p_note),'') is null or length(p_note)>2000 then raise exception 'Keputusan dan catatan wajib diisi.'; end if;
  select document_id into doc_id from public.approval_requests where id=p_request_id;
  if doc_id is null then raise exception 'Permintaan lama tidak memiliki dokumen terverifikasi. Buat pengajuan baru.'; end if;
  select * into d from public.workflow_documents where id=doc_id for update;
  select * into r from public.approval_requests where id=p_request_id for update;
  if not public.has_org_role(d.organization_id,array[r.required_role]) then raise exception 'Peran pemeriksa tidak berwenang.' using errcode='42501'; end if;
  if r.requested_by=auth.uid() then raise exception 'Pengaju tidak boleh memeriksa pengajuannya sendiri.'; end if;
  if r.organization_id<>d.organization_id or r.record_type<>d.record_type or r.record_id<>d.target_id::text or r.document_version<>d.version or r.document_snapshot is distinct from gsp_private.document_snapshot(d) then raise exception 'Organisasi, dokumen, atau versi persetujuan tidak cocok.'; end if;
  if r.status<>'pending' or d.state<>'submitted' then raise exception 'Permintaan sudah diputuskan.'; end if;
  if p_decision='approved' then
    perform gsp_private.validate_payload(d.organization_id,d.record_type,d.payload);
    perform gsp_private.check_target(d);
  end if;
  update public.approval_requests set status=p_decision,reviewed_by=auth.uid(),decision_note=btrim(p_note),decided_at=now() where id=r.id;
  if d.record_type='advance' and p_decision='approved' and r.approval_step=1 then
    if not exists(select 1 from public.organization_members where organization_id=d.organization_id and role='finance' and user_id<>auth.uid() and user_id<>d.created_by) then
      raise exception 'Belum ada pemeriksa Accounting & Finance yang berbeda dari pengaju dan Manager.';
    end if;
    insert into public.approval_requests(organization_id,module_key,record_type,record_id,requested_by,required_role,document_id,document_version,document_snapshot,policy_snapshot,approval_step)
    values(d.organization_id,d.module_key,d.record_type,d.target_id::text,d.created_by,'finance',d.id,d.version,gsp_private.document_snapshot(d),r.policy_snapshot,2) returning id into next_id;
    update public.workflow_documents set updated_at=now() where id=d.id;
    perform gsp_private.log_document(d,'manager_approved',jsonb_build_object('request_id',r.id,'next_request_id',next_id,'note',btrim(p_note),'next_role','finance'));
    return;
  end if;
  update public.workflow_documents set state=p_decision,updated_at=now() where id=d.id;
  perform gsp_private.log_document(d,p_decision,jsonb_build_object('request_id',r.id,'approval_step',r.approval_step,'note',btrim(p_note)));
end $$;

create or replace function public.execute_workflow_document(p_document_id uuid,p_expected_version integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare d public.workflow_documents; r public.approval_requests; cfg jsonb; fields text; expressions text; assignments text; changed integer; before_data jsonb;
begin
  select * into d from public.workflow_documents where id=p_document_id for update;
  if d.id is null or not public.can_read_workflow(d.organization_id,d.record_type) then raise exception 'Dokumen tidak dapat diakses.' using errcode='42501'; end if;
  select * into r from public.approval_requests where document_id=d.id and document_version=d.version
    order by approval_step desc limit 1 for update;
  if not public.is_org_member(d.organization_id) then raise exception 'Anda tidak berwenang mengeksekusi dokumen.' using errcode='42501'; end if;
  if d.record_type='advance' then
    if not public.has_org_role(d.organization_id,array['finance','owner']) then raise exception 'Kasbon hanya dapat dieksekusi Accounting & Finance setelah seluruh tahap disetujui.' using errcode='42501'; end if;
  elsif not (d.created_by=auth.uid() or public.has_org_role(d.organization_id,array[r.required_role,'owner'])) then
    raise exception 'Anda tidak berwenang mengeksekusi dokumen.' using errcode='42501';
  end if;
  if d.created_by=auth.uid() and d.record_type<>'advance' then perform gsp_private.check_writer(d.organization_id,d.record_type); end if;
  if d.version is distinct from p_expected_version then raise exception 'Versi dokumen berubah.'; end if;
  if d.state='executed' then return (select record_id from public.workflow_executions where document_id=d.id); end if;
  if d.state<>'approved' or r.id is null or r.status<>'approved' or r.reviewed_by=r.requested_by then raise exception 'Dokumen belum disetujui.'; end if;
  if d.record_type='advance' and (r.approval_step<>2 or r.required_role<>'finance') then raise exception 'Kasbon belum melewati persetujuan Accounting & Finance.'; end if;
  if r.organization_id<>d.organization_id or r.record_type<>d.record_type or r.record_id<>d.target_id::text or r.document_snapshot is distinct from gsp_private.document_snapshot(d) then raise exception 'Snapshot persetujuan tidak cocok.'; end if;
  perform gsp_private.validate_payload(d.organization_id,d.record_type,d.payload);
  perform gsp_private.check_target(d,true);
  cfg:=gsp_private.record_config(d.record_type);
  select string_agg(format('%I',key),',' order by key),string_agg(format('v.%I',key),',' order by key),string_agg(format('%I=v.%I',key,key),',' order by key)
    into fields,expressions,assignments from jsonb_object_keys(d.payload) as keys(key);
  if d.operation='create' then
    execute format('insert into public.%I (id,organization_id,created_by,%s) select $2,$3,$4,%s from jsonb_populate_record(null::public.%I,$1) v',cfg->>'table',fields,expressions,cfg->>'table')
      using d.payload,d.target_id,d.organization_id,d.created_by;
  else
    execute format('select to_jsonb(t) from public.%I t where id=$1',cfg->>'table') into before_data using d.target_id;
    execute format('update public.%I t set %s,row_version=t.row_version+1,updated_at=now() from jsonb_populate_record(null::public.%I,$1) v where t.id=$2 and t.organization_id=$3 and t.row_version=$4',cfg->>'table',assignments,cfg->>'table')
      using d.payload,d.target_id,d.organization_id,d.base_version;
    get diagnostics changed = row_count;
    if changed<>1 then raise exception 'Versi record tujuan sudah berubah.'; end if;
  end if;
  insert into public.workflow_executions(document_id,organization_id,request_id,document_version,record_id,executed_by)
    values(d.id,d.organization_id,r.id,d.version,d.target_id,auth.uid());
  update public.workflow_documents set state='executed',executed_at=now(),updated_at=now() where id=d.id;
  perform gsp_private.log_document(d,'executed',jsonb_build_object('request_id',r.id,'before',before_data,'after',d.payload));
  return d.target_id;
end $$;

create or replace function gsp_private.seed_policies() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.approval_policies(organization_id,record_type)
    select new.id,t from unnest(array['client','project','work_item','account','employee','tax_record','asset','payment']) t;
  insert into public.approval_policies(organization_id,record_type,reviewer_role,escalation_role)
    values(new.id,'advance','manager','finance') on conflict (organization_id,record_type) do nothing;
  return new;
end $$;

insert into public.approval_policies(organization_id,record_type,reviewer_role,escalation_role)
  select o.id,'advance','manager','finance' from public.organizations o
  on conflict (organization_id,record_type) do update
    set reviewer_role='manager',escalation_role='finance',escalation_amount=null,version=public.approval_policies.version+1,updated_at=now();

create or replace function gsp_private.create_advance_payable() returns trigger
language plpgsql security definer set search_path = '' as $$
declare employee_name text;
begin
  select coalesce(nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),u.email,'Karyawan')
    into employee_name from auth.users u where u.id=new.created_by;
  insert into public.payment_records(organization_id,payment_number,payee_name,description,invoice_date,due_on,amount,status,reference_number,notes,created_by,cash_advance_id)
  values(new.organization_id,'KASBON-'||replace(new.id::text,'-',''),coalesce(employee_name,'Karyawan'),
    'Pencairan kasbon '||new.advance_number||' ('||case new.purpose_type when 'project' then 'proyek' else 'perjalanan dinas' end||')',
    new.needed_on,new.needed_on,new.amount,'unpaid','ADV-'||left(replace(new.id::text,'-',''),12),new.description,new.created_by,new.id);
  return new;
end $$;
create trigger cash_advance_create_payable after insert on public.cash_advances
  for each row execute function gsp_private.create_advance_payable();

create or replace function gsp_private.sync_advance_disbursement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.cash_advance_id is not null and old.status is distinct from new.status and new.status='paid' then
    update public.cash_advances set advance_status='disbursed',updated_at=now()
      where id=new.cash_advance_id and organization_id=new.organization_id;
  end if;
  return new;
end $$;
create trigger payment_sync_cash_advance after update of status on public.payment_records
  for each row execute function gsp_private.sync_advance_disbursement();

drop trigger if exists audit_payment_records on public.payment_records;
create trigger audit_payment_records after insert or update or delete on public.payment_records
  for each row execute function public.audit_module_record('payment','pembayaran');

notify pgrst, 'reload schema';
