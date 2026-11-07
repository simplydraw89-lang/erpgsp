-- Fix SPH opener RLS so users who have access to branch sales documents
-- (such as Branch Managers, Reviewers, and Creators) can continue viewing
-- the SPH after approving it without triggering 404 notFound.
create or replace function gsp_private.sph_opener(d public.sales_documents)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
 select gsp_private.is_superadmin(d.organization_id)
   or gsp_private.sales_document_reader(d.organization_id, d.branch_id)
   or gsp_private.can_review_sph(d)
   or (d.created_by = auth.uid())
$$;

notify pgrst, 'reload schema';
