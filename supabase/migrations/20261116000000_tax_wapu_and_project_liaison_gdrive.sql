-- ============================================================================
-- 20261116000000_tax_wapu_and_project_liaison_gdrive.sql
-- 1. Penyesuaian Perpajakan: PPN 030 (WAPU Migas / BUMN) & WAPU Bendahara (020),
--    di mana PPN disetor sendiri oleh klien sehingga tagihan & kas masuk adalah DPP - PPh 23.
-- 2. Integrasi Google Drive Klien (client_gdrive_url) untuk efisiensi penyimpanan.
-- 3. Input & penambahan alur proses pengerjaan proyek (custom_milestones) saat pengajuan.
-- 4. Hak akses Narahubung Proyek (Liaison Officer / LO) lintas cabang.
-- ============================================================================

-- 1. Tambah Kolom Perpajakan WAPU pada sales_invoices
alter table public.sales_invoices add column if not exists tax_invoice_type text default '010';
alter table public.sales_invoices add column if not exists tax_invoice_number text;
alter table public.sales_invoices add column if not exists tax_invoice_date date;
alter table public.sales_invoices add column if not exists is_wapu boolean default false;
alter table public.sales_invoices add column if not exists wapu_notes text;

-- 2. Tambah Kolom Proyek: Google Drive Klien, Custom Milestones, Data Requests, Koordinasi Instansi
alter table public.crm_projects add column if not exists client_gdrive_url text;
alter table public.crm_projects add column if not exists custom_milestones jsonb default '[]'::jsonb;
alter table public.crm_projects add column if not exists client_data_requests jsonb default '[]'::jsonb;
alter table public.crm_projects add column if not exists agency_coordinations jsonb default '[]'::jsonb;
alter table public.crm_projects add column if not exists liaison_user_id uuid references auth.users(id) on delete set null;
alter table public.crm_projects add column if not exists liaison_name text;

-- 3. Perbarui create_sales_invoice untuk Mendukung WAPU (030 Migas / BUMN, 020 Pemerintah)
create or replace function public.create_sales_invoice(
  p_org uuid,
  p_project_id uuid,
  p_term_index integer,
  p_term_name text,
  p_percentage numeric,
  p_amount numeric,
  p_due_date date,
  p_notes text default null,
  p_tax_invoice_type text default '010',
  p_tax_invoice_number text default null
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
  v_is_wapu boolean := false;
  v_tax_type text;
begin
  perform gsp_private.assert_writable();

  select * into v_proj from public.crm_projects where id = p_project_id and organization_id = p_org for update;
  if v_proj.id is null then raise exception 'Proyek tidak ditemukan.'; end if;

  if not (
    gsp_private.is_superadmin(p_org)
    or gsp_private.has_job(p_org, null, array['president', 'finance_director', 'finance', 'accounting_tax', 'project_liaison'])
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

  v_tax_type := coalesce(nullif(btrim(p_tax_invoice_type), ''), '010');
  if v_tax_type in ('030', '020') or (p_tax_invoice_number is not null and (p_tax_invoice_number like '030%' or p_tax_invoice_number like '020%')) then
    v_is_wapu := true;
  end if;

  v_vat := round((p_amount * 0.11), 2);
  v_wht := round((p_amount * 0.02), 2);

  if v_is_wapu then
    -- Pada WAPU Migas (030) / Pemerintah (020), PPN disetor sendiri oleh klien ke Kas Negara.
    -- Nilai yang ditagihkan & dibayarkan klien ke perusahaan adalah DPP, dan kas bersih adalah DPP - PPh 23.
    v_total := p_amount;
    v_net := p_amount - v_wht;
  else
    -- Non-WAPU normal: Klien mentransfer DPP + PPN - PPh 23
    v_total := p_amount + v_vat;
    v_net := v_total - v_wht;
  end if;

  insert into public.sales_invoices(
    organization_id, branch_id, project_id, spk_id, client_id,
    invoice_number, term_name, term_index, percentage,
    invoice_date, due_date, amount, vat_rate, vat_amount,
    wht_rate, wht_amount, total_amount, net_receivable,
    tax_invoice_type, tax_invoice_number, is_wapu,
    status, notes, created_by
  ) values (
    p_org, v_proj.branch_id, v_proj.id, v_proj.spk_id, v_proj.client_id,
    v_inv_num, p_term_name, p_term_index, p_percentage,
    current_date, p_due_date, p_amount, 11.00, v_vat,
    2.00, v_wht, v_total, v_net,
    v_tax_type, p_tax_invoice_number, v_is_wapu,
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
    v_inv_num, jsonb_build_object('amount', p_amount, 'total', v_total, 'is_wapu', v_is_wapu, 'project_id', p_project_id)
  );

  return v_inv_id;
end;
$$;
grant execute on function public.create_sales_invoice(uuid, uuid, integer, text, numeric, numeric, date, text, text, text) to authenticated;

-- Overload kompatibilitas untuk pemanggil dengan 8 parameter lama
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
begin
  return public.create_sales_invoice(
    p_org, p_project_id, p_term_index, p_term_name, p_percentage, p_amount, p_due_date, p_notes, '010', null
  );
end;
$$;
grant execute on function public.create_sales_invoice(uuid, uuid, integer, text, numeric, numeric, date, text) to authenticated;

-- 4. Perbarui posting otomatis jurnal piutang untuk WAPU
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
  v_is_wapu boolean := false;
begin
  select * into v_inv from public.sales_invoices where id = p_invoice_id for update;
  if v_inv.id is null then return null; end if;
  if v_inv.invoice_journal_id is not null then return v_inv.invoice_journal_id; end if;

  v_is_wapu := coalesce(v_inv.is_wapu, false) or coalesce(v_inv.tax_invoice_type, '010') in ('030', '020');

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
    v_p_start := date_trunc('month', v_inv.invoice_date)::date;
    v_p_end := (date_trunc('month', v_inv.invoice_date) + interval '1 month - 1 day')::date;
    insert into public.accounting_periods(
      organization_id, entity_id, period_code, starts_on, ends_on, period_status, created_by
    ) values (
      v_inv.organization_id, v_entity, to_char(v_p_start, 'YYYY-MM'), v_p_start, v_p_end, 'open', coalesce(auth.uid(), v_inv.created_by)
    ) returning id into v_period;
  end if;

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
    case when v_is_wapu then 'Pengakuan piutang WAPU invoice ' else 'Pengakuan piutang invoice ' end || v_inv.invoice_number || ' (' || v_inv.term_name || ')',
    'draft', coalesce(auth.uid(), v_inv.created_by)
  ) returning id into v_jrn_id;

  if v_is_wapu then
    -- WAPU Migas / Pemerintah: Piutang diakui sebesar DPP, tidak ada pengakuan Utang PPN ke negara karena klien menyetor langsung
    v_ln := v_ln + 1;
    insert into public.accounting_journal_lines(
      organization_id, journal_id, line_number, account_id,
      debit, credit, description, counterparty_type, counterparty_id, project_id
    ) values (
      v_inv.organization_id, v_jrn_id, v_ln, v_ar_acc,
      v_inv.amount, 0,
      'Piutang klien WAPU invoice ' || v_inv.invoice_number,
      'customer', v_inv.client_id, v_inv.project_id
    );

    v_ln := v_ln + 1;
    insert into public.accounting_journal_lines(
      organization_id, journal_id, line_number, account_id,
      debit, credit, description, counterparty_type, counterparty_id, project_id
    ) values (
      v_inv.organization_id, v_jrn_id, v_ln, v_rev_acc,
      0, v_inv.amount,
      'Pendapatan jasa termin WAPU ' || v_inv.term_name || ' (' || v_inv.invoice_number || ')',
      null, null, v_inv.project_id
    );
  else
    -- Normal Non-WAPU: Piutang = Total (DPP + PPN)
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
  end if;

  -- 5. Posting Jurnal
  update public.accounting_journals
  set status = 'posted',
      posted_by = coalesce(auth.uid(), v_inv.created_by),
      posted_at = now()
  where id = v_jrn_id;

  update public.sales_invoices
  set invoice_journal_id = v_jrn_id
  where id = v_inv.id;

  return v_jrn_id;
end;
$$;

-- 5. Perbarui posting otomatis jurnal pembayaran untuk WAPU
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
  v_is_wapu boolean := false;
begin
  select * into v_inv from public.sales_invoices where id = p_invoice_id for update;
  if v_inv.id is null then return null; end if;
  if v_inv.status <> 'paid' then return null; end if;
  if v_inv.payment_journal_id is not null then return v_inv.payment_journal_id; end if;

  v_is_wapu := coalesce(v_inv.is_wapu, false) or coalesce(v_inv.tax_invoice_type, '010') in ('030', '020');

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

  v_wht := coalesce(v_inv.wht_amount, 0);

  if v_is_wapu then
    -- Pada WAPU: Piutang yang ditutup = DPP (amount), kas yang diterima = DPP - PPh 23
    v_paid := coalesce(v_inv.paid_amount, v_inv.amount - v_wht);
    v_ar_cleared := v_paid + v_wht;
    if v_ar_cleared <= 0 then v_ar_cleared := v_inv.amount; end if;
  else
    -- Normal Non-WAPU: Piutang yang ditutup = total_amount (DPP + PPN)
    v_paid := coalesce(v_inv.paid_amount, v_inv.net_receivable);
    if v_paid <= 0 then
      v_paid := v_inv.total_amount - v_wht;
    end if;
    v_ar_cleared := v_paid + v_wht;
  end if;

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
    'Penerimaan pembayaran ' || v_kwt_label || ' atas invoice ' || v_inv.invoice_number,
    'draft', coalesce(auth.uid(), v_inv.created_by)
  ) returning id into v_jrn_id;

  -- Line 1: [D] Kas / Bank
  v_ln := v_ln + 1;
  insert into public.accounting_journal_lines(
    organization_id, journal_id, line_number, account_id,
    debit, credit, description, counterparty_type, counterparty_id, project_id
  ) values (
    v_inv.organization_id, v_jrn_id, v_ln, v_bank_acc,
    v_paid, 0,
    'Penerimaan kas/bank ' || v_kwt_label,
    'customer', v_inv.client_id, v_inv.project_id
  );

  -- Line 2: [D] Uang Muka PPh 23 (bupot dari klien)
  if v_wht > 0 then
    v_ln := v_ln + 1;
    insert into public.accounting_journal_lines(
      organization_id, journal_id, line_number, account_id,
      debit, credit, description, counterparty_type, counterparty_id, project_id
    ) values (
      v_inv.organization_id, v_jrn_id, v_ln, v_wht_acc,
      v_wht, 0,
      'Uang muka PPh 23 (potongan 2% klien) ' || coalesce(v_inv.wht_proof_number, v_kwt_label),
      'customer', v_inv.client_id, v_inv.project_id
    );
  end if;

  -- Line 3: [K] Piutang Usaha Lunas
  v_ln := v_ln + 1;
  insert into public.accounting_journal_lines(
    organization_id, journal_id, line_number, account_id,
    debit, credit, description, counterparty_type, counterparty_id, project_id
  ) values (
    v_inv.organization_id, v_jrn_id, v_ln, v_ar_acc,
    0, v_ar_cleared,
    'Pelunasan piutang klien invoice ' || v_inv.invoice_number,
    'customer', v_inv.client_id, v_inv.project_id
  );

  update public.accounting_journals
  set status = 'posted',
      posted_by = coalesce(auth.uid(), v_inv.created_by),
      posted_at = now()
  where id = v_jrn_id;

  update public.sales_invoices
  set payment_journal_id = v_jrn_id
  where id = v_inv.id;

  return v_jrn_id;
end;
$$;

-- 6. Perbarui api_save_project_planning untuk Menyimpan client_gdrive_url & custom_milestones
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
  v_ms_item jsonb;
  v_ms_idx integer := 0;
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
      client_gdrive_url = coalesce(nullif(btrim(p_payload->>'client_gdrive_url'), ''), client_gdrive_url),
      custom_milestones = case
        when p_payload ? 'custom_milestones' and jsonb_typeof(p_payload->'custom_milestones') = 'array' and jsonb_array_length(p_payload->'custom_milestones') > 0
        then p_payload->'custom_milestones'
        else custom_milestones
      end,
      client_data_requests = case
        when p_payload ? 'client_data_requests' and jsonb_typeof(p_payload->'client_data_requests') = 'array'
        then p_payload->'client_data_requests'
        else client_data_requests
      end,
      agency_coordinations = case
        when p_payload ? 'agency_coordinations' and jsonb_typeof(p_payload->'agency_coordinations') = 'array'
        then p_payload->'agency_coordinations'
        else agency_coordinations
      end,
      liaison_name = coalesce(nullif(btrim(p_payload->>'liaison_name'), ''), liaison_name),
      attachment_ids = v_attachments,
      starts_on = coalesce(nullif(p_payload->>'starts_on', '')::date, starts_on),
      ends_on = coalesce(nullif(p_payload->>'ends_on', '')::date, ends_on),
      approval_status = v_next_status,
      submitted_at = case when p_submit then now() else submitted_at end,
      review_note = case when p_submit then null else review_note end,
      version = version + 1,
      updated_at = now()
  where id = p.id;

  -- Jika ada custom_milestones dan tabel project_milestones ada, sinkronkan milestone ke tabel
  if p_payload ? 'custom_milestones' and jsonb_typeof(p_payload->'custom_milestones') = 'array' and jsonb_array_length(p_payload->'custom_milestones') > 0 then
    for v_ms_item in select * from jsonb_array_elements(p_payload->'custom_milestones') loop
      v_ms_idx := v_ms_idx + 1;
      insert into public.project_milestones (
        organization_id, project_id, milestone_number, title, subtitle,
        status, progress, pic_name, period, description,
        deliverables, client_actions, updated_at
      ) values (
        p.organization_id,
        p.id,
        v_ms_idx,
        coalesce(nullif(btrim(v_ms_item->>'title'), ''), 'Tahap ' || v_ms_idx),
        coalesce(v_ms_item->>'subtitle', ''),
        coalesce(v_ms_item->>'status', 'upcoming'),
        coalesce((v_ms_item->>'progress')::int, 0),
        coalesce(v_ms_item->>'pic', 'Tim Teknis Cabang'),
        coalesce(v_ms_item->>'period', ''),
        coalesce(v_ms_item->>'description', ''),
        coalesce((select array_agg(x::text) from jsonb_array_elements_text(coalesce(v_ms_item->'deliverables', '[]'::jsonb)) x), '{}'::text[]),
        coalesce((select array_agg(x::text) from jsonb_array_elements_text(coalesce(v_ms_item->'clientActions', '[]'::jsonb)) x), '{}'::text[]),
        now()
      )
      on conflict (project_id, milestone_number) do update
      set title = excluded.title,
          subtitle = excluded.subtitle,
          pic_name = excluded.pic_name,
          period = excluded.period,
          description = excluded.description,
          deliverables = excluded.deliverables,
          client_actions = excluded.client_actions,
          updated_at = now();
    end loop;
  end if;

  perform gsp_private.procurement_log(
    p.organization_id, p.branch_id, p.id, 'project',
    case when p_submit then 'submitted_to_directors' else 'planning_updated' end,
    null,
    jsonb_build_object(
      'approval_status', v_next_status,
      'rab_total', v_rab_total,
      'has_gdrive', (p_payload->>'client_gdrive_url') is not null and btrim(p_payload->>'client_gdrive_url') <> '',
      'attachments_count', cardinality(v_attachments)
    )
  );
end;
$$;

-- 7. Perbarui Hak Akses project_milestones untuk Mengizinkan Narahubung Proyek (Liaison Officer)
create or replace function public.can_write_project_milestones(p_org uuid, p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not gsp_private.is_demo_user()
    and (
      gsp_private.is_superadmin(p_org)
      or gsp_private.has_job(p_org, null, array['project_liaison', 'president', 'technical_director', 'finance_director'])
      or gsp_private.project_internal(p_org, p_project)
      or exists (
        select 1 from public.crm_projects p
        where p.id = p_project
          and p.organization_id = p_org
          and (
            p.branch_id is null
            or gsp_private.can_access_business(p.organization_id, p.branch_id, 'sales')
            or gsp_private.can_access_business(p.organization_id, p.branch_id, 'operations')
          )
      )
    );
$$;

notify pgrst, 'reload schema';
