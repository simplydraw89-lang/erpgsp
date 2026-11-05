-- Private source documents. A document belongs to one business domain and branch.
create table public.procurement_attachments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 branch_id uuid not null, uploaded_by uuid not null references auth.users(id),
 domain text not null default 'procurement' check(domain in ('procurement','sales')),
 storage_path text not null unique, file_name text not null check(length(file_name) between 1 and 240),
 content_type text not null check(content_type in ('image/png','image/jpeg','application/pdf')),
 byte_size integer not null check(byte_size between 1 and 10485760), created_at timestamptz not null default now(),
 foreign key(organization_id,branch_id) references public.business_units(organization_id,id),
 check(storage_path = organization_id::text||'/'||branch_id::text||'/'||uploaded_by::text||'/'||id::text||case content_type when 'image/png' then '.png' when 'image/jpeg' then '.jpg' else '.pdf' end)
);
create index procurement_attachments_scope on public.procurement_attachments(organization_id,branch_id,domain);
alter table public.procurement_attachments enable row level security;
revoke all on public.procurement_attachments from public,anon,authenticated;
grant select,insert on public.procurement_attachments to authenticated;
create policy procurement_document_read on public.procurement_attachments for select to authenticated
 using(public.can_access_business(organization_id,branch_id,domain));
create policy procurement_document_insert on public.procurement_attachments for insert to authenticated
 with check(uploaded_by=auth.uid() and public.can_access_business(organization_id,branch_id,domain)
 and exists(select 1 from public.business_units b where b.id=procurement_attachments.branch_id and b.organization_id=procurement_attachments.organization_id and b.kind='branch'));

create function gsp_private.document_storage_access(p_name text,p_upload boolean) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare parts text[]; org uuid; branch uuid; uploader uuid;
begin
 if auth.uid() is null or p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|pdf)$' then return false; end if;
 parts:=string_to_array(p_name,'/');org:=parts[1]::uuid;branch:=parts[2]::uuid;uploader:=parts[3]::uuid;
 if not exists(select 1 from public.business_units b where b.id=branch and b.organization_id=org and b.kind='branch') then return false; end if;
 if p_upload then return uploader=auth.uid() and (gsp_private.can_access_business(org,branch,'procurement') or gsp_private.can_access_business(org,branch,'sales')); end if;
 return exists(select 1 from public.procurement_attachments a where a.storage_path=p_name and gsp_private.can_access_business(a.organization_id,a.branch_id,a.domain));
end $$;
revoke all on function gsp_private.document_storage_access(text,boolean) from public,anon,authenticated;
grant execute on function gsp_private.document_storage_access(text,boolean) to authenticated;

-- Supabase Storage exists remotely. Local PGlite verifies the table and path helper;
-- a storage fixture can exercise these same policies without the Supabase service.
do $$ begin
 if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
   values('procurement-documents','procurement-documents',false,10485760,array['image/png','image/jpeg','application/pdf'])
   on conflict(id) do nothing;
  if exists(select 1 from storage.buckets where id='procurement-documents' and public) then raise exception 'procurement-documents must be a private bucket'; end if;
  execute 'create policy gsp_document_upload on storage.objects for insert to authenticated with check(bucket_id=''procurement-documents'' and gsp_private.document_storage_access(name,true))';
  execute 'create policy gsp_document_read on storage.objects for select to authenticated using(bucket_id=''procurement-documents'' and gsp_private.document_storage_access(name,false))';
  execute 'create policy gsp_document_read_guard on storage.objects as restrictive for select to authenticated using(bucket_id<>''procurement-documents'' or gsp_private.document_storage_access(name,false))';
  execute 'create policy gsp_document_upload_guard on storage.objects as restrictive for insert to authenticated with check(bucket_id<>''procurement-documents'' or gsp_private.document_storage_access(name,true))';
  execute 'create policy gsp_document_update_guard on storage.objects as restrictive for update to authenticated using(bucket_id<>''procurement-documents'') with check(bucket_id<>''procurement-documents'')';
  execute 'create policy gsp_document_delete_guard on storage.objects as restrictive for delete to authenticated using(bucket_id<>''procurement-documents'')';
  execute 'create policy gsp_document_anon_guard on storage.objects as restrictive for all to anon using(bucket_id<>''procurement-documents'') with check(bucket_id<>''procurement-documents'')';
  execute 'create policy gsp_document_bucket_insert_guard on storage.buckets as restrictive for insert to authenticated,anon with check(id<>''procurement-documents'')';
  execute 'create policy gsp_document_bucket_update_guard on storage.buckets as restrictive for update to authenticated,anon using(id<>''procurement-documents'') with check(id<>''procurement-documents'')';
  execute 'create policy gsp_document_bucket_delete_guard on storage.buckets as restrictive for delete to authenticated,anon using(id<>''procurement-documents'')';
 end if;
end $$;
