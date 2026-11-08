-- ============================================================================
-- 20261109_sales_invoicing_and_milestones.sql
-- Teknis Penagihan & Pembayaran Proyek Penjualan Berbasis Termin:
-- 1. Penambahan kolom payment_terms pada public.crm_projects
-- 2. Pembuatan tabel public.sales_invoices (Invoice Penjualan & Kuitansi Pelunasan)
-- 3. Fungsi penerbitan Invoice resmi (INV/{CLIENT}/{CABANG}/{MMYY}.{SEQ})
-- 4. Fungsi pencatatan Pembayaran & penerbitan Kuitansi resmi (KWT/GSP-{CABANG}/{MMYY}.{SEQ})
-- ============================================================================

-- 1. Tambah kolom payment_terms pada crm_projects jika belum ada
alter table public.crm_projects add column if not exists payment_terms jsonb default '[]'::jsonb;

-- 2. Buat tabel sales_invoices
create table if not exists public.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.business_units(id) on delete restrict,
  project_id uuid references public.crm_projects(id) on delete set null,
  spk_id uuid references public.sales_documents(id) on delete set null,
  client_id uuid not null references public.sales_clients(id) on delete restrict,
  invoice_number text not null,
  term_name text not null,
  term_index integer not null default 1,
  percentage numeric(5,2) not null default 0,
  invoice_date date not null default current_date,
  due_date date not null,
  amount numeric(15,2) not null default 0, -- DPP
  vat_rate numeric(5,2) not null default 11.00,
  vat_amount numeric(15,2) not null default 0,
  wht_rate numeric(5,2) not null default 2.00,
  wht_amount numeric(15,2) not null default 0,
  total_amount numeric(15,2) not null default 0, -- DPP + PPN
  net_receivable numeric(15,2) not null default 0, -- Total - PPh 23
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'cancelled')),
  paid_amount numeric(15,2) default 0,
  paid_at timestamptz,
  payment_method text check (payment_method is null or payment_method in ('bank_transfer', 'cash', 'giro', 'other')),
  bank_name text,
  bank_account_number text,
  receipt_number text, -- KWT/GSP-{CABANG}/{MMYY}.{SEQ}
  bank_reference text,
  wht_proof_number text, -- Nomor Bukti Potong PPh 23
  notes text,
  attachment_ids uuid[] default '{}'::uuid[],
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, invoice_number)
);

create index if not exists sales_invoices_org_branch on public.sales_invoices(organization_id, branch_id);
create index if not exists sales_invoices_project on public.sales_invoices(organization_id, project_id);
create index if not exists sales_invoices_client on public.sales_invoices(organization_id, client_id);
create index if not exists sales_invoices_status on public.sales_invoices(organization_id, status);

-- Enable RLS
alter table public.sales_invoices enable row level security;

-- Policies
drop policy if exists sales_invoices_select on public.sales_invoices;
create policy sales_invoices_select on public.sales_invoices
  for select using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = sales_invoices.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists sales_invoices_insert on public.sales_invoices;
create policy sales_invoices_insert on public.sales_invoices
  for insert with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = sales_invoices.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists sales_invoices_update on public.sales_invoices;
create policy sales_invoices_update on public.sales_invoices
  for update using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = sales_invoices.organization_id
        and m.user_id = auth.uid()
    )
  );

-- 3. Perbarui fungsi api_save_project_planning untuk menyertakan payment_terms
create or replace function gsp_private.api_save_project_planning(
  p_id uuid,
  p_version integer,
  p_payload jsonb,
  p_submit boolean default false
) returns void
language plpgsql security definer set search_path='' as $$
declare
  p public.crm_projects;
  v_rab_total numeric(15,2) := 0;
  v_attachments uuid[];
  v_next_status text;
  v_item jsonb;
begin
  select * into p from public.crm_projects where id = p_id for update;
  if p.id is null or not gsp_private.can_edit_project_planning(p) then
    raise exception 'Akses perancangan proyek ditolak atau status proyek sudah terkunci.' using errcode = '42501';
  end if;
  if p.version is distinct from p_version then
    raise exception 'Versi proyek telah berubah. Muat ulang halaman dan periksa kembali.';
  end if;

  -- Hitung total RAB dari breakdown
  if p_payload ? 'rab_breakdown' and jsonb_typeof(p_payload->'rab_breakdown') = 'array' then
    for v_item in select * from jsonb_array_elements(p_payload->'rab_breakdown') loop
      v_rab_total := v_rab_total + coalesce((v_item->>'total')::numeric, 0);
    end loop;
  else
    v_rab_total := coalesce((p_payload->>'rab_total')::numeric, 0);
  end if;

  -- Validasi lampiran jika ada
  select coalesce(array_agg(value::uuid), '{}') into v_attachments
  from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids', '[]'));

  -- Jika submit ke direksi, periksa kelengkapan minimum
  if coalesce(p_submit, false) then
    if nullif(btrim(p_payload->>'work_details'), '') is null then
      raise exception 'Rincian teknis pekerjaan dan kebutuhan proyek wajib diisi sebelum submit.';
    end if;
    if not (p_payload ? 'manpower') or jsonb_array_length(coalesce(p_payload->'manpower', '[]'::jsonb)) = 0 then
      raise exception 'Daftar personil / tim SDM proyek wajib diisi minimal 1 penanggung jawab.';
    end if;
    if v_rab_total <= 0 then
      raise exception 'Rincian Rencana Anggaran Biaya (RAB) wajib diisi dengan nominal valid.';
    end if;
    v_next_status := 'director_review';
  else
    v_next_status := p.approval_status;
  end if;

  update public.crm_projects
  set work_details = btrim(coalesce(p_payload->>'work_details', work_details)),
      manpower = coalesce(p_payload->'manpower', manpower),
      timesheet_schedule = coalesce(p_payload->'timesheet_schedule', timesheet_schedule),
      rab_breakdown = coalesce(p_payload->'rab_breakdown', rab_breakdown),
      rab_total = v_rab_total,
      payment_terms = coalesce(p_payload->'payment_terms', payment_terms),
      attachment_ids = v_attachments,
      starts_on = coalesce(nullif(p_payload->>'starts_on', '')::date, starts_on),
      ends_on = coalesce(nullif(p_payload->>'ends_on', '')::date, ends_on),
      approval_status = v_next_status,
      submitted_at = case when p_submit then now() else submitted_at end,
      review_note = case when p_submit then null else review_note end,
      version = version + 1,
      updated_at = now()
  where id = p.id;

  perform gsp_private.procurement_log(
    p.organization_id, p.branch_id, p.id, 'project',
    case when p_submit then 'submitted_to_directors' else 'planning_updated' end,
    null,
    jsonb_build_object('rab_total', v_rab_total, 'submit', p_submit)
  );
end;
$$;

-- 4. Fungsi Penerbitan Invoice Resmi
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

-- 5. Fungsi Pencatatan Pembayaran & Kuitansi Resmi
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

notify pgrst, 'reload schema';
