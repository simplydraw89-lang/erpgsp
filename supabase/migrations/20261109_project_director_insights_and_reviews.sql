-- ============================================================================
-- 20261109_project_director_insights_and_reviews.sql
-- Konsol Verifikasi & Riwayat Arahan Direksi pada Proyek:
-- 1. Penambahan kolom director_insights jsonb pada public.crm_projects
-- 2. Fungsi public.add_project_director_insight untuk mencatat arahan direksi
-- ============================================================================

alter table public.crm_projects add column if not exists director_insights jsonb default '[]'::jsonb;

-- Fungsi pencatatan arahan direksi
create or replace function public.add_project_director_insight(
  p_org uuid,
  p_project_id uuid,
  p_author_name text,
  p_author_role text,
  p_section text,
  p_comment text
) returns void
language plpgsql security definer set search_path='' as $$
declare
  v_proj public.crm_projects;
  v_new_item jsonb;
begin
  select * into v_proj from public.crm_projects where id = p_project_id and organization_id = p_org for update;
  if v_proj.id is null then raise exception 'Proyek tidak ditemukan.'; end if;

  v_new_item := jsonb_build_object(
    'id', gen_random_uuid(),
    'author_id', auth.uid(),
    'author_name', p_author_name,
    'author_role', p_author_role,
    'section', coalesce(p_section, 'general'),
    'comment', p_comment,
    'created_at', now()
  );

  update public.crm_projects
  set director_insights = coalesce(director_insights, '[]'::jsonb) || jsonb_build_array(v_new_item),
      updated_at = now()
  where id = p_project_id;

  perform gsp_private.procurement_log(
    p_org, v_proj.branch_id, v_proj.id, 'project', 'director_insight_added',
    p_comment, jsonb_build_object('author_role', p_author_role, 'section', p_section)
  );
end;
$$;

notify pgrst, 'reload schema';
