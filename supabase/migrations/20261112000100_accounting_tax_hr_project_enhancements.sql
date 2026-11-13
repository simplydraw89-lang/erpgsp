-- ============================================================================
-- Migration: 20261112000100_accounting_tax_hr_project_enhancements.sql
-- Tujuan (Prioritas 2, 3, dan 4):
--   P2: Rekonsiliasi mutasi bank per baris (bank_statement_lines) & RPC matching
--   P3: Modul Cuti (leave_balances, leave_requests) & Payroll Dasar (payroll_runs, payroll_items)
--   P4: Realisasi Timesheet Proyek (project_timesheets) & Penyusutan Aset Cabang (company_assets)
-- ============================================================================

begin;

-- ============================================================================
-- 1. REKONSILIASI BANK PER BARIS (P2)
-- ============================================================================
create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid not null references public.company_entities(id) on delete cascade,
  account_id uuid not null references public.finance_accounts(id) on delete restrict,
  statement_date date not null,
  reference_no text,
  description text not null,
  debit numeric(18, 2) not null default 0 check (debit >= 0),
  credit numeric(18, 2) not null default 0 check (credit >= 0),
  match_status text not null default 'unmatched' check (match_status in ('unmatched', 'matched', 'ignored')),
  matched_journal_id uuid references public.accounting_journals(id) on delete set null,
  matched_by uuid references auth.users(id) on delete set null,
  matched_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint bank_statement_lines_one_side check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create index if not exists bank_statement_lines_org_idx
  on public.bank_statement_lines (organization_id, account_id, statement_date desc);

alter table public.bank_statement_lines enable row level security;

drop policy if exists bank_statement_lines_read on public.bank_statement_lines;
create policy bank_statement_lines_read on public.bank_statement_lines
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      public.has_org_role(organization_id, array['owner', 'director', 'finance', 'auditor'])
      or public.has_business_job(organization_id, null, array['finance', 'accounting_tax'])
    )
  );

create or replace function public.add_bank_statement_line(
  p_org uuid,
  p_entity_id uuid,
  p_account_id uuid,
  p_statement_date date,
  p_reference_no text,
  p_description text,
  p_debit numeric,
  p_credit numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform gsp_private.assert_writable();
  if not (
    public.has_org_role(p_org, array['owner', 'finance'])
    or public.has_business_job(p_org, null, array['finance', 'accounting_tax'])
  ) then
    raise exception 'Anda tidak memiliki izin menambahkan mutasi rekening koran.';
  end if;

  if trim(coalesce(p_description, '')) = '' then
    raise exception 'Keterangan mutasi wajib diisi.';
  end if;

  insert into public.bank_statement_lines (
    organization_id, entity_id, account_id, statement_date, reference_no,
    description, debit, credit, created_by
  ) values (
    p_org, p_entity_id, p_account_id, p_statement_date, nullif(trim(coalesce(p_reference_no, '')), ''),
    trim(p_description), coalesce(p_debit, 0), coalesce(p_credit, 0), auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.match_bank_statement_line(
  p_org uuid,
  p_line_id uuid,
  p_journal_id uuid,
  p_status text default 'matched'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform gsp_private.assert_writable();
  if not (
    public.has_org_role(p_org, array['owner', 'finance'])
    or public.has_business_job(p_org, null, array['finance', 'accounting_tax'])
  ) then
    raise exception 'Anda tidak memiliki izin mencocokkan mutasi rekening koran.';
  end if;

  if p_status not in ('matched', 'unmatched', 'ignored') then
    raise exception 'Status pencocokan tidak valid.';
  end if;

  update public.bank_statement_lines
  set match_status = p_status,
      matched_journal_id = case when p_status = 'matched' then p_journal_id else null end,
      matched_by = case when p_status = 'matched' then auth.uid() else null end,
      matched_at = case when p_status = 'matched' then now() else null end
  where id = p_line_id and organization_id = p_org;

  if not found then
    raise exception 'Baris mutasi bank tidak ditemukan.';
  end if;
end;
$$;

revoke all on function public.add_bank_statement_line(uuid, uuid, uuid, date, text, text, numeric, numeric) from anon, public;
grant execute on function public.add_bank_statement_line(uuid, uuid, uuid, date, text, text, numeric, numeric) to authenticated;
revoke all on function public.match_bank_statement_line(uuid, uuid, uuid, text) from anon, public;
grant execute on function public.match_bank_statement_line(uuid, uuid, uuid, text) to authenticated;

-- ============================================================================
-- 2. MODUL CUTI KARYAWAN (P3)
-- ============================================================================
create table if not exists public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  leave_year integer not null check (leave_year between 2020 and 2100),
  annual_quota integer not null default 12 check (annual_quota >= 0),
  used_days integer not null default 0 check (used_days >= 0),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, leave_year)
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid references public.business_units(id) on delete set null,
  leave_type text not null check (leave_type in ('annual', 'sick', 'important', 'maternity', 'unpaid')),
  starts_on date not null,
  ends_on date not null,
  total_days integer not null check (total_days > 0),
  reason text not null,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected', 'cancelled')),
  reviewer_id uuid references auth.users(id) on delete set null,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_requests_dates_valid check (ends_on >= starts_on)
);

create index if not exists leave_requests_org_idx
  on public.leave_requests (organization_id, status, starts_on desc);

alter table public.leave_balances enable row level security;
alter table public.leave_requests enable row level security;

drop policy if exists leave_balances_read on public.leave_balances;
create policy leave_balances_read on public.leave_balances
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      user_id = auth.uid()
      or public.has_org_role(organization_id, array['owner', 'director', 'hr', 'auditor'])
      or public.has_business_job(organization_id, null, array['hr', 'branch_manager'])
    )
  );

drop policy if exists leave_requests_read on public.leave_requests;
create policy leave_requests_read on public.leave_requests
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      user_id = auth.uid()
      or public.has_org_role(organization_id, array['owner', 'director', 'hr', 'auditor'])
      or public.has_business_job(organization_id, branch_id, array['hr', 'branch_manager'])
    )
  );

create or replace function public.submit_leave_request(
  p_org uuid,
  p_branch_id uuid,
  p_leave_type text,
  p_starts_on date,
  p_ends_on date,
  p_total_days integer,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_year integer;
  v_quota integer;
  v_used integer;
begin
  perform gsp_private.assert_writable();
  if not public.is_org_member(p_org) then
    raise exception 'Bukan anggota organisasi.';
  end if;

  if p_ends_on < p_starts_on or coalesce(p_total_days, 0) <= 0 then
    raise exception 'Rentang tanggal atau jumlah hari cuti tidak valid.';
  end if;

  if trim(coalesce(p_reason, '')) = '' then
    raise exception 'Alasan cuti wajib diisi.';
  end if;

  v_year := extract(year from p_starts_on)::integer;

  insert into public.leave_balances (organization_id, user_id, leave_year, annual_quota, used_days)
  values (p_org, auth.uid(), v_year, 12, 0)
  on conflict (organization_id, user_id, leave_year) do nothing;

  if p_leave_type = 'annual' then
    select annual_quota, used_days into v_quota, v_used
    from public.leave_balances
    where organization_id = p_org and user_id = auth.uid() and leave_year = v_year;

    if (v_used + p_total_days) > v_quota then
      raise exception 'Saldo cuti tahunan tidak mencukupi (tersisa % hari).', greatest(0, v_quota - v_used);
    end if;
  end if;

  insert into public.leave_requests (
    organization_id, user_id, branch_id, leave_type, starts_on, ends_on, total_days, reason, status
  ) values (
    p_org, auth.uid(), p_branch_id, p_leave_type, p_starts_on, p_ends_on, p_total_days, trim(p_reason), 'submitted'
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.review_leave_request(
  p_org uuid,
  p_request_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.leave_requests%rowtype;
  v_year integer;
begin
  perform gsp_private.assert_writable();

  select * into v_req
  from public.leave_requests
  where id = p_request_id and organization_id = p_org
  for update;

  if not found then
    raise exception 'Pengajuan cuti tidak ditemukan.';
  end if;

  if v_req.status <> 'submitted' then
    raise exception 'Pengajuan cuti ini sudah diproses.';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Keputusan tidak valid.';
  end if;

  if v_req.user_id = auth.uid() and not public.has_org_role(p_org, array['owner']) then
    raise exception 'Pengaju tidak dapat menyetujui pengajuan cutinya sendiri.';
  end if;

  if not (
    public.has_org_role(p_org, array['owner', 'director', 'hr'])
    or public.has_business_job(p_org, v_req.branch_id, array['hr', 'branch_manager'])
  ) then
    raise exception 'Anda tidak memiliki wewenang memeriksa pengajuan cuti ini.';
  end if;

  if p_decision = 'rejected' and trim(coalesce(p_note, '')) = '' then
    raise exception 'Alasan penolakan wajib diisi.';
  end if;

  update public.leave_requests
  set status = p_decision,
      reviewer_id = auth.uid(),
      review_note = nullif(trim(coalesce(p_note, '')), ''),
      reviewed_at = now(),
      updated_at = now()
  where id = p_request_id;

  if p_decision = 'approved' and v_req.leave_type = 'annual' then
    v_year := extract(year from v_req.starts_on)::integer;
    update public.leave_balances
    set used_days = used_days + v_req.total_days,
        updated_at = now()
    where organization_id = p_org and user_id = v_req.user_id and leave_year = v_year;
  end if;
end;
$$;

revoke all on function public.submit_leave_request(uuid, uuid, text, date, date, integer, text) from anon, public;
grant execute on function public.submit_leave_request(uuid, uuid, text, date, date, integer, text) to authenticated;
revoke all on function public.review_leave_request(uuid, uuid, text, text) from anon, public;
grant execute on function public.review_leave_request(uuid, uuid, text, text) to authenticated;

-- ============================================================================
-- 3. PAYROLL DASAR SDM (P3)
-- ============================================================================
create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_month text not null check (period_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid')),
  total_gross numeric(18, 2) not null default 0 check (total_gross >= 0),
  total_deductions numeric(18, 2) not null default 0 check (total_deductions >= 0),
  total_net numeric(18, 2) not null default 0 check (total_net >= 0),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, period_month)
);

create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete restrict,
  base_salary numeric(18, 2) not null default 0 check (base_salary >= 0),
  allowances numeric(18, 2) not null default 0 check (allowances >= 0),
  deductions numeric(18, 2) not null default 0 check (deductions >= 0),
  pph21_amount numeric(18, 2) not null default 0 check (pph21_amount >= 0),
  net_pay numeric(18, 2) not null default 0 check (net_pay >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (payroll_run_id, employee_id)
);

alter table public.payroll_runs enable row level security;
alter table public.payroll_items enable row level security;

drop policy if exists payroll_runs_read on public.payroll_runs;
create policy payroll_runs_read on public.payroll_runs
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      public.has_org_role(organization_id, array['owner', 'director', 'finance', 'hr', 'auditor'])
      or public.has_business_job(organization_id, null, array['hr', 'finance', 'accounting_tax'])
    )
  );

drop policy if exists payroll_items_read on public.payroll_items;
create policy payroll_items_read on public.payroll_items
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      public.has_org_role(organization_id, array['owner', 'director', 'finance', 'hr', 'auditor'])
      or public.has_business_job(organization_id, null, array['hr', 'finance', 'accounting_tax'])
    )
  );

create or replace function public.create_payroll_run(
  p_org uuid,
  p_period_month text,
  p_title text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_item jsonb;
  v_base numeric;
  v_allow numeric;
  v_ded numeric;
  v_pph numeric;
  v_net numeric;
  v_tot_gross numeric := 0;
  v_tot_ded numeric := 0;
  v_tot_net numeric := 0;
begin
  perform gsp_private.assert_writable();
  if not (
    public.has_org_role(p_org, array['owner', 'hr', 'finance'])
    or public.has_business_job(p_org, null, array['hr', 'finance'])
  ) then
    raise exception 'Anda tidak memiliki izin membuat daftar payroll.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Minimal satu item karyawan wajib diisi.';
  end if;

  insert into public.payroll_runs (organization_id, period_month, title, created_by)
  values (p_org, p_period_month, trim(p_title), auth.uid())
  returning id into v_run_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_base := coalesce((v_item->>'base_salary')::numeric, 0);
    v_allow := coalesce((v_item->>'allowances')::numeric, 0);
    v_ded := coalesce((v_item->>'deductions')::numeric, 0);
    v_pph := coalesce((v_item->>'pph21_amount')::numeric, 0);
    v_net := greatest(0, v_base + v_allow - v_ded - v_pph);

    insert into public.payroll_items (
      organization_id, payroll_run_id, employee_id,
      base_salary, allowances, deductions, pph21_amount, net_pay, notes
    ) values (
      p_org, v_run_id, (v_item->>'employee_id')::uuid,
      v_base, v_allow, v_ded, v_pph, v_net, nullif(trim(coalesce(v_item->>'notes', '')), '')
    );

    v_tot_gross := v_tot_gross + v_base + v_allow;
    v_tot_ded := v_tot_ded + v_ded + v_pph;
    v_tot_net := v_tot_net + v_net;
  end loop;

  update public.payroll_runs
  set total_gross = v_tot_gross,
      total_deductions = v_tot_ded,
      total_net = v_tot_net
  where id = v_run_id;

  return v_run_id;
end;
$$;

create or replace function public.approve_payroll_run(
  p_org uuid,
  p_run_id uuid,
  p_next_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.payroll_runs%rowtype;
begin
  perform gsp_private.assert_writable();
  select * into v_run from public.payroll_runs where id = p_run_id and organization_id = p_org for update;
  if not found then
    raise exception 'Data payroll tidak ditemukan.';
  end if;

  if p_next_status not in ('approved', 'paid') then
    raise exception 'Status payroll tidak valid.';
  end if;

  if v_run.created_by = auth.uid() and not public.has_org_role(p_org, array['owner']) then
    raise exception 'Pembuat payroll tidak dapat menyetujui pengajuannya sendiri.';
  end if;

  if not (
    public.has_org_role(p_org, array['owner', 'director', 'finance'])
    or public.has_business_job(p_org, null, array['finance'])
  ) then
    raise exception 'Anda tidak memiliki izin menyetujui/membayar payroll.';
  end if;

  update public.payroll_runs
  set status = p_next_status,
      approved_by = coalesce(approved_by, auth.uid()),
      approved_at = coalesce(approved_at, now())
  where id = p_run_id;
end;
$$;

revoke all on function public.create_payroll_run(uuid, text, text, jsonb) from anon, public;
grant execute on function public.create_payroll_run(uuid, text, text, jsonb) to authenticated;
revoke all on function public.approve_payroll_run(uuid, uuid, text) from anon, public;
grant execute on function public.approve_payroll_run(uuid, uuid, text) to authenticated;

-- ============================================================================
-- 4. REALISASI TIMESHEET PROYEK & PENYUSUTAN ASET CABANG (P4)
-- ============================================================================
create table if not exists public.project_timesheets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.crm_projects(id) on delete cascade,
  work_date date not null,
  personnel_name text not null,
  personnel_role text,
  phase_name text not null,
  hours_worked numeric(6, 2) not null check (hours_worked > 0 and hours_worked <= 24),
  progress_pct integer not null default 0 check (progress_pct between 0 and 100),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists project_timesheets_proj_idx
  on public.project_timesheets (organization_id, project_id, work_date desc);

alter table public.project_timesheets enable row level security;

drop policy if exists project_timesheets_read on public.project_timesheets;
create policy project_timesheets_read on public.project_timesheets
  for select to authenticated
  using (public.is_org_member(organization_id));

create or replace function public.log_project_timesheet(
  p_org uuid,
  p_project_id uuid,
  p_work_date date,
  p_personnel_name text,
  p_personnel_role text,
  p_phase_name text,
  p_hours_worked numeric,
  p_progress_pct integer,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_status text;
begin
  perform gsp_private.assert_writable();
  if not public.is_org_member(p_org) then
    raise exception 'Bukan anggota organisasi.';
  end if;

  select approval_status into v_status
  from public.crm_projects
  where id = p_project_id and organization_id = p_org;

  if v_status is null then
    raise exception 'Proyek tidak ditemukan.';
  end if;
  if v_status <> 'active' then
    raise exception 'Realisasi timesheet hanya dapat dicatat pada proyek yang berstatus active.';
  end if;

  insert into public.project_timesheets (
    organization_id, project_id, work_date, personnel_name, personnel_role,
    phase_name, hours_worked, progress_pct, notes, created_by
  ) values (
    p_org, p_project_id, p_work_date, trim(p_personnel_name), nullif(trim(coalesce(p_personnel_role, '')), ''),
    trim(p_phase_name), p_hours_worked, coalesce(p_progress_pct, 0), nullif(trim(coalesce(p_notes, '')), ''), auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_project_timesheet(uuid, uuid, date, text, text, text, numeric, integer, text) from anon, public;
grant execute on function public.log_project_timesheet(uuid, uuid, date, text, text, text, numeric, integer, text) to authenticated;

-- Tambahkan kolom cabang & penyusutan pada company_assets
alter table public.company_assets
  add column if not exists branch_id uuid references public.business_units(id) on delete set null,
  add column if not exists useful_life_months integer not null default 48 check (useful_life_months > 0),
  add column if not exists residual_value numeric(18, 2) not null default 0 check (residual_value >= 0),
  add column if not exists depreciation_method text not null default 'straight_line' check (depreciation_method in ('straight_line', 'none'));

commit;
