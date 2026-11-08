-- Migration: 20261108_fast_track_resubmit_to_director.sql
-- Alur Pintar Pengembalian Revisi (Fast-Track Resubmit):
-- Jika revisi diminta oleh Direktur, saat pengaju (admin/cabang) mengirim perbaikan,
-- dokumen LANGSUNG kembali ke Direktur terkait tanpa harus melewati Manager Cabang lagi.

-- 1. Tambahkan kolom return_to_stage pada sales_documents dan purchase_requests
alter table public.sales_documents add column if not exists return_to_stage text;
alter table public.purchase_requests add column if not exists return_to_stage text;

-- 2. Perbarui api_decide_sph: Catat return_to_stage saat Direktur / Manager meminta revisi
create or replace function gsp_private.api_decide_sph(
  p_id uuid,
  p_version integer,
  p_decision text,
  p_note text
) returns void
language plpgsql security definer set search_path='' as $$
declare
  d public.sales_documents;
  next_status text;
  v_return_stage text := null;
begin
  select * into d from public.sales_documents where id = p_id for update;
  if d.id is null or not gsp_private.can_review_sph(d) then
    raise exception 'Bukan tahap pemeriksaan SPH Anda atau pengajuan milik sendiri.' using errcode = '42501';
  end if;
  if d.version is distinct from p_version then
    raise exception 'Versi SPH berubah. Muat ulang dan periksa kembali.';
  end if;
  if p_decision is null or p_decision not in ('approve', 'revise', 'reject') then
    raise exception 'Pilih Setujui, Revisi atau Tolak.';
  end if;
  if p_decision in ('revise', 'reject') and nullif(btrim(p_note), '') is null then
    raise exception 'Alasan revisi atau penolakan wajib diisi.';
  end if;
  if length(coalesce(p_note, '')) > 5000 then
    raise exception 'Catatan maksimal 5000 karakter.';
  end if;
  if p_decision = 'approve' and d.valid_until < (now() at time zone 'Asia/Bangkok')::date then
    raise exception 'Masa berlaku SPH berakhir; kembalikan untuk revisi.';
  end if;

  if p_decision = 'revise' then
    next_status := 'revision_requested';
    -- Catat tahap asal revisi: jika diminta di director_review, target kembalinya adalah director_review
    v_return_stage := d.status;
  elsif p_decision = 'reject' then
    next_status := 'rejected';
  elsif d.status = 'branch_review' then
    next_status := 'director_review';
  else
    next_status := 'ready';
  end if;

  update public.sales_documents
  set status = next_status,
      review_note = nullif(btrim(p_note), ''),
      return_to_stage = v_return_stage,
      version = version + 1
  where id = d.id;

  perform gsp_private.procurement_log(
    d.organization_id, d.branch_id, d.id, 'sph',
    case p_decision when 'approve' then 'approved' when 'revise' then 'revision_requested' else 'rejected' end,
    p_note,
    jsonb_build_object(
      'from_status', d.status,
      'next_status', next_status,
      'return_to_stage', v_return_stage,
      'version', d.version,
      'superadmin_override', d.created_by = auth.uid()
    )
  );
end;
$$;

-- 3. Perbarui api_save_sph_request: Fast-track resubmit langsung ke Direktur Keuangan jika return_to_stage = 'director_review'
create or replace function gsp_private.api_save_sph_request(
  p_org uuid,
  p_branch uuid,
  p_payload jsonb,
  p_id uuid default null,
  p_version integer default null,
  p_submit boolean default false
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  d public.sales_documents;
  c public.sales_clients;
  i uuid;
  attachments uuid[];
  scopes text[];
  next_status text;
  snapshot jsonb;
  v_amount numeric;
  v_is_reviewer boolean := false;
  v_is_creator boolean := false;
  v_is_owner boolean := false;
  v_target_return text := null;
begin
  if not gsp_private.sales_client_reader(p_org) or not gsp_private.can_access_business(p_org, p_branch, 'sales') then
    raise exception 'Akses pengajuan SPH cabang ditolak.' using errcode = '42501';
  end if;

  if not exists(select 1 from public.business_units where id = p_branch and organization_id = p_org and kind in ('branch', 'center')) then
    raise exception 'Pilih cabang operasional yang diizinkan.';
  end if;

  if p_id is not null then
    select * into d from public.sales_documents where id = p_id for update;
  end if;

  if d.id is not null then
    v_is_owner := gsp_private.is_superadmin(p_org);
    v_is_creator := (d.created_by = auth.uid());
    v_is_reviewer := gsp_private.can_review_sph(d);
    v_target_return := d.return_to_stage;

    if d.organization_id <> p_org or d.branch_id <> p_branch or d.kind <> 'sph' then
      raise exception 'Cabang atau organisasi SPH tidak sesuai.' using errcode = '42501';
    end if;

    if not (v_is_creator or v_is_reviewer or v_is_owner) then
      raise exception 'Anda tidak memiliki hak untuk mengubah SPH ini.' using errcode = '42501';
    end if;

    if d.version is distinct from p_version then
      raise exception 'Versi SPH sudah berubah. Muat ulang formulir.';
    end if;

    if v_is_creator and not (v_is_reviewer or v_is_owner) and d.status not in ('draft', 'rejected', 'revision_requested') then
      raise exception 'Dokumen SPH sedang dalam peninjauan dan terkunci.';
    end if;
  end if;

  select * into c from public.sales_clients
  where id = nullif(p_payload->>'client_id', '')::uuid and organization_id = p_org;

  if c.id is null then
    raise exception 'Klien tidak ditemukan pada perusahaan ini.';
  end if;

  if nullif(btrim(p_payload->>'title'), '') is null or length(p_payload->>'title') > 300 then
    raise exception 'Judul penawaran wajib diisi, maksimal 300 karakter.';
  end if;

  select coalesce(array_agg(value::uuid), '{}') into attachments
  from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids', '[]'));
  perform gsp_private.validate_sales_attachments(p_org, p_branch, attachments);

  if d.id is not null and not d.attachment_ids <@ attachments then
    raise exception 'Lampiran tersimpan tidak boleh dihapus.';
  end if;

  select coalesce(array_agg(value), '{}') into scopes
  from jsonb_array_elements_text(coalesce(p_payload->'work_scopes', '[]'));

  if not scopes <@ array['Pertek','UKL/UPL','Amdal','DELH','DPLH','Andalalin','LB 3','Lainnya']::text[] or cardinality(scopes) <> (select count(distinct x) from unnest(scopes) x) then
    raise exception 'Lingkup pekerjaan tidak valid atau duplikat.';
  end if;

  v_amount := nullif(regexp_replace(coalesce(p_payload->>'amount', ''), '[^0-9.]', '', 'g'), '')::numeric;

  if coalesce(p_submit, false) then
    if (p_payload->>'confirmed')::boolean is distinct from true then
      raise exception 'Konfirmasi kebenaran data sebelum mengajukan SPH.';
    end if;

    if nullif(btrim(p_payload->>'work_area'), '') is null or cardinality(scopes) = 0 or nullif(p_payload->>'deal_status', '') is null or nullif(p_payload->>'valid_until', '') is null then
      raise exception 'Lengkapi daerah pengerjaan, lingkup, status deal dan masa berlaku sebelum submit.';
    end if;

    if v_amount is null or v_amount <= 0 then
      raise exception 'Nilai SPH wajib diisi dengan nominal positif sebelum submit.';
    end if;

    if (p_payload->>'valid_until')::date < (now() at time zone 'Asia/Bangkok')::date then
      raise exception 'Masa berlaku SPH sudah berakhir.';
    end if;

    if c.email is null or c.phone is null or c.industry not in ('Mining','Migas','Industri','Umum') or length(regexp_replace(coalesce(c.npwp,''),'[^0-9]','','g')) not in (15,16) then
      raise exception 'Lengkapi identitas klien yang valid sebelum submit SPH.';
    end if;
  end if;

  snapshot := jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'address', c.address,
    'npwp', c.npwp,
    'phone', c.phone,
    'email', c.email,
    'industry', c.industry
  );

  if d.id is null then
    i := coalesce(p_id, gen_random_uuid());
    insert into public.sales_documents(
      id, organization_id, branch_id, client_id, kind, title, source,
      amount, notes, attachment_ids, work_area, work_scopes, deal_status,
      valid_until, client_snapshot, created_by
    )
    values(
      i, p_org, p_branch, c.id, 'sph', btrim(p_payload->>'title'), 'company',
      v_amount, nullif(btrim(p_payload->>'notes'), ''), attachments,
      nullif(btrim(p_payload->>'work_area'), ''), scopes,
      nullif(p_payload->>'deal_status', ''), nullif(p_payload->>'valid_until', '')::date,
      snapshot, auth.uid()
    );
    perform gsp_private.procurement_log(p_org, p_branch, i, 'sph', 'draft_created');
  else
    i := d.id;
    update public.sales_documents
    set client_id = c.id,
        title = btrim(p_payload->>'title'),
        amount = coalesce(v_amount, amount),
        notes = nullif(btrim(p_payload->>'notes'), ''),
        attachment_ids = attachments,
        work_area = nullif(btrim(p_payload->>'work_area'), ''),
        work_scopes = scopes,
        deal_status = nullif(p_payload->>'deal_status', ''),
        valid_until = nullif(p_payload->>'valid_until', '')::date,
        client_snapshot = snapshot,
        status = case when (v_is_reviewer or v_is_owner) then d.status else 'draft' end,
        version = version + 1
    where id = i;

    if v_is_reviewer or v_is_owner then
      perform gsp_private.procurement_log(
        p_org, p_branch, i, 'sph', 'reviewer_edited',
        'Pemeriksa memperbarui data SPH secara langsung.',
        jsonb_build_object('amount', v_amount, 'title', p_payload->>'title', 'actor_id', auth.uid())
      );
    else
      perform gsp_private.procurement_log(p_org, p_branch, i, 'sph', 'draft_updated');
    end if;
  end if;

  if coalesce(p_submit, false) and not (v_is_reviewer or v_is_owner) then
    -- FAST-TRACK ROUTING:
    -- Jika SPH sebelumnya dikembalikan oleh Direktur Keuangan, ajukan langsung kembali ke Direktur Keuangan!
    if v_target_return = 'director_review' then
      next_status := 'director_review';
    elsif exists(
      select 1 from public.work_assignments
      where organization_id = p_org and user_id = auth.uid()
      and (branch_id = p_branch or branch_id is null)
      and job_role in ('branch_manager', 'president', 'finance_director', 'technical_director')
    ) or exists(
      select 1 from public.business_units where id = p_branch and kind = 'center'
    ) then
      next_status := 'director_review';
    else
      next_status := 'branch_review';
    end if;

    update public.sales_documents
    set status = next_status,
        return_to_stage = null, -- Bersihkan target pengembalian setelah dikirim
        submitted_at = now(),
        version = version + 1
    where id = i;

    perform gsp_private.procurement_log(
      p_org, p_branch, i, 'sph',
      case when v_target_return = 'director_review' then 'resubmitted_to_director' else 'submitted' end,
      case when v_target_return = 'director_review' then 'Perbaikan SPH diajukan langsung kembali ke Direktur Keuangan (melewati Manager Cabang).' else null end,
      jsonb_build_object('next_status', next_status, 'confirmed', true, 'bypassed_branch_manager', (v_target_return = 'director_review'))
    );
  end if;

  return i;
end;
$$;

-- 4. Perbarui api_decide_spk: Catat return_to_stage saat Direktur Utama meminta revisi SPK
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
  v_return_stage text := null;
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

    insert into public.crm_projects(
      organization_id, code, name, status, starts_on, created_by,
      client_id, spk_id, branch_id, contract_amount, approval_status, work_details
    ) values (
      d.organization_id, v_proj_code, d.title, 'planned', current_date, auth.uid(),
      d.client_id, d.id, d.branch_id, v_amount, 'draft',
      'Diterbitkan dari SPK ' || coalesce(d.document_number, 'SPK') || ' atas SPH No. ' || coalesce(d.sph_number::text, '-')
    ) returning id into v_proj_id;

    update public.sales_documents
    set status = v_next_status,
        project_id = v_proj_id,
        return_to_stage = null,
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
    v_return_stage := 'director_review';

    update public.sales_documents
    set status = v_next_status,
        return_to_stage = v_return_stage,
        review_note = nullif(btrim(p_note), ''),
        version = version + 1
    where id = d.id;

    perform gsp_private.procurement_log(
      d.organization_id, d.branch_id, d.id, 'spk', 'revision_requested', p_note,
      jsonb_build_object('status', v_next_status, 'return_to_stage', v_return_stage)
    );
    return null;

  else
    v_next_status := 'rejected';

    update public.sales_documents
    set status = v_next_status,
        return_to_stage = null,
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

-- 5. Perbarui submit_purchase_request: Fast-track resubmit langsung ke Direktur Keuangan jika return_to_stage = 'director_review'
create or replace function public.submit_purchase_request(p_id uuid, p_version integer)
returns void
language plpgsql security definer set search_path='' as $$
declare
  d public.purchase_requests;
  nextstatus text;
  v_bypassed boolean := false;
  v_target_return text;
begin
  select * into d from public.purchase_requests where id = p_id for update;
  if d.id is null or not gsp_private.can_access_business(d.organization_id, d.branch_id, 'procurement') or (d.created_by <> auth.uid() and not gsp_private.is_superadmin(d.organization_id)) then
    raise exception 'Akses pengajuan ditolak.' using errcode = '42501';
  end if;
  if d.status not in ('draft', 'rejected') or d.version <> p_version then
    raise exception 'Pengajuan berubah atau sudah diajukan.';
  end if;
  if not exists(select 1 from public.procurement_vendors where id = d.vendor_id and status = 'approved') then
    raise exception 'Vendor harus disetujui Finance sebelum pengajuan pembayaran.';
  end if;

  v_target_return := d.return_to_stage;

  -- FAST-TRACK ROUTING:
  -- Jika penolakan/revisi berasal dari Direktur Keuangan, langsung kembali ke Direktur Keuangan!
  if v_target_return = 'director_review' then
    nextstatus := 'director_review';
    v_bypassed := true;
  elsif gsp_private.has_job(d.organization_id, d.branch_id, array['branch_manager', 'project_manager']) then
    nextstatus := 'director_review';
  else
    nextstatus := 'branch_review';
  end if;

  update public.purchase_requests
  set status = nextstatus,
      return_to_stage = null,
      version = version + 1,
      vendor_snapshot = (select to_jsonb(v) from public.procurement_vendors v where v.id = d.vendor_id)
  where id = d.id;

  perform gsp_private.procurement_log(
    d.organization_id, d.branch_id, d.id, 'purchase',
    case when v_bypassed then 'resubmitted_to_director' else 'submitted' end,
    case when v_bypassed then 'Perbaikan pengajuan pembelian diajukan langsung kembali ke Direktur Keuangan (melewati Manager Cabang).' else null end,
    jsonb_build_object('next', nextstatus, 'bypassed_branch_manager', v_bypassed)
  );
end;
$$;

-- 6. Perbarui api_review_purchase_request agar mencatat return_to_stage saat Direktur / Manager menolak untuk revisi
create or replace function gsp_private.api_review_purchase_request(
  p_id uuid,
  p_version integer,
  p_approve boolean,
  p_note text,
  p_accounting jsonb default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.purchase_requests;
  nextstatus text;
  j uuid;
  ln integer := 0;
  l jsonb;
  amt numeric;
  entity uuid;
  period uuid;
  ap uuid;
  vat uuid;
  wh uuid;
  cost numeric;
  before_doc jsonb;
  target_journal_date date;
  v_return_stage text := null;
begin
  select * into d from public.purchase_requests where id = p_id for update;
  before_doc := to_jsonb(d);

  if d.id is null or not gsp_private.can_review_purchase(d) or d.status = 'payment_ready' then
    raise exception 'Bukan tahap pemeriksaan Anda.' using errcode = '42501';
  end if;

  if d.version <> p_version then
    raise exception 'Versi pengajuan berubah.';
  end if;

  if p_approve is null or (not p_approve and nullif(btrim(p_note), '') is null) then
    raise exception 'Keputusan dan alasan penolakan wajib diisi.';
  end if;

  if not p_approve then
    nextstatus := 'rejected';
    -- Catat bahwa penolakan/revisi ini berasal dari tahap d.status (misal: director_review)
    v_return_stage := d.status;
  elsif d.status = 'branch_review' then
    nextstatus := 'director_review';
  elsif d.status = 'director_review' then
    nextstatus := 'accounting_review';
  else
    -- Accounting review
    if p_accounting is null or (p_accounting->>'coa_confirmed')::boolean is distinct from true then
      raise exception 'Accounting wajib memeriksa COA dan pajak.';
    end if;

    entity := (p_accounting->>'entity_id')::uuid;
    period := (p_accounting->>'period_id')::uuid;
    ap := (p_accounting->>'payable_account_id')::uuid;
    vat := nullif(p_accounting->>'vat_account_id', '')::uuid;
    wh := nullif(p_accounting->>'withholding_account_id', '')::uuid;

    if not exists(select 1 from public.business_units where id = d.branch_id and organization_id = d.organization_id and entity_id = entity) then
      raise exception 'Super Admin perlu memetakan cabang ke entitas akuntansi terlebih dahulu.';
    end if;

    if not exists(select 1 from public.accounting_periods where id = period and organization_id = d.organization_id and entity_id = entity and period_status = 'open') then
      raise exception 'Pilih periode akuntansi terbuka.';
    end if;

    update public.purchase_requests
    set lines = coalesce(p_accounting->'lines', lines),
        vat_mode = coalesce(p_accounting->>'vat_mode', vat_mode),
        vat_creditable = coalesce((p_accounting->>'vat_creditable')::boolean, vat_creditable),
        withholding_code = coalesce(p_accounting->>'withholding_code', withholding_code),
        payable_account_id = ap,
        vat_account_id = vat,
        withholding_account_id = wh,
        tax_invoice_number = nullif(btrim(p_accounting->>'tax_invoice_number'), ''),
        tax_invoice_date = nullif(p_accounting->>'tax_invoice_date', '')::date
    where id = d.id;

    perform gsp_private.calculate_purchase();

    select starts_on into target_journal_date from public.accounting_periods where id = period;
    if d.invoice_date > target_journal_date then
      target_journal_date := d.invoice_date;
    end if;

    insert into public.accounting_journals(
      organization_id, entity_id, period_id, journal_number,
      journal_date, source_type, source_id, description
    ) values(
      d.organization_id, entity, period,
      'JRN/' || to_char(target_journal_date, 'YYYYMM') || '/' || lpad((select count(*) + 1 from public.accounting_journals where organization_id = d.organization_id and entity_id = entity)::text, 4, '0'),
      target_journal_date, 'payable', d.id,
      'Pengakuan utang pembelian invoice ' || d.invoice_number
    ) returning id into j;

    select * into d from public.purchase_requests where id = p_id;

    for l in select * from jsonb_array_elements(d.lines) loop
      ln := ln + 1;
      cost := (l->>'amount')::numeric;
      a := (l->>'account_id')::uuid;
      insert into public.accounting_journal_lines(organization_id, journal_id, line_number, account_id, debit, credit, description)
      values(d.organization_id, j, ln, a, cost, 0, coalesce(l->>'description', 'Beban pembelian'));
    end loop;

    if d.vat_amount > 0 and vat is not null and d.vat_creditable then
      ln := ln + 1;
      insert into public.accounting_journal_lines(organization_id, journal_id, line_number, account_id, debit, credit, description)
      values(d.organization_id, j, ln, vat, d.vat_amount, 0, 'PPN Masukan invoice ' || d.invoice_number);
    end if;

    if d.withholding_amount > 0 and wh is not null then
      ln := ln + 1;
      insert into public.accounting_journal_lines(organization_id, journal_id, line_number, account_id, debit, credit, description)
      values(d.organization_id, j, ln, wh, 0, d.withholding_amount, 'Utang PPh ' || coalesce(d.withholding_code, '') || ' invoice ' || d.invoice_number);
    end if;

    ln := ln + 1;
    insert into public.accounting_journal_lines(organization_id, journal_id, line_number, account_id, debit, credit, description)
    values(d.organization_id, j, ln, ap, 0, d.payable_amount, 'Utang usaha vendor invoice ' || d.invoice_number);

    nextstatus := 'payment_ready';
  end if;

  update public.purchase_requests
  set status = nextstatus,
      return_to_stage = v_return_stage,
      review_note = nullif(btrim(p_note), ''),
      journal_id = coalesce(j, journal_id),
      version = version + 1
  where id = d.id;

  perform gsp_private.procurement_log(
    d.organization_id, d.branch_id, d.id, 'purchase',
    case when not p_approve then 'rejected' when nextstatus = 'payment_ready' then 'accounting_approved' else 'approved' end,
    p_note,
    jsonb_build_object('from', d.status, 'to', nextstatus, 'return_to_stage', v_return_stage, 'journal_id', j)
  );
end;
$$;
