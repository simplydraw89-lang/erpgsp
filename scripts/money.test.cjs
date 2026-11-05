/* eslint-disable @typescript-eslint/no-require-imports -- Execute the installed TypeScript compiler with isolated React boundaries. */
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
const React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
function load(file,mocks={}) {
 const exports={}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,requestAnimationFrame:callback=>callback(),require:name=>mocks[name]??require(name)})
 return exports
}
const money=load('src/lib/money.ts')
test('Indonesian money groups thousands, millions and billions without losing string precision',()=>{
 for(const [value,formatted] of [['1000','1.000,00'],['1250000.50','1.250.000,50'],['1000000000','1.000.000.000,00'],['9999999999999999.99','9.999.999.999.999.999,99'],['-1500000.25','-1.500.000,25']]) assert.equal(money.formatAmount(value),formatted)
 assert.equal(money.formatCurrency('0'),'Rp\u00a00,00')
 assert.equal(money.formatCurrency(0.1+0.2),'Rp\u00a00,30')
 assert.equal(money.formatCurrency(null),'—')
 assert.equal(money.formatCurrency('not a number'),'Nominal tidak valid')
})
test('typing and pasting preserve canonical cents and reject ambiguous or malformed amounts',()=>{
 for(const input of ['1250000,50','1.250.000,50','Rp 1.250.000,50']) assert.equal(money.parseMoneyInput(input).canonical,'1250000.50')
 assert.equal(money.parseMoneyInput('1000000000').display,'1.000.000.000')
 assert.equal(money.parseMoneyInput('1.250,').display,'1.250,')
 assert.equal(money.parseMoneyInput('1.250,0').display,'1.250,0')
 assert.equal(money.parseMoneyInput('1.000').canonical,'1000.00')
 for(const input of ['1,234.56','1000.50','1.00','1,234','1e6','1.000.00','-100','12abc']) assert.ok(money.parseMoneyInput(input).error,input)
 assert.equal(money.parseMoneyInput('-1.000,50',true).canonical,'-1000.50')
 assert.equal(money.parseMoneyInput('').canonical,'')
})
test('money input submits canonical value while displaying grouped Indonesian amount',()=>{
 const {MoneyInput}=load('src/components/ui/money-input.tsx',{'@/lib/money':money})
 const html=renderToStaticMarkup(React.createElement(MoneyInput,{name:'amount',defaultValue:'1250000.50',required:true}))
 assert.match(html,/type="text"[^>]*inputMode="decimal"[^>]*name="amount__display"[^>]*value="1\.250\.000,50"/)
 assert.match(html,/type="hidden" name="amount" value="1250000\.50"/)
})
test('live edits keep trailing decimal zeros and malformed inputs cannot submit as drafts',()=>{
 let index=0,refsIndex=0
 const states=[],refs=[],effects=[]
 const mockReact={useState:initial=>{const i=index++;if(!(i in states))states[i]=initial;return [states[i],next=>{states[i]=next}]},useRef:initial=>{const i=refsIndex++;return refs[i]??(refs[i]={current:initial})},useId:()=> 'money-error',useEffect:effect=>effects.push(effect)}
 const {MoneyInput}=load('src/components/ui/money-input.tsx',{'@/lib/money':money,react:mockReact})
 let listener,validity=''
 const element={value:'1250000,50',selectionStart:10,isConnected:true,disabled:false,matches:()=>false,validity:{customError:false},setCustomValidity:text=>{validity=text;element.validity.customError=Boolean(text)},setSelectionRange:()=>{},reportValidity:()=>{},form:{addEventListener:(_,callback)=>listener=callback,removeEventListener:()=>{}}}
 const render=()=>{index=0;refsIndex=0;return MoneyInput({name:'amount'})}
 let tree=render();refs[0].current=element;effects.forEach(effect=>effect())
 tree.props.children[0].props.onChange({currentTarget:element});tree=render()
 assert.equal(tree.props.children[0].props.value,'1.250.000,50')
 assert.equal(tree.props.children[1].props.value,'1250000.50')
 element.value='1,234.56';element.selectionStart=8;tree.props.children[0].props.onChange({currentTarget:element});tree=render()
 assert.ok(validity);assert.equal(tree.props.children[1].props.value,'invalid')
 let prevented=false
 listener({preventDefault:()=>prevented=true,stopImmediatePropagation:()=>{}})
 assert.equal(prevented,true)
})
