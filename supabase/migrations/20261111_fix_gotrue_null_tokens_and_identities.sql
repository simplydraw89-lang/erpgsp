-- ============================================================================
-- Migration: 20261111_fix_gotrue_null_tokens_and_identities.sql
-- Mengatasi Error 500 "Database error querying schema" pada GoTrue Auth:
-- 1. Patch semua kolom token bernilai NULL di auth.users menjadi '' (string kosong)
-- 2. Daftarkan row pada auth.identities untuk semua user yang belum memilikinya
-- 3. Perbarui auto_provision_project_client agar user klien baru selalu valid bagi GoTrue
-- ============================================================================

-- 1. Patch semua token NULL di auth.users agar GoTrue Auth tidak crash saat login
update auth.users
set 
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  email_confirmed_at = coalesce(email_confirmed_at, now());

-- 2. Daftarkan auth.identities untuk semua user di auth.users yang belum memiliki identity email
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  u.id::text,
  now(),
  now(),
  now()
from auth.users u
where not exists (
  select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
);

-- 3. Perbarui auto_provision_project_client agar selalu mengisi token dan auth.identities
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
begin
  select * into v_proj from public.crm_projects where id = p_project_id;
  if v_proj.id is null then
    raise exception 'Proyek tidak ditemukan.' using errcode = 'P0002';
  end if;

  v_org_id := v_proj.organization_id;
  v_branch_id := v_proj.branch_id;

  if v_proj.client_id is not null then
    select * into v_client from public.sales_clients where id = v_proj.client_id;
  end if;

  v_email := lower(btrim(coalesce(nullif(p_email, ''), v_client.email, '')));
  if v_email = '' then
    raise exception 'Email klien belum ditentukan.' using errcode = '22023';
  end if;

  v_name := coalesce(nullif(btrim(p_client_name), ''), v_client.contact, v_client.name, split_part(v_email, '@', 1));
  v_password := coalesce(nullif(p_password, ''), 'KlienGSP2026!');

  select id into v_user_id from auth.users where lower(email) = v_email limit 1;

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
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      phone_change,
      phone_change_token,
      reauthentication_token,
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
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      now(),
      now()
    );

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
      v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
  else
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now()),
        confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change = coalesce(email_change, ''),
        email_change_token_current = coalesce(email_change_token_current, ''),
        phone_change = coalesce(phone_change, ''),
        phone_change_token = coalesce(phone_change_token, ''),
        reauthentication_token = coalesce(reauthentication_token, ''),
        encrypted_password = case when p_password is not null and btrim(p_password) <> '' then crypt(p_password, gen_salt('bf')) else encrypted_password end
    where id = v_user_id;

    if not exists (select 1 from auth.identities where user_id = v_user_id and provider = 'email') then
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
        v_user_id,
        jsonb_build_object(
          'sub', v_user_id::text,
          'email', v_email,
          'email_verified', true,
          'phone_verified', false
        ),
        'email',
        v_user_id::text,
        now(),
        now(),
        now()
      );
    end if;
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_user_id, 'staff')
  on conflict (organization_id, user_id) do nothing;

  insert into public.person_profiles (organization_id, user_id, relationship_status)
  values (v_org_id, v_user_id, 'client')
  on conflict (organization_id, user_id) do update
  set relationship_status = 'client';

  if v_branch_id is not null then
    insert into public.project_access_scopes (organization_id, project_id, branch_id)
    values (v_org_id, p_project_id, v_branch_id)
    on conflict do nothing;
  end if;

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

  if v_client.id is not null and (v_client.email is null or btrim(v_client.email) = '') then
    update public.sales_clients set email = v_email where id = v_client.id;
  end if;

  return jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', v_email,
    'is_new_user', v_is_new_user,
    'default_password', v_password
  );
end;
$$;

notify pgrst, 'reload schema';
