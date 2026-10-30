-- Documents are proposals. Only execute_workflow_document may change live data.
create schema if not exists gsp_private;
revoke all on schema gsp_private from public, anon, authenticated;

create table public.company_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  category text not null,
  serial_number text,
  location text,
  custodian_id uuid,
  acquired_on date,
  purchase_cost numeric(18,2) not null default 0 check (purchase_cost >= 0),
  condition text not null default 'good' check (condition in ('good','needs_service','damaged')),
  status text not null default 'active' check (status in ('active','in_repair','retired')),
  notes text,
  row_version integer not null default 1 check (row_version > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  foreign key (organization_id, custodian_id) references public.organization_members(organization_id, user_id)
);
create index company_assets_org_status_idx on public.company_assets(organization_id,status);
create index company_assets_custodian_idx on public.company_assets(organization_id,custodian_id);
create index company_assets_created_by_idx on public.company_assets(created_by);

create function gsp_private.record_config(p_type text) returns jsonb
language sql immutable set search_path = '' as $$
  select case p_type
    when 'client' then '{"module":"crm","table":"crm_clients","writers":["owner","director","operations","staff"],"readers":["owner","director","finance","hr","operations","auditor","staff"],"required":["name","status"],"fields":["name","company_name","email","phone","status","notes"]}'::jsonb
    when 'project' then '{"module":"crm","table":"crm_projects","writers":["owner","director","operations"],"readers":["owner","director","finance","hr","operations","auditor","staff"],"required":["code","name","status"],"fields":["code","name","client_id","starts_on","ends_on","status"]}'::jsonb
    when 'work_item' then '{"module":"operasional","table":"operational_work_items","writers":["owner","director","operations","staff"],"readers":["owner","director","finance","hr","operations","auditor","staff"],"required":["title","priority","status"],"fields":["title","description","priority","due_on","project_id","assigned_to","status"]}'::jsonb
    when 'account' then '{"module":"keuangan","table":"finance_accounts","writers":["owner","finance"],"readers":["owner","director","finance","auditor"],"required":["code","name","account_type","normal_balance"],"fields":["code","name","account_type","normal_balance","is_active"]}'::jsonb
    when 'employee' then '{"module":"sdm","table":"hr_employees","writers":["owner","hr"],"readers":["owner","director","hr"],"required":["employee_number","full_name","employment_status"],"fields":["employee_number","full_name","email","job_title","department","started_on","employment_status"]}'::jsonb
    when 'tax_record' then '{"module":"perpajakan","table":"tax_records","writers":["owner","finance"],"readers":["owner","director","finance","auditor"],"required":["tax_period","tax_type","tax_base","tax_amount","status"],"fields":["tax_period","tax_type","reference_number","tax_base","tax_amount","due_on","status","notes"]}'::jsonb
    when 'asset' then '{"module":"asset","table":"company_assets","writers":["owner","finance","operations"],"readers":["owner","director","finance","operations","auditor","staff"],"required":["code","name","category","purchase_cost","condition","status"],"fields":["code","name","category","serial_number","location","custodian_id","acquired_on","purchase_cost","condition","status","notes"]}'::jsonb
  end;
$$;

create function public.can_read_workflow(p_org uuid,p_type text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_members m
    where m.organization_id=p_org and m.user_id=auth.uid()
      and (gsp_private.record_config(p_type)->'readers') ? m.role);
$$;
revoke all on function public.can_read_workflow(uuid,text) from public,anon;
grant execute on function public.can_read_workflow(uuid,text) to authenticated;

create table public.approval_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  record_type text not null check (record_type in ('client','project','work_item','account','employee','tax_record','asset')),
  reviewer_role text not null default 'director' check (reviewer_role in ('owner','director','finance','hr','operations')),
  escalation_amount numeric(18,2) check (escalation_amount >= 0),
  escalation_role text not null default 'owner' check (escalation_role in ('owner','director','finance','hr','operations')),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  unique(organization_id,record_type)
);

create table public.workflow_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  record_type text not null check (record_type in ('client','project','work_item','account','employee','tax_record','asset')),
  module_key text not null,
  operation text not null check (operation in ('create','update')),
  target_id uuid not null,
  base_version integer not null check (base_version >= 0),
  version integer not null default 1 check(version > 0),
  state text not null default 'draft' check (state in ('draft','submitted','approved','rejected','executed')),
  title text not null,
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  executed_at timestamptz,
  check ((operation='create' and base_version=0) or (operation='update' and base_version>0))
);
create index workflow_documents_org_state_idx on public.workflow_documents(organization_id,state,created_at desc);
create index workflow_documents_created_by_idx on public.workflow_documents(created_by);

alter table public.approval_requests
  add column document_id uuid references public.workflow_documents(id),
  add column document_version integer,
  add column document_snapshot jsonb,
  add column policy_snapshot jsonb;
alter table public.approval_requests add constraint approval_document_snapshot_complete check (
  document_id is null or (document_version is not null and document_version>0 and document_snapshot is not null and policy_snapshot is not null)
);
create unique index approval_requests_document_version_uq on public.approval_requests(document_id,document_version);
alter table public.approval_requests drop constraint approval_requests_module_key_check;
alter table public.approval_requests add constraint approval_requests_module_key_check
  check(module_key in ('crm','operasional','keuangan','sdm','perpajakan','manajemen','asset'));
alter table public.integration_sources drop constraint integration_sources_module_key_check;
alter table public.integration_sources add constraint integration_sources_module_key_check
  check(module_key in ('crm','operasional','keuangan','sdm','perpajakan','manajemen','asset'));

create table public.workflow_executions (
  document_id uuid primary key references public.workflow_documents(id),
  organization_id uuid not null references public.organizations(id),
  request_id uuid not null unique references public.approval_requests(id),
  document_version integer not null,
  record_id uuid not null,
  executed_by uuid not null references auth.users(id),
  executed_at timestamptz not null default now()
);
create index workflow_executions_org_idx on public.workflow_executions(organization_id);
create index workflow_executions_actor_idx on public.workflow_executions(executed_by);

alter table public.company_assets enable row level security;
alter table public.approval_policies enable row level security;
alter table public.workflow_documents enable row level security;
alter table public.workflow_executions enable row level security;
create policy asset_read on public.company_assets for select to authenticated using(public.can_read_workflow(organization_id,'asset'));
create policy policy_read on public.approval_policies for select to authenticated using(public.is_org_member(organization_id));
create policy document_read on public.workflow_documents for select to authenticated using(public.can_read_workflow(organization_id,record_type));
create policy execution_read on public.workflow_executions for select to authenticated using(exists(
  select 1 from public.workflow_documents d where d.id=document_id and public.can_read_workflow(d.organization_id,d.record_type)));

-- Replace the legacy insert path and requester-only read path. Membership and
-- sensitive-module authorization are always required, even for the requester.
drop policy "members can submit approval requests" on public.approval_requests;
drop policy "members can read approval requests" on public.approval_requests;
create policy approval_read on public.approval_requests for select to authenticated using (
  public.is_org_member(organization_id) and (
    (document_id is not null and public.can_read_workflow(organization_id,record_type)
      and (requested_by=auth.uid() or public.has_org_role(organization_id,array[required_role,'owner','director','auditor'])))
    or (document_id is null and (requested_by=auth.uid() or public.has_org_role(organization_id,array[required_role,'owner'])))
  )
);

-- Do not rely on hidden buttons or RLS alone: remove direct write privileges,
-- including TRUNCATE inherited from older Supabase default privileges.
do $$ declare t text; begin
  foreach t in array array['crm_clients','crm_projects','operational_work_items','finance_accounts','hr_employees','tax_records'] loop
    execute format('alter table public.%I add column row_version integer not null default 1 check(row_version>0)',t);
  end loop;
  foreach t in array array['crm_clients','crm_projects','operational_work_items','finance_accounts','hr_employees','tax_records','company_assets','workflow_documents','workflow_executions','approval_requests','approval_policies'] loop
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;

-- Enforce same-organization assignment for future writes without invalidating
-- historical rows that may predate the workflow migration.
alter table public.operational_work_items add constraint work_item_assignee_membership_fk
  foreign key (organization_id,assigned_to) references public.organization_members(organization_id,user_id) not valid;
create index operational_work_items_assignee_idx on public.operational_work_items(organization_id,assigned_to);

create function gsp_private.check_writer(p_org uuid,p_type text) returns void
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.organization_members m
    where m.organization_id=p_org and m.user_id=auth.uid()
      and (gsp_private.record_config(p_type)->'writers') ? m.role) then
    raise exception 'Peran Anda tidak diizinkan mengubah jenis dokumen ini.' using errcode='42501';
  end if;
end $$;

create function gsp_private.validate_payload(p_org uuid,p_type text,p_payload jsonb) returns void
language plpgsql set search_path = '' as $$
declare cfg jsonb:=gsp_private.record_config(p_type); k text; v text; n numeric; target_org uuid;
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
    if k in ('starts_on','ends_on','due_on','started_on','acquired_on') then
      if v !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Tanggal tidak valid.'; end if;
      perform v::date;
    end if;
    if k in ('purchase_cost','tax_base','tax_amount') then
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
end $$;

create function gsp_private.document_snapshot(d public.workflow_documents) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('payload',d.payload,'target_id',d.target_id,'base_version',d.base_version,'operation',d.operation);
$$;

create function gsp_private.check_target(d public.workflow_documents,p_lock boolean default false) returns void
language plpgsql set search_path = '' as $$
declare cfg jsonb:=gsp_private.record_config(d.record_type); actual_org uuid; actual_version integer;
begin
  execute format('select organization_id,row_version from public.%I where id=$1%s',cfg->>'table',case when p_lock then ' for update' else '' end)
    into actual_org,actual_version using d.target_id;
  if d.operation='create' then
    if actual_org is not null then raise exception 'Record tujuan sudah ada.'; end if;
  elsif actual_org is distinct from d.organization_id or actual_version is distinct from d.base_version then
    raise exception 'Record tujuan berbeda organisasi atau versinya sudah berubah. Buat draft perubahan baru.';
  end if;
end $$;

create function gsp_private.log_document(d public.workflow_documents,p_action text,p_details jsonb default '{}'::jsonb) returns void
language sql set search_path = '' as $$
  insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id,details)
  values(d.organization_id,auth.uid(),p_action,'workflow_document',d.id::text,
    jsonb_build_object('module_key',d.module_key,'version',d.version,'target_id',d.target_id)||p_details);
$$;

create function public.save_workflow_draft(p_org uuid,p_type text,p_payload jsonb,p_document_id uuid default null,p_expected_version integer default null,p_target_id uuid default null,p_target_version integer default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare d public.workflow_documents; cfg jsonb:=gsp_private.record_config(p_type); current_version integer;
begin
  perform gsp_private.check_writer(p_org,p_type);
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
      coalesce(p_payload->>'name',p_payload->>'title',p_payload->>'full_name',p_payload->>'tax_period'),p_payload,auth.uid()) returning * into d;
  else
    select * into d from public.workflow_documents where id=p_document_id for update;
    if d.id is null or d.organization_id<>p_org or d.record_type<>p_type or d.created_by<>auth.uid() then raise exception 'Draft tidak dapat diakses.'; end if;
    if d.state<>'draft' then raise exception 'Dokumen terkunci setelah diajukan.'; end if;
    if p_expected_version is distinct from d.version then raise exception 'Versi draft berubah. Muat ulang sebelum menyimpan.'; end if;
    update public.workflow_documents set payload=p_payload,
      title=coalesce(p_payload->>'name',p_payload->>'title',p_payload->>'full_name',p_payload->>'tax_period'),
      version=version+1,updated_at=now() where id=d.id returning * into d;
  end if;
  perform gsp_private.log_document(d,'draft_saved',jsonb_build_object('payload',d.payload));
  return d.id;
end $$;

create function public.submit_workflow_document(p_document_id uuid,p_expected_version integer) returns uuid
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
  amount:=coalesce((d.payload->>'purchase_cost')::numeric,(d.payload->>'tax_amount')::numeric,0);
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

create or replace function public.review_approval_request(p_request_id uuid,p_decision text,p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare d public.workflow_documents; r public.approval_requests; doc_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_decision is null or p_decision not in ('approved','rejected') or nullif(btrim(p_note),'') is null or length(p_note)>2000 then raise exception 'Keputusan dan catatan wajib diisi.'; end if;
  select document_id into doc_id from public.approval_requests where id=p_request_id;
  if doc_id is null then raise exception 'Permintaan lama tidak memiliki dokumen terverifikasi. Buat pengajuan baru.'; end if;
  -- All transitions lock document then request, in the same order.
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
  update public.workflow_documents set state=p_decision,updated_at=now() where id=d.id;
  perform gsp_private.log_document(d,p_decision,jsonb_build_object('request_id',r.id,'note',btrim(p_note)));
end $$;

create function public.execute_workflow_document(p_document_id uuid,p_expected_version integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare d public.workflow_documents; r public.approval_requests; cfg jsonb; fields text; expressions text; assignments text; changed integer; before_data jsonb;
begin
  select * into d from public.workflow_documents where id=p_document_id for update;
  if d.id is null or not public.can_read_workflow(d.organization_id,d.record_type) then raise exception 'Dokumen tidak dapat diakses.' using errcode='42501'; end if;
  select * into r from public.approval_requests where document_id=d.id and document_version=d.version for update;
  if not public.is_org_member(d.organization_id) or not (d.created_by=auth.uid() or public.has_org_role(d.organization_id,array[r.required_role,'owner'])) then raise exception 'Anda tidak berwenang mengeksekusi dokumen.' using errcode='42501'; end if;
  if d.created_by=auth.uid() then perform gsp_private.check_writer(d.organization_id,d.record_type); end if;
  if d.version is distinct from p_expected_version then raise exception 'Versi dokumen berubah.'; end if;
  if d.state='executed' then
    return (select record_id from public.workflow_executions where document_id=d.id);
  end if;
  if d.state<>'approved' or r.id is null or r.status<>'approved' or r.reviewed_by=r.requested_by then raise exception 'Dokumen belum disetujui.'; end if;
  if r.organization_id<>d.organization_id or r.record_type<>d.record_type or r.record_id<>d.target_id::text or r.document_snapshot is distinct from gsp_private.document_snapshot(d) then raise exception 'Snapshot persetujuan tidak cocok.'; end if;
  perform gsp_private.validate_payload(d.organization_id,d.record_type,d.payload);
  perform gsp_private.check_target(d,true);
  cfg:=gsp_private.record_config(d.record_type);
  select string_agg(format('%I',key),',' order by key),
    string_agg(format('v.%I',key),',' order by key),
    string_agg(format('%I=v.%I',key,key),',' order by key)
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

create function public.revise_workflow_document(p_document_id uuid,p_expected_version integer) returns void
language plpgsql security definer set search_path = '' as $$
declare d public.workflow_documents;
begin
  select * into d from public.workflow_documents where id=p_document_id for update;
  if d.id is null then raise exception 'Dokumen tidak ditemukan.'; end if;
  perform gsp_private.check_writer(d.organization_id,d.record_type);
  if d.created_by<>auth.uid() or d.state<>'rejected' or d.version is distinct from p_expected_version then raise exception 'Hanya pengaju dapat merevisi versi dokumen yang ditolak.'; end if;
  update public.workflow_documents set state='draft',version=version+1,submitted_at=null,updated_at=now() where id=d.id returning * into d;
  perform gsp_private.log_document(d,'revision_started');
end $$;

create function public.set_approval_policy(p_org uuid,p_type text,p_reviewer text,p_threshold numeric default null,p_escalation text default 'owner',p_expected_version integer default null) returns void
language plpgsql security definer set search_path = '' as $$
declare pol public.approval_policies;
begin
  if not public.has_org_role(p_org,array['owner']) then raise exception 'Hanya owner dapat mengatur kebijakan.' using errcode='42501'; end if;
  if gsp_private.record_config(p_type) is null then raise exception 'Jenis dokumen tidak valid.'; end if;
  if p_threshold is not null and p_type not in ('asset','tax_record') then raise exception 'Eskalasi nominal hanya tersedia untuk aset dan pajak.'; end if;
  if p_threshold is not null and (p_threshold<0 or p_threshold>9999999999999999.99 or p_threshold<>round(p_threshold,2)) then raise exception 'Batas nominal tidak valid.'; end if;
  -- Reviewers must also be allowed to read the document, especially HR records.
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

-- Safe initial policies. Owner can configure these; in-flight requests retain
-- their policy snapshot. New organizations receive the same baseline.
create function gsp_private.seed_policies() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.approval_policies(organization_id,record_type)
    select new.id,t from unnest(array['client','project','work_item','account','employee','tax_record','asset']) t;
  return new;
end $$;
create trigger organization_approval_policies after insert on public.organizations for each row execute function gsp_private.seed_policies();
insert into public.approval_policies(organization_id,record_type)
  select o.id,t from public.organizations o cross join unnest(array['client','project','work_item','account','employee','tax_record','asset']) t;

create trigger audit_company_assets after insert or update or delete on public.company_assets
  for each row execute function public.audit_module_record('asset','asset');

-- Remove default PUBLIC execution grants on internal helpers and public RPCs.
revoke all on all functions in schema gsp_private from public,anon,authenticated;
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('save_workflow_draft','submit_workflow_document','review_approval_request','execute_workflow_document','revise_workflow_document','set_approval_policy') loop
    execute format('revoke all on function %s from public,anon',f);
    execute format('grant execute on function %s to authenticated',f);
  end loop;
end $$;
