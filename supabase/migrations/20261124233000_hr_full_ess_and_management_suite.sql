-- ============================================================================
-- 20261124233000_hr_full_ess_and_management_suite.sql
-- 1. Tabel ESS Karyawan: Reimbursement, SPPD, Timesheet Harian, Vault Dokumen
-- 2. Tabel Manajemen SDM: Disiplin & SP (Confidential)
-- 3. RLS Guards: User hanya melihat data diri sendiri, HR/Direksi akses penuh
-- ============================================================================

-- 1. Klaim Reimbursement Operasional Lapangan (ESS)
create table if not exists public.hr_reimbursements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.crm_projects(id) on delete set null,
  title text not null,
  category text not null check (category in ('transport', 'accommodation', 'meals', 'field_supplies', 'others')),
  amount numeric not null check (amount > 0),
  expense_date date not null default current_date,
  receipt_url text,
  description text,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'approved_hr', 'paid', 'rejected')),
  reviewer_id uuid references auth.users(id) on delete set null,
  review_note text,
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Surat Perintah Perjalanan Dinas (SPPD) & Penugasan
create table if not exists public.hr_sppd (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sppd_number text not null,
  destination_city text not null,
  departure_date date not null,
  return_date date not null,
  purpose text not null,
  daily_allowance numeric not null default 0,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  field_report_notes text,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sppd_dates_valid check (return_date >= departure_date)
);

-- 3. Timesheet / Logbook Harian Jam Kerja Proyek
create table if not exists public.hr_timesheets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.crm_projects(id) on delete set null,
  log_date date not null default current_date,
  duration_hours numeric not null check (duration_hours > 0 and duration_hours <= 24),
  activity_description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Vault Dokumen & Sertifikasi Pribadi Karyawan
create table if not exists public.hr_employee_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null check (doc_type in ('ktp', 'npwp', 'bpjs_kes', 'bpjs_tk', 'diploma', 'certificate_ska', 'certificate_k3', 'other')),
  title text not null,
  file_url text not null,
  certificate_expiry date,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Disiplin & Surat Peringatan (Khusus HR & Direksi)
create table if not exists public.hr_disciplinary_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  sp_number text not null,
  level text not null check (level in ('coaching', 'sp1', 'sp2', 'sp3')),
  incident_date date not null default current_date,
  issue_description text not null,
  effective_until date not null,
  notes text,
  issued_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.hr_reimbursements enable row level security;
alter table public.hr_sppd enable row level security;
alter table public.hr_timesheets enable row level security;
alter table public.hr_employee_documents enable row level security;
alter table public.hr_disciplinary_actions enable row level security;

-- Policies for hr_reimbursements
drop policy if exists hr_reimbursements_select on public.hr_reimbursements;
create policy hr_reimbursements_select on public.hr_reimbursements
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      user_id = auth.uid()
      or public.has_org_role(organization_id, array['owner', 'director', 'hr', 'finance'])
    )
  );

drop policy if exists hr_reimbursements_insert on public.hr_reimbursements;
create policy hr_reimbursements_insert on public.hr_reimbursements
  for insert to authenticated
  with check (
    public.is_org_member(organization_id)
    and user_id = auth.uid()
  );

drop policy if exists hr_reimbursements_update on public.hr_reimbursements;
create policy hr_reimbursements_update on public.hr_reimbursements
  for update to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      (user_id = auth.uid() and status = 'draft')
      or public.has_org_role(organization_id, array['owner', 'director', 'hr', 'finance'])
    )
  );

-- Policies for hr_sppd
drop policy if exists hr_sppd_select on public.hr_sppd;
create policy hr_sppd_select on public.hr_sppd
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      user_id = auth.uid()
      or public.has_org_role(organization_id, array['owner', 'director', 'hr'])
    )
  );

-- Policies for hr_timesheets
drop policy if exists hr_timesheets_all on public.hr_timesheets;
create policy hr_timesheets_all on public.hr_timesheets
  for all to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      user_id = auth.uid()
      or public.has_org_role(organization_id, array['owner', 'director', 'hr'])
    )
  );

-- Policies for hr_employee_documents
drop policy if exists hr_employee_documents_all on public.hr_employee_documents;
create policy hr_employee_documents_all on public.hr_employee_documents
  for all to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      user_id = auth.uid()
      or public.has_org_role(organization_id, array['owner', 'director', 'hr'])
    )
  );

-- Policies for hr_disciplinary_actions (Strictly HR & Direksi)
drop policy if exists hr_disciplinary_actions_all on public.hr_disciplinary_actions;
create policy hr_disciplinary_actions_all on public.hr_disciplinary_actions
  for all to authenticated
  using (
    public.is_org_member(organization_id)
    and public.has_org_role(organization_id, array['owner', 'director', 'hr'])
  );

grant select, insert, update, delete on public.hr_reimbursements to authenticated;
grant select, insert, update, delete on public.hr_sppd to authenticated;
grant select, insert, update, delete on public.hr_timesheets to authenticated;
grant select, insert, update, delete on public.hr_employee_documents to authenticated;
grant select, insert, update, delete on public.hr_disciplinary_actions to authenticated;
