-- ============================================================================
-- Migration: 20261110040000_security_and_workflow_audit_fixes.sql
-- Tujuan (Khusus Perbaikan Hasil Audit - Dijalankan Setelah Migrasi 20261109 & 2026111000-03):
-- 1. [P0 Keamanan] Perbarui kata sandi demo@gsp.test ke kata sandi kuat (bebas peringatan HIBP)
--    serta kunci akun Demo/Auditor di level Database (RLS Restrictive & Guard RPC).
-- 2. [P0 Keamanan] Perketat RLS tabel sales_invoices berdasarkan cabang & jabatan.
-- 3. [P1 Bug Fix] Perbaiki gsp_private.api_decide_spk (can_review_spk, generate_document_number,
--    project_access_scopes, dan wariskan lampiran SPH + SPK ke crm_projects).
-- 4. [P1 Bug Fix] Perbaiki gsp_private.api_review_purchase_request (hapus pemanggilan langsung
--    fungsi trigger calculate_purchase, pastikan jurnal utang ter-posting 'posted', dan
--    tautkan project_id ke accounting_journal_lines).
-- 5. [P1 Bug Fix] Satukan fungsi pay_purchase_request (hapus duplikasi signature 6 parameter).
-- 6. [P2 Alur Proyek & RAB] Kembalikan penyimpanan payment_terms di api_save_project_planning,
--    wajibkan proyek berstatus 'active' sebelum transaksi Pembelian/SPPD/Invoice, dan catat
--    peringatan over-budget jika melampaui Pagu RAB.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. PEMBARUAN PASSWORD KUAT AKUN DEMO & FUNGSI GUARD READ-ONLY DATABASE
-- ============================================================================
do $$
declare
  v_demo_id uuid;
  v_strong_pw text := 'GspPreview!2026#ReadOnly';
begin
  select id into v_demo_id from auth.users where email = 'demo@gsp.test' limit 1;
  if v_demo_id is not null then
    update auth.users
    set encrypted_password = crypt(v_strong_pw, gen_salt('bf')),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"is_demo":true}'::jsonb,
        updated_at = now()
    where id = v_demo_id;
  end if;
end $$;

create or replace function gsp_private.is_demo_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (
          lower(u.email) in ('demo@gsp.test', 'tamu@gsp.test', 'guest@gsp.test')
          or lower(u.email) like 'demo@%'
          or lower(u.email) like '%.demo'
          or coalesce((u.raw_user_meta_data->>'is_demo')::boolean, false) = true
        )
    )
    or exists (
      select 1 from public.organization_members m
      where m.user_id = auth.uid()
        and m.role = 'auditor'
    ),
    false
  );
$$;

create or replace function gsp_private.assert_writable()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if gsp_private.is_demo_user() then
    raise exception 'Mode Pratinjau / Akun Demo (Hanya Lihat): Perubahan data dikunci di tingkat database.' using errcode = '42501';
  end if;
end;
$$;

-- Pasang Restrictive RLS Policy untuk memblokir INSERT / UPDATE / DELETE oleh akun Demo / Auditor
do $$
declare
  v_tbl text;
  v_tables text[] := array[
    'purchase_requests',
    'sales_documents',
    'sales_clients',
    'procurement_vendors',
    'crm_projects',
    'sales_invoices',
    'cash_advances',
    'accounting_journals',
    'accounting_journal_lines',
    'procurement_attachments'
  ];
begin
  foreach v_tbl in array v_tables loop
    if to_regclass('public.' || v_tbl) is not null then
      execute format('drop policy if exists %I on public.%I', v_tbl || '_block_demo_insert', v_tbl);
      execute format(
        'create policy %I on public.%I as restrictive for insert to authenticated with check (not gsp_private.is_demo_user())',
        v_tbl || '_block_demo_insert', v_tbl
      );

      execute format('drop policy if exists %I on public.%I', v_tbl || '_block_demo_update', v_tbl);
      execute format(
        'create policy %I on public.%I as restrictive for update to authenticated using (not gsp_private.is_demo_user()) with check (not gsp_private.is_demo_user())',
        v_tbl || '_block_demo_update', v_tbl
      );

      execute format('drop policy if exists %I on public.%I', v_tbl || '_block_demo_delete', v_tbl);
      execute format(
        'create policy %I on public.%I as restrictive for delete to authenticated using (not gsp_private.is_demo_user())',
        v_tbl || '_block_demo_delete', v_tbl
      );
    end if;
  end loop;
end $$;

-- ============================================================================
-- 2. PERKETAT RLS TABEL sales_invoices (ISOLASI CABANG & JABATAN)
-- ============================================================================
drop policy if exists sales_invoices_select on public.sales_invoices;
create policy sales_invoices_select on public.sales_invoices
  for select to authenticated
  using (
    gsp_private.is_superadmin(organization_id)
    or gsp_private.has_job(organization_id, null, array['president', 'finance_director', 'technical_director', 'finance', 'accounting_tax'])
    or gsp_private.can_access_business(organization_id, branch_id, 'sales')
    or gsp_private.can_access_business(organization_id, branch_id, 'operations')
    or exists (
      select 1 from public.organization_members m
      where m.organization_id = sales_invoices.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'director', 'finance', 'auditor')
    )
  );

drop policy if exists sales_invoices_insert on public.sales_invoices;
create policy sales_invoices_insert on public.sales_invoices
  for insert to authenticated
  with check (
    not gsp_private.is_demo_user()
    and (
      gsp_private.is_superadmin(organization_id)
      or gsp_private.has_job(organization_id, null, array['president', 'finance_director', 'finance', 'accounting_tax'])
      or gsp_private.can_access_business(organization_id, branch_id, 'sales')
    )
  );

drop policy if exists sales_invoices_update on public.sales_invoices;
create policy sales_invoices_update on public.sales_invoices
  for update to authenticated
  using (
    not gsp_private.is_demo_user()
    and (
      gsp_private.is_superadmin(organization_id)
      or gsp_private.has_job(organization_id, null, array['president', 'finance_director', 'finance', 'accounting_tax'])
      or gsp_private.can_access_business(organization_id, branch_id, 'sales')
    )
  );

-- ============================================================================
-- 3. PERBAIKI gsp_private.api_decide_spk (PEMBENTUKAN PROYEK DARI SPK)
-- ============================================================================
create or replace function gsp_private.api_decide_spk(
  p_id uuid,
  p_version integer,
  p_decision text,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.sales_documents;
  sph public.sales_documents;
  v_next_status text;
  v_proj_id uuid;
  v_proj_code text;
  v_amount numeric(15,2);
  b public.business_units;
  c public.sales_clients;
  v_attachments uuid[];
begin
  perform gsp_private.assert_writable();

  select * into d from public.sales_documents where id = p_id for update;
  if d.id is null or d.kind <> 'spk' or not gsp_private.can_review_spk(d) then
    raise exception 'Bukan tahap pemeriksaan SPK Anda atau akses validasi ditolak.' using errcode = '42501';
  end if;
  if d.version is distinct from p_version then
    raise exception 'Versi SPK telah berubah. Muat ulang halaman dan periksa kembali.';
  end if;
  if d.status <> 'director_review' then
    raise exception 'Hanya SPK berstatus director_review yang dapat diputuskan.';
  end if;
  if p_decision is null or p_decision not in ('approve', 'revise', 'reject') then
    raise exception 'Pilih Setujui, Revisi atau Tolak.';
  end if;
  if p_decision in ('revise', 'reject') and nullif(btrim(p_note), '') is null then
    raise exception 'Alasan revisi atau penolakan wajib diisi.';
  end if;

  if p_decision = 'approve' then
    v_next_status := 'ready';
    v_amount := coalesce(d.amount, 0);

    select * into b from public.business_units where id = d.branch_id;
    select * into c from public.sales_clients where id = d.client_id;
    if d.accepted_sph_id is not null then
      select * into sph from public.sales_documents where id = d.accepted_sph_id;
    end if;

    -- Gabungkan lampiran SPK dan SPH secara unik
    select coalesce(array_agg(distinct x), '{}') into v_attachments
    from unnest(coalesce(d.attachment_ids, '{}') || coalesce(sph.attachment_ids, '{}')) as x;

    -- Jika SPK sebelumnya sudah punya project_id, gunakan yang ada; jika belum, buat baru
    if d.project_id is not null and exists (select 1 from public.crm_projects where id = d.project_id) then
      v_proj_id := d.project_id;
      select code into v_proj_code from public.crm_projects where id = v_proj_id;
    else
      v_proj_code := gsp_private.generate_document_number(
        d.organization_id, 'prj', current_date, c.name, b.code, null
      );

      insert into public.crm_projects(
        organization_id, code, name, status, starts_on, created_by,
        client_id, spk_id, branch_id, contract_amount, approval_status, work_details,
        attachment_ids
      ) values (
        d.organization_id, v_proj_code, d.title, 'planned', current_date, auth.uid(),
        d.client_id, d.id, d.branch_id, v_amount, 'draft',
        coalesce(nullif(btrim(d.notes), ''), 'Diterbitkan dari SPK ' || coalesce(d.document_number, 'SPK') || ' atas SPH No. ' || coalesce(sph.document_number, d.sph_number::text, '-')),
        v_attachments
      ) returning id into v_proj_id;
    end if;

    insert into public.project_access_scopes(
      organization_id, project_id, branch_id
    ) values (
      d.organization_id, v_proj_id, d.branch_id
    ) on conflict do nothing;

    update public.sales_documents
    set status = v_next_status,
        project_id = v_proj_id,
        return_to_stage = null,
        review_note = nullif(btrim(p_note), ''),
        version = version + 1
    where id = d.id;

    perform gsp_private.procurement_log(
      d.organization_id, d.branch_id, d.id, 'spk', 'approved', p_note,
      jsonb_build_object(
        'project_id', v_proj_id,
        'project_code', v_proj_code,
        'status', v_next_status,
        'notified_roles', array['Admin Cabang', 'Manager Cabang'],
        'branch_name', coalesce(b.name, 'Cabang')
      )
    );

    perform gsp_private.procurement_log(
      d.organization_id, d.branch_id, v_proj_id, 'project', 'project_created_from_spk',
      coalesce(nullif(btrim(p_note), ''), 'SPK disetujui Direktur Utama. Menunggu kelengkapan dokumen & RAB dari Admin Cabang dan Manager Cabang ' || coalesce(b.name, '')),
      jsonb_build_object(
        'spk_id', d.id,
        'spk_number', d.document_number,
        'project_code', v_proj_code,
        'status', 'draft',
        'assigned_to_roles', array['Admin Cabang', 'Manager Cabang'],
        'branch_name', coalesce(b.name, 'Cabang')
      )
    );

    return v_proj_id;

  elsif p_decision = 'revise' then
    v_next_status := 'revision_requested';

    update public.sales_documents
    set status = v_next_status,
        return_to_stage = 'director_review',
        review_note = btrim(p_note),
        version = version + 1
    where id = d.id;

    perform gsp_private.procurement_log(
      d.organization_id, d.branch_id, d.id, 'spk', 'revision_requested', p_note,
      jsonb_build_object('status', v_next_status, 'return_to_stage', 'director_review')
    );
    return null;

  else
    v_next_status := 'rejected';

    update public.sales_documents
    set status = v_next_status,
        return_to_stage = null,
        review_note = btrim(p_note),
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

-- ============================================================================
-- 4. PERBAIKI gsp_private.api_review_purchase_request & pay_purchase_request
-- ============================================================================
create or replace function gsp_private.api_review_purchase_request(
  p_id uuid,
  p_version integer,
  p_approve boolean,
  p_note text,
  p_accounting jsonb default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
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
  p_start date;
  p_end date;
  v_return_stage text := null;
  v_jrn_num text;
begin
  perform gsp_private.assert_writable();

  select * into d from public.purchase_requests where id = p_id for update;
  before_doc := to_jsonb(d);

  if d.id is null or not gsp_private.can_review_purchase(d) or d.status = 'payment_ready' then
    raise exception 'Bukan tahap pemeriksaan Anda.' using errcode = '42501';
  end if;

  if d.version <> p_version then
    raise exception 'Versi pengajuan berubah. Muat ulang halaman.';
  end if;

  if p_approve is null or (not p_approve and nullif(btrim(p_note), '') is null) then
    raise exception 'Keputusan dan alasan penolakan wajib diisi.';
  end if;

  if not p_approve then
    nextstatus := 'rejected';
    v_return_stage := d.status;
  elsif d.status = 'branch_review' then
    nextstatus := 'director_review';
  elsif d.status = 'director_review' then
    nextstatus := 'accounting_review';
  else
    -- Tahap Pemeriksaan Accounting & Tax
    if p_accounting is null or (p_accounting->>'coa_confirmed')::boolean is distinct from true then
      raise exception 'Accounting wajib memeriksa COA dan pajak.';
    end if;

    if p_accounting ? 'lines' and (
      (select jsonb_agg(value - 'account_id' order by ord) from jsonb_array_elements(p_accounting->'lines') with ordinality x(value, ord))
      is distinct from (select jsonb_agg(value - 'account_id' order by ord) from jsonb_array_elements(d.lines) with ordinality x(value, ord))
    ) then
      raise exception 'Accounting hanya boleh mengoreksi COA; perubahan rincian/nominal perlu pengajuan baru.';
    end if;

    entity := (p_accounting->>'entity_id')::uuid;
    period := (p_accounting->>'period_id')::uuid;
    ap := (p_accounting->>'payable_account_id')::uuid;
    vat := nullif(p_accounting->>'vat_account_id', '')::uuid;
    wh := nullif(p_accounting->>'withholding_account_id', '')::uuid;

    if not exists(
      select 1 from public.business_units
      where id = d.branch_id and organization_id = d.organization_id and entity_id = entity
    ) then
      raise exception 'Super Admin perlu memetakan cabang ke entitas akuntansi terlebih dahulu.';
    end if;

    select starts_on, ends_on into p_start, p_end
    from public.accounting_periods
    where id = period
      and organization_id = d.organization_id
      and entity_id = entity
      and period_status = 'open';

    if p_start is null then
      raise exception 'Pilih periode akuntansi terbuka.';
    end if;

    if d.invoice_date between p_start and p_end then
      target_journal_date := d.invoice_date;
    elsif current_date between p_start and p_end then
      target_journal_date := current_date;
    else
      target_journal_date := p_start;
    end if;

    if not exists(
      select 1 from public.finance_accounts
      where id = ap and organization_id = d.organization_id and is_active and is_postable and account_type = 'liability'
    ) then
      raise exception 'Akun utang usaha harus akun liabilitas aktif.';
    end if;

    -- Update purchase_requests (otomatis memicu BEFORE UPDATE trigger calculate_purchase)
    update public.purchase_requests
    set lines = coalesce(p_accounting->'lines', lines),
        tax_invoice_number = coalesce(nullif(btrim(p_accounting->>'tax_invoice_number'), ''), tax_invoice_number),
        tax_invoice_date = coalesce(nullif(p_accounting->>'tax_invoice_date', '')::date, tax_invoice_date),
        vat_mode = coalesce(p_accounting->>'vat_mode', vat_mode),
        vat_creditable = coalesce((p_accounting->>'vat_creditable')::boolean, vat_creditable),
        withholding_code = coalesce(p_accounting->>'withholding_code', withholding_code),
        withholding_rate = coalesce((p_accounting->>'withholding_rate')::numeric, withholding_rate),
        withholding_base = coalesce((p_accounting->>'withholding_base')::numeric, withholding_base),
        withholding_timing = coalesce(p_accounting->>'withholding_timing', withholding_timing),
        coa_confirmed = true,
        payable_account_id = ap,
        vat_account_id = vat,
        withholding_account_id = wh
    where id = d.id
    returning * into d;

    if d.vat_creditable and d.vat_amount > 0 and not exists(
      select 1 from public.finance_accounts
      where id = vat and organization_id = d.organization_id and is_active and is_postable and account_type = 'asset'
    ) then
      raise exception 'Akun PPN masukan belum sesuai pajak yang dikoreksi.';
    end if;

    if d.withholding_amount > 0 and not exists(
      select 1 from public.finance_accounts
      where id = wh and organization_id = d.organization_id and is_active and is_postable and account_type = 'liability' and id <> ap
    ) then
      raise exception 'Akun utang PPh belum sesuai pajak yang dikoreksi.';
    end if;

    v_jrn_num := gsp_private.generate_document_number(d.organization_id, 'ju', target_journal_date, null, null, null);

    insert into public.accounting_journals(
      organization_id, entity_id, period_id, journal_number, journal_date,
      source_type, source_id, description, created_by
    ) values (
      d.organization_id, entity, period, v_jrn_num, target_journal_date,
      'payable', d.id, 'Pengakuan utang pembelian invoice ' || d.invoice_number, auth.uid()
    ) returning id into j;

    for l in select value from jsonb_array_elements(d.lines) loop
      ln := ln + 1;
      amt := (l->>'amount')::numeric;
      cost := amt + case when not d.vat_creditable then round(amt * case d.vat_mode when 'non_luxury' then 0.11 when 'luxury' then 0.12 else 0 end, 2) else 0 end;

      if ln = jsonb_array_length(d.lines) and not d.vat_creditable then
        select d.total - coalesce(sum(debit), 0) into cost from public.accounting_journal_lines where journal_id = j;
      end if;

      insert into public.accounting_journal_lines(
        organization_id, journal_id, line_number, account_id, description,
        debit, counterparty_type, counterparty_id, reference_number, project_id
      ) values (
        d.organization_id, j, ln, (l->>'account_id')::uuid, coalesce(l->>'description', 'Beban pembelian'),
        cost, 'vendor', d.vendor_id, d.invoice_number, d.project_id
      );
    end loop;

    if d.vat_creditable and d.vat_amount > 0 then
      ln := ln + 1;
      insert into public.accounting_journal_lines(
        organization_id, journal_id, line_number, account_id, description, debit, project_id
      ) values (
        d.organization_id, j, ln, vat, 'PPN Masukan invoice ' || d.invoice_number, d.vat_amount, d.project_id
      );
    end if;

    if d.withholding_timing = 'invoice' and d.withholding_amount > 0 then
      ln := ln + 1;
      insert into public.accounting_journal_lines(
        organization_id, journal_id, line_number, account_id, description,
        credit, tax_code, tax_amount, project_id
      ) values (
        d.organization_id, j, ln, wh, 'PPh dipotong saat pengakuan invoice ' || d.invoice_number,
        d.withholding_amount, d.withholding_code, d.withholding_amount, d.project_id
      );
    end if;

    ln := ln + 1;
    insert into public.accounting_journal_lines(
      organization_id, journal_id, line_number, account_id, description,
      credit, counterparty_type, counterparty_id, reference_number, project_id
    ) values (
      d.organization_id, j, ln, ap, 'Utang usaha vendor invoice ' || d.invoice_number,
      case when d.withholding_timing = 'invoice' then d.payable_amount else d.total end,
      'vendor', d.vendor_id, d.invoice_number, d.project_id
    );

    perform public.validate_accounting_journal(j);
    update public.accounting_journals set status = 'posted', posted_by = auth.uid(), posted_at = now() where id = j;
    nextstatus := 'payment_ready';
  end if;

  update public.purchase_requests
  set status = nextstatus,
      return_to_stage = v_return_stage,
      review_note = nullif(btrim(p_note), ''),
      journal_id = coalesce(j, journal_id),
      version = version + 1
  where id = d.id
  returning * into d;

  perform gsp_private.procurement_log(
    d.organization_id,
    d.branch_id,
    d.id,
    'purchase',
    case when not p_approve then 'rejected' when nextstatus = 'payment_ready' then 'accounting_approved' else 'approved' end,
    p_note,
    jsonb_build_object(
      'from', before_doc->>'status',
      'to', nextstatus,
      'return_to_stage', v_return_stage,
      'journal_id', j,
      'project_id', d.project_id
    )
  );
end;
$$;

-- Hapus fungsi overload 6 argumen agar tidak bentrok dengan 7 argumen (p_attachments default '{}')
drop function if exists public.pay_purchase_request(uuid, integer, date, text, uuid, uuid);

create or replace function gsp_private.api_pay_purchase_request(
  p_id uuid,
  p_version integer,
  p_payment_date date,
  p_reference text,
  p_bank_account_id uuid,
  p_period_id uuid,
  p_attachments uuid[] default '{}'
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.purchase_requests;
  j uuid;
  entity uuid;
  n integer := 2;
  attach_list uuid[];
  bad integer := 0;
  v_acc_name text;
  v_doc_type text;
  v_journal_number text;
begin
  perform gsp_private.assert_writable();

  select * into d from public.purchase_requests where id = p_id for update;

  if d.id is null or not gsp_private.can_review_purchase(d) or d.status <> 'payment_ready' then
    raise exception 'Pengajuan belum siap dibayar atau akses Finance ditolak.' using errcode = '42501';
  end if;

  if d.version <> p_version or d.payment_journal_id is not null then
    raise exception 'Versi berubah atau pembayaran sudah dicatat.';
  end if;

  if d.journal_id is null or not exists(
    select 1 from public.accounting_journals
    where id = d.journal_id and source_id = d.id and source_type = 'payable' and status = 'posted'
  ) then
    raise exception 'Jurnal utang belum diposting atau sudah dikoreksi.';
  end if;

  if nullif(btrim(p_reference), '') is null or p_payment_date is null then
    raise exception 'Tanggal dan bukti/referensi pembayaran wajib diisi.';
  end if;

  if p_payment_date < d.invoice_date then
    raise exception 'Tanggal pembayaran tidak boleh mendahului invoice; gunakan alur uang muka untuk pembayaran di muka.';
  end if;

  select entity_id into entity from public.business_units where id = d.branch_id;

  if not exists(
    select 1 from public.accounting_periods
    where id = p_period_id and organization_id = d.organization_id and entity_id = entity and period_status = 'open'
  ) then
    raise exception 'Periode pembayaran tidak sesuai cabang dan berstatus terbuka.';
  end if;

  select name into v_acc_name
  from public.finance_accounts
  where id = p_bank_account_id and organization_id = d.organization_id and is_active and is_postable and account_type = 'asset' and id <> d.payable_account_id;

  if v_acc_name is null then
    raise exception 'Akun kas/bank tidak valid.';
  end if;

  attach_list := coalesce(p_attachments, '{}');
  if cardinality(attach_list) > 0 then
    if cardinality(attach_list) > 10 then
      raise exception 'Maksimal 10 dokumen bukti pelunasan.';
    end if;
    select count(*) into bad
    from unnest(attach_list) x
    where not exists (
      select 1 from public.procurement_attachments a
      where a.id = x and a.organization_id = d.organization_id and a.branch_id = d.branch_id and a.domain in ('procurement', 'sales')
    );
    if bad > 0 then
      raise exception 'Dokumen lampiran bukti pelunasan tidak sesuai cabang.';
    end if;
  end if;

  v_doc_type := case when lower(v_acc_name) like '%kas%' then 'cash' else 'bank' end;
  v_journal_number := gsp_private.generate_document_number(d.organization_id, v_doc_type, p_payment_date, null, null, null);

  insert into public.accounting_journals(
    organization_id, entity_id, period_id, journal_number, journal_date,
    source_type, source_id, description, created_by
  ) values (
    d.organization_id, entity, p_period_id, v_journal_number, p_payment_date,
    'payment', d.id, 'Pembayaran invoice ' || d.invoice_number, auth.uid()
  ) returning id into j;

  insert into public.accounting_journal_lines(
    organization_id, journal_id, line_number, account_id, description,
    debit, counterparty_type, counterparty_id, reference_number, project_id
  ) values (
    d.organization_id, j, 1, d.payable_account_id, 'Pelunasan utang usaha',
    case when d.withholding_timing = 'invoice' then d.payable_amount else d.total end,
    'vendor', d.vendor_id, p_reference, d.project_id
  );

  if d.payable_amount > 0 then
    insert into public.accounting_journal_lines(
      organization_id, journal_id, line_number, account_id, description,
      credit, reference_number, project_id
    ) values (
      d.organization_id, j, 2, p_bank_account_id, 'Kas/bank dibayarkan',
      d.payable_amount, p_reference, d.project_id
    );
  end if;

  if d.withholding_amount > 0 and d.withholding_timing = 'payment' then
    n := case when d.payable_amount > 0 then 3 else 2 end;
    insert into public.accounting_journal_lines(
      organization_id, journal_id, line_number, account_id, description,
      credit, tax_code, tax_amount, project_id
    ) values (
      d.organization_id, j, n, d.withholding_account_id, 'PPh dipotong saat pembayaran',
      d.withholding_amount, d.withholding_code, d.withholding_amount, d.project_id
    );
  end if;

  perform public.validate_accounting_journal(j);
  update public.accounting_journals set status = 'posted', posted_by = auth.uid(), posted_at = now() where id = j;

  update public.purchase_requests
  set status = 'paid',
      payment_journal_id = j,
      paid_on = p_payment_date,
      payment_reference = p_reference,
      payment_attachment_ids = attach_list,
      version = version + 1
  where id = d.id;

  perform gsp_private.procurement_log(
    d.organization_id,
    d.branch_id,
    d.id,
    'purchase',
    'paid',
    p_reference,
    jsonb_build_object(
      'journal_id', j,
      'journal_number', v_journal_number,
      'date', p_payment_date,
      'attachments', attach_list,
      'project_id', d.project_id
    )
  );
end;
$$;

create or replace function public.pay_purchase_request(
  p_id uuid,
  p_version integer,
  p_payment_date date,
  p_reference text,
  p_bank_account_id uuid,
  p_period_id uuid,
  p_attachments uuid[] default '{}'
) returns void
language sql
security invoker
set search_path = ''
as $$
  select gsp_private.api_pay_purchase_request(p_id, p_version, p_payment_date, p_reference, p_bank_account_id, p_period_id, p_attachments);
$$;

grant execute on function public.pay_purchase_request(uuid, integer, date, text, uuid, uuid, uuid[]) to authenticated;

-- ============================================================================
-- 5. KONTROL PROYEK AKTIF & PAGU RAB PADA PEMBELIAN, SPPD, DAN PERENCANAAN PROYEK
-- ============================================================================

-- 5a. Simpan Perencanaan Proyek (Sertakan payment_terms secara utuh)
create or replace function gsp_private.api_save_project_planning(
  p_id uuid,
  p_version integer,
  p_payload jsonb,
  p_submit boolean default false
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.crm_projects;
  v_rab_total numeric(15,2) := 0;
  v_attachments uuid[];
  v_next_status text;
  v_item jsonb;
  v_work_details text;
  v_manpower jsonb;
begin
  perform gsp_private.assert_writable();

  select * into p from public.crm_projects where id = p_id for update;
  if p.id is null or not gsp_private.can_edit_project_planning(p) then
    raise exception 'Akses perancangan proyek ditolak atau status proyek sudah terkunci.' using errcode = '42501';
  end if;
  if p.version is distinct from p_version then
    raise exception 'Versi proyek telah berubah. Muat ulang halaman dan periksa kembali.';
  end if;

  v_rab_total := coalesce((p_payload->>'rab_total')::numeric, 0);
  if v_rab_total <= 0 and p_payload ? 'rab_breakdown' and jsonb_typeof(p_payload->'rab_breakdown') = 'array' then
    for v_item in select * from jsonb_array_elements(p_payload->'rab_breakdown') loop
      v_rab_total := v_rab_total + coalesce((v_item->>'total')::numeric, 0);
    end loop;
  end if;

  select coalesce(array_agg(value::uuid), '{}') into v_attachments
  from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids', '[]'));

  v_work_details := coalesce(nullif(btrim(p_payload->>'work_details'), ''), p.work_details, 'Rincian teknis pekerjaan mengikuti SPK dan dokumen lampiran RAB.');
  v_manpower := coalesce(p_payload->'manpower', p.manpower, '[{"name": "Team Pelaksana Cabang", "role": "Pelaksana Lapangan"}]'::jsonb);
  if jsonb_array_length(v_manpower) = 0 then
    v_manpower := '[{"name": "Team Pelaksana Cabang", "role": "Pelaksana Lapangan"}]'::jsonb;
  end if;

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
      payment_terms = case
        when p_payload ? 'payment_terms' and jsonb_typeof(p_payload->'payment_terms') = 'array' and jsonb_array_length(p_payload->'payment_terms') > 0
        then p_payload->'payment_terms'
        else payment_terms
      end,
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

-- 5b. Simpan & Submit Pembelian: Validasi Proyek Aktif & Peringatan Over-Budget RAB
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
  v_proj public.crm_projects;
  newid uuid;
  attachments uuid[];
  bad integer;
  v_project_id uuid;
begin
  perform gsp_private.assert_writable();

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

  v_project_id := nullif(p_payload->>'project_id', '')::uuid;
  if v_project_id is not null then
    select * into v_proj from public.crm_projects where id = v_project_id and organization_id = p_org;
    if v_proj.id is null then
      raise exception 'Proyek rujukan tidak ditemukan.';
    end if;
    if v_proj.approval_status <> 'active' and v_proj.status <> 'active' then
      raise exception 'Proyek "%" belum berstatus Aktif (ACC Direktur Utama). Pengajuan pembelian hanya dapat ditautkan ke Proyek Aktif.', v_proj.name;
    end if;
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
    project_id = excluded.project_id,
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

create or replace function public.submit_purchase_request(p_id uuid, p_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.purchase_requests;
  v_proj public.crm_projects;
  v_costing jsonb;
  v_realized numeric(15,2) := 0;
  v_over_budget boolean := false;
  nextstatus text;
  v_bypassed boolean := false;
  v_target_return text;
begin
  perform gsp_private.assert_writable();

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

  if d.project_id is not null then
    select * into v_proj from public.crm_projects where id = d.project_id and organization_id = d.organization_id;
    if v_proj.id is null or (v_proj.approval_status <> 'active' and v_proj.status <> 'active') then
      raise exception 'Proyek rujukan belum berstatus Aktif (ACC Direktur Utama).';
    end if;
    if coalesce(v_proj.rab_total, 0) > 0 then
      v_costing := public.get_project_costing(d.organization_id, d.project_id);
      v_realized := coalesce((v_costing->>'total_realized')::numeric, 0);
      if (v_realized + coalesce(d.total, 0)) > v_proj.rab_total then
        v_over_budget := true;
      end if;
    end if;
  end if;

  v_target_return := d.return_to_stage;

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
    case
      when v_over_budget then '[PERINGATAN OVER-BUDGET RAB] Nilai pengajuan ini membuat total realisasi biaya proyek melampaui Pagu RAB.'
      when v_bypassed then 'Perbaikan pengajuan pembelian diajukan langsung kembali ke Direktur Keuangan (melewati Manager Cabang).'
      else null
    end,
    jsonb_build_object(
      'next', nextstatus,
      'bypassed_branch_manager', v_bypassed,
      'project_id', d.project_id,
      'over_budget_warning', v_over_budget
    )
  );
end;
$$;

-- 5c. Kasbon SPPD Proyek: Validasi Hak Akses Cabang & Proyek Aktif
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
  v_costing jsonb;
  v_over_budget boolean := false;
begin
  perform gsp_private.assert_writable();

  if not (
    gsp_private.is_superadmin(p_org)
    or gsp_private.can_access_business(p_org, p_branch, 'procurement')
    or gsp_private.can_access_business(p_org, p_branch, 'operations')
    or gsp_private.can_access_business(p_org, p_branch, 'sales')
  ) then
    raise exception 'Akses pengajuan SPPD pada cabang ini ditolak.' using errcode = '42501';
  end if;

  select * into v_b from public.business_units where id = p_branch and organization_id = p_org;
  if v_b.id is null then raise exception 'Cabang tidak valid.'; end if;

  if p_payload ? 'project_id' and nullif(p_payload->>'project_id', '') is not null then
    select * into v_proj from public.crm_projects where id = (p_payload->>'project_id')::uuid and organization_id = p_org;
    if v_proj.id is null then raise exception 'Proyek tidak ditemukan.'; end if;
    if v_proj.approval_status <> 'active' and v_proj.status <> 'active' then
      raise exception 'Proyek "%" belum berstatus Aktif (ACC Direktur Utama). Kasbon SPPD hanya dapat diajukan untuk Proyek Aktif.', v_proj.name;
    end if;
  end if;

  v_amt := coalesce((p_payload->>'amount')::numeric, 0);
  if v_amt <= 0 then raise exception 'Nominal kasbon SPPD harus lebih dari 0.'; end if;

  if v_proj.id is not null and coalesce(v_proj.rab_total, 0) > 0 then
    v_costing := public.get_project_costing(p_org, v_proj.id);
    if (coalesce((v_costing->>'total_realized')::numeric, 0) + v_amt) > v_proj.rab_total then
      v_over_budget := true;
    end if;
  end if;

  v_needed := coalesce(nullif(p_payload->>'needed_on', '')::date, current_date);
  v_dest := coalesce(nullif(btrim(p_payload->>'trip_destination'), ''), 'Lokasi Proyek');
  v_desc := coalesce(nullif(btrim(p_payload->>'description'), ''), 'Kasbon SPPD Proyek ' || coalesce(v_proj.name, ''));

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
    case when v_over_budget then '[PERINGATAN OVER-BUDGET RAB] ' || v_desc else v_desc end,
    jsonb_build_object(
      'sppd_number', v_sppd_num,
      'advance_number', v_kb_num,
      'amount', v_amt,
      'project_id', v_proj.id,
      'over_budget_warning', v_over_budget
    )
  );

  return v_id;
end;
$$;
grant execute on function public.save_project_sppd_advance(uuid, uuid, jsonb) to authenticated;

-- ============================================================================
-- 6. PERKUAT VALIDASI PENAGIHAN (create_sales_invoice & record_sales_payment)
-- ============================================================================
create or replace function public.create_sales_invoice(
  p_org uuid,
  p_project_id uuid,
  p_term_index integer,
  p_term_name text,
  p_percentage numeric,
  p_amount numeric,
  p_due_date date,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proj public.crm_projects;
  v_client public.sales_clients;
  v_branch public.business_units;
  v_inv_num text;
  v_inv_id uuid;
  v_vat numeric(15,2);
  v_wht numeric(15,2);
  v_total numeric(15,2);
  v_net numeric(15,2);
  v_invoiced_sum numeric(15,2);
begin
  perform gsp_private.assert_writable();

  select * into v_proj from public.crm_projects where id = p_project_id and organization_id = p_org for update;
  if v_proj.id is null then raise exception 'Proyek tidak ditemukan.'; end if;

  if not (
    gsp_private.is_superadmin(p_org)
    or gsp_private.has_job(p_org, null, array['president', 'finance_director', 'finance', 'accounting_tax'])
    or gsp_private.can_access_business(p_org, v_proj.branch_id, 'sales')
  ) then
    raise exception 'Role Anda tidak memiliki kewenangan menerbitkan invoice penagihan.' using errcode = '42501';
  end if;

  if v_proj.approval_status <> 'active' and v_proj.status <> 'active' then
    raise exception 'Invoice hanya dapat diterbitkan untuk Proyek yang sudah Aktif (ACC Direktur Utama).';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Nominal DPP invoice harus lebih dari 0.';
  end if;

  if coalesce(v_proj.contract_amount, 0) > 0 then
    select coalesce(sum(amount), 0) into v_invoiced_sum
    from public.sales_invoices
    where organization_id = p_org and project_id = p_project_id and status <> 'cancelled';

    if (v_invoiced_sum + p_amount) > (v_proj.contract_amount + 1) then
      raise exception 'Total tagihan (Rp %) melebihi Nilai Kontrak SPK (Rp %).', (v_invoiced_sum + p_amount), v_proj.contract_amount;
    end if;
  end if;

  select * into v_client from public.sales_clients where id = v_proj.client_id;
  select * into v_branch from public.business_units where id = v_proj.branch_id;

  v_inv_num := gsp_private.generate_document_number(
    p_org, 'inv', current_date, v_client.name, v_branch.code, null
  );

  v_vat := round((p_amount * 0.11), 2);
  v_wht := round((p_amount * 0.02), 2);
  v_total := p_amount + v_vat;
  v_net := v_total - v_wht;

  insert into public.sales_invoices(
    organization_id, branch_id, project_id, spk_id, client_id,
    invoice_number, term_name, term_index, percentage,
    invoice_date, due_date, amount, vat_rate, vat_amount,
    wht_rate, wht_amount, total_amount, net_receivable,
    status, notes, created_by
  ) values (
    p_org, v_proj.branch_id, v_proj.id, v_proj.spk_id, v_proj.client_id,
    v_inv_num, p_term_name, p_term_index, p_percentage,
    current_date, p_due_date, p_amount, 11.00, v_vat,
    2.00, v_wht, v_total, v_net,
    'unpaid', p_notes, auth.uid()
  ) returning id into v_inv_id;

  begin
    perform gsp_private.post_sales_invoice_journal(v_inv_id);
  exception when others then
    raise notice 'Posting otomatis jurnal invoice ditunda: %', sqlerrm;
  end;

  update public.crm_projects
  set payment_terms = (
    select coalesce(jsonb_agg(
      case when (elem->>'index')::int = p_term_index or (elem->>'name') = p_term_name
      then elem || jsonb_build_object('status', 'invoiced', 'invoice_id', v_inv_id, 'invoice_number', v_inv_num)
      else elem end
    ), '[]'::jsonb)
    from jsonb_array_elements(payment_terms) as elem
  )
  where id = p_project_id;

  perform gsp_private.procurement_log(
    p_org, v_proj.branch_id, v_inv_id, 'sales_invoice', 'invoice_issued',
    v_inv_num, jsonb_build_object('amount', p_amount, 'total', v_total, 'project_id', p_project_id)
  );

  return v_inv_id;
end;
$$;
grant execute on function public.create_sales_invoice(uuid, uuid, integer, text, numeric, numeric, date, text) to authenticated;

create or replace function public.record_sales_payment(
  p_org uuid,
  p_invoice_id uuid,
  p_paid_amount numeric,
  p_paid_at timestamptz,
  p_payment_method text,
  p_bank_name text,
  p_bank_reference text,
  p_wht_proof_number text default null,
  p_notes text default null
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.sales_invoices;
  v_branch public.business_units;
  v_kwt_num text;
begin
  perform gsp_private.assert_writable();

  select * into v_inv from public.sales_invoices where id = p_invoice_id and organization_id = p_org for update;
  if v_inv.id is null then raise exception 'Invoice tidak ditemukan.'; end if;
  if v_inv.status = 'paid' then raise exception 'Invoice ini sudah lunas sebelumnya.'; end if;

  if not (
    gsp_private.is_superadmin(p_org)
    or gsp_private.has_job(p_org, null, array['president', 'finance_director', 'finance', 'accounting_tax'])
    or gsp_private.can_access_business(p_org, v_inv.branch_id, 'sales')
  ) then
    raise exception 'Role Anda tidak memiliki kewenangan memverifikasi pelunasan invoice.' using errcode = '42501';
  end if;

  if coalesce(p_paid_amount, 0) <= 0 then
    raise exception 'Nominal pembayaran yang diterima harus lebih dari 0.';
  end if;

  select * into v_branch from public.business_units where id = v_inv.branch_id;

  v_kwt_num := gsp_private.generate_document_number(
    p_org, 'kwt', current_date, null, v_branch.code, null
  );

  update public.sales_invoices
  set status = 'paid',
      paid_amount = p_paid_amount,
      paid_at = coalesce(p_paid_at, now()),
      payment_method = p_payment_method,
      bank_name = p_bank_name,
      bank_reference = p_bank_reference,
      receipt_number = v_kwt_num,
      wht_proof_number = p_wht_proof_number,
      notes = coalesce(p_notes, notes),
      updated_at = now()
  where id = p_invoice_id;

  begin
    perform gsp_private.post_sales_payment_journal(p_invoice_id);
  exception when others then
    raise notice 'Posting otomatis jurnal pembayaran ditunda: %', sqlerrm;
  end;

  if v_inv.project_id is not null then
    update public.crm_projects
    set payment_terms = (
      select coalesce(jsonb_agg(
        case when (elem->>'index')::int = v_inv.term_index or (elem->>'name') = v_inv.term_name
        then elem || jsonb_build_object('status', 'paid', 'receipt_number', v_kwt_num, 'paid_at', now())
        else elem end
      ), '[]'::jsonb)
      from jsonb_array_elements(payment_terms) as elem
    )
    where id = v_inv.project_id;
  end if;

  perform gsp_private.procurement_log(
    p_org, v_inv.branch_id, v_inv.id, 'sales_invoice', 'payment_recorded',
    v_kwt_num, jsonb_build_object('paid_amount', p_paid_amount, 'receipt_number', v_kwt_num)
  );

  return v_kwt_num;
end;
$$;
grant execute on function public.record_sales_payment(uuid, uuid, numeric, timestamptz, text, text, text, text, text) to authenticated;

-- ============================================================================
-- 7. PASTIKAN PENOMORAN RESMI SPH & SPK (TRIGGER + BACKFILL DATA EXISTING)
-- ============================================================================
create or replace function gsp_private.assign_sph_document_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.sales_clients;
begin
  if new.kind in ('sph', 'spk') and (new.document_number is null or btrim(new.document_number) = '' or new.document_number !~ '/') then
    if new.client_id is not null then
      select * into c from public.sales_clients where id = new.client_id;
    end if;
    new.document_number := gsp_private.generate_document_number(
      new.organization_id,
      new.kind,
      coalesce(new.created_at::date, current_date),
      coalesce(c.name, new.client_snapshot->>'name'),
      null,
      null
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sph_document_number on public.sales_documents;
create trigger trg_sph_document_number
  before insert or update on public.sales_documents
  for each row execute function gsp_private.assign_sph_document_number();

-- Backfill dokumen SPH & SPK yang belum memiliki document_number format resmi
update public.sales_documents d
set document_number = (
  case when d.kind = 'spk' then 'SPK/' else 'SPH/' end
  || gsp_private.sanitize_code_name(coalesce(d.client_snapshot->>'name', (select c.name from public.sales_clients c where c.id = d.client_id), 'KLIEN'))
  || '/GSP/'
  || to_char(coalesce(d.created_at, now()), 'MMYY')
  || '.'
  || lpad(coalesce(d.sph_number, 1)::text, 6, '0')
)
where d.kind in ('sph', 'spk')
  and (d.document_number is null or btrim(d.document_number) = '' or d.document_number !~ '/GSP/');

-- ============================================================================
-- 8. PERKAYA LOG AUDIT & KPI PENUGASAN (DIREKTORI USER, SNAPSHOT ACTOR & SLA)
-- ============================================================================
-- Izinkan anggota internal organisasi membaca direktori nama/email/jabatan rekan seorganisasi untuk Log Audit & KPI
create or replace function public.list_organization_users(p_org uuid)
returns table(
  user_id uuid,
  email text,
  full_name text,
  role text
)
language sql
stable
security definer
set search_path = ''
as $func$
  select 
    m.user_id,
    u.email::text,
    coalesce(nullif(u.raw_user_meta_data->>'full_name',''), nullif(u.raw_user_meta_data->>'name',''), split_part(u.email, '@', 1))::text as full_name,
    m.role::text
  from public.organization_members m
  join auth.users u on u.id = m.user_id
  where m.organization_id = p_org
    and public.is_org_member(p_org)
  order by full_name;
$func$;
grant execute on function public.list_organization_users(uuid) to authenticated;

drop policy if exists own_assignments on public.work_assignments;
create policy own_assignments on public.work_assignments
  for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(organization_id));

-- Perbarui gsp_private.procurement_log agar selalu menyertakan snapshot identitas & jabatan pelaku di details
create or replace function gsp_private.procurement_log(
  p_org uuid,
  p_branch uuid,
  p_id uuid,
  p_type text,
  p_action text,
  p_note text default null,
  p_details jsonb default '{}'
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_name text;
  v_role text;
  v_branch text;
  v_enriched jsonb;
begin
  select
    u.email,
    coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1))
  into v_email, v_name
  from auth.users u
  where u.id = auth.uid();

  select
    string_agg(
      case w.job_role
        when 'president' then 'Direktur Utama'
        when 'finance_director' then 'Direktur Keuangan'
        when 'technical_director' then 'Direktur Teknis'
        when 'branch_manager' then 'Manager Cabang'
        when 'accounting_tax' then 'Accounting & Tax'
        when 'finance' then 'Finance'
        when 'project_manager' then 'Project Manager'
        when 'admin' then 'Admin Cabang'
        else w.job_role
      end,
      ' & '
    ),
    max(coalesce(b.name, 'Pusat'))
  into v_role, v_branch
  from public.work_assignments w
  left join public.business_units b on b.id = w.branch_id
  where w.organization_id = p_org and w.user_id = auth.uid();

  if v_role is null then
    select case when m.role = 'owner' then 'Super Admin' else initcap(m.role) end
    into v_role
    from public.organization_members m
    where m.organization_id = p_org and m.user_id = auth.uid();
  end if;

  v_enriched := coalesce(p_details, '{}'::jsonb) || jsonb_build_object(
    'actor_name', coalesce(v_name, 'Pengguna Internal'),
    'actor_email', coalesce(v_email, ''),
    'actor_role', coalesce(v_role, 'Staf Internal'),
    'actor_branch', coalesce(v_branch, (select name from public.business_units where id = p_branch), 'Pusat')
  );

  insert into public.procurement_events(
    organization_id, branch_id, entity_id, entity_type, action, actor_id, note, details
  ) values (
    p_org, p_branch, p_id, p_type, p_action, auth.uid(), p_note, v_enriched
  );
end;
$$;

-- ============================================================================
-- 16. NOTIFIKASI & REMINDER OTOMATIS KE ADMIN CABANG & MANAGER CABANG SAAT SPK DI-ACC DIRUT
-- ============================================================================
create or replace function gsp_private.api_sph_review_queue(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(q order by q.submitted_at asc), '[]'::jsonb)
  from (
    -- Antrean SPH (Manager Cabang / Direktur Keuangan / Accounting / Finance)
    select
      d.id,
      'sph'::text as kind,
      coalesce(d.document_number, 'SPH No. ' || d.sph_number::text) || ' • ' || d.title as title,
      d.status,
      d.branch_id,
      coalesce(d.amount, 0) as amount,
      d.created_at as submitted_at
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

    -- Antrean Proyek & Pagu RAB (Direktur Utama & Direksi untuk director_review,
    -- SERTA Admin Cabang & Manager Cabang untuk draft / revision_requested setelah SPK di-ACC Dirut)
    select
      p.id,
      'project'::text as kind,
      coalesce(p.code, 'PRJ') || ' • ' || p.name || coalesce(' (' || b.name || ')', '') as title,
      p.approval_status as status,
      p.branch_id,
      coalesce(p.contract_amount, 0) as amount,
      coalesce(p.submitted_at, p.created_at) as submitted_at
    from public.crm_projects p
    left join public.business_units b on b.id = p.branch_id
    where p.organization_id = p_org
      and (
        (
          p.approval_status = 'director_review'
          and (gsp_private.can_decide_project(p) or gsp_private.can_review_project(p))
        )
        or (
          p.approval_status in ('draft', 'revision_requested')
          and (
            gsp_private.has_job(p.organization_id, p.branch_id, array['admin', 'branch_manager'])
            or gsp_private.is_superadmin(p.organization_id)
          )
        )
      )
  ) q;
$$;

create or replace function gsp_private.api_sales_notifications(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
 with items as (
  -- SPH (Persetujuan ke Direktur Keuangan & Tindak Lanjut Cabang)
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
        (d.created_by = auth.uid() or gsp_private.has_job(d.organization_id, d.branch_id, array['admin', 'branch_manager']))
        and gsp_private.sph_opener(d)
        and d.status in ('revision_requested', 'rejected', 'ready')
        and not exists(select 1 from public.sales_documents s where s.kind = 'spk' and s.accepted_sph_id = d.id)
      )
    )

  union all

  -- SPK (Persetujuan LANGSUNG ke Direktur Utama & Reminder ke Admin Cabang + Manager Cabang)
  select d.id, 'spk'::text as kind, d.sph_number, d.document_number, d.status, d.review_note, d.created_at,
   case when gsp_private.can_review_spk(d) then 'approval' else 'follow_up' end category,
   case when gsp_private.can_review_spk(d) then 'Persetujuan SPK Direktur Utama'
        when d.status = 'revision_requested' then 'SPK perlu revisi (' || coalesce(b.name, 'Cabang') || ')'
        when d.status = 'ready' then 'SPK Disetujui Dirut: Segera Lengkapi Dokumen & RAB Proyek (' || coalesce(b.name, 'Cabang') || ')'
        else 'SPK perlu tindak lanjut' end label
  from public.sales_documents d
  left join public.business_units b on b.id = d.branch_id
  where d.organization_id = p_org
    and d.kind = 'spk'
    and gsp_private.sales_internal_member(p_org)
    and (
      gsp_private.can_review_spk(d)
      or (
        (d.created_by = auth.uid() or gsp_private.has_job(d.organization_id, d.branch_id, array['admin', 'branch_manager']))
        and (
          d.status in ('revision_requested', 'rejected')
          or (
            d.status = 'ready'
            and exists (
              select 1 from public.crm_projects p
              where (p.id = d.project_id or p.spk_id = d.id)
                and p.approval_status in ('draft', 'revision_requested')
            )
          )
        )
      )
    )

  union all

  -- Proyek (Persetujuan Perencanaan & Pagu RAB ke Direktur Utama / Arahan Direksi,
  -- SERTA Notifikasi & Reminder ke Admin Cabang + Manager Cabang saat SPK disetujui Dirut)
  select
    p.id,
    'project'::text as kind,
    null::integer as sph_number,
    p.code as document_number,
    p.approval_status as status,
    coalesce(
      nullif(btrim(p.review_note), ''),
      case
        when p.approval_status = 'draft' then
          'SPK telah di-ACC Direktur Utama. Admin Cabang & Manager Cabang ' || coalesce(b.name, '') || ' wajib segera membuat dan mengajukan kelengkapan dokumen, RAB, jadwal, serta tim SDM proyek "' || p.name || '".'
        else p.review_note
      end
    ) as review_note,
    coalesce(p.submitted_at, p.created_at) as created_at,
    case when p.approval_status = 'director_review' and (gsp_private.can_decide_project(p) or gsp_private.can_review_project(p)) then 'approval' else 'follow_up' end category,
    case when p.approval_status = 'director_review' and gsp_private.can_decide_project(p) then 'Persetujuan Perencanaan Proyek & RAB (Direktur Utama)'
         when p.approval_status = 'director_review' and gsp_private.can_review_project(p) then 'Pemeriksaan Perencanaan Proyek & RAB (Direksi)'
         when p.approval_status = 'draft' then '⚡ SPK Disetujui Dirut — Segera Lengkapi Dokumen & RAB Proyek (' || coalesce(b.name, 'Cabang') || ')'
         when p.approval_status = 'revision_requested' then '⚠️ Revisi Dokumen & RAB Proyek (' || coalesce(b.name, 'Cabang') || ')'
         when p.approval_status = 'active' then 'Proyek telah di-ACC Direktur Utama (Siap Eksekusi)'
         when p.approval_status = 'rejected' then 'Pengajuan Proyek ditolak Direktur Utama'
         else 'Proyek perlu tindak lanjut' end label
  from public.crm_projects p
  left join public.business_units b on b.id = p.branch_id
  where p.organization_id = p_org
    and (
      (p.approval_status = 'director_review' and (gsp_private.can_decide_project(p) or gsp_private.can_review_project(p)))
      or (
        p.approval_status in ('draft', 'revision_requested')
        and (
          gsp_private.has_job(p.organization_id, p.branch_id, array['admin', 'branch_manager'])
          or p.created_by = auth.uid()
          or gsp_private.is_superadmin(p.organization_id)
        )
      )
      or (
        p.approval_status in ('active', 'rejected')
        and (
          p.created_by = auth.uid()
          or gsp_private.has_job(p.organization_id, p.branch_id, array['admin', 'branch_manager', 'project_manager'])
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

notify pgrst, 'reload schema';
