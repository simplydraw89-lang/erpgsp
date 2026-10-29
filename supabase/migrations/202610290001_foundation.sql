create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in (
    'owner', 'director', 'finance', 'hr', 'operations', 'auditor', 'staff'
  )),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_members_user_idx
  on public.organization_members(user_id);

create table if not exists public.integration_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null check (module_key in (
    'crm', 'operasional', 'keuangan', 'sdm', 'perpajakan', 'manajemen'
  )),
  source_system text not null,
  base_url text,
  status text not null default 'planned' check (status in ('planned', 'active', 'paused')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, module_key)
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null check (module_key in (
    'crm', 'operasional', 'keuangan', 'sdm', 'perpajakan', 'manajemen'
  )),
  record_type text not null,
  record_id text not null,
  requested_by uuid not null references auth.users(id),
  required_role text not null check (required_role in (
    'owner', 'director', 'finance', 'hr', 'operations'
  )),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id),
  decision_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (
    (status = 'pending' and reviewed_by is null and decided_at is null)
    or (status in ('approved', 'rejected') and reviewed_by is not null and decided_at is not null)
  )
);

create index if not exists approval_requests_org_status_idx
  on public.approval_requests(organization_id, status, created_at desc);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_org_created_idx
  on public.audit_events(organization_id, created_at desc);

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.role = any(allowed_roles)
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.integration_sources enable row level security;
alter table public.approval_requests enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists "members can read organizations" on public.organizations;
create policy "members can read organizations"
  on public.organizations for select to authenticated
  using (public.is_org_member(id));

drop policy if exists "members can read organization membership" on public.organization_members;
create policy "members can read organization membership"
  on public.organization_members for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists "authorized roles can manage membership" on public.organization_members;
create policy "authorized roles can manage membership"
  on public.organization_members for all to authenticated
  using (public.has_org_role(organization_id, array['owner']::text[]))
  with check (public.has_org_role(organization_id, array['owner']::text[]));

drop policy if exists "authorized roles can view integration sources" on public.integration_sources;
create policy "authorized roles can view integration sources"
  on public.integration_sources for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'director', 'auditor']::text[]));

drop policy if exists "members can read approval requests" on public.approval_requests;
create policy "members can read approval requests"
  on public.approval_requests for select to authenticated
  using (
    requested_by = (select auth.uid())
    or public.has_org_role(organization_id, array[required_role, 'owner']::text[])
  );

drop policy if exists "members can submit approval requests" on public.approval_requests;
create policy "members can submit approval requests"
  on public.approval_requests for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and decided_at is null
    and public.is_org_member(organization_id)
  );

drop policy if exists "authorized roles can read audit events" on public.audit_events;
create policy "authorized roles can read audit events"
  on public.audit_events for select to authenticated
  using (public.has_org_role(organization_id, array['owner', 'director', 'auditor']::text[]));

create or replace function public.review_approval_request(
  p_request_id uuid,
  p_decision text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.approval_requests%rowtype;
  reviewer_role text;
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;
  if nullif(btrim(p_note), '') is null then
    raise exception 'Decision note is required';
  end if;

  select *
    into request_row
    from public.approval_requests
    where id = p_request_id
    for update;

  if not found then
    raise exception 'Approval request not found';
  end if;
  if request_row.status <> 'pending' then
    raise exception 'Approval request is no longer pending';
  end if;
  if request_row.requested_by = actor then
    raise exception 'Requester cannot review their own request';
  end if;

  select m.role
    into reviewer_role
    from public.organization_members m
    where m.organization_id = request_row.organization_id
      and m.user_id = actor;

  if reviewer_role is null then
    raise exception 'Organization membership required';
  end if;
  if reviewer_role not in (request_row.required_role, 'owner') then
    raise exception 'Reviewer role is not authorized for this request';
  end if;

  update public.approval_requests
    set status = p_decision,
        reviewed_by = actor,
        decision_note = btrim(p_note),
        decided_at = now()
    where id = request_row.id;

  insert into public.audit_events (
    organization_id, actor_id, action, entity_type, entity_id, details
  )
  values (
    request_row.organization_id,
    actor,
    p_decision,
    'approval_request',
    request_row.id::text,
    jsonb_build_object(
      'module_key', request_row.module_key,
      'record_type', request_row.record_type,
      'record_id', request_row.record_id,
      'requested_by', request_row.requested_by,
      'note', btrim(p_note)
    )
  );
end;
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, text[]) from public;
revoke all on function public.review_approval_request(uuid, text, text) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;
grant execute on function public.review_approval_request(uuid, text, text) to authenticated;

grant select on public.organizations to authenticated;
grant select, insert on public.approval_requests to authenticated;
grant select on public.audit_events to authenticated;
grant select on public.integration_sources to authenticated;
grant select on public.organization_members to authenticated;
grant insert, update, delete on public.organization_members to authenticated;
revoke update, delete on public.approval_requests from authenticated;
revoke insert, update, delete on public.audit_events from authenticated;
revoke insert, update, delete on public.integration_sources from authenticated;

comment on table public.integration_sources is
  'Non-secret integration registry. Store service credentials only in deployment secrets or a managed vault.';
