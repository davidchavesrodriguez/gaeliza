import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
let respond
const calls=[]
function query(operation) {
  const call={operation,steps:[]}; calls.push(call)
  const builder=new Proxy({}, {get(_,method) {
    if(method==='then') return (resolve,reject)=>Promise.resolve().then(()=>respond(call)).then(resolve,reject)
    return (...args)=>{call.steps.push([method,...args]); return builder}
  }})
  return builder
}
globalThis[Symbol.for('gaeliza.edit.test')]={from:query,rpc:(operation,args)=>{const call={operation,args};calls.push(call);return respond(call)}}
const source=await readFile(new URL('../src/v2/data/event-editing.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
  .replace(/from ['"]\.\.\/domain\/event-editing['"]/,`from '${new URL('../src/v2/domain/event-editing.ts',import.meta.url).href}'`)
  .replace(/import \{ supabase \} from ['"]\.\.\/lib\/supabase['"];?/,"const supabase=globalThis[Symbol.for('gaeliza.edit.test')]")
const {getEventForEditing,updateAnalysisEvent}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
delete globalThis[Symbol.for('gaeliza.edit.test')]
const version='2026-10-22T00:00:00.123456+00:00'
const fact={event_id:'event',updated_at:version,event_type:'card',team_id:'home',period_id:'period',second_in_period:0,raw_x:0,raw_y:0,card_type:'yellow',related_foul_event_id:'foul'}
function reply(call){return {error:null,data:call.operation==='analysis_event_facts'?fact:call.operation==='events'?{updated_at:version}:[{analysis_participant_id:'snapshot',role:'card_recipient'}]}}
test('on-demand reads scope every request to one event/analysis and verify version after roles',async()=>{
  calls.length=0;respond=reply
  const signal=new AbortController().signal
  const event=await getEventForEditing('analysis','event',signal)
  assert.equal(event.form.roles.card_recipient,'snapshot'); assert.equal(event.relatedFoulEventId,'foul')
  assert.deepEqual(calls.map(c=>c.operation),['analysis_event_facts','event_participants','events'])
  for(const call of calls){
    assert.deepEqual(call.steps.filter(s=>s[0]==='eq'),[['eq','analysis_id','analysis'],['eq',call.operation==='events'?'id':'event_id','event']])
    assert.equal(call.steps.find(s=>s[0]==='abortSignal')[1],signal)
  }
})
test('inconsistent read snapshots and failed reads never open an editor',async()=>{
  respond=c=>c.operation==='events'?{error:null,data:{updated_at:'new'}}:reply(c)
  await assert.rejects(getEventForEditing('analysis','event',new AbortController().signal),/cambiou durante/)
  respond=c=>c.operation==='event_participants'?{data:null,error:{message:'roles failed'}}:reply(c)
  await assert.rejects(getEventForEditing('analysis','event',new AbortController().signal),/roles failed/)
})
const event={id:'event',updatedAt:version,form:{capture:{eventType:'card'}}}
const input={analysisId:'analysis',eventType:'card',teamId:'home',periodId:'period',secondInPeriod:0,x:0,y:0,detail:{card_type:'red'},participants:[{participantId:'snapshot',role:'card_recipient'}]}
test('save is one atomic RPC, preserves raw version, and never sends identity changes or unowned fields',async()=>{
  calls.length=0;respond=()=>({data:'event',error:null})
  assert.equal(await updateAnalysisEvent(event,input),'event');assert.equal(calls.length,1)
  assert.equal(calls[0].operation,'update_event');assert.equal(calls[0].args.p_expected_updated_at,version)
  assert.equal(calls[0].args.p_x,0);assert.equal(calls[0].args.p_y,0)
  assert.deepEqual(calls[0].args.p_participants,[{participant_id:'snapshot',role:'card_recipient'}])
  for(const field of ['p_event_type','p_video_second','p_notes','p_sort_order'])assert.equal(field in calls[0].args,false)
  await assert.rejects(updateAnalysisEvent(event,{...input,eventType:'shot'}),/tipo de evento/)
})
test('manual, stale, failed and unexpected saves cannot report success',async()=>{
  for(const [code,message]of[['55000',/posesión manual/],['40001',/Cancela/],['23514',/Non puidemos gardar/]]){
    respond=()=>({data:null,error:{code,message:'failure'}});await assert.rejects(updateAnalysisEvent(event,input),message)
  }
  respond=()=>({data:'other',error:null});await assert.rejects(updateAnalysisEvent(event,input),/esperado/)
})
