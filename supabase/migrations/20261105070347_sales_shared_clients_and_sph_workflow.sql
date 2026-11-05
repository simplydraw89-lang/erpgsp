-- Shared marketing directory. Historical branch_id is retained as provenance,
-- never as a client ownership/access boundary. Legacy API signatures remain.
alter table public.work_assignments drop constraint work_assignments_job_role_check;
alter table public.work_assignments add constraint work_assignments_job_role_check check(job_role in ('president','finance_director','technical_director','finance','accounting_tax','hr','branch_manager','admin','project_manager','support','other','marketing'));

create function gsp_private.sales_internal_member(p_org uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select gsp_private.is_superadmin(p_org) or exists(
  select 1 from public.organization_members m join public.person_profiles p using(organization_id,user_id)
  where m.organization_id=p_org and m.user_id=auth.uid() and p.relationship_status in ('probation','contract','permanent'))
$$;
create function gsp_private.sales_client_reader(p_org uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select gsp_private.is_superadmin(p_org) or (gsp_private.sales_internal_member(p_org) and exists(
  select 1 from public.work_assignments w where w.organization_id=p_org and w.user_id=auth.uid()
  and w.job_role in ('president','finance_director','technical_director','branch_manager','admin','project_manager','marketing')))
$$;
create function gsp_private.sales_document_reader(p_org uuid,p_branch uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (gsp_private.sales_client_reader(p_org) and gsp_private.can_access_business(p_org,p_branch,'sales'))
 or gsp_private.has_job(p_org,null,array['accounting_tax','finance'])
$$;
create function public.can_register_sales_client(p_org uuid) returns boolean language sql stable security invoker set search_path='' as $$select gsp_private.sales_internal_member(p_org)$$;
create function public.can_read_sales_clients(p_org uuid) returns boolean language sql stable security invoker set search_path='' as $$select gsp_private.sales_client_reader(p_org)$$;
create function public.can_read_sales_document(p_org uuid,p_branch uuid) returns boolean language sql stable security invoker set search_path='' as $$select gsp_private.sales_document_reader(p_org,p_branch)$$;

alter table public.sales_clients alter column branch_id drop not null;
alter table public.sales_clients add column phone text;
alter table public.sales_clients add column email text;
alter table public.sales_clients add column additional_information text;
alter table public.sales_clients add constraint sales_clients_company_id unique(organization_id,id);
do $$ declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.sales_documents'::regclass and confrelid='public.sales_clients'::regclass loop
  execute format('alter table public.sales_documents drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.sales_documents add constraint sales_documents_company_client foreign key(organization_id,client_id) references public.sales_clients(organization_id,id);
create index sales_clients_company_name on public.sales_clients(organization_id,lower(name),id);
-- Refuse silently merging pre-existing duplicate tax identities.
create unique index sales_clients_company_npwp on public.sales_clients(organization_id,(regexp_replace(npwp,'[^0-9]','','g'))) where npwp is not null and regexp_replace(npwp,'[^0-9]','','g')<>'';
drop policy client_branch_read on public.sales_clients;
create policy sales_clients_role_read on public.sales_clients for select to authenticated using(public.can_read_sales_clients(organization_id));
alter table public.procurement_events alter column branch_id drop not null;
drop policy event_branch_read on public.procurement_events;
create policy event_branch_read on public.procurement_events for select to authenticated using(
 case when entity_type='client' then public.can_read_sales_clients(organization_id)
 when entity_type in ('sph','spk') then exists(select 1 from public.sales_documents d where d.id=procurement_events.entity_id and d.organization_id=procurement_events.organization_id)
 else public.can_access_business(organization_id,branch_id,'procurement') end);
drop policy sales_branch_read on public.sales_documents;
create policy sales_document_role_read on public.sales_documents for select to authenticated using(public.can_read_sales_document(organization_id,branch_id) and (kind='spk' or status<>'draft' or public.can_read_sales_clients(organization_id)));

create or replace function gsp_private.api_save_sales_client(p_org uuid,p_branch uuid,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare i uuid; phone text; tax text; mail text; industry text;
begin
 if not gsp_private.sales_internal_member(p_org) then raise exception 'Pendaftaran klien hanya untuk pengguna internal perusahaan.' using errcode='42501';end if;
 phone:=btrim(coalesce(p_payload->>'phone',p_payload->>'contact',''));tax:=regexp_replace(coalesce(p_payload->>'npwp',''),'[^0-9]','','g');
 mail:=lower(btrim(coalesce(p_payload->>'email','')));industry:=p_payload->>'industry';
 if nullif(btrim(p_payload->>'name'),'') is null or length(btrim(p_payload->>'name'))>300
 or nullif(btrim(p_payload->>'address'),'') is null or length(p_payload->>'address')>1000 then raise exception 'Nama dan alamat klien wajib diisi dengan benar.';end if;
 if length(tax) not in (15,16) or coalesce(p_payload->>'npwp','') !~ '^[0-9.[:space:]-]+$' then raise exception 'NPWP wajib berisi 15 atau 16 digit; format ini belum memverifikasi NPWP secara online.';end if;
 if length(regexp_replace(phone,'[^0-9]','','g')) not between 7 and 20 or length(phone)>60 or phone !~ '^[+0-9() .-]+$' then raise exception 'Nomor kontak tidak valid.';end if;
 if length(mail)>254 or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Email klien tidak valid.';end if;
 if industry is null or industry not in ('Mining','Migas','Industri','Umum') then raise exception 'Pilih jenis usaha Mining, Migas, Industri atau Umum.';end if;
 if length(coalesce(p_payload->>'additional_information',''))>5000 then raise exception 'Informasi lainnya maksimal 5000 karakter.';end if;
 if exists(select 1 from public.sales_clients where organization_id=p_org and regexp_replace(npwp,'[^0-9]','','g')=tax) then raise exception 'Klien dengan NPWP ini sudah terdaftar. Hubungi pengguna yang berhak melihat daftar klien.';end if;
 insert into public.sales_clients(organization_id,branch_id,name,address,npwp,contact,phone,email,industry,additional_information,created_by)
 values(p_org,null,btrim(p_payload->>'name'),btrim(p_payload->>'address'),tax,phone,phone,mail,industry,nullif(btrim(p_payload->>'additional_information'),''),auth.uid()) returning id into i;
 perform gsp_private.procurement_log(p_org,null,i,'client','created',null,jsonb_build_object('shared_company_directory',true));return i;
end $$;

alter table public.sales_documents drop constraint sales_documents_status_check;
alter table public.sales_documents add constraint sales_documents_status_check check(status in ('draft','branch_review','director_review','accounting_review','finance_review','ready','rejected','accepted'));
alter table public.sales_documents add column version integer not null default 1;
alter table public.sales_documents add column work_area text;
alter table public.sales_documents add column work_scopes text[] not null default '{}';
alter table public.sales_documents add column deal_status text check(deal_status in ('sudah_deal','belum_deal'));
alter table public.sales_documents add column valid_until date;
alter table public.sales_documents add column client_snapshot jsonb not null default '{}';
alter table public.sales_documents add column submitted_at timestamptz;
alter table public.sales_documents add column review_note text;
create index sales_documents_review_queue on public.sales_documents(organization_id,branch_id,status,submitted_at) where kind='sph' and status in ('branch_review','director_review','accounting_review','finance_review');
alter table public.sales_documents add constraint sph_work_scopes check(work_scopes <@ array['Pertek','UKL/UPL','Amdal','DELH','DPLH','Andalalin','LB 3','Lainnya']::text[] and cardinality(work_scopes)<=8);

create function gsp_private.validate_sales_attachments(p_org uuid,p_branch uuid,p_attachments uuid[]) returns void
language plpgsql set search_path='' as $$
begin
 if p_attachments is null or cardinality(p_attachments)>10 or (select count(distinct x) from unnest(p_attachments) x)<>cardinality(p_attachments) then raise exception 'Maksimal 10 lampiran berbeda.';end if;
 if exists(select 1 from unnest(p_attachments) x where not exists(select 1 from public.procurement_attachments a where a.id=x and a.organization_id=p_org and a.branch_id=p_branch and a.domain='sales')) then raise exception 'Lampiran tidak sesuai cabang atau domain penjualan.';end if;
end $$;

create function gsp_private.api_save_sph_request(p_org uuid,p_branch uuid,p_payload jsonb,p_id uuid default null,p_version integer default null,p_submit boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.sales_documents; c public.sales_clients; i uuid; attachments uuid[]; scopes text[]; next_status text; snapshot jsonb;
begin
 if not gsp_private.sales_client_reader(p_org) or not gsp_private.can_access_business(p_org,p_branch,'sales') then raise exception 'Akses pengajuan SPH cabang ditolak.' using errcode='42501';end if;
 if not exists(select 1 from public.business_units where id=p_branch and organization_id=p_org and kind='branch') then raise exception 'Pilih cabang operasional yang diizinkan.';end if;
 if p_id is not null then select * into d from public.sales_documents where id=p_id for update;end if;
 if d.id is not null then
  if d.organization_id<>p_org or d.branch_id<>p_branch or d.kind<>'sph' or (d.created_by<>auth.uid() and not gsp_private.is_superadmin(p_org)) then raise exception 'Draft SPH bukan milik Anda atau cabang berubah.' using errcode='42501';end if;
  if d.version is distinct from p_version or d.status not in ('draft','rejected') then raise exception 'Versi SPH berubah atau dokumen sudah terkunci.';end if;
 elsif p_version is not null then raise exception 'Draft SPH tidak ditemukan.';
 end if;
 select * into c from public.sales_clients where id=nullif(p_payload->>'client_id','')::uuid and organization_id=p_org;
 if c.id is null then raise exception 'Klien tidak ditemukan pada perusahaan ini.';end if;
 if nullif(btrim(p_payload->>'title'),'') is null or length(p_payload->>'title')>300 then raise exception 'Judul penawaran wajib diisi, maksimal 300 karakter.';end if;
 select coalesce(array_agg(value::uuid),'{}') into attachments from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids','[]'));
 perform gsp_private.validate_sales_attachments(p_org,p_branch,attachments);
 if d.id is not null and not d.attachment_ids <@ attachments then raise exception 'Lampiran tersimpan tidak boleh dihapus.';end if;
 select coalesce(array_agg(value),'{}') into scopes from jsonb_array_elements_text(coalesce(p_payload->'work_scopes','[]'));
 if not scopes <@ array['Pertek','UKL/UPL','Amdal','DELH','DPLH','Andalalin','LB 3','Lainnya']::text[] or cardinality(scopes)<>(select count(distinct x) from unnest(scopes) x) then raise exception 'Lingkup pekerjaan tidak valid atau duplikat.';end if;
 if coalesce(p_submit,false) then
  if (p_payload->>'confirmed')::boolean is distinct from true then raise exception 'Konfirmasi kebenaran data sebelum mengajukan SPH.';end if;
  if nullif(btrim(p_payload->>'work_area'),'') is null or cardinality(scopes)=0 or nullif(p_payload->>'deal_status','') is null or nullif(p_payload->>'valid_until','') is null then raise exception 'Lengkapi daerah pengerjaan, lingkup, status deal dan masa berlaku sebelum submit.';end if;
  if (p_payload->>'valid_until')::date < (now() at time zone 'Asia/Bangkok')::date then raise exception 'Masa berlaku SPH sudah berakhir.';end if;
  if c.email is null or c.phone is null or c.industry not in ('Mining','Migas','Industri','Umum') or length(regexp_replace(coalesce(c.npwp,''),'[^0-9]','','g')) not in (15,16) then raise exception 'Lengkapi identitas klien yang valid sebelum submit SPH.';end if;
 end if;
 snapshot:=jsonb_build_object('id',c.id,'name',c.name,'address',c.address,'npwp',c.npwp,'phone',c.phone,'email',c.email,'industry',c.industry);
 if d.id is null then
  i:=coalesce(p_id,gen_random_uuid());
  insert into public.sales_documents(id,organization_id,branch_id,client_id,kind,title,source,notes,attachment_ids,work_area,work_scopes,deal_status,valid_until,client_snapshot,created_by)
  values(i,p_org,p_branch,c.id,'sph',btrim(p_payload->>'title'),'company',nullif(btrim(p_payload->>'notes'),''),attachments,nullif(btrim(p_payload->>'work_area'),''),scopes,nullif(p_payload->>'deal_status',''),nullif(p_payload->>'valid_until','')::date,snapshot,auth.uid());
 else
  i:=d.id;
  update public.sales_documents set client_id=c.id,title=btrim(p_payload->>'title'),notes=nullif(btrim(p_payload->>'notes'),''),attachment_ids=attachments,
   work_area=nullif(btrim(p_payload->>'work_area'),''),work_scopes=scopes,deal_status=nullif(p_payload->>'deal_status',''),valid_until=nullif(p_payload->>'valid_until','')::date,client_snapshot=snapshot,status='draft',review_note=null,version=version+1 where id=i;
 end if;
 perform gsp_private.procurement_log(p_org,p_branch,i,'sph',case when d.id is null then 'draft_created' else 'draft_updated' end);
 if coalesce(p_submit,false) then
  next_status:=case when exists(select 1 from public.work_assignments where organization_id=p_org and user_id=auth.uid() and branch_id=p_branch and job_role='branch_manager') then 'director_review' else 'branch_review' end;
  update public.sales_documents set status=next_status,submitted_at=now(),version=version+1 where id=i;
  perform gsp_private.procurement_log(p_org,p_branch,i,'sph','submitted',null,jsonb_build_object('next_status',next_status,'confirmed',true));
 end if;
 return i;
end $$;
create function public.save_sph_request(p_org uuid,p_branch uuid,p_payload jsonb,p_id uuid default null,p_version integer default null,p_submit boolean default false) returns uuid
language sql security invoker set search_path='' as $$select gsp_private.api_save_sph_request(p_org,p_branch,p_payload,p_id,p_version,p_submit)$$;

create function gsp_private.can_review_sph(d public.sales_documents) returns boolean
language sql stable security definer set search_path='' as $$
 select d.kind='sph' and gsp_private.sales_document_reader(d.organization_id,d.branch_id)
 and (d.created_by<>auth.uid() or gsp_private.is_superadmin(d.organization_id))
 and case d.status
 when 'branch_review' then gsp_private.has_job(d.organization_id,d.branch_id,array['branch_manager'])
 when 'director_review' then gsp_private.has_job(d.organization_id,null,array['finance_director'])
 when 'accounting_review' then gsp_private.has_job(d.organization_id,null,array['accounting_tax'])
 when 'finance_review' then gsp_private.has_job(d.organization_id,null,array['finance']) else false end
$$;
create function gsp_private.api_review_sph_request(p_id uuid,p_version integer,p_approve boolean,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare d public.sales_documents; next_status text;
begin
 select * into d from public.sales_documents where id=p_id for update;
 if d.id is null or not gsp_private.can_review_sph(d) then raise exception 'Bukan tahap pemeriksaan SPH Anda atau pengajuan milik sendiri.' using errcode='42501';end if;
 if d.version is distinct from p_version then raise exception 'Versi SPH berubah. Muat ulang dan periksa kembali.';end if;
 if p_approve is null or nullif(btrim(p_note),'') is null then raise exception 'Keputusan dan catatan pemeriksaan wajib diisi.';end if;
 if p_approve and d.valid_until < (now() at time zone 'Asia/Bangkok')::date then raise exception 'Masa berlaku SPH berakhir; kembalikan untuk revisi.';end if;
 next_status:=case when not p_approve then 'rejected' when d.status='branch_review' then 'director_review' when d.status='director_review' then 'accounting_review' when d.status='accounting_review' then 'finance_review' else 'ready' end;
 update public.sales_documents set status=next_status,review_note=btrim(p_note),version=version+1 where id=d.id;
 perform gsp_private.procurement_log(d.organization_id,d.branch_id,d.id,'sph',case when p_approve then 'approved' else 'rejected' end,p_note,jsonb_build_object('from_status',d.status,'next_status',next_status,'version',d.version,'superadmin_override',d.created_by=auth.uid()));
end $$;
create function public.review_sph_request(p_id uuid,p_version integer,p_approve boolean,p_note text) returns void language sql security invoker set search_path='' as $$select gsp_private.api_review_sph_request(p_id,p_version,p_approve,p_note)$$;
create function gsp_private.api_sph_review_allowed(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$select coalesce((select gsp_private.can_review_sph(d) from public.sales_documents d where id=p_id),false)$$;
create function public.sph_review_allowed(p_id uuid) returns boolean language sql stable security invoker set search_path='' as $$select gsp_private.api_sph_review_allowed(p_id)$$;
create function gsp_private.api_sph_review_queue(p_org uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(q order by q.submitted_at),'[]') from (select d.id,'sph'::text kind,'SPH '||d.sph_number::text||' · '||d.title title,d.status,d.branch_id,0 amount,d.submitted_at from public.sales_documents d where d.organization_id=p_org and gsp_private.can_review_sph(d)) q
$$;
create function public.sph_review_queue(p_org uuid) returns jsonb language sql stable security invoker set search_path='' as $$select gsp_private.api_sph_review_queue(p_org)$$;

-- Preserve legacy callers while removing the old client/branch ownership rule.
create or replace function gsp_private.api_save_sales_document(p_org uuid,p_branch uuid,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare i uuid;c public.sales_clients;prev public.sales_documents;attachments uuid[];
begin
 if p_payload->>'kind'='sph' then
  if coalesce(p_payload->>'source','company')<>'company' then raise exception 'SPH diterbitkan oleh perusahaan.';end if;
  return gsp_private.api_save_sph_request(p_org,p_branch,p_payload);
 end if;
 if not gsp_private.sales_client_reader(p_org) or not gsp_private.can_access_business(p_org,p_branch,'sales') then raise exception 'Akses dokumen penjualan cabang ditolak.' using errcode='42501';end if;
 if p_payload->>'kind' is distinct from 'spk' then raise exception 'Jenis dokumen penjualan tidak valid.';end if;
 select * into c from public.sales_clients where id=(p_payload->>'client_id')::uuid and organization_id=p_org;
 if c.id is null or nullif(btrim(p_payload->>'title'),'') is null then raise exception 'Klien dan judul wajib diisi.';end if;
 select * into prev from public.sales_documents where id=(p_payload->>'accepted_sph_id')::uuid and organization_id=p_org and branch_id=p_branch and client_id=c.id and kind='sph' and status='accepted';
 if prev.id is null then raise exception 'SPK wajib merujuk SPH klien yang sudah disetujui kedua pihak.';end if;
 select coalesce(array_agg(value::uuid),'{}') into attachments from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids','[]'));
 perform gsp_private.validate_sales_attachments(p_org,p_branch,attachments);
 insert into public.sales_documents(organization_id,branch_id,client_id,kind,title,source,accepted_sph_id,notes,attachment_ids,client_snapshot,created_by)
 values(p_org,p_branch,c.id,'spk',btrim(p_payload->>'title'),coalesce(p_payload->>'source','company'),prev.id,p_payload->>'notes',attachments,prev.client_snapshot,auth.uid()) returning id into i;
 perform gsp_private.procurement_log(p_org,p_branch,i,'spk','draft_created');return i;
end $$;
create or replace function gsp_private.api_accept_sales_sph(p_id uuid,p_reference text,p_accepted_on date) returns void
language plpgsql security definer set search_path='' as $$
declare d public.sales_documents;
begin
 select * into d from public.sales_documents where id=p_id for update;
 if d.id is null or not gsp_private.has_job(d.organization_id,d.branch_id,array['president','finance_director','technical_director','branch_manager']) then raise exception 'Akses penerimaan SPH ditolak.' using errcode='42501';end if;
 if d.kind<>'sph' or d.status<>'ready' then raise exception 'Selesaikan persetujuan internal SPH sebelum mencatat persetujuan kedua pihak.';end if;
 if nullif(btrim(p_reference),'') is null or p_accepted_on is null then raise exception 'Referensi bukti kesepakatan kedua pihak dan tanggal wajib diisi.';end if;
 update public.sales_documents set status='accepted',accepted_by=auth.uid(),accepted_at=now(),acceptance_reference=p_reference,accepted_on=p_accepted_on,version=version+1 where id=d.id;
 perform gsp_private.procurement_log(d.organization_id,d.branch_id,d.id,'sph','mutual_acceptance_recorded',p_reference,jsonb_build_object('accepted_on',p_accepted_on));
end $$;

-- Draft attachment changes also invalidate stale edit forms.
create function gsp_private.bump_sales_attachment_version() returns trigger language plpgsql set search_path='' as $$begin
 if new.attachment_ids is distinct from old.attachment_ids and new.version=old.version then new.version:=old.version+1;end if;return new;
end $$;
create trigger sales_attachment_version before update on public.sales_documents for each row execute function gsp_private.bump_sales_attachment_version();

-- Reviewers can read the files attached to visible SPHs without receiving the
-- company-wide client directory. Support/HR cannot list sales files by branch.
create function gsp_private.sales_attachment_uploader(p_org uuid,p_branch uuid) returns boolean language sql stable security definer set search_path='' as $$select gsp_private.sales_client_reader(p_org) and gsp_private.can_access_business(p_org,p_branch,'sales')$$;
create function public.can_upload_sales_document(p_org uuid,p_branch uuid) returns boolean language sql stable security invoker set search_path='' as $$select gsp_private.sales_attachment_uploader(p_org,p_branch)$$;
create function gsp_private.sales_attachment_reader(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.procurement_attachments a where a.id=p_id and a.domain='sales' and (
  (a.uploaded_by=auth.uid() and gsp_private.sales_attachment_uploader(a.organization_id,a.branch_id))
  or exists(select 1 from public.sales_documents d where d.organization_id=a.organization_id and a.id=any(d.attachment_ids) and gsp_private.sales_document_reader(d.organization_id,d.branch_id) and (d.kind='spk' or d.status<>'draft' or gsp_private.sales_client_reader(d.organization_id)))))
$$;
create function public.can_read_sales_attachment(p_id uuid) returns boolean language sql stable security invoker set search_path='' as $$select gsp_private.sales_attachment_reader(p_id)$$;
create policy sales_attachment_read_guard on public.procurement_attachments as restrictive for select to authenticated using(domain<>'sales' or public.can_read_sales_attachment(id));
create policy sales_attachment_insert_guard on public.procurement_attachments as restrictive for insert to authenticated with check(domain<>'sales' or public.can_upload_sales_document(organization_id,branch_id));
create policy sales_attachment_review_read on public.procurement_attachments for select to authenticated using(domain='sales' and public.can_read_sales_attachment(id));
create or replace function gsp_private.document_storage_access(p_name text,p_upload boolean) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare parts text[]; org uuid; branch uuid; uploader uuid;
begin
 if auth.uid() is null or p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|pdf)$' then return false;end if;
 parts:=string_to_array(p_name,'/');org:=parts[1]::uuid;branch:=parts[2]::uuid;uploader:=parts[3]::uuid;
 if not exists(select 1 from public.business_units where id=branch and organization_id=org and kind='branch') then return false;end if;
 if p_upload then return uploader=auth.uid() and (gsp_private.can_access_business(org,branch,'procurement') or gsp_private.sales_attachment_uploader(org,branch));end if;
 return exists(select 1 from public.procurement_attachments a where a.storage_path=p_name and ((a.domain='procurement' and gsp_private.can_access_business(a.organization_id,a.branch_id,'procurement')) or (a.domain='sales' and gsp_private.sales_attachment_reader(a.id))));
end $$;

revoke all on function gsp_private.validate_sales_attachments(uuid,uuid,uuid[]),gsp_private.can_review_sph(public.sales_documents),gsp_private.bump_sales_attachment_version() from public,anon,authenticated;
do $$ declare f record;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('can_register_sales_client','can_read_sales_clients','can_read_sales_document','save_sph_request','review_sph_request','sph_review_allowed','sph_review_queue','can_upload_sales_document','can_read_sales_attachment')) or (n.nspname='gsp_private' and p.proname in ('sales_internal_member','sales_client_reader','sales_document_reader','api_save_sph_request','api_review_sph_request','api_sph_review_allowed','api_sph_review_queue','sales_attachment_uploader','sales_attachment_reader')) loop
  execute format('revoke all on function %s from public,anon,authenticated',f.oid::regprocedure);
  execute format('grant execute on function %s to authenticated',f.oid::regprocedure);
 end loop;
end $$;
notify pgrst,'reload schema';
