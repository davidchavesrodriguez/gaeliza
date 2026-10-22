import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { localDateTimeToInstant, validatePersonalMatch } from '../src/v2/domain/personal-setup.ts'
const moduleUrl=new URL('../src/v2/domain/personal-setup.ts',import.meta.url).href
for(const [zone,local,iso] of [
 ['Europe/Madrid','2026-10-22T19:30','2026-10-22T17:30:00.000Z'],
 ['Europe/Madrid','2026-12-01T19:30','2026-12-01T18:30:00.000Z'],
 ['America/New_York','2026-10-22T19:30','2026-10-22T23:30:00.000Z'],
 ['Asia/Kolkata','2026-10-22T19:30','2026-10-22T14:00:00.000Z'],
])test(`local datetime round trip ${zone} ${local}`,()=>{
 const output=execFileSync(process.execPath,['--input-type=module','-e',`import {localDateTimeToInstant,localDateTime} from ${JSON.stringify(moduleUrl)};const iso=localDateTimeToInstant(${JSON.stringify(local)});console.log(JSON.stringify([iso,localDateTime(iso)]))`],{env:{...process.env,TZ:zone},encoding:'utf8'})
 assert.deepEqual(JSON.parse(output),[iso,local])
})
test('reject empty, malformed and impossible dates',()=>{
 for(const value of ['', '2026-02-30T10:00','2026-13-01T10:00','2026-10-22T25:00','2026-10-22T19:30Z'])assert.throws(()=>localDateTimeToInstant(value))
})
test('reject local time skipped by DST; repeated hour uses browser earlier occurrence',()=>{
 const output=execFileSync(process.execPath,['--input-type=module','-e',`import {localDateTimeToInstant} from ${JSON.stringify(moduleUrl)};let rejected=false;try{localDateTimeToInstant('2026-03-29T02:30')}catch{rejected=true}console.log(JSON.stringify([rejected,localDateTimeToInstant('2026-10-25T02:30')]))`],{env:{...process.env,TZ:'Europe/Madrid'},encoding:'utf8'})
 assert.deepEqual(JSON.parse(output),[true,'2026-10-25T00:30:00.000Z'])
})
test('match validation rejects absent/identical teams and invalid date',()=>{
 const input={homeTeamId:'home',awayTeamId:'away',scheduledAt:'2026-10-22T17:30Z',roundLabel:'',mode:'post_match'}
 assert.doesNotThrow(()=>validatePersonalMatch(input))
 for(const change of [{homeTeamId:''},{awayTeamId:'home'},{scheduledAt:'invalid'}])assert.throws(()=>validatePersonalMatch({...input,...change}))
})
