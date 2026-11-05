import test from "node:test"
import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"

test("Hierarchical COA permissions, structure and posting integrity", async t => {
 const db=new PGlite({extensions:{pgcrypto}})
 try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`)
  const migrations=(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort()
  const coaIndex=migrations.indexOf('20261104092327_hierarchical_coa_and_posting_guards.sql')
  assert.ok(coaIndex>=0,'COA migration must be present')
  for(const name of migrations.slice(0,coaIndex)) await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8'))
  const users=['40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000004']
  const [owner,finance,accountant,staff]=users
  for(const id of users) await db.query('insert into auth.users(id) values($1)',[id])
  const org=(await db.query("insert into public.organizations(name,slug) values('COA Test','coa-test') returning id")).rows[0].id
  for(const id of users) await db.query('insert into public.organization_members(organization_id,user_id,role) values($1,$2,$3)',[org,id,id===owner?'owner':'staff'])
  // Exercise the production path: an existing organization receives only
  // reference COA, with the migration explicitly audited as its source.
  for(const name of migrations.slice(coaIndex)) await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8'))
  assert.equal((await db.query('select count(*)::int n from public.finance_accounts where organization_id=$1',[org])).rows[0].n,98)
  assert.equal((await db.query("select count(*)::int n from public.audit_events where organization_id=$1 and action='coa.migration_seeded'",[org])).rows[0].n,1)
  const as=(id,sql,args=[])=>db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);return tx.query(sql,args)})
  const rpc=(id,name,args)=>as(id,`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)
  for(const [id,job] of [[finance,'finance'],[accountant,'accounting_tax']]) await rpc(owner,'save_work_assignment',[org,id,null,job,'permanent'])
  const branch=(await db.query("select id from public.business_units where organization_id=$1 and code='SBY'",[org])).rows[0].id
  await rpc(owner,'save_work_assignment',[org,staff,branch,'admin','permanent'])
  await rpc(finance,'install_recommended_coa',[org])
  const rows=(await as(finance,'select * from public.finance_accounts where organization_id=$1',[org])).rows
  const byCode=code=>rows.find(r=>r.code===code)
  await t.test('seven roots, 98 nodes, proper categories and idempotent install',async()=>{
   assert.equal(rows.length,98);assert.equal(rows.filter(r=>!r.parent_account_id).length,7)
   assert.equal(byCode('1101').parent_account_id,byCode('1100').id)
   assert.equal(byCode('1102').posting_category,'cash_bank');assert.equal(byCode('7111').report_section,'oci')
   await rpc(accountant,'install_recommended_coa',[org])
   assert.equal((await as(finance,'select count(*)::int n from public.finance_accounts where organization_id=$1',[org])).rows[0].n,98)
  })
  let customId
  const payload={code:'5119',name:'Beban tambahan',account_type:'expense',normal_balance:'debit',parent_account_id:byCode('5100').id,is_postable:true,is_active:true,report_section:'expense',posting_category:'expense'}
  await t.test('Accounting and Finance add groups and accounts; staff and direct writes denied',async()=>{
   await assert.rejects(rpc(staff,'save_finance_account',[org,payload]),/Accounting|Finance/)
   customId=(await rpc(finance,'save_finance_account',[org,payload])).rows[0].result
   await rpc(accountant,'save_finance_account',[org,{...payload,name:'Beban tambahan diperiksa'},customId,1])
   await assert.rejects(rpc(finance,'save_finance_account',[org,payload,customId,1]),/versi/)
   await assert.rejects(as(finance,"insert into public.finance_accounts(organization_id,code,name,account_type,normal_balance) values($1,'BYPASS','Bypass','expense','debit')",[org]),/permission denied/)
   const group=(await rpc(accountant,'save_finance_account',[org,{...payload,code:'56',name:'Kelompok biaya tambahan',parent_account_id:byCode('5').id,is_postable:false,posting_category:'general'}])).rows[0].result
   assert.ok(group)
  })
  await t.test('cycles, posting parents, foreign parents and mixed types rejected',async()=>{
   await assert.rejects(rpc(finance,'save_finance_account',[org,{...payload,code:'BAD',parent_account_id:byCode('1101').id}]),/Induk/)
   await assert.rejects(rpc(finance,'save_finance_account',[org,{...payload,code:'BAD',parent_account_id:byCode('1100').id}]),/Induk/)
   await assert.rejects(rpc(finance,'save_finance_account',[org,{code:'1',name:'Aset',account_type:'asset',normal_balance:'debit',parent_account_id:byCode('1100').id,is_postable:false,is_active:true,report_section:'asset',posting_category:'general'},byCode('1').id,byCode('1').row_version]),/melingkar/)
  })
  await t.test('purchase rejects group account and journal accepts posting leaf only',async()=>{
   const vendor=(await rpc(staff,'save_procurement_vendor',[org,branch,{name:'Vendor',address:'Alamat',npwp:'TEST',bank_owner:'Vendor',bank_account:'123',payment_method:'bank_transfer'}])).rows[0].result
   await assert.rejects(rpc(staff,'save_purchase_request',[org,branch,{invoice_number:'GROUP',invoice_date:'2026-11-04',vendor_id:vendor,lines:[{description:'Beban',account_id:byCode('5100').id,amount:100}]}]),/COA/)
   await rpc(owner,'initialize_purchasing_workspace',[org,'2026-11-01','2026-11-30'])
   const entity=(await db.query('select entity_id from public.business_units where id=$1',[branch])).rows[0].entity_id
   const period=(await db.query('select id from public.accounting_periods where entity_id=$1',[entity])).rows[0].id
   const journal=(await rpc(owner,'create_accounting_journal',[org,entity,period,'COA-POST','2026-11-04','manual','COA test',[{account_id:customId,description:'Expense',debit:100,credit:0},{account_id:byCode('1102').id,description:'Bank',debit:0,credit:100}]])).rows[0].result
   assert.ok(journal)
   const current=(await as(finance,'select row_version from public.finance_accounts where id=$1',[customId])).rows[0]
   await assert.rejects(rpc(finance,'save_finance_account',[org,{...payload,account_type:'asset',report_section:'asset',posting_category:'general',parent_account_id:byCode('1190').id},customId,current.row_version]),/terkunci/)
  })
 } finally {await db.close()}
})
