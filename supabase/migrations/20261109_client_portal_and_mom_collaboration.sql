-- Migration: 20261109_client_portal_and_mom_collaboration.sql
-- Fitur: Laporan Proyek & Permintaan Data 2 Arah (Termasuk Checklist Amdalnet),
-- Serta Modul Minutes of Meeting (MoM) dengan Smart OCR & Komentar Tanya Jawab.

-- 1. Tambah kolom lampiran dan metadata pada project_portal_entries
alter table public.project_portal_entries 
  add column if not exists attachment_ids uuid[] not null default '{}',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 2. Buat tabel komentar untuk tanya jawab 2 arah pada portal & MoM
create table if not exists public.project_portal_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  entry_id uuid not null references public.project_portal_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  sender_name text not null,
  sender_role text not null check (sender_role in ('client', 'pic', 'team', 'director', 'owner')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists project_portal_comments_entry on public.project_portal_comments(entry_id, created_at);

-- 3. RLS pada project_portal_comments
alter table public.project_portal_comments enable row level security;

drop policy if exists "project_portal_comments_read" on public.project_portal_comments;
create policy "project_portal_comments_read" on public.project_portal_comments
for select to authenticated
using (
  exists (
    select 1 from public.project_portal_entries e
    where e.id = project_portal_comments.entry_id
    and public.can_access_project(e.organization_id, e.project_id)
  )
);

drop policy if exists "project_portal_comments_insert" on public.project_portal_comments;
create policy "project_portal_comments_insert" on public.project_portal_comments
for insert to authenticated
with check (
  exists (
    select 1 from public.project_portal_entries e
    where e.id = project_portal_comments.entry_id
    and public.can_access_project(e.organization_id, e.project_id)
  )
);

-- 4. RPC untuk menyimpan komentar 2 arah
create or replace function gsp_private.api_save_portal_comment(
  p_entry_id uuid,
  p_message text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_entry public.project_portal_entries;
  v_user_id uuid := auth.uid();
  v_name text;
  v_role text := 'team';
  v_new_id uuid;
  v_is_owner boolean;
  v_is_dir boolean;
  v_membership public.project_memberships;
begin
  if v_user_id is null then
    raise exception 'Silakan masuk kembali.' using errcode = '42501';
  end if;

  select * into v_entry from public.project_portal_entries where id = p_entry_id;
  if v_entry.id is null or not public.can_access_project(v_entry.organization_id, v_entry.project_id) then
    raise exception 'Akses terhadap dokumen atau MoM ini ditolak.' using errcode = '42501';
  end if;

  if nullif(btrim(p_message), '') is null then
    raise exception 'Komentar tidak boleh kosong.';
  end if;

  -- Tentukan nama & role pengirim
  select coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email) into v_name
  from auth.users where id = v_user_id;

  v_is_owner := gsp_private.is_superadmin(v_entry.organization_id);
  v_is_dir := exists (
    select 1 from public.work_assignments w
    where w.organization_id = v_entry.organization_id and w.user_id = v_user_id
    and w.branch_id is null and w.job_role in ('president', 'finance_director', 'technical_director')
  );

  select * into v_membership from public.project_memberships
  where organization_id = v_entry.organization_id and project_id = v_entry.project_id and user_id = v_user_id and is_active;

  if v_is_owner then
    v_role := 'owner';
  elsif v_is_dir then
    v_role := 'director';
  elsif v_membership.member_type = 'client' then
    v_role := 'client';
  else
    v_role := 'pic';
  end if;

  insert into public.project_portal_comments(
    organization_id, entry_id, user_id, sender_name, sender_role, message
  ) values (
    v_entry.organization_id, v_entry.id, v_user_id, coalesce(v_name, 'Pengguna'), v_role, btrim(p_message)
  ) returning id into v_new_id;

  return v_new_id;
end;
$$;

create or replace function public.save_portal_comment(
  p_entry_id uuid,
  p_message text
) returns uuid
language sql security invoker set search_path='' as $$
  select gsp_private.api_save_portal_comment(p_entry_id, p_message);
$$;

-- 5. RPC untuk menyimpan entri portal dengan lampiran & metadata (Amdalnet checklist, MoM OCR result)
create or replace function gsp_private.api_save_project_portal_entry_v2(
  p_org uuid,
  p_project uuid,
  p_kind text,
  p_audience text,
  p_title text,
  p_body text,
  p_attachments uuid[] default '{}',
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_id uuid;
begin
  if not gsp_private.project_internal(p_org, p_project) then
    if p_kind <> 'request' or p_audience <> 'external' or not public.can_access_project(p_org, p_project)
       or not exists (
         select 1 from public.project_memberships
         where project_id = p_project and user_id = auth.uid() and can_submit and is_active
       ) then
      raise exception 'Akses kirim informasi proyek ditolak.' using errcode = '42501';
    end if;
  end if;

  if nullif(btrim(p_title), '') is null or length(p_title) > 200 or nullif(btrim(p_body), '') is null or length(p_body) > 50000 then
    raise exception 'Judul dan isi informasi proyek wajib diisi.';
  end if;

  insert into public.project_portal_entries(
    organization_id, project_id, kind, audience, title, body, created_by, attachment_ids, metadata
  ) values (
    p_org, p_project, p_kind, p_audience, btrim(p_title), btrim(p_body), auth.uid(), coalesce(p_attachments, '{}'), coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.save_project_portal_entry_v2(
  p_org uuid,
  p_project uuid,
  p_kind text,
  p_audience text,
  p_title text,
  p_body text,
  p_attachments uuid[] default '{}',
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language sql security invoker set search_path='' as $$
  select gsp_private.api_save_project_portal_entry_v2(
    p_org, p_project, p_kind, p_audience, p_title, p_body, p_attachments, p_metadata
  );
$$;

grant execute on function public.save_portal_comment(uuid, text) to authenticated;
grant execute on function public.save_project_portal_entry_v2(uuid, uuid, text, text, text, text, uuid[], jsonb) to authenticated;

notify pgrst, 'reload schema';
