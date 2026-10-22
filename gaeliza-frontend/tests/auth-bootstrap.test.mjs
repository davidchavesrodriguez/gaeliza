import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as flush } from 'node:timers/promises'
import { createAuthBootstrap, createGuestSession, authBootstrapTimeoutMs } from '../src/v2/auth/session-bootstrap.ts'

const session=(id)=>({user:{id,is_anonymous:true},access_token:`token-${id}`,refresh_token:`refresh-${id}`})
const response=(value=null,error=null)=>({data:{session:value},error})
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
function fixture(t,read=async()=>response(session('existing'))){
  const states=[],callbacks=[],subscriptions=new Set(),calls={reads:0,guests:0,registrations:0,unsubscriptions:0}
  const auth={
    getSession:()=>{calls.reads++;return read()},
    signInAnonymously:async()=>{calls.guests++;return response(session('guest'))},
    onAuthStateChange:(callback)=>{
      assert.equal(states.at(-1).status,'ready','initial React state is set before registration')
      calls.registrations++;callbacks.push(callback);subscriptions.add(callback)
      return {data:{subscription:{unsubscribe:()=>{calls.unsubscriptions++;subscriptions.delete(callback)}}}}
    },
  }
  const start=createAuthBootstrap(auth),stops=[]
  t.after(()=>stops.forEach(stop=>stop()))
  return {auth,states,callbacks,subscriptions,calls,start:()=>{const stop=start(state=>states.push(state));stops.push(stop);return stop}}
}

test('existing initial session becomes ready before listening and never creates a guest',async(t)=>{
  const f=fixture(t);f.start();await flush()
  assert.deepEqual(f.states.map(s=>s.status),['loading','ready'])
  assert.equal(f.states.at(-1).session.user.id,'existing');assert.equal(f.calls.guests,0)
  assert.equal(f.subscriptions.size,1)
})
test('no session becomes ready/null and simultaneous guest callers share the entire read/create sequence',async(t)=>{
  const f=fixture(t,async()=>response());f.start();await flush()
  assert.equal(f.states.at(-1).status,'ready');assert.equal(f.states.at(-1).session,null)
  const held=deferred();f.auth.signInAnonymously=()=>{f.calls.guests++;return held.promise}
  const guest=createGuestSession(f.auth),first=guest(),second=guest()
  assert.equal(first,second);await flush()
  assert.equal(f.calls.reads,2);assert.equal(f.calls.guests,1)
  held.resolve(response(session('one-guest')))
  assert.equal((await first).user.id,'one-guest');assert.equal(await first,await second)
})
test('slow recovery survives mount/unmount/mount without parallel recovery or stale subscriptions',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']})
  const held=deferred(),f=fixture(t,()=>held.promise)
  const stopFirst=f.start();await flush();stopFirst();const stopSecond=f.start();await flush()
  assert.equal(f.calls.reads,1);assert.equal(f.calls.registrations,0)
  held.resolve(response(session('persisted')));await flush()
  assert.deepEqual(f.states.map(s=>s.status),['loading','loading','ready'])
  assert.equal(f.calls.registrations,1);stopSecond();stopSecond();assert.equal(f.subscriptions.size,0)
  assert.equal(f.calls.unsubscriptions,1,'retry plus effect cleanup must unsubscribe only once')
  const count=f.states.length;f.callbacks[0]('TOKEN_REFRESHED',session('late'));t.mock.timers.tick(authBootstrapTimeoutMs*2)
  assert.equal(f.states.length,count)
})
for(const rejects of [false,true])test(`recovery ${rejects?'rejection':'returned error'} exits loading without registering or replacing identity`,async(t)=>{
  const read=()=>rejects?Promise.reject(new Error('Recovery failed')):Promise.resolve(response(null,new Error('Recovery failed')))
  const f=fixture(t,read);f.start();await flush()
  assert.equal(f.states.at(-1).status,'error');assert.equal(f.states.at(-1).error,'Recovery failed')
  assert.equal(f.calls.registrations,0)
  await assert.rejects(createGuestSession(f.auth)(),/Recovery failed/);assert.equal(f.calls.guests,0)
})
test('timeout ignores late results; retry after recovery settles reads again and can succeed',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']})
  const held=deferred();let read=()=>held.promise
  const f=fixture(t,()=>read());f.start();await flush();t.mock.timers.tick(authBootstrapTimeoutMs)
  assert.equal(f.states.at(-1).status,'error');const count=f.states.length
  held.resolve(response(session('late')));await flush()
  assert.equal(f.states.length,count);assert.equal(f.calls.registrations,0)
  read=async()=>response(session('same-identity'));f.start();await flush()
  assert.equal(f.states.at(-1).session.user.id,'same-identity');assert.equal(f.calls.reads,2)
  assert.equal(f.calls.guests,0);assert.equal(f.subscriptions.size,1)
})
test('retry while SDK recovery is pending attaches one live attempt without starting another refresh',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']})
  const held=deferred(),f=fixture(t,()=>held.promise)
  const stop=f.start();await flush();t.mock.timers.tick(authBootstrapTimeoutMs);stop();f.start();await flush()
  assert.equal(f.calls.reads,1);assert.equal(f.calls.registrations,0)
  held.resolve(response(session('retained')));await flush()
  assert.deepEqual(f.states.map(s=>s.status),['loading','error','loading','ready'])
  assert.equal(f.states.at(-1).session.user.id,'retained');assert.equal(f.subscriptions.size,1)
})
test('subsequent auth events update state; INITIAL_SESSION cannot overwrite the resolved bootstrap',async(t)=>{
  const f=fixture(t);f.start();await flush();const callback=f.callbacks[0]
  callback('INITIAL_SESSION',null);assert.equal(f.states.at(-1).session.user.id,'existing')
  for(const event of ['TOKEN_REFRESHED','SIGNED_IN']){
    callback(event,session(event));assert.equal(f.states.at(-1).session.user.id,event)
  }
  callback('SIGNED_OUT',null);assert.equal(f.states.at(-1).session,null);assert.equal(f.states.at(-1).status,'ready')
})
test('cleanup before recovery removes its timer and ignores both late errors and results',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']})
  const held=deferred(),f=fixture(t,()=>held.promise);const stop=f.start();await flush();stop()
  t.mock.timers.tick(authBootstrapTimeoutMs*2);held.reject(new Error('Late failure'));await flush()
  assert.deepEqual(f.states.map(s=>s.status),['loading']);assert.equal(f.calls.registrations,0)
})
test('guest recovery reuses an existing identity and deduplication resets after a failed creation',async(t)=>{
  const f=fixture(t);const guest=createGuestSession(f.auth)
  assert.equal((await guest()).user.id,'existing');assert.equal(f.calls.guests,0)
  f.auth.getSession=async()=>response();let fail=true
  f.auth.signInAnonymously=async()=>{f.calls.guests++;return fail?response(null,new Error('Guest failed')):response(session('created'))}
  await assert.rejects(guest(),/Guest failed/);fail=false
  assert.equal((await guest()).user.id,'created');assert.equal(f.calls.guests,2)
})
