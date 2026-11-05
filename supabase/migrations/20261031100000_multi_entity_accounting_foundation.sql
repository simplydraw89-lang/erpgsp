-- Multi-entity accounting foundation: legal entities, branches, fiscal periods,
-- double-entry journals, audit evidence, and reporting views.

create table public.company_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_entity_id uuid,
  entity_code text not null,
  legal_name text not null,
  entity_type text not null check (entity_type in ('parent','subsidiary','branch')),
  tax_id text,
  functional_currency char(3) not null default 'IDR',
  is_reporting_parent boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (organization_id,entity_code),
  foreign key (organization_id,parent_entity_id)
    references public.company_entities(organization_id,id),
  check ((entity_type='parent' and parent_entity_id is null) or (entity_type<>'parent' and parent_entity_id is not null)),
  check (not is_reporting_parent or entity_type='parent')
);
create unique index company_entities_one_parent_uq on public.company_entities(organization_id)
  where entity_type='parent';
create index company_entities_parent_idx on public.company_entities(organization_id,parent_entity_id);
alter table public.company_entities enable row level security;
drop policy if exists company_entities_read on public.company_entities;
revoke all on public.company_entities from public,anon,authenticated;
grant select on public.company_entities to authenticated;

create table public.entity_memberships (
  organization_id uuid not null,
  entity_id uuid not null,
  user_id uuid not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(entity_id,user_id),
  foreign key(organization_id,entity_id) references public.company_entities(organization_id,id) on delete cascade,
  foreign key(organization_id,user_id) references public.organization_members(organization_id,user_id) on delete cascade
);
create unique index entity_memberships_one_default_uq on public.entity_memberships(organization_id,user_id) where is_default;
alter table public.entity_memberships enable row level security;
drop policy if exists entity_memberships_read on public.entity_memberships;
create policy entity_memberships_read on public.entity_memberships
  for select to authenticated using (
    user_id=auth.uid() or public.has_org_role(organization_id,array['owner','director','finance','auditor'])
  );
create policy company_entities_read on public.company_entities
  for select to authenticated using (
    public.has_org_role(organization_id,array['owner','director','finance','auditor'])
    or exists(select 1 from public.entity_memberships em where em.entity_id=company_entities.id and em.user_id=auth.uid())
  );
revoke all on public.entity_memberships from public,anon,authenticated;
grant select on public.entity_memberships to authenticated;

create table public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid not null,
  period_code text not null,
  starts_on date not null,
  ends_on date not null,
  period_status text not null default 'open' check(period_status in ('open','closed')),
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(organization_id,id), unique(organization_id,entity_id,period_code),
  foreign key(organization_id,entity_id) references public.company_entities(organization_id,id),
  check(ends_on>=starts_on),
  check((period_status='open' and closed_by is null and closed_at is null) or (period_status='closed' and closed_by is not null and closed_at is not null))
);
create index accounting_periods_entity_dates_idx on public.accounting_periods(organization_id,entity_id,starts_on,ends_on);
alter table public.accounting_periods enable row level security;
drop policy if exists accounting_periods_read on public.accounting_periods;
create policy accounting_periods_read on public.accounting_periods
  for select to authenticated using (
    public.has_org_role(organization_id,array['owner','director','finance','auditor'])
    or exists(select 1 from public.entity_memberships em where em.entity_id=accounting_periods.entity_id and em.user_id=auth.uid())
  );
revoke all on public.accounting_periods from public,anon,authenticated;
grant select on public.accounting_periods to authenticated;

alter table public.finance_accounts add column if not exists parent_account_id uuid;
alter table public.finance_accounts add column if not exists account_code text;
alter table public.finance_accounts add column if not exists is_control_account boolean not null default false;
alter table public.finance_accounts add column if not exists cash_flow_class text check(cash_flow_class in ('operating','investing','financing'));
create unique index if not exists finance_accounts_org_id_uq on public.finance_accounts(organization_id,id);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='finance_accounts_parent_same_org_fk' and conrelid='public.finance_accounts'::regclass) then
    alter table public.finance_accounts add constraint finance_accounts_parent_same_org_fk foreign key(organization_id,parent_account_id) references public.finance_accounts(organization_id,id);
  end if;
end $$;

create table public.accounting_journals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid not null,
  period_id uuid not null,
  journal_number text not null,
  journal_date date not null,
  source_type text not null check(source_type in ('manual','payment','cash_advance','receivable','payable','tax','asset','payroll','inventory','intercompany','opening_balance','closing')),
  source_id uuid,
  description text not null,
  status text not null default 'draft' check(status in ('draft','posted','reversed')),
  reversal_of uuid,
  created_by uuid not null references auth.users(id),
  posted_by uuid references auth.users(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(organization_id,id), unique(organization_id,entity_id,journal_number),
  foreign key(organization_id,entity_id) references public.company_entities(organization_id,id),
  foreign key(organization_id,period_id) references public.accounting_periods(organization_id,id),
  foreign key(organization_id,reversal_of) references public.accounting_journals(organization_id,id),
  check((status='draft' and posted_by is null and posted_at is null) or (status in ('posted','reversed') and posted_by is not null and posted_at is not null))
);
create index accounting_journals_entity_date_idx on public.accounting_journals(organization_id,entity_id,journal_date,status);
create index accounting_journals_source_idx on public.accounting_journals(organization_id,source_type,source_id) where source_id is not null;

create table public.accounting_journal_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  journal_id uuid not null,
  line_number smallint not null check(line_number>0),
  account_id uuid not null,
  description text not null,
  debit numeric(20,2) not null default 0 check(debit>=0),
  credit numeric(20,2) not null default 0 check(credit>=0),
  counterparty_type text check(counterparty_type in ('customer','vendor','employee','tax_authority','bank','other')),
  counterparty_id uuid,
  project_id uuid,
  cost_center text,
  tax_code text,
  tax_amount numeric(20,2) not null default 0 check(tax_amount>=0),
  reference_number text,
  unique(journal_id,line_number),
  foreign key(organization_id,journal_id) references public.accounting_journals(organization_id,id) on delete cascade,
  foreign key(organization_id,account_id) references public.finance_accounts(organization_id,id),
  foreign key(organization_id,project_id) references public.crm_projects(organization_id,id),
  check((debit=0 and credit>0) or (credit=0 and debit>0)),
  check((counterparty_type is null)=(counterparty_id is null))
);
create index accounting_journal_lines_account_idx on public.accounting_journal_lines(organization_id,account_id,journal_id);
create index accounting_journal_lines_counterparty_idx on public.accounting_journal_lines(organization_id,counterparty_type,counterparty_id) where counterparty_id is not null;
create index accounting_journal_lines_project_idx on public.accounting_journal_lines(organization_id,project_id) where project_id is not null;

create or replace function public.validate_accounting_journal(p_journal uuid) returns void
language plpgsql security definer set search_path='' as $$
declare j public.accounting_journals; total_debit numeric(20,2); total_credit numeric(20,2); line_count integer;
begin
  select * into j from public.accounting_journals where id=p_journal;
  if j.id is null then raise exception 'Jurnal tidak ditemukan.'; end if;
  select count(*),coalesce(sum(debit),0),coalesce(sum(credit),0) into line_count,total_debit,total_credit from public.accounting_journal_lines where journal_id=j.id;
  if line_count<2 or total_debit<=0 or total_debit<>total_credit then raise exception 'Jurnal harus memiliki minimal dua baris dan total debit harus sama dengan kredit.'; end if;
  if not exists(select 1 from public.accounting_periods p where p.id=j.period_id and p.organization_id=j.organization_id and p.entity_id=j.entity_id and p.period_status='open' and j.journal_date between p.starts_on and p.ends_on) then
    raise exception 'Tanggal jurnal berada di luar periode akuntansi yang terbuka.';
  end if;
  if exists(select 1 from public.accounting_journal_lines l join public.finance_accounts a on a.id=l.account_id and a.organization_id=l.organization_id where l.journal_id=j.id and not a.is_active) then raise exception 'Jurnal menggunakan akun yang tidak aktif.'; end if;
end $$;

create or replace function public.guard_accounting_journal() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_status text; target_journal uuid;
begin
  if tg_table_name='accounting_journals' then
    if tg_op='DELETE' then
      if old.status<>'draft' then raise exception 'Jurnal posted tidak boleh dihapus; buat jurnal pembalik.'; end if;
      return old;
    end if;
    if tg_op='UPDATE' and old.status<>'draft' then raise exception 'Jurnal posted tidak boleh diubah; buat jurnal pembalik.'; end if;
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
create trigger accounting_journal_guard before insert or update or delete on public.accounting_journals for each row execute function public.guard_accounting_journal();
create trigger accounting_journal_lines_guard before insert or update or delete on public.accounting_journal_lines for each row execute function public.guard_accounting_journal();

create or replace function public.post_accounting_journal(p_journal uuid) returns void
language plpgsql security definer set search_path='' as $$
declare j public.accounting_journals;
begin
  select * into j from public.accounting_journals where id=p_journal for update;
  if j.id is null or not public.has_org_role(j.organization_id,array['owner','finance']) then raise exception 'Jurnal tidak ditemukan atau akses ditolak.' using errcode='42501'; end if;
  if j.status<>'draft' then raise exception 'Jurnal hanya dapat diposting satu kali.'; end if;
  update public.accounting_journals set status='posted' where id=j.id;
end $$;
revoke all on function public.post_accounting_journal(uuid) from public,anon;
grant execute on function public.post_accounting_journal(uuid) to authenticated;

alter table public.accounting_journals enable row level security;
alter table public.accounting_journal_lines enable row level security;
create policy accounting_journals_read on public.accounting_journals for select to authenticated using(
  public.has_org_role(organization_id,array['owner','director','finance','auditor'])
  or exists(select 1 from public.entity_memberships em where em.entity_id=accounting_journals.entity_id and em.user_id=auth.uid())
);
create policy accounting_journal_lines_read on public.accounting_journal_lines for select to authenticated using(
  exists(select 1 from public.accounting_journals j where j.id=accounting_journal_lines.journal_id and (
    public.has_org_role(j.organization_id,array['owner','director','finance','auditor'])
    or exists(select 1 from public.entity_memberships em where em.entity_id=j.entity_id and em.user_id=auth.uid())
  ))
);
revoke all on public.accounting_journals,public.accounting_journal_lines from public,anon,authenticated;
grant select on public.accounting_journals,public.accounting_journal_lines to authenticated;

create or replace view public.general_journal with (security_invoker=true) as
select j.organization_id,j.entity_id,e.entity_code,e.legal_name,j.period_id,p.period_code,j.id journal_id,j.journal_number,j.journal_date,j.source_type,j.source_id,j.description,j.status,
  l.line_number,a.code account_code,a.name account_name,l.description line_description,l.debit,l.credit,l.counterparty_type,l.counterparty_id,l.project_id,l.cost_center,l.tax_code,l.tax_amount,l.reference_number,j.created_by,j.posted_by,j.posted_at
from public.accounting_journals j join public.accounting_journal_lines l on l.organization_id=j.organization_id and l.journal_id=j.id
join public.finance_accounts a on a.organization_id=l.organization_id and a.id=l.account_id
join public.company_entities e on e.organization_id=j.organization_id and e.id=j.entity_id
join public.accounting_periods p on p.organization_id=j.organization_id and p.id=j.period_id;

create or replace view public.general_ledger_detail with (security_invoker=true) as
select organization_id,entity_id,period_id,account_code,account_name,journal_date,journal_number,source_type,source_id,
  line_number,line_description,counterparty_type,counterparty_id,project_id,cost_center,tax_code,tax_amount,reference_number,debit,credit,
  sum(debit-credit) over(partition by organization_id,entity_id,account_code order by journal_date,journal_number,line_number rows unbounded preceding) running_debit_balance
from public.general_journal where status in ('posted','reversed');

create or replace view public.general_ledger_summary with (security_invoker=true) as
select organization_id,entity_id,period_id,account_code,account_name,sum(debit) debit_total,sum(credit) credit_total,sum(debit-credit) net_debit_balance
from public.general_journal where status in ('posted','reversed') group by organization_id,entity_id,period_id,account_code,account_name;

create or replace view public.subledger_receivables_detail with (security_invoker=true) as
select * from public.general_ledger_detail where counterparty_type='customer';
create or replace view public.subledger_receivables_summary with (security_invoker=true) as
select organization_id,entity_id,period_id,account_code,account_name,counterparty_id,sum(debit) debit_total,sum(credit) credit_total,sum(debit-credit) balance
from public.general_journal where status in ('posted','reversed') and counterparty_type='customer'
group by organization_id,entity_id,period_id,account_code,account_name,counterparty_id;
create or replace view public.subledger_payables_detail with (security_invoker=true) as
select * from public.general_ledger_detail where counterparty_type='vendor';
create or replace view public.subledger_payables_summary with (security_invoker=true) as
select organization_id,entity_id,period_id,account_code,account_name,counterparty_id,sum(debit) debit_total,sum(credit) credit_total,sum(credit-debit) balance
from public.general_journal where status in ('posted','reversed') and counterparty_type='vendor'
group by organization_id,entity_id,period_id,account_code,account_name,counterparty_id;
create or replace view public.employee_advances_detail with (security_invoker=true) as
select * from public.general_ledger_detail where counterparty_type='employee';
create or replace view public.employee_advances_summary with (security_invoker=true) as
select organization_id,entity_id,period_id,account_code,account_name,counterparty_id,sum(debit) debit_total,sum(credit) credit_total,sum(debit-credit) outstanding_balance
from public.general_journal where status in ('posted','reversed') and counterparty_type='employee'
group by organization_id,entity_id,period_id,account_code,account_name,counterparty_id;
create or replace view public.bank_ledger_detail with (security_invoker=true) as
select * from public.general_ledger_detail where counterparty_type='bank';
create or replace view public.bank_ledger_summary with (security_invoker=true) as
select l.organization_id,l.entity_id,l.period_id,l.account_code,l.account_name,e.functional_currency currency,
  sum(l.debit) debit_total,sum(l.credit) credit_total,sum(l.debit-l.credit) bank_balance
from public.general_journal l join public.company_entities e on e.id=l.entity_id and e.organization_id=l.organization_id
where l.status in ('posted','reversed') and l.counterparty_type='bank'
group by l.organization_id,l.entity_id,l.period_id,l.account_code,l.account_name,e.functional_currency;

create or replace view public.trial_balance with (security_invoker=true) as
select s.organization_id,s.entity_id,s.period_id,s.account_code,s.account_name,sum(s.debit_total) debit_total,sum(s.credit_total) credit_total,sum(s.net_debit_balance) net_debit_balance
from public.general_ledger_summary s group by s.organization_id,s.entity_id,s.period_id,s.account_code,s.account_name;

grant select on public.general_journal,public.general_ledger_detail,public.general_ledger_summary,public.subledger_receivables_detail,public.subledger_receivables_summary,public.subledger_payables_detail,public.subledger_payables_summary,public.employee_advances_detail,public.employee_advances_summary,public.bank_ledger_detail,public.bank_ledger_summary,public.trial_balance to authenticated;

comment on table public.company_entities is 'Legal entities and branches belonging to an ERP organization. Operational records are still organization-scoped; journal report access uses entity memberships.';
comment on table public.accounting_journals is 'Double-entry journal header. Posted entries are immutable and must be corrected by reversal.';
comment on view public.general_ledger_detail is 'Auditable general ledger sourced only from posted double-entry journal lines.';
comment on view public.trial_balance is 'Posted trial balance; mapping to PSAK statement presentation is configured separately.';
