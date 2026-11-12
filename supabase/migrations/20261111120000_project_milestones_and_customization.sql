-- ============================================================================
-- 20261111120000_project_milestones_and_customization.sql
-- Modul: Kustomisasi Laporan & Milestone Proyek oleh PM / PIC Proyek
-- Tabel: project_milestones
-- Kolom: id, organization_id, project_id, milestone_number, title, subtitle,
--        status (completed/in_progress/upcoming), progress (0-100),
--        pic_name, period, description, deliverables (text[]), client_actions (text[]),
--        attachment_ids (uuid[]), updated_at, created_at
-- ============================================================================

-- 1. Buat tabel project_milestones
create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.crm_projects(id) on delete cascade,
  milestone_number integer not null check (milestone_number >= 1 and milestone_number <= 20),
  title text not null,
  subtitle text not null default '',
  status text not null default 'upcoming' check (status in ('completed', 'in_progress', 'upcoming')),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  pic_name text not null default '',
  period text not null default '',
  description text not null default '',
  deliverables text[] not null default '{}'::text[],
  client_actions text[] not null default '{}'::text[],
  attachment_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, milestone_number)
);

create index if not exists idx_project_milestones_proj_number on public.project_milestones(project_id, milestone_number);
create index if not exists idx_project_milestones_org on public.project_milestones(organization_id);

-- Helper Security Definer untuk RLS project_milestones agar tidak memanggil gsp_private langsung dari konteks authenticated
create or replace function public.can_read_project_milestones(p_org uuid, p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.can_access_project(p_org, p_project)
    or gsp_private.is_superadmin(p_org)
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
    );
$$;

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

grant execute on function public.can_read_project_milestones(uuid, uuid) to authenticated;
grant execute on function public.can_write_project_milestones(uuid, uuid) to authenticated;

-- 2. Aktifkan RLS & hak akses
alter table public.project_milestones enable row level security;
revoke all on public.project_milestones from public, anon;
grant select, insert, update, delete on public.project_milestones to authenticated;

-- Policy Select: Pengguna internal yang berhak atau klien yang punya akses ke proyek
drop policy if exists "project_milestones_select" on public.project_milestones;
create policy "project_milestones_select" on public.project_milestones
for select to authenticated
using (public.can_read_project_milestones(organization_id, project_id));

-- Policy Modify (Insert/Update/Delete): PM, PIC, Branch Admin, Director, Owner (non-demo)
drop policy if exists "project_milestones_modify" on public.project_milestones;
create policy "project_milestones_modify" on public.project_milestones
for all to authenticated
using (public.can_write_project_milestones(organization_id, project_id))
with check (public.can_write_project_milestones(organization_id, project_id));

drop policy if exists "project_milestones_demo_guard" on public.project_milestones;
drop policy if exists "project_milestones_demo_update_guard" on public.project_milestones;

-- 3. Fungsi Seed Default 5 Tahapan
create or replace function gsp_private.seed_default_milestones_for_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proj public.crm_projects;
  v_count integer;
begin
  select * into v_proj from public.crm_projects where id = p_project_id;
  if v_proj.id is null then
    return;
  end if;

  select count(*) into v_count from public.project_milestones where project_id = p_project_id;
  if v_count > 0 then
    return;
  end if;

  insert into public.project_milestones (
    organization_id, project_id, milestone_number, title, subtitle,
    status, progress, pic_name, period, description,
    deliverables, client_actions, attachment_ids
  ) values
  (
    v_proj.organization_id,
    p_project_id,
    1,
    '1. Kontrak SPK & Administrasi',
    'Penerbitan & pengesahan SPK resmi oleh Direktur Utama',
    'completed',
    100,
    'Legal & Branch Manager ' || coalesce((select name from public.business_units where id = v_proj.branch_id), 'Pusat'),
    'Tahap Awal (Selesai)',
    'Surat Perintah Kerja (SPK) dan Kerangka Acuan Kerja (KAK) telah diverifikasi dan disahkan secara resmi oleh Direksi PT. Global Solusi Prima. Dasar hukum penugasan operasional telah aktif dan terkunci pada sistem ERP.',
    array['Berkas SPK Resmi Bertandatangan', 'Lembar Pagu Anggaran RAB Terkunci', 'Pakta Integritas Pelaksanaan'],
    array['Menerima salinan resmi SPK', 'Menunjuk PIC teknis pendamping dari pihak klien'],
    coalesce(v_proj.attachment_ids, '{}'::uuid[])
  ),
  (
    v_proj.organization_id,
    p_project_id,
    2,
    '2. Tim SDM Ahli & Manpower',
    'Penugasan tenaga ahli tersertifikasi & kesiapan lapangan',
    'completed',
    100,
    'Project Manager (PM) & Tim Teknis',
    'Mobilisasi Lapangan (Selesai)',
    'Penetapan susunan tim tenaga ahli lingkungan (Ketua Tim Ahli Amdal, Ahli Geologi, Ahli Kualitas Udara, Ahli Flora-Fauna, dan Surveyor Lapangan) beserta sertifikasi kompetensi resmi KLHK/BNSP.',
    array['Surat Tugas Resmi Tim Ahli', 'Matriks Kualifikasi Personil', 'Jadwal Timesheet Kerja Lapangan'],
    array['Konfirmasi akses masuk ke area tapak kegiatan', 'Pemberitahuan kepada tim keamanan lokal klien'],
    '{}'::uuid[]
  ),
  (
    v_proj.organization_id,
    p_project_id,
    3,
    '3. Kajian Lapangan & Uji Laboratorium',
    'Pengambilan sampel rona awal & uji parameter lingkungan',
    'in_progress',
    75,
    'Koordinator Tim Lapangan & Lab Terakreditasi KAN',
    'Sedang Berjalan (Estimasi Selesai: 7 Hari Kerja)',
    'Tahapan pengambilan sampel kualitas air permukaan, air tanah, udara ambien, kebisingan, dan getaran di sekitar tapak proyek. Sampel diuji pada laboratorium lingkungan independen terakreditasi KAN untuk penyusunan rona lingkungan awal.',
    array['Berita Acara Sampling Lapangan', 'Sertifikat Hasil Uji Laboratorium (CoA)', 'Peta Titik Koordinat Sampling'],
    array['Meninjau log sampel dan titik koordinat', 'Menyediakan data penunjang operasional tapak'],
    '{}'::uuid[]
  ),
  (
    v_proj.organization_id,
    p_project_id,
    4,
    '4. Koordinasi Amdalnet & Notulensi MoM',
    'Integrasi sistem Amdalnet KLHK & risalah rapat berkala',
    'in_progress',
    40,
    'Spesialis Regulasi & Asisten PM',
    'Berjalan Seiring Progres Lapangan',
    'Penginputan checklist dokumen lingkungan ke dalam portal Amdalnet KLHK serta pelaksanaan rapat koordinasi berkala bersama PIC klien. Seluruh hasil kesepakatan dicatat permanen dalam Notulensi Rapat Resmi (MoM) di portal ini.',
    array['Notulensi Rapat Resmi (MoM)', 'Tanda Terima Pengajuan Amdalnet', 'Matriks Dampak Lingkungan'],
    array['Mengunggah data legalitas lahan via portal ini', 'Memberikan tanggapan / persetujuan pada draf MoM'],
    '{}'::uuid[]
  ),
  (
    v_proj.organization_id,
    p_project_id,
    5,
    '5. Laporan Akhir & Serah Terima',
    'Finalisasi dokumen lengkap & Berita Acara Serah Terima (BAST)',
    'upcoming',
    0,
    'Project Manager & Direktur Teknis',
    'Tahap Finalisasi',
    'Penyusunan draf final Dokumen Kajian Lingkungan (ANDAL, RKL-RPL), konsultasi publik / penilaian teknis, serta penyerahan laporan resmi yang telah dijilid dan disahkan beserta Berita Acara Serah Terima (BAST).',
    array['Laporan Akhir Kajian Lingkungan (Hardcopy & Softcopy)', 'Rekomendasi / Persetujuan Teknis', 'Berita Acara Serah Terima (BAST)'],
    array['Penandatanganan Berita Acara Serah Terima (BAST)', 'Pemberian evaluasi kepuasan layanan proyek'],
    '{}'::uuid[]
  )
  on conflict (project_id, milestone_number) do nothing;
end;
$$;

-- Trigger otomatis saat proyek baru dibuat
create or replace function public.on_crm_project_seed_milestones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform gsp_private.seed_default_milestones_for_project(new.id);
  return new;
end;
$$;

drop trigger if exists trg_crm_project_seed_milestones on public.crm_projects;
create trigger trg_crm_project_seed_milestones
  after insert on public.crm_projects
  for each row execute function public.on_crm_project_seed_milestones();

-- 4. Fungsi RPC get_or_seed_project_milestones
create or replace function public.get_or_seed_project_milestones(p_project_id uuid)
returns setof public.project_milestones
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform gsp_private.seed_default_milestones_for_project(p_project_id);

  return query
  select * from public.project_milestones
  where project_id = p_project_id
    and (
      public.can_access_project(organization_id, project_id)
      or gsp_private.is_superadmin(organization_id)
      or gsp_private.project_internal(organization_id, project_id)
    )
  order by milestone_number asc;
end;
$$;

grant execute on function public.get_or_seed_project_milestones(uuid) to authenticated;

-- 5. Fungsi RPC save_project_milestone untuk update/upsert milestone oleh PM/PIC
create or replace function public.save_project_milestone(
  p_project_id uuid,
  p_milestone_number integer,
  p_title text,
  p_subtitle text,
  p_status text,
  p_progress integer,
  p_pic_name text,
  p_period text,
  p_description text,
  p_deliverables text[],
  p_client_actions text[],
  p_attachment_ids uuid[] default null
)
returns public.project_milestones
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_proj public.crm_projects;
  v_res public.project_milestones;
begin
  perform gsp_private.assert_writable();

  select * into v_proj from public.crm_projects where id = p_project_id;
  if v_proj.id is null then
    raise exception 'Proyek tidak ditemukan.' using errcode = 'P0002';
  end if;

  if not (
    gsp_private.is_superadmin(v_proj.organization_id)
    or gsp_private.project_internal(v_proj.organization_id, p_project_id)
    or (v_proj.branch_id is not null and (
      gsp_private.can_access_business(v_proj.organization_id, v_proj.branch_id, 'sales')
      or gsp_private.can_access_business(v_proj.organization_id, v_proj.branch_id, 'operations')
    ))
  ) then
    raise exception 'Akses ditolak: Hanya PM / PIC / staf proyek internal yang dapat mengubah milestone.' using errcode = '42501';
  end if;

  insert into public.project_milestones (
    organization_id,
    project_id,
    milestone_number,
    title,
    subtitle,
    status,
    progress,
    pic_name,
    period,
    description,
    deliverables,
    client_actions,
    attachment_ids,
    updated_at
  ) values (
    v_proj.organization_id,
    p_project_id,
    p_milestone_number,
    btrim(p_title),
    coalesce(btrim(p_subtitle), ''),
    p_status,
    least(100, greatest(0, coalesce(p_progress, 0))),
    coalesce(btrim(p_pic_name), ''),
    coalesce(btrim(p_period), ''),
    coalesce(btrim(p_description), ''),
    coalesce(p_deliverables, '{}'::text[]),
    coalesce(p_client_actions, '{}'::text[]),
    coalesce(p_attachment_ids, '{}'::uuid[]),
    now()
  )
  on conflict (project_id, milestone_number) do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    status = excluded.status,
    progress = excluded.progress,
    pic_name = excluded.pic_name,
    period = excluded.period,
    description = excluded.description,
    deliverables = excluded.deliverables,
    client_actions = excluded.client_actions,
    attachment_ids = coalesce(excluded.attachment_ids, project_milestones.attachment_ids),
    updated_at = now()
  returning * into v_res;

  return v_res;
end;
$$;

grant execute on function public.save_project_milestone(uuid, integer, text, text, text, integer, text, text, text, text[], text[], uuid[]) to authenticated;

-- 6. Izinkan klien & pengguna berhak membaca lampiran yang tertaut pada project_milestones
create or replace function gsp_private.sales_attachment_reader(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.procurement_attachments a
    where a.id = p_id
      and (
        a.uploaded_by = auth.uid()

        or exists(
          select 1 from public.work_assignments j
          where j.user_id = auth.uid()
            and j.organization_id = a.organization_id
            and (j.branch_id is null or j.branch_id = a.branch_id)
            and j.job_role in ('owner', 'president', 'finance_director', 'technical_director', 'branch_manager')
        )

        or exists(
          select 1 from public.sales_documents d
          where d.organization_id = a.organization_id
            and a.id = any(d.attachment_ids)
            and (
              d.kind = 'spk'
              or d.status <> 'draft'
              or gsp_private.sales_client_reader(d.organization_id)
              or gsp_private.sales_document_reader(d.organization_id, d.branch_id)
            )
        )

        or exists(
          select 1 from public.crm_projects p
          where p.organization_id = a.organization_id
            and (
              a.id = any(p.attachment_ids)
              or exists(
                select 1 from public.sales_documents sd
                where sd.id = p.spk_id and a.id = any(sd.attachment_ids)
              )
            )
            and (
              public.can_access_project(p.organization_id, p.id)
              or gsp_private.can_decide_project(p)
              or gsp_private.can_review_project(p)
              or gsp_private.can_access_business(p.organization_id, p.branch_id, 'sales')
              or gsp_private.can_access_business(p.organization_id, p.branch_id, 'procurement')
            )
        )

        or exists(
          select 1 from public.project_milestones pm
          where pm.organization_id = a.organization_id
            and a.id = any(pm.attachment_ids)
            and public.can_access_project(pm.organization_id, pm.project_id)
        )
      )
  );
$$;

-- 7. Seed otomatis untuk semua proyek yang sudah ada
do $$
declare
  v_p record;
begin
  for v_p in (select id from public.crm_projects) loop
    perform gsp_private.seed_default_milestones_for_project(v_p.id);
  end loop;
end $$;

notify pgrst, 'reload schema';
