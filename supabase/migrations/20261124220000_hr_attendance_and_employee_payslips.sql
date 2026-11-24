-- ============================================================================
-- 20261124220000_hr_attendance_and_employee_payslips.sql
-- 1. Modul Absensi Kehadiran Karyawan (hr_attendance):
--    - Absen Masuk (Clock-In) & Absen Pulang (Clock-Out)
--    - Status Kehadiran: Hadir (Kantor), Dinas Luar / Lapangan, WFH, Sakit, Izin
--    - Ringkasan aktivitas kerja harian & lokasi
-- 2. Izin Akses Slip Gaji Mandiri untuk Masing-Masing Karyawan:
--    - Karyawan dapat melihat dan mengunduh rincian slip gaji pribadi dari payroll_items
-- ============================================================================

create table if not exists public.hr_attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid references public.hr_employees(id) on delete set null,
  work_date date not null default current_date,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  attendance_status text not null default 'present'
    check (attendance_status in ('present', 'field_trip', 'wfh', 'sick', 'permission')),
  work_summary text,
  location_note text,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, work_date)
);

create index if not exists hr_attendance_org_date_idx
  on public.hr_attendance (organization_id, work_date desc, attendance_status);

create index if not exists hr_attendance_user_idx
  on public.hr_attendance (user_id, work_date desc);

alter table public.hr_attendance enable row level security;

-- Kebijakan RLS Absensi:
-- 1. Karyawan dapat melihat riwayat absensi miliknya sendiri
-- 2. HR, Manager, Direksi, dan Owner dapat melihat absensi semua karyawan
drop policy if exists hr_attendance_read on public.hr_attendance;
create policy hr_attendance_read on public.hr_attendance
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      user_id = auth.uid()
      or public.has_org_role(organization_id, array['owner', 'director', 'hr', 'manager', 'auditor'])
      or public.has_business_job(organization_id, null, array['hr', 'branch_manager'])
    )
  );

-- Karyawan dapat mencatat absensi masuk & pulang miliknya sendiri
drop policy if exists hr_attendance_write on public.hr_attendance;
create policy hr_attendance_write on public.hr_attendance
  for all to authenticated
  using (
    public.is_org_member(organization_id)
    and user_id = auth.uid()
  )
  with check (
    public.is_org_member(organization_id)
    and user_id = auth.uid()
  );

-- RPC Fungsi Catat Absen Masuk & Pulang
create or replace function public.record_attendance_entry(
  p_org uuid,
  p_status text default 'present',
  p_work_summary text default null,
  p_location_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := current_date;
  v_rec public.hr_attendance%rowtype;
  v_emp_id uuid;
begin
  -- Cari mapping employee_id jika ada
  select id into v_emp_id
  from public.hr_employees
  where organization_id = p_org
    and (created_by = auth.uid() or lower(email) = lower(auth.jwt()->>'email'))
  limit 1;

  select * into v_rec
  from public.hr_attendance
  where organization_id = p_org
    and user_id = auth.uid()
    and work_date = v_today;

  if not found then
    -- Absen Masuk (Clock-In)
    insert into public.hr_attendance (
      organization_id, user_id, employee_id, work_date, clock_in,
      attendance_status, work_summary, location_note
    ) values (
      p_org, auth.uid(), v_emp_id, v_today, now(),
      coalesce(p_status, 'present'), trim(p_work_summary), trim(p_location_note)
    )
    returning * into v_rec;

    return jsonb_build_object(
      'action', 'clock_in',
      'id', v_rec.id,
      'work_date', v_rec.work_date,
      'clock_in', v_rec.clock_in,
      'status', v_rec.attendance_status,
      'message', 'Absen masuk berhasil dicatat.'
    );
  else
    -- Absen Pulang (Clock-Out) & Update Laporan Kerja
    update public.hr_attendance
    set clock_out = now(),
        attendance_status = coalesce(p_status, attendance_status),
        work_summary = coalesce(nullif(trim(p_work_summary), ''), work_summary),
        location_note = coalesce(nullif(trim(p_location_note), ''), location_note)
    where id = v_rec.id
    returning * into v_rec;

    return jsonb_build_object(
      'action', 'clock_out',
      'id', v_rec.id,
      'work_date', v_rec.work_date,
      'clock_in', v_rec.clock_in,
      'clock_out', v_rec.clock_out,
      'status', v_rec.attendance_status,
      'message', 'Absen pulang berhasil dicatat.'
    );
  end if;
end;
$$;

revoke all on function public.record_attendance_entry(uuid, text, text, text) from anon, public;
grant execute on function public.record_attendance_entry(uuid, text, text, text) to authenticated;

-- Perbarui Kebijakan RLS payroll_items: Izinkan setiap pengguna melihat slip gaji miliknya sendiri
drop policy if exists payroll_items_read on public.payroll_items;
create policy payroll_items_read on public.payroll_items
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      public.has_org_role(organization_id, array['owner', 'director', 'finance', 'hr', 'auditor'])
      or public.has_business_job(organization_id, null, array['hr', 'finance', 'accounting_tax'])
      or exists (
        select 1 from public.hr_employees e
        where e.id = employee_id
          and e.organization_id = payroll_items.organization_id
          and (e.created_by = auth.uid() or lower(e.email) = lower(auth.jwt()->>'email'))
      )
    )
  );

notify pgrst, 'reload schema';
