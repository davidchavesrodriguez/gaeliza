import assert from 'node:assert/strict'
import test from 'node:test'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const calls=[]
let respond, user='owner'
const client={auth:{getUser:async()=>({data:{user:user?{id:user}:null},error:null})},from:table=>{
 const call={table,steps:[]};calls.push(call)
 const builder=new Proxy({},{get:(_,method)=>method==='then'?(resolve,reject)=>Promise.resolve(respond(call)).then(resolve,reject):(...args)=>{call.steps.push([method,...args]);return builder}})
 return builder
},rpc:(rpc,args)=>{const call={rpc,args};calls.push(call);return respond(call)}}
globalThis[Symbol.for('gaeliza.setup-test')]=client
async function load(name){
 const source=await readFile(new URL(`../src/v2/data/${name}.ts`,import.meta.url),'utf8')
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
 .replace(/import \{ supabase \} from ['"]\.\.\/lib\/supabase['"];?/,"const supabase=globalThis[Symbol.for('gaeliza.setup-test')]")
 .replace(/from ['"]\.\.\/domain\/personal-setup['"]/g,`from ${JSON.stringify(new URL('../src/v2/domain/personal-setup.ts',import.meta.url).href)}`)
 return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
}
const teams=await load('personal-teams'),players=await load('team-players'),matches=await load('personal-matches')
delete globalThis[Symbol.for('gaeliza.setup-test')]
test('personal team payload fixes scope/owner/null references regardless of extra input fields',async()=>{
 calls.length=0;respond=()=>({data:{id:'new',name:'Meu equipo',short_name:null,scope:'personal',owner_user_id:'owner'},error:null})
 await teams.createPersonalTeam({name:' Meu equipo ',shortName:'',gender:'mixed',owner_user_id:'attacker',scope:'official',club_id:'club'})
 const payload=calls[0].steps.find(s=>s[0]==='insert')[1]
 assert.deepEqual(payload,{name:'Meu equipo',short_name:null,gender:'mixed',scope:'personal',owner_user_id:'owner',club_id:null,default_venue_id:null,active:true})
})
test('missing session prevents direct team insert',async()=>{
 calls.length=0;user=null;await assert.rejects(teams.createPersonalTeam({name:'Team',shortName:'',gender:'mixed'}),/sesión/)
 assert.equal(calls.length,0);user='owner'
})
test('catalog bounded search/pagination excludes foreign personal teams and carries abort signal',async()=>{
 calls.length=0;respond=()=>({data:Array.from({length:31},(_,i)=>({id:String(i),name:'Team',short_name:null,scope:'official',owner_user_id:null})),error:null})
 const signal=new AbortController().signal,result=await teams.listTeamOptions('Team',2,signal)
 assert.equal(result.teams.length,30);assert.equal(result.hasMore,true)
 assert.deepEqual(calls[0].steps.find(s=>s[0]==='range'),['range',60,90])
 assert.deepEqual(calls[0].steps.find(s=>s[0]==='or'),['or','scope.eq.official,owner_user_id.eq.owner'])
 assert.equal(calls[0].steps.find(s=>s[0]==='abortSignal')[1],signal)
})
test('player membership is one RPC, with no owner or existing-player input',async()=>{
 calls.length=0;respond=()=>({data:'player',error:null})
 assert.equal(await players.createTeamPlayer({teamId:'team',firstName:' Ana ',lastName:'',defaultNumber:8,primaryPosition:'Goalkeeper'}),'player')
 assert.deepEqual(calls,[{rpc:'create_team_player',args:{p_team_id:'team',p_first_name:'Ana',p_last_name:null,p_default_number:8,p_primary_position:'Goalkeeper'}}])
})
test('personal match and analysis use one RPC and return both IDs',async()=>{
 calls.length=0;respond=()=>({data:{match_id:'match',analysis_id:'analysis'},error:null})
 assert.deepEqual(await matches.createPersonalMatchAnalysis({homeTeamId:'home',awayTeamId:'away',scheduledAt:'2026-10-22T17:30Z',roundLabel:' ',mode:'live'}),{matchId:'match',analysisId:'analysis'})
 assert.equal(calls.length,1);assert.equal(calls[0].rpc,'create_personal_match_analysis');assert.equal(calls[0].args.p_round_label,null);assert.equal(calls[0].args.p_mode,'live')
})
test('RPC errors and malformed results propagate without a second write',async()=>{
 const input={teamId:'team',firstName:'Ana',lastName:'',defaultNumber:null,primaryPosition:''}
 calls.length=0;respond=()=>({data:null,error:{message:'Rejected'}})
 await assert.rejects(players.createTeamPlayer(input),/Rejected/);assert.equal(calls.length,1)
 respond=()=>({data:null,error:null});await assert.rejects(players.createTeamPlayer(input),/Resposta/)
})
