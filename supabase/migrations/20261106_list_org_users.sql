-- Function untuk mengambil daftar user (email, nama, user_id) pada organisasi
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
    public.has_org_role(p_org, array['owner']::text[])
    or m.user_id = auth.uid()
  )
  order by full_name;
$func$;

grant execute on function public.list_organization_users(uuid) to authenticated;
