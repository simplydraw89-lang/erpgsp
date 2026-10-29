create table if not exists public.crm_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  company_name text,
  email text,
  phone text,
  status text not null default 'prospect'
    check (status in ('prospect', 'client', 'inactive')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_clients_org_created_idx
  on public.crm_clients(organization_id, created_at desc);

create table if not exists public.crm_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.crm_clients(id) on delete set null,
  code text not null,
  name text not null,
  status text not null default 'planned'
    check (status in ('planned', 'active', 'on_hold', 'completed', 'cancelled')),
  starts_on date,
  ends_on date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index if not exists crm_projects_org_created_idx
  on public.crm_projects(organization_id, created_at desc);

create unique index if not exists crm_clients_org_id_uq
  on public.crm_clients(organization_id, id);

create unique index if not exists crm_projects_org_id_uq
  on public.crm_projects(organization_id, id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'crm_projects_client_same_org_fk'
      and conrelid = 'public.crm_projects'::regclass
  ) then
    alter table public.crm_projects
      add constraint crm_projects_client_same_org_fk
      foreign key (organization_id, client_id)
      references public.crm_clients(organization_id, id);
  end if;
end;
$$;

create table if not exists public.operational_work_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.crm_projects(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'blocked', 'done')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  due_on date,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operational_work_items_org_status_idx
  on public.operational_work_items(organization_id, status, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'operational_work_items_project_same_org_fk'
      and conrelid = 'public.operational_work_items'::regclass
  ) then
    alter table public.operational_work_items
      add constraint operational_work_items_project_same_org_fk
      foreign key (organization_id, project_id)
      references public.crm_projects(organization_id, id);
  end if;
end;
$$;

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  account_type text not null
    check (account_type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  normal_balance text not null
    check (normal_balance in ('debit', 'credit')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists finance_accounts_org_type_idx
  on public.finance_accounts(organization_id, account_type, code);

create table if not exists public.hr_employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_number text not null,
  full_name text not null,
  email text,
  job_title text,
  department text,
  employment_status text not null default 'active'
    check (employment_status in ('active', 'on_leave', 'resigned')),
  started_on date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_number)
);

create index if not exists hr_employees_org_status_idx
  on public.hr_employees(organization_id, employment_status, full_name);

create table if not exists public.tax_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tax_period text not null check (tax_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  tax_type text not null
    check (tax_type in ('ppn', 'pph21', 'pph23', 'pph4_2', 'pph25', 'pph29', 'other')),
  reference_number text,
  tax_base numeric(18, 2) not null default 0 check (tax_base >= 0),
  tax_amount numeric(18, 2) not null default 0 check (tax_amount >= 0),
  due_on date,
  status text not null default 'draft'
    check (status in ('draft', 'reviewed', 'reported')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tax_records_org_period_idx
  on public.tax_records(organization_id, tax_period desc, created_at desc);

alter table public.crm_clients enable row level security;
alter table public.crm_projects enable row level security;
alter table public.operational_work_items enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.hr_employees enable row level security;
alter table public.tax_records enable row level security;

drop policy if exists "organization members can read CRM clients" on public.crm_clients;
create policy "organization members can read CRM clients"
  on public.crm_clients for select to authenticated
  using (public.is_org_member(organization_id));
drop policy if exists "authorized roles can manage CRM clients" on public.crm_clients;
create policy "authorized roles can manage CRM clients"
  on public.crm_clients for all to authenticated
  using (public.has_org_role(organization_id, array['owner', 'director', 'operations', 'staff']::text[]))
  with check (public.has_org_role(organization_id, array['owner', 'director', 'operations', 'staff']::text[]));

drop policy if exists "organization members can read CRM projects" on public.crm_projects;
create policy "organization members can read CRM projects"
  on public.crm_projects for select to authenticated
  using (public.is_org_member(organization_id));
drop policy if exists "authorized roles can manage CRM projects" on public.crm_projects;
create policy "authorized roles can manage CRM projects"
  on public.crm_projects for all to authenticated
  using (public.has_org_role(organization_id, array['owner', 'director', 'operations']::text[]))
  with check (public.has_org_role(organization_id, array['owner', 'director', 'operations']::text[]));

drop policy if exists "organization members can read work items" on public.operational_work_items;
create policy "organization members can read work items"
  on public.operational_work_items for select to authenticated
  using (public.is_org_member(organization_id));
drop policy if exists "authorized roles can manage work items" on public.operational_work_items;
create policy "authorized roles can manage work items"
  on public.operational_work_items for all to authenticated
  using (public.has_org_role(organization_id, array['owner', 'director', 'operations', 'staff']::text[]))
  with check (public.has_org_role(organization_id, array['owner', 'director', 'operations', 'staff']::text[]));

drop policy if exists "finance roles can read accounts" on public.finance_accounts;
create policy "finance roles can read accounts"
  on public.finance_accounts for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'director', 'finance', 'auditor']::text[]));
drop policy if exists "finance roles can manage accounts" on public.finance_accounts;
create policy "finance roles can manage accounts"
  on public.finance_accounts for all to authenticated
  using (public.has_org_role(organization_id, array['owner', 'finance']::text[]))
  with check (public.has_org_role(organization_id, array['owner', 'finance']::text[]));

drop policy if exists "HR roles can read employees" on public.hr_employees;
create policy "HR roles can read employees"
  on public.hr_employees for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'director', 'hr']::text[]));
drop policy if exists "HR roles can manage employees" on public.hr_employees;
create policy "HR roles can manage employees"
  on public.hr_employees for all to authenticated
  using (public.has_org_role(organization_id, array['owner', 'hr']::text[]))
  with check (public.has_org_role(organization_id, array['owner', 'hr']::text[]));

drop policy if exists "finance roles can read tax records" on public.tax_records;
create policy "finance roles can read tax records"
  on public.tax_records for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'director', 'finance', 'auditor']::text[]));
drop policy if exists "finance roles can manage tax records" on public.tax_records;
create policy "finance roles can manage tax records"
  on public.tax_records for all to authenticated
  using (public.has_org_role(organization_id, array['owner', 'finance']::text[]))
  with check (public.has_org_role(organization_id, array['owner', 'finance']::text[]));

grant select, insert, update, delete on public.crm_clients to authenticated;
grant select, insert, update, delete on public.crm_projects to authenticated;
grant select, insert, update, delete on public.operational_work_items to authenticated;
grant select, insert, update, delete on public.finance_accounts to authenticated;
grant select, insert, update, delete on public.hr_employees to authenticated;
grant select, insert, update, delete on public.tax_records to authenticated;

create or replace function public.audit_module_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  target_org uuid;
  target_id text;
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
  else
    row_data := to_jsonb(new);
  end if;
  target_org := (row_data ->> 'organization_id')::uuid;
  target_id := row_data ->> 'id';

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id, details
  )
  values (
    target_org,
    actor,
    lower(tg_op),
    tg_argv[0],
    target_id,
    jsonb_build_object('module_key', tg_argv[1])
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.audit_module_record() from public;

drop trigger if exists audit_crm_clients on public.crm_clients;
create trigger audit_crm_clients
  after insert or update or delete on public.crm_clients
  for each row execute function public.audit_module_record('crm_client', 'crm');

drop trigger if exists audit_crm_projects on public.crm_projects;
create trigger audit_crm_projects
  after insert or update or delete on public.crm_projects
  for each row execute function public.audit_module_record('crm_project', 'crm');

drop trigger if exists audit_operational_work_items on public.operational_work_items;
create trigger audit_operational_work_items
  after insert or update or delete on public.operational_work_items
  for each row execute function public.audit_module_record('work_item', 'operasional');

drop trigger if exists audit_finance_accounts on public.finance_accounts;
create trigger audit_finance_accounts
  after insert or update or delete on public.finance_accounts
  for each row execute function public.audit_module_record('finance_account', 'keuangan');

drop trigger if exists audit_hr_employees on public.hr_employees;
create trigger audit_hr_employees
  after insert or update or delete on public.hr_employees
  for each row execute function public.audit_module_record('employee', 'sdm');

drop trigger if exists audit_tax_records on public.tax_records;
create trigger audit_tax_records
  after insert or update or delete on public.tax_records
  for each row execute function public.audit_module_record('tax_record', 'perpajakan');
