-- ============================================================================
-- 20261107_standardize_branch_invoice_numbering.sql
-- Standarisasi Penomoran Otomatis Invoice & Dokumen per Cabang:
-- 1. Invoice Penjualan (INV):  INV/{CLIENT}/{CABANG}/{MMYY}.{SEQ}
-- 2. Pembelian (PURC):         PURC/GSP-{CABANG}/{MMYY}.{SEQ}
-- 3. Kuitansi (KWT):           KWT/GSP-{CABANG}/{MMYY}.{SEQ}
-- 4. Proyek (PRJ):             PRJ/{CLIENT}/{CABANG}/{MMYY}.{SEQ}
-- 5. SPPD & Kasbon (SPPD/KB):  SPPD/GSP-{CABANG}/{MMYY}.{SEQ} & KB/GSP-{CABANG}/{MMYY}.{SEQ}
-- 6. Trigger assign_purchase_request_number menyertakan kode cabang (SBY, JOG, JKT, PUSAT)
-- ============================================================================

-- 1. Perbarui generator nomor dokumen otomatis
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
  v_branch text := upper(coalesce(nullif(btrim(p_branch_code), ''), 'PUSAT'));
  v_inv text := gsp_private.sanitize_code_name(p_invoice_number);
  v_counter_key text;
begin
  if p_doc_type in ('client', 'vendor') then
    v_period := 'GLOBAL';
  elsif p_doc_type in ('bank', 'cash', 'ju') then
    v_period := v_yymm;
  else
    v_period := v_mmyy;
  end if;

  -- Kunci counter: dipisahkan per cabang untuk tipe dokumen operasional cabang
  if p_doc_type in ('inv', 'purc', 'kwt', 'sppd', 'kb', 'prj') then
    v_counter_key := p_doc_type || '_' || v_branch;
  else
    v_counter_key := p_doc_type;
  end if;

  insert into gsp_private.document_counters(organization_id, doc_type, period, last_number)
  values (p_org, v_counter_key, v_period, 1)
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
    when 'inv' then
      return 'INV/' || v_client || '/' || v_branch || '/' || v_mmyy || '.' || lpad(v_seq::text, 6, '0');
    when 'kwt' then
      return 'KWT/GSP-' || v_branch || '/' || v_mmyy || '.' || lpad(v_seq::text, 6, '0');
    when 'purc' then
      return 'PURC/GSP-' || v_branch || '/' || v_mmyy || '.' || lpad(v_seq::text, 6, '0');
    when 'mom' then
      return 'MOM/' || v_client || '/GSP/' || v_mmyy || '.' || lpad(v_seq::text, 7, '0');
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
      return upper(p_doc_type) || '/' || v_branch || '/' || v_mmyy || '.' || lpad(v_seq::text, 6, '0');
  end case;
end;
$$;

-- 2. Perbarui trigger penomoran pengajuan pembelian per cabang
create or replace function gsp_private.assign_purchase_request_number()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_bcode text;
begin
  if new.request_number is null then
    select code into v_bcode from public.business_units where id = new.branch_id;
    new.request_number := gsp_private.generate_document_number(
      new.organization_id,
      'purc',
      coalesce(new.invoice_date, current_date),
      null,
      v_bcode,
      new.invoice_number
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purchase_request_number on public.purchase_requests;
create trigger trg_purchase_request_number
before insert on public.purchase_requests
for each row execute function gsp_private.assign_purchase_request_number();

-- 3. Backfill nomor resmi untuk pembelian yang belum memiliki request_number
do $$
declare
  r record;
  v_bcode text;
  v_new_num text;
begin
  for r in select id, organization_id, branch_id, invoice_date, invoice_number 
           from public.purchase_requests 
           where request_number is null 
           order by created_at asc loop
    select code into v_bcode from public.business_units where id = r.branch_id;
    v_new_num := gsp_private.generate_document_number(
      r.organization_id,
      'purc',
      coalesce(r.invoice_date, current_date),
      null,
      v_bcode,
      r.invoice_number
    );
    update public.purchase_requests set request_number = v_new_num where id = r.id;
  end loop;
end $$;

notify pgrst, 'reload schema';
