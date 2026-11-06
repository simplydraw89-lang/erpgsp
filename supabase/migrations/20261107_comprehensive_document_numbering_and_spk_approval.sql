-- 20261107_comprehensive_document_numbering_and_spk_approval.sql
-- Matriks Penomoran Dokumen Otomatis Terpadu (Reset Bulanan & Master Data)
-- Alur Persetujuan SPK oleh Direktur Utama & Direktur Teknis -> Otomatis Buat Proyek Baru.
-- Direktur Keuangan berhak mengedit data/lampiran SPK tanpa hak validasi/ACC.

-- ============================================================================
-- 1. TABEL COUNTER TERPADU (RESET BULANAN & MASTER DATA)
-- ============================================================================
create table if not exists gsp_private.document_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  doc_type text not null,
  period text not null,
  last_number bigint not null default 0,
  primary key (organization_id, doc_type, period)
);
alter table gsp_private.document_counters enable row level security;
revoke all on gsp_private.document_counters from public, anon, authenticated;

-- Fungsi pembersih nama entitas untuk penomoran
create or replace function gsp_private.sanitize_code_name(p_name text) returns text
language plpgsql immutable as $$
declare
  cleaned text;
begin
  if p_name is null or btrim(p_name) = '' then
    return 'GSP';
  end if;
  cleaned := regexp_replace(p_name, '(?i)\b(PT\.?|CV\.?|UD\.?|TBK\.?|INC\.?|LTD\.?)\b', '', 'g');
  cleaned := regexp_replace(cleaned, '[^a-zA-Z0-9]+', '-', 'g');
  cleaned := trim(both '-' from cleaned);
  cleaned := upper(cleaned);
  if length(cleaned) = 0 then
    cleaned := 'KLIEN';
  end if;
  if length(cleaned) > 15 then
    cleaned := left(cleaned, 15);
  end if;
  return cleaned;
end;
$$;

-- Fungsi generator nomor dokumen otomatis terpadu
create or replace function gsp_private.generate_document_number(
  p_org uuid,
  p_doc_type text,
  p_date date default current_date,
  p_client_name text default null,
  p_branch_code text default null,
  p_invoice_number text default null
) returns text
language plpgsql security definer set search_path='' as $$
declare
  v_date date := coalesce(p_date, current_date);
  v_mmyy text := to_char(v_date, 'MMYY');
  v_yymm text := to_char(v_date, 'YY-MM');
  v_period text;
  v_seq bigint;
  v_client text := gsp_private.sanitize_code_name(p_client_name);
  v_branch text := upper(coalesce(p_branch_code, 'PUSAT'));
  v_inv text := gsp_private.sanitize_code_name(p_invoice_number);
begin
  if p_doc_type in ('client', 'vendor') then
    v_period := 'GLOBAL';
  elsif p_doc_type in ('bank', 'cash', 'ju') then
    v_period := v_yymm;
  else
    v_period := v_mmyy;
  end if;

  insert into gsp_private.document_counters(organization_id, doc_type, period, last_number)
  values (p_org, p_doc_type, v_period, 1)
  on conflict (organization_id, doc_type, period)
  do update set last_number = gsp_private.document_counters.last_number + 1
  returning last_number into v_seq;

  case p_doc_type
    when 'sph' then
      return 'SPH/' || v_client || '/GSP/' || v_mmyy || '.' || lpad(v_seq::text, 6, '0');
    when 'spk' then
      return 'SPK/' || v_client || '/GSP/' || v_mmyy || '.' || lpad(v_seq::text, 6, '0');
    when 'prj' then
      return 'PRJ/' || v_client || '/' || v_branch || '/' || v_mmyy || '.' || lpad(v_seq::text, 6, '0');
    when 'mom' then
      return 'MOM/' || v_client || '/GSP/' || v_mmyy || '.' || lpad(v_seq::text, 7, '0');
    when 'inv' then
      return 'INV/' || v_client || '/GSP/' || v_mmyy || '.' || lpad(v_seq::text, 6, '0');
    when 'kwt' then
      return 'KWT/GSP/' || v_mmyy || '.' || lpad(v_seq::text, 6, '0');
    when 'purc' then
      return 'PURC/INV-' || v_inv || '/GSP/' || v_mmyy || '.' || lpad(v_seq::text, 6, '0');
    when 'bank' then
      return 'BA.' || v_yymm || '-' || lpad(v_seq::text, 7, '0');
    when 'cash' then
      return 'KAS.' || v_yymm || '-' || lpad(v_seq::text, 7, '0');
    when 'ju' then
      return 'JU.' || v_yymm || '-' || lpad(v_seq::text, 6, '0');
    when 'sppd' then
      return 'SPPD/GSP-' || v_branch || '/' || v_mmyy || '.' || lpad(v_seq::text, 6, '0');
    when 'kb' then
      return 'KB/GSP-' || v_branch || '/' || v_mmyy || '.' || lpad(v_seq::text, 6, '0');
    when 'client' then
      return 'CLI.' || lpad(v_seq::text, 5, '0');
    when 'vendor' then
      return 'VND.' || lpad(v_seq::text, 5, '0');
    else
      return upper(p_doc_type) || '/' || v_mmyy || '.' || lpad(v_seq::text, 6, '0');
  end case;
end;
$$;

-- ============================================================================
-- 2. PENAMBAHAN KOLOM IDENTITAS DOKUMEN & RELASI PROYEK
-- ============================================================================
alter table public.sales_documents add column if not exists document_number text;
alter table public.sales_documents add column if not exists project_id uuid references public.crm_projects(id);
create unique index if not exists sales_documents_org_doc_num on public.sales_documents(organization_id, document_number) where document_number is not null;

alter table public.purchase_requests add column if not exists request_number text;
create unique index if not exists purchase_requests_org_req_num on public.purchase_requests(organization_id, request_number) where request_number is not null;

alter table public.sales_clients add column if not exists client_code text;
alter table public.procurement_vendors add column if not exists vendor_code text;

-- ============================================================================
-- 3. PERBARUI SIMPAN SPK: NOMOR OTOMATIS & STATUS 'director_review'
-- ============================================================================
create or replace function gsp_private.api_save_sales_document(p_org uuid, p_branch uuid, p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  d public.sales_documents;
  c public.sales_clients;
  i uuid;
  attachments uuid[];
  v_spk_number text;
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

  insert into public.sales_documents(
    organization_id, branch_id, client_id, kind, title, source,
    accepted_sph_id, notes, attachment_ids, client_snapshot, created_by,
    status, document_number
  )
  values(
    p_org, p_branch, d.client_id, 'spk', btrim(p_payload->>'title'),
    coalesce(p_payload->>'source', 'company'), d.id, p_payload->>'notes',
    attachments, d.client_snapshot, auth.uid(),
    'director_review', v_spk_number
  ) returning id into i;

  perform gsp_private.procurement_log(
    p_org, p_branch, i, 'spk', 'submitted_to_director', null,
    jsonb_build_object('document_number', v_spk_number, 'status', 'director_review')
  );

  return i;
end$$;

-- ============================================================================
-- 4. VALIDASI OLEH DIREKTUR UTAMA / DIREKTUR TEKNIS -> OTOMATIS BUAT PROYEK
--    (Direktur Keuangan dapat mengedit isi, namun bukan validasi/verifikasi)
-- ============================================================================
create or replace function gsp_private.can_review_spk(d public.sales_documents) returns boolean
language sql stable security definer set search_path='' as $$
  select d.kind = 'spk'
  and d.status = 'director_review'
  and (
    gsp_private.is_superadmin(d.organization_id)
    or gsp_private.has_job(d.organization_id, null, array['president', 'technical_director'])
  );
$$;

create or replace function public.spk_review_allowed(p_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$
  select coalesce((select gsp_private.can_review_spk(d) from public.sales_documents d where id = p_id), false);
$$;

-- Hak edit isi SPK (termasuk Direktur Keuangan)
create or replace function gsp_private.can_edit_spk(d public.sales_documents) returns boolean
language sql stable security definer set search_path='' as $$
  select d.kind = 'spk'
  and d.status in ('director_review', 'revision_requested', 'draft')
  and (
    gsp_private.is_superadmin(d.organization_id)
    or gsp_private.has_job(d.organization_id, null, array['finance_director'])
    or d.created_by = auth.uid()
    or gsp_private.can_access_business(d.organization_id, d.branch_id, 'sales')
  );
$$;

create or replace function public.spk_edit_allowed(p_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$
  select coalesce((select gsp_private.can_edit_spk(d) from public.sales_documents d where id = p_id), false);
$$;

-- Fungsi edit data/lampiran SPK
create or replace function gsp_private.api_update_spk_document(
  p_id uuid,
  p_version integer,
  p_payload jsonb
) returns void
language plpgsql security definer set search_path='' as $$
declare
  d public.sales_documents;
  attachments uuid[];
begin
  select * into d from public.sales_documents where id = p_id for update;
  if d.id is null or not gsp_private.can_edit_spk(d) then
    raise exception 'Akses edit SPK ditolak atau status SPK sudah terkunci.' using errcode = '42501';
  end if;
  if d.version is distinct from p_version then
    raise exception 'Versi SPK telah berubah. Muat ulang halaman dan periksa kembali.';
  end if;
  if nullif(btrim(p_payload->>'title'), '') is null then
    raise exception 'Judul SPK wajib diisi.';
  end if;

  select coalesce(array_agg(value::uuid), '{}') into attachments
  from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids', '[]'));
  perform gsp_private.validate_sales_attachments(d.organization_id, d.branch_id, attachments);

  update public.sales_documents
  set title = btrim(p_payload->>'title'),
      source = coalesce(p_payload->>'source', d.source),
      notes = nullif(btrim(p_payload->>'notes'), ''),
      attachment_ids = attachments,
      version = version + 1
  where id = d.id;

  perform gsp_private.procurement_log(
    d.organization_id, d.branch_id, d.id, 'spk', 'updated', null,
    jsonb_build_object('edited_by', auth.uid(), 'version', d.version + 1)
  );
end;
$$;

create or replace function public.update_spk_document(
  p_id uuid,
  p_version integer,
  p_payload jsonb
) returns void
language sql security invoker set search_path='' as $$
  select gsp_private.api_update_spk_document(p_id, p_version, p_payload);
$$;

-- Fungsi eksekusi keputusan Direktur Utama / Direktur Teknis
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

    v_proj_code := gsp_private.generate_document_number(
      d.organization_id, 'prj', current_date, c.name, b.code, null
    );

    insert into public.crm_projects(
      organization_id,
      code,
      name,
      status,
      starts_on,
      created_by
    ) values (
      d.organization_id,
      v_proj_code,
      d.title,
      'active',
      current_date,
      auth.uid()
    ) returning id into v_proj_id;

    insert into public.project_access_scopes(
      organization_id,
      project_id,
      branch_id
    ) values (
      d.organization_id,
      v_proj_id,
      d.branch_id
    ) on conflict do nothing;

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

create or replace function public.decide_spk(
  p_id uuid,
  p_version integer,
  p_decision text,
  p_note text
) returns uuid
language sql security invoker set search_path='' as $$
  select gsp_private.api_decide_spk(p_id, p_version, p_decision, p_note);
$$;

-- ============================================================================
-- 5. INTEGRASI PENOMORAN PEMBELIAN & KAS/BANK
-- ============================================================================
create or replace function gsp_private.assign_purchase_request_number()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.request_number is null then
    new.request_number := gsp_private.generate_document_number(
      new.organization_id, 'purc', coalesce(new.invoice_date, current_date),
      null, null, new.invoice_number
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purchase_request_number on public.purchase_requests;
create trigger trg_purchase_request_number
before insert on public.purchase_requests
for each row execute function gsp_private.assign_purchase_request_number();

create or replace function public.pay_purchase_request(
  p_id uuid,
  p_version integer,
  p_payment_date date,
  p_reference text,
  p_bank_account_id uuid,
  p_period_id uuid
) returns void
language plpgsql security definer set search_path='' as $$
declare
  d public.purchase_requests;
  j uuid;
  entity uuid;
  n integer := 2;
  v_acc_name text;
  v_doc_type text;
  v_journal_number text;
begin
  select * into d from public.purchase_requests where id = p_id for update;
  if d.id is null or not gsp_private.can_review_purchase(d) or d.status <> 'payment_ready' then
    raise exception 'Pengajuan belum siap dibayar atau akses Finance ditolak.' using errcode = '42501';
  end if;
  if d.version <> p_version or d.payment_journal_id is not null then
    raise exception 'Versi berubah atau pembayaran sudah dicatat.';
  end if;
  if d.journal_id is null or not exists(select 1 from public.accounting_journals where id = d.journal_id and source_id = d.id and source_type = 'payable' and status = 'posted') then
    raise exception 'Jurnal utang belum diposting atau sudah dikoreksi.';
  end if;
  if nullif(btrim(p_reference), '') is null or p_payment_date is null then
    raise exception 'Tanggal dan bukti/referensi pembayaran wajib diisi.';
  end if;
  if p_payment_date < d.invoice_date then
    raise exception 'Tanggal pembayaran tidak boleh mendahului invoice; gunakan alur uang muka untuk pembayaran di muka.';
  end if;

  select entity_id into entity from public.business_units where id = d.branch_id;
  if not exists(select 1 from public.accounting_periods where id = p_period_id and organization_id = d.organization_id and entity_id = entity and period_status = 'open' and p_payment_date between starts_on and ends_on) then
    raise exception 'Periode pembayaran tidak sesuai cabang dan tanggal.';
  end if;

  select name into v_acc_name from public.finance_accounts
  where id = p_bank_account_id and organization_id = d.organization_id and is_active and account_type = 'asset' and id <> d.payable_account_id;
  if v_acc_name is null then
    raise exception 'Akun kas/bank tidak valid.';
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
    organization_id, journal_id, line_number, account_id, description, debit,
    counterparty_type, counterparty_id, reference_number
  ) values (
    d.organization_id, j, 1, d.payable_account_id, 'Pelunasan utang usaha',
    case when d.withholding_timing = 'invoice' then d.payable_amount else d.total end,
    'vendor', d.vendor_id, p_reference
  );

  if d.payable_amount > 0 then
    insert into public.accounting_journal_lines(
      organization_id, journal_id, line_number, account_id, description, credit, reference_number
    ) values (
      d.organization_id, j, 2, p_bank_account_id, 'Kas/bank dibayarkan', d.payable_amount, p_reference
    );
  end if;

  if d.withholding_amount > 0 and d.withholding_timing = 'payment' then
    n := case when d.payable_amount > 0 then 3 else 2 end;
    insert into public.accounting_journal_lines(
      organization_id, journal_id, line_number, account_id, description, credit, tax_code, tax_amount
    ) values (
      d.organization_id, j, n, d.withholding_account_id, 'PPh dipotong saat pembayaran',
      d.withholding_amount, d.withholding_code, d.withholding_amount
    );
  end if;

  perform public.validate_accounting_journal(j);
  update public.accounting_journals set status = 'posted' where id = j;
  update public.purchase_requests
  set status = 'paid', payment_journal_id = j, paid_on = p_payment_date, payment_reference = p_reference, version = version + 1
  where id = d.id;

  perform gsp_private.procurement_log(
    d.organization_id, d.branch_id, d.id, 'purchase', 'paid', p_reference,
    jsonb_build_object('journal_id', j, 'journal_number', v_journal_number, 'date', p_payment_date)
  );
end;
$$;

-- ============================================================================
-- 6. PERBARUI SIMPAN SPH AGAR MENDAPATKAN NOMOR DOKUMEN RESMI OTOMATIS
-- ============================================================================
create or replace function gsp_private.assign_sph_document_number()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  c public.sales_clients;
begin
  if new.kind = 'sph' and new.document_number is null then
    select * into c from public.sales_clients where id = new.client_id;
    new.document_number := gsp_private.generate_document_number(
      new.organization_id, 'sph', current_date, coalesce(c.name, new.client_snapshot->>'name')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sph_document_number on public.sales_documents;
create trigger trg_sph_document_number
before insert on public.sales_documents
for each row execute function gsp_private.assign_sph_document_number();

-- ============================================================================
-- 7. PERMISSIONS & postgREST SCHEMA RELOAD
-- ============================================================================
grant execute on function public.decide_spk(uuid, integer, text, text) to authenticated;
grant execute on function public.spk_review_allowed(uuid) to authenticated;
grant execute on function public.spk_edit_allowed(uuid) to authenticated;
grant execute on function public.update_spk_document(uuid, integer, jsonb) to authenticated;
grant execute on function public.pay_purchase_request(uuid, integer, date, text, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
