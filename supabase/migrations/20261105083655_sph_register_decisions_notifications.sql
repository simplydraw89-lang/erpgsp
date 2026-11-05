-- Latest owner instruction: Manager -> Finance Director -> author follow-up.
-- Separate branch register summaries from permission to open full documents.
alter table public.sales_documents add column amount numeric(18,2) check(amount>=0 and amount<10000000000000000);
-- Do not silently relabel an already running workflow on another installation.
do $$begin if exists(select 1 from public.sales_documents where status in ('accounting_review','finance_review')) then raise exception 'Terdapat SPH dalam pemeriksaan Accounting/Finance. Tinjau transisi sebelum memasang alur baru.';end if;end$$;
alter table public.sales_documents drop constraint sales_documents_status_check;
alter table public.sales_documents add constraint sales_documents_status_check check(status in ('draft','branch_review','director_review','ready','revision_requested','rejected','accepted'));

alter function gsp_private.api_save_sph_request(uuid,uuid,jsonb,uuid,integer,boolean) rename to api_save_sph_request_base;
revoke all on function gsp_private.api_save_sph_request_base(uuid,uuid,jsonb,uuid,integer,boolean) from public,anon,authenticated;
create function gsp_private.api_save_sph_request(p_org uuid,p_branch uuid,p_payload jsonb,p_id uuid default null,p_version integer default null,p_submit boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.sales_documents;i uuid;v numeric;
begin
 if not gsp_private.sales_client_reader(p_org) or not gsp_private.can_access_business(p_org,p_branch,'sales') then raise exception 'Akses pengajuan SPH cabang ditolak.' using errcode='42501';end if;
 if nullif(p_payload->>'amount','') is not null then
  if p_payload->>'amount' !~ '^[0-9]{1,16}(\.[0-9]{1,2})?$' then raise exception 'Nilai SPH tidak valid; gunakan angka dengan maksimal dua desimal.';end if;
  v:=(p_payload->>'amount')::numeric;
 end if;
 if coalesce(p_submit,false) and (v is null or v<=0) then raise exception 'Nilai SPH wajib lebih dari nol sebelum submit.';end if;
 if p_id is not null then select * into d from public.sales_documents where id=p_id for update;end if;
 if d.id is not null then
  if d.organization_id<>p_org or d.branch_id<>p_branch or d.kind<>'sph' or (d.created_by<>auth.uid() and not gsp_private.is_superadmin(p_org)) then raise exception 'Draft SPH bukan milik Anda atau cabang berubah.' using errcode='42501';end if;
  if d.version is distinct from p_version or d.status not in ('draft','revision_requested') then raise exception 'Versi SPH berubah atau dokumen sudah terkunci.';end if;
  if d.status='revision_requested' then update public.sales_documents set status='draft' where id=d.id;end if;
 end if;
 i:=gsp_private.api_save_sph_request_base(p_org,p_branch,p_payload,p_id,p_version,p_submit);
 update public.sales_documents set amount=v where id=i;
 return i;
end$$;

create function gsp_private.api_decide_sph(p_id uuid,p_version integer,p_decision text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare d public.sales_documents;next_status text;
begin
 select * into d from public.sales_documents where id=p_id for update;
 if d.id is null or not gsp_private.can_review_sph(d) then raise exception 'Bukan tahap pemeriksaan SPH Anda atau pengajuan milik sendiri.' using errcode='42501';end if;
 if d.version is distinct from p_version then raise exception 'Versi SPH berubah. Muat ulang dan periksa kembali.';end if;
 if p_decision is null or p_decision not in ('approve','revise','reject') then raise exception 'Pilih Setujui, Revisi atau Tolak.';end if;
 if p_decision in ('revise','reject') and nullif(btrim(p_note),'') is null then raise exception 'Alasan revisi atau penolakan wajib diisi.';end if;
 if length(coalesce(p_note,''))>5000 then raise exception 'Catatan maksimal 5000 karakter.';end if;
 if p_decision='approve' and d.valid_until<(now() at time zone 'Asia/Bangkok')::date then raise exception 'Masa berlaku SPH berakhir; kembalikan untuk revisi.';end if;
 next_status:=case when p_decision='revise' then 'revision_requested' when p_decision='reject' then 'rejected' when d.status='branch_review' then 'director_review' else 'ready' end;
 update public.sales_documents set status=next_status,review_note=nullif(btrim(p_note),''),version=version+1 where id=d.id;
 perform gsp_private.procurement_log(d.organization_id,d.branch_id,d.id,'sph',case p_decision when 'approve' then 'approved' when 'revise' then 'revision_requested' else 'rejected' end,p_note,jsonb_build_object('from_status',d.status,'next_status',next_status,'version',d.version,'superadmin_override',d.created_by=auth.uid()));
end$$;
create function public.decide_sph(p_id uuid,p_version integer,p_decision text,p_note text) returns void language sql security invoker set search_path='' as $$select gsp_private.api_decide_sph(p_id,p_version,p_decision,p_note)$$;
-- Boolean legacy decisions remain guarded and map negative decisions to revision.
create or replace function gsp_private.api_review_sph_request(p_id uuid,p_version integer,p_approve boolean,p_note text) returns void
language plpgsql security definer set search_path='' as $$begin
 if p_approve is null then raise exception 'Keputusan wajib diisi.';end if;
 perform gsp_private.api_decide_sph(p_id,p_version,case when p_approve then 'approve' else 'revise' end,p_note);
end$$;

create function gsp_private.sph_opener(d public.sales_documents) returns boolean language sql stable security definer set search_path='' as $$
 select gsp_private.is_superadmin(d.organization_id) or (d.created_by=auth.uid() and gsp_private.sales_document_reader(d.organization_id,d.branch_id)) or gsp_private.can_review_sph(d)
$$;
create function gsp_private.sph_spk_creator(d public.sales_documents) returns boolean language sql stable security definer set search_path='' as $$
 select d.kind='sph' and d.status in ('ready','accepted') and (d.created_by=auth.uid() or gsp_private.is_superadmin(d.organization_id)) and gsp_private.sales_client_reader(d.organization_id) and gsp_private.can_access_business(d.organization_id,d.branch_id,'sales')
$$;
drop policy sales_document_role_read on public.sales_documents;
create policy sales_document_role_read on public.sales_documents for select to authenticated using(
 case when kind='sph' then gsp_private.sph_opener(sales_documents) else public.can_read_sales_document(organization_id,branch_id) end);
create or replace function gsp_private.sales_attachment_reader(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.procurement_attachments a where a.id=p_id and a.domain='sales' and (
 (a.uploaded_by=auth.uid() and gsp_private.sales_attachment_uploader(a.organization_id,a.branch_id)) or exists(select 1 from public.sales_documents d where d.organization_id=a.organization_id and a.id=any(d.attachment_ids) and case when d.kind='sph' then gsp_private.sph_opener(d) else gsp_private.sales_document_reader(d.organization_id,d.branch_id) end)))
$$;

create function gsp_private.api_sph_register(p_org uuid,p_branch uuid default null,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not gsp_private.sales_internal_member(p_org) then raise exception 'Akses daftar SPH ditolak.' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>1000000 then raise exception 'Halaman daftar tidak valid.';end if;
 with visible as (
  select d.*,b.name branch_name,d row_data from public.sales_documents d join public.business_units b on b.id=d.branch_id
  where d.organization_id=p_org and d.kind='sph' and (p_branch is null or d.branch_id=p_branch) and gsp_private.sales_document_reader(p_org,d.branch_id)
 ), page as (
  select id,sph_number,branch_id,branch_name,created_at,left(title,120) title,work_scopes,amount,status,
   gsp_private.sph_opener(visible.row_data) can_open,gsp_private.sph_spk_creator(visible.row_data) can_create_spk
  from visible order by sph_number desc limit 50 offset p_offset
 ) select jsonb_build_object('total',(select count(*) from visible),'rows',coalesce(jsonb_agg(page order by sph_number desc),'[]')) into result from page;
 return result;
end$$;
create function public.sph_register(p_org uuid,p_branch uuid default null,p_offset integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$select gsp_private.api_sph_register(p_org,p_branch,p_offset)$$;

create function gsp_private.api_sph_spk_context(p_org uuid,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d public.sales_documents;begin
 select * into d from public.sales_documents where organization_id=p_org and id=p_id;
 if d.id is null or not gsp_private.sph_spk_creator(d) then raise exception 'SPK hanya dapat dilanjutkan pengaju setelah SPH disetujui Direktur Keuangan.' using errcode='42501';end if;
 return jsonb_build_object('id',d.id,'sph_number',d.sph_number,'title',d.title,'branch_id',d.branch_id,'client_name',d.client_snapshot->>'name','amount',d.amount);
end$$;
create function public.sph_spk_context(p_org uuid,p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select gsp_private.api_sph_spk_context(p_org,p_id)$$;

-- Dynamic notifications follow current assignments/status, so obsolete approvals
-- disappear and revocation takes effect without stale recipient permissions.
create function gsp_private.api_sales_notifications(p_org uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with items as (
  select d.id,d.sph_number,d.status,d.review_note,d.created_at,
   case when gsp_private.can_review_sph(d) then 'approval' else 'follow_up' end category,
   case when gsp_private.can_review_sph(d) then 'Butuh persetujuan saya' else 'SPH perlu tindak lanjut' end label
  from public.sales_documents d where d.organization_id=p_org and d.kind='sph' and gsp_private.sales_internal_member(p_org)
  and (gsp_private.can_review_sph(d) or (d.created_by=auth.uid() and gsp_private.sph_opener(d) and d.status in ('revision_requested','rejected','ready') and not exists(select 1 from public.sales_documents s where s.kind='spk' and s.accepted_sph_id=d.id)))
 ) select jsonb_build_object('total',count(*),'items',coalesce((select jsonb_agg(x order by x.sph_number desc) from (select * from items order by sph_number desc limit 100)x),'[]')) from items
$$;
create function public.sales_notifications(p_org uuid) returns jsonb language sql stable security invoker set search_path='' as $$select gsp_private.api_sales_notifications(p_org)$$;

-- Keep SPK legacy mutations aligned with the same director approval/ownership.
alter function gsp_private.api_save_sales_document(uuid,uuid,jsonb) rename to api_save_sales_document_base;
revoke all on function gsp_private.api_save_sales_document_base(uuid,uuid,jsonb) from public,anon,authenticated;
create function gsp_private.api_save_sales_document(p_org uuid,p_branch uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.sales_documents;i uuid;attachments uuid[];begin
 if p_payload->>'kind' is distinct from 'spk' then return gsp_private.api_save_sales_document_base(p_org,p_branch,p_payload);end if;
 select * into d from public.sales_documents where id=nullif(p_payload->>'accepted_sph_id','')::uuid and organization_id=p_org for update;
 if d.id is null or not gsp_private.sph_spk_creator(d) or d.branch_id<>p_branch or d.client_id is distinct from nullif(p_payload->>'client_id','')::uuid then raise exception 'SPK wajib merujuk SPH klien/cabang yang sudah disetujui Direktur Keuangan dan milik pengaju.' using errcode='42501';end if;
 if nullif(btrim(p_payload->>'title'),'') is null then raise exception 'Judul SPK wajib diisi.';end if;
 select coalesce(array_agg(value::uuid),'{}') into attachments from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids','[]'));
 perform gsp_private.validate_sales_attachments(p_org,p_branch,attachments);
 insert into public.sales_documents(organization_id,branch_id,client_id,kind,title,source,accepted_sph_id,notes,attachment_ids,client_snapshot,created_by)
 values(p_org,p_branch,d.client_id,'spk',btrim(p_payload->>'title'),coalesce(p_payload->>'source','company'),d.id,p_payload->>'notes',attachments,d.client_snapshot,auth.uid()) returning id into i;
 perform gsp_private.procurement_log(p_org,p_branch,i,'spk','draft_created');return i;
end$$;

create index sales_sph_author_follow_up on public.sales_documents(organization_id,created_by,status) where kind='sph';
create or replace function public.save_sph_request(p_org uuid,p_branch uuid,p_payload jsonb,p_id uuid default null,p_version integer default null,p_submit boolean default false) returns uuid language sql security invoker set search_path='' as $$select gsp_private.api_save_sph_request(p_org,p_branch,p_payload,p_id,p_version,p_submit)$$;
create or replace function public.save_sales_document(p_org uuid,p_branch uuid,p_payload jsonb) returns uuid language sql security invoker set search_path='' as $$select gsp_private.api_save_sales_document(p_org,p_branch,p_payload)$$;
do $$declare f record;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
 (n.nspname='gsp_private' and p.proname in ('api_save_sph_request','api_save_sales_document','api_decide_sph','sph_opener','sph_spk_creator','api_sph_register','api_sph_spk_context','api_sales_notifications'))
 or (n.nspname='public' and p.proname in ('decide_sph','sph_register','sph_spk_context','sales_notifications')) loop
  execute format('revoke all on function %s from public,anon,authenticated',f.oid::regprocedure);
  execute format('grant execute on function %s to authenticated',f.oid::regprocedure);
 end loop;
end$$;
notify pgrst,'reload schema';
