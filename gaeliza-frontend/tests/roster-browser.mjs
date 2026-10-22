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
 let participants=Array.from({length:10},(_,i)=>player(i+1)),status='draft',failWrite=false
 const writes=[]
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url())
  if(url.origin!==origin)return route.abort()
  if(req.isNavigationRequest())return route.fulfill({contentType:'text/html',body:html})
  if(!url.pathname.startsWith('/rest/v1/'))return route.continue()
  const reply=(data,code=200)=>route.fulfill({status:code,contentType:'application/json',body:JSON.stringify(data)})
  if(url.pathname.endsWith('/analyses'))return reply({id:'analysis',title:null,mode:'post_match',status,match_id:'match',match:{id:'match',scheduled_at:null,home_team:home,away_team:away}})
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
  if(url.pathname.endsWith('/analysis_periods'))return reply([{id:'period',number:1,name:null,expected_duration_seconds:1800,home_attacks_towards:'right'}])
  if(['/analysis_videos','/video_sync_points'].some(x=>url.pathname.endsWith(x)))return reply([])
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
  await page.evaluate(()=>scrollTo(0,900))
  const box=await page.getByRole('button',{name:'Continuar',exact:true}).boundingBox()
  assert.ok(box.y>=64&&box.y+box.height<=1100)
  await shot('desktop-long-roster')
  await visitor.getByLabel('Nome ou etiqueta').fill('Borrador ao volver')
  await page.getByRole('button',{name:'Continuar',exact:true}).click()
  assert.equal(new URL(page.url()).searchParams.get('step'),'video')
  await page.getByText(/Indica en que instante do vídeo comeza este período/).waitFor()
  await page.getByRole('button',{name:'Convocatoria',exact:true}).click()
  assert.equal(await visitor.getByLabel('Nome ou etiqueta').inputValue(),'Borrador ao volver')
 })
 await t.test('tablet/mobile stack teams without overflow and preserve keyboard access',async()=>{
  for(const width of [900,390]){
   await page.setViewportSize({width,height:844});await page.evaluate(()=>scrollTo(0,0))
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   assert.equal(await page.locator('.roster-navigation').evaluate(e=>getComputedStyle(e).position),'static')
   assert.ok((await visitor.boundingBox()).y>(await local.boundingBox()).y)
  }
  await shot('mobile')
  await visitor.getByLabel('Nome ou etiqueta').focus()
  assert.equal(await visitor.getByLabel('Nome ou etiqueta').evaluate(e=>document.activeElement===e),true)
 })
 await t.test('large available roster bounded; completed blocks mutations but allows video review',async()=>{
  participants=[];status='completed';await go()
  assert.equal(await local.locator('.available-player-list-scroll').count(),1)
  assert.ok((await local.locator('.available-player-list-scroll').boundingBox()).height<=264)
  assert.equal(await local.locator('.available-player').first().isDisabled(),true)
  assert.equal(await visitor.getByLabel('Nome ou etiqueta').isDisabled(),true)
  await page.getByRole('button',{name:'Continuar',exact:true}).click()
  assert.equal(new URL(page.url()).searchParams.get('step'),'video')
 })
 assert.deepEqual(errors,[])
})
