-- Migration: 20261108_unblock_crm_projects_from_legacy_guard.sql
-- Membuka kunci tabel crm_projects dari trigger proteksi data lama (guard_legacy_scope)
-- agar Direktur Utama, Direksi, dan Cabang dapat otomatis membuat dan mengelola Proyek.

-- 1. Lepas trigger scoped_legacy_write dan policy scoped_legacy_read dari crm_projects
drop trigger if exists scoped_legacy_write on public.crm_projects;
drop policy if exists scoped_legacy_read on public.crm_projects;
drop trigger if exists scoped_legacy_write on public.operational_work_items;
drop policy if exists scoped_legacy_read on public.operational_work_items;

-- 2. Perbarui fungsi guard_legacy_scope agar secara permanen mengecualikan tabel proyek & operasional
create or replace function gsp_private.guard_legacy_scope() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  org uuid;
  j public.accounting_journals;
  d public.purchase_requests;
begin
  org := case when tg_op = 'DELETE' then old.organization_id else new.organization_id end;

  -- Pengecualian resmi: tabel proyek, operasional, dan lampiran bukan tabel data lama
  if tg_table_name in (
    'crm_projects',
    'operational_work_items',
    'project_access_scopes',
    'project_memberships',
    'project_portal_entries',
    'procurement_attachments'
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
    select * into d from public.purchase_requests where id = j.source_id and organization_id = org;
    if d.id is not null and j.source_type in ('payable', 'payment') and j.entity_id = (select entity_id from public.business_units where id = d.branch_id)
      and ((j.source_type = 'payable' and d.status = 'accounting_review' and gsp_private.has_job(org, null, array['accounting_tax']))
      or (j.source_type = 'payment' and d.status = 'payment_ready' and gsp_private.has_job(org, null, array['finance']))) then
      return new;
    end if;
  end if;

  raise exception 'Akses data lama belum tersedia untuk pengguna perusahaan; gunakan pengajuan cabang.' using errcode = '42501';
end;
$$;

-- 3. Kebijakan RLS crm_projects yang mendukung multi-cabang dan Direksi
create or replace function gsp_private.can_read_project(p public.crm_projects) returns boolean
language sql stable security definer set search_path = '' as $$
  select gsp_private.is_superadmin(p.organization_id)
  or gsp_private.has_job(p.organization_id, null, array['president', 'technical_director', 'finance_director', 'accounting_tax', 'finance'])
  or (p.branch_id is not null and gsp_private.can_access_business(p.organization_id, p.branch_id, 'operations'))
  or (p.branch_id is not null and gsp_private.can_access_business(p.organization_id, p.branch_id, 'sales'))
  or p.created_by = auth.uid()
  or p.project_manager_id = auth.uid();
$$;

drop policy if exists "organization members can read CRM projects" on public.crm_projects;
drop policy if exists "authorized roles can manage CRM projects" on public.crm_projects;
drop policy if exists "crm_projects_branch_read" on public.crm_projects;
drop policy if exists "crm_projects_branch_write" on public.crm_projects;

create policy "crm_projects_branch_read" on public.crm_projects for select to authenticated
using (gsp_private.can_read_project(crm_projects));

create policy "crm_projects_branch_write" on public.crm_projects for all to authenticated
using (gsp_private.can_read_project(crm_projects))
with check (gsp_private.can_read_project(crm_projects));
