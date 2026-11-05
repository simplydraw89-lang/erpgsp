-- One transactional SPH register per company, shared by every branch.
-- Counter increments roll back with a failed insert; no PostgreSQL sequence gaps.
alter table public.sales_documents add column sph_number bigint;
create table gsp_private.sph_counters (
 organization_id uuid primary key references public.organizations(id),
 last_number bigint not null check(last_number >= 0)
);
alter table gsp_private.sph_counters enable row level security;
revoke all on gsp_private.sph_counters from public, anon, authenticated;

with numbered as (
 select id, row_number() over(partition by organization_id order by created_at,id) n
 from public.sales_documents where kind='sph'
)
update public.sales_documents d set sph_number=n.n from numbered n where d.id=n.id;
insert into gsp_private.sph_counters(organization_id,last_number)
select organization_id,max(sph_number) from public.sales_documents where kind='sph' group by organization_id;
alter table public.sales_documents add constraint sales_sph_number_valid
 check((kind='sph' and sph_number is not null and sph_number>0) or (kind='spk' and sph_number is null));
create unique index sales_sph_number_unique on public.sales_documents(organization_id,sph_number) where kind='sph';

create function gsp_private.assign_sph_number() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then
  if old.kind='sph' then raise exception 'SPH bernomor tidak boleh dihapus; jejak nomor harus dipertahankan.';end if;
  return old;
 end if;
 if tg_op='UPDATE' then
  if (new.kind,new.organization_id,new.sph_number) is distinct from (old.kind,old.organization_id,old.sph_number) then
   raise exception 'Jenis, perusahaan dan nomor SPH tidak boleh diubah.';
  end if;
  return new;
 end if;
 if new.kind='sph' then
  if new.source<>'company' then raise exception 'SPH diterbitkan oleh perusahaan.';end if;
  insert into gsp_private.sph_counters(organization_id,last_number) values(new.organization_id,1)
  on conflict(organization_id) do update set last_number=gsp_private.sph_counters.last_number+1
  returning last_number into new.sph_number;
 else new.sph_number:=null;
 end if;
 return new;
end $$;
revoke all on function gsp_private.assign_sph_number() from public,anon,authenticated;
create trigger sales_sph_number_guard before insert or update or delete on public.sales_documents
for each row execute function gsp_private.assign_sph_number();

-- Existing save_sales_document remains the only creation RPC. This trigger also
-- covers legacy callers of that RPC; callers cannot choose their own SPH number.
create function gsp_private.attach_sales_document(p_id uuid,p_attachments uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare d public.sales_documents; bad integer;
begin
 select * into d from public.sales_documents where id=p_id for update;
 if auth.uid() is null or d.id is null or not gsp_private.can_access_business(d.organization_id,d.branch_id,'sales')
  or not (d.created_by=auth.uid() or gsp_private.is_superadmin(d.organization_id)) then
  raise exception 'Akses lampiran dokumen penjualan ditolak.' using errcode='42501';
 end if;
 if d.status<>'draft' then raise exception 'Dokumen disetujui tidak dapat diubah.';end if;
 if p_attachments is null or cardinality(p_attachments)>10 then raise exception 'Maksimal 10 lampiran.';end if;
 if not d.attachment_ids <@ p_attachments then raise exception 'Lampiran tersimpan tidak boleh dihapus.';end if;
 if (select count(distinct x) from unnest(p_attachments) x)<>cardinality(p_attachments) then raise exception 'Lampiran duplikat.';end if;
 select count(*) into bad from unnest(p_attachments) x where not exists(
  select 1 from public.procurement_attachments a where a.id=x and a.organization_id=d.organization_id and a.branch_id=d.branch_id and a.domain='sales');
 if bad>0 then raise exception 'Lampiran tidak sesuai cabang atau domain penjualan.';end if;
 update public.sales_documents set attachment_ids=p_attachments where id=d.id;
 perform gsp_private.procurement_log(d.organization_id,d.branch_id,d.id,d.kind,'attachments_updated');
end $$;
revoke all on function gsp_private.attach_sales_document(uuid,uuid[]) from public,anon,authenticated;
grant execute on function gsp_private.attach_sales_document(uuid,uuid[]) to authenticated;
create function public.attach_sales_document(p_id uuid,p_attachments uuid[]) returns void
language sql security invoker set search_path='' as $$ select gsp_private.attach_sales_document(p_id,p_attachments) $$;
revoke all on function public.attach_sales_document(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.attach_sales_document(uuid,uuid[]) to authenticated;
