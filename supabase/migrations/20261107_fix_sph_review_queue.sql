-- ============================================================================
-- 20261107_fix_sph_review_queue.sql
-- Perbaikan: SPH yang sudah diverifikasi (ready / accepted) atau draft/rejected
-- TIDAK boleh lagi muncul di antrean "Butuh verifikasi saya" Super Admin & Direksi.
-- ============================================================================

-- 1. Perbaiki can_review_sph agar HANYA bernilai TRUE jika status SPH memang sedang dalam tahap verifikasi
create or replace function gsp_private.can_review_sph(d public.sales_documents)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select d.kind = 'sph'
  -- SPH HANYA dapat diperiksa jika statusnya sedang menunggu verifikasi
  and d.status in ('branch_review', 'director_review', 'accounting_review', 'finance_review')
  and (
    -- Super Admin berhak memeriksa tahap apapun yang sedang aktif
    gsp_private.is_superadmin(d.organization_id)
    or (
      gsp_private.sales_document_reader(d.organization_id, d.branch_id)
      and d.created_by <> auth.uid()
      and case d.status
        when 'branch_review' then gsp_private.has_job(d.organization_id, d.branch_id, array['branch_manager', 'admin'])
        when 'director_review' then gsp_private.has_job(d.organization_id, null, array['finance_director', 'technical_director', 'president'])
        when 'accounting_review' then gsp_private.has_job(d.organization_id, null, array['accounting_tax'])
        when 'finance_review' then gsp_private.has_job(d.organization_id, null, array['finance'])
        else false
      end
    )
  );
$$;

-- 2. Perbarui api_sph_review_queue dengan filter eksplisit status pending
create or replace function gsp_private.api_sph_review_queue(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(q order by q.submitted_at),'[]') from (
    select 
      d.id,
      'sph'::text as kind,
      'SPH ' || coalesce(d.sph_number::text, '') || ' · ' || d.title as title,
      d.status,
      d.branch_id,
      coalesce(d.amount, 0) as amount,
      d.submitted_at
    from public.sales_documents d
    where d.organization_id = p_org
      and d.kind = 'sph'
      -- Hanya tampilkan dokumen yang benar-benar membutuhkan tindakan verifikasi
      and d.status in ('branch_review', 'director_review', 'accounting_review', 'finance_review')
      and gsp_private.can_review_sph(d)
  ) q;
$$;

notify pgrst, 'reload schema';
