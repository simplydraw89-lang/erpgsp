-- ============================================================================
-- Migration: 20261112000200_tax_fiscal_reconciliation.sql
-- Tujuan:
--   Mendukung modul Perpajakan lengkap (PPN Masukan/Keluaran, PPh, dan
--   Rekonsiliasi Fiskal SPT Tahunan Badan).
-- ============================================================================

begin;

create table if not exists public.tax_fiscal_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  fiscal_year integer not null check (fiscal_year between 2020 and 2100),
  adjustment_type text not null check (adjustment_type in ('positive', 'negative')),
  difference_kind text not null default 'permanent' check (difference_kind in ('permanent', 'temporary')),
  account_code text,
  description text not null,
  amount numeric(18, 2) not null check (amount > 0),
  tax_rule_ref text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists tax_fiscal_adjustments_org_year_idx
  on public.tax_fiscal_adjustments (organization_id, fiscal_year desc, created_at desc);

alter table public.tax_fiscal_adjustments enable row level security;

drop policy if exists tax_fiscal_adjustments_read on public.tax_fiscal_adjustments;
create policy tax_fiscal_adjustments_read on public.tax_fiscal_adjustments
  for select to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      public.has_org_role(organization_id, array['owner', 'director', 'finance', 'auditor'])
      or public.has_business_job(organization_id, null, array['accounting_tax', 'finance'])
    )
  );

create or replace function public.save_fiscal_adjustment(
  p_org uuid,
  p_fiscal_year integer,
  p_adjustment_type text,
  p_difference_kind text,
  p_account_code text,
  p_description text,
  p_amount numeric,
  p_tax_rule_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform gsp_private.assert_writable();
  if not (
    public.has_org_role(p_org, array['owner', 'finance'])
    or public.has_business_job(p_org, null, array['accounting_tax', 'finance'])
  ) then
    raise exception 'Anda tidak memiliki izin mencatat koreksi fiskal.';
  end if;

  if p_adjustment_type not in ('positive', 'negative') then
    raise exception 'Jenis koreksi harus positive atau negative.';
  end if;
  if p_difference_kind not in ('permanent', 'temporary') then
    raise exception 'Sifat beda harus permanent atau temporary.';
  end if;
  if trim(coalesce(p_description, '')) = '' or coalesce(p_amount, 0) <= 0 then
    raise exception 'Uraian dan nominal koreksi fiskal wajib diisi.';
  end if;

  insert into public.tax_fiscal_adjustments (
    organization_id, fiscal_year, adjustment_type, difference_kind,
    account_code, description, amount, tax_rule_ref, created_by
  ) values (
    p_org, p_fiscal_year, p_adjustment_type, p_difference_kind,
    nullif(trim(coalesce(p_account_code, '')), ''), trim(p_description), p_amount,
    nullif(trim(coalesce(p_tax_rule_ref, '')), ''), auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.delete_fiscal_adjustment(
  p_org uuid,
  p_adjustment_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform gsp_private.assert_writable();
  if not (
    public.has_org_role(p_org, array['owner', 'finance'])
    or public.has_business_job(p_org, null, array['accounting_tax', 'finance'])
  ) then
    raise exception 'Anda tidak memiliki izin menghapus koreksi fiskal.';
  end if;

  delete from public.tax_fiscal_adjustments
  where id = p_adjustment_id and organization_id = p_org;

  if not found then
    raise exception 'Data koreksi fiskal tidak ditemukan.';
  end if;
end;
$$;

revoke all on function public.save_fiscal_adjustment(uuid, integer, text, text, text, text, numeric, text) from anon, public;
grant execute on function public.save_fiscal_adjustment(uuid, integer, text, text, text, text, numeric, text) to authenticated;
revoke all on function public.delete_fiscal_adjustment(uuid, uuid) from anon, public;
grant execute on function public.delete_fiscal_adjustment(uuid, uuid) to authenticated;

commit;
