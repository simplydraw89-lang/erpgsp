alter table public.finance_accounts add column is_postable boolean not null default true;
alter table public.finance_accounts add column report_section text;
alter table public.finance_accounts add column posting_category text not null default 'general';
alter table public.finance_accounts add constraint coa_report_section check(report_section in ('asset','liability','equity','revenue','expense','other_income','oci'));
alter table public.finance_accounts add constraint coa_posting_category check(posting_category in ('general','cash_bank','receivable','trade_payable','input_vat','output_vat','withholding_tax','inventory','fixed_asset','equity','revenue','expense','oci'));
update public.finance_accounts set report_section=account_type where report_section is null;
alter table public.finance_accounts alter column report_section set not null;
create index finance_accounts_tree on public.finance_accounts(organization_id,parent_account_id,code);

create function gsp_private.guard_coa_hierarchy() returns trigger language plpgsql security definer set search_path='' as $$
declare parent public.finance_accounts; cycle_found boolean;
begin
 new.report_section:=coalesce(new.report_section,new.account_type);
 if not ((new.account_type='asset' and new.report_section='asset') or (new.account_type='liability' and new.report_section='liability')
  or (new.account_type='equity' and new.report_section in ('equity','oci')) or (new.account_type='revenue' and new.report_section in ('revenue','other_income'))
  or (new.account_type='expense' and new.report_section='expense')) then raise exception 'Jenis akun dan kelompok laporan tidak sesuai.';end if;
 if (new.posting_category in ('cash_bank','receivable','input_vat','inventory','fixed_asset') and new.account_type<>'asset')
  or (new.posting_category in ('trade_payable','output_vat','withholding_tax') and new.account_type<>'liability')
  or (new.posting_category='oci' and new.report_section<>'oci') then raise exception 'Kategori akun tidak sesuai jenis akun.';end if;
 if new.parent_account_id is not null then
  select * into parent from public.finance_accounts where id=new.parent_account_id and organization_id=new.organization_id;
  if parent.id is null or parent.is_postable or parent.account_type<>new.account_type or parent.report_section<>new.report_section or (new.is_active and not parent.is_active) then raise exception 'Induk harus kelompok aktif, satu organisasi, jenis dan kelompok laporan yang sama.';end if;
  with recursive ancestors as (
   select id,parent_account_id from public.finance_accounts where id=new.parent_account_id
   union select a.id,a.parent_account_id from public.finance_accounts a join ancestors p on a.id=p.parent_account_id
  ) select exists(select 1 from ancestors where id=new.id) into cycle_found;
  if cycle_found or new.id=new.parent_account_id then raise exception 'Hierarki COA tidak boleh melingkar.';end if;
 end if;
 if exists(select 1 from public.finance_accounts where parent_account_id=new.id and (new.is_postable or (is_active and not new.is_active))) then raise exception 'Akun beranak harus berupa kelompok; nonaktifkan akun anak lebih dahulu.';end if;
 if exists(select 1 from public.finance_accounts where parent_account_id=new.id and (account_type<>new.account_type or report_section<>new.report_section)) then raise exception 'Klasifikasi kelompok harus tetap sesuai akun anak.';end if;
 if tg_op='UPDATE' and exists(select 1 from public.accounting_journal_lines where account_id=old.id) and
  (new.code,new.account_type,new.normal_balance,new.parent_account_id,new.is_postable,new.report_section,new.posting_category)
  is distinct from (old.code,old.account_type,old.normal_balance,old.parent_account_id,old.is_postable,old.report_section,old.posting_category)
 then raise exception 'Klasifikasi akun yang sudah digunakan jurnal terkunci; buat akun baru untuk perubahan klasifikasi.';end if;
 return new;
end $$;
revoke all on function gsp_private.guard_coa_hierarchy() from public,anon,authenticated;
create trigger coa_hierarchy_guard before insert or update on public.finance_accounts for each row execute function gsp_private.guard_coa_hierarchy();

create function gsp_private.guard_postable_journal_line() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.finance_accounts where id=new.account_id and organization_id=new.organization_id and is_active and is_postable) then raise exception 'Jurnal hanya dapat memakai akun detail aktif, bukan kelompok COA.';end if;
 return new;
end $$;
revoke all on function gsp_private.guard_postable_journal_line() from public,anon,authenticated;
create trigger coa_postable_journal_guard before insert or update of account_id,organization_id on public.accounting_journal_lines for each row execute function gsp_private.guard_postable_journal_line();

-- Finance and Accounting may administer the shared chart; legacy business
-- records remain protected and direct client table writes remain revoked.
do $$ declare definition text;needle text;replacement text;begin
 select pg_get_functiondef('gsp_private.guard_legacy_scope()'::regprocedure) into definition;
 needle:='if tg_table_name in (''accounting_journals'',''accounting_journal_lines'') and tg_op<>''DELETE'' then';
 replacement:='if tg_table_name=''finance_accounts'' and gsp_private.has_job(org,null,array[''accounting_tax'',''finance'']) then return case when tg_op=''DELETE'' then old else new end;end if;
 if tg_table_name=''audit_events'' and tg_op=''INSERT'' and to_jsonb(new)->>''entity_type''=''finance_accounts'' and to_jsonb(new)->>''action'' in (''coa.created'',''coa.updated'',''coa.template_installed'') and gsp_private.has_job(org,null,array[''accounting_tax'',''finance'']) then return new;end if; '||needle;
 if position(needle in definition)=0 then raise exception 'Legacy scope guard berbeda dari baseline; tinjau sebelum migration.';end if;
 execute replace(definition,needle,replacement);
 select pg_get_functiondef('gsp_private.calculate_purchase()'::regprocedure) into definition;
 execute replace(definition,'and is_active and account_type in (''expense'',''asset'')','and is_active and is_postable and account_type in (''expense'',''asset'')');
 select pg_get_functiondef('public.validate_accounting_journal(uuid)'::regprocedure) into definition;
 execute replace(definition,'and not a.is_active','and (not a.is_active or not a.is_postable)');
 select pg_get_functiondef('gsp_private.api_pay_purchase_request(uuid,integer,date,text,uuid,uuid)'::regprocedure) into definition;
 execute replace(definition,'and account_type=''asset'' and id<>d.payable_account_id','and account_type=''asset'' and is_postable and posting_category=''cash_bank'' and id<>d.payable_account_id');
end $$;

create table gsp_private.coa_recommendations (
 code text primary key,parent_code text,name text not null,account_type text not null,normal_balance text not null,
 is_postable boolean not null,report_section text not null,posting_category text not null
);
alter table gsp_private.coa_recommendations enable row level security;
revoke all on gsp_private.coa_recommendations from public,anon,authenticated;
insert into gsp_private.coa_recommendations values
('1',null,'ASET','asset','debit',false,'asset','general'),
('10','1','Aset Lancar','asset','debit',false,'asset','general'),
('1100','10','Kas dan Setara Kas','asset','debit',false,'asset','general'),
('1101','1100','Kas','asset','debit',true,'asset','cash_bank'),
('1102','1100','Bank Operasional','asset','debit',true,'asset','cash_bank'),
('1103','1100','Deposito yang Memenuhi Kriteria Setara Kas','asset','debit',true,'asset','cash_bank'),
('1120','10','Piutang Usaha','asset','debit',false,'asset','general'),
('1121','1120','Piutang Klien','asset','debit',true,'asset','receivable'),
('1122','1120','Piutang Retensi','asset','debit',true,'asset','receivable'),
('1129','1120','Cadangan Kerugian Kredit Piutang','asset','credit',true,'asset','receivable'),
('1190','10','Pajak Dibayar di Muka dan Aset Lancar Lain','asset','debit',false,'asset','general'),
('1191','1190','PPN Masukan','asset','debit',true,'asset','input_vat'),
('1192','1190','Pajak Penghasilan Dibayar di Muka','asset','debit',true,'asset','general'),
('1193','1190','Uang Muka Vendor','asset','debit',true,'asset','general'),
('1194','1190','Biaya Dibayar di Muka','asset','debit',true,'asset','general'),
('1200','10','Persediaan','asset','debit',false,'asset','general'),
('1201','1200','Persediaan','asset','debit',true,'asset','inventory'),
('15','1','Aset Tidak Lancar','asset','debit',false,'asset','general'),
('1500','15','Aset Tetap dan Akumulasi Penyusutan','asset','debit',false,'asset','general'),
('1501','1500','Aset Tetap','asset','debit',true,'asset','fixed_asset'),
('1502','1500','Peralatan Survei dan Teknis','asset','debit',true,'asset','fixed_asset'),
('1503','1500','Kendaraan','asset','debit',true,'asset','fixed_asset'),
('1509','1500','Akumulasi Penyusutan Aset Tetap','asset','credit',true,'asset','fixed_asset'),
('1590','15','Aset Tidak Lancar Lain','asset','debit',false,'asset','general'),
('1591','1590','Aset Hak Guna','asset','debit',true,'asset','fixed_asset'),
('1592','1590','Aset Takberwujud','asset','debit',true,'asset','fixed_asset'),
('2',null,'LIABILITAS','liability','credit',false,'liability','general'),
('20','2','Liabilitas Jangka Pendek','liability','credit',false,'liability','general'),
('2100','20','Utang Usaha','liability','credit',false,'liability','general'),
('2101','2100','Utang Usaha','liability','credit',true,'liability','trade_payable'),
('2111','2100','Utang Subkontraktor dan Tenaga Ahli','liability','credit',true,'liability','trade_payable'),
('2120','20','Utang Pajak','liability','credit',false,'liability','general'),
('2102','2120','Utang PPh 23','liability','credit',true,'liability','withholding_tax'),
('2103','2120','Utang PPh Final','liability','credit',true,'liability','withholding_tax'),
('2104','2120','Utang PPh 21','liability','credit',true,'liability','withholding_tax'),
('2121','2120','PPN Keluaran','liability','credit',true,'liability','output_vat'),
('2122','2120','Utang PPh Badan','liability','credit',true,'liability','withholding_tax'),
('2130','20','Akrual dan Utang Lain','liability','credit',false,'liability','general'),
('2131','2130','Beban Masih Harus Dibayar','liability','credit',true,'liability','general'),
('2132','2130','Utang Gaji dan Tunjangan','liability','credit',true,'liability','general'),
('2140','20','Liabilitas Kontrak dan Uang Muka Klien','liability','credit',false,'liability','general'),
('2141','2140','Uang Muka Klien','liability','credit',true,'liability','general'),
('22','2','Liabilitas Jangka Panjang','liability','credit',false,'liability','general'),
('2211','22','Utang Bank Jangka Panjang','liability','credit',true,'liability','general'),
('2212','22','Liabilitas Sewa','liability','credit',true,'liability','general'),
('2213','22','Liabilitas Imbalan Kerja','liability','credit',true,'liability','general'),
('3',null,'EKUITAS','equity','credit',false,'equity','general'),
('31','3','Modal Saham dan Tambahan Modal','equity','credit',false,'equity','general'),
('3111','31','Modal Saham Ditempatkan dan Disetor','equity','credit',true,'equity','equity'),
('3112','31','Tambahan Modal Disetor','equity','credit',true,'equity','equity'),
('32','3','Saldo Laba','equity','credit',false,'equity','general'),
('3211','32','Saldo Laba Ditahan','equity','credit',true,'equity','equity'),
('3212','32','Laba Rugi Tahun Berjalan','equity','credit',true,'equity','equity'),
('33','3','Akumulasi Penghasilan Komprehensif Lain','equity','credit',false,'equity','general'),
('3311','33','Surplus Revaluasi Aset','equity','credit',true,'equity','equity'),
('3312','33','Akumulasi Pengukuran Kembali Imbalan Pasti','equity','credit',true,'equity','equity'),
('3313','33','Cadangan Nilai Wajar melalui OCI','equity','credit',true,'equity','equity'),
('4',null,'PENGHASILAN USAHA','revenue','credit',false,'revenue','general'),
('41','4','Pendapatan Jasa dan Proyek','revenue','credit',false,'revenue','general'),
('4111','41','Pendapatan Jasa Konsultansi','revenue','credit',true,'revenue','revenue'),
('4112','41','Pendapatan Survei dan Pengujian','revenue','credit',true,'revenue','revenue'),
('4113','41','Pendapatan Proyek Teknis','revenue','credit',true,'revenue','revenue'),
('42','4','Pengurang Pendapatan','revenue','debit',false,'revenue','general'),
('4211','42','Potongan dan Koreksi Pendapatan','revenue','debit',true,'revenue','revenue'),
('5',null,'BEBAN DAN BIAYA','expense','debit',false,'expense','general'),
('50','5','Biaya Langsung Proyek','expense','debit',false,'expense','general'),
('5011','50','Biaya Tenaga Ahli dan Subkontraktor','expense','debit',true,'expense','expense'),
('5012','50','Biaya Material Proyek','expense','debit',true,'expense','expense'),
('5013','50','Biaya Perjalanan Proyek','expense','debit',true,'expense','expense'),
('5100','5','Beban Usaha dan Administrasi','expense','debit',false,'expense','general'),
('5101','5100','Beban Operasional','expense','debit',true,'expense','expense'),
('5102','5100','Beban Jasa','expense','debit',true,'expense','expense'),
('5103','5100','Beban Sewa','expense','debit',true,'expense','expense'),
('5111','5100','Beban Gaji dan Tunjangan','expense','debit',true,'expense','expense'),
('5112','5100','Beban Utilitas dan Komunikasi','expense','debit',true,'expense','expense'),
('5113','5100','Beban Penyusutan dan Amortisasi','expense','debit',true,'expense','expense'),
('5114','5100','Beban Administrasi Umum','expense','debit',true,'expense','expense'),
('52','5','Beban Pendanaan','expense','debit',false,'expense','general'),
('5211','52','Beban Bunga','expense','debit',true,'expense','expense'),
('5212','52','Beban Administrasi Bank','expense','debit',true,'expense','expense'),
('53','5','Beban Lain','expense','debit',false,'expense','general'),
('5311','53','Rugi Pelepasan Aset','expense','debit',true,'expense','expense'),
('54','5','Beban Pajak Penghasilan','expense','debit',false,'expense','general'),
('5411','54','Beban Pajak Kini','expense','debit',true,'expense','expense'),
('5412','54','Beban Pajak Tangguhan','expense','debit',true,'expense','expense'),
('6',null,'PENGHASILAN LAIN','revenue','credit',false,'other_income','general'),
('61','6','Penghasilan di Luar Usaha Utama','revenue','credit',false,'other_income','general'),
('6111','61','Pendapatan Bunga','revenue','credit',true,'other_income','revenue'),
('6112','61','Laba Pelepasan Aset','revenue','credit',true,'other_income','revenue'),
('7',null,'PENGHASILAN KOMPREHENSIF LAIN','equity','credit',false,'oci','general'),
('71','7','OCI Tidak Direklasifikasi ke Laba Rugi','equity','credit',false,'oci','general'),
('7111','71','Selisih Revaluasi Aset Tetap Periode Berjalan','equity','credit',true,'oci','oci'),
('7112','71','Pengukuran Kembali Imbalan Pasti Periode Berjalan','equity','credit',true,'oci','oci'),
('7113','71','Pajak atas OCI Tidak Direklasifikasi','equity','debit',true,'oci','oci'),
('72','7','OCI Dapat Direklasifikasi ke Laba Rugi','equity','credit',false,'oci','general'),
('7211','72','Perubahan Nilai Wajar Instrumen Utang FVOCI','equity','credit',true,'oci','oci'),
('7212','72','Selisih Kurs Penjabaran Operasi Luar Negeri','equity','credit',true,'oci','oci'),
('7213','72','Pajak atas OCI Dapat Direklasifikasi','equity','debit',true,'oci','oci');

create function gsp_private.seed_recommended_coa(p_org uuid) returns void language plpgsql set search_path='' as $$
declare r record;existing public.finance_accounts;parent_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':coa',0));
 for r in with recursive tree as (
  select c.*,0 depth from gsp_private.coa_recommendations c where parent_code is null
  union all select c.*,p.depth+1 from gsp_private.coa_recommendations c join tree p on c.parent_code=p.code
 ) select * from tree order by depth,code loop
  parent_id:=null;
  if r.parent_code is not null then select id into parent_id from public.finance_accounts where organization_id=p_org and code=r.parent_code;end if;
  select * into existing from public.finance_accounts where organization_id=p_org and code=r.code;
  if existing.id is null then
   insert into public.finance_accounts(organization_id,code,account_code,name,account_type,normal_balance,parent_account_id,is_postable,report_section,posting_category,created_by)
   values(p_org,r.code,r.code,r.name,r.account_type,r.normal_balance,parent_id,r.is_postable,r.report_section,r.posting_category,auth.uid());
  else
   if existing.account_type<>r.account_type then raise exception 'Kode % sudah digunakan jenis akun berbeda; sesuaikan COA sebelum memasang rekomendasi.',r.code;end if;
   update public.finance_accounts set parent_account_id=coalesce(parent_account_id,parent_id),is_postable=r.is_postable,report_section=r.report_section,posting_category=r.posting_category where id=existing.id;
  end if;
 end loop;
end $$;
revoke all on function gsp_private.seed_recommended_coa(uuid) from public,anon,authenticated;

do $$ declare definition text;begin
 select pg_get_functiondef('gsp_private.api_initialize_purchasing_workspace(uuid,date,date)'::regprocedure) into definition;
 execute replace(definition,'get diagnostics account_rows=row_count;','get diagnostics account_rows=row_count; perform gsp_private.seed_recommended_coa(p_org); select count(*) into account_rows from public.finance_accounts where organization_id=p_org;');
end $$;

create function gsp_private.api_install_recommended_coa(p_org uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not gsp_private.has_job(p_org,null,array['accounting_tax','finance']) then raise exception 'Hanya Super Admin, Accounting atau Finance pusat dapat mengelola COA.' using errcode='42501';end if;
 perform gsp_private.seed_recommended_coa(p_org);
 insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id,details) values(p_org,auth.uid(),'coa.template_installed','finance_accounts',p_org::text,'{"template":"GSP-2026-v1","opening_balances_created":false}');
end $$;
create function public.install_recommended_coa(p_org uuid) returns void language sql security invoker set search_path='' as $$select gsp_private.api_install_recommended_coa(p_org)$$;

create function gsp_private.api_save_finance_account(p_org uuid,p_payload jsonb,p_id uuid default null,p_expected_version integer default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare old_account public.finance_accounts;result_id uuid;v_type text;v_section text;
begin
 if not gsp_private.has_job(p_org,null,array['accounting_tax','finance']) then raise exception 'Hanya Super Admin, Accounting atau Finance pusat dapat mengelola COA.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':coa',0));
 if p_id is not null then
  select * into old_account from public.finance_accounts where id=p_id and organization_id=p_org for update;
  if old_account.id is null or old_account.row_version is distinct from p_expected_version then raise exception 'Akun atau versi berubah. Muat ulang sebelum menyimpan.';end if;
 end if;
 if nullif(btrim(p_payload->>'code'),'') is null or length(p_payload->>'code')>32 or nullif(btrim(p_payload->>'name'),'') is null or length(p_payload->>'name')>200 then raise exception 'Kode dan nama akun wajib diisi sesuai batas panjang.';end if;
 v_type:=p_payload->>'account_type';v_section:=coalesce(p_payload->>'report_section',v_type);
 if p_id is null then
  insert into public.finance_accounts(organization_id,code,account_code,name,account_type,normal_balance,parent_account_id,is_postable,is_active,report_section,posting_category,created_by)
  values(p_org,btrim(p_payload->>'code'),btrim(p_payload->>'code'),btrim(p_payload->>'name'),v_type,p_payload->>'normal_balance',nullif(p_payload->>'parent_account_id','')::uuid,(p_payload->>'is_postable')::boolean,coalesce((p_payload->>'is_active')::boolean,true),v_section,coalesce(p_payload->>'posting_category','general'),auth.uid()) returning id into result_id;
 else
  update public.finance_accounts set code=btrim(p_payload->>'code'),account_code=btrim(p_payload->>'code'),name=btrim(p_payload->>'name'),account_type=v_type,normal_balance=p_payload->>'normal_balance',parent_account_id=nullif(p_payload->>'parent_account_id','')::uuid,
   is_postable=(p_payload->>'is_postable')::boolean,is_active=(p_payload->>'is_active')::boolean,report_section=v_section,posting_category=coalesce(p_payload->>'posting_category','general'),row_version=row_version+1 where id=p_id returning id into result_id;
 end if;
 insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id,details) values(p_org,auth.uid(),case when p_id is null then 'coa.created' else 'coa.updated' end,'finance_accounts',result_id::text,jsonb_build_object('before',to_jsonb(old_account),'after',(select to_jsonb(a) from public.finance_accounts a where id=result_id)));
 return result_id;
end $$;
create function public.save_finance_account(p_org uuid,p_payload jsonb,p_id uuid default null,p_expected_version integer default null) returns uuid
language sql security invoker set search_path='' as $$select gsp_private.api_save_finance_account(p_org,p_payload,p_id,p_expected_version)$$;

revoke all on function gsp_private.api_install_recommended_coa(uuid),gsp_private.api_save_finance_account(uuid,jsonb,uuid,integer),public.install_recommended_coa(uuid),public.save_finance_account(uuid,jsonb,uuid,integer) from public,anon,authenticated;
grant execute on function gsp_private.api_install_recommended_coa(uuid),gsp_private.api_save_finance_account(uuid,jsonb,uuid,integer),public.install_recommended_coa(uuid),public.save_finance_account(uuid,jsonb,uuid,integer) to authenticated;
-- Reference accounts only; no balances, vendors or business transactions.
do $$ declare o record;actor uuid;previous_actor text:=current_setting('request.jwt.claim.sub',true);begin
 for o in select id from public.organizations loop
  select user_id into actor from public.organization_members where organization_id=o.id and role='owner' order by created_at limit 1;
  if actor is not null then
   perform set_config('request.jwt.claim.sub',actor::text,true);
   perform gsp_private.seed_recommended_coa(o.id);
   insert into public.audit_events(organization_id,actor_id,action,entity_type,entity_id,details)
   values(o.id,actor,'coa.migration_seeded','finance_accounts',o.id::text,'{"source":"authorized_cli_migration","template":"GSP-2026-v1","opening_balances_created":false}');
  end if;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(previous_actor,''),true);
end $$;
