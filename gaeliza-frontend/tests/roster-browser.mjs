import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import test from 'node:test'
import { startBrowserHarness } from './helpers/browser-harness.mjs'
const screenshotDir=process.env.ROSTER_SCREENSHOT_DIR
const team=(id,name)=>({id,name,short_name:null,logo_path:null})
const home=team('home','GB Lorchos'),away=team('away','Atlántico Demo')
const player=n=>({id:`p${n}`,team_id:'home',player_id:`player${n}`,display_name_snapshot:`Xogador ${String(n).padStart(2,'0')}`,number:n,starter:true,initial_goalkeeper:n===1,position:n===1?'Goalkeeper':'Defender'})
test('roster ergonomics with real page and data layer',async(t)=>{
 const {browser,origin,html}=await startBrowserHarness(t,{name:'roster',port:5199,source:`
 import React from 'react';import {createRoot} from 'react-dom/client'
 import {BrowserRouter,Routes,Route} from 'react-router-dom'
 import {AuthContext} from '/src/v2/auth/auth-context';import {AppShell} from '/src/v2/components/AppShell'
 import {AnalysisWorkspacePage} from '/src/v2/pages/AnalysisWorkspacePage'
 import '/src/v2/styles/global.css';import '/src/v2/styles/analysis-setup.css';import '/src/v2/styles/analysis-workspace.css';import '/src/v2/styles/video-sync.css';import '/src/v2/styles/tagging.css'
 const auth={session:{user:{id:'owner',is_anonymous:true}},status:'ready',error:null,isAnonymous:true,ensureGuestSession:async()=>{},retrySession:()=>{},signOut:async()=>{}}
 createRoot(document.getElementById('root')).render(<AuthContext.Provider value={auth}><BrowserRouter><Routes><Route path="/app" element={<AppShell/>}><Route path="analyses/:analysisId" element={<AnalysisWorkspacePage/>}/></Route></Routes></BrowserRouter></AuthContext.Provider>)
 `})
 const page=await browser.newPage({viewport:{width:1440,height:1100},colorScheme:'dark'});page.setDefaultTimeout(5000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 let videos=[],points=[],direction='right',mode='post_match'
 let participants=Array.from({length:10},(_,i)=>player(i+1)),status='draft',failWrite=false
 const writes=[]
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url())
  if(url.origin!==origin)return route.abort()
  if(req.isNavigationRequest())return route.fulfill({contentType:'text/html',body:html})
  if(!url.pathname.startsWith('/rest/v1/'))return route.continue()
  const reply=(data,code=200)=>route.fulfill({status:code,contentType:'application/json',body:JSON.stringify(data)})
  if(url.pathname.endsWith('/analyses'))return reply({id:'analysis',title:null,mode,status,match_id:'match',match:{id:'match',scheduled_at:null,home_team:home,away_team:away}})
  if(url.pathname.endsWith('/analysis_participants')){
   if(req.method()==='POST'){
    const input=req.postDataJSON();writes.push(input)
    assert.equal(input.analysis_id,'analysis')
    if(failWrite)return reply({message:'Fixture write failed'},400)
    participants.push({id:`new${writes.length}`,position:null,...input});return reply(null,201)
   }
   if(req.method()==='DELETE'){
    const id=url.searchParams.get('id').slice(3);participants=participants.filter(p=>p.id!==id);return reply(null)
   }
   return reply(participants)
  }
  if(url.pathname.endsWith('/team_players'))return reply(Array.from({length:12},(_,i)=>({team_id:'home',default_number:i+1,player:{id:`player${i+1}`,first_name:`Xogador ${String(i+1).padStart(2,'0')}`,last_name:null,primary_position:'Defender'}})))
  if(url.pathname.endsWith('/analysis_periods')){
   if(req.method()==='PATCH'){direction=req.postDataJSON().home_attacks_towards;return reply(null)}
   return reply([{id:'period',number:1,name:null,expected_duration_seconds:1800,home_attacks_towards:direction}])
  }
  if(url.pathname.endsWith('/analysis_videos')||url.pathname.endsWith('/video_sync_points')){
   const isVideo=url.pathname.endsWith('/analysis_videos'),rows=isVideo?videos:points
   if(req.method()==='POST'){
    const input=req.postDataJSON();writes.push(input)
    if(failWrite)return reply({message:'Fixture write failed'},400)
    rows.push({id:`item${writes.length}`,...input});return reply(null,201)
   }
   if(req.method()==='DELETE'){
    const id=url.searchParams.get('id').slice(3)
    if(isVideo){videos=videos.filter(v=>v.id!==id);points=points.filter(p=>p.analysis_video_id!==id)}else points=points.filter(p=>p.id!==id)
    return reply(null)
   }
   return reply(rows)
  }
  throw new Error(`Unexpected request ${req.method()} ${url.pathname}`)
 })
 const region=name=>page.getByRole('region',{name:`Convocatoria de ${name}`,exact:true})
 const local=region(home.name),visitor=region(away.name)
 const go=async()=>{await page.goto(`${origin}/app/analyses/analysis?step=roster`);await local.waitFor()}
 const saved=async()=>{await page.getByText('Gardado',{exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.workspace-fields').disabled)}
 const shot=async name=>{if(screenshotDir){await mkdir(screenshotDir,{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${screenshotDir}/${name}.png`,fullPage:true})}}
 await go()
 await t.test('ten compact rows and empty rival with immediate team form',async()=>{
  assert.equal(await local.locator('.participant-row').count(),10)
  for(const row of await local.locator('.participant-row').all())assert.ok((await row.boundingBox()).height<=52)
  assert.equal(await local.getByText('10 convocados',{exact:true}).count(),1)
  await visitor.getByText('Aínda non hai xogadores convocados.').waitFor()
  assert.equal(await visitor.getByText('0 convocados',{exact:true}).count(),1)
  assert.ok((await visitor.getByLabel('Nome ou etiqueta').boundingBox()).y<600)
  assert.equal(await local.locator('.available-player').count(),2)
  assert.equal(await local.locator('.available-player-list-scroll').count(),0)
  await shot('desktop-empty-rival')
 })
 await t.test('add persistent player and remove updates counts and available roster',async()=>{
  await local.getByRole('button',{name:/Xogador 11.*Engadir/}).click();await saved()
  assert.equal(writes.at(-1).player_id,'player11')
  assert.equal(await local.getByText('11 convocados',{exact:true}).count(),1)
  await local.getByRole('button',{name:'Quitar Xogador 11',exact:true}).click();await saved()
  await local.getByText('10 convocados',{exact:true}).waitFor()
  assert.equal(await local.locator('.available-player').count(),2)
 })
 await t.test('temporary identity goes to its own team; other team draft is preserved',async()=>{
  await local.getByLabel('Nome ou etiqueta').fill('Local temporal')
  await visitor.getByLabel('Nome ou etiqueta').fill('Visitante temporal')
  await local.getByLabel(/^Dorsal/).fill('19')
  await local.getByRole('button',{name:'Engadir temporal'}).click();await saved()
  assert.equal(writes.at(-1).team_id,'home');assert.equal(writes.at(-1).player_id,null)
  assert.equal(writes.at(-1).number,19)
  assert.equal(await visitor.getByLabel('Nome ou etiqueta').inputValue(),'Visitante temporal')
  await visitor.getByRole('button',{name:'Engadir temporal'}).click();await saved()
  assert.equal(writes.at(-1).team_id,'away');assert.equal(writes.at(-1).number,null)
  await visitor.getByText('1 convocado',{exact:true}).waitFor()
  await local.getByText('11 convocados',{exact:true}).waitFor()
  await shot('desktop-both-teams')
 })
 await t.test('failed temporary write retains draft for retry',async()=>{
  await visitor.getByLabel('Nome ou etiqueta').fill('Conservar borrador');failWrite=true
  await visitor.getByRole('button',{name:'Engadir temporal'}).click()
  await page.getByText(/Fixture write failed/).waitFor()
  assert.equal(await visitor.getByLabel('Nome ou etiqueta').inputValue(),'Conservar borrador')
  failWrite=false;await visitor.getByRole('button',{name:'Engadir temporal'}).click();await saved()
  assert.equal(await visitor.getByLabel('Nome ou etiqueta').inputValue(),'')
 })
 await t.test('long roster keeps Continue in viewport and navigation reaches video setup',async()=>{
  participants=[...Array.from({length:30},(_,i)=>player(i+1)),...participants.filter(p=>p.team_id==='away')];await go()
  await page.getByRole('navigation',{name:'Ir á convocatoria dun equipo'}).getByRole('link',{name:/Atlántico/}).focus()
  await page.keyboard.press('Enter')
  assert.equal(await page.locator('#roster-away').evaluate(e=>e===document.activeElement),true)
  await visitor.getByRole('link',{name:'Volver a Continuar'}).click()
  const box=await page.getByRole('button',{name:'Continuar',exact:true}).boundingBox()
  assert.ok(box.y>=0&&box.y+box.height<=1100)
  await shot('desktop-long-roster')
  await visitor.getByLabel('Nome ou etiqueta').fill('Borrador ao volver')
  await page.getByRole('button',{name:'Continuar',exact:true}).click()
  assert.equal(new URL(page.url()).searchParams.get('step'),'video')
  await page.getByText(/Indica en que instante do vídeo comeza este período/).waitFor()
  await page.getByRole('button',{name:'Convocatoria',exact:true}).click()
  assert.equal(await visitor.getByLabel('Nome ou etiqueta').inputValue(),'Borrador ao volver')
 })
 await t.test('tablet/mobile stack teams without overflow and preserve keyboard access',async()=>{
  for(const [width,height] of [[1440,900],[1366,768],[1024,768],[768,1024],[430,932],[390,844],[360,800],[320,568]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0))
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   assert.equal(await page.locator('.roster-navigation').evaluate(e=>getComputedStyle(e).position),'static')
   if(width<1001)assert.ok((await visitor.boundingBox()).y>(await local.boundingBox()).y)
   await page.getByRole('navigation',{name:'Ir á convocatoria dun equipo'}).getByRole('link',{name:/Atlántico/}).click()
   await visitor.getByRole('link',{name:'Ir a GB Lorchos'}).click()
   assert.equal(await page.locator('#roster-home').evaluate(e=>e===document.activeElement),true)
  }
  await shot('mobile')
  await visitor.getByLabel('Nome ou etiqueta').focus()
  assert.equal(await visitor.getByLabel('Nome ou etiqueta').evaluate(e=>document.activeElement===e),true)
 })
 await t.test('available players stay in document flow; completed blocks mutations but allows video review',async()=>{
  participants=[];status='completed';await go()
  assert.equal(await local.locator('.available-player-list-scroll').count(),0)
  assert.equal(await local.locator('.available-player').first().isDisabled(),true)
  assert.equal(await visitor.getByLabel('Nome ou etiqueta').isDisabled(),true)
  await page.getByRole('button',{name:'Continuar',exact:true}).click()
  assert.equal(new URL(page.url()).searchParams.get('step'),'video')
 })

 await t.test('long names wrap at narrow sizes without hiding team navigation',async()=>{
  status='draft';participants=[{...player(1),display_name_snapshot:'María Antía Fernández Rodríguez de Santiago de Compostela'}];await go()
  for(const [width,height] of [[1440,900],[1366,768],[1024,768],[768,1024],[430,932],[390,844],[360,800],[320,568]]){
   await page.setViewportSize({width,height})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   await local.getByText('María Antía Fernández Rodríguez de Santiago de Compostela',{exact:true}).waitFor()
  }
  const originalName=home.name;home.name='Asociación Deportiva de Fútbol Gaélico da Costa Atlántica'
  await page.reload();await page.getByRole('heading',{name:home.name,exact:true}).waitFor()
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await shot('roster-long-names-mobile')
  home.name=originalName;await go()
 })
 await t.test('enlarged roster numbers do not overlap identities',async()=>{
  participants=[{...player(1),number:123,position:'Posición histórica longa'}];await go()
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='30px')
   const row=local.locator('.participant-row').first()
   assert.ok(await row.evaluate(e=>{const number=e.querySelector('.participant-number'),identity=e.querySelector('.participant-identity');const range=document.createRange();range.selectNodeContents(number);return range.getBoundingClientRect().right<=identity.getBoundingClientRect().left}),`number must not overlap name at ${width}`)
   await shot(`roster-text-200-${width}`)
   await page.evaluate(()=>document.documentElement.style.fontSize='')
  }
 })
 await t.test('video sources retain optional duration, URL validation, sort order and failed drafts',async()=>{
  await page.getByRole('button',{name:'Continuar',exact:true}).click()
  await page.getByText('Aínda non hai vídeo.',{exact:true}).waitFor()
  await page.getByLabel('URL do vídeo',{exact:true}).fill('ftp://example.test/a')
  await page.getByRole('button',{name:'Engadir vídeo',exact:true}).click()
  await page.getByRole('alert').getByText(/URL http ou https/).waitFor()
  await page.getByLabel('URL do vídeo',{exact:true}).fill('https://example.test/a')
  await page.getByLabel(/^Título/).fill('Cámara principal')
  await page.getByLabel(/^Duración/).fill('bad')
  await page.getByRole('button',{name:'Engadir vídeo',exact:true}).click()
  await page.getByRole('alert').getByText(/A duración debe ser un tempo válido/).waitFor()
  await page.getByLabel(/^Duración/).fill('10:00')
  failWrite=true;await page.getByRole('button',{name:'Engadir vídeo',exact:true}).click()
  await page.getByText(/Fixture write failed/).waitFor()
  assert.equal(await page.getByLabel(/^Título/).inputValue(),'Cámara principal')
  failWrite=false;await page.getByRole('button',{name:'Engadir vídeo',exact:true}).click();await saved()
  assert.equal(videos[0].duration_seconds,600);assert.equal(videos[0].sort_order,0)
  await page.getByText('Aínda non hai puntos de sincronización.',{exact:true}).waitFor()
  await page.getByLabel('URL do vídeo',{exact:true}).fill('https://example.test/b')
  await page.getByLabel(/^Título/).fill('Cámara visitante cun nome longo para identificar a gravación completa')
  await page.getByRole('button',{name:'Engadir vídeo',exact:true}).click();await saved()
  assert.equal(videos[1].duration_seconds,null);assert.equal(videos[1].sort_order,1)
 })
 await t.test('clock pair preserves validation, fractional video precision and points after cuts',async()=>{
  const videoClock=page.getByRole('group',{name:'Reloxo do vídeo',exact:true}),matchClock=page.getByRole('group',{name:'Reloxo do partido',exact:true})
  await videoClock.getByLabel('Tempo no vídeo',{exact:true}).fill('bad')
  await matchClock.getByLabel('Tempo no período',{exact:true}).fill('0:00')
  await page.getByRole('button',{name:'Engadir punto',exact:true}).click()
  await page.getByRole('alert').getByText(/Usa tempos válidos/).waitFor()
  await videoClock.getByLabel('Tempo no vídeo',{exact:true}).fill('10:01')
  await page.getByRole('button',{name:'Engadir punto',exact:true}).click()
  await page.getByRole('alert').getByText(/supera a duración coñecida/).waitFor()
  await videoClock.getByLabel('Tempo no vídeo',{exact:true}).fill('3:42.250')
  await matchClock.getByLabel('Tempo no período',{exact:true}).fill('0.5')
  await page.getByRole('button',{name:'Engadir punto',exact:true}).click()
  await page.getByRole('alert').getByText(/Usa tempos válidos/).waitFor()
  await matchClock.getByLabel('Tempo no período',{exact:true}).fill('30:01')
  await page.getByRole('button',{name:'Engadir punto',exact:true}).click()
  await page.getByRole('alert').getByText(/supera a duración configurada/).waitFor()
  await matchClock.getByLabel('Tempo no período',{exact:true}).fill('0:00')
  await page.getByRole('button',{name:'Engadir punto',exact:true}).click();await saved()
  assert.equal(points[0].video_second,222.25);assert.equal(points[0].second_in_period,0)
  await page.getByText('3:42.25',{exact:true}).waitFor()
  await videoClock.getByLabel('Tempo no vídeo',{exact:true}).fill('5:00')
  await matchClock.getByLabel('Tempo no período',{exact:true}).fill('1:00')
  await page.getByRole('button',{name:'Engadir punto',exact:true}).click();await saved()
  assert.equal(points.length,2);assert.equal(points[1].second_in_period,60)
  await page.getByLabel('Dirección do período 1',{exact:true}).selectOption('left');await saved();assert.equal(direction,'left')
  await page.getByRole('button',{name:'Quitar punto de Cámara principal en 5:00',exact:true}).click();await saved();assert.equal(points.length,1)
  for(const [width,height] of [[1440,900],[1366,768],[1024,768],[768,1024],[430,932],[390,844],[360,800],[320,568]]){
   await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  }
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:900});await page.evaluate(()=>document.documentElement.style.fontSize='200%')
   await videoClock.getByLabel('Tempo no vídeo',{exact:true}).fill('3:42.25')
   assert.ok(await videoClock.getByLabel('Tempo no vídeo',{exact:true}).evaluate(e=>e.scrollWidth<=e.clientWidth),`fractional clock fully readable at ${width}`)
   for(const clock of await page.locator('.sync-clock-pair strong').all())assert.ok(await clock.evaluate(e=>e.getBoundingClientRect().height<=parseFloat(getComputedStyle(e).lineHeight)+1),'saved clock stays on one line')
   await shot(`sync-text-200-${width}`)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`200% text at ${width}: ${await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth).map(e=>[e.tagName,e.className,e.getBoundingClientRect().width]).slice(-15))}`)
   await page.evaluate(()=>document.documentElement.style.fontSize='')
  }
  await shot('video-sync-mobile')
  await page.setViewportSize({width:1440,height:900});await shot('video-sync-desktop')
  await page.getByRole('button',{name:'Cambiar a tema claro'}).click();await shot('video-sync-light')
  await page.getByRole('button',{name:'Cambiar a tema escuro'}).click()
 })
 await t.test('completed video keeps links and navigation but disables every mutation',async()=>{
  status='completed';await page.reload();await page.getByRole('heading',{name:'Fontes da análise',exact:true}).waitFor()
  for(const name of ['Engadir vídeo','Engadir punto','Quitar vídeo Cámara principal'])assert.equal(await page.getByRole('button',{name,exact:true}).isDisabled(),true)
  assert.equal(await page.getByLabel('Dirección do período 1',{exact:true}).isDisabled(),true)
  assert.equal(await page.getByRole('button',{name:'Comezar tagging',exact:true}).isEnabled(),true)
  assert.equal(await page.getByRole('link',{name:'Abrir vídeo',exact:true}).count(),2)
  status='draft';await page.reload();await page.getByRole('heading',{name:'Fontes da análise',exact:true}).waitFor()
  await page.getByRole('button',{name:'Quitar vídeo Cámara principal',exact:true}).click();await saved()
  assert.equal(videos.length,1);assert.equal(points.length,0)
  await page.getByRole('button',{name:'← Convocatoria',exact:true}).click();await local.waitFor()
 })

 await t.test('live without video stays navigable and unknown sync references remain explicit',async()=>{
  videos=[];points=[{id:'orphan',analysis_video_id:'missing',analysis_period_id:'missing',video_second:0,second_in_period:0}];mode='live'
  await go();await page.getByRole('button',{name:'Continuar',exact:true}).click()
  await page.getByText('Vídeo descoñecido',{exact:true}).waitFor()
  await page.getByText(/Período descoñecido · Tempo no período/).waitFor()
  await page.getByText('Captura rápida en directo e enriquecemento posterior.',{exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'Comezar tagging',exact:true}).isEnabled(),true)
 })
 assert.deepEqual(errors,[])
})
