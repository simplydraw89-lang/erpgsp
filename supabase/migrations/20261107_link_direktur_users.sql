-- ============================================================================
-- SCRIPT & MIGRASI PENGHUBUNG AKUN DIREKTUR UTAMA & DIREKTUR TEKNIS
-- Menghubungkan user auth (dir@utama.test & dir@teknis.test) ke:
-- 1. organization_members (role: director)
-- 2. person_profiles (relationship: permanent)
-- 3. work_assignments (job_role: president & technical_director)
-- ============================================================================

do $$
declare
  v_org_id uuid;
  v_dirut_id uuid;
  v_dirtek_id uuid;
begin
  -- 1. Ambil ID organisasi utama
  select id into v_org_id from public.organizations limit 1;
  
  if v_org_id is null then
    raise notice 'Organisasi belum ditemukan.';
    return;
  end if;

  -- 2. Cari akun Direktur Utama berdasarkan email
  select id into v_dirut_id from auth.users 
  where email in ('dir@utama.test', 'direktur.utama@gsp.co.id') 
  order by created_at desc limit 1;

  if v_dirut_id is not null then
    -- Member organisasi
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_dirut_id, 'director')
    on conflict (organization_id, user_id) do update set role = 'director';

    -- Profil hubungan kerja
    insert into public.person_profiles (organization_id, user_id, relationship_status)
    values (v_org_id, v_dirut_id, 'permanent')
    on conflict (organization_id, user_id) do update set relationship_status = 'permanent';

    -- Penugasan kerja: Direktur Utama (president) di Pusat (branch_id = null)
    delete from public.work_assignments 
    where organization_id = v_org_id and user_id = v_dirut_id and job_role = 'president';

    insert into public.work_assignments (organization_id, user_id, branch_id, job_role)
    values (v_org_id, v_dirut_id, null, 'president');

    raise notice 'Akun Direktur Utama (%) berhasil dihubungkan ke organisasi sebagai president.', v_dirut_id;
  else
    raise notice 'User auth Direktur Utama (dir@utama.test) belum ditemukan di auth.users.';
  end if;

  -- 3. Cari akun Direktur Teknis berdasarkan email
  select id into v_dirtek_id from auth.users 
  where email in ('dir@teknis.test', 'direktur.teknis@gsp.co.id') 
  order by created_at desc limit 1;

  if v_dirtek_id is not null then
    -- Member organisasi
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_dirtek_id, 'director')
    on conflict (organization_id, user_id) do update set role = 'director';

    -- Profil hubungan kerja
    insert into public.person_profiles (organization_id, user_id, relationship_status)
    values (v_org_id, v_dirtek_id, 'permanent')
    on conflict (organization_id, user_id) do update set relationship_status = 'permanent';

    -- Penugasan kerja: Direktur Teknis (technical_director) di Pusat (branch_id = null)
    delete from public.work_assignments 
    where organization_id = v_org_id and user_id = v_dirtek_id and job_role = 'technical_director';

    insert into public.work_assignments (organization_id, user_id, branch_id, job_role)
    values (v_org_id, v_dirtek_id, null, 'technical_director');

    raise notice 'Akun Direktur Teknis (%) berhasil dihubungkan ke organisasi sebagai technical_director.', v_dirtek_id;
  else
    raise notice 'User auth Direktur Teknis (dir@teknis.test) belum ditemukan di auth.users.';
  end if;
end $$;
