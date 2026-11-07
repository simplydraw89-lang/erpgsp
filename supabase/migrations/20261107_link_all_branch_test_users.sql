-- ============================================================================
-- 20261107_link_all_branch_test_users.sql
-- Skrip Sinkronisasi & Pemetaan 10 Akun Cabang & Direksi:
-- 1. adm@sby.test        -> Surabaya (Admin)
-- 2. manager@sby.test    -> Surabaya (Manager Cabang)
-- 3. dir@keuangan.test   -> Pusat (Direktur Keuangan)
-- 4. adm@fin.test        -> Pusat (Accounting & Tax, Finance)
-- 5. dir@teknis.test     -> Pusat (Direktur Teknis)
-- 6. dir@utama.test      -> Pusat (Direktur Utama / President)
-- 7. adm@jakarta.test    -> Jakarta (Admin)
-- 8. man@jakarta.test    -> Jakarta (Manager Cabang)
-- 9. adm@yogya.test      -> Jogjakarta (Admin)
-- 10. man@yogya.test     -> Jogjakarta (Manager Cabang)
-- ============================================================================

do $$
declare
  v_org_id uuid;
  v_sby_id uuid;
  v_jog_id uuid;
  v_jkt_id uuid;
  v_user_id uuid;
begin
  -- 1. Ambil ID organisasi utama
  select id into v_org_id from public.organizations limit 1;
  if v_org_id is null then
    raise notice 'Organisasi tidak ditemukan.';
    return;
  end if;

  -- 2. Ambil ID masing-masing cabang
  select id into v_sby_id from public.business_units where organization_id = v_org_id and code = 'SBY' limit 1;
  select id into v_jog_id from public.business_units where organization_id = v_org_id and code = 'JOG' limit 1;
  select id into v_jkt_id from public.business_units where organization_id = v_org_id and code = 'JKT' limit 1;

  -- Auto-confirm email user di auth.users agar dapat langsung login
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now()),
      confirmed_at = coalesce(confirmed_at, now())
  where email in (
    'adm@sby.test', 'manager@sby.test',
    'dir@keuangan.test', 'adm@fin.test',
    'dir@teknis.test', 'dir@utama.test',
    'adm@jakarta.test', 'man@jakarta.test',
    'adm@yogya.test', 'man@yogya.test'
  );

  -- --------------------------------------------------------------------------
  -- 1. adm@sby.test (Admin Surabaya)
  -- --------------------------------------------------------------------------
  select id into v_user_id from auth.users where email = 'adm@sby.test' limit 1;
  if v_user_id is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_user_id, 'staff')
    on conflict (organization_id, user_id) do update set role = 'staff';

    insert into public.person_profiles (organization_id, user_id, relationship_status)
    values (v_org_id, v_user_id, 'permanent')
    on conflict (organization_id, user_id) do update set relationship_status = 'permanent';

    delete from public.work_assignments where organization_id = v_org_id and user_id = v_user_id;
    insert into public.work_assignments (organization_id, user_id, branch_id, job_role)
    values (v_org_id, v_user_id, v_sby_id, 'admin');
    raise notice 'adm@sby.test terhubung ke Cabang Surabaya (Admin).';
  end if;

  -- --------------------------------------------------------------------------
  -- 2. manager@sby.test (Manager Cabang Surabaya)
  -- --------------------------------------------------------------------------
  select id into v_user_id from auth.users where email = 'manager@sby.test' limit 1;
  if v_user_id is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_user_id, 'manager')
    on conflict (organization_id, user_id) do update set role = 'manager';

    insert into public.person_profiles (organization_id, user_id, relationship_status)
    values (v_org_id, v_user_id, 'permanent')
    on conflict (organization_id, user_id) do update set relationship_status = 'permanent';

    delete from public.work_assignments where organization_id = v_org_id and user_id = v_user_id;
    insert into public.work_assignments (organization_id, user_id, branch_id, job_role)
    values (v_org_id, v_user_id, v_sby_id, 'branch_manager');
    raise notice 'manager@sby.test terhubung ke Cabang Surabaya (Manager Cabang).';
  end if;

  -- --------------------------------------------------------------------------
  -- 3. dir@keuangan.test (Direktur Keuangan)
  -- --------------------------------------------------------------------------
  select id into v_user_id from auth.users where email = 'dir@keuangan.test' limit 1;
  if v_user_id is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_user_id, 'director')
    on conflict (organization_id, user_id) do update set role = 'director';

    insert into public.person_profiles (organization_id, user_id, relationship_status)
    values (v_org_id, v_user_id, 'permanent')
    on conflict (organization_id, user_id) do update set relationship_status = 'permanent';

    delete from public.work_assignments where organization_id = v_org_id and user_id = v_user_id;
    insert into public.work_assignments (organization_id, user_id, branch_id, job_role)
    values (v_org_id, v_user_id, null, 'finance_director');
    raise notice 'dir@keuangan.test terhubung sebagai Direktur Keuangan.';
  end if;

  -- --------------------------------------------------------------------------
  -- 4. adm@fin.test (Accounting & Tax + Finance Pusat)
  -- --------------------------------------------------------------------------
  select id into v_user_id from auth.users where email = 'adm@fin.test' limit 1;
  if v_user_id is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_user_id, 'finance')
    on conflict (organization_id, user_id) do update set role = 'finance';

    insert into public.person_profiles (organization_id, user_id, relationship_status)
    values (v_org_id, v_user_id, 'permanent')
    on conflict (organization_id, user_id) do update set relationship_status = 'permanent';

    delete from public.work_assignments where organization_id = v_org_id and user_id = v_user_id;
    insert into public.work_assignments (organization_id, user_id, branch_id, job_role)
    values 
      (v_org_id, v_user_id, null, 'accounting_tax'),
      (v_org_id, v_user_id, null, 'finance');
    raise notice 'adm@fin.test terhubung sebagai Accounting & Tax dan Finance Pusat.';
  end if;

  -- --------------------------------------------------------------------------
  -- 5. dir@teknis.test (Direktur Teknis)
  -- --------------------------------------------------------------------------
  select id into v_user_id from auth.users where email = 'dir@teknis.test' limit 1;
  if v_user_id is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_user_id, 'director')
    on conflict (organization_id, user_id) do update set role = 'director';

    insert into public.person_profiles (organization_id, user_id, relationship_status)
    values (v_org_id, v_user_id, 'permanent')
    on conflict (organization_id, user_id) do update set relationship_status = 'permanent';

    delete from public.work_assignments where organization_id = v_org_id and user_id = v_user_id;
    insert into public.work_assignments (organization_id, user_id, branch_id, job_role)
    values (v_org_id, v_user_id, null, 'technical_director');
    raise notice 'dir@teknis.test terhubung sebagai Direktur Teknis.';
  end if;

  -- --------------------------------------------------------------------------
  -- 6. dir@utama.test (Direktur Utama)
  -- --------------------------------------------------------------------------
  select id into v_user_id from auth.users where email = 'dir@utama.test' limit 1;
  if v_user_id is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_user_id, 'director')
    on conflict (organization_id, user_id) do update set role = 'director';

    insert into public.person_profiles (organization_id, user_id, relationship_status)
    values (v_org_id, v_user_id, 'permanent')
    on conflict (organization_id, user_id) do update set relationship_status = 'permanent';

    delete from public.work_assignments where organization_id = v_org_id and user_id = v_user_id;
    insert into public.work_assignments (organization_id, user_id, branch_id, job_role)
    values (v_org_id, v_user_id, null, 'president');
    raise notice 'dir@utama.test terhubung sebagai Direktur Utama.';
  end if;

  -- --------------------------------------------------------------------------
  -- 7. adm@jakarta.test (Admin Jakarta)
  -- --------------------------------------------------------------------------
  select id into v_user_id from auth.users where email = 'adm@jakarta.test' limit 1;
  if v_user_id is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_user_id, 'staff')
    on conflict (organization_id, user_id) do update set role = 'staff';

    insert into public.person_profiles (organization_id, user_id, relationship_status)
    values (v_org_id, v_user_id, 'permanent')
    on conflict (organization_id, user_id) do update set relationship_status = 'permanent';

    delete from public.work_assignments where organization_id = v_org_id and user_id = v_user_id;
    insert into public.work_assignments (organization_id, user_id, branch_id, job_role)
    values (v_org_id, v_user_id, v_jkt_id, 'admin');
    raise notice 'adm@jakarta.test terhubung ke Cabang Jakarta (Admin).';
  end if;

  -- --------------------------------------------------------------------------
  -- 8. man@jakarta.test (Manager Cabang Jakarta)
  -- --------------------------------------------------------------------------
  select id into v_user_id from auth.users where email = 'man@jakarta.test' limit 1;
  if v_user_id is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_user_id, 'manager')
    on conflict (organization_id, user_id) do update set role = 'manager';

    insert into public.person_profiles (organization_id, user_id, relationship_status)
    values (v_org_id, v_user_id, 'permanent')
    on conflict (organization_id, user_id) do update set relationship_status = 'permanent';

    delete from public.work_assignments where organization_id = v_org_id and user_id = v_user_id;
    insert into public.work_assignments (organization_id, user_id, branch_id, job_role)
    values (v_org_id, v_user_id, v_jkt_id, 'branch_manager');
    raise notice 'man@jakarta.test terhubung ke Cabang Jakarta (Manager Cabang).';
  end if;

  -- --------------------------------------------------------------------------
  -- 9. adm@yogya.test (Admin Jogjakarta)
  -- --------------------------------------------------------------------------
  select id into v_user_id from auth.users where email = 'adm@yogya.test' limit 1;
  if v_user_id is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_user_id, 'staff')
    on conflict (organization_id, user_id) do update set role = 'staff';

    insert into public.person_profiles (organization_id, user_id, relationship_status)
    values (v_org_id, v_user_id, 'permanent')
    on conflict (organization_id, user_id) do update set relationship_status = 'permanent';

    delete from public.work_assignments where organization_id = v_org_id and user_id = v_user_id;
    insert into public.work_assignments (organization_id, user_id, branch_id, job_role)
    values (v_org_id, v_user_id, v_jog_id, 'admin');
    raise notice 'adm@yogya.test terhubung ke Cabang Jogjakarta (Admin).';
  end if;

  -- --------------------------------------------------------------------------
  -- 10. man@yogya.test (Manager Cabang Jogjakarta)
  -- --------------------------------------------------------------------------
  select id into v_user_id from auth.users where email = 'man@yogya.test' limit 1;
  if v_user_id is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, v_user_id, 'manager')
    on conflict (organization_id, user_id) do update set role = 'manager';

    insert into public.person_profiles (organization_id, user_id, relationship_status)
    values (v_org_id, v_user_id, 'permanent')
    on conflict (organization_id, user_id) do update set relationship_status = 'permanent';

    delete from public.work_assignments where organization_id = v_org_id and user_id = v_user_id;
    insert into public.work_assignments (organization_id, user_id, branch_id, job_role)
    values (v_org_id, v_user_id, v_jog_id, 'branch_manager');
    raise notice 'man@yogya.test terhubung ke Cabang Jogjakarta (Manager Cabang).';
  end if;

end $$;

notify pgrst, 'reload schema';
