-- Migration: Add optional payment proof attachments for purchase request settlement

alter table public.purchase_requests
add column if not exists payment_attachment_ids uuid[] not null default '{}';

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
begin
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

  select entity_id into entity from public.business_units where id = d.branch_id;

  if not exists(
    select 1 from public.accounting_periods
    where id = p_period_id and organization_id = d.organization_id and entity_id = entity and period_status = 'open'
  ) then
    raise exception 'Periode pembayaran tidak sesuai cabang dan berstatus terbuka.';
  end if;

  if not exists(
    select 1 from public.finance_accounts
    where id = p_bank_account_id and organization_id = d.organization_id and is_active and is_postable and posting_category = 'cash_bank' and account_type = 'asset' and id <> d.payable_account_id
  ) then
    raise exception 'Akun kas/bank tidak valid.';
  end if;

  -- Validate optional payment attachments
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

  insert into public.accounting_journals(
    organization_id, entity_id, period_id, journal_number, journal_date, source_type, source_id, description, created_by
  ) values (
    d.organization_id, entity, p_period_id, 'PAY-' || d.id::text, p_payment_date, 'payment', d.id, 'Pembayaran invoice ' || d.invoice_number, auth.uid()
  ) returning id into j;

  insert into public.accounting_journal_lines(
    organization_id, journal_id, line_number, account_id, description, debit, counterparty_type, counterparty_id, reference_number
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
      d.organization_id, j, n, d.withholding_account_id, 'PPh dipotong saat pembayaran', d.withholding_amount, d.withholding_code, d.withholding_amount
    );
  end if;

  perform public.validate_accounting_journal(j);
  update public.accounting_journals set status = 'posted' where id = j;

  update public.purchase_requests set
    status = 'paid',
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
    jsonb_build_object('journal_id', j, 'date', p_payment_date, 'attachments', attach_list, 'executor_is_requester', d.created_by = auth.uid())
  );
end $$;

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
as $body$
  select gsp_private.api_pay_purchase_request(p_id, p_version, p_payment_date, p_reference, p_bank_account_id, p_period_id, p_attachments);
$body$;

grant execute on function public.pay_purchase_request(uuid, integer, date, text, uuid, uuid, uuid[]) to authenticated;
