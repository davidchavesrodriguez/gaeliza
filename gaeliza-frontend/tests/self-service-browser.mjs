// Real pages/data modules against a local transport fixture. No remote Supabase.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import test from 'node:test'
import { startBrowserHarness } from './helpers/browser-harness.mjs'
const screenshotDir=process.env.SETUP_SCREENSHOT_DIR
const owner='00000000-0000-0000-0000-000000000001'
test('self-service new analysis from an empty guest account',async(t)=>{
 const {browser,origin,html}=await startBrowserHarness(t,{name:'self-service',port:5201,source:`
 import React from 'react';import {createRoot} from 'react-dom/client'
 import {BrowserRouter,Routes,Route} from 'react-router-dom'
 import {AuthContext} from '/src/v2/auth/auth-context';import {supabase} from '/src/v2/lib/supabase'
 import {AppShell} from '/src/v2/components/AppShell';import {CreateAnalysisPage} from '/src/v2/pages/CreateAnalysisPage'
 import {AnalysisWorkspacePage} from '/src/v2/pages/AnalysisWorkspacePage'
 import {initializeTheme} from '/src/v2/domain/theme'
 import '/src/v2/styles/global.css';import '/src/v2/styles/analysis-setup.css';import '/src/v2/styles/analysis-workspace.css';import '/src/v2/styles/video-sync.css';import '/src/v2/styles/tagging.css'
 initializeTheme();const user={id:${JSON.stringify(owner)},is_anonymous:true}
 // Identity transport is controlled; all table/RPC traffic uses the real data layer.
 supabase.auth.getUser=async()=>({data:{user},error:null})
 const auth={session:{user},status:'ready',error:null,isAnonymous:true,ensureGuestSession:async()=>({user}),retrySession:()=>{},signOut:async()=>{}}
 createRoot(document.getElementById('root')).render(<AuthContext.Provider value={auth}><BrowserRouter><Routes><Route path="/app" element={<AppShell/>}><Route path="new" element={<CreateAnalysisPage/>}/><Route path="analyses/:analysisId" element={<AnalysisWorkspacePage/>}/></Route></Routes></BrowserRouter></AuthContext.Provider>)
 `})
 const page=await browser.newPage({viewport:{width:1440,height:1100},timezoneId:'Europe/Madrid',colorScheme:'dark'});page.setDefaultTimeout(5000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 const teams=[],players=[],matches=[],analyses=[],writes=[]
 let failTeam=false,failPlayer=false,holdMatch=null
 const reply=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
 const rawTeam=t=>({...t,logo_path:null})
 const rawMatch=m=>({...m,home_team:rawTeam(teams.find(t=>t.id===m.home_team_id)),away_team:rawTeam(teams.find(t=>t.id===m.away_team_id)),competition_edition:null})
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url())
  if(url.origin!==origin)return route.abort()
  if(req.isNavigationRequest())return route.fulfill({contentType:'text/html',body:html})
  if(!url.pathname.startsWith('/rest/v1/'))return route.continue()
  if(url.pathname.endsWith('/teams')){
   if(req.method()==='POST'){
    const input=req.postDataJSON();writes.push({kind:'team',input})
    assert.equal(input.owner_user_id,owner);assert.equal(input.scope,'personal');assert.equal(input.club_id,null);assert.equal(input.default_venue_id,null)
    if(failTeam)return reply(route,{message:'Fixture team rejected'},400)
    const team={id:`team${teams.length+1}`,...input};teams.push(team);return reply(route,team,201)
   }
   assert.equal(url.searchParams.get('or'),`(scope.eq.official,owner_user_id.eq.${owner})`)
   const term=(url.searchParams.get('name')??'').replace(/^ilike\.%|%$/g,'').toLowerCase()
   const filtered=teams.filter(t=>(t.scope==='official'||t.owner_user_id===owner)&&t.name.toLowerCase().includes(term))
   return reply(route,filtered.slice(Number(url.searchParams.get('offset')??0),Number(url.searchParams.get('offset')??0)+Number(url.searchParams.get('limit')??31)))
  }
  if(url.pathname.endsWith('/rpc/create_team_player')){
   const input=req.postDataJSON();writes.push({kind:'player',input})
   if(failPlayer)return reply(route,{message:'Fixture membership rejected'},400)
   const p={id:`player${players.length+1}`,team_id:input.p_team_id,default_number:input.p_default_number,first_name:input.p_first_name,last_name:input.p_last_name,primary_position:input.p_primary_position};players.push(p)
   return reply(route,p.id)
  }
  if(url.pathname.endsWith('/team_players')){
   const filter=url.searchParams.get('team_id')
   const visible=players.filter(p=>filter.startsWith('eq.')?p.team_id===filter.slice(3):filter.includes(p.team_id))
   return reply(route,visible.map(p=>({team_id:p.team_id,default_number:p.default_number,player:p})))
  }
  if(url.pathname.endsWith('/rpc/create_personal_match_analysis')){
   const input=req.postDataJSON();writes.push({kind:'match',input})
   if(holdMatch)await holdMatch
   const m={id:`match${matches.length+1}`,scope:'personal',status:'scheduled',home_team_id:input.p_home_team_id,away_team_id:input.p_away_team_id,scheduled_at:input.p_scheduled_at,round_label:input.p_round_label,round_number:null};matches.push(m)
   const a={id:`analysis${analyses.length+1}`,match_id:m.id,mode:input.p_mode,status:'draft',title:null};analyses.push(a)
   return reply(route,{match_id:m.id,analysis_id:a.id})
  }
  if(url.pathname.endsWith('/rpc/create_analysis')){
   const input=req.postDataJSON();writes.push({kind:'existing',input})
   const a={id:`analysis${analyses.length+1}`,match_id:input.p_match_id,mode:input.p_mode,status:'draft',title:null};analyses.push(a);return reply(route,a.id)
  }
  if(url.pathname.endsWith('/matches'))return reply(route,matches.map(rawMatch))
  if(url.pathname.endsWith('/analyses')){
   const a=analyses.find(a=>a.id===url.searchParams.get('id').slice(3)),m=rawMatch(matches.find(m=>m.id===a.match_id));return reply(route,{...a,match:m})
  }
  if(url.pathname.endsWith('/analysis_periods'))return reply(route,[{id:'period1',number:1,name:null,expected_duration_seconds:1800,home_attacks_towards:null},{id:'period2',number:2,name:null,expected_duration_seconds:1800,home_attacks_towards:null}])
  if(['/analysis_participants','/analysis_videos','/video_sync_points'].some(p=>url.pathname.endsWith(p)))return reply(route,[])
  throw new Error(`Unexpected ${req.method()} ${url.pathname}`)
 })
 const region=name=>page.getByRole('region',{name,exact:true})
 const home=region('Equipo local'),away=region('Equipo visitante')
 const homeRoster=region('Plantel de equipo local'),awayRoster=region('Plantel de equipo visitante')
 const choose=side=>side.getByRole('combobox',{name:/^Equipo/})
 const snap=async name=>{if(screenshotDir){await mkdir(screenshotDir,{recursive:true});await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)});await page.screenshot({path:`${screenshotDir}/${name}.png`,fullPage:true})}}
 const start=async()=>{await page.goto(`${origin}/app/new`);await page.getByRole('heading',{name:'Nova análise',exact:true}).waitFor()}
 await start()
 await t.test('empty guest has an immediate route to create a first match and teams',async()=>{
  await page.getByText('Aínda non hai partidos dispoñibles.').waitFor();await snap('empty-user')
  await page.getByRole('button',{name:'Crear o primeiro partido'}).click()
  await home.getByText(/Non hai equipos nesta busca/).waitFor()
  assert.equal(await page.getByText('Modo invitado',{exact:true}).count(),1)
  assert.equal(await page.getByRole('button',{name:'Crear análise',exact:true}).isDisabled(),true)
 })
 await t.test('inline team drafts are independent; failed insert retains useful draft; new home selected',async()=>{
  await home.getByRole('button',{name:'Crear equipo persoal'}).click();await home.getByLabel('Nome do equipo',{exact:true}).fill('Meu equipo')
  await away.getByRole('button',{name:'Crear equipo persoal'}).click();await away.getByLabel('Nome do equipo',{exact:true}).fill('Rival')
  assert.equal(await home.getByLabel('Nome do equipo',{exact:true}).inputValue(),'Meu equipo')
  await snap('create-team')
  failTeam=true;await home.getByRole('button',{name:'Gardar equipo'}).click();await home.getByText(/Fixture team rejected/).waitFor()
  assert.equal(await home.getByLabel('Nome do equipo',{exact:true}).inputValue(),'Meu equipo')
  failTeam=false;await home.getByRole('button',{name:'Gardar equipo'}).click();await home.getByRole('button',{name:'Cambiar equipo'}).waitFor()
  assert.equal(await home.getByText('Meu equipo',{exact:true}).count(),1)
  assert.equal(await home.getByText('Persoal',{exact:true}).count(),1)
  assert.equal(await choose(home).count(),0)
  assert.equal(await home.getByRole('searchbox',{name:'Buscar equipo'}).count(),0)
  assert.equal(await home.getByRole('button',{name:'Crear equipo persoal'}).count(),0)
  assert.equal(await away.getByLabel('Nome do equipo',{exact:true}).inputValue(),'Rival')
 })
 await t.test('changing a selected team can be closed without losing selection or independent drafts',async()=>{
  await home.getByRole('button',{name:'Cambiar equipo'}).click()
  assert.equal(await choose(home).inputValue(),'team1')
  assert.equal(await home.getByRole('searchbox',{name:'Buscar equipo'}).evaluate(e=>e===document.activeElement),true)
  await home.getByRole('searchbox',{name:'Buscar equipo'}).fill('Meu')
  await home.getByRole('button',{name:'Pechar selección'}).click()
  assert.equal(await home.getByText('Meu equipo',{exact:true}).count(),1)
  assert.equal(await choose(home).count(),0)
  assert.equal(await home.getByRole('button',{name:'Cambiar equipo'}).evaluate(e=>e===document.activeElement),true)
  await home.getByRole('button',{name:'Cambiar equipo'}).click()
  assert.equal(await home.getByRole('searchbox',{name:'Buscar equipo'}).inputValue(),'Meu')
  assert.equal(await choose(home).inputValue(),'team1')
  assert.equal(await away.getByLabel('Nome do equipo',{exact:true}).inputValue(),'Rival')
  await home.getByRole('button',{name:'Crear equipo persoal'}).click()
  await home.getByLabel('Nome do equipo',{exact:true}).fill('Outro borrador')
  await home.getByRole('button',{name:'Volver á selección'}).click()
  assert.equal(await choose(home).inputValue(),'team1')
  assert.equal(await away.getByLabel('Nome do equipo',{exact:true}).inputValue(),'Rival')
  await home.getByRole('button',{name:'Pechar selección'}).click()
  assert.equal(await home.getByText('Meu equipo',{exact:true}).count(),1)
  await home.getByRole('button',{name:'Cambiar equipo'}).click()
  await home.getByRole('button',{name:'Crear equipo persoal'}).click()
  assert.equal(await home.getByLabel('Nome do equipo',{exact:true}).inputValue(),'Outro borrador')
  await home.getByRole('button',{name:'Volver á selección'}).click()
  await home.getByRole('button',{name:'Pechar selección'}).click()
 })
 await t.test('two persistent players added through atomic RPC, failure retains draft',async()=>{
  assert.equal(await page.locator('.setup-match-form').evaluate(form=>Boolean(form.compareDocumentPosition(document.querySelector('.setup-optional-rosters')) & Node.DOCUMENT_POSITION_FOLLOWING)),true)
  await homeRoster.getByRole('button',{name:'Xestionar plantel'}).click()
  const roster=homeRoster.getByRole('region',{name:'Plantel persistente'})
  const cta=await page.getByRole('button',{name:'Crear análise',exact:true}).boundingBox(),rosterBox=await homeRoster.boundingBox()
  assert.ok(cta.y+cta.height<=rosterBox.y)
  await roster.getByText('Aínda non hai xogadores.').waitFor()
  await roster.getByLabel('Nome',{exact:true}).fill('Ana');await roster.getByLabel('Apelidos (opcional)',{exact:true}).fill('García')
  await roster.getByLabel('Dorsal (opcional)',{exact:true}).fill('1');await roster.getByRole('combobox',{name:/^Posición/}).selectOption('Goalkeeper')
  failPlayer=true;await roster.getByRole('button',{name:'Engadir xogador'}).click();await roster.getByText(/Fixture membership rejected/).waitFor()
  assert.equal(await roster.getByLabel('Nome',{exact:true}).inputValue(),'Ana')
  failPlayer=false;await roster.getByRole('button',{name:'Engadir xogador'}).click();await roster.getByText('Ana García',{exact:true}).waitFor()
  await roster.getByLabel('Nome',{exact:true}).fill('Brais');await roster.getByRole('button',{name:'Engadir xogador'}).click();await roster.getByText('Brais',{exact:true}).waitFor()
  assert.equal(players.length,2);assert.equal(players[1].default_number,null)
  await snap('persistent-roster')
 })
 await t.test('quick rival requires no roster; local date and atomic create navigate to available players',async()=>{
  await away.getByRole('button',{name:'Gardar equipo'}).click();await awayRoster.getByRole('button',{name:'Xestionar plantel'}).waitFor()
  assert.equal(await away.getByText('Rival',{exact:true}).count(),1)
  assert.equal(await choose(away).count(),0)
  await page.getByLabel('Data e hora',{exact:false}).fill('2026-10-22T19:30')
  await page.getByLabel('Etiqueta do encontro (opcional)',{exact:true}).fill('Amigábel')
  await homeRoster.getByRole('button',{name:'Pechar plantel'}).click();await snap('create-match-desktop');await page.getByRole('button',{name:'Cambiar a tema claro'}).click();await snap('create-match-light');await page.getByRole('button',{name:'Cambiar a tema escuro'}).click()
  let release;holdMatch=new Promise(resolve=>{release=resolve})
  await page.getByRole('button',{name:'Crear análise',exact:true}).click()
  await page.getByRole('button',{name:'Creando análise…'}).waitFor()
  await page.locator('.setup-match-form').evaluate(form=>form.requestSubmit())
  assert.equal(await page.getByRole('button',{name:'Creando análise…'}).isDisabled(),true)
  assert.equal(await page.getByRole('button',{name:'Partido existente'}).isDisabled(),true)
  release();holdMatch=null
  await page.waitForURL('**/app/analyses/analysis1?step=roster')
  const local=page.getByRole('region',{name:'Convocatoria de Meu equipo',exact:true})
  await local.getByRole('button',{name:/Ana García.*Engadir/}).waitFor()
  assert.equal(await local.locator('.participant-row').count(),0)
  assert.equal(writes.filter(w=>w.kind==='match').length,1)
  assert.equal(writes.find(w=>w.kind==='match').input.p_scheduled_at,'2026-10-22T17:30:00.000Z')
  assert.equal(writes.find(w=>w.kind==='match').input.p_mode,'post_match')
  await page.getByText(/19:30/).waitFor()
  assert.equal(await page.getByRole('region',{name:'Convocatoria de Rival',exact:true}).getByLabel('Nome ou etiqueta',{exact:true}).count(),1)
 })
 await t.test('reuse teams, block identical selections, switch modes/paths and create live match',async()=>{
  await start();await page.getByRole('button',{name:'Crear partido',exact:true}).click()
  await choose(home).selectOption('team1');await choose(away).selectOption('team1')
  await page.getByText('O equipo local e o visitante deben ser distintos.').waitFor()
  assert.equal(await page.getByRole('button',{name:'Crear análise',exact:true}).isDisabled(),true)
  await away.getByRole('button',{name:'Cambiar equipo'}).click();await choose(away).selectOption('team2');await page.getByLabel('Data e hora',{exact:false}).fill('2026-12-01T19:00')
  await page.getByLabel('En directo',{exact:true}).check()
  await page.getByRole('button',{name:'Partido existente'}).click();await page.getByRole('button',{name:'Crear partido',exact:true}).click()
  assert.equal(await home.getByText('Meu equipo',{exact:true}).count(),1);assert.equal(await choose(home).count(),0)
  assert.equal(await page.getByLabel('Data e hora',{exact:false}).inputValue(),'2026-12-01T19:00')
  await page.getByRole('button',{name:'Crear análise',exact:true}).click();await page.waitForURL('**/analyses/analysis2?step=roster')
  assert.equal(teams.length,2);assert.equal(writes.filter(w=>w.kind==='match').at(-1).input.p_mode,'live')
  assert.equal(writes.filter(w=>w.kind==='match').at(-1).input.p_scheduled_at,'2026-12-01T18:00:00.000Z')
 })
 await t.test('existing personal and official matches remain usable',async()=>{
  teams.push({id:'official',name:'Equipo oficial',short_name:null,scope:'official',owner_user_id:null})
  matches.push({id:'official-match',scope:'official',status:'scheduled',home_team_id:'official',away_team_id:'team1',scheduled_at:null,round_label:null,round_number:null})
  await start();await page.locator('.match-card').filter({hasText:'Equipo oficial'}).click()
  await snap('existing-match-desktop')
  await page.getByLabel('En directo',{exact:true}).check();await page.getByRole('button',{name:'Crear análise',exact:true}).click();await page.waitForURL('**/analyses/analysis3?step=roster')
  assert.equal(writes.at(-1).kind,'existing');assert.equal(writes.at(-1).input.p_match_id,'official-match')
  await start();await page.locator('.match-card').filter({hasText:'Amigábel'}).click();await page.getByRole('button',{name:'Crear análise',exact:true}).click();await page.waitForURL('**/analyses/analysis4?step=roster')
  assert.equal(writes.at(-1).input.p_mode,'post_match');assert.equal(matches.length,3)
 })
 await t.test('official/personal labels, keyboard focus, mobile and light theme without overflow',async()=>{
  await start();await page.getByRole('button',{name:'Crear partido',exact:true}).click();await choose(home).selectOption('official')
  assert.equal(await homeRoster.count(),0)
  assert.equal(await home.getByText('Equipo oficial',{exact:true}).count(),1)
  assert.equal(await home.getByText('Oficial',{exact:true}).count(),1)
  await home.getByRole('button',{name:'Cambiar equipo'}).click()
  assert.match(await choose(home).textContent(),/Equipo oficial · Oficial/);assert.match(await choose(home).textContent(),/Meu equipo · Persoal/)
  await choose(home).focus();assert.equal(await choose(home).evaluate(e=>e===document.activeElement),true)
  await home.getByRole('button',{name:'Pechar selección'}).click()
  for(const [width,height] of [[1440,900],[1366,768],[1280,800],[1024,768],[834,1194],[768,1024],[430,932],[390,844],[360,800],[320,568]]){
   await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   await page.evaluate(()=>document.documentElement.style.fontSize='30px')
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`setup text 200% at ${width}`)
   if(width===320)await snap('setup-text-200-320')
   await page.evaluate(()=>document.documentElement.style.fontSize='')
  }
  await page.setViewportSize({width:390,height:844})
  await snap('mobile')
  await page.getByRole('button',{name:'Cambiar a tema claro',exact:true}).click()
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
 })
 assert.deepEqual(errors,[])
})
