-- ============================================================================
-- MIGRATION: 20261110050000_super_admin_login_security_monitor.sql
-- Tujuan:
-- 1. Mencatat seluruh aktivitas login (Berhasil & Percobaan Gagal/Brute Force)
--    beserta Email yang dicoba, IP Address, User-Agent (Perangkat/Browser),
--    dan alasan kegagalan di tabel public.security_login_attempts.
-- 2. Menyediakan fungsi RPC khusus SUPER ADMIN (role = 'owner' murni)
--    untuk memantau siapa saja yang login, kapan terakhir masuk, dan
--    mendeteksi apabila ada pihak luar yang mencoba masuk ke sistem.
-- 3. Tingkat Admin, Staff, Manager, Finance, Auditor, hingga Direktur TIDAK
--    BISA mengakses data maupun RPC ini (dikunci di level Database & UI).
-- ============================================================================

begin;

-- 1. Tabel log percobaan login & akses masuk
create table if not exists public.security_login_attempts (
  id uuid primary key default gen_random_uuid(),
  attempted_email text not null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null check (status in ('success', 'failed')),
  login_method text not null default 'password',
  failure_reason text,
  ip_address text,
  user_agent text,
  is_known_member boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists security_login_attempts_created_idx
  on public.security_login_attempts (created_at desc);

create index if not exists security_login_attempts_email_idx
  on public.security_login_attempts (lower(attempted_email), created_at desc);

-- Kunci penuh RLS pada tabel security_login_attempts
-- Tidak ada policy SELECT/UPDATE/DELETE langsung untuk role authenticated/anon;
-- pembacaan hanya dapat dilakukan melalui RPC SECURITY DEFINER khusus Super Admin.
alter table public.security_login_attempts enable row level security;

revoke all on public.security_login_attempts from anon, authenticated;

-- 2. Helper untuk memastikan pemanggil adalah SUPER ADMIN murni (bukan Direktur/Admin/Demo)
create or replace function gsp_private.is_strict_super_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $func$
  select
    auth.uid() is not null
    and not gsp_private.is_demo_user()
    and gsp_private.is_superadmin(p_org);
$func$;

revoke all on function gsp_private.is_strict_super_admin(uuid) from public;
grant execute on function gsp_private.is_strict_super_admin(uuid) to authenticated;

-- 3. RPC pencatat event login (Berhasil maupun Gagal) yang aman dipanggil dari API Route
create or replace function public.api_record_login_attempt(
  p_email text,
  p_status text,
  p_method text default 'password',
  p_failure_reason text default null,
  p_ip_address text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $func$
declare
  v_clean_email text := lower(btrim(coalesce(p_email, '')));
  v_user_id uuid;
  v_is_member boolean := false;
begin
  if v_clean_email = '' then
    v_clean_email := '(email-kosong)';
  end if;

  if p_status not in ('success', 'failed') then
    raise exception 'Status log login tidak valid.';
  end if;

  select u.id
    into v_user_id
  from auth.users u
  where lower(u.email) = v_clean_email
  limit 1;

  if v_user_id is not null then
    select exists (
      select 1
      from public.organization_members m
      where m.user_id = v_user_id
    ) into v_is_member;
  end if;

  insert into public.security_login_attempts (
    attempted_email,
    user_id,
    status,
    login_method,
    failure_reason,
    ip_address,
    user_agent,
    is_known_member
  )
  values (
    left(v_clean_email, 255),
    v_user_id,
    p_status,
    left(coalesce(nullif(btrim(p_method), ''), 'password'), 50),
    left(nullif(btrim(coalesce(p_failure_reason, '')), ''), 500),
    left(nullif(btrim(coalesce(p_ip_address, '')), ''), 120),
    left(nullif(btrim(coalesce(p_user_agent, '')), ''), 500),
    v_is_member
  );
end;
$func$;

revoke all on function public.api_record_login_attempt(text, text, text, text, text, text) from public;
grant execute on function public.api_record_login_attempt(text, text, text, text, text, text) to anon, authenticated;

-- 4. RPC khusus Super Admin untuk mengambil ringkasan pantauan login & percobaan masuk
create or replace function public.api_super_admin_security_overview(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $func$
declare
  v_summary jsonb;
  v_attempts jsonb;
  v_users jsonb;
begin
  -- Kunci keras: Hanya Super Admin murni yang diizinkan
  if not gsp_private.is_strict_super_admin(p_org) then
    raise exception 'Akses ditolak: Panel Pantauan Keamanan Login hanya dapat diakses oleh Super Admin.';
  end if;

  -- A. Ringkasan metrik keamanan 24 jam & 7 hari terakhir
  select jsonb_build_object(
    'success_24h', (
      select count(*)
      from public.security_login_attempts
      where status = 'success'
        and created_at >= now() - interval '24 hours'
    ),
    'failed_24h', (
      select count(*)
      from public.security_login_attempts
      where status = 'failed'
        and created_at >= now() - interval '24 hours'
    ),
    'outsider_attempts_7d', (
      select count(*)
      from public.security_login_attempts
      where (status = 'failed' or not is_known_member)
        and not is_known_member
        and created_at >= now() - interval '7 days'
    ),
    'active_users_7d', (
      select count(*)
      from auth.users u
      join public.organization_members m
        on m.user_id = u.id and m.organization_id = p_org
      where u.last_sign_in_at >= now() - interval '7 days'
    )
  ) into v_summary;

  -- B. Gabungan riwayat login dari security_login_attempts + auth.audit_log_entries (100 terbaru)
  with combined_logs as (
    -- 1. Dari tabel pencatat detail kita (termasuk percobaan gagal / salah password / email asing)
    select
      s.id::text as log_id,
      s.created_at,
      s.attempted_email as email,
      coalesce(
        nullif(u.raw_user_meta_data ->> 'full_name', ''),
        nullif(u.raw_user_meta_data ->> 'name', ''),
        case when s.is_known_member then split_part(s.attempted_email, '@', 1) else 'Pihak Luar / Akun Tidak Dikenal' end
      ) as full_name,
      coalesce(m.role::text, case when s.is_known_member then 'member' else 'outsider' end) as member_role,
      s.status,
      s.login_method as method,
      s.failure_reason,
      coalesce(s.ip_address, '-') as ip_address,
      coalesce(s.user_agent, '-') as user_agent,
      s.is_known_member
    from public.security_login_attempts s
    left join auth.users u on u.id = s.user_id
    left join public.organization_members m
      on m.user_id = s.user_id and m.organization_id = p_org

    union all

    -- 2. Dari auth.audit_log_entries bawaan Supabase (untuk histori sebelum tabel dibuat)
    select
      a.id::text as log_id,
      a.created_at,
      lower(coalesce(
        nullif(a.payload ->> 'actor_username', ''),
        nullif(a.payload -> 'traits' ->> 'user_email', ''),
        u.email,
        'unknown'
      )) as email,
      coalesce(
        nullif(u.raw_user_meta_data ->> 'full_name', ''),
        nullif(u.raw_user_meta_data ->> 'name', ''),
        nullif(a.payload ->> 'actor_name', ''),
        split_part(coalesce(a.payload ->> 'actor_username', u.email, 'user'), '@', 1)
      ) as full_name,
      coalesce(m.role::text, 'outsider') as member_role,
      case
        when coalesce(a.payload ->> 'action', '') ilike '%error%'
          or coalesce(a.payload ->> 'action', '') ilike '%fail%'
          or coalesce(a.payload ->> 'log_type', '') ilike '%error%'
        then 'failed'
        else 'success'
      end as status,
      coalesce(
        nullif(a.payload -> 'traits' ->> 'provider', ''),
        nullif(a.payload ->> 'action', ''),
        'supabase_auth'
      ) as method,
      nullif(a.payload ->> 'error_message', '') as failure_reason,
      coalesce(nullif(a.ip_address::text, ''), '-') as ip_address,
      '-' as user_agent,
      (m.user_id is not null) as is_known_member
    from auth.audit_log_entries a
    left join auth.users u
      on u.id::text = (a.payload ->> 'actor_id')
    left join public.organization_members m
      on m.user_id = u.id and m.organization_id = p_org
    where coalesce(a.payload ->> 'action', '') in (
      'login',
      'user_signedup',
      'token_revoked',
      'user_modified',
      'user_recovery_requested'
    )
    and not exists (
      select 1
      from public.security_login_attempts s2
      where s2.user_id = u.id
        and s2.created_at between a.created_at - interval '10 seconds' and a.created_at + interval '10 seconds'
    )
  ),
  ordered_logs as (
    select *
    from combined_logs
    order by created_at desc
    limit 100
  )
  select coalesce(jsonb_agg(row_to_json(ordered_logs)), '[]'::jsonb)
    into v_attempts
  from ordered_logs;

  -- C. Daftar seluruh akun di organisasi beserta waktu terakhir login & statistik percobaan 7 hari terakhir
  with org_accounts as (
    select
      u.id as user_id,
      u.email::text as email,
      coalesce(
        nullif(u.raw_user_meta_data ->> 'full_name', ''),
        nullif(u.raw_user_meta_data ->> 'name', ''),
        split_part(u.email, '@', 1)
      )::text as full_name,
      m.role::text as member_role,
      coalesce(
        (
          select string_agg(distinct wa.job_role, ', ')
          from public.work_assignments wa
          where wa.organization_id = p_org and wa.user_id = u.id
        ),
        m.role::text
      ) as job_roles,
      u.last_sign_in_at,
      u.created_at as registered_at,
      coalesce((u.raw_user_meta_data ->> 'is_demo')::boolean, false) as is_demo,
      (
        select count(*)
        from public.security_login_attempts s
        where (s.user_id = u.id or lower(s.attempted_email) = lower(u.email))
          and s.status = 'success'
          and s.created_at >= now() - interval '7 days'
      ) as success_count_7d,
      (
        select count(*)
        from public.security_login_attempts s
        where (s.user_id = u.id or lower(s.attempted_email) = lower(u.email))
          and s.status = 'failed'
          and s.created_at >= now() - interval '7 days'
      ) as failed_count_7d,
      (
        select s.ip_address
        from public.security_login_attempts s
        where (s.user_id = u.id or lower(s.attempted_email) = lower(u.email))
          and s.status = 'success'
          and s.ip_address is not null
        order by s.created_at desc
        limit 1
      ) as last_ip_address
    from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_org
    order by u.last_sign_in_at desc nulls last, u.email asc
  )
  select coalesce(jsonb_agg(row_to_json(org_accounts)), '[]'::jsonb)
    into v_users
  from org_accounts;

  return jsonb_build_object(
    'summary', v_summary,
    'recent_attempts', v_attempts,
    'user_sessions', v_users
  );
end;
$func$;

revoke all on function public.api_super_admin_security_overview(uuid) from public;
grant execute on function public.api_super_admin_security_overview(uuid) to authenticated;

commit;
