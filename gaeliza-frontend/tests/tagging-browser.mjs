// Optional browser regressions, using external Playwright. No real Supabase calls.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { startBrowserHarness } from './helpers/browser-harness.mjs'
const port = process.env.TAGGING_SMOKE_PORT ?? '5187'
const origin = `http://127.0.0.1:${port}`
const workspace = {
  id: 'analysis', title: null, mode: 'live', status: 'draft', matchId: 'match', scheduledAt: null,
  homeTeam: { id: 'home', name: 'Home', shortName: null, logoPath: null },
  awayTeam: { id: 'away', name: 'Away', shortName: null, logoPath: null },
  periods: [{ id: 'period', number: 1, name: null, expectedDurationSeconds: 1800, homeAttacksTowards: null }],
  participants: ['home', 'away'].flatMap((teamId) => [1, 2].map((number) => ({
    id: `${teamId}${number}`, teamId, playerId: null, displayName: `${teamId} ${number}`,
    number, starter: null, initialGoalkeeper: null, position: null,
  }))), rosterPlayers: [],
  videos: [
    ['direct','Direct',`${origin}/fixture.webm`], ['youtube','YouTube','https://youtu.be/dQw4w9WgXcQ'],
    ['generic','External','https://example.test/watch?token=keep'], ['second','Second direct',`${origin}/second.webm`],
    ['broken','Broken direct',`${origin}/broken.webm`],
  ].map(([id,title,url],sortOrder)=>({id,title,url,sortOrder,provider:null,durationSeconds:60})),
  syncPoints: ['direct','youtube','generic','second','broken'].map(videoId=>({id:videoId,videoId,periodId:'period',videoSecond:10,secondInPeriod:0})),
}
const fact = (id, time) => ({
  event_id: id, updated_at:'2026-10-22T00:00:00.123456+00:00', event_type: 'shot', team_id: 'home', period_id: 'period', period_number: 1,
  second_in_period: time, raw_x: null, raw_y: null, score_value: 1, shot_result: 'point',
  recovery_method: null, turnover_cause: null, foul_outcome: null, card_type: null,
  kickout_length: null, kickout_result: null,
})
test('tagging browser regressions', async (t) => {
  const { browser } = await startBrowserHarness(t, { name: 'tagging', port, source: `
    import React, {useState} from 'react'
    import {createRoot} from 'react-dom/client'
    import {TaggingPanel} from '/src/v2/components/TaggingPanel'
    import '/src/v2/styles/global.css'
    import '/src/v2/styles/analysis-setup.css'
    import '/src/v2/styles/analysis-workspace.css'
    import '/src/v2/styles/video-sync.css'
    import '/src/v2/styles/tagging.css'
    function Harness() {
      const [workspace, setWorkspace] = useState(${JSON.stringify(workspace)})
      return <><button onClick={() => setWorkspace({...workspace, status:'completed'})}>Complete fixture</button>
        <button onClick={() => setWorkspace({...workspace, participants: workspace.participants.filter(p => p.id !== 'home2')})}>Drop fixture participant</button>
        <TaggingPanel workspace={workspace} onBack={() => {}} onWorkspaceChanged={async () => {
          const response = await fetch('/fixture-workspace')
          if (!response.ok) throw new Error('Workspace reload failed')
          setWorkspace({...workspace, status: (await response.json()).status})
        }} /></>
    }
    createRoot(document.getElementById('root')).render(<Harness />)
  ` })
  const page = await browser.newPage()
  page.setDefaultTimeout(5000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  let events = [fact('early', 0), fact('late', 20)]
  let status = 'draft'
  const writes = []
  let rebuilds = 0
  const edits=[]
  const editedRoles=new Map()
  let failEdit=false
  let holdMedia=null
  const media=await readFile(new URL('fixtures/tagging.webm',import.meta.url))
  const rolesFor=(id)=>editedRoles.get(id) ?? writes[Number(id.replace('saved',''))-1]?.p_participants ?? []
  let failReads = false
  let holdReads = null
  let readArrived = null
  const reply = (route, json, code = 200) => route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(json) })
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) return route.abort()
    if (['/fixture.webm','/second.webm'].includes(url.pathname)) {
      if(holdMedia) await holdMedia
      const match=route.request().headers().range?.match(/bytes=(\d+)-(\d*)/)
      const start=match?Number(match[1]):0
      const end=match?.[2]?Number(match[2]):media.length-1
      return route.fulfill({status:match?206:200,contentType:'video/webm',headers:{
        'Accept-Ranges':'bytes','Content-Length':String(end-start+1),
        ...(match?{'Content-Range':`bytes ${start}-${end}/${media.length}`}:{})
      },body:media.subarray(start,end+1)})
    }
    if(url.pathname==='/broken.webm')return route.fulfill({status:404,body:'not found'})
    if (url.pathname === '/fixture-workspace') return reply(route, { status })
    if (!url.pathname.startsWith('/rest/v1/')) return route.continue()
    if (url.pathname.endsWith('/analysis_event_facts')) {
      if(url.searchParams.get('event_id')?.startsWith('eq.'))return reply(route,events.find(e=>e.event_id===url.searchParams.get('event_id').slice(3)))
      assert.equal(url.searchParams.get('order'), 'period_sort_order.asc,second_in_period.asc,sort_order.asc,created_at.asc,event_id.asc')
      if (holdReads) { readArrived?.(); await holdReads }
      return failReads ? reply(route, { message: 'Read failed' }, 400) : reply(route, events)
    }
    if (url.pathname.endsWith('/event_participants')) {
      const filter=url.searchParams.get('event_id')
      if(filter.startsWith('eq.'))return reply(route,rolesFor(filter.slice(3)).map(p=>({analysis_participant_id:p.participant_id,role:p.role})))
      const ids = filter.slice(4, -1).split(',')
      return reply(route, ids.flatMap((id) => {
        return rolesFor(id).map((role) => {
          const participant = workspace.participants.find((p) => p.id === role.participant_id)
          return { event_id: id, role: role.role, participant: participant ? {
            id: participant.id, number: participant.number, display_name_snapshot: participant.displayName,
          } : null }
        })
      }))
    }
    if(url.pathname.endsWith('/events') && route.request().method()==='GET')return reply(route,{updated_at:events.find(e=>e.event_id===url.searchParams.get('id').slice(3)).updated_at})
    if(url.pathname.endsWith('/rpc/update_event')) {
      const input=route.request().postDataJSON();edits.push(input)
      if(failEdit)return reply(route,{code:'23514',message:'Fixture rejected edit'},400)
      const event=events.find(e=>e.event_id===input.p_event_id)
      assert.equal(input.p_expected_updated_at,event.updated_at)
      Object.assign(event,{team_id:input.p_team_id,period_id:input.p_period_id,second_in_period:input.p_second_in_period,raw_x:input.p_x,raw_y:input.p_y,
        updated_at:`2026-10-22T00:00:${String(edits.length).padStart(2,'0')}.654321+00:00`,
        shot_result:event.event_type==='shot'?input.p_detail.result:null,shot_technique:input.p_detail.technique,
        shot_situation:input.p_detail.situation,pass_result:event.event_type==='pass'?input.p_detail.result:null,
        pass_technique:input.p_detail.technique,pass_raw_end_x:input.p_detail.end_x,pass_raw_end_y:input.p_detail.end_y})
      editedRoles.set(event.event_id,input.p_participants)
      events.sort((a,b)=>a.second_in_period-b.second_in_period)
      return reply(route,event.event_id)
    }
    if (url.pathname.endsWith('/rpc/log_event') || url.pathname.endsWith('/rpc/log_foul_with_optional_card')) {
      const input = route.request().postDataJSON()
      const composite=url.pathname.endsWith('/rpc/log_foul_with_optional_card')
      if(composite) { assert.equal(input.p_card_type,null); input.p_event_type='foul' }
      writes.push(input); status = 'in_progress'
      events = [...events, { ...fact(`saved${writes.length}`, input.p_second_in_period), event_type: input.p_event_type,
        team_id: input.p_team_id, raw_x: input.p_x, raw_y: input.p_y,
        shot_result: input.p_event_type === 'shot' ? input.p_detail.result ?? null : null,
        pass_result: input.p_event_type === 'pass' ? input.p_detail.result ?? null : null,
        pass_technique: input.p_detail.technique ?? null, pass_raw_end_x:input.p_detail.end_x, pass_raw_end_y:input.p_detail.end_y, duel_type: input.p_detail.duel_type ?? null,
        dribble_result: input.p_event_type === 'dribble' ? input.p_detail.result ?? null : null,
        restart_type: input.p_detail.restart_type ?? null,
      }].sort((a, b) => a.second_in_period - b.second_in_period)
      return reply(route, composite ? {foul_event_id:`saved${writes.length}`,card_event_id:null} : `saved${writes.length}`)
    }
    if (url.pathname.endsWith('/rpc/rebuild_inferred_possessions')) { rebuilds++; return reply(route, 2) }
    if (url.pathname.endsWith('/events') && route.request().method() === 'DELETE') {
      const id = url.searchParams.get('id').slice(3)
      events = events.filter((event) => event.event_id !== id)
      return reply(route, { id })
    }
    if (url.pathname.endsWith('/analyses') && route.request().method() === 'PATCH') {
      status = 'in_progress'; return reply(route, { id: workspace.id })
    }
    throw new Error(`Unexpected request ${url.pathname}`)
  })
  await page.goto(`${origin}/node_modules/.tagging-smoke/index.html`)
  const save = page.getByRole('button', { name: /^(Gardar |Gardando)/ })
  const idle = () => page.waitForFunction(() => document.querySelector('.tagging-save-button') && !document.querySelector('.tagging-save-button').disabled)
  await save.waitFor(); await idle()
  await t.test('timeline is chronological', async () => {
    assert.deepEqual(await page.locator('.timeline-event-time strong').allTextContents(), ['0:00', '0:20'])
  })
  await t.test('team and shot result changes clear incompatible participants', async () => {
    await page.getByLabel(/^Tirador/).selectOption('home1')
    await page.getByLabel(/^Asistencia/).selectOption('home2')
    await page.getByLabel(/^Equipo\ do\ evento/).selectOption('away')
    assert.equal(await page.getByLabel(/^Tirador/).inputValue(), '')
    assert.equal(await page.getByLabel(/^Asistencia/).inputValue(), '')
    await page.getByLabel(/^Resultado/).selectOption('saved')
    await page.getByLabel(/^Porteiro\ rival/).selectOption('home1')
    await page.getByLabel(/^Resultado/).selectOption('blocked')
    assert.equal(await page.getByLabel(/^Bloqueador\ rival/).inputValue(), '')
  })
  await t.test('zero coordinates and temporary IDs use one RPC; capture stays locked until refresh', async () => {
    await page.getByLabel(/^Tirador/).selectOption('away1')
    await page.getByLabel(/^Bloqueador\ rival/).selectOption('home1')
    await page.getByLabel('X', { exact: true }).fill('0'); await page.getByLabel('Y', { exact: true }).fill('0')
    assert.equal(await page.locator('.pitch-marker').evaluate((node) => node.style.left), '0%')
    let release
    holdReads = new Promise((resolve) => { release = resolve })
    const arrived = new Promise((resolve) => { readArrived = resolve })
    await save.click(); await arrived
    assert.equal(await save.isDisabled(), true)
    release(); holdReads = null; await idle()
    assert.equal(writes.length, 1)
    assert.deepEqual(writes[0].p_participants, [{ participant_id: 'away1', role: 'shooter' }, { participant_id: 'home1', role: 'blocker' }])
    assert.equal(writes[0].p_x, 0); assert.equal(writes[0].p_y, 0)
    assert.equal(status, 'in_progress'); assert.equal(rebuilds, 0)
  })
  for (const [label, type] of [['Recuperación', 'recovery'], ['Perda', 'turnover'], ['Falta', 'foul'], ['Tarxeta', 'card'], ['Saque de porta', 'kickout'], ['Bloqueo', 'block']]) {
    await t.test(`team-only ${type}`, async () => {
      await page.getByRole('button', { name: label, exact: true }).click(); await save.click(); await idle()
      assert.equal(writes.at(-1).p_event_type, type); assert.deepEqual(writes.at(-1).p_participants, [])
      if (type === 'kickout') assert.equal(writes.at(-1).p_detail.length, 'short')
    })
  }
  await t.test('inference runs only when requested', async () => {
    assert.equal(rebuilds, 0)
    await page.getByRole('button', { name: 'Inferir posesións' }).click(); await idle()
    assert.equal(rebuilds, 1)
  })
  await t.test('committed write and failed read block duplicate capture; refresh recovers', async () => {
    failReads = true; await save.click()
    await page.getByText(/A acción gardouse, pero fallou a recarga/).waitFor()
    assert.equal(await save.isDisabled(), true)
    const committed = writes.length
    failReads = false; await page.getByRole('button', { name: 'Recargar datos' }).click(); await idle()
    assert.equal(writes.length, committed)
  })
  await t.test('completed pass preserves raw origin and destination zero in one RPC', async () => {
    await page.getByRole('button', { name: 'Pase', exact: true }).click()
    await page.getByLabel(/^Equipo do evento/).selectOption('home')
    await page.getByLabel(/^Resultado do pase/).selectOption('completed')
    await page.getByLabel(/^Técnica do pase/).selectOption('foot')
    await page.getByLabel(/^Pasador/).selectOption('home1')
    await page.getByLabel(/^Receptor/).selectOption('home2')
    await page.getByLabel('X', { exact: true }).fill('0'); await page.getByLabel('Y', { exact: true }).fill('0')
    await page.getByLabel('Destino X', { exact: true }).fill('0'); await page.getByLabel('Destino Y', { exact: true }).fill('0')
    const before = writes.length
    await save.click(); await idle()
    assert.equal(writes.length, before + 1)
    assert.equal(writes.at(-1).p_event_type, 'pass')
    assert.deepEqual(writes.at(-1).p_detail, { result: 'completed', technique: 'foot', end_x: 0, end_y: 0 })
    assert.equal(writes.at(-1).p_x, 0); assert.equal(writes.at(-1).p_y, 0)
    assert.deepEqual(writes.at(-1).p_participants.map((p) => p.role), ['passer', 'receiver'])
    await page.getByText('Completado · Pé', { exact: false }).first().waitFor()
  })
  await t.test('pass result and team changes clean receiver/interceptor state; each pass is one event', async () => {
    await page.getByLabel(/^Pasador/).selectOption('home1')
    await page.getByLabel(/^Receptor/).selectOption('home2')
    await page.getByLabel(/^Resultado do pase/).selectOption('intercepted')
    assert.equal(await page.getByLabel(/^Receptor previsto/).inputValue(), '')
    await page.getByLabel(/^Receptor previsto/).selectOption('home2')
    await page.getByLabel(/^Interceptor rival/).selectOption('away1')
    await page.getByLabel(/^Resultado do pase/).selectOption('incomplete')
    assert.equal(await page.getByLabel(/^Interceptor rival/).count(), 0)
    assert.equal(await page.getByLabel(/^Receptor previsto/).inputValue(), 'home2')
    await save.click(); await idle()
    assert.deepEqual(writes.at(-1).p_participants.map((p) => p.role), ['passer', 'intended_receiver'])
    await page.getByLabel(/^Resultado do pase/).selectOption('intercepted')
    await page.getByLabel(/^Pasador/).selectOption('home1')
    await page.getByLabel(/^Receptor previsto/).selectOption('home2')
    await page.getByLabel(/^Interceptor rival/).selectOption('away1')
    await page.getByLabel(/^Equipo do evento/).selectOption('away')
    assert.equal(await page.getByLabel(/^Pasador/).inputValue(), '')
    assert.equal(await page.getByLabel(/^Interceptor rival/).inputValue(), '')
    await page.getByLabel(/^Equipo do evento/).selectOption('home')
    await page.getByLabel(/^Pasador/).selectOption('home1')
    await page.getByLabel(/^Receptor previsto/).selectOption('home2')
    await page.getByLabel(/^Interceptor rival/).selectOption('away1')
    const before = writes.length
    await save.click(); await idle()
    assert.equal(writes.length, before + 1)
    assert.equal(writes.at(-1).p_event_type, 'pass')
    assert.deepEqual(writes.at(-1).p_participants.map((p) => p.role), ['passer', 'intended_receiver', 'interceptor'])
    assert.equal(rebuilds, 1)
  })
  for (const [label, type, detailLabel, detail, roles] of [
    ['Duelo', 'duel', /^Tipo de duelo/, 'aerial', [[/^Gañador do duelo/, 'home1'], [/^Perdedor rival/, 'away1']]],
    ['Regate', 'dribble', /^Resultado do regate/, 'successful', [[/^Regateador/, 'home1'], [/^Defensor rival/, 'away1']]],
    ['Regate', 'dribble', /^Resultado do regate/, 'failed', []],
    ['Reinicio', 'restart', /^Tipo de reinicio/, 'sideline', [[/^Executor do reinicio/, 'home1']]],
    ['Substitución', 'substitution', null, null, [[/^Xogador que sae/, 'home1'], [/^Xogador que entra/, 'home2']]],
    ['Cambio de porteiro', 'goalkeeper_change', null, null, [[/^Porteiro que sae/, 'home1'], [/^Porteiro que entra/, 'home2']]],
  ]) {
    await t.test(`extended capture ${type} ${detail ?? 'roles'}`, async () => {
      await page.getByRole('button', { name: label, exact: true }).click()
      if (detailLabel) await page.getByLabel(detailLabel).selectOption(detail)
      for (const [roleLabel, id] of roles) await page.getByLabel(roleLabel).selectOption(id)
      await save.click(); await idle()
      assert.equal(writes.at(-1).p_event_type, type)
      assert.deepEqual(writes.at(-1).p_participants.map((p) => p.participant_id), roles.map(([, id]) => id))
      if (type === 'substitution' || type === 'goalkeeper_change') {
        await page.getByText('#1 → #2', { exact: false }).first().waitFor()
        assert.deepEqual(writes.at(-1).p_detail, {})
      }
      assert.equal(rebuilds, 1)
    })
  }
  await t.test('changing type resets details/roles and destination; absent identities remain optional', async () => {
    await page.getByRole('button', { name: 'Pase', exact: true }).click()
    await page.getByLabel(/^Resultado do pase/).selectOption('intercepted')
    await page.getByLabel(/^Interceptor rival/).selectOption('away1')
    await page.getByLabel('Destino X', { exact: true }).fill('0'); await page.getByLabel('Destino Y', { exact: true }).fill('0')
    await page.getByRole('button', { name: 'Duelo', exact: true }).click()
    await page.getByRole('button', { name: 'Pase', exact: true }).click()
    assert.equal(await page.getByLabel(/^Resultado do pase/).inputValue(), '')
    assert.equal(await page.getByLabel('Destino X', { exact: true }).inputValue(), '')
    assert.equal(await page.getByLabel(/^Pasador/).inputValue(), '')
    for (const label of ['Pase', 'Duelo', 'Regate', 'Reinicio', 'Substitución', 'Cambio de porteiro']) {
      await page.getByRole('button', { name: label, exact: true }).click()
      await save.click(); await idle()
      assert.deepEqual(writes.at(-1).p_participants, [])
    }
  })
  await page.getByRole('button', {name: /^Mostrar \d+ anteriores$/}).click()
  await t.test('edit loads the full event, cancel changes nothing, type cannot change',async()=>{
    await page.getByRole('button',{name:'Editar',exact:true}).first().click()
    await page.getByRole('button',{name:'Gardar cambios',exact:true}).waitFor()
    assert.equal(await page.getByLabel('Tempo no período').inputValue(),'0:00')
    assert.equal(await page.getByLabel(/^Resultado/).inputValue(),'point')
    assert.equal(await page.getByRole('group',{name:'Tipo de evento'}).count(),0)
    await page.getByLabel('Tempo no período').fill('0:11')
    await page.getByRole('button',{name:'Cancelar edición'}).click();await idle()
    assert.equal(edits.length,0)
    assert.equal(events.find(e=>e.event_id==='early').second_in_period,0)
  })
  await t.test('failed edit retains editor and original timeline; success reloads without another event',async()=>{
    const count=events.length
    await page.getByRole('button',{name:'Editar',exact:true}).first().click()
    const update=page.getByRole('button',{name:'Gardar cambios',exact:true});await update.waitFor()
    await page.getByLabel('Tempo no período').fill('0:11')
    await page.getByLabel('X',{exact:true}).fill('0');await page.getByLabel('Y',{exact:true}).fill('0')
    await page.getByLabel(/^Técnica/).selectOption('foot')
    await page.getByLabel(/^Situación/).selectOption('penalty')
    failEdit=true;await update.click()
    await page.getByText(/Fixture rejected edit/).waitFor()
    assert.equal(events.find(e=>e.event_id==='early').second_in_period,0)
    assert.equal(await update.count(),1)
    failEdit=false;await update.click();await idle()
    assert.equal(events.length,count);assert.equal(events.find(e=>e.event_id==='early').second_in_period,11)
    assert.equal(edits.at(-1).p_x,0);assert.equal(edits.at(-1).p_y,0)
    assert.equal(edits.at(-1).p_detail.technique,'foot');assert.equal(edits.at(-1).p_detail.situation,'penalty')
    assert.equal(await page.getByRole('button',{name:'Gardar cambios',exact:true}).count(),0)
    await page.getByText(/Revisa e reconstrúe explicitamente/).waitFor()
    assert.equal(rebuilds,1)
    await page.getByRole('button',{name:'Inferir posesións'}).click();await idle()
    assert.equal(rebuilds,2)
  })
  await t.test('edit pass switches receiver to intended receiver/interceptor and preserves zero destination',async()=>{
    const pass=events.find(e=>e.event_type==='pass'&&e.pass_result==='completed')
    const row=()=>page.locator('.timeline-event').nth(events.indexOf(pass))
    await row().getByRole('button',{name:'Editar',exact:true}).click()
    const update=page.getByRole('button',{name:'Gardar cambios',exact:true});await update.waitFor()
    assert.equal(await page.getByLabel('Destino X',{exact:true}).inputValue(),'0')
    assert.equal(await page.getByLabel(/^Receptor/).inputValue(),'home2')
    await page.getByLabel(/^Resultado do pase/).selectOption('intercepted')
    assert.equal(await page.getByLabel(/^Receptor previsto/).inputValue(),'')
    await page.getByLabel(/^Receptor previsto/).selectOption('home2')
    await page.getByLabel(/^Interceptor rival/).selectOption('away1')
    await page.getByLabel(/^Equipo do evento/).selectOption('away')
    assert.equal(await page.getByLabel(/^Interceptor rival/).inputValue(),'')
    await page.getByLabel(/^Equipo do evento/).selectOption('home')
    await page.getByLabel(/^Receptor previsto/).selectOption('home2')
    await page.getByLabel(/^Interceptor rival/).selectOption('away1')
    await update.click();await idle()
    assert.equal(edits.at(-1).p_event_id,pass.event_id)
    assert.deepEqual(edits.at(-1).p_participants.map(p=>p.role),['intended_receiver','interceptor'])
    assert.equal(edits.at(-1).p_detail.end_x,0);assert.equal(edits.at(-1).p_detail.end_y,0)
    assert.equal(pass.pass_result,'intercepted')
  })
  await t.test('all synchronized videos are accessible; YouTube seeks and generic links degrade explicitly',async()=>{
    const row=page.locator('.timeline-event').first()
    const youtube=row.getByRole('button',{name:/Ir ao vídeo: YouTube/})
    await youtube.click()
    const embed=page.locator('.youtube-player')
    assert.match(await embed.getAttribute('src'),/youtube-nocookie.com\/embed\/dQw4w9WgXcQ\?start=10/)
    assert.match(await embed.getAttribute('src'),/autoplay=0/)
    await page.getByRole('button',{name:'Ocultar vídeo'}).click()
    assert.equal(await embed.count(),0)
    const generic=row.getByRole('link',{name:/Abrir orixinal: External/})
    assert.equal(await generic.getAttribute('href'),'https://example.test/watch?token=keep')
    assert.match(await generic.textContent(),/salto exacto non dispoñible/)
    assert.equal(await row.getByRole('button',{name:/Second direct/}).count(),1)
    assert.equal(await page.locator('video').count(),0)
  })
  await t.test('direct video keeps latest seek pending metadata, changes resource, bounds actual duration and handles errors',async()=>{
    let release;holdMedia=new Promise(resolve=>{release=resolve})
    const directButtons=page.getByRole('button',{name:/Ir ao vídeo: Direct/})
    await directButtons.first().click()
    await page.locator('video').waitFor()
    assert.equal(await page.locator('video').evaluate(v=>v.autoplay),false)
    await directButtons.last().click()
    const lastSecond=10+events.at(-1).second_in_period
    release();holdMedia=null
    await page.waitForFunction(second=>{const v=document.querySelector('video');return v.readyState>=1&&Math.abs(v.currentTime-second)<0.1},lastSecond).catch(async(error)=>{
      t.diagnostic(JSON.stringify({expected:lastSecond,media:await page.locator('video').evaluate(v=>({time:v.currentTime,duration:v.duration,ready:v.readyState,error:v.error?.message,src:v.src})),alerts:await page.getByRole('alert').allTextContents()}))
      throw error
    })
    assert.equal(await page.locator('video').evaluate(v=>v.paused),true)
    await page.getByRole('button',{name:/Ir ao vídeo: Second direct/}).first().click()
    await page.waitForFunction(()=>document.querySelector('video')?.src.endsWith('/second.webm')&&document.querySelector('video').readyState>=1)
    await page.locator('video').evaluate(v=>{Object.defineProperty(v,'duration',{value:1,configurable:true})})
    await page.getByRole('button',{name:/Ir ao vídeo: Second direct/}).first().click()
    await page.getByText(/O instante queda fóra/).waitFor()
    await page.getByRole('button',{name:/Ir ao vídeo: Broken direct/}).first().click()
    await page.getByText(/Non foi posible cargar o vídeo/).waitFor()
  })
  await t.test('removed roster participant is cleared before capture', async () => {
    await page.getByRole('button', { name: 'Pase', exact: true }).click()
    await page.getByLabel(/^Resultado do pase/).selectOption('completed')
    await page.getByLabel(/^Receptor/).selectOption('home2')
    await page.getByRole('button', { name: 'Drop fixture participant' }).click()
    assert.equal(await page.getByLabel(/^Receptor/).inputValue(), '')
    await save.click(); await idle()
    assert.deepEqual(writes.at(-1).p_participants, [])
  })
  await t.test('completed blocks capture, deletion and inference until reopening', async () => {
    await page.getByRole('button', { name: 'Complete fixture' }).click()
    assert.equal(await save.count(), 0)
    assert.equal(await page.getByRole('button',{name:'Editar',exact:true}).first().isDisabled(),true)
    await page.getByRole('button',{name:/Ir ao vídeo: Direct/}).first().click()
    await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1)
    assert.equal(await page.getByRole('button',{name:/Ir ao vídeo: YouTube/}).first().isEnabled(),true)
    for (const label of ['Pase', 'Duelo', 'Regate', 'Reinicio', 'Substitución', 'Cambio de porteiro']) assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Inferir posesións' }).isDisabled(), true)
    assert.equal(await page.getByRole('button', { name: 'Quitar', exact: true }).first().isDisabled(), true)
    await page.getByRole('button', { name: 'Reabrir análise' }).click(); await idle()
    assert.equal(await save.isEnabled(), true)
  })
  assert.deepEqual(errors, [])
})
