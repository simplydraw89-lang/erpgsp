-- ============================================================================
-- Migration: 20261111_automated_client_user_provisioning.sql
-- Fitur: Pembuatan Akun User Klien Otomatis Berdasarkan Proyek &
-- Integrasi Akses Portal 2 Arah (Permintaan Data, Amdalnet, & MoM) Tanpa SQL Manual.
-- ============================================================================

create extension if not exists pgcrypto;

-- 1. Perbarui can_access_project agar klien dapat mengakses proyek status 'planned' dan 'active'
create or replace function public.can_access_project(p_org uuid, p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select 
    gsp_private.project_internal(p_org, p_project)
    or exists(
      select 1 
      from public.project_memberships m
      join public.crm_projects p on p.id = m.project_id and p.organization_id = m.organization_id
      join public.person_profiles profile on profile.organization_id = m.organization_id and profile.user_id = m.user_id and profile.relationship_status = m.member_type
      where m.organization_id = p_org 
        and m.project_id = p_project 
        and m.user_id = auth.uid() 
        and m.is_active 
        and p.status in ('active', 'planned')
    );
$$;


-- 2. Fungsi Utama: auto_provision_project_client
-- Membuat akun Supabase Auth untuk klien (jika belum ada), menghubungkannya ke organisasi,
-- dan mengaktifkan hak akses interaksi 2 arah (can_submit = true) untuk proyek terkait.
create or replace function public.auto_provision_project_client(
  p_project_id uuid,
  p_email text default null,
  p_client_name text default null,
  p_password text default 'KlienGSP2026!'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_proj public.crm_projects;
  v_client public.sales_clients;
  v_org_id uuid;
  v_branch_id uuid;
  v_email text;
  v_name text;
  v_password text;
  v_user_id uuid;
  v_instance_id uuid;
  v_caller uuid := auth.uid();
  v_is_new_user boolean := false;
  v_welcome_id uuid;
begin
  -- 1. Ambil data proyek
  select * into v_proj from public.crm_projects where id = p_project_id;
  if v_proj.id is null then
    raise exception 'Proyek tidak ditemukan.' using errcode = 'P0002';
  end if;

  v_org_id := v_proj.organization_id;
  v_branch_id := v_proj.branch_id;

  -- 2. Ambil data klien terkait
  if v_proj.client_id is not null then
    select * into v_client from public.sales_clients where id = v_proj.client_id;
  end if;

  -- 3. Tentukan email & nama klien
  v_email := lower(btrim(coalesce(nullif(p_email, ''), v_client.email, '')));
  if v_email = '' then
    raise exception 'Email klien belum ditentukan. Masukkan email klien untuk mengaktifkan akses portal.' using errcode = '22023';
  end if;

  v_name := coalesce(nullif(btrim(p_client_name), ''), v_client.name, split_part(v_email, '@', 1));
  v_password := coalesce(nullif(p_password, ''), 'KlienGSP2026!');

  -- 4. Cari apakah akun sudah ada di auth.users
  select id into v_user_id from auth.users where lower(email) = v_email limit 1;

  -- 5. Jika akun belum ada di auth.users, buat secara otomatis
  if v_user_id is null then
    v_is_new_user := true;
    v_user_id := gen_random_uuid();

    select coalesce(
      (select instance_id from auth.users where instance_id is not null limit 1),
      '00000000-0000-0000-0000-000000000000'::uuid
    ) into v_instance_id;

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at
    ) values (
      v_instance_id,
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('full_name', v_name, 'name', v_name, 'relationship_status', 'client'),
      false,
      now(),
      now()
    );
  else
    -- Pastikan email terkonfirmasi
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = v_user_id and email_confirmed_at is null;
  end if;

  -- 6. Hubungkan akun ke public.organization_members
  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_user_id, 'staff')
  on conflict (organization_id, user_id) do nothing;

  -- 7. Hubungkan akun ke public.person_profiles dengan status 'client'
  insert into public.person_profiles (organization_id, user_id, relationship_status)
  values (v_org_id, v_user_id, 'client')
  on conflict (organization_id, user_id) do update
  set relationship_status = 'client';

  -- 8. Pastikan project_access_scopes memiliki cabang terkait
  if v_branch_id is not null then
    insert into public.project_access_scopes (organization_id, project_id, branch_id)
    values (v_org_id, p_project_id, v_branch_id)
    on conflict do nothing;
  end if;

  -- 9. Daftarkan ke public.project_memberships dengan hak akses 2 ARAH AKTIF (can_submit = true)
  insert into public.project_memberships (
    organization_id,
    project_id,
    user_id,
    member_type,
    can_submit,
    is_active,
    granted_by,
    granted_at
  ) values (
    v_org_id,
    p_project_id,
    v_user_id,
    'client',
    true,
    true,
    coalesce(v_caller, v_user_id),
    now()
  )
  on conflict (project_id, user_id) do update
  set member_type = 'client',
      can_submit = true,
      is_active = true;

  -- 10. Perbarui email klien di sales_clients jika sebelumnya kosong
  if v_client.id is not null and (v_client.email is null or btrim(v_client.email) = '') then
    update public.sales_clients set email = v_email where id = v_client.id;
  end if;

  -- 11. Buat posting pembuka otomatis di portal proyek jika belum ada entri sama sekali
  if not exists (
    select 1 from public.project_portal_entries
    where project_id = p_project_id and organization_id = v_org_id
  ) then
    insert into public.project_portal_entries (
      organization_id,
      project_id,
      kind,
      audience,
      title,
      body,
      created_by
    ) values (
      v_org_id,
      p_project_id,
      'status',
      'external',
      'Ruang Kolaborasi 2 Arah Proyek Aktif',
      'Portal proyek ini aktif sebagai saluran koordinasi resmi 2 arah antara PT. Global Solusi Prima dengan pihak klien (' || v_name || '). Anda dapat memantau progres pelaksanaan, mengunggah checklist dokumen/data pendukung (seperti Amdalnet), serta berdiskusi pada notulensi rapat resmi (MoM).',
      coalesce(v_caller, v_user_id)
    ) returning id into v_welcome_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', v_email,
    'name', v_name,
    'is_new_user', v_is_new_user,
    'default_password', v_password,
    'project_id', p_project_id,
    'project_code', v_proj.code,
    'message', 'Akun klien ' || v_email || ' berhasil diaktifkan dengan hak akses interaksi 2 arah.'
  );
end;
$$;

grant execute on function public.auto_provision_project_client(uuid, text, text, text) to authenticated;


-- 3. Izinkan Branch Admin & Project Manager mengatur akses portal klien (menghilangkan bottleneck Super Admin)
create or replace function public.set_project_portal_access(
  p_org uuid,
  p_project uuid,
  p_branch uuid,
  p_user uuid,
  p_member_type text,
  p_can_submit boolean,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_has_access boolean;
begin
  -- Izinkan Super Admin ATAU Pejabat yang memiliki akses bisnis pada cabang proyek
  v_has_access := gsp_private.is_superadmin(p_org) or public.can_access_business(p_org, p_branch, 'operations') or public.can_access_business(p_org, p_branch, 'procurement') or public.can_access_business(p_org, p_branch, 'sales');
  
  if not v_has_access then
    raise exception 'Akses ditolak: Hanya Super Admin atau Manajer Proyek cabang yang dapat mengatur akses portal.' using errcode = '42501';
  end if;

  if not exists(select 1 from public.crm_projects where id = p_project and organization_id = p_org)
     or not exists(select 1 from public.business_units where id = p_branch and organization_id = p_org and kind in ('branch', 'center')) then
    raise exception 'Proyek atau cabang tidak valid.';
  end if;

  insert into public.project_access_scopes (organization_id, project_id, branch_id)
  values (p_org, p_project, p_branch)
  on conflict do nothing;

  insert into public.person_profiles (organization_id, user_id, relationship_status)
  values (p_org, p_user, p_member_type)
  on conflict (organization_id, user_id) do update
  set relationship_status = excluded.relationship_status;

  insert into public.project_memberships (
    organization_id, project_id, user_id, member_type, can_submit, is_active, granted_by
  ) values (
    p_org, p_project, p_user, p_member_type, p_can_submit, p_active, coalesce(v_caller, p_user)
  )
  on conflict (project_id, user_id) do update
  set member_type = excluded.member_type,
      can_submit = excluded.can_submit,
      is_active = excluded.is_active;
end;
$$;

grant execute on function public.set_project_portal_access(uuid, uuid, uuid, uuid, text, boolean, boolean) to authenticated;


-- 4. Hubungkan otomatis akun bara@bara.test ke seluruh proyek aktif yang ada saat ini
do $$
declare
  v_proj record;
  v_bara_id uuid;
begin
  select id into v_bara_id from auth.users where lower(email) = 'bara@bara.test' limit 1;

  for v_proj in (select id, organization_id, branch_id from public.crm_projects) loop
    if v_bara_id is not null then
      perform public.auto_provision_project_client(v_proj.id, 'bara@bara.test', 'Bara Multi Klien', 'KlienGSP2026!');
    end if;
  end loop;

  raise notice 'Otomatisasi pembuatan akun klien & akses portal 2 arah siap digunakan.';
end $$;

notify pgrst, 'reload schema';
