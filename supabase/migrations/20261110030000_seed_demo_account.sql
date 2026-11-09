-- ============================================================================
-- 20261110030000_seed_demo_account.sql
-- Pembuatan & Penugasan Akun Demo Tamu (demo@gsp.test)
-- Akun ini bertindak sebagai Eksekutif (Direktur Utama / President)
-- Namun secara otomatis dikunci dalam mode "Hanya Lihat" (Read-Only Preview)
-- oleh proteksi context aplikasi (src/lib/auth/context.ts).
-- ============================================================================

-- 1. Pastikan ekstensi pgcrypto tersedia untuk hashing kata sandi
create extension if not exists pgcrypto;

do $$
declare
  v_org_id uuid;
  v_demo_id uuid;
  v_password text := 'demo123'; -- Password standar minimal 6 karakter sesuai ketentuan Supabase Auth
begin
  -- Ambil ID organisasi utama PT. Global Solusi Prima
  select id into v_org_id from public.organizations limit 1;
  if v_org_id is null then
    raise notice 'Organisasi tidak ditemukan.';
    return;
  end if;

  -- 2. Cari apakah demo@gsp.test sudah ada di auth.users
  select id into v_demo_id from auth.users where email = 'demo@gsp.test' limit 1;

  -- Jika belum ada di auth.users, buat secara otomatis
  if v_demo_id is null then
    v_demo_id := gen_random_uuid();

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
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_demo_id,
      'authenticated',
      'authenticated',
      'demo@gsp.test',
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Tamu / Eksekutif Demo","is_demo":true}'::jsonb,
      false,
      now(),
      now()
    );

    -- Daftarkan juga di auth.identities agar GoTrue Auth mengenali login password
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_demo_id,
      format('{"sub":"%s","email":"%s"}', v_demo_id::text, 'demo@gsp.test')::jsonb,
      'email',
      v_demo_id::text,
      now(),
      now(),
      now()
    );

    raise notice 'Akun auth demo@gsp.test berhasil dibuat dengan kata sandi: %', v_password;
  else
    -- Jika akun sudah ada, pastikan email confirmed dan update password jika perlu
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now()),
        encrypted_password = crypt(v_password, gen_salt('bf')),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"is_demo":true}'::jsonb
    where id = v_demo_id;

    raise notice 'Akun auth demo@gsp.test ditemukan (ID: %). Kata sandi diperbarui ke: %', v_demo_id, v_password;
  end if;

  -- 3. Daftarkan demo@gsp.test sebagai member organisasi (peran: director)
  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_demo_id, 'director')
  on conflict (organization_id, user_id) do update set role = 'director';

  -- 4. Daftarkan profil hubungan kerja
  insert into public.person_profiles (organization_id, user_id, relationship_status)
  values (v_org_id, v_demo_id, 'permanent')
  on conflict (organization_id, user_id) do update set relationship_status = 'permanent';

  -- 5. Berikan hak akses Direktur Utama (president) di Pusat (branch_id = null)
  -- Ini memungkinkan akun demo melihat SEMUA cabang, laporan keuangan, proyek, dan perpajakan,
  -- namun dengan pembatasan read-only preview 100% aman.
  delete from public.work_assignments
  where organization_id = v_org_id and user_id = v_demo_id and job_role = 'president';

  insert into public.work_assignments (organization_id, user_id, branch_id, job_role)
  values (v_org_id, v_demo_id, null, 'president');

  raise notice 'Akun demo@gsp.test berhasil dikonfigurasi sebagai Direktur Utama (Mode Demo Read-Only).';
end $$;
