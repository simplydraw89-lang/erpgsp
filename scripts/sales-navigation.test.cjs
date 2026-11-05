/* eslint-disable @typescript-eslint/no-require-imports -- Render the actual TSX with isolated action/session boundaries. */
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")

function load(file, mocks = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, URLSearchParams, FormData, require: name => {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name.startsWith("@/") || name.startsWith("./")) {
      const base = name.startsWith("@/") ? path.join("src", name.slice(2)) : path.resolve(path.dirname(file), name)
      for (const extension of [".tsx", ".ts"]) if (fs.existsSync(base + extension)) return load(base + extension, mocks)
    }
    return require(name)
  } })
  return exports
}
const Link = ({ children, ...props }) => {
  delete props.onNavigate
  return React.createElement("a", props, children)
}

test("each sales page renders only its own form and document list", () => {
  const { SalesForms } = load("src/components/sales/sales-forms.tsx", {
    "@/components/ui/navigation-link": { NavigationLink: Link },
    "@/components/ui/card": { Card: ({ children }) => React.createElement("div", null, children) },
    "@/app/(workspace)/pengajuan/penjualan/actions": new Proxy({}, { get: () => async () => {} }),
    "@/components/procurement/submit-button": { SubmitButton: ({ children }) => React.createElement("button", null, children) },
    "./document-upload": load("src/components/sales/document-upload.tsx"),
    "@/lib/procurement-ui": { procurementInput: "input", procurementLabel: "label" },
  })
  const props = { register:[{id:"offer",sph_number:1,created_at:"2026-11-05T01:00:00Z",title:"ONLY-OFFER",branch_name:"Surabaya",work_scopes:["Pertek"],amount:1000000,status:"director_review",can_open:false,can_create_spk:false}],branches: [], allBranches: [], clients: [], documents: [
    { id: "offer", kind: "sph", title: "ONLY-OFFER", sph_number: 1, status: "draft", attachment_ids: [] },
    { id: "order", kind: "spk", title: "ONLY-ORDER", status: "draft", attachment_ids: [] },
  ], canAccept: false, disabled: true, userId: "user", owner: false, canRegisterClient: true, canReadClients: true, canCreateDocuments: true, draftId: "draft-test" }
  const html = view => renderToStaticMarkup(React.createElement(SalesForms, { ...props, view }))
  const clients = html("klien")
  assert.match(clients, /Daftarkan calon mitra/)
  assert.doesNotMatch(clients, /name="branch_id"/)
  for (const name of ["name", "address", "npwp", "phone", "email", "industry", "additional_information"]) assert.match(clients, new RegExp(`name="${name}"`))
  assert.doesNotMatch(clients, /Buat draft|ONLY-OFFER|ONLY-ORDER/)
  const sph = html("sph")
  assert.match(sph, /Daftar SPH/)
  assert.match(sph, /ONLY-OFFER/)
  assert.match(sph, /Nilai SPH|Lingkup pekerjaan|Nomor SPH/)
  assert.match(sph, /Ringkasan saja/)
  assert.doesNotMatch(sph, /href="\/pengajuan\/penjualan\/sph\/offer"|<form|<input/)
  assert.doesNotMatch(sph, /Daftarkan calon mitra|ONLY-ORDER|name="accepted_sph_id"/)
  const spk = html("spk")
  assert.match(spk, /Daftar SPK/)
  assert.match(spk, /ONLY-ORDER/)
  assert.doesNotMatch(spk, /<form|name="accepted_sph_id"|Buat draft SPK/)
  assert.doesNotMatch(spk, /Daftarkan calon mitra|ONLY-OFFER/)
})

test("SPH form is separate from register and includes value, confirmation and review decisions",()=>{
 const mocks={"@/components/ui/card":{Card:({children})=>React.createElement("div",null,children)},"@/app/(workspace)/pengajuan/penjualan/actions":new Proxy({},{get:()=>async()=>{}}),"@/components/procurement/submit-button":{SubmitButton:({children})=>React.createElement("button",null,children)}}
 const {SphForm}=load("src/components/sales/sph-form.tsx",mocks)
 const html=renderToStaticMarkup(React.createElement(SphForm,{branches:[],draftId:"new-offer",disabled:false}))
 for(const name of ["branch_id","client_id","title","amount","work_area","work_scopes","deal_status","valid_until","notes"]) assert.match(html,new RegExp(`name="${name}"`))
 assert.match(html,/Tidak, simpan draft/);assert.match(html,/Ya, ajukan SPH/)
 const {SphReviewForm}=load("src/components/sales/sph-review-form.tsx",mocks)
 const review=renderToStaticMarkup(React.createElement(SphReviewForm,{id:"offer",version:2,disabled:false}))
 for(const decision of ["approve","revise","reject"]) assert.match(review,new RegExp(`value="${decision}"`))
})

test("approved own SPH exposes SPK preparation link without opening peer details",()=>{
 const {SalesForms}=load("src/components/sales/sales-forms.tsx",{"@/components/ui/navigation-link":{NavigationLink:Link},"@/app/(workspace)/pengajuan/penjualan/actions":new Proxy({},{get:()=>async()=>{}})})
 const html=renderToStaticMarkup(React.createElement(SalesForms,{view:"sph",documents:[],register:[{id:"own",sph_number:2,title:"Approved",created_at:"2026-11-05T01:00:00Z",work_scopes:[],amount:100,status:"ready",can_open:true,can_create_spk:true}]}))
 assert.match(html,/href="\/pengajuan\/penjualan\/spk\/baru\?sph=own"/)
})

test("draft, submit and review return to SPH register and preserve database errors",async()=>{
 const calls=[]
 let failure=null
 const actions=load("src/app/(workspace)/pengajuan/penjualan/actions.ts",{
  "next/cache":{revalidatePath:()=>{}},"next/navigation":{redirect:path=>{throw new Error(`REDIRECT:${path}`)}},
  "@/lib/auth/context":{requireWorkspace:async()=>({organizationId:"org",isReadOnlyPreview:false,supabase:{rpc:async(name,args)=>{calls.push({name,args});return {data:"saved-offer",error:failure}}}})},
 })
 for(const intent of ['draft','submit']) {
  const data=new FormData();for(const [key,value] of Object.entries({id:"draft-id",branch_id:"branch-A",title:"Offer",intent,amount:"150000",confirmed:"true"})) data.set(key,value)
  await assert.rejects(actions.saveSphRequest({},data),error=>error.message.startsWith('REDIRECT:/pengajuan/penjualan/sph?') && error.message.includes('branch=branch-A'))
  assert.equal(calls.at(-1).args.p_submit,intent==='submit')
  assert.equal(calls.at(-1).args.p_payload.amount,'150000')
 }
 const decision=new FormData();decision.set('document_id','offer');decision.set('version','3');decision.set('decision','revise');decision.set('note','Perbaiki nilai')
 await assert.rejects(actions.reviewSphRequest(decision),/REDIRECT:\/pengajuan\/penjualan\/sph\?notice=/)
 assert.equal(calls.at(-1).name,'decide_sph');assert.equal(calls.at(-1).args.p_decision,'revise')
 failure={message:'Database unavailable'}
 assert.equal((await actions.saveSphRequest({},new FormData())).error,'Database unavailable')
})

test("sales popup contains three icon links to separate pages, without combined forms", () => {
  const { SalesMenu } = load("src/components/sales/sales-menu.tsx", { "@/components/ui/navigation-link": { NavigationLink: Link } })
  const html = renderToStaticMarkup(React.createElement(SalesMenu))
  assert.match(html, /<dialog/)
  for (const section of ["klien", "sph", "spk"]) assert.match(html, new RegExp(`href="/pengajuan/penjualan/${section}"`))
  assert.match(html, /grid-cols-3/)
  assert.doesNotMatch(html, /<form|<input|<select/)
})

test("the organization and role in the topbar link back to dashboard", () => {
  const { Topbar } = load("src/components/layout/topbar.tsx", {
    "@/components/ui/navigation-link": { NavigationLink: Link },
    "@/components/auth/logout-button": { LogoutButton: () => null },
    "@/components/auth/view-as-control": { ViewAsControl: () => null },
  })
  const html = renderToStaticMarkup(React.createElement(Topbar, { organizationName: "GSP", role: "owner", actorRole: "owner" }))
  assert.match(html, /href="\/dashboard"/)
  assert.match(html, /<a[^>]*>[\s\S]*GSP[\s\S]*Super Admin[\s\S]*<\/a>/)
})

test("dashboard modules and sales popup destinations open in new tabs", () => {
  const { SalesMenu } = load("src/components/sales/sales-menu.tsx", { "@/components/ui/navigation-link": { NavigationLink: Link } })
  const { ApplicationGrid } = load("src/components/dashboard/application-grid.tsx", {
    "@/components/ui/navigation-link": { NavigationLink: Link },
    "@/lib/app-catalog": load("src/lib/app-catalog.ts"),
    "@/components/sales/sales-menu": { SalesMenu },
  })
  const html = renderToStaticMarkup(React.createElement(ApplicationGrid, { role: "owner" }))
  assert.match(html, /href="\/pengajuan\/pembelian"/)
  for (const path of ["/pengajuan/pembelian", "/pengajuan/cuti", "/pengajuan/perjalanan-dinas", "/pekerjaan-saya/pengajuan"]) {
    const anchor = [...html.matchAll(/<a\b[^>]*>/g)].map(match => match[0]).find(tag => tag.includes(`href="${path}"`))
    assert.ok(anchor, `Missing dashboard menu ${path}`)
    assert.match(anchor, /target="_blank"/)
    assert.match(anchor, /rel="noopener noreferrer"/)
  }
  for (const section of ["klien", "sph", "spk"]) assert.match(html, new RegExp(`href="/pengajuan/penjualan/${section}"`))
  const links = [...html.matchAll(/<a\b[^>]*>/g)].map(match => match[0])
  assert.ok(links.length > 3)
  for (const link of links) {
    assert.match(link, /target="_blank"/)
    assert.match(link, /rel="noopener noreferrer"/)
  }
})
