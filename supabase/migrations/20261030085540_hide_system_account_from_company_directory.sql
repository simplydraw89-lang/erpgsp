-- "owner" is the legacy internal key for the technical superuser account.
-- Keep that key for compatibility; do not expose it in the company directory.
drop policy "members can read organization membership" on public.organization_members;
create policy "company directory excludes system accounts"
  on public.organization_members for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (role<>'owner' or user_id=(select auth.uid())
      or public.has_org_role(organization_id,array['owner']::text[]))
  );
