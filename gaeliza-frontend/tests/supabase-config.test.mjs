import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

// Exercise the actual client entry point, not a copy of its selection logic.
// Only Vite's env and the SDK are replaced: no real env, SDK auth or network.
const source = await readFile(new URL('../src/v2/lib/supabase.ts', import.meta.url), 'utf8')
const moduleUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const sdk = moduleUrl(`export const calls=[];
  export function createClient(...args){calls.push(args);return {args}}`)
const { calls } = await import(sdk)
let sequence = 0
async function load(env) {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
    .replaceAll('import.meta.env', `(${JSON.stringify(env)})`)
    .replace(/from ['"]@supabase\/supabase-js['"]/, `from '${sdk}'`)
  return import(moduleUrl(`${js}\n// isolated module ${sequence++}`))
}
const dedicated = {
  VITE_GAELIZA_V2_SUPABASE_URL: 'https://v2-fixture.invalid',
  VITE_GAELIZA_V2_SUPABASE_PUBLISHABLE_KEY: 'fixture-v2-public-key',
}
const generic = {
  VITE_SUPABASE_URL: 'https://legacy-fixture.invalid',
  VITE_SUPABASE_ANON_KEY: 'fixture-generic-public-key',
}
const alias = { VITE_GAELIZA_V2_SUPABASE_ANON_KEY: 'fixture-v2-anon-key' }
const auth = { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }

for (const [name, env, url, key] of [
  ['A: dedicated pair alone', dedicated, dedicated.VITE_GAELIZA_V2_SUPABASE_URL, dedicated.VITE_GAELIZA_V2_SUPABASE_PUBLISHABLE_KEY],
  ['B: dedicated pair wins over a complete legacy pair', { ...generic, ...dedicated }, dedicated.VITE_GAELIZA_V2_SUPABASE_URL, dedicated.VITE_GAELIZA_V2_SUPABASE_PUBLISHABLE_KEY],
  ['C: dedicated publishable wins over dedicated ANON', { ...generic, ...dedicated, ...alias }, dedicated.VITE_GAELIZA_V2_SUPABASE_URL, dedicated.VITE_GAELIZA_V2_SUPABASE_PUBLISHABLE_KEY],
  ['D: dedicated ANON alias works', { VITE_GAELIZA_V2_SUPABASE_URL: dedicated.VITE_GAELIZA_V2_SUPABASE_URL, ...alias, ...generic }, dedicated.VITE_GAELIZA_V2_SUPABASE_URL, alias.VITE_GAELIZA_V2_SUPABASE_ANON_KEY],
  ['G: no dedicated variables permits the complete generic pair', generic, generic.VITE_SUPABASE_URL, generic.VITE_SUPABASE_ANON_KEY],
]) {
  test(name, async () => {
    const before = calls.length
    const { supabase } = await load(Object.freeze({ ...env }))
    assert.equal(calls.length, before + 1, 'one client is created')
    assert.deepEqual(supabase.args, [url, key, { auth }])
  })
}

const missing = /Missing Gaeliza v2 Supabase configuration\. Set the VITE_GAELIZA_V2_SUPABASE_\* deployment variables or the VITE_SUPABASE_\* development sandbox variables\./
for (const [name, env] of [
  ['E: dedicated URL cannot borrow a generic key', { ...generic, VITE_GAELIZA_V2_SUPABASE_URL: dedicated.VITE_GAELIZA_V2_SUPABASE_URL }],
  ['F: dedicated publishable cannot borrow a generic URL', { ...generic, VITE_GAELIZA_V2_SUPABASE_PUBLISHABLE_KEY: dedicated.VITE_GAELIZA_V2_SUPABASE_PUBLISHABLE_KEY }],
  ['F: dedicated ANON cannot borrow a generic URL', { ...generic, ...alias }],
  ['H: absent configuration fails', {}],
  ['I: generic URL alone fails', { VITE_SUPABASE_URL: generic.VITE_SUPABASE_URL }],
  ['I: generic key alone fails', { VITE_SUPABASE_ANON_KEY: generic.VITE_SUPABASE_ANON_KEY }],
  ['I: empty generic URL fails', { ...generic, VITE_SUPABASE_URL: '' }],
  ['I: empty generic key fails', { ...generic, VITE_SUPABASE_ANON_KEY: '' }],
  ['J: empty dedicated URL prevents legacy fallback', { ...generic, VITE_GAELIZA_V2_SUPABASE_URL: '' }],
  ['J: empty dedicated publishable prevents legacy fallback', { ...generic, VITE_GAELIZA_V2_SUPABASE_PUBLISHABLE_KEY: '' }],
  ['J: empty dedicated ANON prevents legacy fallback', { ...generic, VITE_GAELIZA_V2_SUPABASE_ANON_KEY: '' }],
  ['J: complete but empty dedicated pair prevents legacy fallback', { ...generic, VITE_GAELIZA_V2_SUPABASE_URL: '', VITE_GAELIZA_V2_SUPABASE_PUBLISHABLE_KEY: '' }],
  ['J: empty publishable does not fall through to a valid ANON alias', { ...generic, ...dedicated, ...alias, VITE_GAELIZA_V2_SUPABASE_PUBLISHABLE_KEY: '' }],
  ['J: valid key with empty dedicated URL fails', { ...generic, ...dedicated, VITE_GAELIZA_V2_SUPABASE_URL: '' }],
  ['J: dedicated URL with empty ANON fails', { ...generic, VITE_GAELIZA_V2_SUPABASE_URL: dedicated.VITE_GAELIZA_V2_SUPABASE_URL, VITE_GAELIZA_V2_SUPABASE_ANON_KEY: '' }],
]) {
  test(name, async () => {
    const before = calls.length
    await assert.rejects(load(Object.freeze({ ...env })), missing)
    assert.equal(calls.length, before, 'invalid configuration fails before client creation')
  })
}
