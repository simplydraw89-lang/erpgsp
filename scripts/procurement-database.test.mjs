import test from "node:test"
import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"

test("Branch isolation, purchase approval, posting and sales prerequisites", async (t) => {
 const db = new PGlite({ extensions: { pgcrypto } })
 try {
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb not null default '{}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
   create schema storage;
   create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null);
   alter table storage.buckets enable row level security;alter table storage.objects enable row level security;
   grant usage on schema storage to anon,authenticated;
   grant select,insert,update,delete on storage.buckets,storage.objects to anon,authenticated;
   -- Simulate a legacy installation with broad permissive policies. The new
   -- bucket must remain protected even when these policies already exist.
   create policy fixture_legacy_open on storage.objects for all to anon,authenticated using(true) with check(true);
   create policy fixture_legacy_open on storage.buckets for all to anon,authenticated using(true) with check(true);`)
  for (const name of (await readdir(new URL("../supabase/migrations/", import.meta.url))).filter(n=>n.endsWith(".sql")).sort()) {
   try { await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),"utf8")) }
   catch(error) { throw new Error(`Migration ${name}: ${error.message}`, {cause:error}) }
  }
  const ids=Array.from({length:10},(_,i)=>`20000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`)
  const [owner,staff,manager,director,accountant,finance,otherBranch,external,unassigned,outsider]=ids
  for(const id of ids) await db.query("insert into auth.users(id) values($1)",[id])
  const org=(await db.query("insert into public.organizations(name,slug) values('Scoped ERP','scoped-erp') returning id")).rows[0].id
  for(const id of ids.slice(0,9)) await db.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,$3)",[org,id,id===owner?'owner':'staff'])
  const branches=(await db.query("select * from public.business_units where organization_id=$1 order by code",[org])).rows
  const b=branches.find(x=>x.code==='SBY').id,b2=branches.find(x=>x.code==='JKT').id
  const as=(user,sql,args=[])=>db.transaction(async tx=>{await tx.exec("set local role authenticated");await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);return tx.query(sql,args)})
  const rpc=(user,name,args)=>as(user,`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) result`,args)
  for(const [id,branch,job,rel] of [[staff,b,'admin','permanent'],[manager,b,'branch_manager','permanent'],[director,null,'finance_director','permanent'],[accountant,null,'accounting_tax','permanent'],[finance,null,'finance','permanent'],[otherBranch,b2,'admin','contract'],[external,b,'support','client']]) {
   await rpc(owner,'save_work_assignment',[org,id,branch,job,rel])
  }
  const parent=(await rpc(owner,'create_company_entity',[org,'HQ','ERP Company','parent','IDR',null,'NPWP-ONE',true])).rows[0].result
  const entity=(await rpc(owner,'create_company_entity',[org,'SBY','Surabaya location','branch','IDR',parent,null,false])).rows[0].result
  await rpc(owner,'link_business_unit_entity',[org,b,entity])
  const period=(await rpc(owner,'create_accounting_period',[org,entity,'2026-11','2026-11-01','2026-11-30'])).rows[0].result
  const accounts={}
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner])
  for(const [name,type] of [['expense','expense'],['vat','asset'],['bank','asset'],['payable','liability'],['withholding','liability']]) {
   accounts[name]=(await db.query("insert into public.finance_accounts(organization_id,code,name,account_type,normal_balance,posting_category) values($1,$2,$2,$3,$4,$5) returning id",[org,name,type,type==='liability'?'credit':'debit',name==='bank'?'cash_bank':'general'])).rows[0].id
  }
  await t.test("branch users cannot access other branches, HQ sees allowed domains, external sees none",async()=>{
   await assert.rejects(rpc(owner,'save_work_assignment',[org,staff,null,'branch_manager','permanent']),/memerlukan lokasi cabang/)
   await assert.rejects(rpc(owner,'save_work_assignment',[org,staff,b,'finance_director','permanent']),/cakupan pusat/)
   const usd=(await rpc(owner,'create_company_entity',[org,'USD','Foreign currency location','branch','USD',parent,null,false])).rows[0].result
   await assert.rejects(rpc(owner,'link_business_unit_entity',[org,b2,usd]),/IDR/)
   await assert.rejects(db.query("update public.business_units set entity_id=$1 where id=$2",[entity,b2]),/unique constraint/)
   assert.equal((await as(staff,"select count(*)::int n from public.business_units")).rows[0].n,1)
   assert.equal((await as(director,"select count(*)::int n from public.business_units")).rows[0].n,4)
   assert.equal((await as(external,"select count(*)::int n from public.business_units")).rows[0].n,0)
   assert.equal((await rpc(staff,'can_access_business',[org,b2,'procurement'])).rows[0].result,false)
   assert.equal((await rpc(outsider,'can_access_business',[org,b,'procurement'])).rows[0].result,false)
   await assert.rejects(rpc(staff,'save_work_assignment',[org,staff,null,'president','permanent']),/Super Admin/)
   await assert.rejects(as(staff,"insert into public.procurement_vendors(organization_id,branch_id,name,address,bank_owner,bank_account,payment_method,created_by) values($1,$2,'x','x','x','x','x',$3)",[org,b,staff]),/permission denied/)
  })
  await t.test("first-run purchase setup is owner-only, repeatable and preserves existing COA",async()=>{
   await db.query("select set_config('request.jwt.claim.sub','',false)")
   const setupOrg=(await db.query("insert into public.organizations(name,slug) values('Setup Company','setup-company') returning id")).rows[0].id
   await db.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'owner')",[setupOrg,owner])
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner])
   await assert.rejects(rpc(staff,'initialize_purchasing_workspace',[setupOrg,'2026-11-01','2026-11-30']),/Super Admin/)
   await assert.rejects(rpc(owner,'initialize_purchasing_workspace',[setupOrg,'2026-11-04','2026-11-30']),/bulan/)
   await rpc(owner,'initialize_purchasing_workspace',[setupOrg,'2026-11-01','2026-11-30'])
   const stats=async()=> (await db.query("select (select count(*)::int from public.company_entities where organization_id=$1) entities,(select count(*)::int from public.accounting_periods where organization_id=$1) periods,(select count(*)::int from public.finance_accounts where organization_id=$1) accounts,(select count(*)::int from public.accounting_journals where organization_id=$1) journals",[setupOrg])).rows[0]
   assert.deepEqual(await stats(),{entities:4,periods:3,accounts:98,journals:0})
   await db.query("update public.finance_accounts set name='Kas sesuai COA klien' where organization_id=$1 and code='1101'",[setupOrg])
   await rpc(owner,'initialize_purchasing_workspace',[setupOrg,'2026-11-01','2026-11-30'])
   assert.deepEqual(await stats(),{entities:4,periods:3,accounts:98,journals:0})
   assert.equal((await db.query("select name from public.finance_accounts where organization_id=$1 and code='1101'",[setupOrg])).rows[0].name,'Kas sesuai COA klien')
  })
  let clientSerial=0
  const clientData=data=>({...data,npwp:String(++clientSerial).padStart(16,'1'),phone:'081234567890',email:'client@example.invalid',industry:'Industri'})
  const readySph=async id=>{
   const d=(await db.query('select * from public.sales_documents where id=$1',[id])).rows[0]
   await rpc(owner,'save_sph_request',[org,d.branch_id,{client_id:d.client_id,title:d.title,attachment_ids:d.attachment_ids,amount:'1000000',work_area:'Surabaya',work_scopes:['Pertek'],deal_status:'belum_deal',valid_until:'2099-12-31',confirmed:true},id,d.version,true])
   for(let stage=0;stage<4;stage++) {
    const row=(await db.query('select * from public.sales_documents where id=$1',[id])).rows[0]
    if(row.status==='ready') break
    await rpc(owner,'review_sph_request',[id,row.version,true,'Local isolated approval'])
   }
  }
  let vendor,purchase
  await t.test("vendor must pass central Finance validation before purchase submission",async()=>{
   const incomplete=(await rpc(staff,'save_procurement_vendor',[org,b,{name:'Incomplete vendor',address:'Alamat',bank_owner:'Vendor',bank_account:'000',payment_method:'transfer'}])).rows[0].result
   await assert.rejects(rpc(finance,'review_procurement_vendor',[incomplete,true,'approve missing identity']),/NPWP\/identitas perpajakan/)
   assert.equal((await as(finance,"select status from public.procurement_vendors where id=$1",[incomplete])).rows[0].status,'pending')
   await rpc(finance,'review_procurement_vendor',[incomplete,false,'Identitas pajak belum dilengkapi'])
   vendor=(await rpc(staff,'save_procurement_vendor',[org,b,{name:'Vendor PT',address:'Surabaya',npwp:'123',bank_owner:'Vendor PT',bank_account:'123456',payment_method:'transfer'}])).rows[0].result
   assert.equal((await as(otherBranch,"select count(*)::int n from public.procurement_vendors")).rows[0].n,0)
   const payload={invoice_number:'INV-001',invoice_date:'2026-11-04',tax_invoice_number:'010.001-26.00000001',tax_invoice_date:'2026-11-04',vendor_id:vendor,lines:[{description:'Jasa teknik',account_id:accounts.expense,amount:1000000}],vat_mode:'non_luxury',vat_creditable:true,withholding_code:'pph23_service',withholding_rate:2,withholding_base:1000000,withholding_timing:'payment'}
   purchase=(await rpc(staff,'save_purchase_request',[org,b,payload])).rows[0].result
   await assert.rejects(rpc(staff,'submit_purchase_request',[purchase,1]),/Vendor harus disetujui/)
   await assert.rejects(rpc(manager,'review_procurement_vendor',[vendor,true,'ok']),/Finance pusat/)
   await rpc(finance,'review_procurement_vendor',[vendor,true,'Rekening diverifikasi'])
   await rpc(staff,'submit_purchase_request',[purchase,1])
   const d=(await as(staff,"select * from public.purchase_requests where id=$1",[purchase])).rows[0]
   assert.equal(d.status,'branch_review');assert.equal(Number(d.total),1110000);assert.equal(Number(d.withholding_amount),20000);assert.equal(Number(d.payable_amount),1090000)
   await assert.rejects(rpc(staff,'save_purchase_request',[org,b,payload,purchase,2]),/terkunci/)
  })
  await t.test("only each assigned stage can approve and queue is scoped",async()=>{
   await assert.rejects(rpc(finance,'review_purchase_request',[purchase,2,true,'skip',null]),/tahap pemeriksaan/)
   assert.equal((await rpc(otherBranch,'purchase_review_queue',[org])).rows[0].result.length,0)
   assert.equal((await rpc(manager,'purchase_review_queue',[org])).rows[0].result[0].id,purchase)
   await rpc(manager,'review_purchase_request',[purchase,2,true,'Manager setuju',null])
   await assert.rejects(rpc(director,'review_purchase_request',[purchase,2,true,'stale',null]),/Versi/)
   await rpc(director,'review_purchase_request',[purchase,3,true,'Direktur setuju',null])
   assert.equal((await rpc(accountant,'purchase_review_queue',[org])).rows[0].result.length,1)
  })
  await t.test("Accounting posts balanced payable once; Finance settlement posts cash and PPh once",async()=>{
   const conf={entity_id:entity,period_id:period,payable_account_id:accounts.payable,vat_account_id:accounts.vat,withholding_account_id:accounts.withholding,coa_confirmed:true}
   await assert.rejects(rpc(accountant,'review_purchase_request',[purchase,4,true,'inflate',{...conf,lines:[{description:'Jasa teknik',account_id:accounts.expense,amount:9999999}]}]),/hanya boleh mengoreksi COA/)
   assert.equal((await as(accountant,"select journal_id from public.purchase_requests where id=$1",[purchase])).rows[0].journal_id,null)
   await rpc(accountant,'review_purchase_request',[purchase,4,true,'COA dan pajak diperiksa',conf])
   const d=(await as(staff,"select * from public.purchase_requests where id=$1",[purchase])).rows[0]
   assert.equal(d.status,'payment_ready');assert.ok(d.journal_id)
   const lines=(await as(accountant,"select * from public.accounting_journal_lines where journal_id=$1",[d.journal_id])).rows
   assert.equal(lines.length,3)
   assert.equal(lines.reduce((s,l)=>s+Number(l.debit)-Number(l.credit),0),0)
   assert.equal(Number(lines.find(l=>l.account_id===accounts.payable).credit),1110000)
   await assert.rejects(rpc(accountant,'review_purchase_request',[purchase,4,true,'duplicate',conf]),/tahap|Versi/)
   await assert.rejects(rpc(staff,'pay_purchase_request',[purchase,5,'2026-11-04','TRF-1',accounts.bank,period]),/Finance/)
   await rpc(finance,'pay_purchase_request',[purchase,5,'2026-11-04','TRF-1',accounts.bank,period])
   await assert.rejects(rpc(finance,'pay_purchase_request',[purchase,5,'2026-11-04','TRF-1',accounts.bank,period]),/siap dibayar/)
   const paid=(await as(staff,"select * from public.purchase_requests where id=$1",[purchase])).rows[0]
   const payment=(await as(finance,"select * from public.accounting_journal_lines where journal_id=$1",[paid.payment_journal_id])).rows
   assert.equal(payment.reduce((s,l)=>s+Number(l.debit)-Number(l.credit),0),0)
   assert.equal(Number(payment.find(l=>l.account_id===accounts.bank).credit),1090000)
   assert.equal(Number(payment.find(l=>l.account_id===accounts.withholding).credit),20000)
   assert.equal((await as(otherBranch,"select count(*)::int n from public.accounting_journals")).rows[0].n,0)
  })
  await t.test("old RPC and org-wide data stay blocked for branch users and unassigned members",async()=>{
   for(const actor of [staff,unassigned]) {
    assert.equal((await as(actor,"select count(*)::int n from public.crm_clients")).rows[0].n,0)
    await assert.rejects(rpc(actor,'save_workflow_draft',[org,'work_item',{title:'leak'}]),/Data lama/)
    await assert.rejects(rpc(actor,'create_accounting_period',[org,entity,'HACK','2027-01-01','2027-01-31']),/Superuser|Finance/)
   }
   await assert.rejects(rpc(finance,'create_accounting_journal',[org,entity,period,'FAKE','2026-11-04','manual','forbidden',[{account_id:accounts.expense,description:'x',debit:1,credit:0},{account_id:accounts.bank,description:'y',debit:0,credit:1}]]),/data lama/)
  })
  await t.test("manager submit skips branch stage; no self review except audited Super Admin",async()=>{
   const p=(await rpc(manager,'save_purchase_request',[org,b,{invoice_number:'INV-MGR',invoice_date:'2026-11-04',vendor_id:vendor,lines:[{description:'Jasa',account_id:accounts.expense,amount:100}]}])).rows[0].result
   await rpc(manager,'submit_purchase_request',[p,1]);assert.equal((await as(manager,"select status from public.purchase_requests where id=$1",[p])).rows[0].status,'director_review')
   await assert.rejects(rpc(manager,'review_purchase_request',[p,2,true,'self',null]),/tahap pemeriksaan/)
   const own=(await rpc(owner,'save_purchase_request',[org,b,{invoice_number:'INV-OWNER',invoice_date:'2026-11-04',vendor_id:vendor,lines:[{description:'Owner',account_id:accounts.expense,amount:100}]}])).rows[0].result
   await rpc(owner,'submit_purchase_request',[own,1]);await rpc(owner,'review_purchase_request',[own,2,true,'Super Admin review',null])
   assert.equal((await as(owner,"select details->>'superadmin_override' flag from public.procurement_events where entity_id=$1 and action='approved'",[own])).rows[0].flag,'true')
  })
  await t.test("shared client precedes SPH, internal approval precedes acceptance, SPK stays branch-scoped",async()=>{
   const client=(await rpc(staff,'save_sales_client',[org,b,clientData({name:'PT Klien',address:'Alamat'})])).rows[0].result
   const sph=(await rpc(staff,'save_sales_document',[org,b,{kind:'sph',title:'SPH 001',source:'company',client_id:client}])).rows[0].result
   await assert.rejects(rpc(staff,'save_sales_document',[org,b,{kind:'spk',title:'SPK',source:'client',client_id:client,accepted_sph_id:sph}]),/SPH klien/)
   assert.ok((await rpc(otherBranch,'save_sales_document',[org,b2,{kind:'sph',title:'Shared client offer',source:'company',client_id:client}])).rows[0].result)
   await assert.rejects(rpc(manager,'accept_sales_sph',[sph,'Premature','2026-11-05']),/persetujuan internal/)
   await readySph(sph)
   await rpc(manager,'accept_sales_sph',[sph,'SPH ditandatangani perusahaan dan klien','2026-11-04'])
   const spk=(await rpc(staff,'save_sales_document',[org,b,{kind:'spk',title:'SPK Klien',source:'client',client_id:client,accepted_sph_id:sph}])).rows[0].result
   assert.ok(spk);assert.equal((await as(external,"select count(*)::int n from public.sales_documents")).rows[0].n,0)
  })
  await t.test("SPH numbering is company-wide, immutable and rolls back without consuming numbers",async()=>{
   const c=(await rpc(manager,'save_sales_client',[org,b,clientData({name:'Numbered client',address:'Address'})])).rows[0].result
   const c2=(await rpc(otherBranch,'save_sales_client',[org,b2,clientData({name:'Other branch client',address:'Address'})])).rows[0].result
   const last=Number((await db.query("select max(sph_number) n from public.sales_documents where organization_id=$1",[org])).rows[0].n)
   await assert.rejects(db.transaction(async tx=>{
    await tx.exec("set local role authenticated");await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[manager])
    await tx.query("select public.save_sales_document($1,$2,$3)",[org,b,{kind:'sph',title:'Rolled back',client_id:c}])
    throw new Error('rollback-number')
   }),/rollback-number/)
   for(let n=1;n<=11;n++) {
    const secondBranch=n%2===0
    const id=(await rpc(secondBranch?otherBranch:manager,'save_sales_document',[org,secondBranch?b2:b,{kind:'sph',title:`SPH ${n}`,client_id:secondBranch?c2:c,sph_number:9000}])).rows[0].result
    assert.equal(Number((await db.query("select sph_number from public.sales_documents where id=$1",[id])).rows[0].sph_number),last+n)
    await assert.rejects(db.query("update public.sales_documents set sph_number=9000 where id=$1",[id]),/tidak boleh diubah/)
    await assert.rejects(db.query("delete from public.sales_documents where id=$1",[id]),/tidak boleh dihapus/)
   }
   await assert.rejects(rpc(manager,'save_sales_document',[org,b,{kind:'sph',title:'Wrong source',client_id:c,source:'client'}]),/diterbitkan oleh perusahaan/)
   assert.equal(Number((await db.query("select last_number from gsp_private.sph_counters where organization_id=$1",[org])).rows[0].last_number),last+11)
   await assert.rejects(as(manager,"select * from gsp_private.sph_counters"),/permission denied/)
  })
  await t.test("PPh21 nonemployee applies Pasal17 on half gross; no duplicate withholding",async()=>{
   const p=(await rpc(staff,'save_purchase_request',[org,b,{invoice_number:'PPH21',invoice_date:'2026-11-04',vendor_id:vendor,lines:[{description:'Honor ahli',account_id:accounts.expense,amount:200000000}],withholding_code:'pph21_nonemployee',withholding_base:200000000}])).rows[0].result
   const d=(await as(staff,"select * from public.purchase_requests where id=$1",[p])).rows[0]
   assert.equal(Number(d.withholding_amount),9000000)
   assert.equal(Number(d.vat_amount),0)
  })
  await t.test("invoice-time withholding is posted once and is absent from payment credit",async()=>{
   const p=(await rpc(owner,'save_purchase_request',[org,b,{invoice_number:'INVOICE-TAX',invoice_date:'2026-11-04',vendor_id:vendor,lines:[{description:'Jasa',account_id:accounts.expense,amount:1000000}],withholding_code:'pph23_service',withholding_rate:2,withholding_base:1000000,withholding_timing:'invoice'}])).rows[0].result
   await rpc(owner,'submit_purchase_request',[p,1]);await rpc(owner,'review_purchase_request',[p,2,true,'Direktur',null])
   await rpc(accountant,'review_purchase_request',[p,3,true,'Pajak invoice',{entity_id:entity,period_id:period,payable_account_id:accounts.payable,withholding_account_id:accounts.withholding,coa_confirmed:true}])
   const d=(await as(owner,"select * from public.purchase_requests where id=$1",[p])).rows[0]
   const accrual=(await as(accountant,"select * from public.accounting_journal_lines where journal_id=$1",[d.journal_id])).rows
   assert.equal(Number(accrual.find(l=>l.account_id===accounts.payable).credit),980000)
   assert.equal(Number(accrual.find(l=>l.account_id===accounts.withholding).credit),20000)
   await rpc(owner,'save_work_assignment',[org,accountant,null,'finance','permanent'])
   await rpc(accountant,'pay_purchase_request',[p,4,'2026-11-04','TAX-INVOICE',accounts.bank,period])
   const paymentId=(await as(owner,"select payment_journal_id from public.purchase_requests where id=$1",[p])).rows[0].payment_journal_id
   const settlement=(await as(finance,"select * from public.accounting_journal_lines where journal_id=$1",[paymentId])).rows
   assert.equal(settlement.length,2)
   assert.equal(Number(settlement.find(l=>l.account_id===accounts.payable).debit),980000)
   await assert.rejects(rpc(owner,'reverse_accounting_journal',[d.journal_id,'REV-PROC','2026-11-04','Manual bypass']),/alur koreksi pembelian/)
  })
  await t.test("Finance may execute its own independently approved request without self-approving",async()=>{
   const p=(await rpc(staff,'save_purchase_request',[org,b,{invoice_number:'SELF-PAY',invoice_date:'2026-11-04',vendor_id:vendor,lines:[{description:'Jasa',account_id:accounts.expense,amount:500000}]}])).rows[0].result
   await rpc(staff,'submit_purchase_request',[p,1])
   await assert.rejects(rpc(staff,'review_purchase_request',[p,2,true,'self',null]),/tahap pemeriksaan/)
   await rpc(manager,'review_purchase_request',[p,2,true,'Manager independen',null])
   await rpc(director,'review_purchase_request',[p,3,true,'Direktur independen',null])
   await rpc(accountant,'review_purchase_request',[p,4,true,'Accounting independen',{entity_id:entity,period_id:period,payable_account_id:accounts.payable,coa_confirmed:true}])
   await rpc(owner,'save_work_assignment',[org,staff,null,'finance','permanent'])
   assert.equal((await rpc(staff,'purchase_review_queue',[org])).rows[0].result.some(row=>row.id===p),true)
   await rpc(staff,'pay_purchase_request',[p,5,'2026-11-04','SELF-PAY-VERIFIED',accounts.bank,period])
   assert.equal((await as(owner,"select details->>'executor_is_requester' flag from public.procurement_events where entity_id=$1 and action='paid'",[p])).rows[0].flag,'true')
  })
  await t.test("creditable PPN requires tax invoice identity; payments cannot precede invoice",async()=>{
   const p=(await rpc(owner,'save_purchase_request',[org,b,{invoice_number:'VAT-MISSING',invoice_date:'2026-11-04',vendor_id:vendor,lines:[{description:'Barang',account_id:accounts.expense,amount:100000}],vat_mode:'non_luxury',vat_creditable:true}])).rows[0].result
   await rpc(owner,'submit_purchase_request',[p,1]);await rpc(owner,'review_purchase_request',[p,2,true,'Direktur',null])
   const config={entity_id:entity,period_id:period,payable_account_id:accounts.payable,vat_account_id:accounts.vat,coa_confirmed:true}
   await assert.rejects(rpc(accountant,'review_purchase_request',[p,3,true,'PPN kredit',config]),/Nomor dan tanggal faktur pajak/)
   const failed=(await as(owner,"select status,journal_id from public.purchase_requests where id=$1",[p])).rows[0]
   assert.equal(failed.status,'accounting_review');assert.equal(failed.journal_id,null)
   await rpc(accountant,'review_purchase_request',[p,3,true,'PPN tidak dikreditkan, dibebankan',{...config,vat_creditable:false}])
   await assert.rejects(rpc(finance,'pay_purchase_request',[p,4,'2026-11-03','EARLY',accounts.bank,period]),/mendahului invoice/)
   assert.equal((await as(owner,"select status from public.purchase_requests where id=$1",[p])).rows[0].status,'payment_ready')
   await rpc(finance,'pay_purchase_request',[p,4,'2026-11-04','VALID',accounts.bank,period])
  })
  await t.test("external portal grants expose only published entries in the assigned active project",async()=>{
   const project=(await db.query("insert into public.crm_projects(organization_id,code,name,status) values($1,'EXT-1','Private client project','active') returning id",[org])).rows[0].id
   const otherProject=(await db.query("insert into public.crm_projects(organization_id,code,name,status) values($1,'EXT-2','Other client project','active') returning id",[org])).rows[0].id
   await assert.rejects(rpc(staff,'configure_project_scope',[org,otherProject,b]),/Super Admin/)
   await rpc(owner,'configure_project_scope',[org,otherProject,b2])
   assert.equal((await rpc(owner,'list_portal_projects',[org])).rows[0].result.some(p=>p.project_id===otherProject),true)
   await assert.rejects(rpc(owner,'configure_project_scope',[org,otherProject,b]),/sudah ditetapkan/)
   await rpc(owner,'set_project_portal_access',[org,project,b,external,'client',true,true])
   const listed=(await rpc(external,'list_portal_projects',[org])).rows[0].result
   assert.equal(listed.length,1);assert.equal(listed[0].project_id,project);assert.equal(listed[0].can_publish,false);assert.equal(listed[0].can_submit,true)
   await rpc(owner,'save_project_portal_entry',[org,project,'status','external','Progress','Published progress'])
   await rpc(owner,'save_project_portal_entry',[org,project,'mom','internal','Internal','Internal discussion'])
   assert.equal((await as(external,"select count(*)::int n from public.project_portal_entries")).rows[0].n,1)
   assert.equal((await rpc(external,'can_access_project',[org,otherProject])).rows[0].result,false)
   await assert.rejects(rpc(external,'save_project_portal_entry',[org,project,'invoice_summary','external','Fake','Fake invoice']),/ditolak/)
   await rpc(external,'save_project_portal_entry',[org,project,'request','external','Data request','Please provide status'])
   assert.equal((await as(external,"select count(*)::int n from public.project_portal_entries")).rows[0].n,2)
   await db.query("update public.crm_projects set status='completed' where id=$1",[project])
   assert.equal((await as(external,"select count(*)::int n from public.project_portal_entries")).rows[0].n,0)
   assert.equal((await rpc(external,'list_portal_projects',[org])).rows[0].result.length,0)
  })
  await t.test("private attachments stay scoped despite legacy open storage policies",async()=>{
   const invoiceId='30000000-0000-4000-8000-000000000001'
   const salesId='30000000-0000-4000-8000-000000000002'
   const invoicePath=`${org}/${b}/${manager}/${invoiceId}.pdf`
   const salesPath=`${org}/${b}/${manager}/${salesId}.pdf`
   const upload=(actor,name)=>as(actor,"insert into storage.objects(bucket_id,name) values('procurement-documents',$1)",[name])
   await upload(manager,invoicePath)
   assert.equal((await as(manager,"select count(*)::int n from storage.objects")).rows[0].n,0)
   const metadata=(id,name,domain)=>as(manager,"insert into public.procurement_attachments(id,organization_id,branch_id,uploaded_by,domain,storage_path,file_name,content_type,byte_size) values($1,$2,$3,$4,$5,$6,'invoice.pdf','application/pdf',100)",[id,org,b,manager,domain,name])
   await metadata(invoiceId,invoicePath,'procurement')
   assert.equal((await as(manager,"select count(*)::int n from storage.objects")).rows[0].n,1)
   assert.equal((await as(finance,"select count(*)::int n from storage.objects")).rows[0].n,1)
   for(const actor of [otherBranch,external,outsider]) {
    assert.equal((await as(actor,"select count(*)::int n from storage.objects")).rows[0].n,0)
    assert.equal((await as(actor,"select count(*)::int n from public.procurement_attachments")).rows[0].n,0)
    await assert.rejects(upload(actor,`${org}/${b}/${actor}/30000000-0000-4000-8000-000000000003.pdf`),/row-level security/)
   }
   await upload(manager,salesPath);await metadata(salesId,salesPath,'sales')
   assert.equal((await as(manager,"select count(*)::int n from storage.objects")).rows[0].n,2)
   assert.equal((await as(finance,"select count(*)::int n from storage.objects")).rows[0].n,1)
   await assert.rejects(rpc(owner,'save_purchase_request',[org,b,{invoice_number:'WRONG-ATTACHMENT',invoice_date:'2026-11-04',vendor_id:vendor,lines:[{description:'Jasa',account_id:accounts.expense,amount:100}],attachment_ids:[salesId]}]),/Lampiran/)
   const client=(await rpc(manager,'save_sales_client',[org,b,clientData({name:'Attachment client',address:'Address'})])).rows[0].result
   await assert.rejects(rpc(manager,'save_sales_document',[org,b,{kind:'sph',title:'Wrong attachment',client_id:client,attachment_ids:[invoiceId]}]),/Lampiran/)
   const draft=(await rpc(manager,'save_sales_document',[org,b,{kind:'sph',title:'Manual offer',client_id:client}])).rows[0].result
   await assert.rejects(rpc(manager,'attach_sales_document',[draft,[invoiceId]]),/Lampiran/)
   await assert.rejects(rpc(otherBranch,'attach_sales_document',[draft,[salesId]]),/Akses/)
   await assert.rejects(rpc(staff,'attach_sales_document',[draft,[salesId]]),/Akses/)
   await rpc(manager,'attach_sales_document',[draft,[salesId]])
   assert.deepEqual((await as(manager,"select attachment_ids from public.sales_documents where id=$1",[draft])).rows[0].attachment_ids,[salesId])
   await assert.rejects(rpc(manager,'attach_sales_document',[draft,[]]),/tidak boleh dihapus/)
   await assert.rejects(rpc(manager,'attach_sales_document',[draft,[salesId,salesId]]),/duplikat/)
   await readySph(draft)
   await rpc(manager,'accept_sales_sph',[draft,'Both signatures on uploaded offer','2026-11-05'])
   await assert.rejects(rpc(manager,'attach_sales_document',[draft,[salesId]]),/tidak dapat diubah/)
   assert.equal((await as(manager,"update storage.objects set name='changed' where name=$1 returning id",[invoicePath])).rows.length,0)
   assert.equal((await as(manager,"delete from storage.objects where name=$1 returning id",[invoicePath])).rows.length,0)
   assert.equal((await as(manager,"update storage.buckets set public=true where id='procurement-documents' returning id")).rows.length,0)
   await db.exec("insert into storage.buckets(id,name) values('unrelated','unrelated');insert into storage.objects(bucket_id,name) values('unrelated','legacy-object')")
   await db.transaction(async tx=>{
    await tx.exec("set local role anon");await tx.query("select set_config('request.jwt.claim.sub','',true)")
    const visible=(await tx.query("select name from storage.objects")).rows
    assert.deepEqual(visible.map(row=>row.name),['legacy-object'])
    await assert.rejects(tx.query("insert into storage.objects(bucket_id,name) values('procurement-documents',$1)",[invoicePath]),/row-level security/)
   })
  })
  await t.test("grant revocation removes branch access immediately without waiting for JWT refresh",async()=>{
   const w=(await as(owner,"select id from public.work_assignments where user_id=$1",[otherBranch])).rows[0].id
   await rpc(owner,'remove_work_assignment',[org,w])
   assert.equal((await rpc(otherBranch,'can_access_business',[org,b2,'procurement'])).rows[0].result,false)
  })
 } finally { await db.close() }
})
