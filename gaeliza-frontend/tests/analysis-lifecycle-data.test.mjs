import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
let respond
const calls=[]
const transport={from(operation){
  const call={operation,steps:[]};calls.push(call)
  const builder=new Proxy({}, {get(_,method){
    if(method==='then')return (resolve,reject)=>Promise.resolve().then(()=>respond(call)).then(resolve,reject)
    return (...args)=>{call.steps.push([method,...args]);return builder}
  }})
  return builder
}}
async function loadData(file){
  globalThis[Symbol.for('gaeliza.ux.transport')]=transport
  const source=await readFile(new URL(`../src/v2/data/${file}.ts`,import.meta.url),'utf8')
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
    .replace(/import \{ supabase \} from ['"]\.\.\/lib\/supabase['"];?/,"const supabase=globalThis[Symbol.for('gaeliza.ux.transport')]")
  const result=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
  delete globalThis[Symbol.for('gaeliza.ux.transport')]
  return result
}
const {listOwnedAnalyses}=await loadData('dashboard')
const {completeAnalysis}=await loadData('analyses')
const raw=(status)=>({id:status,title:null,status,updated_at:'2026-10-21T00:00:00Z',match:{scheduled_at:null,home:{name:'Home'},away:{name:'Away'}},event_count:[{count:4}],videos:[{count:1}],activity:[{updated_at:'2026-10-22T00:00:00Z'}]})
test('dashboard scopes to owner, paginates and requests only counts plus one latest event timestamp',async()=>{
  calls.length=0;respond=()=>({data:['draft','in_progress','completed'].map(raw),error:null})
  const signal=new AbortController().signal
  const rows=await listOwnedAnalyses('owner',50,signal)
  assert.equal(calls.length,1)
  assert.deepEqual(calls[0].steps.find(s=>s[0]==='eq'),['eq','owner_user_id','owner'])
  assert.deepEqual(calls[0].steps.find(s=>s[0]==='range'),['range',50,99])
  assert.deepEqual(calls[0].steps.find(s=>s[0]==='limit'),['limit',1,{referencedTable:'activity'}])
  assert.equal(calls[0].steps.find(s=>s[0]==='abortSignal')[1],signal)
  assert.match(calls[0].steps.find(s=>s[0]==='select')[1],/event_count:events\(count\)/)
  assert.equal(rows[0].eventCount,4);assert.equal(rows[0].videoCount,1)
  assert.equal(rows[0].updatedAt,'2026-10-22T00:00:00Z')
  assert.deepEqual(rows.map(r=>r.status),['draft','in_progress','completed'])
})
test('empty/error owner lists and inaccessible match metadata never invent progress or teams',async()=>{
  respond=()=>({data:[],error:null});assert.deepEqual(await listOwnedAnalyses('owner',0,new AbortController().signal),[])
  respond=()=>({data:null,error:{message:'Read failed'}});await assert.rejects(listOwnedAnalyses('owner',0,new AbortController().signal),/Read failed/)
  respond=()=>({data:[{...raw('draft'),match:null,event_count:[],videos:[],activity:[]}],error:null})
  const [row]=await listOwnedAnalyses('owner',0,new AbortController().signal)
  assert.equal(row.eventCount,0);assert.equal(row.videoCount,0);assert.match(row.homeTeam,/non dispoñible/)
})
test('finalization updates only status and requires a returned row, so RLS-hidden failures cannot report success',async()=>{
  calls.length=0;respond=()=>({data:{id:'analysis'},error:null})
  await completeAnalysis('analysis')
  assert.equal(calls.length,1);assert.equal(calls[0].operation,'analyses')
  assert.deepEqual(calls[0].steps,[['update',{status:'completed'}],['eq','id','analysis'],['select','id'],['single']])
  respond=()=>({data:null,error:{code:'PGRST116',message:'No row'}})
  await assert.rejects(completeAnalysis('analysis'),/No row/)
})
