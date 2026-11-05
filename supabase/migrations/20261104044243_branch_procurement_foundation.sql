-- One taxpayer, a reporting center, and three operational locations.
-- Legacy records remain unallocated: never infer their branch from their author.
create table public.business_units (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 code text not null, name text not null, kind text not null check(kind in ('center','branch')),
 entity_id uuid, created_at timestamptz not null default now(),
 unique(organization_id,id),unique(organization_id,code),
 foreign key(organization_id,entity_id) references public.company_entities(organization_id,id)
);
create unique index business_units_center on public.business_units(organization_id) where kind='center';
create table public.person_profiles (
 organization_id uuid not null, user_id uuid not null, relationship_status text not null
 check(relationship_status in ('probation','contract','permanent','consultant','vendor','client')),
 primary key(organization_id,user_id), foreign key(organization_id,user_id) references public.organization_members(organization_id,user_id)
);
create table public.work_assignments (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,user_id uuid not null,branch_id uuid,
 job_role text not null check(job_role in ('president','finance_director','technical_director','finance','accounting_tax','hr','branch_manager','admin','project_manager','support','other')),
 created_at timestamptz not null default now(),
 foreign key(organization_id,user_id) references public.organization_members(organization_id,user_id),
 foreign key(organization_id,branch_id) references public.business_units(organization_id,id)
);
create unique index work_assignments_scope on public.work_assignments(organization_id,user_id,coalesce(branch_id,'00000000-0000-0000-0000-000000000000'::uuid),job_role);
create index work_assignments_actor on public.work_assignments(user_id,organization_id,branch_id);

create function gsp_private.is_superadmin(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid() and role='owner')
$$;
create function gsp_private.has_job(p_org uuid,p_branch uuid,p_roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select gsp_private.is_superadmin(p_org) or exists(select 1 from public.work_assignments w join public.person_profiles p using(organization_id,user_id)
 where w.organization_id=p_org and w.user_id=auth.uid() and (w.branch_id is null or w.branch_id=p_branch)
 and w.job_role=any(p_roles) and p.relationship_status in ('probation','contract','permanent'))
$$;
create function gsp_private.can_access_business(p_org uuid,p_branch uuid,p_domain text default 'procurement') returns boolean language sql stable security definer set search_path='' as $$
 select gsp_private.is_superadmin(p_org) or exists(select 1 from public.work_assignments w join public.person_profiles p using(organization_id,user_id)
 where w.organization_id=p_org and w.user_id=auth.uid() and p.relationship_status in ('probation','contract','permanent') and (
 (w.branch_id=p_branch and p_branch is not null and p_domain in ('procurement','sales','operations'))
 or (w.branch_id is null and (w.job_role in ('president','finance_director','technical_director')
 or (w.job_role in ('finance','accounting_tax') and p_domain in ('procurement','finance')) or (w.job_role='hr' and p_domain='hr')))))
$$;
create function public.can_access_business(p_org uuid,p_branch uuid,p_domain text default 'procurement') returns boolean language sql stable security definer set search_path='' as $$
 select gsp_private.can_access_business(p_org,p_branch,p_domain)
$$;
create function public.has_business_job(p_org uuid,p_branch uuid,p_roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select gsp_private.has_job(p_org,p_branch,p_roles)
$$;
create function gsp_private.seed_business_units() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.business_units(organization_id,code,name,kind) values(new.id,'PUSAT','Pusat','center'),(new.id,'SBY','Surabaya','branch'),(new.id,'JOG','Jogjakarta','branch'),(new.id,'JKT','Jakarta','branch');return new;
end $$;
create trigger organization_business_units after insert on public.organizations for each row execute function gsp_private.seed_business_units();
insert into public.business_units(organization_id,code,name,kind)
 select o.id,x.code,x.name,x.kind from public.organizations o cross join(values('PUSAT','Pusat','center'),('SBY','Surabaya','branch'),('JOG','Jogjakarta','branch'),('JKT','Jakarta','branch')) x(code,name,kind);

create function public.save_work_assignment(p_org uuid,p_user uuid,p_branch uuid,p_job_role text,p_relationship text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not gsp_private.is_superadmin(p_org) then raise exception 'Hanya Super Admin yang mengatur akses.' using errcode='42501';end if;
 if p_branch is not null and not exists(select 1 from public.business_units where id=p_branch and organization_id=p_org and kind='branch') then raise exception 'Cabang tidak sesuai organisasi.';end if;
 if not exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_user) then
  insert into public.organization_members(organization_id,user_id,role) values(p_org,p_user,'staff');
 end if;
 insert into public.person_profiles values(p_org,p_user,p_relationship) on conflict(organization_id,user_id) do update set relationship_status=excluded.relationship_status;
 if p_relationship in ('client','consultant','vendor') then
  delete from public.work_assignments where organization_id=p_org and user_id=p_user;
 else
  if p_branch is null and p_job_role in ('branch_manager','admin','project_manager','support','other') then raise exception 'Jabatan cabang memerlukan lokasi cabang.';end if;
  if p_branch is not null and p_job_role in ('president','finance_director','technical_director','finance','accounting_tax') then raise exception 'Jabatan pusat harus memakai cakupan pusat.';end if;
  insert into public.work_assignments(organization_id,user_id,branch_id,job_role) values(p_org,p_user,p_branch,p_job_role) on conflict do nothing;
 end if;
 insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id,details) values(p_org,auth.uid(),'access.assignment','work_assignments',p_user::text,jsonb_build_object('branch_id',p_branch,'job_role',p_job_role,'relationship',p_relationship));
end $$;

create function public.remove_work_assignment(p_org uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare w public.work_assignments;
begin
 if not gsp_private.is_superadmin(p_org) then raise exception 'Hanya Super Admin dapat mencabut akses.' using errcode='42501';end if;
 delete from public.work_assignments where id=p_id and organization_id=p_org returning * into w;
 if w.id is null then raise exception 'Penugasan tidak ditemukan.';end if;
 insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id,details) values(p_org,auth.uid(),'access.revoked','work_assignments',w.user_id::text,to_jsonb(w));
end $$;

create table public.procurement_vendors (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,branch_id uuid not null,
 name text not null,address text not null,npwp text,bank_owner text not null,bank_account text not null,payment_method text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),created_by uuid not null references auth.users(id),
 reviewed_by uuid references auth.users(id),review_note text,created_at timestamptz not null default now(),
 unique(organization_id,branch_id,id), foreign key(organization_id,branch_id) references public.business_units(organization_id,id)
);
create index procurement_vendors_branch on public.procurement_vendors(organization_id,branch_id,status);
create table public.purchase_requests (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,branch_id uuid not null,created_by uuid not null references auth.users(id),
 invoice_number text not null,invoice_date date not null,tax_invoice_number text,tax_invoice_date date,
 vendor_id uuid,vendor_snapshot jsonb not null,lines jsonb not null,vat_mode text not null default 'none' check(vat_mode in ('none','non_luxury','luxury')),
 vat_creditable boolean not null default false,withholding_code text not null default 'none' check(withholding_code in ('none','pph23_service','pph23_rental','pph_final_rental','pph_final_construction','pph21_nonemployee')),
 withholding_rate numeric(9,4) not null default 0,withholding_base numeric(20,2) not null default 0,
 withholding_timing text not null default 'invoice' check(withholding_timing in ('invoice','payment')),
 subtotal numeric(20,2) not null default 0,vat_amount numeric(20,2) not null default 0,withholding_amount numeric(20,2) not null default 0,
 total numeric(20,2) not null default 0,payable_amount numeric(20,2) not null default 0,
 coa_confirmed boolean not null default false,requested_payment_date date,notes text,attachment_ids uuid[] not null default '{}',
 status text not null default 'draft' check(status in ('draft','branch_review','director_review','accounting_review','payment_ready','paid','rejected')),
 version integer not null default 1,review_note text,journal_id uuid references public.accounting_journals(id),payment_journal_id uuid references public.accounting_journals(id),
 payable_account_id uuid references public.finance_accounts(id),withholding_account_id uuid references public.finance_accounts(id),
 payment_reference text,paid_on date,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(organization_id,branch_id) references public.business_units(organization_id,id),
 foreign key(organization_id,branch_id,vendor_id) references public.procurement_vendors(organization_id,branch_id,id),
 check(subtotal>=0 and vat_amount>=0 and withholding_amount>=0 and payable_amount>=0),unique(organization_id,id)
);
create index purchase_requests_queue on public.purchase_requests(organization_id,branch_id,status,created_at desc);
create unique index purchase_requests_invoice on public.purchase_requests(organization_id,branch_id,vendor_id,lower(invoice_number)) where status<>'rejected';
create table public.procurement_events (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,branch_id uuid not null,entity_id uuid not null,
 entity_type text not null,action text not null,actor_id uuid not null references auth.users(id),note text,details jsonb not null default '{}',created_at timestamptz not null default now(),
 foreign key(organization_id,branch_id) references public.business_units(organization_id,id)
);
create index procurement_events_entity on public.procurement_events(entity_id,created_at);
create function gsp_private.procurement_log(p_org uuid,p_branch uuid,p_id uuid,p_type text,p_action text,p_note text default null,p_details jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.procurement_events(organization_id,branch_id,entity_id,entity_type,action,actor_id,note,details) values(p_org,p_branch,p_id,p_type,p_action,auth.uid(),p_note,p_details)
$$;

create function public.save_procurement_vendor(p_org uuid,p_branch uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
 if not gsp_private.can_access_business(p_org,p_branch,'procurement') then raise exception 'Akses cabang ditolak.' using errcode='42501';end if;
 if not exists(select 1 from public.business_units where id=p_branch and organization_id=p_org and kind='branch') then raise exception 'Pilih cabang usaha.';end if;
 if exists(select 1 from unnest(array['name','address','bank_owner','bank_account','payment_method']) k where nullif(btrim(p_payload->>k),'') is null) then raise exception 'Identitas vendor dan rekening wajib diisi.';end if;
 insert into public.procurement_vendors(organization_id,branch_id,name,address,npwp,bank_owner,bank_account,payment_method,created_by)
 values(p_org,p_branch,btrim(p_payload->>'name'),p_payload->>'address',nullif(p_payload->>'npwp',''),p_payload->>'bank_owner',p_payload->>'bank_account',p_payload->>'payment_method',auth.uid()) returning id into v;
 perform gsp_private.procurement_log(p_org,p_branch,v,'vendor','submitted');return v;
end $$;
create function public.review_procurement_vendor(p_id uuid,p_approve boolean,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare v public.procurement_vendors;
begin
 select * into v from public.procurement_vendors where id=p_id for update;
 if v.id is null or not gsp_private.has_job(v.organization_id,null,array['finance','accounting_tax']) then raise exception 'Persetujuan vendor hanya Finance pusat.' using errcode='42501';end if;
 if v.status<>'pending' then raise exception 'Vendor telah diperiksa.';end if;
 if v.created_by=auth.uid() and not gsp_private.is_superadmin(v.organization_id) then raise exception 'Tidak dapat memeriksa pengajuan vendor sendiri.';end if;
 if p_approve is null or (not p_approve and nullif(btrim(p_note),'') is null) then raise exception 'Keputusan dan alasan penolakan wajib diisi.';end if;
 if p_approve and nullif(btrim(v.npwp),'') is null then raise exception 'NPWP/identitas perpajakan vendor wajib diperiksa sebelum persetujuan.';end if;
 update public.procurement_vendors set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),review_note=p_note where id=v.id;
 perform gsp_private.procurement_log(v.organization_id,v.branch_id,v.id,'vendor',case when p_approve then 'approved' else 'rejected' end,p_note,jsonb_build_object('superadmin_override',v.created_by=auth.uid()));
end $$;

create function gsp_private.calculate_purchase() returns trigger language plpgsql set search_path='' as $$
declare l jsonb;amount numeric;taxbase numeric;progressive numeric;aid uuid;
begin
 if jsonb_typeof(new.lines) is distinct from 'array' or jsonb_array_length(new.lines)<1 or jsonb_array_length(new.lines)>150 then raise exception 'Rincian harus berisi 1–150 baris.';end if;
 new.subtotal:=0;
 for l in select value from jsonb_array_elements(new.lines) loop
  amount:=(l->>'amount')::numeric;aid:=nullif(l->>'account_id','')::uuid;
  if amount is null or amount<=0 or amount<>round(amount,2) or amount>1000000000000000 or nullif(btrim(l->>'description'),'') is null then raise exception 'Keterangan dan nominal baris tidak valid.';end if;
  if aid is not null and not exists(select 1 from public.finance_accounts where id=aid and organization_id=new.organization_id and is_active and account_type in ('expense','asset')) then raise exception 'COA biaya/aset tidak valid.';end if;
  if new.coa_confirmed and aid is null then raise exception 'COA seluruh rincian wajib ditetapkan.';end if;
  new.subtotal:=new.subtotal+amount;
 end loop;
 new.vat_amount:=round(new.subtotal*case new.vat_mode when 'non_luxury' then 0.11 when 'luxury' then 0.12 else 0 end,2);
 if new.withholding_base<0 or new.withholding_base>new.subtotal then raise exception 'Dasar potong di luar nilai tagihan.';end if;
 if new.withholding_code='none' then new.withholding_rate:=0;new.withholding_base:=0;new.withholding_amount:=0;
 elsif new.withholding_code='pph21_nonemployee' then
  taxbase:=new.withholding_base*0.5;
  progressive:=least(taxbase,60000000)*0.05+greatest(least(taxbase-60000000,190000000),0)*0.15+greatest(least(taxbase-250000000,250000000),0)*0.25+greatest(least(taxbase-500000000,4500000000),0)*0.30+greatest(taxbase-5000000000,0)*0.35;
  new.withholding_amount:=round(progressive,2);new.withholding_rate:=0;
 else
  if (new.withholding_code in ('pph23_service','pph23_rental') and new.withholding_rate<>2)
   or (new.withholding_code='pph_final_rental' and new.withholding_rate<>10)
   or (new.withholding_code='pph_final_construction' and new.withholding_rate not in (1.75,2.65,4,3.5,6)) then raise exception 'Tarif tidak sesuai jenis PPh.';end if;
  new.withholding_amount:=round(new.withholding_base*new.withholding_rate/100,2);
 end if;
 new.total:=new.subtotal+new.vat_amount;new.payable_amount:=new.total-new.withholding_amount;new.updated_at:=now();return new;
end $$;
create trigger purchase_calculate before insert or update on public.purchase_requests for each row execute function gsp_private.calculate_purchase();

create function public.save_purchase_request(p_org uuid,p_branch uuid,p_payload jsonb,p_id uuid default null,p_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.purchase_requests;v public.procurement_vendors;newid uuid;attachments uuid[];bad integer;
begin
 if not gsp_private.can_access_business(p_org,p_branch,'procurement') then raise exception 'Akses cabang ditolak.' using errcode='42501';end if;
 if p_id is not null then
  select * into d from public.purchase_requests where id=p_id for update;
  if d.id is null or d.organization_id<>p_org or d.branch_id<>p_branch or (d.created_by<>auth.uid() and not gsp_private.is_superadmin(p_org)) then raise exception 'Pengajuan bukan milik Anda.' using errcode='42501';end if;
  if d.version is distinct from p_version or d.status not in ('draft','rejected') then raise exception 'Versi berubah atau pengajuan terkunci.';end if;
 end if;
 select * into v from public.procurement_vendors where id=nullif(p_payload->>'vendor_id','')::uuid and organization_id=p_org and branch_id=p_branch;
 if nullif(p_payload->>'vendor_id','') is not null and (v.id is null or v.status='rejected') then raise exception 'Vendor tidak tersedia di cabang ini.';end if;
 if nullif(btrim(p_payload->>'invoice_number'),'') is null or nullif(p_payload->>'invoice_date','') is null then raise exception 'Nomor dan tanggal invoice wajib diisi.';end if;
 select coalesce(array_agg(value::uuid),'{}') into attachments from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids','[]'));
 if cardinality(attachments)>0 then
  if cardinality(attachments)>10 or to_regclass('public.procurement_attachments') is null then raise exception 'Lampiran tidak tersedia.';end if;
  execute 'select count(*) from unnest($1) x where not exists(select 1 from public.procurement_attachments a where a.id=x and a.organization_id=$2 and a.branch_id=$3 and a.domain=''procurement'')' into bad using attachments,p_org,p_branch;
  if bad>0 then raise exception 'Lampiran tidak sesuai cabang.';end if;
 end if;
 newid:=coalesce(p_id,gen_random_uuid());
 insert into public.purchase_requests(id,organization_id,branch_id,created_by,invoice_number,invoice_date,tax_invoice_number,tax_invoice_date,vendor_id,vendor_snapshot,lines,vat_mode,vat_creditable,withholding_code,withholding_rate,withholding_base,requested_payment_date,notes,attachment_ids,withholding_timing)
 values(newid,p_org,p_branch,auth.uid(),btrim(p_payload->>'invoice_number'),(p_payload->>'invoice_date')::date,nullif(p_payload->>'tax_invoice_number',''),nullif(p_payload->>'tax_invoice_date','')::date,v.id,case when v.id is not null then to_jsonb(v) else coalesce(p_payload->'vendor_snapshot','{}') end,p_payload->'lines',coalesce(p_payload->>'vat_mode','none'),coalesce((p_payload->>'vat_creditable')::boolean,false),coalesce(p_payload->>'withholding_code','none'),coalesce((p_payload->>'withholding_rate')::numeric,0),coalesce((p_payload->>'withholding_base')::numeric,0),nullif(p_payload->>'requested_payment_date','')::date,p_payload->>'notes',attachments,coalesce(p_payload->>'withholding_timing','invoice'))
 on conflict(id) do update set invoice_number=excluded.invoice_number,invoice_date=excluded.invoice_date,tax_invoice_number=excluded.tax_invoice_number,tax_invoice_date=excluded.tax_invoice_date,vendor_id=excluded.vendor_id,vendor_snapshot=excluded.vendor_snapshot,lines=excluded.lines,vat_mode=excluded.vat_mode,vat_creditable=excluded.vat_creditable,withholding_code=excluded.withholding_code,withholding_rate=excluded.withholding_rate,withholding_base=excluded.withholding_base,withholding_timing=excluded.withholding_timing,requested_payment_date=excluded.requested_payment_date,notes=excluded.notes,attachment_ids=excluded.attachment_ids,status='draft',version=purchase_requests.version+1,coa_confirmed=false;
 perform gsp_private.procurement_log(p_org,p_branch,newid,'purchase','draft_saved');return newid;
end $$;
create function public.submit_purchase_request(p_id uuid,p_version integer) returns void language plpgsql security definer set search_path='' as $$
declare d public.purchase_requests;nextstatus text;
begin
 select * into d from public.purchase_requests where id=p_id for update;
 if d.id is null or not gsp_private.can_access_business(d.organization_id,d.branch_id,'procurement') or (d.created_by<>auth.uid() and not gsp_private.is_superadmin(d.organization_id)) then raise exception 'Akses pengajuan ditolak.' using errcode='42501';end if;
 if d.status<>'draft' or d.version<>p_version then raise exception 'Draft berubah atau sudah diajukan.';end if;
 if not exists(select 1 from public.procurement_vendors where id=d.vendor_id and status='approved') then raise exception 'Vendor harus disetujui Finance sebelum pengajuan pembayaran.';end if;
 nextstatus:=case when gsp_private.has_job(d.organization_id,d.branch_id,array['branch_manager','project_manager']) then 'director_review' else 'branch_review' end;
 update public.purchase_requests set status=nextstatus,version=version+1,vendor_snapshot=(select to_jsonb(v) from public.procurement_vendors v where v.id=d.vendor_id) where id=d.id;
 perform gsp_private.procurement_log(d.organization_id,d.branch_id,d.id,'purchase','submitted',null,jsonb_build_object('next',nextstatus));
end $$;

create function public.link_business_unit_entity(p_org uuid,p_branch uuid,p_entity uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not gsp_private.is_superadmin(p_org) then raise exception 'Hanya Super Admin dapat memetakan cabang.' using errcode='42501';end if;
 if exists(select 1 from public.company_entities e join public.company_entities p on p.id=e.parent_entity_id where e.id=p_entity and (e.functional_currency<>'IDR' or p.functional_currency<>'IDR')) then raise exception 'Pengajuan pembelian saat ini hanya mendukung pembukuan IDR.';end if;
 if not exists(select 1 from public.company_entities e join public.company_entities parent on parent.id=e.parent_entity_id and parent.organization_id=e.organization_id where e.id=p_entity and e.organization_id=p_org and e.entity_type='branch' and parent.entity_type='parent' and e.is_active and (e.tax_id is null or e.tax_id=parent.tax_id)
 and not exists(select 1 from public.business_units b join public.company_entities other on other.id=b.entity_id where b.organization_id=p_org and other.parent_entity_id<>parent.id))
 or exists(select 1 from public.business_units where entity_id=p_entity and id<>p_branch) then raise exception 'Pilih entitas cabang aktif dari perusahaan induk yang sama, belum dipakai cabang lain.';end if;
 if exists(select 1 from public.purchase_requests where branch_id=p_branch and journal_id is not null) then raise exception 'Pemetaan cabang dengan jurnal sudah terkunci.';end if;
 update public.business_units set entity_id=p_entity where id=p_branch and organization_id=p_org and kind='branch';
 if not found then raise exception 'Cabang tidak ditemukan.';end if;
 insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id,details) values(p_org,auth.uid(),'branch.entity_link','business_units',p_branch::text,jsonb_build_object('entity_id',p_entity));
end $$;

create function gsp_private.can_review_purchase(d public.purchase_requests) returns boolean language sql stable security definer set search_path='' as $$
 select gsp_private.can_access_business(d.organization_id,d.branch_id,'procurement') and (d.status='payment_ready' or gsp_private.is_superadmin(d.organization_id) or d.created_by<>auth.uid()) and case d.status
 when 'branch_review' then gsp_private.has_job(d.organization_id,d.branch_id,array['branch_manager'])
 when 'director_review' then gsp_private.has_job(d.organization_id,null,array['finance_director'])
 when 'accounting_review' then gsp_private.has_job(d.organization_id,null,array['accounting_tax'])
 when 'payment_ready' then gsp_private.has_job(d.organization_id,null,array['finance']) else false end
$$;
create function public.review_purchase_request(p_id uuid,p_version integer,p_approve boolean,p_note text,p_accounting jsonb default null) returns void language plpgsql security definer set search_path='' as $$
declare d public.purchase_requests;nextstatus text;j uuid;ln integer:=0;l jsonb;a uuid;amt numeric;entity uuid;period uuid;ap uuid;vat uuid;wh uuid;cost numeric;before_doc jsonb;
begin
 select * into d from public.purchase_requests where id=p_id for update;
 before_doc:=to_jsonb(d);
 if d.id is null or not gsp_private.can_review_purchase(d) or d.status='payment_ready' then raise exception 'Bukan tahap pemeriksaan Anda.' using errcode='42501';end if;
 if d.version<>p_version then raise exception 'Versi pengajuan berubah.';end if;
 if p_approve is null or (not p_approve and nullif(btrim(p_note),'') is null) then raise exception 'Keputusan dan alasan penolakan wajib diisi.';end if;
 if not p_approve then nextstatus:='rejected';
 elsif d.status='branch_review' then nextstatus:='director_review';
 elsif d.status='director_review' then nextstatus:='accounting_review';
 else
  if p_accounting is null or (p_accounting->>'coa_confirmed')::boolean is distinct from true then raise exception 'Accounting wajib memeriksa COA dan pajak.';end if;
  if p_accounting ? 'lines' and (
   (select jsonb_agg(value-'account_id' order by ord) from jsonb_array_elements(p_accounting->'lines') with ordinality x(value,ord))
   is distinct from (select jsonb_agg(value-'account_id' order by ord) from jsonb_array_elements(d.lines) with ordinality x(value,ord))
  ) then raise exception 'Accounting hanya boleh mengoreksi COA; perubahan rincian/nominal perlu pengajuan baru.';end if;
  entity:=(p_accounting->>'entity_id')::uuid;period:=(p_accounting->>'period_id')::uuid;
  ap:=(p_accounting->>'payable_account_id')::uuid;vat:=nullif(p_accounting->>'vat_account_id','')::uuid;wh:=nullif(p_accounting->>'withholding_account_id','')::uuid;
  if not exists(select 1 from public.business_units where id=d.branch_id and organization_id=d.organization_id and entity_id=entity) then raise exception 'Super Admin perlu memetakan cabang ke entitas akuntansi terlebih dahulu.';end if;
  if not exists(select 1 from public.accounting_periods where id=period and organization_id=d.organization_id and entity_id=entity and period_status='open' and d.invoice_date between starts_on and ends_on) then raise exception 'Periode akuntansi harus terbuka dan mencakup tanggal invoice.';end if;
  if not exists(select 1 from public.finance_accounts where id=ap and organization_id=d.organization_id and is_active and account_type='liability') then raise exception 'Akun utang usaha harus akun liabilitas aktif.';end if;
  update public.purchase_requests set lines=coalesce(p_accounting->'lines',lines),
   vat_mode=coalesce(p_accounting->>'vat_mode',vat_mode),vat_creditable=coalesce((p_accounting->>'vat_creditable')::boolean,vat_creditable),
   withholding_code=coalesce(p_accounting->>'withholding_code',withholding_code),withholding_rate=coalesce((p_accounting->>'withholding_rate')::numeric,withholding_rate),
   withholding_base=coalesce((p_accounting->>'withholding_base')::numeric,withholding_base),withholding_timing=coalesce(p_accounting->>'withholding_timing',withholding_timing),coa_confirmed=true,payable_account_id=ap,withholding_account_id=wh where id=d.id returning * into d;
  if d.vat_creditable and d.vat_amount>0 and not exists(select 1 from public.finance_accounts where id=vat and organization_id=d.organization_id and is_active and account_type='asset') then raise exception 'Akun PPN masukan belum sesuai pajak yang dikoreksi.';end if;
  if d.vat_creditable and d.vat_amount>0 and (nullif(btrim(d.tax_invoice_number),'') is null or d.tax_invoice_date is null) then raise exception 'Nomor dan tanggal faktur pajak wajib diisi sebelum pengkreditan PPN masukan.';end if;
  if d.withholding_amount>0 and not exists(select 1 from public.finance_accounts where id=wh and organization_id=d.organization_id and is_active and account_type='liability' and id<>ap) then raise exception 'Akun utang PPh belum sesuai pajak yang dikoreksi.';end if;
  insert into public.accounting_journals(organization_id,entity_id,period_id,journal_number,journal_date,source_type,source_id,description,created_by)
  values(d.organization_id,entity,period,'AP-'||d.id::text,d.invoice_date,'payable',d.id,'Invoice '||d.invoice_number,auth.uid()) returning id into j;
  for l in select value from jsonb_array_elements(d.lines) loop
   ln:=ln+1;amt:=(l->>'amount')::numeric;
   cost:=amt+case when not d.vat_creditable then round(amt*case d.vat_mode when 'non_luxury' then 0.11 when 'luxury' then 0.12 else 0 end,2) else 0 end;
   -- Assign any rounding remainder to the last cost line.
   if ln=jsonb_array_length(d.lines) and not d.vat_creditable then
    select d.total-coalesce(sum(debit),0) into cost from public.accounting_journal_lines where journal_id=j;
   end if;
   insert into public.accounting_journal_lines(organization_id,journal_id,line_number,account_id,description,debit,counterparty_type,counterparty_id,reference_number)
   values(d.organization_id,j,ln,(l->>'account_id')::uuid,l->>'description',cost,'vendor',d.vendor_id,d.invoice_number);
  end loop;
  if d.vat_creditable and d.vat_amount>0 then
   ln:=ln+1;insert into public.accounting_journal_lines(organization_id,journal_id,line_number,account_id,description,debit) values(d.organization_id,j,ln,vat,'PPN masukan',d.vat_amount);
  end if;
  if d.withholding_timing='invoice' and d.withholding_amount>0 then
   ln:=ln+1;insert into public.accounting_journal_lines(organization_id,journal_id,line_number,account_id,description,credit,tax_code,tax_amount)
    values(d.organization_id,j,ln,wh,'PPh dipotong saat pengakuan invoice',d.withholding_amount,d.withholding_code,d.withholding_amount);
  end if;
  ln:=ln+1;insert into public.accounting_journal_lines(organization_id,journal_id,line_number,account_id,description,credit,counterparty_type,counterparty_id,reference_number)
   values(d.organization_id,j,ln,ap,'Utang usaha',case when d.withholding_timing='invoice' then d.payable_amount else d.total end,'vendor',d.vendor_id,d.invoice_number);
  perform public.validate_accounting_journal(j);
  update public.accounting_journals set status='posted' where id=j;
  update public.purchase_requests set journal_id=j where id=d.id;
  nextstatus:='payment_ready';
 end if;
 update public.purchase_requests set status=nextstatus,review_note=p_note,version=version+1 where id=d.id returning * into d;
 perform gsp_private.procurement_log(d.organization_id,d.branch_id,d.id,'purchase',case when p_approve then 'approved' else 'rejected' end,p_note,jsonb_build_object('from',before_doc->>'status','to',nextstatus,'journal_id',j,'superadmin_override',d.created_by=auth.uid(),'before',before_doc,'after',to_jsonb(d)));
end $$;

create function public.pay_purchase_request(p_id uuid,p_version integer,p_payment_date date,p_reference text,p_bank_account_id uuid,p_period_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.purchase_requests;j uuid;entity uuid;n integer:=2;
begin
 select * into d from public.purchase_requests where id=p_id for update;
 if d.id is null or not gsp_private.can_review_purchase(d) or d.status<>'payment_ready' then raise exception 'Pengajuan belum siap dibayar atau akses Finance ditolak.' using errcode='42501';end if;
 if d.version<>p_version or d.payment_journal_id is not null then raise exception 'Versi berubah atau pembayaran sudah dicatat.';end if;
 if d.journal_id is null or not exists(select 1 from public.accounting_journals where id=d.journal_id and source_id=d.id and source_type='payable' and status='posted') then raise exception 'Jurnal utang belum diposting atau sudah dikoreksi.';end if;
 if nullif(btrim(p_reference),'') is null or p_payment_date is null then raise exception 'Tanggal dan bukti/referensi pembayaran wajib diisi.';end if;
 if p_payment_date<d.invoice_date then raise exception 'Tanggal pembayaran tidak boleh mendahului invoice; gunakan alur uang muka untuk pembayaran di muka.';end if;
 select entity_id into entity from public.business_units where id=d.branch_id;
 if not exists(select 1 from public.accounting_periods where id=p_period_id and organization_id=d.organization_id and entity_id=entity and period_status='open' and p_payment_date between starts_on and ends_on) then raise exception 'Periode pembayaran tidak sesuai cabang dan tanggal.';end if;
 if not exists(select 1 from public.finance_accounts where id=p_bank_account_id and organization_id=d.organization_id and is_active and account_type='asset' and id<>d.payable_account_id) then raise exception 'Akun kas/bank tidak valid.';end if;
 insert into public.accounting_journals(organization_id,entity_id,period_id,journal_number,journal_date,source_type,source_id,description,created_by)
 values(d.organization_id,entity,p_period_id,'PAY-'||d.id::text,p_payment_date,'payment',d.id,'Pembayaran invoice '||d.invoice_number,auth.uid()) returning id into j;
 insert into public.accounting_journal_lines(organization_id,journal_id,line_number,account_id,description,debit,counterparty_type,counterparty_id,reference_number)
 values(d.organization_id,j,1,d.payable_account_id,'Pelunasan utang usaha',case when d.withholding_timing='invoice' then d.payable_amount else d.total end,'vendor',d.vendor_id,p_reference);
 if d.payable_amount>0 then
  insert into public.accounting_journal_lines(organization_id,journal_id,line_number,account_id,description,credit,reference_number) values(d.organization_id,j,2,p_bank_account_id,'Kas/bank dibayarkan',d.payable_amount,p_reference);
 end if;
 if d.withholding_amount>0 and d.withholding_timing='payment' then
  n:=case when d.payable_amount>0 then 3 else 2 end;
  insert into public.accounting_journal_lines(organization_id,journal_id,line_number,account_id,description,credit,tax_code,tax_amount) values(d.organization_id,j,n,d.withholding_account_id,'PPh dipotong saat pembayaran',d.withholding_amount,d.withholding_code,d.withholding_amount);
 end if;
 perform public.validate_accounting_journal(j);update public.accounting_journals set status='posted' where id=j;
 update public.purchase_requests set status='paid',payment_journal_id=j,paid_on=p_payment_date,payment_reference=p_reference,version=version+1 where id=d.id;
 perform gsp_private.procurement_log(d.organization_id,d.branch_id,d.id,'purchase','paid',p_reference,jsonb_build_object('journal_id',j,'date',p_payment_date,'executor_is_requester',d.created_by=auth.uid()));
end $$;

create table public.sales_clients (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,branch_id uuid not null,name text not null,address text not null,npwp text,contact text not null,industry text not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(organization_id,branch_id,id),
 foreign key(organization_id,branch_id) references public.business_units(organization_id,id)
);
create index sales_clients_branch on public.sales_clients(organization_id,branch_id);
create table public.sales_documents (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,branch_id uuid not null,client_id uuid not null,
 kind text not null check(kind in ('sph','spk')),title text not null,source text not null check(source in ('company','client')),
 accepted_sph_id uuid,status text not null default 'draft' check(status in ('draft','accepted')),notes text,attachment_ids uuid[] not null default '{}',
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),accepted_by uuid references auth.users(id),accepted_at timestamptz,acceptance_reference text,accepted_on date,
 unique(organization_id,branch_id,id),foreign key(organization_id,branch_id,client_id) references public.sales_clients(organization_id,branch_id,id),
 foreign key(organization_id,branch_id,accepted_sph_id) references public.sales_documents(organization_id,branch_id,id),
 check((kind='sph' and accepted_sph_id is null) or (kind='spk' and accepted_sph_id is not null))
);
create index sales_documents_branch on public.sales_documents(organization_id,branch_id,client_id);
create function public.save_sales_client(p_org uuid,p_branch uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid;
begin
 if not gsp_private.can_access_business(p_org,p_branch,'sales') then raise exception 'Akses klien cabang ditolak.' using errcode='42501';end if;
 if not exists(select 1 from public.business_units where id=p_branch and organization_id=p_org and kind='branch') then raise exception 'Cabang tidak valid.';end if;
 if exists(select 1 from unnest(array['name','address','contact','industry']) k where nullif(btrim(p_payload->>k),'') is null) then raise exception 'Nama PT, alamat, kontak, dan bidang usaha wajib diisi.';end if;
 insert into public.sales_clients(organization_id,branch_id,name,address,npwp,contact,industry,created_by)
 values(p_org,p_branch,p_payload->>'name',p_payload->>'address',nullif(p_payload->>'npwp',''),p_payload->>'contact',p_payload->>'industry',auth.uid()) returning id into i;
 perform gsp_private.procurement_log(p_org,p_branch,i,'client','created');return i;
end $$;
create function public.save_sales_document(p_org uuid,p_branch uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid;c uuid;prev public.sales_documents;attachments uuid[];bad integer;
begin
 if not gsp_private.can_access_business(p_org,p_branch,'sales') then raise exception 'Akses dokumen penjualan cabang ditolak.' using errcode='42501';end if;
 c:=(p_payload->>'client_id')::uuid;
 if not exists(select 1 from public.sales_clients where id=c and branch_id=p_branch and organization_id=p_org) or nullif(btrim(p_payload->>'title'),'') is null then raise exception 'Klien dan judul wajib diisi.';end if;
 if p_payload->>'kind'='spk' then
  select * into prev from public.sales_documents where id=(p_payload->>'accepted_sph_id')::uuid and organization_id=p_org and branch_id=p_branch and client_id=c and kind='sph' and status='accepted';
  if prev.id is null then raise exception 'SPK wajib merujuk SPH klien yang sudah disetujui kedua pihak.';end if;
 end if;
 select coalesce(array_agg(value::uuid),'{}') into attachments from jsonb_array_elements_text(coalesce(p_payload->'attachment_ids','[]'));
 if cardinality(attachments)>0 then
  if cardinality(attachments)>10 or to_regclass('public.procurement_attachments') is null then raise exception 'Lampiran tidak tersedia.';end if;
  execute 'select count(*) from unnest($1) x where not exists(select 1 from public.procurement_attachments a where a.id=x and a.organization_id=$2 and a.branch_id=$3 and a.domain=''sales'')' into bad using attachments,p_org,p_branch;
  if bad>0 then raise exception 'Lampiran tidak sesuai cabang.';end if;
 end if;
 insert into public.sales_documents(organization_id,branch_id,client_id,kind,title,source,accepted_sph_id,notes,attachment_ids,created_by)
 values(p_org,p_branch,c,p_payload->>'kind',p_payload->>'title',coalesce(p_payload->>'source','company'),prev.id,p_payload->>'notes',attachments,auth.uid()) returning id into i;
 perform gsp_private.procurement_log(p_org,p_branch,i,p_payload->>'kind','draft_created');return i;
end $$;
create function public.accept_sales_sph(p_id uuid,p_reference text,p_accepted_on date) returns void language plpgsql security definer set search_path='' as $$
declare d public.sales_documents;
begin
 select * into d from public.sales_documents where id=p_id for update;
 if d.id is null or not gsp_private.has_job(d.organization_id,d.branch_id,array['president','finance_director','technical_director','branch_manager']) then raise exception 'Akses penerimaan SPH ditolak.' using errcode='42501';end if;
 if d.kind<>'sph' or d.status<>'draft' then raise exception 'SPH sudah diterima atau dokumen bukan SPH.';end if;
 if nullif(btrim(p_reference),'') is null or p_accepted_on is null then raise exception 'Referensi bukti kesepakatan kedua pihak dan tanggal wajib diisi.';end if;
 update public.sales_documents set status='accepted',accepted_by=auth.uid(),accepted_at=now(),acceptance_reference=p_reference,accepted_on=p_accepted_on where id=d.id;
 perform gsp_private.procurement_log(d.organization_id,d.branch_id,d.id,'sph','mutual_acceptance_recorded',p_reference,jsonb_build_object('accepted_on',p_accepted_on));
end $$;

create function public.purchase_review_queue(p_org uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(q),'[]') from (
 select d.id,'purchase' kind,d.invoice_number title,d.status,d.branch_id,d.payable_amount amount from public.purchase_requests d where d.organization_id=p_org and gsp_private.can_review_purchase(d)
 union all
 select v.id,'vendor',v.name,v.status,v.branch_id,0::numeric from public.procurement_vendors v where v.organization_id=p_org and v.status='pending' and gsp_private.has_job(p_org,null,array['finance','accounting_tax']) and (v.created_by<>auth.uid() or gsp_private.is_superadmin(p_org))
 ) q
$$;
create function public.purchase_branch_report(p_org uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(q),'[]') from (
 select b.id branch_id,b.name branch_name,count(d.id) filter(where d.status not in ('draft','rejected')) submitted_count,
 coalesce(sum(case when d.withholding_timing='invoice' then d.payable_amount else d.total end) filter(where d.status='payment_ready'),0) unpaid_amount,
 coalesce(sum(d.payable_amount) filter(where d.status='paid'),0) paid_amount
 from public.business_units b left join public.purchase_requests d on d.branch_id=b.id and d.organization_id=b.organization_id
 where b.organization_id=p_org and b.kind='branch' and gsp_private.can_access_business(p_org,b.id,'procurement') group by b.id,b.name order by b.name
 ) q
$$;

-- Explicit external project grants. External identities never inherit internal
-- branch roles, company directories, vendor bank details, or the general ledger.
create table public.project_access_scopes (
 organization_id uuid not null,project_id uuid primary key,branch_id uuid not null,
 foreign key(organization_id,project_id) references public.crm_projects(organization_id,id),
 foreign key(organization_id,branch_id) references public.business_units(organization_id,id),unique(organization_id,project_id)
);
create table public.project_memberships (
 organization_id uuid not null,project_id uuid not null,user_id uuid not null,
 member_type text not null check(member_type in ('client','consultant','vendor')),can_submit boolean not null default false,is_active boolean not null default true,
 granted_by uuid not null references auth.users(id),granted_at timestamptz not null default now(),
 primary key(project_id,user_id),foreign key(organization_id,project_id) references public.project_access_scopes(organization_id,project_id),
 foreign key(organization_id,user_id) references public.organization_members(organization_id,user_id)
);
create index project_memberships_actor on public.project_memberships(user_id,organization_id,is_active);
create table public.project_portal_entries (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,project_id uuid not null,
 kind text not null check(kind in ('request','status','mom','document','correspondence','invoice_summary')),
 audience text not null check(audience in ('internal','external')),title text not null,body text not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 foreign key(organization_id,project_id) references public.project_access_scopes(organization_id,project_id)
);
create index project_portal_entries_project on public.project_portal_entries(project_id,created_at);
create function gsp_private.project_internal(p_org uuid,p_project uuid) returns boolean language sql stable security definer set search_path='' as $$
 select gsp_private.is_superadmin(p_org) or exists(select 1 from public.project_access_scopes s where s.organization_id=p_org and s.project_id=p_project and gsp_private.can_access_business(p_org,s.branch_id,'sales'))
$$;
create function public.can_access_project(p_org uuid,p_project uuid) returns boolean language sql stable security definer set search_path='' as $$
 select gsp_private.project_internal(p_org,p_project) or exists(select 1 from public.project_memberships m join public.crm_projects p on p.id=m.project_id and p.organization_id=m.organization_id
 join public.person_profiles profile on profile.organization_id=m.organization_id and profile.user_id=m.user_id and profile.relationship_status=m.member_type
 where m.organization_id=p_org and m.project_id=p_project and m.user_id=auth.uid() and m.is_active and p.status='active')
$$;
create function public.list_portal_projects(p_org uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(q order by q.code),'[]') from (
 select s.project_id,s.project_id id,s.branch_id,p.code,p.name,p.status,gsp_private.project_internal(p_org,s.project_id) can_publish,gsp_private.project_internal(p_org,s.project_id) is_internal,
 (gsp_private.project_internal(p_org,s.project_id) or exists(select 1 from public.project_memberships m where m.organization_id=p_org and m.project_id=s.project_id and m.user_id=auth.uid() and m.is_active and m.can_submit)) can_submit
 from public.project_access_scopes s join public.crm_projects p on p.id=s.project_id and p.organization_id=s.organization_id
 where s.organization_id=p_org and public.can_access_project(p_org,s.project_id)
 ) q
$$;
create function public.set_project_portal_access(p_org uuid,p_project uuid,p_branch uuid,p_user uuid,p_member_type text,p_can_submit boolean,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not gsp_private.is_superadmin(p_org) then raise exception 'Hanya Super Admin mengatur akses proyek eksternal.' using errcode='42501';end if;
 if not exists(select 1 from public.crm_projects where id=p_project and organization_id=p_org)
 or not exists(select 1 from public.business_units where id=p_branch and organization_id=p_org and kind='branch') then raise exception 'Proyek atau cabang tidak valid.';end if;
 if exists(select 1 from public.project_access_scopes where project_id=p_project and branch_id<>p_branch) then raise exception 'Cakupan cabang proyek sudah ditetapkan.';end if;
 if not exists(select 1 from public.person_profiles where organization_id=p_org and user_id=p_user and relationship_status=p_member_type and relationship_status in ('client','consultant','vendor')) then raise exception 'Identitas eksternal harus sesuai profil hubungan.';end if;
 insert into public.project_access_scopes values(p_org,p_project,p_branch) on conflict do nothing;
 insert into public.project_memberships(organization_id,project_id,user_id,member_type,can_submit,is_active,granted_by)
 values(p_org,p_project,p_user,p_member_type,p_can_submit,p_active,auth.uid()) on conflict(project_id,user_id) do update set member_type=excluded.member_type,can_submit=excluded.can_submit,is_active=excluded.is_active,granted_by=auth.uid(),granted_at=now();
 perform gsp_private.procurement_log(p_org,p_branch,p_project,'project_access',case when p_active then 'granted' else 'revoked' end,null,jsonb_build_object('user_id',p_user,'member_type',p_member_type,'can_submit',p_can_submit));
end $$;
create function public.configure_project_scope(p_org uuid,p_project uuid,p_branch uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not gsp_private.is_superadmin(p_org) then raise exception 'Hanya Super Admin mengatur cakupan proyek.' using errcode='42501';end if;
 if not exists(select 1 from public.crm_projects where id=p_project and organization_id=p_org)
 or not exists(select 1 from public.business_units where id=p_branch and organization_id=p_org and kind='branch') then raise exception 'Proyek atau cabang tidak valid.';end if;
 if exists(select 1 from public.project_access_scopes where project_id=p_project and branch_id<>p_branch) then raise exception 'Cakupan cabang proyek sudah ditetapkan.';end if;
 insert into public.project_access_scopes values(p_org,p_project,p_branch) on conflict do nothing;
 perform gsp_private.procurement_log(p_org,p_branch,p_project,'project_scope','configured');
end $$;
create function public.save_project_portal_entry(p_org uuid,p_project uuid,p_kind text,p_audience text,p_title text,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid;
begin
 if not gsp_private.project_internal(p_org,p_project) then
  if p_kind<>'request' or p_audience<>'external' or not public.can_access_project(p_org,p_project) or not exists(select 1 from public.project_memberships where project_id=p_project and user_id=auth.uid() and can_submit and is_active) then raise exception 'Akses kirim informasi proyek ditolak.' using errcode='42501';end if;
 end if;
 if nullif(btrim(p_title),'') is null or length(p_title)>200 or nullif(btrim(p_body),'') is null or length(p_body)>20000 then raise exception 'Judul dan isi informasi proyek wajib diisi.';end if;
 insert into public.project_portal_entries(organization_id,project_id,kind,audience,title,body,created_by) values(p_org,p_project,p_kind,p_audience,p_title,p_body,auth.uid()) returning id into i;return i;
end $$;

-- Fail closed for all legacy, unallocated company data. Only the Super Admin
-- continues using legacy workflows. New accounts use scoped workflows above.
-- The mapped journals and shared chart of accounts are the deliberate exceptions.
create or replace function public.has_org_role(target_org uuid,allowed_roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select ('owner'=any(allowed_roles) and gsp_private.is_superadmin(target_org))
 or ('finance'=any(allowed_roles) and gsp_private.has_job(target_org,null,array['accounting_tax','finance']))
$$;
create or replace function gsp_private.check_writer(p_org uuid,p_type text) returns void language plpgsql set search_path='' as $$
begin
 if not gsp_private.is_superadmin(p_org) then raise exception 'Data lama belum dipetakan ke cabang. Gunakan modul pengajuan bercakupan cabang.' using errcode='42501';end if;
end $$;
create function gsp_private.guard_legacy_scope() returns trigger language plpgsql security definer set search_path='' as $$
declare org uuid;j public.accounting_journals;d public.purchase_requests;
begin
 org:=case when tg_op='DELETE' then old.organization_id else new.organization_id end;
 if tg_table_name='accounting_journals' and tg_op<>'DELETE' and auth.uid() is not null then
  if new.reversal_of is not null and exists(select 1 from public.accounting_journals original join public.purchase_requests p on p.id=original.source_id where original.id=new.reversal_of) then
   raise exception 'Jurnal pengajuan pembelian memerlukan alur koreksi pembelian; pembalik umum tidak diizinkan.';
  end if;
 end if;
 if auth.uid() is null or gsp_private.is_superadmin(org) or (tg_table_name='audit_events' and tg_op='INSERT' and pg_trigger_depth()>1) then return case when tg_op='DELETE' then old else new end;end if;
 if tg_table_name in ('accounting_journals','accounting_journal_lines') and tg_op<>'DELETE' then
  if tg_table_name='accounting_journals' then j:=new;else select * into j from public.accounting_journals where id=new.journal_id;end if;
  select * into d from public.purchase_requests where id=j.source_id and organization_id=org;
  if d.id is not null and j.source_type in ('payable','payment') and j.entity_id=(select entity_id from public.business_units where id=d.branch_id)
   and ((j.source_type='payable' and d.status='accounting_review' and gsp_private.has_job(org,null,array['accounting_tax']))
   or (j.source_type='payment' and d.status='payment_ready' and gsp_private.has_job(org,null,array['finance']))) then return new;end if;
 end if;
 raise exception 'Akses data lama belum tersedia untuk pengguna perusahaan; gunakan pengajuan cabang.' using errcode='42501';
end $$;
do $$ declare tbl text;expr text;begin
 for tbl in select table_name from information_schema.columns where table_schema='public' and column_name='organization_id' and table_name not in
 ('business_units','person_profiles','work_assignments','procurement_vendors','purchase_requests','procurement_events','sales_clients','sales_documents','project_access_scopes','project_memberships','project_portal_entries')
 and exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relname=table_name and n.nspname='public' and c.relkind='r') loop
  expr:='gsp_private.is_superadmin(organization_id)';
  if tbl='organization_members' then expr:=expr||' or user_id=auth.uid()';
  elsif tbl='finance_accounts' then expr:=expr||' or exists(select 1 from public.business_units b where b.organization_id=finance_accounts.organization_id and public.can_access_business(b.organization_id,b.id,''procurement''))';
  elsif tbl in ('accounting_journals','accounting_periods','company_entities') then
   expr:=expr||format(' or exists(select 1 from public.business_units b where b.organization_id=%I.organization_id and b.entity_id=%I.%I and public.can_access_business(b.organization_id,b.id,''procurement''))',tbl,tbl,case when tbl='company_entities' then 'id' else 'entity_id' end);
  elsif tbl='accounting_journal_lines' then
   expr:=expr||' or exists(select 1 from public.accounting_journals j join public.business_units b on b.entity_id=j.entity_id and b.organization_id=j.organization_id where j.id=accounting_journal_lines.journal_id and public.can_access_business(b.organization_id,b.id,''procurement''))';
  end if;
  -- Policies cannot invoke the private helper as the caller; expose the narrow
  -- organization-owner predicate through the existing has_org_role wrapper.
  expr:=replace(expr,'gsp_private.is_superadmin(organization_id)','public.has_org_role(organization_id,array[''owner''])');
  execute format('create policy scoped_legacy_read on public.%I as restrictive for select to authenticated using (%s)',tbl,expr);
  if tbl not in ('organization_members') then
   execute format('create trigger scoped_legacy_write before insert or update or delete on public.%I for each row execute function gsp_private.guard_legacy_scope()',tbl);
  end if;
 end loop;
end $$;

-- Organization membership mutation must never be delegated to business roles.
-- Existing permissive policies still require the owner role for writes.
create policy own_membership_only on public.organization_members as restrictive for all to authenticated
 using(public.has_org_role(organization_id,array['owner']) or user_id=auth.uid())
 with check(public.has_org_role(organization_id,array['owner']));

-- Scoped SELECT only; transactional RPCs own every mutation.
do $$ declare t text;begin
 foreach t in array array['business_units','person_profiles','work_assignments','procurement_vendors','purchase_requests','procurement_events','sales_clients','sales_documents','project_access_scopes','project_memberships','project_portal_entries'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy business_units_read on public.business_units for select to authenticated using(public.has_org_role(organization_id,array['owner']) or public.can_access_business(organization_id,id,'procurement') or public.can_access_business(organization_id,id,'sales') or public.can_access_business(organization_id,id,'hr'));
create policy own_profile on public.person_profiles for select to authenticated using(user_id=auth.uid() or public.has_org_role(organization_id,array['owner']));
create policy own_assignments on public.work_assignments for select to authenticated using(user_id=auth.uid() or public.has_org_role(organization_id,array['owner']));
create policy vendor_branch_read on public.procurement_vendors for select to authenticated using(public.can_access_business(organization_id,branch_id,'procurement'));
create policy purchase_branch_read on public.purchase_requests for select to authenticated using(public.can_access_business(organization_id,branch_id,'procurement'));
create policy event_branch_read on public.procurement_events for select to authenticated using(public.can_access_business(organization_id,branch_id,case when entity_type in ('client','sph','spk') then 'sales' else 'procurement' end));
create policy client_branch_read on public.sales_clients for select to authenticated using(public.can_access_business(organization_id,branch_id,'sales'));
create policy sales_branch_read on public.sales_documents for select to authenticated using(public.can_access_business(organization_id,branch_id,'sales'));
create policy project_scope_read on public.project_access_scopes for select to authenticated using(public.can_access_project(organization_id,project_id));
create policy project_membership_read on public.project_memberships for select to authenticated using(user_id=auth.uid() or public.has_org_role(organization_id,array['owner']));
create policy project_portal_entry_read on public.project_portal_entries for select to authenticated using(public.can_access_project(organization_id,project_id) and (audience='external' or public.can_access_business(organization_id,(select branch_id from public.project_access_scopes s where s.project_id=project_portal_entries.project_id),'sales')));

-- Existing OR policies cannot broaden access past the restrictive policies above.
-- Add narrow permissive reads for the shared COA and mapped accounting records.
create policy scoped_coa_read on public.finance_accounts for select to authenticated using(exists(select 1 from public.business_units b where b.organization_id=finance_accounts.organization_id and public.can_access_business(b.organization_id,b.id,'procurement')));
create policy scoped_entities_read on public.company_entities for select to authenticated using(exists(select 1 from public.business_units b where b.organization_id=company_entities.organization_id and b.entity_id=company_entities.id and public.can_access_business(b.organization_id,b.id,'procurement')));
create policy scoped_periods_read on public.accounting_periods for select to authenticated using(exists(select 1 from public.business_units b where b.organization_id=accounting_periods.organization_id and b.entity_id=accounting_periods.entity_id and public.can_access_business(b.organization_id,b.id,'procurement')));
create policy scoped_journals_read on public.accounting_journals for select to authenticated using(exists(select 1 from public.business_units b where b.organization_id=accounting_journals.organization_id and b.entity_id=accounting_journals.entity_id and public.can_access_business(b.organization_id,b.id,'procurement')));
create policy scoped_lines_read on public.accounting_journal_lines for select to authenticated using(exists(select 1 from public.accounting_journals j where j.id=accounting_journal_lines.journal_id));

-- Owner-only first-run configuration. Reference accounts contain no opening
-- balances or fictitious transactions; existing accounts are never overwritten.
create function public.initialize_purchasing_workspace(p_org uuid,p_starts_on date,p_ends_on date) returns void
language plpgsql security definer set search_path='' as $$
declare parent_id uuid;entity uuid;b public.business_units;company_name text;account_rows integer:=0;
begin
 if not gsp_private.is_superadmin(p_org) then raise exception 'Hanya Super Admin dapat menyiapkan pembelian.' using errcode='42501';end if;
 if p_starts_on is null or p_ends_on is null or p_starts_on<>date_trunc('month',p_starts_on)::date
 or p_ends_on<>(p_starts_on+interval '1 month'-interval '1 day')::date then raise exception 'Pilih satu bulan pembukuan yang valid.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':purchasing_setup',0));
 select name into company_name from public.organizations where id=p_org;
 select id into parent_id from public.company_entities where organization_id=p_org and entity_type='parent' and is_active and functional_currency='IDR';
 if parent_id is null then
  if exists(select 1 from public.company_entities where organization_id=p_org and entity_type='parent') then raise exception 'Periksa induk pembukuan yang sudah ada sebelum menyiapkan cabang.';end if;
  parent_id:=public.create_company_entity(p_org,'PUSAT',company_name,'parent','IDR',null,null,true);
 end if;
 for b in select * from public.business_units where organization_id=p_org and kind='branch' order by code loop
  entity:=b.entity_id;
  if entity is null then
   select id into entity from public.company_entities where organization_id=p_org and entity_code=b.code;
   if entity is null then entity:=public.create_company_entity(p_org,b.code,company_name||' - '||b.name,'branch','IDR',parent_id,null,false);end if;
   perform public.link_business_unit_entity(p_org,b.id,entity);
  end if;
  if not exists(select 1 from public.company_entities where id=entity and organization_id=p_org and parent_entity_id=parent_id and entity_type='branch' and is_active and functional_currency='IDR') then raise exception 'Pemetaan cabang perlu diperiksa terlebih dahulu.';end if;
  if not exists(select 1 from public.accounting_periods where organization_id=p_org and entity_id=entity and starts_on<=p_starts_on and ends_on>=p_ends_on) then
   perform public.create_accounting_period(p_org,entity,to_char(p_starts_on,'YYYY-MM'),p_starts_on,p_ends_on);
  end if;
 end loop;
 if not exists(select 1 from public.finance_accounts where organization_id=p_org) then
  insert into public.finance_accounts(organization_id,code,account_code,name,account_type,normal_balance,is_control_account,created_by)
  select p_org,x.code,x.code,x.name,x.kind,case when x.kind='liability' then 'credit' else 'debit' end,x.control,auth.uid()
  from (values
   ('1101','Kas','asset',false),('1102','Bank Operasional','asset',false),('1191','PPN Masukan','asset',false),
   ('1201','Persediaan','asset',false),('1501','Aset Tetap','asset',false),('2101','Utang Usaha','liability',true),
   ('2102','Utang PPh 23','liability',true),('2103','Utang PPh Final','liability',true),('2104','Utang PPh 21','liability',true),
   ('5101','Beban Operasional','expense',false),('5102','Beban Jasa','expense',false),('5103','Beban Sewa','expense',false)
  ) x(code,name,kind,control);
  get diagnostics account_rows=row_count;
 end if;
 insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id,details)
 values(p_org,auth.uid(),'purchasing.initialized','organizations',p_org::text,jsonb_build_object('starts_on',p_starts_on,'ends_on',p_ends_on,'new_accounts',account_rows,'opening_balances_created',false));
end $$;

revoke all on function public.validate_accounting_journal(uuid) from public,anon,authenticated;
revoke all on function public.guard_accounting_journal() from public,anon,authenticated;
revoke all on all functions in schema gsp_private from public,anon,authenticated;
-- Place privileged implementations outside the exposed API schema. The public
-- invoker wrappers expose only the named business operations with explicit grants.
do $$ declare f record;args text;callargs text;result_type text;begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array[
 'initialize_purchasing_workspace','can_access_business','has_business_job','can_access_project','list_portal_projects','configure_project_scope','set_project_portal_access','save_project_portal_entry','save_work_assignment','remove_work_assignment','link_business_unit_entity','save_procurement_vendor','review_procurement_vendor','save_purchase_request','submit_purchase_request','review_purchase_request','pay_purchase_request','save_sales_client','save_sales_document','accept_sales_sph','purchase_review_queue','purchase_branch_report']) loop
  args:=pg_get_function_arguments(f.oid);result_type:=pg_get_function_result(f.oid);
  select string_agg(quote_ident(a),' , ' order by ord) into callargs from pg_proc p cross join lateral unnest(p.proargnames) with ordinality x(a,ord) where p.oid=f.oid;
  execute format('alter function %s rename to %I',f.oid::regprocedure,'api_'||f.proname);
  execute format('alter function %s set schema gsp_private',f.oid::regprocedure);
  execute format('create function public.%I(%s) returns %s language sql security invoker set search_path='''' as $body$ select gsp_private.%I(%s) $body$',f.proname,args,result_type,'api_'||f.proname,callargs);
  execute format('revoke all on function public.%I(%s) from public,anon',f.proname,pg_get_function_identity_arguments(f.oid));
  execute format('grant execute on function public.%I(%s) to authenticated',f.proname,pg_get_function_identity_arguments(f.oid));
  execute format('grant execute on function %s to authenticated',f.oid::regprocedure);
 end loop;
end $$;
grant usage on schema gsp_private to authenticated;

