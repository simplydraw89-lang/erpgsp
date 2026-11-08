-- Migration: 20261108_fix_spk_director_approval_and_notifications.sql
-- 1. Mengikutsertakan Direktur Keuangan (finance_director) bersama Direktur Utama dan Direktur Teknis pada validasi SPK
-- 2. Memperbarui antrean pemeriksaan bisnis (api_sph_review_queue) agar SPK berstatus director_review tampil di "Butuh verifikasi saya"
-- 3. Memastikan notifikasi lonceng (api_sales_notifications) terkirim ke seluruh Direksi untuk validasi SPK
-- 4. Memastikan nilai kontrak (amount) tersalin dari SPH ke SPK saat pembuatan, dan mem-backfill SPK yang bernilai null

-- 1. Perbarui can_review_spk agar mencakup seluruh Direksi (president, technical_director, finance_director)
create or replace function gsp_private.can_review_spk(d public.sales_documents)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select d.kind = 'spk'
  and d.status = 'director_review'
  and (
    gsp_private.is_superadmin(d.organization_id)
    or gsp_private.has_job(d.organization_id, null, array['president', 'technical_director', 'finance_director'])
  );
$$;

-- 2. Perbarui can_edit_spk agar seluruh Direksi dan pemeriksa dapat melakukan revisi/penyesuaian data SPK
create or replace function gsp_private.can_edit_spk(d public.sales_documents)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select d.kind = 'spk'
  and d.status in ('director_review', 'revision_requested', 'draft')
  and (
    gsp_private.is_superadmin(d.organization_id)
    or gsp_private.has_job(d.organization_id, null, array['president', 'technical_director', 'finance_director'])
    or d.created_by = auth.uid()
    or gsp_private.can_access_business(d.organization_id, d.branch_id, 'sales')
  );
$$;

-- 3. Perbarui api_sph_review_queue agar memasukkan dokumen SPK ke daftar "Butuh verifikasi saya"
create or replace function gsp_private.api_sph_review_queue(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(q order by q.submitted_at),'[]') from (
    -- Antrean SPH
    select 
      d.id,
      'sph'::text as kind,
      coalesce(d.document_number, 'SPH ' || coalesce(d.sph_number::text, '')) || ' • ' || d.title as title,
      d.status,
      d.branch_id,
      coalesce(d.amount, 0) as amount,
      d.submitted_at
    from public.sales_documents d
    where d.organization_id = p_org
      and d.kind = 'sph'
      and d.status in ('branch_review', 'director_review', 'accounting_review', 'finance_review')
      and gsp_private.can_review_sph(d)

    union all

    -- Antrean SPK (Khusus Direksi / Super Admin)
    select
      d.id,
      'spk'::text as kind,
      coalesce(d.document_number, 'SPK') || ' • ' || d.title as title,
      d.status,
      d.branch_id,
      coalesce(d.amount, 0) as amount,
      d.created_at as submitted_at
    from public.sales_documents d
    where d.organization_id = p_org
      and d.kind = 'spk'
      and d.status = 'director_review'
      and gsp_private.can_review_spk(d)
  ) q;
$$;

-- 4. Perbarui api_sales_notifications untuk lonceng notifikasi Direksi dan Pengaju
create or replace function gsp_private.api_sales_notifications(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
 with items as (
  -- SPH
  select d.id, 'sph'::text as kind, d.sph_number, d.document_number, d.status, d.review_note, d.created_at,
   case when gsp_private.can_review_sph(d) then 'approval' else 'follow_up' end category,
   case when gsp_private.can_review_sph(d) then 'Butuh persetujuan SPH' else 'SPH perlu tindak lanjut' end label
  from public.sales_documents d
  where d.organization_id = p_org
    and d.kind = 'sph'
    and gsp_private.sales_internal_member(p_org)
    and (
      gsp_private.can_review_sph(d)
      or (
        d.created_by = auth.uid()
        and gsp_private.sph_opener(d)
        and d.status in ('revision_requested', 'rejected', 'ready')
        and not exists(select 1 from public.sales_documents s where s.kind = 'spk' and s.accepted_sph_id = d.id)
      )
    )

  union all

  -- SPK
  select d.id, 'spk'::text as kind, d.sph_number, d.document_number, d.status, d.review_note, d.created_at,
   case when gsp_private.can_review_spk(d) then 'approval' else 'follow_up' end category,
   case when gsp_private.can_review_spk(d) then 'Validasi SPK Direktur'
        when d.status = 'revision_requested' then 'SPK perlu revisi'
        when d.status = 'ready' then 'SPK telah disetujui (Proyek Aktif)'
        else 'SPK perlu tindak lanjut' end label
  from public.sales_documents d
  where d.organization_id = p_org
    and d.kind = 'spk'
    and gsp_private.sales_internal_member(p_org)
    and (
      gsp_private.can_review_spk(d)
      or (d.created_by = auth.uid() and d.status in ('revision_requested', 'rejected', 'ready'))
    )
 )
 select jsonb_build_object(
   'total', count(*),
   'items', coalesce((select jsonb_agg(x order by x.created_at desc) from (select * from items order by created_at desc limit 100) x), '[]')
 )
 from items;
$$;

-- 5. Perbarui api_save_sales_document agar menyalin amount dari SPH ke SPK
create or replace function gsp_private.api_save_sales_document(p_org uuid, p_branch uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.sales_documents;
  c public.sales_clients;
  i uuid;
  attachments uuid[];
  v_spk_number text;
  v_is_submit boolean;
  v_status text;
  v_amount numeric(15,2);
begin
  if p_payload->>'kind' is distinct from 'spk' then
    return gsp_private.api_save_sales_document_base(p_org, p_branch, p_payload);
  end if;

  select * into d from public.sales_documents
  where id = nullif(p_payload->>'accepted_sph_id', '')::uuid and organization_id = p_org for update;
  if d.id is null or not gsp_private.sph_spk_creator(d) or d.branch_id <> p_branch or d.client_id is distinct from nullif(p_payload->>'client_id', '')::uuid then
    raise exception 'SPK wajib merujuk SPH klien/cabang yang sudah disetujui Direktur Keuangan.' using errcode = '42501';
  end if;
  if nullif(btrim(p_payload->>'title'), '') is null then
    raise exception 'Judul SPK wajib diisi.';
  end if;

  select * into c from public.sales_clients where id = d.client_id and organization_id = p_org;

  select coalesce(array_agg(value::uuid), '{}') into attachments
  from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids', '[]'));
  perform gsp_private.validate_sales_attachments(p_org, p_branch, attachments);

  v_spk_number := gsp_private.generate_document_number(p_org, 'spk', current_date, c.name, null, null);

  -- Salin nilai kontrak dari SPH rujukan atau payload
  v_amount := coalesce(nullif(p_payload->>'amount', '')::numeric, d.amount, 0);

  -- Periksa apakah pengaju memilih simpan draft atau kirim pengajuan langsung ke Direktur
  v_is_submit := coalesce((p_payload->>'submit')::boolean, p_payload->>'intent' = 'submit', false);
  v_status := case when v_is_submit then 'director_review' else 'draft' end;

  insert into public.sales_documents(
    organization_id, branch_id, client_id, kind, title, source,
    accepted_sph_id, notes, attachment_ids, client_snapshot, created_by,
    status, document_number, amount
  )
  values(
    p_org, p_branch, d.client_id, 'spk', btrim(p_payload->>'title'),
    coalesce(p_payload->>'source', 'company'), d.id, p_payload->>'notes',
    attachments, d.client_snapshot, auth.uid(),
    v_status, v_spk_number, v_amount
  ) returning id into i;

  perform gsp_private.procurement_log(
    p_org, p_branch, i, 'spk',
    case when v_is_submit then 'submitted_to_director' else 'draft_created' end,
    null,
    jsonb_build_object('document_number', v_spk_number, 'status', v_status, 'amount', v_amount)
  );

  return i;
end;
$$;

-- 6. Backfill amount pada SPK yang masih null dari SPH rujukan
update public.sales_documents s
set amount = ref.amount
from public.sales_documents ref
where s.kind = 'spk'
  and s.accepted_sph_id = ref.id
  and (s.amount is null or s.amount = 0)
  and ref.amount is not null;
