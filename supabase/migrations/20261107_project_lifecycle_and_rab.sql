-- ============================================================================
-- 20261107_project_lifecycle_and_rab.sql
-- Siklus Hidup Proyek & Perencanaan Lapangan Terpadu:
-- 1. SPK Disetujui -> Proyek terbentuk otomatis status 'draft' (bukan langsung 'active')
-- 2. Kelengkapan Cabang: Manpower (SDM), Scope & Kebutuhan Teknis, Timesheet, dan RAB
-- 3. Pengajuan ke Direksi -> Verifikasi Direktur Teknis & Keuangan -> ACC Direktur Utama
-- 4. Saat Direktur Utama ACC -> Status Proyek 'active' & Pagu Anggaran RAB Terkunci
-- ============================================================================

-- 1. Penambahan Kolom pada public.crm_projects
alter table public.crm_projects add column if not exists spk_id uuid references public.sales_documents(id) on delete set null;
alter table public.crm_projects add column if not exists branch_id uuid references public.business_units(id) on delete set null;
alter table public.crm_projects add column if not exists contract_amount numeric(15,2) default 0;
alter table public.crm_projects add column if not exists rab_total numeric(15,2) default 0;
alter table public.crm_projects add column if not exists rab_breakdown jsonb default '[]'::jsonb;
alter table public.crm_projects add column if not exists manpower jsonb default '[]'::jsonb;
alter table public.crm_projects add column if not exists work_details text;
alter table public.crm_projects add column if not exists timesheet_schedule jsonb default '[]'::jsonb;
alter table public.crm_projects add column if not exists attachment_ids uuid[] default '{}'::uuid[];
alter table public.crm_projects add column if not exists approval_status text not null default 'draft'
  check (approval_status in ('draft', 'director_review', 'active', 'revision_requested', 'rejected', 'completed'));
alter table public.crm_projects add column if not exists review_note text;
alter table public.crm_projects add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.crm_projects add column if not exists reviewed_at timestamptz;
alter table public.crm_projects add column if not exists submitted_at timestamptz;
alter table public.crm_projects add column if not exists version integer not null default 1;

-- Indeks pencarian proyek
create index if not exists crm_projects_branch_approval on public.crm_projects(organization_id, branch_id, approval_status);
create index if not exists crm_projects_spk on public.crm_projects(organization_id, spk_id);

-- 2. Perbarui gsp_private.api_decide_spk: Otomatis buat Proyek DRAFT (approval_status = 'draft')
create or replace function gsp_private.api_decide_spk(
  p_id uuid,
  p_version integer,
  p_decision text,
  p_note text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  d public.sales_documents;
  b public.business_units;
  c public.sales_clients;
  v_proj_id uuid;
  v_proj_code text;
  v_next_status text;
  v_amount numeric(15,2);
begin
  select * into d from public.sales_documents where id = p_id for update;
  if d.id is null or not gsp_private.can_review_spk(d) then
    raise exception 'Bukan tahap pemeriksaan SPK Anda atau akses validasi ditolak.' using errcode = '42501';
  end if;
  if d.version is distinct from p_version then
    raise exception 'Versi SPK berubah. Muat ulang dan periksa kembali.';
  end if;
  if p_decision is null or p_decision not in ('approve', 'revise', 'reject') then
    raise exception 'Pilih Setujui, Revisi atau Tolak.';
  end if;
  if p_decision in ('revise', 'reject') and nullif(btrim(p_note), '') is null then
    raise exception 'Alasan revisi atau penolakan wajib diisi.';
  end if;

  if p_decision = 'approve' then
    v_next_status := 'ready';
    select * into b from public.business_units where id = d.branch_id;
    select * into c from public.sales_clients where id = d.client_id;
    v_amount := coalesce(d.amount, 0);

    v_proj_code := gsp_private.generate_document_number(
      d.organization_id, 'prj', current_date, c.name, b.code, null
    );

    -- Buat entitas Proyek dengan approval_status 'draft' untuk dilengkapi Cabang
    insert into public.crm_projects(
      organization_id,
      code,
      name,
      status,
      starts_on,
      created_by,
      client_id,
      spk_id,
      branch_id,
      contract_amount,
      approval_status,
      work_details
    ) values (
      d.organization_id,
      v_proj_code,
      d.title,
      'planned',
      current_date,
      auth.uid(),
      d.client_id,
      d.id,
      d.branch_id,
      v_amount,
      'draft',
      coalesce(d.notes, 'Proyek dibentuk berdasarkan persetujuan SPK No. ' || coalesce(d.document_number, d.title))
    ) returning id into v_proj_id;

    -- Tautkan hak akses cakupan cabang
    insert into public.project_access_scopes(
      organization_id,
      project_id,
      branch_id
    ) values (
      d.organization_id,
      v_proj_id,
      d.branch_id
    ) on conflict do nothing;

    -- Perbarui status SPK & tautkan project_id
    update public.sales_documents
    set status = v_next_status,
        project_id = v_proj_id,
        review_note = nullif(btrim(p_note), ''),
        version = version + 1
    where id = d.id;

    perform gsp_private.procurement_log(
      d.organization_id, d.branch_id, d.id, 'spk', 'approved', p_note,
      jsonb_build_object('project_id', v_proj_id, 'project_code', v_proj_code, 'status', v_next_status)
    );

    return v_proj_id;

  elsif p_decision = 'revise' then
    v_next_status := 'revision_requested';
    update public.sales_documents
    set status = v_next_status,
        review_note = nullif(btrim(p_note), ''),
        version = version + 1
    where id = d.id;

    perform gsp_private.procurement_log(
      d.organization_id, d.branch_id, d.id, 'spk', 'revision_requested', p_note,
      jsonb_build_object('status', v_next_status)
    );
    return null;

  else
    v_next_status := 'rejected';
    update public.sales_documents
    set status = v_next_status,
        review_note = nullif(btrim(p_note), ''),
        version = version + 1
    where id = d.id;

    perform gsp_private.procurement_log(
      d.organization_id, d.branch_id, d.id, 'spk', 'rejected', p_note,
      jsonb_build_object('status', v_next_status)
    );
    return null;
  end if;
end;
$$;

-- 3. Fungsi Pengecekan Izin Edit & Review Proyek
create or replace function gsp_private.can_edit_project_planning(p public.crm_projects) returns boolean
language sql stable security definer set search_path='' as $$
  select p.approval_status in ('draft', 'revision_requested')
  and (
    gsp_private.is_superadmin(p.organization_id)
    or gsp_private.can_access_business(p.organization_id, p.branch_id, 'operations')
    or gsp_private.can_access_business(p.organization_id, p.branch_id, 'sales')
    or p.created_by = auth.uid()
  );
$$;

create or replace function gsp_private.can_review_project(p public.crm_projects) returns boolean
language sql stable security definer set search_path='' as $$
  select p.approval_status = 'director_review'
  and (
    gsp_private.is_superadmin(p.organization_id)
    or gsp_private.has_job(p.organization_id, null, array['president', 'technical_director', 'finance_director'])
  );
$$;

create or replace function gsp_private.can_decide_project(p public.crm_projects) returns boolean
language sql stable security definer set search_path='' as $$
  select p.approval_status = 'director_review'
  and (
    gsp_private.is_superadmin(p.organization_id)
    or gsp_private.has_job(p.organization_id, null, array['president'])
  );
$$;

-- 4. RPC Simpan & Ajukan Perencanaan Proyek (Admin / Manager Cabang)
create or replace function gsp_private.api_save_project_planning(
  p_id uuid,
  p_version integer,
  p_payload jsonb,
  p_submit boolean default false
) returns void
language plpgsql security definer set search_path='' as $$
declare
  p public.crm_projects;
  v_rab_total numeric(15,2) := 0;
  v_attachments uuid[];
  v_next_status text;
  v_item jsonb;
begin
  select * into p from public.crm_projects where id = p_id for update;
  if p.id is null or not gsp_private.can_edit_project_planning(p) then
    raise exception 'Akses perancangan proyek ditolak atau status proyek sudah terkunci.' using errcode = '42501';
  end if;
  if p.version is distinct from p_version then
    raise exception 'Versi proyek telah berubah. Muat ulang halaman dan periksa kembali.';
  end if;

  -- Hitung total RAB dari breakdown
  if p_payload ? 'rab_breakdown' and jsonb_typeof(p_payload->'rab_breakdown') = 'array' then
    for v_item in select * from jsonb_array_elements(p_payload->'rab_breakdown') loop
      v_rab_total := v_rab_total + coalesce((v_item->>'total')::numeric, 0);
    end loop;
  else
    v_rab_total := coalesce((p_payload->>'rab_total')::numeric, 0);
  end if;

  -- Validasi lampiran jika ada
  select coalesce(array_agg(value::uuid), '{}') into v_attachments
  from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids', '[]'));

  -- Jika submit ke direksi, periksa kelengkapan minimum
  if coalesce(p_submit, false) then
    if nullif(btrim(p_payload->>'work_details'), '') is null then
      raise exception 'Rincian teknis pekerjaan dan kebutuhan proyek wajib diisi sebelum submit.';
    end if;
    if not (p_payload ? 'manpower') or jsonb_array_length(coalesce(p_payload->'manpower', '[]'::jsonb)) = 0 then
      raise exception 'Daftar personil / tim SDM proyek wajib diisi minimal 1 penanggung jawab.';
    end if;
    if v_rab_total <= 0 then
      raise exception 'Rincian Rencana Anggaran Biaya (RAB) wajib diisi dengan nominal valid.';
    end if;
    v_next_status := 'director_review';
  else
    v_next_status := p.approval_status;
  end if;

  update public.crm_projects
  set work_details = btrim(coalesce(p_payload->>'work_details', work_details)),
      manpower = coalesce(p_payload->'manpower', manpower),
      timesheet_schedule = coalesce(p_payload->'timesheet_schedule', timesheet_schedule),
      rab_breakdown = coalesce(p_payload->'rab_breakdown', rab_breakdown),
      rab_total = v_rab_total,
      attachment_ids = v_attachments,
      starts_on = coalesce(nullif(p_payload->>'starts_on', '')::date, starts_on),
      ends_on = coalesce(nullif(p_payload->>'ends_on', '')::date, ends_on),
      approval_status = v_next_status,
      submitted_at = case when p_submit then now() else submitted_at end,
      review_note = case when p_submit then null else review_note end,
      version = version + 1,
      updated_at = now()
  where id = p.id;

  perform gsp_private.procurement_log(
    p.organization_id, p.branch_id, p.id, 'project',
    case when p_submit then 'submitted_to_directors' else 'planning_updated' end,
    null,
    jsonb_build_object('approval_status', v_next_status, 'rab_total', v_rab_total)
  );
end;
$$;

create or replace function public.save_project_planning(
  p_id uuid,
  p_version integer,
  p_payload jsonb,
  p_submit boolean default false
) returns void
language sql security invoker set search_path='' as $$
  select gsp_private.api_save_project_planning(p_id, p_version, p_payload, p_submit);
$$;

-- 5. RPC Keputusan Verifikasi Proyek oleh Direktur Utama
create or replace function gsp_private.api_decide_project(
  p_id uuid,
  p_version integer,
  p_decision text,
  p_note text
) returns void
language plpgsql security definer set search_path='' as $$
declare
  p public.crm_projects;
  v_next_status text;
  v_project_status text;
begin
  select * into p from public.crm_projects where id = p_id for update;
  if p.id is null or not gsp_private.can_decide_project(p) then
    raise exception 'Hanya Direktur Utama atau Super Admin yang berwenang memverifikasi proyek.' using errcode = '42501';
  end if;
  if p.version is distinct from p_version then
    raise exception 'Versi proyek berubah. Muat ulang dan periksa kembali.';
  end if;
  if p_decision is null or p_decision not in ('approve', 'revise', 'reject') then
    raise exception 'Pilih Setujui (ACC), Minta Revisi, atau Tolak.';
  end if;
  if p_decision in ('revise', 'reject') and nullif(btrim(p_note), '') is null then
    raise exception 'Catatan alasan revisi atau penolakan proyek wajib diisi.';
  end if;

  if p_decision = 'approve' then
    v_next_status := 'active';
    v_project_status := 'active';
  elsif p_decision = 'revise' then
    v_next_status := 'revision_requested';
    v_project_status := 'planned';
  else
    v_next_status := 'rejected';
    v_project_status := 'cancelled';
  end if;

  update public.crm_projects
  set approval_status = v_next_status,
      status = v_project_status,
      review_note = nullif(btrim(p_note), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      version = version + 1,
      updated_at = now()
  where id = p.id;

  perform gsp_private.procurement_log(
    p.organization_id, p.branch_id, p.id, 'project',
    'director_decision', p_note,
    jsonb_build_object('decision', p_decision, 'approval_status', v_next_status, 'status', v_project_status)
  );
end;
$$;

create or replace function public.decide_project(
  p_id uuid,
  p_version integer,
  p_decision text,
  p_note text
) returns void
language sql security invoker set search_path='' as $$
  select gsp_private.api_decide_project(p_id, p_version, p_decision, p_note);
$$;

notify pgrst, 'reload schema';
