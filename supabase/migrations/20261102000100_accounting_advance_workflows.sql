-- Accounting administration, controlled journals and balance-level bank reconciliation.
-- Cash advances can be settled only after disbursement and Finance review.

create or replace function gsp_private.check_writer(p_org uuid,p_type text) returns void
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null or not exists(
    select 1 from public.organization_members m
    where m.organization_id=p_org and m.user_id=auth.uid()
      and (gsp_private.record_config(p_type)->'writers') ? m.role
      and not (p_type='advance' and m.role='auditor')
  ) then
    raise exception 'Peran Anda tidak diizinkan mengubah jenis dokumen ini.' using errcode='42501';
  end if;
end $$;

create or replace function public.create_company_entity(
  p_org uuid,p_entity_code text,p_legal_name text,p_entity_type text,
  p_functional_currency text default 'IDR',p_parent_entity_id uuid default null,
  p_tax_id text default null,p_is_reporting_parent boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare entity_id uuid;
begin
  if not public.has_org_role(p_org,array['owner','director','finance']) then
    raise exception 'Hanya Superuser, Direksi, atau Finance dapat mengelola entitas.' using errcode='42501';
  end if;
  if nullif(btrim(p_entity_code),'') is null or length(p_entity_code)>32
    or nullif(btrim(p_legal_name),'') is null or length(p_legal_name)>200
    or p_functional_currency !~ '^[A-Z]{3}$'
    or p_entity_type not in ('parent','subsidiary','branch')
    or (p_entity_type='parent' and p_parent_entity_id is not null)
    or (p_entity_type<>'parent' and p_parent_entity_id is null)
    or (p_is_reporting_parent and p_entity_type<>'parent') then
    raise exception 'Data entitas tidak valid.';
  end if;
  if p_parent_entity_id is not null and not exists(
    select 1 from public.company_entities
    where organization_id=p_org and id=p_parent_entity_id and is_active
  ) then raise exception 'Entitas induk tidak ditemukan atau tidak aktif.'; end if;
  insert into public.company_entities(
    organization_id,entity_code,legal_name,entity_type,functional_currency,
    parent_entity_id,tax_id,is_reporting_parent
  ) values (
    p_org,btrim(p_entity_code),btrim(p_legal_name),p_entity_type,
    p_functional_currency,p_parent_entity_id,nullif(btrim(p_tax_id),''),
    p_is_reporting_parent
  ) returning id into entity_id;
  return entity_id;
end $$;

create or replace function public.set_entity_membership(
  p_org uuid,p_entity_id uuid,p_user_id uuid,p_is_default boolean
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_org_role(p_org,array['owner','director','finance']) then
    raise exception 'Hanya Superuser, Direksi, atau Finance dapat mengelola keanggotaan entitas.' using errcode='42501';
  end if;
  if not exists(select 1 from public.company_entities where organization_id=p_org and id=p_entity_id and is_active)
    or not exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_user_id) then
    raise exception 'Entitas atau anggota organisasi tidak ditemukan.';
  end if;
  if p_is_default then
    update public.entity_memberships set is_default=false
      where organization_id=p_org and user_id=p_user_id and is_default;
  end if;
  insert into public.entity_memberships(organization_id,entity_id,user_id,is_default)
  values(p_org,p_entity_id,p_user_id,p_is_default)
  on conflict(entity_id,user_id) do update set is_default=excluded.is_default;
end $$;

create or replace function public.create_accounting_period(
  p_org uuid,p_entity_id uuid,p_period_code text,p_starts_on date,p_ends_on date
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare period_id uuid;
begin
  if not public.has_org_role(p_org,array['owner','finance']) then
    raise exception 'Hanya Superuser atau Finance dapat membuat periode.' using errcode='42501';
  end if;
  if nullif(btrim(p_period_code),'') is null or length(p_period_code)>32 or p_ends_on<p_starts_on then
    raise exception 'Kode atau rentang periode tidak valid.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text||p_entity_id::text,0));
  if not exists(select 1 from public.company_entities where organization_id=p_org and id=p_entity_id and is_active) then
    raise exception 'Entitas tidak ditemukan atau tidak aktif.';
  end if;
  if exists(select 1 from public.accounting_periods where organization_id=p_org and entity_id=p_entity_id
    and daterange(starts_on,ends_on,'[]') && daterange(p_starts_on,p_ends_on,'[]')) then
    raise exception 'Rentang periode bertumpang tindih.';
  end if;
  insert into public.accounting_periods(organization_id,entity_id,period_code,starts_on,ends_on)
  values(p_org,p_entity_id,btrim(p_period_code),p_starts_on,p_ends_on) returning id into period_id;
  return period_id;
end $$;

create or replace function public.close_accounting_period(p_period_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.accounting_periods;
begin
  select * into p from public.accounting_periods where id=p_period_id for update;
  if p.id is null or not public.has_org_role(p.organization_id,array['owner','finance']) then
    raise exception 'Periode tidak ditemukan atau akses ditolak.' using errcode='42501';
  end if;
  if p.period_status<>'open' then raise exception 'Periode sudah ditutup.'; end if;
  if exists(select 1 from public.accounting_journals where period_id=p.id and status='draft') then
    raise exception 'Periode masih memiliki jurnal draft.';
  end if;
  update public.accounting_periods set period_status='closed',closed_by=auth.uid(),closed_at=now() where id=p.id;
end $$;

create or replace function public.create_accounting_journal(
  p_org uuid,p_entity_id uuid,p_period_id uuid,p_journal_number text,
  p_journal_date date,p_source_type text,p_description text,p_lines jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare journal_id uuid; line jsonb; line_no integer:=0; amount_debit numeric; amount_credit numeric;
  p public.accounting_periods;
begin
  if not public.has_org_role(p_org,array['owner','finance']) then
    raise exception 'Hanya Superuser atau Finance dapat membuat jurnal.' using errcode='42501';
  end if;
  if nullif(btrim(p_journal_number),'') is null or length(p_journal_number)>64
    or nullif(btrim(p_description),'') is null or length(p_description)>2000
    or p_source_type not in ('manual','payment','cash_advance','receivable','payable','tax','asset','payroll','inventory','intercompany','opening_balance','closing')
    or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)<2
    or jsonb_array_length(p_lines)>200 then
    raise exception 'Header jurnal atau jumlah baris tidak valid.';
  end if;
  select * into p from public.accounting_periods
    where id=p_period_id and organization_id=p_org and entity_id=p_entity_id for update;
  if p.id is null or p.period_status<>'open' or p_journal_date not between p.starts_on and p.ends_on then
    raise exception 'Jurnal harus berada dalam periode entitas yang terbuka.';
  end if;
  insert into public.accounting_journals(
    organization_id,entity_id,period_id,journal_number,journal_date,source_type,description,created_by
  ) values(p_org,p_entity_id,p_period_id,btrim(p_journal_number),p_journal_date,p_source_type,btrim(p_description),auth.uid())
  returning id into journal_id;
  for line in select value from jsonb_array_elements(p_lines) loop
    line_no:=line_no+1;
    if jsonb_typeof(line) is distinct from 'object' then raise exception 'Baris jurnal tidak valid.'; end if;
    amount_debit:=coalesce(nullif(line->>'debit','')::numeric,0);
    amount_credit:=coalesce(nullif(line->>'credit','')::numeric,0);
    if amount_debit<0 or amount_credit<0 or amount_debit=amount_credit then
      raise exception 'Setiap baris harus berisi debit atau kredit, bukan keduanya.';
    end if;
    if not exists(select 1 from public.finance_accounts
      where organization_id=p_org and id=(line->>'account_id')::uuid and is_active) then
      raise exception 'Akun jurnal tidak ditemukan atau tidak aktif.';
    end if;
    insert into public.accounting_journal_lines(
      organization_id,journal_id,line_number,account_id,description,debit,credit,
      counterparty_type,counterparty_id,project_id,cost_center,tax_code,tax_amount,reference_number
    ) values (
      p_org,journal_id,line_no,(line->>'account_id')::uuid,
      coalesce(nullif(btrim(line->>'description'),''),btrim(p_description)),
      amount_debit,amount_credit,
      nullif(line->>'counterparty_type',''),nullif(line->>'counterparty_id','')::uuid,
      nullif(line->>'project_id','')::uuid,nullif(btrim(line->>'cost_center'),''),
      nullif(btrim(line->>'tax_code'),''),coalesce(nullif(line->>'tax_amount','')::numeric,0),
      nullif(btrim(line->>'reference_number'),'')
    );
  end loop;
  perform public.validate_accounting_journal(journal_id);
  return journal_id;
end $$;

create or replace function public.reverse_accounting_journal(
  p_journal_id uuid,p_reversal_number text,p_reversal_date date,p_description text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare original public.accounting_journals; reversal_id uuid;
begin
  select * into original from public.accounting_journals where id=p_journal_id for update;
  if original.id is null or not public.has_org_role(original.organization_id,array['owner','finance']) then
    raise exception 'Jurnal tidak ditemukan atau akses ditolak.' using errcode='42501';
  end if;
  if original.status<>'posted' or original.reversal_of is not null then
    raise exception 'Hanya jurnal posted yang belum dibalik dapat direversal.';
  end if;
  if exists(select 1 from public.accounting_journals where reversal_of=original.id) then
    raise exception 'Jurnal sudah memiliki pembalik.';
  end if;
  if nullif(btrim(p_reversal_number),'') is null or nullif(btrim(p_description),'') is null then
    raise exception 'Nomor dan keterangan jurnal pembalik wajib diisi.';
  end if;
  if not exists(select 1 from public.accounting_periods where id=original.period_id
    and period_status='open' and p_reversal_date between starts_on and ends_on) then
    raise exception 'Tanggal pembalik harus berada dalam periode terbuka yang sama.';
  end if;
  insert into public.accounting_journals(
    organization_id,entity_id,period_id,journal_number,journal_date,source_type,
    source_id,description,reversal_of,created_by
  ) values (
    original.organization_id,original.entity_id,original.period_id,btrim(p_reversal_number),
    p_reversal_date,'manual',original.id,btrim(p_description),original.id,auth.uid()
  ) returning id into reversal_id;
  insert into public.accounting_journal_lines(
    organization_id,journal_id,line_number,account_id,description,debit,credit,
    counterparty_type,counterparty_id,project_id,cost_center,tax_code,tax_amount,reference_number
  )
  select organization_id,reversal_id,line_number,account_id,'Pembalik: '||description,
    credit,debit,counterparty_type,counterparty_id,project_id,cost_center,tax_code,tax_amount,reference_number
  from public.accounting_journal_lines where journal_id=original.id;
  return reversal_id;
end $$;

create or replace function public.guard_accounting_journal() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_status text; target_journal uuid; reversal_posted boolean;
begin
  if tg_table_name='accounting_journals' then
    if tg_op='DELETE' then
      if old.status<>'draft' then raise exception 'Jurnal posted tidak boleh dihapus; buat jurnal pembalik.'; end if;
      return old;
    end if;
    if tg_op='UPDATE' and old.status<>'draft' then
      select exists(select 1 from public.accounting_journals r
        where r.reversal_of=old.id and r.status='posted') into reversal_posted;
      if not (old.status='posted' and new.status='reversed' and reversal_posted
        and new.id=old.id and new.reversal_of is not distinct from old.reversal_of) then
        raise exception 'Jurnal posted tidak boleh diubah; buat jurnal pembalik.';
      end if;
      return new;
    end if;
    if new.status='posted' and old.status='draft' then
      if not public.has_org_role(new.organization_id,array['owner','finance']) then raise exception 'Hanya Accounting & Finance yang dapat posting jurnal.' using errcode='42501'; end if;
      perform public.validate_accounting_journal(new.id);
      new.posted_by:=auth.uid(); new.posted_at:=now();
    end if;
    return new;
  end if;
  target_journal:=case when tg_op='DELETE' then old.journal_id else new.journal_id end;
  select status into old_status from public.accounting_journals where id=target_journal for update;
  if old_status<>'draft' then raise exception 'Baris jurnal posted terkunci; lakukan koreksi dengan jurnal pembalik.'; end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

create or replace function public.post_accounting_journal(p_journal uuid) returns void
language plpgsql security definer set search_path='' as $$
declare j public.accounting_journals; original_id uuid;
begin
  select * into j from public.accounting_journals where id=p_journal for update;
  if j.id is null or not public.has_org_role(j.organization_id,array['owner','finance']) then
    raise exception 'Jurnal tidak ditemukan atau akses ditolak.' using errcode='42501';
  end if;
  if j.status<>'draft' then raise exception 'Jurnal hanya dapat diposting satu kali.'; end if;
  if j.reversal_of is not null then
    select id into original_id from public.accounting_journals
      where id=j.reversal_of and organization_id=j.organization_id and status='posted' for update;
    if original_id is null then raise exception 'Jurnal asli tidak lagi berstatus posted.'; end if;
    if exists(select 1 from public.accounting_journals where reversal_of=original_id and status='posted') then
      raise exception 'Jurnal asli sudah dibalik.';
    end if;
  end if;
  update public.accounting_journals set status='posted' where id=j.id;
  if original_id is not null then
    update public.accounting_journals set status='reversed' where id=original_id;
  end if;
end $$;

alter table public.accounting_journals drop constraint accounting_journals_status_check;
alter table public.accounting_journals add constraint accounting_journals_status_check
  check(status in ('draft','posted','reversed','voided'));
alter table public.accounting_journals drop constraint accounting_journals_check;
alter table public.accounting_journals add constraint accounting_journals_status_metadata_check
  check(
    (status='draft' and posted_by is null and posted_at is null)
    or (status in ('posted','reversed') and posted_by is not null and posted_at is not null)
    or (status='voided' and posted_by is null and posted_at is null)
  );

create or replace function public.void_accounting_journal(p_journal uuid) returns void
language plpgsql security definer set search_path='' as $$
declare j public.accounting_journals;
begin
  select * into j from public.accounting_journals where id=p_journal for update;
  if j.id is null or not public.has_org_role(j.organization_id,array['owner','finance']) then
    raise exception 'Jurnal tidak ditemukan atau akses ditolak.' using errcode='42501';
  end if;
  if j.status<>'draft' then raise exception 'Hanya draft jurnal yang dapat dibatalkan.'; end if;
  update public.accounting_journals set status='voided' where id=j.id;
end $$;

create table public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  entity_id uuid not null,
  period_id uuid not null,
  account_id uuid not null,
  statement_date date not null,
  statement_balance numeric(20,2) not null,
  book_balance numeric(20,2) not null,
  difference numeric(20,2) not null,
  status text not null check(status in ('matched','variance')),
  note text,
  reconciled_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(organization_id,id),
  unique(organization_id,account_id,statement_date),
  foreign key(organization_id,entity_id) references public.company_entities(organization_id,id),
  foreign key(organization_id,period_id) references public.accounting_periods(organization_id,id),
  foreign key(organization_id,account_id) references public.finance_accounts(organization_id,id),
  check(difference=statement_balance-book_balance),
  check((status='matched' and difference=0) or (status='variance' and difference<>0))
);
create index bank_reconciliations_account_date_idx
  on public.bank_reconciliations(organization_id,account_id,statement_date desc);
alter table public.bank_reconciliations enable row level security;
create policy bank_reconciliations_read on public.bank_reconciliations
  for select to authenticated using(public.has_org_role(organization_id,array['owner','director','finance','auditor']));
revoke all on public.bank_reconciliations from public,anon,authenticated;
grant select on public.bank_reconciliations to authenticated;

create or replace function public.reconcile_bank_balance(
  p_org uuid,p_entity_id uuid,p_period_id uuid,p_account_id uuid,
  p_statement_date date,p_statement_balance numeric,p_note text default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.accounting_periods; book numeric(20,2); variance numeric(20,2); reconciliation_id uuid;
begin
  if not public.has_org_role(p_org,array['owner','finance']) then
    raise exception 'Hanya Superuser atau Finance dapat melakukan rekonsiliasi.' using errcode='42501';
  end if;
  select * into p from public.accounting_periods
    where id=p_period_id and organization_id=p_org and entity_id=p_entity_id;
  if p.id is null or p_statement_date not between p.starts_on and p.ends_on then
    raise exception 'Tanggal rekonsiliasi harus berada di periode entitas yang dipilih.';
  end if;
  if not exists(select 1 from public.finance_accounts where organization_id=p_org and id=p_account_id and is_active and account_type='asset') then
    raise exception 'Pilih akun kas/bank aktif.';
  end if;
  select coalesce(sum(l.debit-l.credit),0) into book
    from public.accounting_journal_lines l
    join public.accounting_journals j on j.id=l.journal_id and j.organization_id=l.organization_id
    where l.organization_id=p_org and j.entity_id=p_entity_id and l.account_id=p_account_id
      and j.status in ('posted','reversed') and j.journal_date<=p_statement_date;
  variance:=p_statement_balance-book;
  insert into public.bank_reconciliations(
    organization_id,entity_id,period_id,account_id,statement_date,statement_balance,
    book_balance,difference,status,note,reconciled_by
  ) values(
    p_org,p_entity_id,p_period_id,p_account_id,p_statement_date,p_statement_balance,
    book,variance,case when variance=0 then 'matched' else 'variance' end,
    nullif(btrim(p_note),''),auth.uid()
  ) returning id into reconciliation_id;
  return reconciliation_id;
end $$;

alter table public.cash_advances add constraint cash_advances_organization_id_uq unique(organization_id,id);

create table public.cash_advance_settlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  advance_id uuid not null unique,
  expense_total numeric(18,2) not null check(expense_total>=0),
  cash_returned numeric(18,2) not null default 0 check(cash_returned>=0),
  additional_due numeric(18,2) not null default 0 check(additional_due>=0),
  additional_due_on date,
  expense_note text not null,
  receipt_references text,
  state text not null default 'submitted' check(state in ('submitted','approved','rejected')),
  submitted_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  review_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(organization_id,advance_id) references public.cash_advances(organization_id,id),
  check((cash_returned=0 or additional_due=0)),
  check((additional_due=0 and additional_due_on is null) or (additional_due>0 and additional_due_on is not null)),
  check((state='submitted' and reviewed_by is null and reviewed_at is null)
    or (state in ('approved','rejected') and reviewed_by is not null and reviewed_at is not null))
);
create index cash_advance_settlements_org_state_idx
  on public.cash_advance_settlements(organization_id,state,submitted_at desc);
alter table public.cash_advance_settlements enable row level security;
create policy cash_advance_settlements_read on public.cash_advance_settlements
  for select to authenticated using(
    public.has_org_role(organization_id,array['owner','director','finance','auditor'])
    or submitted_by=auth.uid()
  );
revoke all on public.cash_advance_settlements from public,anon,authenticated;
grant select on public.cash_advance_settlements to authenticated;
alter table public.payment_records
  add column cash_advance_settlement_id uuid unique
    references public.cash_advance_settlements(id);
alter table public.payment_records add constraint payment_advance_source_exclusive_check
  check(cash_advance_id is null or cash_advance_settlement_id is null);
create trigger audit_cash_advance_settlements
  after insert or update or delete on public.cash_advance_settlements
  for each row execute function public.audit_module_record('cash_advance_settlement','pembayaran');

create or replace function public.submit_cash_advance_settlement(
  p_org uuid,p_advance_id uuid,p_expense_total numeric,p_cash_returned numeric,
  p_additional_due numeric,p_expense_note text,p_receipt_references text default null,
  p_additional_due_on date default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.cash_advances; s public.cash_advance_settlements; settlement_id uuid;
begin
  if not public.is_org_member(p_org) then raise exception 'Keanggotaan organisasi tidak ditemukan.' using errcode='42501'; end if;
  if not public.has_org_role(p_org,array['owner','director','manager','finance','hr','operations','staff'])
    or public.has_org_role(p_org,array['auditor']) then
    raise exception 'Auditor tidak diizinkan mengajukan pertanggungjawaban kasbon.' using errcode='42501';
  end if;
  select * into a from public.cash_advances where id=p_advance_id and organization_id=p_org for update;
  if a.id is null or not (a.created_by=auth.uid() or public.has_org_role(p_org,array['finance','owner'])) then
    raise exception 'Kasbon tidak ditemukan atau akses ditolak.' using errcode='42501';
  end if;
  if a.advance_status<>'disbursed' then raise exception 'Kasbon hanya dapat dipertanggungjawabkan setelah dicairkan.'; end if;
  if p_expense_total<0 or p_cash_returned<0 or p_additional_due<0
    or (p_expense_total+p_cash_returned)<>(a.amount+p_additional_due)
    or (p_cash_returned>0 and p_additional_due>0)
    or (p_additional_due>0 and p_additional_due_on is null)
    or (p_additional_due=0 and p_additional_due_on is not null)
    or nullif(btrim(p_expense_note),'') is null or length(p_expense_note)>4000
    or length(coalesce(p_receipt_references,''))>4000 then
    raise exception 'Nilai pertanggungjawaban tidak seimbang atau keterangannya tidak valid.';
  end if;
  select * into s from public.cash_advance_settlements where advance_id=a.id for update;
  if s.id is not null then
    if s.state in ('submitted','approved') then raise exception 'Pertanggungjawaban sudah diajukan atau disetujui.'; end if;
    update public.cash_advance_settlements set
      expense_total=p_expense_total,cash_returned=p_cash_returned,additional_due=p_additional_due,
      additional_due_on=p_additional_due_on,
      expense_note=btrim(p_expense_note),receipt_references=nullif(btrim(p_receipt_references),''),
      state='submitted',submitted_by=auth.uid(),reviewed_by=null,review_note=null,
      submitted_at=now(),reviewed_at=null,updated_at=now()
      where id=s.id returning id into settlement_id;
  else
    insert into public.cash_advance_settlements(
      organization_id,advance_id,expense_total,cash_returned,additional_due,
      additional_due_on,expense_note,receipt_references,submitted_by
    ) values(
      p_org,a.id,p_expense_total,p_cash_returned,p_additional_due,
      p_additional_due_on,
      btrim(p_expense_note),nullif(btrim(p_receipt_references),''),auth.uid()
    ) returning id into settlement_id;
  end if;
  return settlement_id;
end $$;

create or replace function public.review_cash_advance_settlement(
  p_settlement_id uuid,p_decision text,p_note text
) returns void
language plpgsql security definer set search_path='' as $$
declare s public.cash_advance_settlements; a public.cash_advances;
  employee_name text;
begin
  select * into s from public.cash_advance_settlements where id=p_settlement_id for update;
  if s.id is null or not public.has_org_role(s.organization_id,array['finance']) then
    raise exception 'Hanya Finance dapat meninjau pertanggungjawaban.' using errcode='42501';
  end if;
  if p_decision not in ('approved','rejected') or nullif(btrim(p_note),'') is null or length(p_note)>2000 then
    raise exception 'Keputusan dan catatan Finance wajib diisi.';
  end if;
  if s.state<>'submitted' then raise exception 'Pertanggungjawaban sudah ditinjau.'; end if;
  if s.submitted_by=auth.uid() then raise exception 'Pengaju tidak boleh meninjau pertanggungjawabannya sendiri.'; end if;
  select * into a from public.cash_advances where id=s.advance_id for update;
  if a.advance_status<>'disbursed' or s.expense_total+s.cash_returned<>a.amount+s.additional_due then
    raise exception 'Status atau perhitungan kasbon berubah; periksa kembali sebelum memutuskan.';
  end if;
  update public.cash_advance_settlements set state=p_decision,reviewed_by=auth.uid(),
    review_note=btrim(p_note),reviewed_at=now(),updated_at=now() where id=s.id;
  if p_decision='approved' then
    update public.cash_advances set advance_status='settled',row_version=row_version+1,updated_at=now()
      where id=a.id;
    if s.additional_due>0 then
      select coalesce(nullif(u.raw_user_meta_data->>'full_name',''),
        nullif(u.raw_user_meta_data->>'name',''),u.email,'Karyawan')
        into employee_name from auth.users u where u.id=s.submitted_by;
      insert into public.payment_records(
        organization_id,payment_number,payee_name,description,invoice_date,due_on,
        amount,status,reference_number,notes,created_by,cash_advance_settlement_id
      ) values(
        s.organization_id,'KASBON-REIMBURSE-'||replace(s.id::text,'-',''),
        coalesce(employee_name,'Karyawan'),'Penggantian biaya kasbon '||a.advance_number,
        current_date,s.additional_due_on,s.additional_due,'unpaid',
        'ADV-SETTLEMENT-'||left(replace(s.id::text,'-',''),12),s.expense_note,
        s.submitted_by,s.id
      );
    end if;
  end if;
end $$;

do $$ declare t text; begin
  foreach t in array array['accounting_journals','accounting_journal_lines'] loop
    execute format('drop trigger if exists accounting_journal_guard on public.%I',t);
    execute format('create trigger accounting_journal_guard before insert or update or delete on public.%I for each row execute function public.guard_accounting_journal()',t);
  end loop;
end $$;

create trigger audit_accounting_journals after insert or update or delete on public.accounting_journals
  for each row execute function public.audit_module_record('accounting_journal','akuntansi');
create trigger audit_accounting_journal_lines after insert or update or delete on public.accounting_journal_lines
  for each row execute function public.audit_module_record('accounting_journal_line','akuntansi');
create trigger audit_bank_reconciliations after insert or update or delete on public.bank_reconciliations
  for each row execute function public.audit_module_record('bank_reconciliation','akuntansi');

revoke all on function public.create_company_entity(uuid,text,text,text,text,uuid,text,boolean) from public,anon;
revoke all on function public.set_entity_membership(uuid,uuid,uuid,boolean) from public,anon;
revoke all on function public.create_accounting_period(uuid,uuid,text,date,date) from public,anon;
revoke all on function public.close_accounting_period(uuid) from public,anon;
revoke all on function public.void_accounting_journal(uuid) from public,anon;
revoke all on function public.create_accounting_journal(uuid,uuid,uuid,text,date,text,text,jsonb) from public,anon;
revoke all on function public.reverse_accounting_journal(uuid,text,date,text) from public,anon;
revoke all on function public.reconcile_bank_balance(uuid,uuid,uuid,uuid,date,numeric,text) from public,anon;
revoke all on function public.submit_cash_advance_settlement(uuid,uuid,numeric,numeric,numeric,text,text,date) from public,anon;
revoke all on function public.review_cash_advance_settlement(uuid,text,text) from public,anon;
grant execute on function public.create_company_entity(uuid,text,text,text,text,uuid,text,boolean) to authenticated;
grant execute on function public.set_entity_membership(uuid,uuid,uuid,boolean) to authenticated;
grant execute on function public.create_accounting_period(uuid,uuid,text,date,date) to authenticated;
grant execute on function public.close_accounting_period(uuid) to authenticated;
grant execute on function public.void_accounting_journal(uuid) to authenticated;
grant execute on function public.create_accounting_journal(uuid,uuid,uuid,text,date,text,text,jsonb) to authenticated;
grant execute on function public.reverse_accounting_journal(uuid,text,date,text) to authenticated;
grant execute on function public.reconcile_bank_balance(uuid,uuid,uuid,uuid,date,numeric,text) to authenticated;
grant execute on function public.submit_cash_advance_settlement(uuid,uuid,numeric,numeric,numeric,text,text,date) to authenticated;
grant execute on function public.review_cash_advance_settlement(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
