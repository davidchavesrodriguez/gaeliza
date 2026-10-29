// UI/transport fixtures only. Production components, data and payload builders run
// unchanged. PostgreSQL/RPC atomicity is outside this presentation slice.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import test from 'node:test'
import { startBrowserHarness } from './helpers/browser-harness.mjs'
import { contrastRatio } from './helpers/contrast.mjs'
const screenshotDir=process.env.WORKSTATION_SCREENSHOT_DIR
const types={shot:'Tiro',pass:'Pase',recovery:'Recuperación',turnover:'Perda',duel:'Duelo',dribble:'Regate',block:'Bloqueo',kickout:'Saque de porta',restart:'Reinicio',foul:'Falta',card:'Tarxeta',substitution:'Substitución',goalkeeper_change:'Cambio de porteiro'}
const team=(id,name)=>({id,name,short_name:null,logo_path:null})
const home=team('home','GB Lorchos'),away=team('away','Keltoi')
const people=['home','away'].flatMap(team_id=>[1,2].map(number=>({id:`${team_id}${number}`,team_id,player_id:null,display_name_snapshot:`${team_id==='home'?'Ana':'Brais'} ${number}`,number,starter:true,initial_goalkeeper:number===1,position:number===1?'Goalkeeper':'Defender'})))
const fact=(id,type='shot',second=0,extra={})=>({event_id:id,analysis_id:'analysis',updated_at:'2026-10-22T12:00:00.000001Z',event_type:type,team_id:'home',period_id:'period1',period_number:1,second_in_period:second,raw_x:null,raw_y:null,related_foul_event_id:null,score_value:type==='shot'?1:0,shot_result:type==='shot'?'point':null,...extra})
const fieldsFor=(input)=>({team_id:input.p_team_id,period_id:input.p_period_id,period_number:input.p_period_id==='period2'?2:1,second_in_period:input.p_second_in_period,raw_x:input.p_x,raw_y:input.p_y,
 shot_result:input.p_detail.result,shot_technique:input.p_detail.technique,shot_situation:input.p_detail.situation,
 pass_result:input.p_detail.result,pass_technique:input.p_detail.technique,pass_raw_end_x:input.p_detail.end_x,pass_raw_end_y:input.p_detail.end_y,
 recovery_method:input.p_detail.method,turnover_cause:input.p_detail.cause,foul_cause:input.p_detail.cause,foul_outcome:input.p_detail.outcome,
 card_type:input.p_detail.card_type,kickout_length:input.p_detail.length,kickout_result:input.p_detail.result,kickout_raw_end_x:input.p_detail.end_x,kickout_raw_end_y:input.p_detail.end_y,
 duel_type:input.p_detail.duel_type,dribble_result:input.p_detail.result,restart_type:input.p_detail.restart_type})
test('tactical workstation presentation and capture regressions',async(t)=>{
 const {browser,origin,html}=await startBrowserHarness(t,{name:'workstation',port:5203,source:`
 import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter,Routes,Route} from 'react-router-dom'
 import {AuthContext} from '/src/v2/auth/auth-context';import {AppShell} from '/src/v2/components/AppShell'
 import {AnalysisWorkspacePage} from '/src/v2/pages/AnalysisWorkspacePage';import {initializeTheme} from '/src/v2/domain/theme'
 import '/src/v2/styles/global.css';import '/src/v2/styles/analysis-setup.css';import '/src/v2/styles/analysis-workspace.css';import '/src/v2/styles/video-sync.css';import '/src/v2/styles/tagging.css'
 initializeTheme();const session={user:{id:'fixture-owner',is_anonymous:true}},auth={session,status:'ready',error:null,isAnonymous:true,ensureGuestSession:async()=>session,retrySession:()=>{},signOut:async()=>{}}
 createRoot(document.getElementById('root')).render(<AuthContext.Provider value={auth}><BrowserRouter><Routes><Route path="/app" element={<AppShell/>}><Route path="analyses/:analysisId" element={<AnalysisWorkspacePage/>}/></Route></Routes></BrowserRouter></AuthContext.Provider>)
 `})
 const page=await browser.newPage({viewport:{width:1440,height:900},hasTouch:true,colorScheme:'dark',timezoneId:'Europe/Madrid',reducedMotion:'reduce'});page.setDefaultTimeout(5000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 let events=[],status='in_progress',failSave=false,failRead=false
 const roles=new Map(),writes=[],measures=[]
 const media=await readFile(new URL('fixtures/tagging.webm',import.meta.url))
 const reply=(route,data,code=200)=>route.fulfill({status:code,contentType:'application/json',body:JSON.stringify(data)})
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url())
  if(url.origin!==origin)return route.abort()
  if(req.isNavigationRequest())return route.fulfill({contentType:'text/html',body:html})
  if(url.pathname==='/fixture.webm'){
   const match=req.headers().range?.match(/bytes=(\d+)-(\d*)/),start=match?Number(match[1]):0,end=match?.[2]?Number(match[2]):media.length-1
   return route.fulfill({status:match?206:200,contentType:'video/webm',headers:{'Accept-Ranges':'bytes',...(match?{'Content-Range':`bytes ${start}-${end}/${media.length}`}:{})},body:media.subarray(start,end+1)})
  }
  if(url.pathname==='/broken.webm')return route.fulfill({status:404,body:'fixture unavailable'})
  if(!url.pathname.startsWith('/rest/v1/'))return route.continue()
  if(url.pathname.endsWith('/analyses')){
   if(req.method()==='PATCH'){status=req.postDataJSON().status;return reply(route,{id:'analysis'})}
   return reply(route,{id:'analysis',title:null,status,mode:'post_match',match_id:'match',match:{id:'match',scheduled_at:'2026-10-22T17:30:00Z',home_team:home,away_team:away}})
  }
  if(url.pathname.endsWith('/analysis_periods'))return reply(route,[1,2].map(number=>({id:`period${number}`,number,name:`Parte ${number}`,expected_duration_seconds:1800,home_attacks_towards:number===1?'right':'left'})))
  if(url.pathname.endsWith('/analysis_participants'))return reply(route,people)
  if(url.pathname.endsWith('/team_players'))return reply(route,[])
  if(url.pathname.endsWith('/analysis_videos'))return reply(route,[['direct','Cámara principal',origin+'/fixture.webm'],['youtube','YouTube','https://youtu.be/dQw4w9WgXcQ'],['external','Outra fonte','https://example.test/watch?token=keep'],['broken','Vídeo non dispoñible',origin+'/broken.webm']].map(([id,title,url],sort_order)=>({id,title,url,sort_order,duration_seconds:60})))
  if(url.pathname.endsWith('/video_sync_points'))return reply(route,['direct','youtube','external','broken'].flatMap(videoId=>[1,2].map(n=>({id:`${videoId}${n}`,analysis_video_id:videoId,analysis_period_id:`period${n}`,video_second:10,second_in_period:0}))))
  if(url.pathname.endsWith('/analysis_event_facts')){
   if(failRead)return reply(route,{message:'Fixture event load failed'},400)
   const id=url.searchParams.get('event_id')?.slice(3)
   return reply(route,id?events.find(e=>e.event_id===id):events)
  }
  if(url.pathname.endsWith('/event_participants')){
   const filter=url.searchParams.get('event_id')
   if(filter.startsWith('eq.'))return reply(route,(roles.get(filter.slice(3))??[]).map(p=>({analysis_participant_id:p.participant_id,role:p.role})))
   const ids=filter.slice(4,-1).split(',')
   return reply(route,ids.flatMap(id=>(roles.get(id)??[]).map(p=>({event_id:id,role:p.role,participant:{id:p.participant_id,display_name_snapshot:people.find(person=>person.id===p.participant_id).display_name_snapshot,number:people.find(person=>person.id===p.participant_id).number}}))))
  }
  if(url.pathname.endsWith('/events')){
   const id=url.searchParams.get('id').slice(3)
   if(req.method()==='GET')return reply(route,{updated_at:events.find(e=>e.event_id===id).updated_at})
   events=events.filter(e=>e.event_id!==id).map(e=>e.related_foul_event_id===id?{...e,related_foul_event_id:null}:e)
   return reply(route,{id})
  }
  if(url.pathname.includes('/rpc/')){
   const input=req.postDataJSON();writes.push({rpc:url.pathname.split('/').at(-1),...input})
   if(failSave)return reply(route,{message:'Fixture event save failed'},400)
   if(url.pathname.endsWith('/update_event')){
    const item=events.find(e=>e.event_id===input.p_event_id);Object.assign(item,fieldsFor(input),{updated_at:'2026-10-22T12:01:00Z'});roles.set(item.event_id,input.p_participants);return reply(route,item.event_id)
   }
   const id=`event${writes.length}`;events.push(fact(id,input.p_event_type??'foul',input.p_second_in_period,fieldsFor(input)));roles.set(id,input.p_participants)
   if(url.pathname.endsWith('/log_foul_with_optional_card')){
    const cardId=input.p_card_type?`card${writes.length}`:null
    if(cardId){events.push(fact(cardId,'card',input.p_second_in_period,{card_type:input.p_card_type,related_foul_event_id:id,raw_x:input.p_x,raw_y:input.p_y}));roles.set(cardId,input.p_card_recipient_id?[{participant_id:input.p_card_recipient_id,role:'card_recipient'}]:[])}
    return reply(route,{foul_event_id:id,card_event_id:cardId})
   }
   return reply(route,id)
  }
  throw new Error(`Unexpected fixture request ${req.method()} ${url.pathname}`)
 })
 const capture=()=>page.locator('.tagging-capture-card')
 const idle=()=>page.waitForFunction(()=>{const button=document.querySelector('.tagging-save-button');return button&&!button.disabled})
 const save=()=>capture().getByRole('button',{name:/^Gardar/})
 const start=async()=>{await page.goto(origin+'/app/analyses/analysis?step=tagging');await idle()}
 const select=async(type)=>{if((await page.viewportSize()).width<768){await page.getByLabel('Acción',{exact:true}).focus();await page.getByLabel('Acción',{exact:true}).selectOption(type)}else await page.getByRole('group',{name:'Tipo de evento',exact:true}).getByRole('button',{name:types[type],exact:true}).click()}
 const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow')
 const shot=async(name)=>{
  if(!screenshotDir)return
  await mkdir(screenshotDir,{recursive:true});await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)});await page.mouse.move(0,0)
  if(await page.locator('video').count())await page.waitForFunction(()=>{const v=document.querySelector('video');return v.readyState>=2&&!v.seeking}).catch(()=>{})
  await page.screenshot({path:`${screenshotDir}/${name}.png`,fullPage:true,animations:'disabled'})
 }
 const measure=async(label)=>{
  await page.evaluate(()=>scrollTo(0,0))
  const data=await page.evaluate(()=>{const box=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};return {viewport:{width:innerWidth,height:innerHeight},capture:box('.tagging-capture-card'),video:box('.tagging-video-panel'),pitch:box('.tagging-pitch'),save:box('.tagging-save-button'),timeline:box('.tagging-timeline-card'),navigation:box('.workspace-navigation'),desktopActions:[...document.querySelectorAll('.event-type-button')].filter(e=>e.getClientRects().length).length,overflow:document.documentElement.scrollWidth>innerWidth}})
  measures.push({label,...data});return data
 }
 await start()
 await t.test('empty timeline is compact and shot with video exposes save and start of sequence at 1440',async()=>{
  await page.getByText('Aínda non hai eventos.',{exact:true}).waitFor()
  const data=await measure('shot-video-1440')
  assert.equal(data.desktopActions,13);assert.equal(data.video.width,400)
  assert.ok(data.capture.width>=950);assert.ok(data.pitch.width>=300)
  assert.ok(data.save.bottom<=900,`save bottom ${data.save.bottom}`)
  assert.ok(data.timeline.y<900,`timeline begins ${data.timeline.y}`)
  assert.equal(data.overflow,false)
  await page.getByLabel(/^Período/).selectOption('period2');await page.getByLabel('Tempo no período',{exact:true}).fill('18:42')
  await select('pass');assert.equal(await page.getByLabel('Tempo no período',{exact:true}).inputValue(),'18:42')
  assert.equal(await page.getByLabel(/^Período/).inputValue(),'period2')
  await select('shot');await page.getByLabel(/^Período/).selectOption('period1');await page.getByLabel('Tempo no período',{exact:true}).fill('0:00')
  await shot('shot-video-dark')
  await page.getByRole('button',{name:'Cambiar a tema claro'}).click();await shot('shot-video-light')
  await page.getByRole('button',{name:'Cambiar a tema escuro'}).click()
  await page.getByRole('button',{name:'Ocultar vídeo'}).click();assert.equal(await page.locator('video').count(),0)
  const full=await measure('shot-no-video-1440');assert.ok(full.capture.width>data.capture.width);await shot('shot-no-video-dark')
 })
 await t.test('action groups, selected state and keyboard focus remain legible in both themes',async()=>{
  await page.setViewportSize({width:1440,height:900});await start()
  for(const theme of ['dark','light']){
   if(theme==='light')await page.getByRole('button',{name:'Cambiar a tema claro'}).click()
   for(const name of ['Principais','Xogo','Reinicios','Disciplina','Cambios']){
    const group=page.getByRole('group',{name,exact:true});await group.waitFor()
    const box=await group.boundingBox()
    for(const button of await group.getByRole('button').all()){
     const control=await button.boundingBox()
     assert.ok(control.height>=44&&control.x>=box.x&&control.x+control.width<=box.x+box.width+1,`${name}: targets fit their category`)
    }
   }
   const selected=page.getByRole('button',{name:'Tiro',exact:true})
   await selected.focus();await page.keyboard.press('Tab')
   assert.ok(await page.getByRole('button',{name:'Pase',exact:true}).evaluate(e=>e===document.activeElement&&e.matches(':focus-visible')))
   const colors=await page.evaluate(()=>{
    const css=getComputedStyle(document.documentElement)
    return Object.fromEntries(['accent','on-accent','paper','surface','surface-muted','ink','ink-soft','control-line','warning','danger','info','pitch','pitch-line','pitch-marker'].map(key=>[key,css.getPropertyValue('--'+key).trim()]))
   })
   for(const [ink,paper,min] of [['on-accent','accent',4.5],['ink-soft','paper',4.5],['ink-soft','surface',4.5],['ink','surface-muted',4.5],['accent','surface',3],['control-line','paper',3],['warning','surface',4.5],['danger','surface',4.5],['info','surface',4.5],['pitch-line','pitch',3],['pitch-marker','pitch',3]]){
    assert.ok(contrastRatio(colors[ink],colors[paper])>=min,`${theme}: ${ink}/${paper}`)
   }
   assert.equal(await selected.getAttribute('aria-pressed'),'true')
   assert.ok(await selected.evaluate(e=>{
    const active=getComputedStyle(e),inactive=getComputedStyle(e.parentElement.querySelector('button[aria-pressed="false"]'))
    return active.textDecorationLine!==inactive.textDecorationLine||Number(active.fontWeight)>Number(inactive.fontWeight)||['Top','Right','Bottom','Left'].some(side=>active['border'+side+'Width']!==inactive['border'+side+'Width'])
   }),'selection has a non-color cue distinct from inactive commands')
  }
  await page.getByRole('button',{name:'Cambiar a tema escuro'}).click()
 })
 for(const width of [1440,390])await t.test(`all thirteen actions remain selectable and save their unchanged partial payloads at ${width}`,async()=>{
  await page.setViewportSize({width,height:900});await start()
  if(width<768){assert.equal(await page.getByLabel('Acción',{exact:true}).locator('option').count(),13);assert.equal(await page.getByRole('group',{name:'Tipo de evento',exact:true}).count(),0)}
  for(const [type,label]of Object.entries(types)){
   await select(type);await capture().getByRole('heading',{name:label,exact:true}).waitFor()
   if(width<768)assert.equal(await page.getByLabel('Acción',{exact:true}).evaluate(e=>e===document.activeElement),true)
   await page.getByLabel('Tempo no período',{exact:true}).fill('0:25')
   const before=writes.length;await save().click();await idle();assert.equal(writes.length,before+1)
   assert.equal(type==='foul'?writes.at(-1).rpc:writes.at(-1).p_event_type,type==='foul'?'log_foul_with_optional_card':type)
   assert.equal(writes.at(-1).p_second_in_period,25)
   await noOverflow()
  }
 })
 await t.test('position pairs, boundary values, clear and destination-only kickout keep their contracts',async()=>{
  await page.setViewportSize({width:1440,height:900});await start();await select('shot')
  await page.getByLabel('X',{exact:true}).fill('0');await save().click();await capture().getByRole('alert').waitFor()
  assert.equal(await page.getByLabel('X',{exact:true}).inputValue(),'0')
  await page.getByLabel('Y',{exact:true}).fill('0');await save().click();await idle()
  assert.equal(writes.at(-1).p_x,0);assert.equal(writes.at(-1).p_y,0)
  await page.getByLabel('X',{exact:true}).fill('100');await page.getByLabel('Y',{exact:true}).fill('100');await save().click();await idle()
  assert.equal(writes.at(-1).p_x,100);assert.equal(writes.at(-1).p_y,100)
  await page.getByRole('button',{name:'Escolle a posición do evento no campo',exact:true}).click({position:{x:30,y:40}})
  assert.notEqual(await page.getByLabel('X',{exact:true}).inputValue(),'')
  await page.getByRole('button',{name:'Limpar posición',exact:true}).click();assert.equal(await page.getByLabel('Y',{exact:true}).inputValue(),'')
  const pitch=await page.getByRole('button',{name:'Escolle a posición do evento no campo',exact:true}).boundingBox()
  await page.touchscreen.tap(pitch.x+pitch.width/2,pitch.y+pitch.height/2)
  assert.notEqual(await page.getByLabel('Y',{exact:true}).inputValue(),'')
  await page.getByRole('button',{name:'Limpar posición',exact:true}).click()
  await save().click();await idle();assert.equal(writes.at(-1).p_x,null);assert.equal(writes.at(-1).p_y,null)
  await select('kickout');assert.equal(await page.getByLabel('X',{exact:true}).count(),0)
  await page.getByLabel('Destino X',{exact:true}).fill('0');await page.getByLabel('Destino Y',{exact:true}).fill('0');await save().click();await idle()
  assert.equal(writes.at(-1).p_x,null);assert.equal(writes.at(-1).p_y,null);assert.equal(writes.at(-1).p_detail.end_x,0);assert.equal(writes.at(-1).p_detail.end_y,0)
  events=[fact('legacy-kickout','kickout',0,{raw_x:55,raw_y:44,kickout_length:'short',kickout_result:null,kickout_raw_end_x:0,kickout_raw_end_y:0})]
  await start();await page.locator('.timeline-event').getByRole('button',{name:'Editar',exact:true}).click();await page.getByRole('button',{name:'Gardar cambios'}).waitFor()
  assert.equal(await page.getByLabel('X',{exact:true}).count(),0);await page.getByRole('button',{name:'Gardar cambios'}).click();await idle()
  assert.equal(writes.at(-1).p_x,null);assert.equal(writes.at(-1).p_y,null);assert.equal(writes.at(-1).p_detail.end_x,0)
  await select('substitution');assert.equal(await page.getByRole('button',{name:'Escolle a posición do evento no campo',exact:true}).count(),0)
  await page.getByText('Posición do evento (opcional)',{exact:true}).click()
  await page.getByLabel('X',{exact:true}).fill('0');await page.getByLabel('Y',{exact:true}).fill('0')
  await page.getByText('Posición do evento (opcional)',{exact:true}).click();await save().click();await idle()
  assert.equal(writes.at(-1).p_x,0);assert.equal(writes.at(-1).p_y,0)
 })
 await t.test('discipline remains optional, atomic in one RPC, linked and independently editable/deletable',async()=>{
  events=[];roles.clear();await start();await select('foul')
  assert.equal(await page.getByLabel('Sanción disciplinaria · opcional').inputValue(),'')
  await save().click();await idle();assert.equal(writes.at(-1).p_card_type,null)
  await page.getByLabel(/^Infractor/).selectOption('home1');await page.getByLabel('Sanción disciplinaria · opcional').selectOption('yellow')
  assert.equal(await page.getByLabel(/^Sancionado/).inputValue(),'home1');await page.getByLabel(/^Sancionado/).selectOption('home2')
  await shot('foul-optional-card');const before=writes.length;await save().click();await idle()
  assert.equal(writes.length,before+1);assert.equal(writes.at(-1).p_card_recipient_id,'home2')
  const linked=page.getByLabel('Tarxetas asociadas á falta');await linked.getByText(/Vinculada á falta/).waitFor();await shot('linked-discipline-timeline')
  await linked.getByRole('button',{name:'Editar',exact:true}).click();await page.getByRole('button',{name:'Gardar cambios'}).waitFor()
  await page.getByText('En edición',{exact:true}).waitFor()
  assert.match(await page.evaluate(()=>document.activeElement.textContent),/Modificar tarxeta/)
  await page.getByRole('button',{name:'Cancelar edición',exact:true}).click();await idle()
  assert.equal(await linked.getByRole('button',{name:'Editar',exact:true}).evaluate(e=>e===document.activeElement),true)
  assert.equal(await page.getByText('En edición',{exact:true}).count(),0)
  const group=page.locator('.timeline-event-group').filter({has:linked})
  await group.locator(':scope > .timeline-event').getByRole('button',{name:'Quitar',exact:true}).click();await idle()
  assert.equal(await linked.count(),0);assert.equal(events.filter(e=>e.event_type==='card').length,1)
  assert.equal(events.find(e=>e.event_type==='card').related_foul_event_id,null)
  await select('card');await save().click();await idle();assert.equal(writes.at(-1).rpc,'log_event');assert.equal(events.at(-1).related_foul_event_id,null)
 })
 await t.test('failed save retains the useful draft and error; failed event reads remain recoverable',async()=>{
  await select('shot');await page.getByLabel('Tempo no período',{exact:true}).fill('0:42');await page.getByLabel(/^Tirador/).selectOption('home1')
  failSave=true;await save().click();await page.getByRole('alert').getByText(/Fixture event save failed/).waitFor()
  assert.equal(await page.getByLabel(/^Tirador/).inputValue(),'home1');assert.equal(await page.getByLabel('Tempo no período',{exact:true}).inputValue(),'0:42');await shot('save-error')
  failSave=false;await save().click();await idle()
  failRead=true;await page.reload();await page.getByRole('alert').getByText(/Fixture event load failed/).waitFor()
  assert.equal(await page.getByText('Aínda non hai eventos.',{exact:true}).count(),0);await shot('load-error')
  failRead=false;await page.getByRole('button',{name:'Recargar datos',exact:true}).click();await idle()
 })
 await t.test('sequence handles one/eight/more, previous expansion, multiple sources and real edit focus',async()=>{
  events=[fact('only')];roles.set('only',[{participant_id:'home1',role:'shooter'}]);await start();assert.equal(await page.locator('.timeline-event').count(),1)
  await shot('multiple-video-sources')
  events=Array.from({length:8},(_,i)=>fact(`seq${i}`,'shot',i*2));await start();assert.equal(await page.locator('.timeline-event').count(),8)
  events=Array.from({length:12},(_,i)=>fact(`seq${i}`,'shot',i*2));await start();assert.equal(await page.locator('.timeline-event').count(),8)
  await page.getByRole('button',{name:'Mostrar 4 anteriores',exact:true}).click();assert.equal(await page.locator('.timeline-event').count(),12)
  const row=page.locator('.timeline-event').first();await row.getByRole('button',{name:'Editar',exact:true}).click();await page.getByRole('button',{name:'Gardar cambios'}).waitFor()
  assert.equal(await row.getByText('En edición',{exact:true}).count(),1)
  for(const [width,height] of [[1440,900],[320,568]]){
   await page.setViewportSize({width,height})
   const geometry=await page.locator('.tagging-capture-card').evaluate(capture=>{
    const style=getComputedStyle(capture),editor=capture.querySelector('.capture-editor').getBoundingClientRect()
    const fields=capture.querySelector('.capture-fields').getBoundingClientRect(),pitch=capture.querySelector('.event-coordinate-sections').getBoundingClientRect()
    return {available:capture.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),editorWidth:editor.width,
     separate:fields.right<=pitch.left+1||pitch.right<=fields.left+1||fields.bottom<=pitch.top+1||pitch.bottom<=fields.top+1,
     contained:fields.left>=editor.left-1&&fields.right<=editor.right+1&&pitch.left>=editor.left-1&&pitch.right<=editor.right+1}
   })
   assert.ok(Math.abs(geometry.editorWidth-geometry.available)<=2,`editing uses capture width without an empty command column at ${width}`)
   assert.ok(geometry.separate&&geometry.contained,`editing fields and pitch fit without overlap at ${width}`)
   await noOverflow()
   if(width===320)await shot('editing-event-mobile-320')
  }
  await page.setViewportSize({width:1440,height:900});await shot('editing-event')
  await page.getByRole('button',{name:'Gardar cambios'}).click();await idle();assert.equal(await row.getByText('En edición',{exact:true}).count(),0)
  assert.equal(await row.getByRole('button',{name:'Editar',exact:true}).evaluate(e=>e===document.activeElement),true)
 })
 await t.test('video hides/unmounts playback, preserves all providers and seeks, unavailable media is explicit',async()=>{
  await page.locator('video').evaluate(async v=>{await v.play()})
  const playing=await page.locator('video').elementHandle();await page.getByRole('button',{name:'Ocultar vídeo'}).click()
  assert.equal(await page.locator('video').count(),0);assert.equal(await playing.evaluate(v=>v.isConnected),false)
  await page.waitForFunction(v=>v.paused,playing)
  assert.equal(await page.getByRole('button',{name:'Mostrar vídeo'}).evaluate(e=>e===document.activeElement),true)
  await page.getByRole('button',{name:'Mostrar vídeo'}).click();assert.equal(await page.getByRole('button',{name:'Ocultar vídeo'}).evaluate(e=>e===document.activeElement),true);await page.locator('.timeline-event').first().getByRole('button',{name:/Ir ao vídeo: Cámara principal/}).click()
  await page.waitForFunction(()=>Math.abs(document.querySelector('video').currentTime-10)<.1)
  await page.getByLabel('Fonte de vídeo').selectOption('youtube');assert.match(await page.locator('iframe').getAttribute('src'),/youtube-nocookie/)
  await page.getByLabel('Fonte de vídeo').selectOption('external');assert.equal(await page.locator('iframe').count(),0);await page.getByText(/Esta fonte ábrese no provedor/).waitFor()
  await page.getByLabel('Fonte de vídeo').selectOption('broken');await page.getByRole('alert').getByText(/Non foi posible cargar o vídeo/).waitFor();await shot('video-unavailable')
  await page.getByLabel('Fonte de vídeo').selectOption('direct')
 })
 await t.test('visual responsive matrix, readable names, mobile action selector and text zoom',async()=>{
  await page.setViewportSize({width:1366,height:768});await start();await noOverflow();await measure('shot-video-1366');await shot('shot-video-1366')
  await page.getByRole('button',{name:'Ocultar vídeo'}).click();await select('pass');await measure('pass-no-video-1366');await shot('pass-no-video-1366')
  const names=[home.name,away.name,...people.map(p=>p.display_name_snapshot)]
  home.name='Asociación Deportiva de Fútbol Gaélico da Costa Atlántica';away.name='Clube Universitario de Fútbol Gaélico de Santiago de Compostela'
  people.forEach((p,i)=>{p.display_name_snapshot=`María Antía Fernández Rodríguez ${i+1}`})
  roles.set('seq11',[{participant_id:'home1',role:'shooter'}])
  await start();await page.getByLabel(/^Tirador/).selectOption('home1');await noOverflow();await shot('long-names-1366')
  for(const [width,height,name]of [[1280,800,'desktop-1280'],[1024,768,'tablet-1024'],[768,1024,'tablet-768'],[430,932,'mobile-430'],[360,800,'mobile-360'],[390,844,'shot-mobile-390'],[320,568,'long-names-mobile-320']]){
   await page.setViewportSize({width,height});await noOverflow();await measure(name);await shot(name)
  }
  home.name=names[0];away.name=names[1];people.forEach((p,i)=>{p.display_name_snapshot=names[i+2]})
  await page.setViewportSize({width:390,height:844});await start();await shot('shot-mobile-390')
  await page.getByRole('button',{name:'Ocultar vídeo'}).click();await select('foul');await shot('foul-mobile-390')
  await page.getByRole('button',{name:'Mostrar vídeo'}).click();await shot('video-open-mobile-390')
  await page.getByRole('button',{name:'Mostrar 4 anteriores',exact:true}).click();await shot('timeline-expanded-mobile-390')
  await page.setViewportSize({width:320,height:568});await select('shot');await shot('shot-mobile-320')
  await page.getByLabel('Acción',{exact:true}).focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter')
  await noOverflow();await shot('action-selector-mobile-320')
  if(screenshotDir){await page.getByLabel('Acción',{exact:true}).click();await page.screenshot({path:`${screenshotDir}/action-selector-open-320.png`});await page.keyboard.press('Escape')}
  for(const [width,height]of [[1440,900],[390,844],[320,568]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>document.documentElement.style.fontSize='200%');await page.getByLabel('Tempo no período',{exact:true}).fill('18:42');await noOverflow();assert.ok(await page.getByLabel('Tempo no período',{exact:true}).evaluate(e=>e.scrollWidth<=e.clientWidth),'event time remains readable at 200%');await measure(`text-200-${width}`)
   for(const row of await page.locator('.timeline-event').all()){
    assert.ok(await row.evaluate(e=>{const range=document.createRange();range.selectNodeContents(e.querySelector('.timeline-event-time strong'));const time=range.getBoundingClientRect(),summary=e.querySelector('.timeline-event-main').getBoundingClientRect();return time.right<=summary.left+1||time.bottom<=summary.top+1}),`timeline time does not overlap summary at ${width}`)
   }
   await shot(`tagging-text-200-${width}`)
   if(width===1440){
    for(const group of await page.locator('.event-type-group').all()){
     const box=await group.boundingBox(),legend=await group.locator('legend').boundingBox()
     assert.ok(legend.x+legend.width<=box.x+box.width+1,'enlarged category stays within its group')
    }
    if(screenshotDir)await page.locator('.event-type-controls').screenshot({path:`${screenshotDir}/groups-text-200.png`})
   }
   await page.evaluate(()=>document.documentElement.style.fontSize='')
  }
 })
 await t.test('completed keeps full sequence/video without editable event controls',async()=>{
  await page.setViewportSize({width:1440,height:900});status='completed';await page.reload();await page.getByRole('button',{name:'Reabrir análise',exact:true}).waitFor()
  assert.equal(await capture().count(),0);assert.equal(await page.getByLabel('Acción',{exact:true}).count(),0)
  assert.equal(await page.locator('.timeline-event').count(),12);assert.equal(await page.getByRole('button',{name:'Editar',exact:true}).first().isDisabled(),true)
  await shot('completed-dark')
 })
 assert.deepEqual(errors,[])
 if(screenshotDir)await writeFile(`${screenshotDir}/measurements.json`,JSON.stringify(measures,null,2)+'\n')
})
