-- ============================================================================
-- 20261110000000_automated_sales_accounting_journals.sql
-- Otomatisasi Jurnal Akuntansi Penjualan:
-- 1. Tambah invoice_journal_id dan payment_journal_id pada public.sales_invoices
-- 2. Buka guard_legacy_scope & guard_accounting_journal untuk transaksi penjualan
-- 3. Fungsi otomatisasi posting jurnal Invoice Penagihan (INV/...):
--    [D] Piutang Usaha (1121) - Total Tagihan (DPP + PPN)
--    [K] Pendapatan Jasa (4111) - DPP
--    [K] Utang PPN Keluaran (2121) - PPN 11%
-- 4. Fungsi otomatisasi posting jurnal Penerimaan Pembayaran / Kuitansi (KWT/...):
--    [D] Kas / Bank Operasional (1102) - Kas Riil Diterima
--    [D] Uang Muka PPh 23 (1192) - Pajak Dibayar di Muka (PPh 23)
--    [K] Piutang Usaha (1121) - Pelunasan Piutang
-- ============================================================================

-- 1. Tambah kolom referensi jurnal pada public.sales_invoices
alter table public.sales_invoices add column if not exists invoice_journal_id uuid references public.accounting_journals(id) on delete set null;
alter table public.sales_invoices add column if not exists payment_journal_id uuid references public.accounting_journals(id) on delete set null;

create index if not exists sales_invoices_inv_journal on public.sales_invoices(invoice_journal_id);
create index if not exists sales_invoices_pmt_journal on public.sales_invoices(payment_journal_id);

-- 2. Perbarui guard_legacy_scope agar mengizinkan jurnal transaksi penjualan (receivable & payment)
create or replace function gsp_private.guard_legacy_scope() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  org uuid;
  j public.accounting_journals;
  d public.purchase_requests;
begin
  org := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;

  -- Pengecualian tabel operasional/proyek
  if tg_table_name in (
    'crm_projects',
    'operational_work_items',
    'project_access_scopes',
    'project_memberships',
    'project_portal_entries',
    'procurement_attachments',
    'sales_invoices'
  ) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_table_name = 'accounting_journals' and tg_op <> 'DELETE' and auth.uid() is not null then
    if new.reversal_of is not null and exists(
      select 1 from public.accounting_journals original
      join public.purchase_requests p on p.id = original.source_id
      where original.id = new.reversal_of
    ) then
      raise exception 'Jurnal pengajuan pembelian memerlukan alur koreksi pembelian; pembalik umum tidak diizinkan.';
    end if;
  end if;

  if auth.uid() is null or gsp_private.is_superadmin(org) or (tg_table_name = 'audit_events' and tg_op = 'INSERT' and pg_trigger_depth() > 1) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_table_name = 'finance_accounts' and gsp_private.has_job(org, null, array['accounting_tax', 'finance']) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_table_name = 'audit_events' and tg_op = 'INSERT' and to_jsonb(new)->>'entity_type' = 'finance_accounts' and to_jsonb(new)->>'action' in ('coa.created', 'coa.updated', 'coa.template_installed') and gsp_private.has_job(org, null, array['accounting_tax', 'finance']) then
    return new;
  end if;

  if tg_table_name in ('accounting_journals', 'accounting_journal_lines') and tg_op <> 'DELETE' then
    if tg_table_name = 'accounting_journals' then j := new; else select * into j from public.accounting_journals where id = new.journal_id; end if;

    -- Izinkan jurnal pembelian
    select * into d from public.purchase_requests where id = j.source_id and organization_id = org;
    if d.id is not null and j.source_type in ('payable', 'payment') and j.entity_id = (select entity_id from public.business_units where id = d.branch_id)
      and ((j.source_type = 'payable' and d.status = 'accounting_review' and gsp_private.has_job(org, null, array['accounting_tax']))
      or (j.source_type = 'payment' and d.status = 'payment_ready' and gsp_private.has_job(org, null, array['finance']))) then
      return new;
    end if;

    -- Izinkan jurnal penjualan (Invoice & Pembayaran)
    if j.source_type in ('receivable', 'payment') and exists (
      select 1 from public.sales_invoices s
      where s.id = j.source_id and s.organization_id = org
    ) then
      return new;
    end if;
  end if;

  raise exception 'Akses data lama belum tersedia untuk pengguna perusahaan; gunakan pengajuan cabang.' using errcode = '42501';
end;
$$;

-- 3. Perbarui guard_accounting_journal agar membolehkan posting otomatis untuk penjualan
create or replace function public.guard_accounting_journal() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  old_status text;
  target_journal uuid;
begin
  if tg_table_name = 'accounting_journals' then
    if tg_op = 'DELETE' then
      if old.status <> 'draft' then raise exception 'Jurnal posted tidak boleh dihapus; buat jurnal pembalik.'; end if;
      return old;
    end if;
    if tg_op = 'UPDATE' and old.status <> 'draft' then raise exception 'Jurnal posted tidak boleh diubah; buat jurnal pembalik.'; end if;
    if new.status = 'posted' and old.status = 'draft' then
      if not (
        public.has_org_role(new.organization_id, array['owner', 'finance'])
        or new.source_type in ('receivable', 'payment')
      ) then
        raise exception 'Hanya Accounting & Finance yang dapat posting jurnal.' using errcode = '42501';
      end if;
      perform public.validate_accounting_journal(new.id);
      new.posted_by := coalesce(auth.uid(), new.created_by);
      new.posted_at := now();
    end if;
    return new;
  end if;

  target_journal := case when tg_op = 'DELETE' then old.journal_id else new.journal_id end;
  select status into old_status from public.accounting_journals where id = target_journal for update;
  if old_status <> 'draft' then raise exception 'Baris jurnal posted terkunci; lakukan koreksi dengan jurnal pembalik.'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- 4. Helper untuk memastikan Akun COA Penjualan ada dan aktif
create or replace function gsp_private.ensure_sales_account(
  p_org uuid,
  p_code text,
  p_name text,
  p_type text,
  p_normal text,
  p_category text,
  p_section text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.finance_accounts
  where organization_id = p_org
    and (code = p_code or account_code = p_code or posting_category = p_category)
    and is_active = true
    and is_postable = true
  order by (code = p_code) desc
  limit 1;

  if v_id is null then
    insert into public.finance_accounts(
      organization_id, code, account_code, name, account_type,
      normal_balance, is_postable, is_active, report_section,
      posting_category, created_by
    ) values (
      p_org, p_code, p_code, p_name, p_type,
      p_normal, true, true, p_section,
      p_category, auth.uid()
    ) returning id into v_id;
  end if;

  return v_id;
end;
$$;

-- 5. Fungsi Otomatisasi Posting Jurnal Invoice Penjualan (INV/...)
create or replace function gsp_private.post_sales_invoice_journal(p_invoice_id uuid)
returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_inv public.sales_invoices;
  v_entity uuid;
  v_period uuid;
  v_p_start date;
  v_p_end date;
  v_target_date date;
  v_ar_acc uuid;
  v_rev_acc uuid;
  v_vat_acc uuid;
  v_jrn_id uuid;
  v_ln integer := 0;
begin
  select * into v_inv from public.sales_invoices where id = p_invoice_id for update;
  if v_inv.id is null then return null; end if;
  if v_inv.invoice_journal_id is not null then return v_inv.invoice_journal_id; end if;

  -- 1. Tentukan Entitas Akuntansi
  select entity_id into v_entity from public.business_units where id = v_inv.branch_id and organization_id = v_inv.organization_id;
  if v_entity is null then
    select id into v_entity from public.company_entities
    where organization_id = v_inv.organization_id and is_reporting_parent = true
    limit 1;
  end if;
  if v_entity is null then
    select id into v_entity from public.company_entities
    where organization_id = v_inv.organization_id
    limit 1;
  end if;

  if v_entity is null then return null; end if;

  -- 2. Tentukan Periode Akuntansi Terbuka
  select id, starts_on, ends_on into v_period, v_p_start, v_p_end
  from public.accounting_periods
  where organization_id = v_inv.organization_id
    and entity_id = v_entity
    and period_status = 'open'
  order by (v_inv.invoice_date between starts_on and ends_on) desc, starts_on desc
  limit 1;

  if v_period is null then
    -- Buat periode otomatis jika belum ada periode terbuka
    v_p_start := date_trunc('month', v_inv.invoice_date)::date;
    v_p_end := (date_trunc('month', v_inv.invoice_date) + interval '1 month - 1 day')::date;
    insert into public.accounting_periods(
      organization_id, entity_id, period_code, starts_on, ends_on, period_status, created_by
    ) values (
      v_inv.organization_id, v_entity, to_char(v_p_start, 'YYYY-MM'), v_p_start, v_p_end, 'open', coalesce(auth.uid(), v_inv.created_by)
    ) returning id into v_period;
  end if;

  -- Clamp target_date ke range periode terbuka
  v_target_date := v_inv.invoice_date;
  if v_target_date < v_p_start then v_target_date := v_p_start; end if;
  if v_target_date > v_p_end then v_target_date := v_p_end; end if;

  -- 3. Siapkan Akun-Akun Terkait
  v_ar_acc := gsp_private.ensure_sales_account(
    v_inv.organization_id, '1121', 'Piutang Klien', 'asset', 'debit', 'receivable', 'asset'
  );
  v_rev_acc := gsp_private.ensure_sales_account(
    v_inv.organization_id, '4111', 'Pendapatan Jasa Konsultansi & Proyek', 'revenue', 'credit', 'revenue', 'revenue'
  );
  v_vat_acc := gsp_private.ensure_sales_account(
    v_inv.organization_id, '2121', 'PPN Keluaran', 'liability', 'credit', 'output_vat', 'liability'
  );

  -- 4. Buat Draft Jurnal Piutang
  insert into public.accounting_journals(
    organization_id, entity_id, period_id, journal_number,
    journal_date, source_type, source_id, description,
    status, created_by
  ) values (
    v_inv.organization_id, v_entity, v_period,
    'JRN/' || to_char(v_target_date, 'YYYYMM') || '/' || lpad((
      select (count(*) + 1)::text from public.accounting_journals
      where organization_id = v_inv.organization_id and entity_id = v_entity
    ), 4, '0'),
    v_target_date, 'receivable', v_inv.id,
    'Pengakuan piutang invoice ' || v_inv.invoice_number || ' (' || v_inv.term_name || ')',
    'draft', coalesce(auth.uid(), v_inv.created_by)
  ) returning id into v_jrn_id;

  -- Line 1: [D] Piutang Usaha = DPP + PPN
  v_ln := v_ln + 1;
  insert into public.accounting_journal_lines(
    organization_id, journal_id, line_number, account_id,
    debit, credit, description, counterparty_type, counterparty_id, project_id
  ) values (
    v_inv.organization_id, v_jrn_id, v_ln, v_ar_acc,
    v_inv.total_amount, 0,
    'Piutang klien invoice ' || v_inv.invoice_number,
    'customer', v_inv.client_id, v_inv.project_id
  );

  -- Line 2: [K] Pendapatan Jasa = DPP (amount)
  v_ln := v_ln + 1;
  insert into public.accounting_journal_lines(
    organization_id, journal_id, line_number, account_id,
    debit, credit, description, counterparty_type, counterparty_id, project_id
  ) values (
    v_inv.organization_id, v_jrn_id, v_ln, v_rev_acc,
    0, v_inv.amount,
    'Pendapatan jasa termin ' || v_inv.term_name || ' (' || v_inv.invoice_number || ')',
    null, null, v_inv.project_id
  );

  -- Line 3: [K] PPN Keluaran (jika ada vat_amount > 0)
  if v_inv.vat_amount > 0 then
    v_ln := v_ln + 1;
    insert into public.accounting_journal_lines(
      organization_id, journal_id, line_number, account_id,
      debit, credit, description, counterparty_type, counterparty_id, project_id
    ) values (
      v_inv.organization_id, v_jrn_id, v_ln, v_vat_acc,
      0, v_inv.vat_amount,
      'PPN Keluaran 11% invoice ' || v_inv.invoice_number,
      null, null, v_inv.project_id
    );
  end if;

  -- 5. Posting Jurnal
  update public.accounting_journals
  set status = 'posted',
      posted_by = coalesce(auth.uid(), v_inv.created_by),
      posted_at = now()
  where id = v_jrn_id;

  -- Simpan referensi jurnal ke sales_invoices
  update public.sales_invoices
  set invoice_journal_id = v_jrn_id
  where id = v_inv.id;

  return v_jrn_id;
end;
$$;

-- 6. Fungsi Otomatisasi Posting Jurnal Penerimaan Pembayaran (KWT/...)
create or replace function gsp_private.post_sales_payment_journal(p_invoice_id uuid)
returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_inv public.sales_invoices;
  v_entity uuid;
  v_period uuid;
  v_p_start date;
  v_p_end date;
  v_target_date date;
  v_bank_acc uuid;
  v_wht_acc uuid;
  v_ar_acc uuid;
  v_jrn_id uuid;
  v_ln integer := 0;
  v_paid numeric(15,2);
  v_wht numeric(15,2);
  v_ar_cleared numeric(15,2);
  v_kwt_label text;
begin
  select * into v_inv from public.sales_invoices where id = p_invoice_id for update;
  if v_inv.id is null then return null; end if;
  if v_inv.status <> 'paid' then return null; end if;
  if v_inv.payment_journal_id is not null then return v_inv.payment_journal_id; end if;

  -- 1. Tentukan Entitas Akuntansi
  select entity_id into v_entity from public.business_units where id = v_inv.branch_id and organization_id = v_inv.organization_id;
  if v_entity is null then
    select id into v_entity from public.company_entities
    where organization_id = v_inv.organization_id and is_reporting_parent = true
    limit 1;
  end if;
  if v_entity is null then
    select id into v_entity from public.company_entities
    where organization_id = v_inv.organization_id
    limit 1;
  end if;

  if v_entity is null then return null; end if;

  v_target_date := coalesce(v_inv.paid_at::date, current_date);

  -- 2. Tentukan Periode Akuntansi Terbuka
  select id, starts_on, ends_on into v_period, v_p_start, v_p_end
  from public.accounting_periods
  where organization_id = v_inv.organization_id
    and entity_id = v_entity
    and period_status = 'open'
  order by (v_target_date between starts_on and ends_on) desc, starts_on desc
  limit 1;

  if v_period is null then
    v_p_start := date_trunc('month', v_target_date)::date;
    v_p_end := (date_trunc('month', v_target_date) + interval '1 month - 1 day')::date;
    insert into public.accounting_periods(
      organization_id, entity_id, period_code, starts_on, ends_on, period_status, created_by
    ) values (
      v_inv.organization_id, v_entity, to_char(v_p_start, 'YYYY-MM'), v_p_start, v_p_end, 'open', coalesce(auth.uid(), v_inv.created_by)
    ) returning id into v_period;
  end if;

  if v_target_date < v_p_start then v_target_date := v_p_start; end if;
  if v_target_date > v_p_end then v_target_date := v_p_end; end if;

  -- 3. Hitung Komponen Pembayaran & Pemotongan Pajak
  v_wht := coalesce(v_inv.wht_amount, 0);
  v_paid := coalesce(v_inv.paid_amount, v_inv.net_receivable);
  if v_paid <= 0 then
    v_paid := v_inv.total_amount - v_wht;
  end if;
  v_ar_cleared := v_paid + v_wht;

  -- 4. Siapkan Akun-Akun Terkait
  v_bank_acc := gsp_private.ensure_sales_account(
    v_inv.organization_id, '1102', 'Bank Operasional', 'asset', 'debit', 'cash_bank', 'asset'
  );
  v_wht_acc := gsp_private.ensure_sales_account(
    v_inv.organization_id, '1192', 'Pajak Penghasilan Dibayar di Muka (PPh 23)', 'asset', 'debit', 'general', 'asset'
  );
  v_ar_acc := gsp_private.ensure_sales_account(
    v_inv.organization_id, '1121', 'Piutang Klien', 'asset', 'debit', 'receivable', 'asset'
  );

  v_kwt_label := coalesce(v_inv.receipt_number, 'KWT-' || v_inv.invoice_number);

  -- 5. Buat Draft Jurnal Penerimaan
  insert into public.accounting_journals(
    organization_id, entity_id, period_id, journal_number,
    journal_date, source_type, source_id, description,
    status, created_by
  ) values (
    v_inv.organization_id, v_entity, v_period,
    'JRN/' || to_char(v_target_date, 'YYYYMM') || '/' || lpad((
      select (count(*) + 1)::text from public.accounting_journals
      where organization_id = v_inv.organization_id and entity_id = v_entity
    ), 4, '0'),
    v_target_date, 'payment', v_inv.id,
    'Penerimaan pelunasan kuitansi ' || v_kwt_label || ' atas invoice ' || v_inv.invoice_number,
    'draft', coalesce(auth.uid(), v_inv.created_by)
  ) returning id into v_jrn_id;

  -- Line 1: [D] Kas / Bank = Uang Masuk Bersih (paid_amount)
  v_ln := v_ln + 1;
  insert into public.accounting_journal_lines(
    organization_id, journal_id, line_number, account_id,
    debit, credit, description, counterparty_type, counterparty_id, project_id
  ) values (
    v_inv.organization_id, v_jrn_id, v_ln, v_bank_acc,
    v_paid, 0,
    'Penerimaan kas/bank pelunasan ' || v_kwt_label,
    null, null, v_inv.project_id
  );

  -- Line 2: [D] Pajak Dibayar di Muka PPh 23 (jika ada pemotongan wht > 0)
  if v_wht > 0 then
    v_ln := v_ln + 1;
    insert into public.accounting_journal_lines(
      organization_id, journal_id, line_number, account_id,
      debit, credit, description, counterparty_type, counterparty_id, project_id
    ) values (
      v_inv.organization_id, v_jrn_id, v_ln, v_wht_acc,
      v_wht, 0,
      'Uang muka PPh 23 invoice ' || v_inv.invoice_number || coalesce(' (Bukti Potong: ' || v_inv.wht_proof_number || ')', ''),
      null, null, v_inv.project_id
    );
  end if;

  -- Line 3: [K] Piutang Usaha = Pelunasan Piutang (v_ar_cleared)
  v_ln := v_ln + 1;
  insert into public.accounting_journal_lines(
    organization_id, journal_id, line_number, account_id,
    debit, credit, description, counterparty_type, counterparty_id, project_id
  ) values (
    v_inv.organization_id, v_jrn_id, v_ln, v_ar_acc,
    0, v_ar_cleared,
    'Pelunasan piutang klien ' || v_kwt_label,
    'customer', v_inv.client_id, v_inv.project_id
  );

  -- 6. Posting Jurnal
  update public.accounting_journals
  set status = 'posted',
      posted_by = coalesce(auth.uid(), v_inv.created_by),
      posted_at = now()
  where id = v_jrn_id;

  -- Simpan referensi jurnal ke sales_invoices
  update public.sales_invoices
  set payment_journal_id = v_jrn_id
  where id = v_inv.id;

  return v_jrn_id;
end;
$$;

-- 7. Perbarui create_sales_invoice dan record_sales_payment untuk memanggil posting otomatis
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
language plpgsql security definer set search_path='' as $$
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
begin
  select * into v_proj from public.crm_projects where id = p_project_id and organization_id = p_org;
  if v_proj.id is null then raise exception 'Proyek tidak ditemukan.'; end if;

  select * into v_client from public.sales_clients where id = v_proj.client_id;
  select * into v_branch from public.business_units where id = v_proj.branch_id;

  -- Generate Nomor Invoice Resmi: INV/{CLIENT}/{CABANG}/{MMYY}.{SEQ}
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

  -- Otomatis Posting Jurnal Akuntansi Piutang
  begin
    perform gsp_private.post_sales_invoice_journal(v_inv_id);
  exception when others then
    -- Log peringatan namun jangan gagalkan penerbitan invoice
    raise notice 'Posting otomatis jurnal invoice ditunda: %', sqlerrm;
  end;

  -- Perbarui status termin di project.payment_terms
  update public.crm_projects
  set payment_terms = (
    select jsonb_agg(
      case when (elem->>'index')::int = p_term_index or (elem->>'name') = p_term_name
      then elem || jsonb_build_object('status', 'invoiced', 'invoice_id', v_inv_id, 'invoice_number', v_inv_num)
      else elem end
    )
    from jsonb_array_elements(payment_terms) as elem
  )
  where id = p_project_id;

  perform gsp_private.procurement_log(
    p_org, v_proj.branch_id, v_inv_id, 'sales_invoice', 'invoice_issued',
    v_inv_num, jsonb_build_object('amount', p_amount, 'total', v_total)
  );

  return v_inv_id;
end;
$$;

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
language plpgsql security definer set search_path='' as $$
declare
  v_inv public.sales_invoices;
  v_branch public.business_units;
  v_kwt_num text;
begin
  select * into v_inv from public.sales_invoices where id = p_invoice_id and organization_id = p_org for update;
  if v_inv.id is null then raise exception 'Invoice tidak ditemukan.'; end if;
  if v_inv.status = 'paid' then raise exception 'Invoice ini sudah lunas sebelumnya.'; end if;

  select * into v_branch from public.business_units where id = v_inv.branch_id;

  -- Generate Nomor Kuitansi Resmi: KWT/GSP-{CABANG}/{MMYY}.{SEQ}
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

  -- Otomatis Posting Jurnal Akuntansi Penerimaan Pembayaran
  begin
    perform gsp_private.post_sales_payment_journal(p_invoice_id);
  exception when others then
    raise notice 'Posting otomatis jurnal pembayaran ditunda: %', sqlerrm;
  end;

  -- Perbarui status termin di project.payment_terms jika terkait proyek
  if v_inv.project_id is not null then
    update public.crm_projects
    set payment_terms = (
      select jsonb_agg(
        case when (elem->>'index')::int = v_inv.term_index or (elem->>'name') = v_inv.term_name
        then elem || jsonb_build_object('status', 'paid', 'receipt_number', v_kwt_num, 'paid_at', now())
        else elem end
      )
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

-- 8. Trigger cadangan pada sales_invoices jika data di-insert/update secara direct
create or replace function gsp_private.trg_auto_post_sales_journal() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op = 'INSERT' then
    begin
      perform gsp_private.post_sales_invoice_journal(new.id);
    exception when others then
      null;
    end;
  elsif tg_op = 'UPDATE' then
    if new.status = 'paid' and (old.status is distinct from 'paid' or new.payment_journal_id is null) then
      begin
        perform gsp_private.post_sales_payment_journal(new.id);
      exception when others then
        null;
      end;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sales_invoices_auto_journal_trg on public.sales_invoices;
create trigger sales_invoices_auto_journal_trg
after insert or update on public.sales_invoices
for each row execute function gsp_private.trg_auto_post_sales_journal();

notify pgrst, 'reload schema';
