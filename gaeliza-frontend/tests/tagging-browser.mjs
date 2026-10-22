// Optional browser regressions, using external Playwright. No real Supabase calls.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
const { chromium } = createRequire(import.meta.url)('playwright')
const root = new URL('../', import.meta.url)
const harness = new URL('node_modules/.tagging-smoke/', root)
const origin = 'http://127.0.0.1:5187'
const workspace = {
  id: 'analysis', title: null, mode: 'live', status: 'draft', matchId: 'match', scheduledAt: null,
  homeTeam: { id: 'home', name: 'Home', shortName: null, logoPath: null },
  awayTeam: { id: 'away', name: 'Away', shortName: null, logoPath: null },
  periods: [{ id: 'period', number: 1, name: null, expectedDurationSeconds: 1800, homeAttacksTowards: null }],
  participants: ['home', 'away'].flatMap((teamId) => [1, 2].map((number) => ({
    id: `${teamId}${number}`, teamId, playerId: null, displayName: `${teamId} ${number}`,
    number, starter: null, initialGoalkeeper: null, position: null,
  }))), rosterPlayers: [], videos: [], syncPoints: [],
}
const fact = (id, time) => ({
  event_id: id, event_type: 'shot', team_id: 'home', period_id: 'period', period_number: 1,
  second_in_period: time, raw_x: null, raw_y: null, score_value: 1, shot_result: 'point',
  recovery_method: null, turnover_cause: null, foul_outcome: null, card_type: null,
  kickout_length: null, kickout_result: null,
})
test('tagging browser regressions', async (t) => {
  await mkdir(harness, { recursive: true })
  await writeFile(new URL('index.html', harness), '<div id="root"></div><script type="module" src="./harness.tsx"></script>')
  await writeFile(new URL('harness.tsx', harness), `
    import React, {useState} from 'react'
    import {createRoot} from 'react-dom/client'
    import {TaggingPanel} from '/src/v2/components/TaggingPanel'
    import '/src/v2/styles/global.css'
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
  `)
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5187', '--strictPort'], {
    cwd: root, env: { ...process.env, VITE_SUPABASE_URL: origin, VITE_SUPABASE_ANON_KEY: 'browser-fixture-public-key' }, stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  server.stdout.on('data', (chunk) => { output += chunk })
  server.stderr.on('data', (chunk) => { output += chunk })
  let browser
  t.after(async () => {
    if (browser) await browser.close()
    if (server.exitCode === null) { const ended = once(server, 'exit'); server.kill('SIGTERM'); await ended }
    await rm(harness, { recursive: true, force: true })
  })
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(origin)).ok) break } catch { /* starting */ }
    if (attempt > 100 || server.exitCode !== null) throw new Error(output)
    await delay(50)
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  page.setDefaultTimeout(5000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  let events = [fact('early', 0), fact('late', 20)]
  let status = 'draft'
  const writes = []
  let rebuilds = 0
  let failReads = false
  let holdReads = null
  let readArrived = null
  const reply = (route, json, code = 200) => route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(json) })
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) return route.abort()
    if (url.pathname === '/fixture-workspace') return reply(route, { status })
    if (!url.pathname.startsWith('/rest/v1/')) return route.continue()
    if (url.pathname.endsWith('/analysis_event_facts')) {
      assert.equal(url.searchParams.get('order'), 'period_sort_order.asc,second_in_period.asc,sort_order.asc,created_at.asc,event_id.asc')
      if (holdReads) { readArrived?.(); await holdReads }
      return failReads ? reply(route, { message: 'Read failed' }, 400) : reply(route, events)
    }
    if (url.pathname.endsWith('/event_participants')) {
      const ids = url.searchParams.get('event_id').slice(4, -1).split(',')
      return reply(route, ids.flatMap((id) => {
        const input = writes[Number(id.replace('saved', '')) - 1]
        return (input?.p_participants ?? []).map((role) => {
          const participant = workspace.participants.find((p) => p.id === role.participant_id)
          return { event_id: id, role: role.role, participant: participant ? {
            id: participant.id, number: participant.number, display_name_snapshot: participant.displayName,
          } : null }
        })
      }))
    }
    if (url.pathname.endsWith('/rpc/log_event')) {
      const input = route.request().postDataJSON()
      writes.push(input); status = 'in_progress'
      events = [...events, { ...fact(`saved${writes.length}`, input.p_second_in_period), event_type: input.p_event_type,
        team_id: input.p_team_id, raw_x: input.p_x, raw_y: input.p_y,
        shot_result: input.p_event_type === 'shot' ? input.p_detail.result ?? null : null,
        pass_result: input.p_event_type === 'pass' ? input.p_detail.result ?? null : null,
        pass_technique: input.p_detail.technique ?? null, duel_type: input.p_detail.duel_type ?? null,
        dribble_result: input.p_event_type === 'dribble' ? input.p_detail.result ?? null : null,
        restart_type: input.p_detail.restart_type ?? null,
      }].sort((a, b) => a.second_in_period - b.second_in_period)
      return reply(route, `saved${writes.length}`)
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
  const idle = () => page.waitForFunction(() => !document.querySelector('.tagging-save-button').disabled)
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
    await page.getByLabel(/^Resultado\ \*/).selectOption('saved')
    await page.getByLabel(/^Porteiro\ rival/).selectOption('home1')
    await page.getByLabel(/^Resultado\ \*/).selectOption('blocked')
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
    await page.getByText('completed · foot', { exact: false }).first().waitFor()
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
    assert.equal(await save.isDisabled(), true)
    for (const label of ['Pase', 'Duelo', 'Regate', 'Reinicio', 'Substitución', 'Cambio de porteiro']) assert.equal(await page.getByRole('button', { name: label, exact: true }).isDisabled(), true)
    assert.equal(await page.getByRole('button', { name: 'Inferir posesións' }).isDisabled(), true)
    assert.equal(await page.getByRole('button', { name: 'Quitar', exact: true }).first().isDisabled(), true)
    await page.getByRole('button', { name: 'Reabrir análise' }).click(); await idle()
    assert.equal(await save.isEnabled(), true)
  })
  assert.deepEqual(errors, [])
})
