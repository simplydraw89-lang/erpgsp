-- Migration: Allow past-dated invoices to be posted in the selected open accounting period
-- Removes rigid bottleneck where invoice_date had to fall within the period date range.
-- The posting journal date is automatically set to the invoice date if within period,
-- or to the period start date / current valid date within the open period.
-- Also relaxes tax_invoice_number & tax_invoice_date check during accounting review,
-- allowing accounting/tax to set, update, or approve without strict upfront lockout.

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
  elsif d.status = 'branch_review' then
    nextstatus := 'director_review';
  elsif d.status = 'director_review' then
    nextstatus := 'accounting_review';
  else
    -- Accounting & Tax review stage
    if p_accounting is null or (p_accounting->>'coa_confirmed')::boolean is distinct from true then
      raise exception 'Accounting wajib memeriksa COA dan pajak.';
    end if;

    if p_accounting ? 'lines' and (
      (select jsonb_agg(value-'account_id' order by ord) from jsonb_array_elements(p_accounting->'lines') with ordinality x(value,ord))
      is distinct from (select jsonb_agg(value-'account_id' order by ord) from jsonb_array_elements(d.lines) with ordinality x(value,ord))
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

    -- Fetch period dates and verify status is open
    select starts_on, ends_on into p_start, p_end
    from public.accounting_periods
    where id = period
      and organization_id = d.organization_id
      and entity_id = entity
      and period_status = 'open';

    if p_start is null then
      raise exception 'Periode akuntansi harus dalam status terbuka.';
    end if;

    -- Determine posting date: if invoice_date is within open period, use invoice_date;
    -- otherwise (e.g. invoice received late from previous months), post at current date if within period or start of open period.
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

    -- Update purchase request with accounting/tax corrections, including optional tax invoice details
    update public.purchase_requests set
      lines = coalesce(p_accounting->'lines', lines),
      tax_invoice_number = coalesce(nullif(p_accounting->>'tax_invoice_number', ''), tax_invoice_number),
      tax_invoice_date = coalesce(nullif(p_accounting->>'tax_invoice_date', '')::date, tax_invoice_date),
      vat_mode = coalesce(p_accounting->>'vat_mode', vat_mode),
      vat_creditable = coalesce((p_accounting->>'vat_creditable')::boolean, vat_creditable),
      withholding_code = coalesce(p_accounting->>'withholding_code', withholding_code),
      withholding_rate = coalesce((p_accounting->>'withholding_rate')::numeric, withholding_rate),
      withholding_base = coalesce((p_accounting->>'withholding_base')::numeric, withholding_base),
      withholding_timing = coalesce(p_accounting->>'withholding_timing', withholding_timing),
      coa_confirmed = true,
      payable_account_id = ap,
      withholding_account_id = wh
    where id = d.id returning * into d;

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

    insert into public.accounting_journals(
      organization_id, entity_id, period_id, journal_number, journal_date, source_type, source_id, description, created_by
    ) values (
      d.organization_id, entity, period, 'AP-' || d.id::text, target_journal_date, 'payable', d.id, 'Invoice ' || d.invoice_number, auth.uid()
    ) returning id into j;

    for l in select value from jsonb_array_elements(d.lines) loop
      ln := ln + 1;
      amt := (l->>'amount')::numeric;
      cost := amt + case when not d.vat_creditable then round(amt * case d.vat_mode when 'non_luxury' then 0.11 when 'luxury' then 0.12 else 0 end, 2) else 0 end;

      if ln = jsonb_array_length(d.lines) and not d.vat_creditable then
        select d.total - coalesce(sum(debit), 0) into cost from public.accounting_journal_lines where journal_id = j;
      end if;

      insert into public.accounting_journal_lines(
        organization_id, journal_id, line_number, account_id, description, debit, counterparty_type, counterparty_id, reference_number
      ) values (
        d.organization_id, j, ln, (l->>'account_id')::uuid, l->>'description', cost, 'vendor', d.vendor_id, d.invoice_number
      );
    end loop;

    if d.vat_creditable and d.vat_amount > 0 then
      ln := ln + 1;
      insert into public.accounting_journal_lines(
        organization_id, journal_id, line_number, account_id, description, debit
      ) values (
        d.organization_id, j, ln, vat, 'PPN masukan', d.vat_amount
      );
    end if;

    if d.withholding_timing = 'invoice' and d.withholding_amount > 0 then
      ln := ln + 1;
      insert into public.accounting_journal_lines(
        organization_id, journal_id, line_number, account_id, description, credit, tax_code, tax_amount
      ) values (
        d.organization_id, j, ln, wh, 'PPh dipotong saat pengakuan invoice', d.withholding_amount, d.withholding_code, d.withholding_amount
      );
    end if;

    ln := ln + 1;
    insert into public.accounting_journal_lines(
      organization_id, journal_id, line_number, account_id, description, credit, counterparty_type, counterparty_id, reference_number
    ) values (
      d.organization_id, j, ln, ap, 'Utang usaha', case when d.withholding_timing = 'invoice' then d.payable_amount else d.total end, 'vendor', d.vendor_id, d.invoice_number
    );

    perform public.validate_accounting_journal(j);
    update public.accounting_journals set status = 'posted' where id = j;
    update public.purchase_requests set journal_id = j where id = d.id;
    nextstatus := 'payment_ready';
  end if;

  update public.purchase_requests set
    status = nextstatus,
    review_note = p_note,
    version = version + 1
  where id = d.id returning * into d;

  perform gsp_private.procurement_log(
    d.organization_id,
    d.branch_id,
    d.id,
    'purchase',
    case when p_approve then 'approved' else 'rejected' end,
    p_note,
    jsonb_build_object(
      'from', before_doc->>'status',
      'to', nextstatus,
      'journal_id', j,
      'superadmin_override', d.created_by = auth.uid(),
      'before', before_doc,
      'after', to_jsonb(d)
    )
  );
end $$;

-- Ensure public proxy passes the call to gsp_private
create or replace function public.review_purchase_request(
  p_id uuid,
  p_version integer,
  p_approve boolean,
  p_note text,
  p_accounting jsonb default null
) returns void
language sql
security invoker
set search_path = ''
as $body$
  select gsp_private.api_review_purchase_request(p_id, p_version, p_approve, p_note, p_accounting);
$body$;

grant execute on function public.review_purchase_request(uuid, integer, boolean, text, jsonb) to authenticated;
