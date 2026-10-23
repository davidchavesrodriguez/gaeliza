// Local fixtures only: real components/data modules, synthetic PostgREST responses.
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import test from 'node:test'
import { startBrowserHarness } from './helpers/browser-harness.mjs'
const screenshotDir = process.env.ERGONOMICS_SCREENSHOT_DIR
const workspace = {
 id:'analysis', title:'Revisión de ergonomía', mode:'video', status:'in_progress', matchId:'match', scheduledAt:null,
 homeTeam:{id:'home',name:'Atlántico',shortName:null,logoPath:null},awayTeam:{id:'away',name:'Lorchos',shortName:null,logoPath:null},
 periods:[{id:'period',number:1,name:null,expectedDurationSeconds:1800,homeAttacksTowards:'right'}],
 participants:[1,2].map(number=>({id:`home${number}`,teamId:'home',playerId:null,displayName:`Xogador ${number}`,number,starter:true,initialGoalkeeper:false,position:null})),rosterPlayers:[],
 videos:[],syncPoints:[],
}
const fact=(id,time,type='shot',detail={})=>({event_id:id,event_type:type,team_id:'home',period_id:'period',period_number:1,second_in_period:time,raw_x:null,raw_y:null,score_value:type==='shot'?1:0,shot_result:type==='shot'?'point':null,updated_at:'2026-10-22T12:00:00.000001Z',...detail})
test('foul discipline and capture ergonomics',async(t)=>{
 const {browser,origin,html}=await startBrowserHarness(t,{name:'ergonomics',port:5198,source:`
 import React,{useState} from 'react'; import {createRoot} from 'react-dom/client'
 import {TaggingPanel} from '/src/v2/components/TaggingPanel'
 import '/src/v2/styles/global.css';import '/src/v2/styles/analysis-setup.css'
 import '/src/v2/styles/analysis-workspace.css';import '/src/v2/styles/video-sync.css';import '/src/v2/styles/tagging.css'
 const initial=${JSON.stringify(workspace)}
 initial.videos=[{id:'video',title:'Partido de proba',url:location.origin+'/fixture.webm',sortOrder:0,provider:null,durationSeconds:60}]
 initial.syncPoints=[{id:'sync',videoId:'video',periodId:'period',videoSecond:0,secondInPeriod:0}]
 function Harness(){const [w,setW]=useState(initial);return <><header className="app-header">Gaeliza · Fixture local</header>
 <main style={{maxWidth:1480,margin:'auto',padding:24}}><button onClick={()=>setW({...w,status:'completed'})}>Complete fixture</button>
 <TaggingPanel workspace={w} onBack={()=>{}} onWorkspaceChanged={async()=>{}}/></main></>}
 createRoot(document.getElementById('root')).render(<Harness/>);
 `})
 const page=await browser.newPage({viewport:{width:1440,height:1100},colorScheme:'dark'});page.setDefaultTimeout(5000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 let events=Array.from({length:16},(_,i)=>fact(`shot${i}`,i*2))
 const roles=new Map(),writes=[],edits=[]
 let failComposite=false
 const media=await readFile(new URL('fixtures/tagging.webm',import.meta.url))
 const reply=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url())
  if(url.origin!==origin)return route.abort()
  if(request.isNavigationRequest())return route.fulfill({contentType:'text/html',body:html})
  if(url.pathname==='/fixture.webm'){
   const match=request.headers().range?.match(/bytes=(\d+)-(\d*)/)
   const start=match?Number(match[1]):0,end=match?.[2]?Number(match[2]):media.length-1
   return route.fulfill({status:match?206:200,contentType:'video/webm',headers:{'Accept-Ranges':'bytes',...(match?{'Content-Range':`bytes ${start}-${end}/${media.length}`}:{})},body:media.subarray(start,end+1)})
  }
  if(!url.pathname.startsWith('/rest/v1/'))return route.continue()
  if(url.pathname.endsWith('/analysis_event_facts')){
   const id=url.searchParams.get('event_id')?.slice(3)
   return reply(route,id?events.find(e=>e.event_id===id):events)
  }
  if(url.pathname.endsWith('/event_participants')){
   const filter=url.searchParams.get('event_id')
   if(filter.startsWith('eq.'))return reply(route,(roles.get(filter.slice(3))??[]).map(p=>({analysis_participant_id:p.participant_id,role:p.role})))
   return reply(route,filter.slice(4,-1).split(',').flatMap(id=>(roles.get(id)??[]).map(p=>({event_id:id,role:p.role,participant:{id:p.participant_id,display_name_snapshot:workspace.participants.find(x=>x.id===p.participant_id).displayName,number:2}}))))
  }
  if(url.pathname.endsWith('/rpc/log_foul_with_optional_card')){
   const input=request.postDataJSON();writes.push({rpc:'composite',...input})
   if(failComposite)return reply(route,{code:'23514',message:'Fixture card failure'},400)
   const f=`foul${writes.length}`,c=input.p_card_type?`card${writes.length}`:null
   events.push(fact(f,input.p_second_in_period,'foul',{foul_cause:input.p_detail.cause,foul_outcome:input.p_detail.outcome,raw_x:input.p_x,raw_y:input.p_y}))
   roles.set(f,input.p_participants)
   if(c){events.push(fact(c,input.p_second_in_period,'card',{card_type:input.p_card_type,related_foul_event_id:f}));roles.set(c,input.p_card_recipient_id?[{participant_id:input.p_card_recipient_id,role:'card_recipient'}]:[])}
   events.sort((a,b)=>a.second_in_period-b.second_in_period)
   return reply(route,{foul_event_id:f,card_event_id:c})
  }
  if(url.pathname.endsWith('/rpc/log_event')){
   const input=request.postDataJSON();writes.push({rpc:'single',...input});const id=`single${writes.length}`
   events.push(fact(id,input.p_second_in_period,input.p_event_type,{card_type:input.p_detail.card_type,related_foul_event_id:null}));roles.set(id,input.p_participants)
   return reply(route,id)
  }
  if(url.pathname.endsWith('/rpc/update_event')){
   const input=request.postDataJSON();edits.push(input);const e=events.find(e=>e.event_id===input.p_event_id)
   Object.assign(e,{card_type:input.p_detail.card_type,updated_at:'2026-10-22T12:00:01Z'})
   roles.set(e.event_id,input.p_participants);return reply(route,e.event_id)
  }
  if(url.pathname.endsWith('/events')){
   const id=url.searchParams.get('id').slice(3)
   if(request.method()==='GET')return reply(route,{updated_at:events.find(e=>e.event_id===id).updated_at})
   events=events.filter(e=>e.event_id!==id).map(e=>e.related_foul_event_id===id?{...e,related_foul_event_id:null}:e)
   return reply(route,{id})
  }
  throw new Error(`Unexpected fixture request: ${url.pathname}`)
 })
 const idle=()=>page.waitForFunction(()=>document.querySelector('.tagging-save-button')&&!document.querySelector('.tagging-save-button').disabled)
 const capture=()=>page.locator('.tagging-capture-card')
 const save=()=>capture().getByRole('button',{name:/^Gardar/})
 const snapshot=async name=>{if(screenshotDir){await mkdir(screenshotDir,{recursive:true});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${screenshotDir}/${name}.png`,fullPage:true})}}
 await page.goto(origin);await idle()
 await t.test('recent subset expands and collapses; canonical count remains full',async()=>{
  assert.equal(await page.locator('.timeline-event').count(),8)
  await page.getByRole('button',{name:'Mostrar 8 anteriores'}).click()
  assert.equal(await page.locator('.timeline-event').count(),16)
  await page.getByRole('button',{name:'Mostrar só os recentes'}).click()
  assert.equal(await page.locator('.timeline-event').count(),8)
  assert.match(await page.getByRole('region',{name:'Contexto do partido',exact:true}).innerText(),/16 eventos/)
 })
 await t.test('desktop controls remain in flow; pitch enlarged; video hide frees width',async()=>{
  assert.equal(await page.locator('.event-type-button').count(),13)
  const withVideo=await capture().boundingBox()
  assert.ok((await page.locator('.tagging-pitch').boundingBox()).width>240)
  assert.equal(await page.locator('.event-type-controls').evaluate(e=>getComputedStyle(e).position),'static')
  assert.equal(await page.locator('.tagging-video-panel').evaluate(e=>getComputedStyle(e).position),'static')
  await page.evaluate(()=>window.scrollTo(0,0));await page.locator('video').evaluate(v=>{v.currentTime=0.1});await page.waitForFunction(()=>document.querySelector('video').readyState>=2);await snapshot('desktop-video')
  await page.getByRole('button',{name:'Ocultar vídeo'}).click()
  assert.ok((await capture().boundingBox()).width>withVideo.width)
  await snapshot('desktop-no-video')
 })
 await t.test('optional sanction defaults to none; offender suggests recipient, explicit choice wins',async()=>{
  await page.getByRole('button',{name:'Falta',exact:true}).click()
  assert.equal(await page.getByLabel('Sanción disciplinaria · opcional').inputValue(),'')
  assert.equal(await page.getByLabel(/^Sancionado/).count(),0)
  await page.getByLabel(/^Infractor/).selectOption('home1')
  await page.getByLabel('Sanción disciplinaria · opcional').selectOption('yellow')
  assert.equal(await page.getByLabel(/^Sancionado/).inputValue(),'home1')
  await page.getByLabel(/^Sancionado/).selectOption('home2')
  await page.getByLabel(/^Infractor/).selectOption('')
  assert.equal(await page.getByLabel(/^Sancionado/).inputValue(),'home2')
  await page.getByLabel(/^Infractor/).selectOption('home1')
  await page.getByLabel('Tempo no período').fill('0:40')
  await page.getByLabel('X',{exact:true}).fill('0');await page.getByLabel('Y',{exact:true}).fill('45')
  await snapshot('foul-with-card')
  failComposite=true;await save().click();await page.getByText(/O evento non é coherente/).waitFor()
  assert.equal(await page.getByLabel(/^Sancionado/).inputValue(),'home2')
  assert.equal(events.length,16)
  failComposite=false;await save().click();await idle()
  assert.equal(writes.at(-1).rpc,'composite');assert.equal(writes.at(-1).p_card_recipient_id,'home2')
  assert.equal(writes.at(-1).p_x,0);assert.equal(events.length,18)
  assert.equal(await page.getByLabel('Sanción disciplinaria · opcional').inputValue(),'')
 })
 await t.test('linked card retains individual edit/delete and relation; foul deletion detaches card',async()=>{
  const linked=page.getByLabel('Tarxetas asociadas á falta')
  assert.equal(await linked.locator('.timeline-event').count(),1)
  assert.match(await linked.innerText(),/Xogador 2/)
  await snapshot('linked-timeline')
  await linked.getByRole('button',{name:'Editar',exact:true}).click()
  await page.getByRole('button',{name:'Gardar cambios'}).waitFor()
  await capture().getByLabel(/^Tarxeta/).selectOption('red')
  await page.getByRole('button',{name:'Gardar cambios'}).click();await idle()
  assert.equal(edits.at(-1).p_detail.card_type,'red')
  assert.equal(events.find(e=>e.event_id===edits.at(-1).p_event_id).related_foul_event_id,'foul2')
  const group=page.locator('.timeline-event-group').filter({has:linked})
  await group.locator(':scope > .timeline-event').getByRole('button',{name:'Quitar',exact:true}).click();await idle()
  assert.equal(await linked.count(),0)
  const row=page.locator('.timeline-event').filter({hasText:'Vermella'})
  assert.equal(await row.count(),1)
  await row.getByRole('button',{name:'Quitar',exact:true}).click();await idle()
  assert.equal(events.length,16)
 })
 await t.test('foul without card uses composite once; standalone card remains independent',async()=>{
  await page.getByRole('button',{name:'Falta',exact:true}).click();await save().click();await idle()
  assert.equal(writes.at(-1).rpc,'composite');assert.equal(writes.at(-1).p_card_type,null)
  await page.getByRole('button',{name:'Tarxeta',exact:true}).click();await save().click();await idle()
  assert.equal(writes.at(-1).rpc,'single');assert.equal(writes.at(-1).p_event_type,'card')
  assert.equal(events.at(-1).related_foul_event_id,null)
 })
 await t.test('mobile has no sticky panels or overflow; light and dark remain usable',async()=>{
  await page.getByRole('button',{name:'Mostrar vídeo'}).click()
  await page.setViewportSize({width:390,height:844})
  await page.evaluate(()=>window.scrollTo(0,0))
  assert.equal(await page.locator('.event-type-controls').evaluate(e=>getComputedStyle(e).position),'static')
  assert.equal(await page.locator('.tagging-video-panel').evaluate(e=>getComputedStyle(e).position),'static')
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await snapshot('mobile')
  await page.emulateMedia({colorScheme:'light'})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
 })
 await t.test('completed shows full review and disallows edits',async()=>{
  await page.getByRole('button',{name:'Complete fixture'}).click()
  assert.equal(await capture().count(),0)
  assert.equal(await page.locator('.timeline-event').count(),events.length)
  assert.equal(await page.getByRole('button',{name:'Editar',exact:true}).first().isDisabled(),true)
 })
 assert.deepEqual(errors,[])
})
