-- ============================================================================
-- Migration: 20261111_auto_link_auth_users_and_client_portal.sql
-- Fitur: Otomatisasi Penghubungan Akun Supabase Auth (Termasuk Akun Klien & Test)
-- ke Organisasi (organization_members & person_profiles).
-- Menghilangkan keharusan menjalankan query SQL manual setiap kali membuat user baru.
-- ============================================================================

-- 1. Fungsi trigger otomatis saat user baru dibuat di auth.users
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org_id uuid;
  v_rel text := 'client';
  v_meta_rel text;
begin
  -- Ambil ID organisasi utama (PT. Global Solusi Prima)
  select id into v_org_id from public.organizations order by created_at limit 1;
  if v_org_id is null then
    return new;
  end if;

  -- Periksa metadata user jika ada
  v_meta_rel := coalesce(new.raw_user_meta_data->>'relationship_status', '');

  -- Tentukan status hubungan secara cerdas berdasarkan email / metadata
  if v_meta_rel in ('client', 'vendor', 'consultant', 'permanent', 'contract', 'probation') then
    v_rel := v_meta_rel;
  elsif lower(new.email) ilike '%client%' or lower(new.email) ilike '%klien%' or lower(new.email) ilike '%bara%' then
    v_rel := 'client';
  elsif lower(new.email) ilike '%vendor%' then
    v_rel := 'vendor';
  elsif lower(new.email) ilike '%konsultan%' or lower(new.email) ilike '%consultant%' then
    v_rel := 'consultant';
  elsif lower(new.email) ilike '%dir%' or lower(new.email) ilike '%manager%' or lower(new.email) ilike '%adm%' or lower(new.email) ilike '%gsp%' then
    v_rel := 'permanent';
  else
    v_rel := 'client'; -- Default akun eksternal adalah klien portal
  end if;

  -- Hubungkan ke organization_members
  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, new.id, 'staff')
  on conflict (organization_id, user_id) do nothing;

  -- Hubungkan ke person_profiles
  insert into public.person_profiles (organization_id, user_id, relationship_status)
  values (v_org_id, new.id, v_rel)
  on conflict (organization_id, user_id) do update
  set relationship_status = excluded.relationship_status;

  -- Auto-confirm email user jika belum terkonfirmasi
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = new.id and email_confirmed_at is null;

  return new;
exception
  when others then
    -- Jangan memblokir pembuatan user di auth.users jika terjadi error sinkronisasi
    raise warning 'Gagal auto-link user % ke organisasi: %', new.id, sqlerrm;
    return new;
end;
$$;

-- Pasang trigger pada auth.users
drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();


-- 2. Fungsi RPC untuk Sinkronisasi Manual / Massal dari Halaman Super Admin
-- Bisa dipanggil kapan saja oleh Super Admin dari UI tanpa menulis SQL manual
create or replace function public.sync_unlinked_auth_users(p_org uuid default null)
returns table(
  user_id uuid,
  email text,
  full_name text,
  relationship_status text,
  status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org_id uuid := p_org;
  v_user record;
  v_rel text;
begin
  if v_org_id is null then
    select id into v_org_id from public.organizations order by created_at limit 1;
  end if;

  if v_org_id is null then
    raise exception 'Organisasi tidak ditemukan.';
  end if;

  -- Iterasi semua user di auth.users yang belum terdaftar di organization_members
  for v_user in (
    select 
      u.id,
      u.email,
      coalesce(nullif(u.raw_user_meta_data->>'full_name',''), nullif(u.raw_user_meta_data->>'name',''), split_part(u.email, '@', 1)) as display_name,
      coalesce(u.raw_user_meta_data->>'relationship_status', '') as meta_rel
    from auth.users u
    left join public.organization_members m on m.user_id = u.id and m.organization_id = v_org_id
    where m.user_id is null
  ) loop
    -- Tentukan status
    if v_user.meta_rel in ('client', 'vendor', 'consultant', 'permanent', 'contract', 'probation') then
      v_rel := v_user.meta_rel;
    elsif lower(v_user.email) ilike '%client%' or lower(v_user.email) ilike '%klien%' or lower(v_user.email) ilike '%bara%' then
      v_rel := 'client';
    elsif lower(v_user.email) ilike '%vendor%' then
      v_rel := 'vendor';
    elsif lower(v_user.email) ilike '%konsultan%' or lower(v_user.email) ilike '%consultant%' then
      v_rel := 'consultant';
    elsif lower(v_user.email) ilike '%dir%' or lower(v_user.email) ilike '%manager%' or lower(v_user.email) ilike '%adm%' or lower(v_user.email) ilike '%gsp%' then
      v_rel := 'permanent';
    else
      v_rel := 'client';
    end if;

    -- Hubungkan ke organization_members
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_user.id, 'staff')
    on conflict (organization_id, user_id) do nothing;

    -- Hubungkan ke person_profiles
    insert into public.person_profiles (organization_id, user_id, relationship_status)
    values (v_org_id, v_user.id, v_rel)
    on conflict (organization_id, user_id) do update
    set relationship_status = excluded.relationship_status;

    -- Konfirmasi email
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = v_user.id and email_confirmed_at is null;

    -- Kembalikan baris hasil
    user_id := v_user.id;
    email := v_user.email;
    full_name := v_user.display_name;
    relationship_status := v_rel;
    status := 'Berhasil Dihubungkan';
    return next;
  end loop;

  return;
end;
$$;

grant execute on function public.sync_unlinked_auth_users(uuid) to authenticated;


-- 3. Fungsi RPC untuk mengubah status hubungan kerja/klien secara instan dari UI
create or replace function public.update_member_relationship(
  p_org uuid,
  p_user uuid,
  p_relationship text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    gsp_private.is_superadmin(p_org) or
    public.has_org_role(p_org, array['owner']::text[])
  ) then
    raise exception 'Hanya Super Admin yang dapat mengubah status hubungan.';
  end if;

  if p_relationship not in ('client', 'consultant', 'vendor', 'permanent', 'contract', 'probation') then
    raise exception 'Status hubungan tidak valid.';
  end if;

  insert into public.person_profiles (organization_id, user_id, relationship_status)
  values (p_org, p_user, p_relationship)
  on conflict (organization_id, user_id) do update
  set relationship_status = excluded.relationship_status;

  return true;
end;
$$;

grant execute on function public.update_member_relationship(uuid, uuid, text) to authenticated;


-- 4. Eksekusi langsung sinkronisasi backfill saat migration dijalankan
-- Ini otomatis mendaftarkan bara@bara.test dan akun manapun yang sudah dibuat di Auth
do $$
declare
  v_count integer := 0;
begin
  perform public.sync_unlinked_auth_users(null);
  
  -- Pastikan akun bara@bara.test secara spesifik berstatus client
  update public.person_profiles
  set relationship_status = 'client'
  where user_id in (
    select id from auth.users where lower(email) = 'bara@bara.test'
  );

  raise notice 'Sinkronisasi seluruh akun auth selesai.';
end $$;

notify pgrst, 'reload schema';
