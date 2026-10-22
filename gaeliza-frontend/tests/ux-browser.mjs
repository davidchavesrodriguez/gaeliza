// Product lifecycle/visual smoke with real pages and data modules; all network
// data is local, synthetic and scoped by the same query filters as production.
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import test from 'node:test'
import { contrastRatio } from './helpers/contrast.mjs'
import { startBrowserHarness } from './helpers/browser-harness.mjs'
const screenshotDir=process.env.UX_SCREENSHOT_DIR
const session={user:{id:'fixture-owner',is_anonymous:true}}
const source=`
  import React from 'react'
  import {createRoot} from 'react-dom/client'
  import {BrowserRouter,Routes,Route,Navigate} from 'react-router-dom'
  import {AuthContext} from '/src/v2/auth/auth-context'
  import {AppShell} from '/src/v2/components/AppShell'
  import {DashboardPage} from '/src/v2/pages/DashboardPage'
  import {AnalysisWorkspacePage} from '/src/v2/pages/AnalysisWorkspacePage'
  import {CreateAnalysisPage} from '/src/v2/pages/CreateAnalysisPage'
  import {LandingPage} from '/src/v2/pages/LandingPage'
  import {initializeTheme} from '/src/v2/domain/theme'
  import '/src/v2/styles/global.css'
  import '/src/v2/styles/analysis-setup.css'
  import '/src/v2/styles/analysis-workspace.css'
  import '/src/v2/styles/video-sync.css'
  import '/src/v2/styles/tagging.css'
  initializeTheme()
  const session=${JSON.stringify(session)}
  const auth={session,status:'ready',error:null,isAnonymous:true,ensureGuestSession:async()=>session,retrySession:()=>{},signOut:async()=>{}}
  createRoot(document.getElementById('root')).render(<AuthContext.Provider value={auth}><BrowserRouter><Routes>
    <Route path="/" element={<LandingPage/>}/>
    <Route path="/app" element={<AppShell/>}>
      <Route index element={<DashboardPage/>}/>
      <Route path="new" element={<CreateAnalysisPage/>}/>
      <Route path="analyses/:analysisId" element={<AnalysisWorkspacePage/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/app" replace/>}/>
  </Routes></BrowserRouter></AuthContext.Provider>)
`
const team=(id,name)=>({id,name,short_name:null,logo_path:null})
const home=team('home','GB Lorchos'),away=team('away','Atlántico Demo')
const fixtures=[
  {id:'ongoing',status:'in_progress',title:'Fixture de revisión UX'},
  {id:'draft',status:'draft',title:'Borrador sen eventos'},
  {id:'previous',status:'completed',title:'Partido anterior'},
]
const timestamp=new Date(Date.now()-8*60_000).toISOString()
const fact=(id,analysisId,type='shot',detail={})=>({event_id:id,analysis_id:analysisId,event_type:type,team_id:'home',period_id:`${analysisId}-period`,period_number:1,second_in_period:0,raw_x:55,raw_y:40,score_value:type==='shot'?1:0,shot_result:type==='shot'?'point':null,updated_at:timestamp,...detail})
test('resumable analysis product workflow and design smoke',async(t)=>{
  const {browser,origin,html}=await startBrowserHarness(t,{name:'ux',port:process.env.UX_SMOKE_PORT??5193,source})
  const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',timezoneId:'Europe/Madrid',reducedMotion:'reduce'})
  const page=await context.newPage();page.setDefaultTimeout(5000)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  const events=new Map([['ongoing',[fact('first','ongoing')]],['draft',[]],['previous',[fact('previous-first','previous')]]])
  const aggregateActivity=new Map(fixtures.map((item,index)=>[item.id,new Date(Date.parse(timestamp)-index*60_000).toISOString()]))
  const participants=new Map(fixtures.map(item=>[item.id,[
    {id:'home1',team_id:'home',player_id:null,display_name_snapshot:'Xogador local 1',number:1,starter:true,initial_goalkeeper:true,position:'Goalkeeper'},
    {id:'away2',team_id:'away',player_id:null,display_name_snapshot:'Xogador visitante 2',number:2,starter:true,initial_goalkeeper:false,position:'Defender'},
  ]]))
  const writes=[]
  let empty=false,failComplete=false,holdWrite=null
  const media=await readFile(new URL('fixtures/tagging.webm',import.meta.url))
  const reply=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
  const ownerId=(url)=>url.searchParams.get('analysis_id')?.slice(3)
  await page.route('**/*',async(route)=>{
    const request=route.request(),url=new URL(request.url())
    if(url.origin!==origin)return route.abort()
    if(request.isNavigationRequest())return route.fulfill({status:200,contentType:'text/html',body:html})
    if(url.pathname==='/fixture.webm'){
      const match=request.headers().range?.match(/bytes=(\d+)-(\d*)/)
      const start=match?Number(match[1]):0,end=match?.[2]?Number(match[2]):media.length-1
      return route.fulfill({status:match?206:200,contentType:'video/webm',headers:{'Accept-Ranges':'bytes',...(match?{'Content-Range':`bytes ${start}-${end}/${media.length}`}:{})},body:media.subarray(start,end+1)})
    }
    if(!url.pathname.startsWith('/rest/v1/'))return route.continue()
    if(url.pathname.endsWith('/analyses')){
      if(request.method()==='PATCH'){
        const id=url.searchParams.get('id').slice(3),input=request.postDataJSON()
        writes.push({id,...input})
        if(holdWrite)await holdWrite
        if(failComplete&&input.status==='completed')return reply(route,{message:'Fixture completion failed'},400)
        fixtures.find(item=>item.id===id).status=input.status
        aggregateActivity.set(id,new Date().toISOString())
        return reply(route,{id})
      }
      if(url.searchParams.has('owner_user_id')){
        assert.equal(url.searchParams.get('owner_user_id'),'eq.fixture-owner')
        assert.equal(url.searchParams.get('order'),'updated_at.desc,id.asc')
        assert.doesNotMatch(url.searchParams.get('select'),/activity:|events\(updated_at\)/)
        const sorted=[...fixtures].sort((a,b)=>Date.parse(aggregateActivity.get(b.id))-Date.parse(aggregateActivity.get(a.id))||a.id.localeCompare(b.id))
        return reply(route,empty?[]:sorted.map(item=>({...item,updated_at:aggregateActivity.get(item.id),
          match:{scheduled_at:'2026-10-22T15:00:00Z',home:{name:home.name},away:{name:away.name}},
          event_count:[{count:events.get(item.id).length}],videos:[{count:item.id==='draft'?0:3}]})))
      }
      const id=url.searchParams.get('id').slice(3),item=fixtures.find(item=>item.id===id)
      return reply(route,{...item,mode:'post_match',match_id:`match-${id}`,match:{id:`match-${id}`,scheduled_at:'2026-10-22T15:00:00Z',home_team:home,away_team:away}})
    }
    if(url.pathname.endsWith('/analysis_periods'))return reply(route,[{id:`${ownerId(url)}-period`,number:1,name:'Primeira parte',expected_duration_seconds:1800,home_attacks_towards:'right'}])
    if(url.pathname.endsWith('/analysis_participants')){
      if(request.method()==='POST'){
        const input=request.postDataJSON();writes.push(input)
        participants.get(input.analysis_id).push({id:'new-player',...input})
        aggregateActivity.set(input.analysis_id,new Date().toISOString())
        return reply(route,null,201)
      }
      return reply(route,participants.get(ownerId(url)))
    }
    if(url.pathname.endsWith('/team_players')||url.pathname.endsWith('/matches'))return reply(route,[])
    if(url.pathname.endsWith('/analysis_videos'))return reply(route,ownerId(url)==='draft'?[]:[
      {id:'direct',url:`${origin}/fixture.webm`,provider:null,title:'Cámara principal',duration_seconds:60,sort_order:0},
      {id:'youtube',url:'https://youtu.be/dQw4w9WgXcQ',provider:null,title:'YouTube',duration_seconds:60,sort_order:1},
      {id:'external',url:'https://example.test/watch?token=original',provider:null,title:'Fonte externa',duration_seconds:null,sort_order:2},
    ])
    if(url.pathname.endsWith('/video_sync_points'))return reply(route,ownerId(url)==='draft'?[]:['direct','youtube','external'].map(videoId=>({id:videoId,analysis_video_id:videoId,analysis_period_id:`${ownerId(url)}-period`,video_second:10,second_in_period:0})))
    if(url.pathname.endsWith('/analysis_event_facts'))return reply(route,events.get(ownerId(url)))
    if(url.pathname.endsWith('/rpc/log_event')){
      const input=request.postDataJSON();writes.push(input)
      const row=fact(`event-${writes.length}`,input.p_analysis_id,input.p_event_type,{raw_x:input.p_x,raw_y:input.p_y,
        kickout_length:input.p_detail.length,kickout_result:input.p_detail.result,second_in_period:input.p_second_in_period})
      events.get(input.p_analysis_id).push(row)
      aggregateActivity.set(input.p_analysis_id,new Date().toISOString())
      return reply(route,row.event_id)
    }
    throw new Error(`Unexpected fixture request: ${request.method()} ${url.pathname}`)
  })
  async function screenshot(name){
    if(!screenshotDir)return
    await mkdir(screenshotDir,{recursive:true})
    await page.evaluate(()=>{ if(document.activeElement instanceof HTMLElement)document.activeElement.blur();window.scrollTo(0,0) })
    if(await page.locator('video').count())await page.waitForFunction(()=>{const video=document.querySelector('video');return video.readyState>=2&&!video.seeking})
    await page.mouse.move(0,0)
    await page.screenshot({path:`${screenshotDir}/${name}.png`,fullPage:true,animations:'disabled'})
  }
  async function checkContrast(){
    const pairs=[['ink','paper',4.5],['ink-soft','surface',4.5],['accent','paper',4.5],['on-accent','accent',4.5],['danger','surface',4.5],['warning','surface',4.5],['info','surface',4.5],['control-line','surface',3]]
    const colors=await page.evaluate(()=>{const style=getComputedStyle(document.documentElement);return Object.fromEntries(['ink','ink-soft','paper','surface','accent','on-accent','danger','warning','info','control-line'].map(name=>[name,style.getPropertyValue('--'+name).trim()]))})
    for(const [foreground,background,minimum]of pairs)assert.ok(contrastRatio(colors[foreground],colors[background])>=minimum,`${foreground}/${background} contrast`)
  }
  const idle=()=>page.waitForFunction(()=>{const button=document.querySelector('.tagging-save-button');return button&&!button.disabled})
  await page.goto(origin+'/app')
  await t.test('dashboard lists owned draft/in-progress separately from completed, with real counts',async()=>{
    const ongoing=page.getByRole('region',{name:'En curso',exact:true}),completed=page.getByRole('region',{name:'Completadas',exact:true})
    await page.getByRole('heading',{name:'As túas análises',exact:true}).waitFor()
    await ongoing.getByText('Borrador sen eventos').waitFor()
    assert.equal(await ongoing.locator('li').count(),2);assert.equal(await completed.locator('li').count(),1)
    await ongoing.getByText('1 evento · Vídeo configurado').waitFor()
    await screenshot('dashboard-dark')
    const draft=ongoing.getByRole('link',{name:/Continuar/}).nth(1)
    assert.equal(await draft.getAttribute('href'),'/app/analyses/draft?step=roster')
    await draft.click();await page.getByRole('region',{name:'Convocatoria de Atlántico Demo',exact:true}).waitFor()
    assert.equal(new URL(page.url()).pathname,'/app/analyses/draft')
    await page.getByRole('link',{name:'← Inicio',exact:true}).click()
  })
  await t.test('a roster-only write updates the dashboard timestamp and moves the analysis ahead of older event activity',async()=>{
    await page.locator('a[href="/app/analyses/draft?step=roster"]').click()
    await page.getByRole('region',{name:'Convocatoria de Atlántico Demo',exact:true}).getByLabel('Nome ou etiqueta',{exact:true}).fill('Novo xogador')
    await page.getByRole('region',{name:'Convocatoria de Atlántico Demo',exact:true}).getByRole('button',{name:'Engadir temporal',exact:true}).click()
    await page.getByText('Novo xogador',{exact:true}).waitFor()
    await page.getByText('Gardado',{exact:true}).waitFor()
    await page.getByRole('link',{name:'← Inicio',exact:true}).click()
    const first=page.getByRole('region',{name:'En curso',exact:true}).locator('li').first()
    await first.getByText('Borrador sen eventos',{exact:false}).waitFor()
    assert.equal(await first.locator('time').getAttribute('datetime'),aggregateActivity.get('draft'))
    assert.equal(await first.locator('time').textContent(),'Hai un intre')
    assert.equal(events.get('draft').length,0)
    await screenshot('dashboard-dark')
  })
  await t.test('continue opens the correct analysis and translations hide known internal position enums',async()=>{
    await page.getByRole('region',{name:'En curso',exact:true}).locator('li').filter({hasText:'Fixture de revisión UX'}).getByRole('link',{name:/Continuar/}).click();await idle()
    assert.equal(new URL(page.url()).pathname,'/app/analyses/ongoing')
    assert.equal(new URL(page.url()).searchParams.get('step'),'tagging')
    await page.getByRole('button',{name:'Convocatoria',exact:true}).click()
    await page.getByText('Porteiro',{exact:true}).waitFor()
    assert.equal(await page.getByText(/Goalkeeper|Defender/).count(),0)
    await page.getByRole('button',{name:'Vídeo e sincronización',exact:true}).click()
    await page.getByText(/Indica en que instante do vídeo comeza este período/).waitFor()
    await page.getByRole('button',{name:'Tagging',exact:true}).click();await idle()
    await page.getByRole('button',{name:'Perda',exact:true}).click()
    await page.getByLabel(/^Causa da perda/).selectOption({label:'Balón fóra'})
    assert.equal(await page.getByLabel(/^Causa da perda/).inputValue(),'out_of_play')
    assert.equal(await page.getByRole('option',{name:'Fóra de xogo',exact:true}).count(),0)
    await page.getByRole('button',{name:'Tiro',exact:true}).click()
  })
  await t.test('all thirteen grouped actions stay visible with keyboard focus; kickout only requests destination',async()=>{
    const controls=page.getByRole('group',{name:'Tipo de evento',exact:true})
    assert.equal(await controls.getByRole('button').count(),13)
    for(const label of ['Principais','Xogo','Reinicios','Disciplina','Cambios'])assert.equal(await controls.getByRole('group',{name:label,exact:true}).count(),1)
    const kickout=controls.getByRole('button',{name:'Saque de porta',exact:true})
    await kickout.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab')
    assert.equal(await kickout.evaluate(node=>node===document.activeElement&&getComputedStyle(node).outlineStyle==='solid'),true)
    await page.keyboard.press('Enter')
    assert.equal(await kickout.getAttribute('aria-pressed'),'true')
    assert.equal(await page.getByLabel('X',{exact:true}).count(),0)
    await page.getByLabel('Destino X',{exact:true}).fill('0');await page.getByLabel('Destino Y',{exact:true}).fill('0')
    await page.getByRole('button',{name:'Gardar saque de porta',exact:true}).click();await idle()
    const input=writes.at(-1);assert.equal(input.p_x,null);assert.equal(input.p_y,null)
    assert.equal(input.p_detail.end_x,0);assert.equal(input.p_detail.end_y,0)
    await page.getByText('Gardado',{exact:true}).waitFor()
    await controls.getByRole('button',{name:'Tiro',exact:true}).click()
  })
  await t.test('video can hide/show, uses direct HTML5, safe YouTube embed and explicit generic fallback',async()=>{
    await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1)
    assert.equal(await page.locator('video').evaluate(v=>v.paused&&!v.autoplay),true)
    await page.getByRole('button',{name:'Ocultar vídeo'}).click()
    assert.equal(await page.locator('video').count(),0)
    assert.equal(await page.locator('.tagging-layout').evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length),1)
    await page.getByRole('button',{name:'Mostrar vídeo'}).click()
    await page.locator('.timeline-event').first().getByRole('button',{name:/Ir ao vídeo: Cámara principal/}).click()
    await page.waitForFunction(()=>Math.abs(document.querySelector('video')?.currentTime-10)<.1)
    assert.equal(await page.locator('#tagging-video-panel').evaluate(node=>node===document.activeElement),true)
    await page.locator('.timeline-event').first().getByRole('button',{name:/Ir ao vídeo: YouTube/}).click()
    const embed=page.locator('.youtube-player');assert.match(await embed.getAttribute('src'),/youtube-nocookie.com\/embed\/dQw4w9WgXcQ\?start=10/)
    assert.match(await embed.getAttribute('src'),/autoplay=0/)
    await page.getByLabel('Fonte de vídeo').selectOption('external')
    assert.equal(await page.locator('iframe').count(),0)
    assert.equal(await page.getByRole('link',{name:'Abrir no provedor',exact:true}).getAttribute('href'),'https://example.test/watch?token=original')
    await page.getByLabel('Fonte de vídeo').selectOption('direct')
    await screenshot('tagging-desktop-dark')
  })
  await t.test('light toggle persists, mobile stacks and keeps navigation/actions accessible without overflow',async()=>{
    await checkContrast()
    await page.getByRole('button',{name:'Cambiar a tema claro'}).click()
    await page.waitForFunction(()=>document.documentElement.dataset.theme==='light')
    await checkContrast()
    await screenshot('tagging-desktop-light')
    await page.reload();await idle();assert.equal(await page.locator('html').getAttribute('data-theme'),'light')
    await page.getByRole('button',{name:'Cambiar a tema escuro'}).click()
    await page.setViewportSize({width:390,height:844})
    assert.equal(await page.getByRole('link',{name:'← Inicio',exact:true}).isVisible(),true)
    assert.equal(await page.getByRole('button',{name:'Finalizar análise',exact:true}).isVisible(),true)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true)
    await screenshot('tagging-mobile-dark')
    await page.setViewportSize({width:1440,height:1000})
  })
  await t.test('completion requires confirmation; Escape cancels without a write and restores focus',async()=>{
    const before=writes.length,button=page.getByRole('button',{name:'Finalizar análise',exact:true})
    await button.click();await page.getByRole('dialog').waitFor()
    await page.getByRole('heading',{name:'Finalizar esta análise?',exact:true}).waitFor()
    await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'})
    assert.equal(writes.length,before)
    assert.equal(await button.evaluate(node=>node===document.activeElement),true)
  })
  await t.test('failed completion shows a real save error and keeps the analysis editable',async()=>{
    failComplete=true
    await page.getByRole('button',{name:'Finalizar análise',exact:true}).click()
    await page.getByRole('button',{name:'Confirmar finalización'}).click()
    await page.getByRole('dialog').getByRole('alert').waitFor()
    assert.match(await page.getByRole('dialog').getByRole('alert').textContent(),/Fixture completion failed/)
    assert.equal(fixtures[0].status,'in_progress')
    await page.getByRole('button',{name:'Seguir analizando'}).click()
    await page.getByText('Erro ao gardar',{exact:true}).waitFor()
    failComplete=false
  })
  await t.test('pending/save confirmation are real; completed blocks mutations but retains timeline/video',async()=>{
    let release;holdWrite=new Promise(resolve=>{release=resolve})
    await page.getByRole('button',{name:'Finalizar análise',exact:true}).click()
    await page.getByRole('button',{name:'Confirmar finalización'}).click()
    await page.getByText('Gardando…',{exact:true}).waitFor()
    assert.equal(await page.getByRole('button',{name:'Finalizando…'}).isDisabled(),true)
    release();holdWrite=null
    await page.getByRole('dialog').waitFor({state:'hidden'})
    await page.getByText('Gardado',{exact:true}).waitFor()
    await page.getByRole('button',{name:'Reabrir análise',exact:true}).waitFor()
    assert.match(await page.locator('.completed-summary').textContent(),/Análise finalizada.*Reábrea/)
    assert.equal(await page.locator('.tagging-save-button').count(),0)
    assert.equal(await page.getByRole('button',{name:'Editar',exact:true}).first().isDisabled(),true)
    assert.equal(await page.getByRole('button',{name:'Quitar',exact:true}).first().isDisabled(),true)
    await page.locator('.timeline-event').first().getByRole('button',{name:/Ir ao vídeo: Cámara principal/}).click()
    await page.waitForFunction(()=>Math.abs(document.querySelector('video')?.currentTime-10)<.1)
    await screenshot('workspace-completed-dark')
  })
  await t.test('return Home shows the completed analysis; revisiting and reopening restores capture',async()=>{
    await page.getByRole('link',{name:'← Inicio',exact:true}).click()
    const completed=page.getByRole('region',{name:'Completadas',exact:true})
    await completed.getByText('Fixture de revisión UX').waitFor();assert.equal(await completed.locator('li').count(),2)
    await completed.getByRole('link',{name:/Revisar/}).first().click()
    await page.getByRole('button',{name:'Reabrir análise',exact:true}).click();await idle()
    assert.equal(fixtures[0].status,'in_progress')
    assert.equal(await page.getByRole('button',{name:'Finalizar análise',exact:true}).isEnabled(),true)
  })
  await t.test('empty dashboard is functional and landing contains no invented metrics or feature-card grid',async()=>{
    empty=true;await page.goto(origin+'/app')
    await page.getByRole('heading',{name:'Aínda non tes análises.'}).waitFor()
    assert.equal(await page.getByRole('link',{name:'Nova análise',exact:true}).count(),2)
    assert.equal(await page.locator('.dashboard-card').count(),0)
    await page.goto(origin+'/')
    await page.getByRole('heading',{name:'O partido, xogada a xogada.'}).waitFor()
    await page.getByRole('link',{name:'Comezar unha análise',exact:true}).waitFor()
    assert.equal(await page.locator('.metric-card,.capability-card').count(),0)
    assert.equal(await page.getByText(/46%|72%|0,81/).count(),0)
    await screenshot('landing-dark')
  })
  assert.deepEqual(errors,[])
})
