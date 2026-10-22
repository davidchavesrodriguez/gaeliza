// Real React provider/router and SDK. Fault injection uses only public Auth APIs;
// the persisted-refresh scenario exercises the unmodified SDK against local HTTP.
import assert from 'node:assert/strict'
import test from 'node:test'
import { startBrowserHarness } from './helpers/browser-harness.mjs'

const owner='00000000-0000-0000-0000-000000000001'
function sessionFor(id=owner,expired=false){
  const now=Math.floor(Date.now()/1000),exp=now+(expired?-300:3600)
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
  return {access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:id,aud:'authenticated',role:'authenticated',iat:now-600,exp})}.Zml4dHVyZQ`,
    refresh_token:expired?'persisted-refresh-fixture':'renewed-refresh-fixture',expires_at:exp,expires_in:3600,token_type:'bearer',
    user:{id,aud:'authenticated',role:'authenticated',is_anonymous:true,app_metadata:{},user_metadata:{},created_at:'2026-10-22T00:00:00Z'}}
}
const source=`
  import {StrictMode,useState} from 'react'
  import {createRoot} from 'react-dom/client'
  import {RouterProvider} from 'react-router-dom'
  import {AuthProvider} from '/src/v2/auth/AuthProvider'
  import {useAuth} from '/src/v2/auth/auth-context'
  import {supabase} from '/src/v2/lib/supabase'
  import {router} from '/src/v2/app/router'
  import '/src/v2/styles/global.css'
  const existing=${JSON.stringify(sessionFor())}
  let mode=window.authFixtureMode||'existing'
  let current=JSON.parse(localStorage.getItem('auth-fixture-session')||'null')||(['none','guest-error'].includes(mode)?null:existing)
  const callbacks=new Set(),saved=[]
  let resolveInitial
  const pending=new Promise(resolve=>{resolveInitial=resolve})
  const reply=(session,error=null)=>({data:{session},error})
  const metrics={reads:0,guests:0,registrations:0,unsubscriptions:0,active:0}
  const emit=(event,session)=>{current=session;for(const callback of callbacks)callback(event,session)}
  window.authControl={metrics,
    resolve:()=>{mode='existing';current=existing;localStorage.setItem('auth-fixture-session',JSON.stringify(current));resolveInitial(reply(current))},
    recover:()=>{mode='existing';current=existing},
    emit:(event,token)=>emit(event,{...existing,access_token:token}),
    emitStale:()=>saved.forEach(callback=>callback('SIGNED_IN',existing)),
  }
  if(mode!=='real'){
    supabase.auth.getSession=async()=>{
      metrics.reads++
      if(mode==='slow')return pending
      if(mode==='throw')throw new Error('Fixture rejected recovery')
      if(mode==='error')return reply(null,new Error('Fixture refresh failed'))
      return reply(current)
    }
    supabase.auth.signInAnonymously=async()=>{
      metrics.guests++
      if(mode==='guest-error')return reply(null,new Error('Fixture guest creation failed'))
      const guest={...existing,user:{...existing.user,id:'00000000-0000-0000-0000-000000000002'}}
      localStorage.setItem('auth-fixture-session',JSON.stringify(guest));emit('SIGNED_IN',guest)
      return reply(guest)
    }
    supabase.auth.onAuthStateChange=callback=>{
      metrics.registrations++;callbacks.add(callback);saved.push(callback);metrics.active=callbacks.size
      callback('INITIAL_SESSION',null)
      return {data:{subscription:{unsubscribe:()=>{metrics.unsubscriptions++;callbacks.delete(callback);metrics.active=callbacks.size}}}}
    }
  }else{
    const listen=supabase.auth.onAuthStateChange.bind(supabase.auth)
    supabase.auth.onAuthStateChange=callback=>{
      metrics.registrations++;metrics.active++
      const result=listen(callback),unsubscribe=result.data.subscription.unsubscribe
      result.data.subscription.unsubscribe=()=>{metrics.active--;unsubscribe()}
      return result
    }
    const guest=supabase.auth.signInAnonymously.bind(supabase.auth)
    supabase.auth.signInAnonymously=(...args)=>{metrics.guests++;return guest(...args)}
  }
  function Probe(){const {session,status}=useAuth();return <output hidden id="auth-probe" data-status={status} data-user={session?.user.id||''} data-token={session?.access_token||''}/>}
  function Harness(){const [mounted,setMounted]=useState(true);return <>
    <button id="toggle-provider" onClick={()=>setMounted(value=>!value)}>{mounted?'Unmount fixture':'Mount fixture'}</button>
    {mounted?<AuthProvider><Probe/><RouterProvider router={router}/></AuthProvider>:null}
  </>}
  createRoot(document.getElementById('root')).render(<StrictMode><Harness/></StrictMode>)
`

test('auth/app recovery under React StrictMode, without remote Supabase',async(t)=>{
  const {browser,origin,html}=await startBrowserHarness(t,{name:'auth',port:5197,source})
  async function scene(t,mode,{clock=false,stored=null,holdRefresh=null}={}){
    const context=await browser.newContext();t.after(()=>context.close())
    await context.addInitScript(({mode,stored})=>{
      window.authFixtureMode=mode
      localStorage.setItem('identity-marker','keep-this-browser-data')
      if(stored&&!localStorage.getItem('sb-127-auth-token'))localStorage.setItem('sb-127-auth-token',JSON.stringify(stored))
    },{mode,stored})
    const page=await context.newPage();page.setDefaultTimeout(5000)
    if(clock)await page.clock.install()
    const errors=[],requests={dashboard:0,refresh:0,anonymous:0}
    page.on('pageerror',error=>errors.push(error.message));t.after(()=>assert.deepEqual(errors,[]))
    await page.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url())
      if(url.origin!==origin)return route.abort()
      if(request.isNavigationRequest())return route.fulfill({contentType:'text/html',body:html})
      if(url.pathname==='/auth/v1/token'){
        requests.refresh++;assert.equal(request.postDataJSON().refresh_token,'persisted-refresh-fixture')
        if(holdRefresh)await holdRefresh
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(sessionFor())})
      }
      if(url.pathname==='/auth/v1/signup'){requests.anonymous++;throw new Error('Unexpected replacement anonymous identity')}
      if(url.pathname==='/rest/v1/analyses'){
        requests.dashboard++
        return route.fulfill({contentType:'application/json',body:'[]'})
      }
      if(url.pathname.startsWith('/auth/')||url.pathname.startsWith('/rest/'))throw new Error('Unexpected local API: '+url.pathname)
      return route.continue()
    })
    return {page,requests,metrics:()=>page.evaluate(()=>window.authControl.metrics)}
  }
  const ready=page=>page.getByRole('heading',{name:'As túas análises',exact:true}).waitFor()
  const loading=page=>page.getByText('Preparando a túa sesión…',{exact:true}).waitFor()
  const failed=page=>page.getByRole('heading',{name:'Non foi posible recuperar a sesión.',exact:true}).waitFor()

  await t.test('existing anonymous identity enters the app and survives reload without guest creation',async(t)=>{
    const {page,metrics}=await scene(t,'existing');await page.goto(origin+'/app');await ready(page)
    assert.equal(await page.locator('#auth-probe').getAttribute('data-user'),owner)
    assert.equal((await metrics()).guests,0);assert.equal((await metrics()).active,1)
    await page.reload();await ready(page)
    assert.equal((await metrics()).guests,0);assert.equal((await metrics()).registrations,1)
    assert.equal(await page.evaluate(()=>localStorage.getItem('identity-marker')),'keep-this-browser-data')
  })
  await t.test('empty storage creates exactly one guest; reload reuses that persisted identity',async(t)=>{
    const {page,metrics}=await scene(t,'none');await page.goto(origin+'/app');await ready(page)
    assert.equal((await metrics()).guests,1);const identity=await page.locator('#auth-probe').getAttribute('data-user')
    await page.reload();await ready(page)
    assert.equal((await metrics()).guests,0);assert.equal(await page.locator('#auth-probe').getAttribute('data-user'),identity)
  })
  await t.test('slow initial recovery has no listener before completion; unmount/remount leaves one live subscription',async(t)=>{
    const {page,metrics}=await scene(t,'slow');await page.goto(origin+'/app');await loading(page)
    assert.equal((await metrics()).reads,1);assert.equal((await metrics()).registrations,0)
    await page.locator('#toggle-provider').click();await page.locator('#toggle-provider').click();await loading(page)
    assert.equal((await metrics()).reads,1)
    await page.evaluate(()=>window.authControl.resolve());await ready(page)
    assert.equal((await metrics()).active,1);assert.equal((await metrics()).registrations,1)
    for(const event of ['TOKEN_REFRESHED','SIGNED_IN']){
      await page.evaluate(event=>window.authControl.emit(event,event),event)
      await page.waitForFunction(token=>document.querySelector('#auth-probe').dataset.token===token,event)
    }
    await page.locator('#toggle-provider').click();assert.equal((await metrics()).active,0)
    await page.evaluate(()=>window.authControl.emitStale())
    assert.equal(await page.locator('#auth-probe').count(),0)
    await page.locator('#toggle-provider').click();await ready(page)
    assert.equal((await metrics()).active,1);assert.equal((await metrics()).registrations,2)
  })
  await t.test('retry after guest creation fails cleans the ready listener once and recovers an available identity',async(t)=>{
    const {page,metrics}=await scene(t,'guest-error');await page.goto(origin+'/app')
    await page.getByRole('heading',{name:'Non foi posible iniciar a sesión de invitado.',exact:true}).waitFor()
    assert.equal((await metrics()).guests,1);assert.equal((await metrics()).active,1)
    await page.evaluate(()=>window.authControl.recover());await page.getByRole('button',{name:'Tentar de novo'}).click();await ready(page)
    assert.equal((await metrics()).guests,1);assert.equal((await metrics()).active,1)
    assert.equal((await metrics()).registrations,2);assert.equal((await metrics()).unsubscriptions,1)
  })
  for(const mode of ['error','throw'])await t.test(`${mode} leaves loading and retry recovers without replacing a saved session`,async(t)=>{
    const {page,metrics}=await scene(t,mode);await page.goto(origin+'/app');await failed(page)
    assert.equal((await metrics()).guests,0);assert.equal((await metrics()).registrations,0)
    await page.evaluate(()=>window.authControl.recover());await page.getByRole('button',{name:'Tentar de novo'}).click();await ready(page)
    assert.equal((await metrics()).guests,0);assert.equal((await metrics()).active,1)
  })
  await t.test('timeout renders recovery UI, ignores a late result, and retries the same identity',async(t)=>{
    const {page,metrics,requests}=await scene(t,'slow',{clock:true});await page.goto(origin+'/app');await loading(page)
    await page.clock.fastForward(15_001);await failed(page)
    await page.evaluate(()=>window.authControl.resolve());await failed(page)
    assert.equal((await metrics()).registrations,0);assert.equal(requests.dashboard,0)
    await page.getByRole('button',{name:'Tentar de novo'}).click();await ready(page)
    assert.equal((await metrics()).guests,0);assert.equal((await metrics()).active,1)
    assert.equal(await page.locator('#auth-probe').getAttribute('data-user'),owner)
  })
  await t.test('retry during a pending recovery reuses it and registers only one listener',async(t)=>{
    const {page,metrics}=await scene(t,'slow',{clock:true});await page.goto(origin+'/app');await loading(page)
    await page.clock.fastForward(15_001);await failed(page)
    await page.getByRole('button',{name:'Tentar de novo'}).click();await loading(page)
    assert.equal((await metrics()).reads,1)
    await page.evaluate(()=>window.authControl.resolve());await ready(page)
    assert.equal((await metrics()).registrations,1);assert.equal((await metrics()).guests,0)
  })
  await t.test('actual SDK resumes a stored expired anonymous session after held HTTP 200, then reloads without refresh',async(t)=>{
    let release;const held=new Promise(resolve=>{release=resolve});t.after(()=>release())
    const {page,requests,metrics}=await scene(t,'real',{stored:sessionFor(owner,true),holdRefresh:held})
    await page.goto(origin+'/');await page.getByRole('heading',{name:'O partido, xogada a xogada.'}).waitFor()
    await page.getByRole('link',{name:'Abrir aplicación',exact:true}).click();await loading(page)
    await page.waitForFunction(()=>document.querySelector('#auth-probe').dataset.status==='loading')
    assert.equal(requests.refresh,1);assert.equal(requests.dashboard,0);assert.equal((await metrics()).registrations,0)
    release();await ready(page)
    assert.equal(await page.locator('#auth-probe').getAttribute('data-user'),owner)
    assert.equal((await metrics()).guests,0);assert.equal((await metrics()).active,1)
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sb-127-auth-token')).refresh_token),'renewed-refresh-fixture')
    await page.reload();await ready(page)
    assert.equal(requests.refresh,1);assert.equal(requests.anonymous,0);assert.equal((await metrics()).active,1)
  })
})
