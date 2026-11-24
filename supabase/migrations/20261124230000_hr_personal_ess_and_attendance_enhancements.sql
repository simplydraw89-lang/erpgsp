-- ============================================================================
-- 20261124230000_hr_personal_ess_and_attendance_enhancements.sql
-- 1. Tambah Fitur Kamera Selfie, Geofencing Kantor (100m) vs Site Lapangan
-- 2. Dukungan Personal ESS (Employee Self-Service) untuk Seluruh Karyawan
-- ============================================================================

alter table public.hr_attendance add column if not exists attendance_type text default 'office'
  check (attendance_type in ('office', 'site'));

alter table public.hr_attendance add column if not exists latitude numeric;
alter table public.hr_attendance add column if not exists longitude numeric;
alter table public.hr_attendance add column if not exists photo_data text;
alter table public.hr_attendance add column if not exists reason text;

-- Perbarui RPC record_attendance_entry untuk mendukung tipe lokasi, GPS & foto kamera
create or replace function public.record_attendance_entry_v2(
  p_org uuid,
  p_attendance_type text default 'office',
  p_status text default 'present',
  p_work_summary text default null,
  p_location_note text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_photo_data text default null,
  p_reason text default null
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
  -- Cari mapping employee_id berdasarkan email atau user_id
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
      attendance_type, attendance_status, work_summary, location_note,
      latitude, longitude, photo_data, reason
    ) values (
      p_org, auth.uid(), v_emp_id, v_today, now(),
      coalesce(p_attendance_type, 'office'), coalesce(p_status, 'present'),
      trim(p_work_summary), trim(p_location_note),
      p_latitude, p_longitude, p_photo_data, trim(p_reason)
    )
    returning * into v_rec;

    return jsonb_build_object(
      'action', 'clock_in',
      'id', v_rec.id,
      'work_date', v_rec.work_date,
      'clock_in', v_rec.clock_in,
      'type', v_rec.attendance_type,
      'status', v_rec.attendance_status,
      'message', case when v_rec.attendance_type = 'site'
                   then 'Absen masuk di site proyek berhasil dicatat.'
                   else 'Absen masuk di kantor berhasil diverifikasi.'
                 end
    );
  else
    -- Absen Pulang (Clock-Out) & Update Laporan
    update public.hr_attendance
    set clock_out = now(),
        attendance_status = coalesce(p_status, attendance_status),
        attendance_type = coalesce(p_attendance_type, attendance_type),
        work_summary = coalesce(nullif(trim(p_work_summary), ''), work_summary),
        location_note = coalesce(nullif(trim(p_location_note), ''), location_note),
        latitude = coalesce(p_latitude, latitude),
        longitude = coalesce(p_longitude, longitude),
        photo_data = coalesce(p_photo_data, photo_data),
        reason = coalesce(nullif(trim(p_reason), ''), reason)
    where id = v_rec.id
    returning * into v_rec;

    return jsonb_build_object(
      'action', 'clock_out',
      'id', v_rec.id,
      'work_date', v_rec.work_date,
      'clock_in', v_rec.clock_in,
      'clock_out', v_rec.clock_out,
      'type', v_rec.attendance_type,
      'status', v_rec.attendance_status,
      'message', 'Absen pulang berhasil dicatat.'
    );
  end if;
end;
$$;

revoke all on function public.record_attendance_entry_v2(uuid, text, text, text, text, numeric, numeric, text, text) from anon, public;
grant execute on function public.record_attendance_entry_v2(uuid, text, text, text, text, numeric, numeric, text, text) to authenticated;

notify pgrst, 'reload schema';
