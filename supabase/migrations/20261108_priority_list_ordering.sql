-- Migration: 20261108_priority_list_ordering.sql
-- Mengurutkan daftar SPH berdasarkan tingkat urgensi/prioritas:
-- 1. director_review (Menunggu Persetujuan Direktur Keuangan)
-- 2. branch_review (Menunggu Verifikasi Manager Cabang)
-- 3. revision_requested (Perlu Revisi / Perbaikan)
-- 4. ready (Disetujui Internal, siap SPK / kesepakatan)
-- 5. draft (Draft belum diajukan)
-- 6. accepted (Sudah deal & disepakati)
-- 7. rejected (Ditolak)

create or replace function gsp_private.api_sph_register(
  p_org uuid,
  p_branch uuid default null,
  p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  result jsonb;
begin
  if not gsp_private.sales_internal_member(p_org) then
    raise exception 'Akses daftar SPH ditolak.' using errcode = '42501';
  end if;

  if p_offset is null or p_offset < 0 or p_offset > 1000000 then
    raise exception 'Halaman daftar tidak valid.';
  end if;

  with visible as (
    select d.*, b.name as branch_name, d as row_data
    from public.sales_documents d
    join public.business_units b on b.id = d.branch_id
    where d.organization_id = p_org
      and d.kind = 'sph'
      and (p_branch is null or d.branch_id = p_branch)
      and gsp_private.sales_document_reader(p_org, d.branch_id)
  ),
  page as (
    select
      id, sph_number, document_number, branch_id, branch_name, created_at,
      left(title, 120) as title, work_scopes, amount, status,
      gsp_private.sph_opener(visible.row_data) as can_open,
      gsp_private.sph_spk_creator(visible.row_data) as can_create_spk
    from visible
    order by
      case status
        when 'director_review' then 1
        when 'branch_review' then 2
        when 'revision_requested' then 3
        when 'ready' then 4
        when 'draft' then 5
        when 'accepted' then 6
        when 'rejected' then 7
        else 8
      end asc,
      sph_number desc
    limit 50 offset p_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from visible),
    'rows', coalesce(jsonb_agg(page order by
      case page.status
        when 'director_review' then 1
        when 'branch_review' then 2
        when 'revision_requested' then 3
        when 'ready' then 4
        when 'draft' then 5
        when 'accepted' then 6
        when 'rejected' then 7
        else 8
      end asc,
      page.sph_number desc
    ), '[]'::jsonb)
  ) into result from page;

  return result;
end;
$$;

notify pgrst, 'reload schema';
