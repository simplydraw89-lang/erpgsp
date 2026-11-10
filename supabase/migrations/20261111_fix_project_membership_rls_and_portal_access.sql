-- ============================================================================
-- Migration: 20261111_fix_project_membership_rls_and_portal_access.sql
-- Perbaikan Bug RLS: Izinkan Admin Cabang, Manager, & Staf melihat
-- keanggotaan proyek klien (project_memberships) dan profil klien (person_profiles).
-- Sebelumnya RLS hanya mengizinkan 'owner' (Super Admin), sehingga saat Admin Cabang
-- melihat rincian proyek, status portal klien selalu tampil "Belum Terhubung".
-- ============================================================================

-- 1. Perbaiki RLS pada project_memberships agar dapat dibaca oleh staf internal & user terkait
drop policy if exists project_membership_read on public.project_memberships;
create policy project_membership_read on public.project_memberships
for select to authenticated
using (
  user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner', 'director', 'manager', 'finance', 'staff']::text[])
  or public.can_access_project(organization_id, project_id)
);

-- 2. Perbaiki RLS pada person_profiles agar staf internal dapat membaca profil klien/anggota
drop policy if exists own_profile on public.person_profiles;
create policy own_profile on public.person_profiles
for select to authenticated
using (
  user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner', 'director', 'manager', 'finance', 'staff']::text[])
  or relationship_status in ('client', 'consultant', 'vendor')
);

-- 3. Fungsi RPC Security Definer untuk mengambil status klien proyek secara andal
-- Dipanggil oleh halaman rincian proyek (/proyek/[id]) tanpa terhalang RLS
create or replace function public.get_project_client_info(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_membership record;
  v_user record;
  v_client record;
begin
  -- Cari keanggotaan klien di project_memberships
  select m.user_id, m.can_submit, m.is_active, m.member_type, m.created_at
  into v_membership
  from public.project_memberships m
  where m.project_id = p_project_id and m.member_type = 'client' and m.is_active
  limit 1;

  if v_membership.user_id is not null then
    select u.id, u.email,
           coalesce(nullif(u.raw_user_meta_data->>'full_name',''), nullif(u.raw_user_meta_data->>'name',''), split_part(u.email, '@', 1)) as display_name
    into v_user
    from auth.users u
    where u.id = v_membership.user_id;

    return jsonb_build_object(
      'is_connected', true,
      'user_id', v_membership.user_id,
      'email', v_user.email,
      'full_name', v_user.display_name,
      'can_submit', v_membership.can_submit,
      'is_active', v_membership.is_active
    );
  end if;

  -- Jika belum ada di project_memberships, cari info email dari sales_clients
  select c.email, c.name, c.contact
  into v_client
  from public.crm_projects p
  left join public.sales_clients c on c.id = p.client_id
  where p.id = p_project_id;

  return jsonb_build_object(
    'is_connected', false,
    'user_id', null,
    'email', coalesce(v_client.email, ''),
    'full_name', coalesce(v_client.contact, v_client.name, ''),
    'can_submit', false,
    'is_active', false
  );
end;
$$;

grant execute on function public.get_project_client_info(uuid) to authenticated;

-- 4. Hubungkan bara@test.com & bara@bara.test secara langsung ke seluruh proyek yang ada
do $$
declare
  v_proj record;
  v_user record;
begin
  for v_user in (
    select id, email from auth.users 
    where lower(email) in ('bara@test.com', 'bara@bara.test')
  ) loop
    for v_proj in (select id, organization_id, branch_id from public.crm_projects) loop
      insert into public.organization_members (organization_id, user_id, role)
      values (v_proj.organization_id, v_user.id, 'staff')
      on conflict do nothing;

      insert into public.person_profiles (organization_id, user_id, relationship_status)
      values (v_proj.organization_id, v_user.id, 'client')
      on conflict (organization_id, user_id) do update set relationship_status = 'client';

      if v_proj.branch_id is not null then
        insert into public.project_access_scopes (organization_id, project_id, branch_id)
        values (v_proj.organization_id, v_proj.id, v_proj.branch_id)
        on conflict do nothing;
      end if;

      insert into public.project_memberships (
        organization_id, project_id, user_id, member_type, can_submit, is_active, granted_by
      ) values (
        v_proj.organization_id, v_proj.id, v_user.id, 'client', true, true, v_user.id
      )
      on conflict (project_id, user_id) do update
      set member_type = 'client', can_submit = true, is_active = true;
    end loop;
  end loop;

  raise notice 'Perbaikan RLS dan sinkronisasi akun klien berhasil.';
end $$;

notify pgrst, 'reload schema';
