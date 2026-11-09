-- ============================================================================
-- 20261109100000_project_costing_notifications_and_spk_sync.sql
-- 1. Penambahan Kolom project_id pada purchase_requests & cash_advances
-- 2. Sinkronisasi Penomoran SPK Otomatis dari SPH
-- 3. Notifikasi Pengajuan Proyek ke Direktur Utama & Arahan Direksi
-- 4. Antrean Review Proyek pada Dashboard Direktur Utama
-- 5. RPC Realisasi Project Costing & Pagu RAB Otomatis
-- 6. RPC Pengajuan Kasbon SPPD Lapangan Terkait Proyek
-- ============================================================================

-- 1. Kolom project_id & sppd_number
alter table public.purchase_requests add column if not exists project_id uuid references public.crm_projects(id) on delete set null;
create index if not exists purchase_requests_project on public.purchase_requests(organization_id, project_id);

alter table public.cash_advances add column if not exists branch_id uuid references public.business_units(id) on delete set null;
alter table public.cash_advances add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.cash_advances add column if not exists sppd_number text;
create index if not exists cash_advances_project on public.cash_advances(organization_id, project_id);

-- 2. Perbarui gsp_private.api_save_sales_document untuk menerima document_number dari SPH/User
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

  -- Gunakan nomor SPK dari formulir (berdasarkan SPH) atau generate baru
  v_spk_number := coalesce(
    nullif(btrim(p_payload->>'document_number'), ''),
    gsp_private.generate_document_number(p_org, 'spk', current_date, c.name, null, null)
  );
  v_amount := coalesce(nullif(p_payload->>'amount', '')::numeric, d.amount, 0);

  -- Simpan draft atau ajukan langsung ke Direktur Utama
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

-- 3. Perbarui save_purchase_request untuk menyimpan project_id
create or replace function public.save_purchase_request(
  p_org uuid,
  p_branch uuid,
  p_payload jsonb,
  p_id uuid default null,
  p_version integer default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.purchase_requests;
  v public.procurement_vendors;
  newid uuid;
  attachments uuid[];
  bad integer;
  v_project_id uuid;
begin
  if not gsp_private.can_access_business(p_org, p_branch, 'procurement') then
    raise exception 'Akses cabang ditolak.' using errcode = '42501';
  end if;

  if p_id is not null then
    select * into d from public.purchase_requests where id = p_id for update;
    if d.id is null or d.organization_id <> p_org or d.branch_id <> p_branch or (d.created_by <> auth.uid() and not gsp_private.is_superadmin(p_org)) then
      raise exception 'Pengajuan bukan milik Anda.' using errcode = '42501';
    end if;
    if d.version is distinct from p_version or d.status not in ('draft', 'rejected') then
      raise exception 'Versi berubah atau pengajuan terkunci.';
    end if;
  end if;

  select * into v from public.procurement_vendors
  where id = nullif(p_payload->>'vendor_id', '')::uuid and organization_id = p_org and branch_id = p_branch;
  if nullif(p_payload->>'vendor_id', '') is not null and (v.id is null or v.status = 'rejected') then
    raise exception 'Vendor tidak tersedia di cabang ini.';
  end if;

  if nullif(btrim(p_payload->>'invoice_number'), '') is null or nullif(p_payload->>'invoice_date', '') is null then
    raise exception 'Nomor dan tanggal invoice wajib diisi.';
  end if;

  select coalesce(array_agg(value::uuid), '{}') into attachments
  from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids', '[]'));

  if cardinality(attachments) > 0 then
    if cardinality(attachments) > 10 or to_regclass('public.procurement_attachments') is null then
      raise exception 'Lampiran tidak tersedia.';
    end if;
    execute 'select count(*) from unnest($1) x where not exists(select 1 from public.procurement_attachments a where a.id=x and a.organization_id=$2 and a.branch_id=$3 and a.domain=''procurement'')'
      into bad using attachments, p_org, p_branch;
    if bad > 0 then
      raise exception 'Lampiran tidak sesuai cabang.';
    end if;
  end if;

  v_project_id := nullif(p_payload->>'project_id', '')::uuid;
  newid := coalesce(p_id, gen_random_uuid());

  insert into public.purchase_requests(
    id, organization_id, branch_id, created_by, project_id,
    invoice_number, invoice_date, tax_invoice_number, tax_invoice_date,
    vendor_id, vendor_snapshot, lines, vat_mode, vat_creditable,
    withholding_code, withholding_rate, withholding_base, requested_payment_date,
    notes, attachment_ids, withholding_timing
  )
  values(
    newid, p_org, p_branch, auth.uid(), v_project_id,
    btrim(p_payload->>'invoice_number'), (p_payload->>'invoice_date')::date,
    nullif(p_payload->>'tax_invoice_number', ''), nullif(p_payload->>'tax_invoice_date', '')::date,
    v.id, case when v.id is not null then to_jsonb(v) else coalesce(p_payload->'vendor_snapshot', '{}') end,
    p_payload->'lines', coalesce(p_payload->>'vat_mode', 'none'),
    coalesce((p_payload->>'vat_creditable')::boolean, false),
    coalesce(p_payload->>'withholding_code', 'none'),
    coalesce((p_payload->>'withholding_rate')::numeric, 0),
    coalesce((p_payload->>'withholding_base')::numeric, 0),
    nullif(p_payload->>'requested_payment_date', '')::date,
    p_payload->>'notes', attachments, coalesce(p_payload->>'withholding_timing', 'invoice')
  )
  on conflict(id) do update set
    project_id = coalesce(excluded.project_id, purchase_requests.project_id),
    invoice_number = excluded.invoice_number,
    invoice_date = excluded.invoice_date,
    tax_invoice_number = excluded.tax_invoice_number,
    tax_invoice_date = excluded.tax_invoice_date,
    vendor_id = excluded.vendor_id,
    vendor_snapshot = excluded.vendor_snapshot,
    lines = excluded.lines,
    vat_mode = excluded.vat_mode,
    vat_creditable = excluded.vat_creditable,
    withholding_code = excluded.withholding_code,
    withholding_rate = excluded.withholding_rate,
    withholding_base = excluded.withholding_base,
    withholding_timing = excluded.withholding_timing,
    requested_payment_date = excluded.requested_payment_date,
    notes = excluded.notes,
    attachment_ids = excluded.attachment_ids,
    status = 'draft',
    version = purchase_requests.version + 1,
    coa_confirmed = false;

  perform gsp_private.procurement_log(
    p_org, p_branch, newid, 'purchase', 'draft_saved', null,
    jsonb_build_object('project_id', v_project_id)
  );

  return newid;
end;
$$;

-- 4. Antrean Pemeriksaan Bisnis Direktur Utama & Direksi (Mencakup Proyek yang Diajukan)
create or replace function gsp_private.api_sph_review_queue(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(q order by q.submitted_at),'[]') from (
    -- Antrean SPH (Manager Cabang & Direktur Keuangan)
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

    -- Antrean SPK (Khusus Direktur Utama / Super Admin)
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

    union all

    -- Antrean Proyek & Pagu RAB (Direktur Utama & Direksi)
    select
      p.id,
      'project'::text as kind,
      coalesce(p.code, 'PRJ') || ' • ' || p.name as title,
      p.approval_status as status,
      p.branch_id,
      coalesce(p.contract_amount, 0) as amount,
      coalesce(p.submitted_at, p.created_at) as submitted_at
    from public.crm_projects p
    where p.organization_id = p_org
      and p.approval_status = 'director_review'
      and (gsp_private.can_decide_project(p) or gsp_private.can_review_project(p))
  ) q;
$$;

-- 5. Notifikasi Lonceng Terpadu (SPH, SPK, dan Perencanaan Proyek)
create or replace function gsp_private.api_sales_notifications(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
 with items as (
  -- SPH (Persetujuan ke Direktur Keuangan)
  select d.id, 'sph'::text as kind, d.sph_number, d.document_number, d.status, d.review_note, d.created_at,
   case when gsp_private.can_review_sph(d) then 'approval' else 'follow_up' end category,
   case when gsp_private.can_review_sph(d) then 'Persetujuan SPH Direktur Keuangan' else 'SPH perlu tindak lanjut' end label
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

  -- SPK (Persetujuan LANGSUNG ke Direktur Utama)
  select d.id, 'spk'::text as kind, d.sph_number, d.document_number, d.status, d.review_note, d.created_at,
   case when gsp_private.can_review_spk(d) then 'approval' else 'follow_up' end category,
   case when gsp_private.can_review_spk(d) then 'Persetujuan SPK Direktur Utama'
        when d.status = 'revision_requested' then 'SPK perlu revisi'
        when d.status = 'ready' then 'SPK Disetujui: Lengkapi RAB & lampiran Proyek'
        else 'SPK perlu tindak lanjut' end label
  from public.sales_documents d
  where d.organization_id = p_org
    and d.kind = 'spk'
    and gsp_private.sales_internal_member(p_org)
    and (
      gsp_private.can_review_spk(d)
      or (d.created_by = auth.uid() and d.status in ('revision_requested', 'rejected', 'ready'))
    )

  union all

  -- Proyek (Persetujuan Perencanaan & Pagu RAB ke Direktur Utama / Arahan Direksi)
  select
    p.id,
    'project'::text as kind,
    null::integer as sph_number,
    p.code as document_number,
    p.approval_status as status,
    p.review_note,
    coalesce(p.submitted_at, p.created_at) as created_at,
    case when gsp_private.can_decide_project(p) or gsp_private.can_review_project(p) then 'approval' else 'follow_up' end category,
    case when gsp_private.can_decide_project(p) then 'Persetujuan Perencanaan Proyek & RAB (Direktur Utama)'
         when gsp_private.can_review_project(p) then 'Pemeriksaan Perencanaan Proyek & RAB (Direksi)'
         when p.approval_status = 'revision_requested' then 'Perencanaan Proyek perlu revisi'
         when p.approval_status = 'active' then 'Proyek telah di-ACC Direktur Utama (Siap Eksekusi)'
         when p.approval_status = 'rejected' then 'Pengajuan Proyek ditolak Direktur Utama'
         else 'Proyek perlu tindak lanjut' end label
  from public.crm_projects p
  where p.organization_id = p_org
    and (
      (p.approval_status = 'director_review' and (gsp_private.can_decide_project(p) or gsp_private.can_review_project(p)))
      or (
        p.approval_status in ('revision_requested', 'active', 'rejected')
        and (
          p.created_by = auth.uid()
          or gsp_private.is_superadmin(p.organization_id)
          or gsp_private.can_access_business(p.organization_id, p.branch_id, 'operations')
          or gsp_private.can_access_business(p.organization_id, p.branch_id, 'sales')
        )
      )
    )
 )
 select jsonb_build_object(
   'total', count(*),
   'items', coalesce((select jsonb_agg(x order by x.created_at desc) from (select * from items order by created_at desc limit 100) x), '[]')
 )
 from items;
$$;

-- 6. RPC Realisasi Biaya & Project Costing Real-Time
create or replace function public.get_project_costing(p_org uuid, p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proj public.crm_projects;
  v_contract numeric(15,2);
  v_rab numeric(15,2);
  v_purchase_realized numeric(15,2) := 0;
  v_advance_realized numeric(15,2) := 0;
  v_total_realized numeric(15,2) := 0;
  v_remaining_budget numeric(15,2) := 0;
  v_serapan_pct numeric(7,2) := 0;
  v_net_profit numeric(15,2) := 0;
  v_net_profit_pct numeric(7,2) := 0;
  v_purchases jsonb := '[]'::jsonb;
  v_advances jsonb := '[]'::jsonb;
begin
  select * into v_proj from public.crm_projects
  where id = p_project_id and organization_id = p_org;

  if v_proj.id is null then
    return jsonb_build_object('error', 'Proyek tidak ditemukan.');
  end if;

  v_contract := coalesce(v_proj.contract_amount, 0);
  v_rab := coalesce(v_proj.rab_total, 0);

  -- Realisasi dari Pembelian / Vendor (status != draft dan != rejected)
  select
    coalesce(sum(pr.total), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', pr.id,
      'invoice_number', pr.invoice_number,
      'invoice_date', pr.invoice_date,
      'vendor_name', coalesce(pr.vendor_snapshot->>'name', 'Vendor'),
      'total', pr.total,
      'status', pr.status,
      'created_at', pr.created_at
    ) order by pr.created_at desc), '[]'::jsonb)
  into v_purchase_realized, v_purchases
  from public.purchase_requests pr
  where pr.organization_id = p_org
    and pr.project_id = p_project_id
    and pr.status not in ('draft', 'rejected');

  -- Realisasi dari Kasbon SPPD Lapangan
  select
    coalesce(sum(ca.amount), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', ca.id,
      'advance_number', ca.advance_number,
      'sppd_number', ca.sppd_number,
      'description', ca.description,
      'amount', ca.amount,
      'status', ca.advance_status,
      'needed_on', ca.needed_on,
      'destination', ca.trip_destination
    ) order by ca.needed_on desc), '[]'::jsonb)
  into v_advance_realized, v_advances
  from public.cash_advances ca
  where ca.organization_id = p_org
    and ca.project_id = p_project_id
    and ca.advance_status in ('approved', 'disbursed', 'settled');

  v_total_realized := v_purchase_realized + v_advance_realized;
  v_remaining_budget := v_rab - v_total_realized;
  if v_rab > 0 then
    v_serapan_pct := round((v_total_realized / v_rab) * 100, 2);
  else
    v_serapan_pct := 0;
  end if;

  v_net_profit := v_contract - v_total_realized;
  if v_contract > 0 then
    v_net_profit_pct := round((v_net_profit / v_contract) * 100, 2);
  else
    v_net_profit_pct := 0;
  end if;

  return jsonb_build_object(
    'project_id', v_proj.id,
    'contract_amount', v_contract,
    'rab_total', v_rab,
    'realized_purchases', v_purchase_realized,
    'realized_advances', v_advance_realized,
    'total_realized', v_total_realized,
    'remaining_budget', v_remaining_budget,
    'budget_absorption_pct', v_serapan_pct,
    'real_net_profit', v_net_profit,
    'real_net_profit_pct', v_net_profit_pct,
    'purchases', v_purchases,
    'advances', v_advances
  );
end;
$$;

-- 7. RPC Pengajuan Kasbon SPPD Terkait Proyek
create or replace function public.save_project_sppd_advance(
  p_org uuid,
  p_branch uuid,
  p_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_proj public.crm_projects;
  v_b public.business_units;
  v_sppd_num text;
  v_kb_num text;
  v_amt numeric(18,2);
  v_needed date;
  v_dest text;
  v_desc text;
begin
  select * into v_b from public.business_units where id = p_branch and organization_id = p_org;
  if v_b.id is null then raise exception 'Cabang tidak valid.'; end if;

  if p_payload ? 'project_id' and nullif(p_payload->>'project_id', '') is not null then
    select * into v_proj from public.crm_projects where id = (p_payload->>'project_id')::uuid and organization_id = p_org;
    if v_proj.id is null then raise exception 'Proyek tidak ditemukan.'; end if;
  end if;

  v_amt := coalesce((p_payload->>'amount')::numeric, 0);
  if v_amt <= 0 then raise exception 'Nominal kasbon SPPD harus lebih dari 0.'; end if;

  v_needed := coalesce(nullif(p_payload->>'needed_on', '')::date, current_date);
  v_dest := coalesce(p_payload->>'trip_destination', 'Lokasi Proyek');
  v_desc := coalesce(p_payload->>'description', 'Kasbon SPPD Proyek ' || coalesce(v_proj.name, ''));

  v_sppd_num := gsp_private.generate_document_number(p_org, 'sppd', v_needed, null, v_b.code, null);
  v_kb_num := gsp_private.generate_document_number(p_org, 'kb', v_needed, null, v_b.code, null);

  insert into public.cash_advances(
    organization_id, branch_id, advance_number, sppd_number, purpose_type, project_id,
    trip_destination, departure_on, return_on, description, amount, needed_on, settlement_due_on,
    advance_status, created_by
  ) values (
    p_org, p_branch, v_kb_num, v_sppd_num, 'project', v_proj.id,
    v_dest, coalesce(nullif(p_payload->>'departure_on', '')::date, v_needed),
    coalesce(nullif(p_payload->>'return_on', '')::date, v_needed + interval '3 days'),
    v_desc, v_amt, v_needed, coalesce(nullif(p_payload->>'settlement_due_on', '')::date, v_needed + interval '7 days'),
    'approved', auth.uid()
  ) returning id into v_id;

  perform gsp_private.procurement_log(
    p_org, p_branch, v_id, 'cash_advance', 'sppd_created',
    v_desc, jsonb_build_object('sppd_number', v_sppd_num, 'advance_number', v_kb_num, 'amount', v_amt, 'project_id', v_proj.id)
  );

  return v_id;
end;
$$;

-- 8. Fleksibilitas Pengajuan RAB & Dokumen Proyek: Cukup Upload Berkas RAB & Input Total Pagu
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
  v_work_details text;
  v_manpower jsonb;
begin
  select * into p from public.crm_projects where id = p_id for update;
  if p.id is null or not gsp_private.can_edit_project_planning(p) then
    raise exception 'Akses perancangan proyek ditolak atau status proyek sudah terkunci.' using errcode = '42501';
  end if;
  if p.version is distinct from p_version then
    raise exception 'Versi proyek telah berubah. Muat ulang halaman dan periksa kembali.';
  end if;

  -- Hitung total RAB: prioritaskan nominal langsung atau hitung dari rincian breakdown
  v_rab_total := coalesce((p_payload->>'rab_total')::numeric, 0);
  if v_rab_total <= 0 and p_payload ? 'rab_breakdown' and jsonb_typeof(p_payload->'rab_breakdown') = 'array' then
    for v_item in select * from jsonb_array_elements(p_payload->'rab_breakdown') loop
      v_rab_total := v_rab_total + coalesce((v_item->>'total')::numeric, 0);
    end loop;
  end if;

  -- Validasi lampiran jika ada
  select coalesce(array_agg(value::uuid), '{}') into v_attachments
  from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids', '[]'));

  v_work_details := coalesce(nullif(btrim(p_payload->>'work_details'), ''), p.work_details, 'Rincian teknis pekerjaan mengikuti SPK dan dokumen lampiran RAB.');
  v_manpower := coalesce(p_payload->'manpower', p.manpower, '[{"name": "Team Pelaksana Cabang", "role": "Pelaksana Lapangan"}]'::jsonb);
  if jsonb_array_length(v_manpower) = 0 then
    v_manpower := '[{"name": "Team Pelaksana Cabang", "role": "Pelaksana Lapangan"}]'::jsonb;
  end if;

  -- Jika submit ke direksi, periksa kelengkapan minimum (Pagu RAB wajib ada nilai valid)
  if coalesce(p_submit, false) then
    if v_rab_total <= 0 then
      raise exception 'Tentukan Total Pagu Anggaran RAB (Rp) atau unggah berkas dokumen RAB proyek sebelum submit.';
    end if;
    v_next_status := 'director_review';
  else
    v_next_status := p.approval_status;
  end if;

  update public.crm_projects
  set work_details = v_work_details,
      manpower = v_manpower,
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
    jsonb_build_object('approval_status', v_next_status, 'rab_total', v_rab_total, 'attachments_count', cardinality(v_attachments))
  );
end;
$$;

notify pgrst, 'reload schema';
