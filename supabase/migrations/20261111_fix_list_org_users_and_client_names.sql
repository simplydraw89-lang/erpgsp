-- ============================================================================
-- Migration: 20261111_fix_list_org_users_and_client_names.sql
-- 1. Perbaiki list_organization_users agar dapat diakses oleh Admin Cabang & Staf (bukan hanya Super Admin/Owner)
-- 2. Tambahkan list_portal_client_candidates agar dropdown menampilkan email dan nama asli klien (bukan angka UUID)
-- ============================================================================

-- 1. Izinkan seluruh staf internal memuat nama & email anggota organisasi
create or replace function public.list_organization_users(p_org uuid)
returns table(
  user_id uuid,
  email text,
  full_name text,
  role text
)
language sql
stable
security definer
set search_path = ''
as $func$
  select 
    m.user_id,
    u.email::text,
    coalesce(nullif(u.raw_user_meta_data->>'full_name',''), nullif(u.raw_user_meta_data->>'name',''), split_part(u.email, '@', 1))::text as full_name,
    m.role::text
  from public.organization_members m
  join auth.users u on u.id = m.user_id
  where m.organization_id = p_org
  and (
    public.has_org_role(p_org, array['owner', 'director', 'manager', 'finance', 'staff']::text[])
    or m.user_id = auth.uid()
  )
  order by full_name;
$func$;

grant execute on function public.list_organization_users(uuid) to authenticated;


-- 2. Fungsi khusus mengambil kandidat akun klien eksternal dengan email & nama lengkap
create or replace function public.list_portal_client_candidates(p_org uuid)
returns table(
  user_id uuid,
  email text,
  full_name text,
  relationship_status text
)
language sql
stable
security definer
set search_path = ''
as $func$
  select 
    p.user_id,
    u.email::text,
    coalesce(nullif(u.raw_user_meta_data->>'full_name',''), nullif(u.raw_user_meta_data->>'name',''), split_part(u.email, '@', 1))::text as full_name,
    p.relationship_status::text
  from public.person_profiles p
  join auth.users u on u.id = p.user_id
  where p.organization_id = p_org
  and p.relationship_status in ('client', 'consultant', 'vendor')
  order by full_name;
$func$;

grant execute on function public.list_portal_client_candidates(uuid) to authenticated;

notify pgrst, 'reload schema';
