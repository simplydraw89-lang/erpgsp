-- RPC helper to check if email exists in auth.users for password recovery
create or replace function public.check_user_email_exists(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return exists (
    select 1 from auth.users where lower(email) = lower(trim(p_email))
  );
end;
$$;

grant execute on function public.check_user_email_exists(text) to anon, authenticated;
