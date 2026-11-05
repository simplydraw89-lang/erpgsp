import test from "node:test"
import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"

test("Shared company clients and staged SPH authorization", async t => {
 const db=new PGlite({extensions:{pgcrypto}})
 try {
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`)
  for(const name of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8'))
  const ids=Array.from({length:13},(_,index)=>`50000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`)
  const [owner,adminA,adminB,managerA,managerB,director,accounting,finance,support,hr,marketing,external,outsider]=ids
  for(const id of ids) await db.query('insert into auth.users(id) values($1)',[id])
  const org=(await db.query("insert into public.organizations(name,slug) values('Sales Test','sales-test') returning id")).rows[0].id
  const otherOrg=(await db.query("insert into public.organizations(name,slug) values('Other Sales','other-sales') returning id")).rows[0].id
  for(const id of ids.slice(0,-1)) await db.query('insert into public.organization_members(organization_id,user_id,role) values($1,$2,$3)',[org,id,id===owner?'owner':'staff'])
  await db.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'owner')",[otherOrg,owner])
  const branches=(await db.query("select id,code from public.business_units where organization_id=$1 and kind='branch' order by code",[org])).rows
  const a=branches.find(branch=>branch.code==='SBY').id,b=branches.find(branch=>branch.code==='JKT').id
  const as=(id,sql,args=[])=>db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);return tx.query(sql,args)})
  const rpc=async(id,name,args)=>(await as(id,`select public.${name}(${args.map((_,index)=>'$'+(index+1)).join(',')}) result`,args)).rows[0].result
  for(const [id,branch,role,relationship] of [[adminA,a,'admin','permanent'],[adminB,b,'admin','contract'],[managerA,a,'branch_manager','permanent'],[managerB,b,'branch_manager','permanent'],[director,null,'finance_director','permanent'],[accounting,null,'accounting_tax','permanent'],[finance,null,'finance','permanent'],[support,a,'support','permanent'],[hr,null,'hr','permanent'],[marketing,b,'marketing','permanent'],[external,a,'support','client']]) await rpc(owner,'save_work_assignment',[org,id,branch,role,relationship])
  let serial=0
  const clientData=(extra={})=>({name:`PT Test ${++serial}`,address:'Alamat lengkap',npwp:String(serial).padStart(16,'1'),phone:'+62 812 3456 7890',email:'marketing@example.invalid',industry:'Mining',...extra})
  let client
  await t.test('shared clients have no branch binding and only approved marketing roles can read',async()=>{
   client=await rpc(adminA,'save_sales_client',[org,a,clientData()])
   for(const id of [owner,adminA,adminB,managerA,managerB,director,marketing]) {
    assert.equal(await rpc(id,'can_read_sales_clients',[org]),true)
    assert.equal((await as(id,'select id,branch_id from public.sales_clients where id=$1',[client])).rows[0].branch_id,null)
   }
   for(const id of [accounting,finance,support,hr,external,outsider]) assert.equal((await as(id,'select id from public.sales_clients where organization_id=$1',[org])).rows.length,0)
  })
  await t.test('other internal roles can register valid clients without approval or list access',async()=>{
   for(const id of [support,hr,accounting,finance]) {
    assert.ok(await rpc(id,'save_sales_client',[org,null,clientData()]))
    assert.equal(await rpc(id,'can_register_sales_client',[org]),true)
    assert.equal(await rpc(id,'can_read_sales_clients',[org]),false)
   }
   for(const id of [external,outsider]) await assert.rejects(rpc(id,'save_sales_client',[org,null,clientData()]),/pengguna internal/)
  })
  await t.test('validation rejects bad identity/contact/industry and duplicate NPWP through legacy RPC',async()=>{
   const valid=clientData()
   for(const extra of [{name:''},{address:''},{npwp:'123'},{phone:'abc'},{email:'invalid'},{industry:'unsupported'}]) await assert.rejects(rpc(adminA,'save_sales_client',[org,null,{...valid,...extra}]))
   await rpc(adminA,'save_sales_client',[org,null,valid])
   await assert.rejects(rpc(adminB,'save_sales_client',[org,b,{...valid,npwp:valid.npwp.slice(0,8)+'.'+valid.npwp.slice(8)}]),/sudah terdaftar/)
  })
  const getDoc=async id=>(await db.query('select * from public.sales_documents where id=$1',[id])).rows[0]
  const payload=extra=>({client_id:client,title:'Penawaran pekerjaan',amount:'1250000.50',work_area:'Kalimantan',work_scopes:['Pertek','UKL/UPL'],deal_status:'belum_deal',valid_until:'2099-12-31',notes:'Dokumen dibuat manual',attachment_ids:[],confirmed:true,...extra})
  let offer
  await t.test('draft allows incomplete details, reads client industry and preserves number on edits',async()=>{
   offer=await rpc(adminA,'save_sph_request',[org,a,{client_id:client,title:'Draft awal'}])
   const draft=await getDoc(offer)
   assert.equal(draft.status,'draft');assert.equal(draft.client_snapshot.industry,'Mining')
   assert.equal((await as(finance,'select id from public.sales_documents where id=$1',[offer])).rows.length,0)
   await rpc(adminA,'save_sph_request',[org,a,payload({industry:'forged',confirmed:false}),offer,draft.version,false])
   const edited=await getDoc(offer)
   assert.equal(edited.sph_number,draft.sph_number);assert.equal(edited.client_snapshot.industry,'Mining')
   await assert.rejects(rpc(adminA,'save_sph_request',[org,a,payload(),offer,null,true]),/Versi/)
   await assert.rejects(rpc(adminA,'save_sph_request',[org,a,payload(),offer,draft.version,true]),/Versi/)
  })
  await t.test('submit requires complete confirmed data and enforces branch and company boundaries',async()=>{
   const d=await getDoc(offer)
   for(const extra of [{confirmed:false},{work_area:''},{work_scopes:[]},{work_scopes:['invalid']},{work_scopes:['Pertek','Pertek']},{valid_until:'2000-01-01'},{deal_status:'invalid'}]) await assert.rejects(rpc(adminA,'save_sph_request',[org,a,payload(extra),offer,d.version,true]))
   await assert.rejects(rpc(adminB,'save_sph_request',[org,a,payload()]),/Akses/)
   await assert.rejects(rpc(support,'save_sph_request',[org,a,payload()]),/Akses/)
   const foreignClient=await rpc(owner,'save_sales_client',[otherOrg,null,clientData()])
   await assert.rejects(rpc(adminA,'save_sph_request',[org,a,payload({client_id:foreignClient})]),/Klien/)
   assert.ok(await rpc(adminB,'save_sph_request',[org,b,payload()]))
   await rpc(adminA,'save_sph_request',[org,a,payload(),offer,d.version,true])
   assert.equal((await getDoc(offer)).status,'branch_review')
  })
  const approve=async(actor,id,yes=true)=>{const doc=await getDoc(id);await rpc(actor,'review_sph_request',[id,doc.version,yes,'Catatan pemeriksaan / arahan']);return getDoc(id)}
  await t.test('queue and approvals finish at Finance Director without Accounting or Finance stages',async()=>{
   assert.equal((await rpc(managerA,'sph_review_queue',[org])).some(row=>row.id===offer),true)
   for(const id of [adminA,managerB,director,accounting,finance,external]) assert.equal(await rpc(id,'sph_review_allowed',[offer]),false)
   await assert.rejects(approve(director,offer),/Bukan tahap/)
   await assert.rejects(rpc(managerA,'review_sph_request',[offer,null,true,'Null version']),/Versi/)
   assert.equal((await approve(managerA,offer)).status,'director_review')
   assert.equal((await approve(director,offer)).status,'ready')
   await assert.rejects(approve(finance,offer),/Bukan tahap/)
   assert.equal((await db.query('select count(*)::int n from public.accounting_journals')).rows[0].n,0)
  })
  await t.test('Finance/Accounting cannot open full SPHs or shared client directory',async()=>{
   for(const id of [accounting,finance]) {
    assert.equal((await as(id,'select id,client_snapshot from public.sales_documents where id=$1',[offer])).rows.length,0)
    assert.equal((await as(id,'select id from public.sales_clients')).rows.length,0)
   }
   assert.equal((await as(support,'select id from public.sales_documents')).rows.length,0)
  })
  await t.test('manager submissions skip own review and rejected drafts can be revised with version checks',async()=>{
   const id=await rpc(managerA,'save_sph_request',[org,a,payload(),null,null,true])
   assert.equal((await getDoc(id)).status,'director_review')
   await assert.rejects(approve(managerA,id),/Bukan tahap/)
   const rejected=await approve(director,id,false)
   assert.equal(rejected.status,'revision_requested')
   await rpc(managerA,'save_sph_request',[org,a,payload({title:'Revisi',confirmed:false}),id,rejected.version,false])
   const revised=await getDoc(id)
   assert.equal(revised.status,'draft')
   await rpc(managerA,'save_sph_request',[org,a,payload({title:'Revisi'}),id,revised.version,true])
   assert.equal((await getDoc(id)).status,'director_review')
  })
  await t.test('legacy acceptance cannot bypass internal approval, and deal status is not client agreement',async()=>{
   const id=await rpc(adminA,'save_sales_document',[org,a,payload({kind:'sph',deal_status:'sudah_deal'})])
   assert.equal((await getDoc(id)).status,'draft')
   await assert.rejects(rpc(managerA,'accept_sales_sph',[id,'Premature agreement','2026-11-05']),/persetujuan internal/)
   await assert.rejects(rpc(adminA,'save_sales_document',[org,a,{kind:'spk',client_id:client,title:'Too soon',source:'company',accepted_sph_id:id}]),/SPH klien/)
   await rpc(managerA,'accept_sales_sph',[offer,'Bukti perusahaan dan klien','2026-11-05'])
   assert.ok(await rpc(adminA,'save_sales_document',[org,a,{kind:'spk',client_id:client,title:'SPK perusahaan',source:'company',accepted_sph_id:offer}]))
   await assert.rejects(rpc(adminB,'save_sales_document',[org,b,{kind:'spk',client_id:client,title:'SPK salah cabang',source:'client',accepted_sph_id:offer}]),/SPH klien/)
  })
  await t.test('private sales attachment metadata and storage helper enforce role and document access',async()=>{
   const attachment='60000000-0000-4000-8000-000000000001',storagePath=`${org}/${a}/${adminA}/${attachment}.pdf`
   await as(adminA,"insert into public.procurement_attachments(id,organization_id,branch_id,uploaded_by,domain,storage_path,file_name,content_type,byte_size) values($1,$2,$3,$4,'sales',$5,'offer.pdf','application/pdf',100)",[attachment,org,a,adminA,storagePath])
   assert.equal((await as(support,'select id from public.procurement_attachments')).rows.length,0)
   assert.equal((await as(finance,'select id from public.procurement_attachments')).rows.length,0)
   const id=await rpc(adminA,'save_sph_request',[org,a,payload({attachment_ids:[attachment]})])
   assert.ok(id)
   assert.equal(await rpc(finance,'can_read_sales_attachment',[attachment]),false)
   const draft=await getDoc(id)
   await rpc(adminA,'save_sph_request',[org,a,payload({attachment_ids:[attachment]}),id,draft.version,true])
   assert.equal((await as(finance,'select id from public.procurement_attachments')).rows.length,0)
   assert.equal(await rpc(finance,'can_read_sales_attachment',[attachment]),false)
   for(const actor of [support,adminB,external]) assert.equal(await rpc(actor,'can_read_sales_attachment',[attachment]),false)
   assert.equal(await rpc(support,'can_upload_sales_document',[org,a]),false)
   await assert.rejects(rpc(adminB,'save_sph_request',[org,b,payload({attachment_ids:[attachment]})]),/Lampiran/)
  })
  await t.test('revoking marketing assignment removes shared directory visibility',async()=>{
   const assignment=(await as(owner,"select id from public.work_assignments where user_id=$1 and job_role='marketing'",[marketing])).rows[0].id
   await rpc(owner,'remove_work_assignment',[org,assignment])
   assert.equal(await rpc(marketing,'can_read_sales_clients',[org]),false)
   assert.equal((await as(marketing,'select id from public.sales_clients')).rows.length,0)
  })
  await t.test('branch peers receive bounded summaries without document, notes, history or attachment access',async()=>{
   const id=await rpc(adminA,'save_sph_request',[org,a,payload({notes:'PRIVATE-NOTE'})])
   const register=await rpc(managerA,'sph_register',[org,a,0])
   const row=register.rows.find(item=>item.id===id)
   assert.ok(row);assert.equal(row.can_open,false);assert.equal(row.can_create_spk,false)
   assert.equal(Number(row.amount),1250000.50)
   for(const key of ['notes','attachment_ids','client_snapshot','created_by','row_data']) assert.equal(Object.hasOwn(row,key),false)
   assert.equal((await as(managerA,'select id from public.sales_documents where id=$1',[id])).rows.length,0)
   assert.equal((await as(managerA,'select id from public.procurement_events where entity_id=$1',[id])).rows.length,0)
   assert.equal((await rpc(adminB,'sph_register',[org,b,0])).rows.some(item=>item.id===id),false)
   assert.equal((await rpc(adminB,'sph_register',[org,a,0])).total,0)
   for(const actor of [external,outsider]) await assert.rejects(rpc(actor,'sph_register',[org,a,0]),/Akses/)
   await assert.rejects(rpc(adminA,'sph_register',[org,a,-1]),/Halaman/)
   assert.equal((await rpc(owner,'sph_register',[otherOrg,null,0])).total,0)
  })
  await t.test('notifications route to current reviewers then author, and SPK opens after director approval',async()=>{
   const id=await rpc(adminA,'save_sph_request',[org,a,payload(),null,null,true])
   const notes=async actor=>(await rpc(actor,'sales_notifications',[org])).items.filter(item=>item.id===id)
   assert.equal((await notes(managerA))[0].label,'Butuh persetujuan saya')
   for(const actor of [adminA,managerB,director,finance,external,outsider]) assert.equal((await notes(actor)).length,0)
   await assert.rejects(rpc(adminA,'sph_spk_context',[org,id]),/SPK hanya/)
   assert.equal((await as(managerA,'select id from public.sales_documents where id=$1',[id])).rows.length,1)
   await approve(managerA,id)
   assert.equal((await notes(managerA)).length,0);assert.equal((await notes(director))[0].category,'approval')
   assert.equal((await as(managerA,'select id from public.sales_documents where id=$1',[id])).rows.length,0)
   await approve(director,id)
   assert.equal((await notes(director)).length,0)
   assert.equal((await notes(adminA))[0].label,'SPH perlu tindak lanjut')
   assert.equal((await getDoc(id)).status,'ready')
   assert.equal((await rpc(adminA,'sph_spk_context',[org,id])).id,id)
   assert.equal((await rpc(adminA,'sph_register',[org,a,0])).rows.find(item=>item.id===id).can_create_spk,true)
   await assert.rejects(rpc(managerA,'sph_spk_context',[org,id]),/SPK hanya/)
   assert.ok(await rpc(adminA,'save_sales_document',[org,a,{kind:'spk',client_id:client,title:'SPK after director',source:'company',accepted_sph_id:id}]))
   assert.equal((await notes(adminA)).length,0)
  })
  await t.test('revision and terminal rejection require reasons and cannot bypass via legacy mutations',async()=>{
   const id=await rpc(adminA,'save_sph_request',[org,a,payload(),null,null,true])
   const d=await getDoc(id)
   for(const decision of ['revise','reject']) await assert.rejects(rpc(managerA,'decide_sph',[id,d.version,decision,'  ']),/Alasan/)
   await assert.rejects(rpc(managerA,'decide_sph',[id,null,'revise','Reason']),/Versi/)
   await rpc(managerA,'decide_sph',[id,d.version,'revise','Perbaiki nilai penawaran'])
   let notification=(await rpc(adminA,'sales_notifications',[org])).items.find(item=>item.id===id)
   assert.equal(notification.review_note,'Perbaiki nilai penawaran');assert.equal(notification.status,'revision_requested')
   let changed=await getDoc(id)
   await rpc(adminA,'save_sph_request',[org,a,payload(),id,changed.version,true])
   changed=await getDoc(id)
   await rpc(managerA,'decide_sph',[id,changed.version,'reject','Tidak sesuai kebijakan'])
   changed=await getDoc(id)
   await assert.rejects(rpc(adminA,'save_sph_request',[org,a,payload(),id,changed.version,true]),/terkunci/)
   notification=(await rpc(adminA,'sales_notifications',[org])).items.find(item=>item.id===id)
   assert.equal(notification.status,'rejected');assert.equal(notification.review_note,'Tidak sesuai kebijakan')
   await assert.rejects(as(adminA,'select gsp_private.api_save_sph_request_base($1,$2,$3,$4,$5,true)',[org,a,payload(),id,changed.version]),/permission denied/)
   for(const amount of ['',0,-1,'NaN','100.001']) await assert.rejects(rpc(adminA,'save_sph_request',[org,a,payload({amount}),null,null,true]))
  })
 } finally {await db.close()}
})
