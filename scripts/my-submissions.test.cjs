/* eslint-disable @typescript-eslint/no-require-imports -- Execute the pure loader with the installed TypeScript compiler. */
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
const exportsUnderTest={}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/my-submissions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsUnderTest})

test('Personal submissions remain creator-only even when the client could read the whole company',async()=>{
 const client={from(table){
  const filters=[]
  return {select(){return this},eq(key,value){filters.push([key,value]);return this},order(){return this},async limit(){
   const record=(id,org,creator)=>({id,organization_id:org,created_by:creator,title:id,name:id,invoice_number:id,status:'draft',state:'draft',kind:'sph',created_at:'2026-11-04T00:00:00Z'})
   const rows=[record(`${table}-own`,'company','owner'),record(`${table}-other`,'company','colleague'),record(`${table}-foreign`,'other-company','owner')]
   return {data:rows.filter(row=>filters.every(([key,value])=>row[key]===value)),error:null}
  }}
 }}
 const rows=await exportsUnderTest.loadMySubmissions(client,'company','owner')
 assert.equal(rows.length,6)
 assert.ok(rows.every(row=>row.id.endsWith('-own')))
 assert.ok(rows.some(row=>row.kind==='SPH'))
 assert.equal(rows.find(row=>row.source==='workflow_documents').href,'/dokumen/workflow_documents-own')
})

test('A failed source must not silently appear as an empty personal list',async()=>{
 const client={from(){return {select(){return this},eq(){return this},order(){return this},async limit(){return {data:null,error:{code:'42501'}}}}}}
 await assert.rejects(exportsUnderTest.loadMySubmissions(client,'company','user'),/gagal dimuat/)
})
