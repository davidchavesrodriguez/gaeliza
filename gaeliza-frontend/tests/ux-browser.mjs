// Product lifecycle/visual smoke with real pages and data modules; all network
// data is local, synthetic and scoped by the same query filters as production.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import test from 'node:test'
import { contrastRatio } from './helpers/contrast.mjs'
import { startBrowserHarness } from './helpers/browser-harness.mjs'
const screenshotDir=process.env.UX_SCREENSHOT_DIR
const shellScreenshotDir=process.env.SHELL_SCREENSHOT_DIR
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
  let empty=false,failComplete=false,holdWrite=null,failWorkspaceRead=false,holdWorkspaceRead=null,failEvents=false
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
      if(holdWorkspaceRead)await holdWorkspaceRead
      if(failWorkspaceRead)return reply(route,{message:'Fixture workspace unavailable'},400)
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
    if(url.pathname.endsWith('/analysis_event_facts'))return failEvents?reply(route,{message:'Fixture events unavailable'},400):reply(route,events.get(ownerId(url)))
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
  async function shellScreenshot(name){
    if(!shellScreenshotDir)return
    await mkdir(shellScreenshotDir,{recursive:true})
    await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)})
    await page.mouse.move(0,0)
    await page.screenshot({path:`${shellScreenshotDir}/${name}.png`,fullPage:true,animations:'disabled'})
  }
  async function shellGeometry(label){
    const result=await page.evaluate(()=>({header:document.querySelector('.app-header').getBoundingClientRect().height,
      context:document.querySelector('.workspace-context').getBoundingClientRect().height,
      overflow:document.documentElement.scrollWidth>innerWidth}))
    assert.equal(result.overflow,false,`${label}: no horizontal overflow`)
    return {label,...result}
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
    const activity=first.getByText(/^Actualizada:/).locator('time')
    assert.equal(await activity.getAttribute('datetime'),aggregateActivity.get('draft'))
    assert.equal(await activity.textContent(),'Hai un intre')
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
  await t.test('workspace shell has one match heading, secondary URL navigation, accurate score and responsive long names',async()=>{
    await page.setViewportSize({width:1440,height:900})
    const nav=page.getByRole('navigation',{name:'Seccións da análise'})
    const geometry=[]
    for(const [step,label,shot]of [['roster','Convocatoria','roster-desktop-dark'],['video','Vídeo e sincronización','video-desktop-dark'],['tagging','Tagging','tagging-desktop-dark']]){
      await nav.getByRole('button',{name:label,exact:true}).click()
      await page.waitForURL(url=>url.searchParams.get('step')===step)
      await nav.locator('[aria-current=page]').filter({hasText:label}).waitFor()
      assert.equal(new URL(page.url()).searchParams.get('step'),step)
      assert.equal(await nav.getByRole('button',{name:label,exact:true}).getAttribute('aria-current'),'page')
      if(step==='tagging')await idle()
      assert.equal(await page.getByRole('heading',{level:1}).count(),1)
      await page.getByRole('button',{name:'Finalizar análise',exact:true}).waitFor()
      geometry.push(await shellGeometry(step));await shellScreenshot(shot)
    }
    const normal=geometry.at(-1)
    assert.ok(normal.header>=48&&normal.header<=56)
    assert.ok(normal.context>=180&&normal.context<=210,`context height ${normal.context}`)
    const score=page.getByLabel('Marcador analítico',{exact:true})
    assert.match(await score.textContent(),/0-01.*1 pts.*0-00.*0 pts/s)
    assert.equal(await page.getByRole('heading',{name:'Rexistro de eventos',exact:true}).count(),1)
    await page.getByRole('button',{name:'Cambiar a tema claro'}).click()
    assert.equal((await shellGeometry('light')).context,normal.context)
    await shellScreenshot('tagging-desktop-light')
    await page.getByRole('button',{name:'Cambiar a tema escuro'}).click()
    await page.setViewportSize({width:1366,height:768});geometry.push(await shellGeometry('1366'));await shellScreenshot('tagging-1366-dark')
    for(const [width,height]of [[768,1024],[390,844],[320,568]]){
      await page.setViewportSize({width,height});geometry.push(await shellGeometry(String(width)))
      await page.getByText('As accións gárdanse ao confirmalas',{exact:true}).waitFor()
      await page.getByText('Modo invitado',{exact:true}).waitFor()
      if(width<768)await shellScreenshot(`tagging-${width}-dark`)
    }
    const original=[home.name,away.name],originalEvents=[...events.get('ongoing')]
    home.name='Asociación Deportiva de Fútbol Gaélico da Costa Atlántica'
    away.name='Clube Universitario de Fútbol Gaélico de Santiago de Compostela'
    events.get('ongoing').push(fact('goal-fixture','ongoing','shot',{team_id:'away',shot_result:'goal',score_value:3}))
    await page.setViewportSize({width:1440,height:900});await page.reload();await idle()
    await page.getByRole('heading',{level:1}).getByText(home.name,{exact:true}).waitFor()
    assert.match(await score.textContent(),/0-01.*1 pts.*1-00.*3 pts/s)
    geometry.push(await shellGeometry('long-desktop'));await shellScreenshot('long-names-desktop-dark')
    await page.setViewportSize({width:320,height:568});geometry.push(await shellGeometry('long-320'))
    await shellScreenshot('long-names-320-dark')
    await page.evaluate(()=>document.documentElement.style.fontSize='200%')
    await shellGeometry('long-320-text-200')
    await page.evaluate(()=>document.documentElement.style.fontSize='')
    home.name=original[0];away.name=original[1];events.set('ongoing',originalEvents)
    await page.setViewportSize({width:1440,height:900});await page.reload();await idle()
    if(shellScreenshotDir)await writeFile(`${shellScreenshotDir}/measurements.json`,JSON.stringify(geometry,null,2)+'\n')
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
    const statusBefore=await page.locator('.workspace-toolbar [role=status]').boundingBox()
    failComplete=true
    await page.getByRole('button',{name:'Finalizar análise',exact:true}).click()
    await page.getByRole('button',{name:'Confirmar finalización'}).click()
    await page.getByRole('dialog').getByRole('alert').waitFor()
    assert.match(await page.getByRole('dialog').getByRole('alert').textContent(),/Fixture completion failed/)
    assert.equal(fixtures[0].status,'in_progress')
    await page.getByRole('button',{name:'Seguir analizando'}).click()
    await page.getByText('Erro ao gardar',{exact:true}).waitFor()
    const statusAfter=await page.locator('.workspace-toolbar [role=status]').boundingBox()
    assert.equal(statusAfter.y,statusBefore.y);assert.equal(statusAfter.height,statusBefore.height)
    await shellScreenshot('mutation-error-desktop-dark')
    failComplete=false
  })
  await t.test('pending/save confirmation are real; completed blocks mutations but retains timeline/video',async()=>{
    const statusBeforePending=await page.locator('.workspace-toolbar [role=status]').boundingBox()
    let release;holdWrite=new Promise(resolve=>{release=resolve})
    await page.getByRole('button',{name:'Finalizar análise',exact:true}).click()
    await page.getByRole('button',{name:'Confirmar finalización'}).click()
    await page.getByText('Gardando…',{exact:true}).waitFor()
    const statusPending=await page.locator('.workspace-toolbar [role=status]').boundingBox()
    assert.deepEqual(statusPending,statusBeforePending)
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
    assert.equal(await page.getByRole('spinbutton',{name:/Tempo/}).count(),0)
    await shellScreenshot('completed-desktop-dark')
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
  await t.test('shell retains committed-write reload errors, initial loading/errors and unknown score without events',async()=>{
    failWorkspaceRead=true
    await page.getByRole('button',{name:'Finalizar análise',exact:true}).click()
    await page.getByRole('button',{name:'Confirmar finalización'}).click()
    await page.getByRole('dialog').waitFor({state:'hidden'})
    await page.getByRole('alert').getByText(/A acción gardouse, pero fallou a recarga/).waitFor()
    await page.getByText('Gardado',{exact:true}).waitFor()
    assert.equal(await page.getByRole('button',{name:'Finalizar análise',exact:true}).isDisabled(),true)
    await shellScreenshot('requires-reload-desktop-dark')
    failWorkspaceRead=false;await page.getByRole('button',{name:'Recargar datos',exact:true}).click()
    await page.getByRole('button',{name:'Reabrir análise',exact:true}).waitFor()
    assert.equal(await page.locator('.tagging-save-button').count(),0)
    failWorkspaceRead=true;await page.reload()
    await page.getByRole('heading',{name:'Non puidemos abrir esta análise.'}).waitFor()
    await page.getByText(/Fixture workspace unavailable/).waitFor()
    await shellScreenshot('load-error-desktop-dark')
    let release;holdWorkspaceRead=new Promise(resolve=>{release=resolve})
    failWorkspaceRead=false;await page.getByRole('button',{name:'Reintentar',exact:true}).click()
    await page.getByText('Cargando o espazo de análise…',{exact:true}).waitFor()
    await shellScreenshot('loading-desktop-dark');release();holdWorkspaceRead=null
    await page.getByRole('button',{name:'Reabrir análise',exact:true}).waitFor()
    failEvents=true;await page.reload()
    await page.getByRole('alert').getByText(/Fixture events unavailable/).waitFor()
    assert.match(await page.getByLabel('Marcador analítico',{exact:true}).textContent(),/—/)
    assert.doesNotMatch(await page.getByLabel('Marcador analítico',{exact:true}).textContent(),/0-00/)
    failEvents=false;await page.getByRole('button',{name:'Recargar datos',exact:true}).click()
    await page.getByText(/Marcador analítico · 2 eventos/).waitFor()
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

test('reentry and landing: real list states, responsive reading and keyboard access',async(t)=>{
  const {browser,origin,html}=await startBrowserHarness(t,{name:'reentry',port:process.env.REENTRY_SMOKE_PORT??5205,source})
  const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',timezoneId:'Europe/Madrid',reducedMotion:'reduce'})
  const page=await context.newPage();page.setDefaultTimeout(5000)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  const row=(index)=>({id:`analysis-${index}`,status:index===2?'completed':index===1?'draft':'in_progress',
    title:index===1?null:`Revisión ${index+1}`,updated_at:new Date(Date.now()-(index+1)*86_400_000).toISOString(),
    match:{scheduled_at:`2026-10-${22+index%2}T15:00:00Z`,home:{name:'GB Lorchos'},away:{name:'Atlántico Demo'}},
    event_count:[{count:index===0?1:index===1?0:125}],videos:[{count:index===1?0:2}]})
  let rows=[row(0),row(1),row(2)],failOffset=null,holdRead=null
  const offsets=[]
  await page.route('**/*',async(route)=>{
    const request=route.request(),url=new URL(request.url())
    if(url.origin!==origin)return route.abort()
    if(request.isNavigationRequest())return route.fulfill({contentType:'text/html',body:html})
    if(!url.pathname.startsWith('/rest/v1/'))return route.continue()
    assert.equal(request.method(),'GET');assert.equal(url.pathname,'/rest/v1/analyses')
    assert.equal(url.searchParams.get('owner_user_id'),'eq.fixture-owner')
    assert.equal(url.searchParams.get('order'),'updated_at.desc,id.asc')
    assert.equal(url.searchParams.get('limit'),'50')
    assert.doesNotMatch(url.searchParams.get('select'),/events\(updated_at\)|activity:/)
    const offset=Number(url.searchParams.get('offset'));offsets.push(offset)
    if(holdRead)await holdRead
    if(offset===failOffset)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Fixture list unavailable'})})
    return route.fulfill({contentType:'application/json',body:JSON.stringify(rows.slice(offset,offset+50))})
  })
  const list=()=>page.getByRole('region',{name:'En curso',exact:true}).getByRole('listitem')
  const allRows=()=>page.locator('.dashboard-page').getByRole('listitem')
  async function dashboard(){await page.goto(origin+'/app');await page.getByRole('heading',{name:'As túas análises',exact:true}).waitFor()}
  async function ready(){await page.getByRole('status').waitFor({state:'hidden'})}
  async function setTheme(theme){
    if(await page.locator('html').getAttribute('data-theme')!==theme){
      await page.getByRole('button',{name:`Cambiar a tema ${theme==='dark'?'escuro':'claro'}`,exact:true}).click()
    }
    await page.getByRole('button',{name:`Cambiar a tema ${theme==='dark'?'claro':'escuro'}`,exact:true}).waitFor()
    assert.equal(await page.locator('html').getAttribute('data-theme'),theme)
  }
  async function screenshot(name,fullPage=true){
    if(!process.env.REENTRY_SCREENSHOT_DIR)return
    await mkdir(process.env.REENTRY_SCREENSHOT_DIR,{recursive:true})
    await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)})
    await page.mouse.move(0,0)
    await page.screenshot({path:`${process.env.REENTRY_SCREENSHOT_DIR}/${name}.png`,fullPage,animations:'disabled'})
  }
  async function focusWithKeyboard(link){
    await page.evaluate(()=>{document.activeElement?.blur();document.body.tabIndex=-1;document.body.focus()})
    let reached=false
    for(let i=0;i<20;i++){
      await page.keyboard.press('Tab')
      if(await link.evaluate(element=>element===document.activeElement)){reached=true;break}
    }
    assert.ok(reached,'link reachable in DOM tab order')
    assert.ok(await link.evaluate(element=>element.matches(':focus-visible')&&getComputedStyle(element).outlineStyle!=='none'),'visible keyboard focus')
    const box=await link.boundingBox();assert.ok(box.height>=44,'touch target height')
    assert.ok(await link.evaluate(element=>{
      const box=element.getBoundingClientRect(),hit=document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)
      return element===hit||element.contains(hit)
    }),'focused action is in view and not obscured')
  }
  async function noOverflow(label){
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${label}: no horizontal overflow`)
    for(const link of await page.getByRole('link').all()){
      const box=await link.boundingBox()
      if(box&&await link.isVisible())assert.ok(box.x>=0&&box.x+box.width<=await page.evaluate(()=>innerWidth)+1,`${label}: link fits horizontally`)
    }
  }
  async function contrast(){
    const colors=await page.evaluate(()=>{const css=getComputedStyle(document.documentElement);return Object.fromEntries(['paper','ink','ink-soft','accent','on-accent'].map(key=>[key,css.getPropertyValue('--'+key).trim()]))})
    for(const [a,b,min]of [['ink','paper',4.5],['ink-soft','paper',4.5],['accent','paper',4.5],['on-accent','accent',4.5]])assert.ok(contrastRatio(colors[a],colors[b])>=min,`${a}/${b}`)
  }
  await t.test('initial loading, failed read and retry preserve the guest warning and create action',async()=>{
    let release;holdRead=new Promise(resolve=>{release=resolve});failOffset=0
    await dashboard();await page.getByRole('status').getByText('Cargando análises…').waitFor()
    await page.getByText(/Sesión de invitado: para retomar/).waitFor()
    assert.equal(await page.getByRole('link',{name:'Nova análise',exact:true}).last().getAttribute('href'),'/app/new')
    release();holdRead=null
    await page.getByRole('alert').getByText(/Fixture list unavailable/).waitFor()
    assert.equal(await allRows().count(),0)
    failOffset=null;await page.getByRole('button',{name:'Reintentar',exact:true}).click()
    await list().first().waitFor();await ready()
    assert.equal(await allRows().count(),3);assert.deepEqual(offsets,[0,0])
  })
  await t.test('match dates differ from aggregate activity; facts, groups and resume links keep their meaning',async()=>{
    await dashboard();await ready()
    assert.equal(await list().count(),2)
    const completed=page.getByRole('region',{name:'Completadas',exact:true})
    assert.equal(await completed.getByRole('listitem').count(),1)
    await page.getByRole('heading',{name:'En curso 2',exact:true}).waitFor()
    await page.getByRole('heading',{name:'Completadas 1',exact:true}).waitFor()
    for(const [index,status,path]of [[0,'En curso','tagging'],[1,'Borrador','roster'],[2,'Completada','tagging']]){
      const item=allRows().nth(index)
      await item.getByText(status,{exact:true}).waitFor()
      assert.equal(await item.getByText(/^Partido:/).locator('time').getAttribute('datetime'),rows[index].match.scheduled_at)
      assert.equal(await item.getByText(/^Actualizada:/).locator('time').getAttribute('datetime'),rows[index].updated_at)
      assert.match(await item.getByText(/^Actualizada:/).textContent(),/Hai \d+ día/)
      assert.equal(await item.getByRole('link').getAttribute('href'),`/app/analyses/analysis-${index}?step=${path}`)
      assert.match(await item.getByRole('link').getAttribute('aria-label'),index===2?/^Revisar análise/:/^Continuar análise/)
    }
    await list().nth(0).getByText('Partido: 22 out. 2026, 17:00',{exact:true}).waitFor()
    await list().nth(1).getByText('Partido: 23 out. 2026, 17:00',{exact:true}).waitFor()
    await page.getByText('1 evento · Vídeo configurado',{exact:true}).waitFor()
    await page.getByText('0 eventos · Sen vídeo',{exact:true}).waitFor()
    await page.getByText('125 eventos · Vídeo configurado',{exact:true}).waitFor()
    await list().first().getByText('Revisión 1',{exact:true}).waitFor()
    assert.doesNotMatch(await list().nth(1).textContent(),/Revisión|null|undefined/)
    assert.notEqual(await list().nth(0).getByRole('link').getAttribute('aria-label'),await list().nth(1).getByRole('link').getAttribute('aria-label'))
    await screenshot('dashboard-mixed-desktop-dark')
    await focusWithKeyboard(list().first().getByRole('link'))
  })
  await t.test('dashboard wraps at five widths in both themes, including doubled text',async()=>{
    for(const theme of ['dark','light']){
      await setTheme(theme)
      await contrast()
      for(const width of [1440,1024,768,390,320]){
        await page.setViewportSize({width,height:900});await noOverflow(`dashboard ${theme} ${width}`)
        await page.evaluate(()=>document.documentElement.style.fontSize='30px')
        await noOverflow(`dashboard ${theme} ${width} text 200%`)
        await focusWithKeyboard(list().first().getByRole('link'))
        await page.evaluate(()=>document.documentElement.style.fontSize='')
        if(theme==='dark'&&width===390)await screenshot('dashboard-mixed-mobile-dark')
        if(theme==='light'&&width===1440)await screenshot('dashboard-mixed-desktop-light')
      }
    }
  })
  await t.test('long names wrap, missing match date has no invalid time element, empty state has one main create action',async()=>{
    rows=[row(0)];rows[0].match.home.name='Asociación Deportiva de Fútbol Gaélico da Costa Atlántica'
    rows[0].match.away.name='EquipoVisitanteCunNomeMoiLongoSenEspazosParaComprobarAxuste'
    rows[0].title='Revisión da segunda parte e preparación do seguinte encontro'
    rows[0].match.scheduled_at=null
    await setTheme('dark');await dashboard();await ready()
    await list().first().getByText('Partido: Data por confirmar',{exact:true}).waitFor()
    assert.equal(await list().first().locator('time').count(),1)
    await page.setViewportSize({width:390,height:844});await noOverflow('long names 390')
    await screenshot('dashboard-long-names-mobile-dark')
    await page.setViewportSize({width:320,height:568});await page.evaluate(()=>document.documentElement.style.fontSize='30px')
    await noOverflow('long names 320 text 200%');await focusWithKeyboard(list().first().getByRole('link'))
    rows=[];await page.setViewportSize({width:1440,height:1000});await dashboard();await ready()
    await page.getByRole('heading',{name:'Aínda non tes análises.',exact:true}).waitFor()
    assert.equal(await page.getByRole('main').getByRole('link',{name:'Nova análise',exact:true}).count(),1)
    await screenshot('dashboard-empty-desktop-dark')
  })
  await t.test('load-more error retries the same offset, retains order, deduplicates and stops at hasMore=false',async()=>{
    rows=Array.from({length:50},(_,index)=>row(index));rows.push({...rows[0]},row(50))
    offsets.length=0;await dashboard();await ready()
    assert.equal(await allRows().count(),50)
    const before=await list().getByRole('link').evaluateAll(links=>links.map(link=>link.getAttribute('href')))
    failOffset=50
    await page.getByRole('button',{name:'Cargar máis análises',exact:true}).click()
    await page.getByRole('alert').getByText(/Fixture list unavailable/).waitFor()
    assert.equal(await allRows().count(),50)
    assert.deepEqual(await list().getByRole('link').evaluateAll(links=>links.map(link=>link.getAttribute('href'))),before)
    failOffset=null;await page.getByRole('button',{name:'Reintentar',exact:true}).click();await ready()
    assert.deepEqual(offsets,[0,50,50]);assert.equal(await allRows().count(),51)
    assert.equal(await page.getByRole('button',{name:'Cargar máis análises',exact:true}).count(),0)
    const after=await list().getByRole('link').evaluateAll(links=>links.map(link=>link.getAttribute('href')))
    assert.deepEqual(after.slice(0,-1),before);assert.equal(after.at(-1),'/app/analyses/analysis-50?step=tagging')
    // Capture the actual second-page boundary, without shrinking or hiding rows.
    await list().last().scrollIntoViewIfNeeded()
    if(process.env.REENTRY_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.REENTRY_SCREENSHOT_DIR}/dashboard-paginated-dark.png`,animations:'disabled'})
  })
  await t.test('landing retains purpose, guest note, workflow and keyboard entry across themes and sizes',async()=>{
    await page.goto(origin+'/')
    assert.equal(await page.getByRole('heading',{level:1}).count(),1)
    assert.equal(await page.getByRole('heading',{level:2}).count(),2)
    await page.getByRole('heading',{name:'O partido, xogada a xogada.',exact:true}).waitFor()
    const primary=page.getByRole('link',{name:'Comezar unha análise',exact:true})
    const secondary=page.getByRole('banner').getByRole('link',{name:'Abrir aplicación',exact:true})
    assert.equal(await primary.getAttribute('href'),'/app');assert.equal(await secondary.getAttribute('href'),'/app')
    await page.getByText('Podes probar como invitado. Para continuar, volve desde o mesmo navegador.',{exact:true}).waitFor()
    for(const text of ['Prepara o partido','Sincroniza vídeo e reloxo','Rexistra e revisa'])await page.getByText(text,{exact:true}).waitFor()
    await page.getByText(/En directo ou coa gravación/).waitFor()
    for(const theme of ['dark','light']){
      await setTheme(theme)
      await contrast()
      for(const width of [1440,1024,768,390,320]){
        await page.setViewportSize({width,height:900});await noOverflow(`landing ${theme} ${width}`)
        if(width===1440||width===390)await screenshot(`landing-${width===1440?'desktop':'mobile'}-${theme}`)
        await page.evaluate(()=>document.documentElement.style.fontSize='30px')
        await noOverflow(`landing ${theme} ${width} text 200%`)
        await focusWithKeyboard(secondary);await focusWithKeyboard(primary)
        await page.evaluate(()=>document.documentElement.style.fontSize='')
      }
    }
    // Enter follows the same real /app route as the header and lower entry links.
    rows=[];await focusWithKeyboard(primary);await page.keyboard.press('Enter')
    await page.getByRole('heading',{name:'Aínda non tes análises.',exact:true}).waitFor()
    assert.equal(new URL(page.url()).pathname,'/app')
  })
  assert.deepEqual(errors,[])
})
