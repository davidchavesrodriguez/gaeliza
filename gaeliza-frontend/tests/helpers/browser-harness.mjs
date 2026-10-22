// Shared local-only smoke bootstrap. Playwright/Chrome are external tools, not
// frontend dependencies; production modules and styles run unchanged in Vite.
import { createRequire } from 'node:module'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
const { chromium } = createRequire(import.meta.url)('playwright')
const root = new URL('../../', import.meta.url)
export async function startBrowserHarness(t, { name, port, source }) {
  const origin=`http://127.0.0.1:${port}`
  const entry=`/node_modules/.${name}-smoke/index.html`
  const harness=new URL(`node_modules/.${name}-smoke/`,root)
  const html=`<html lang="gl"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/node_modules/.${name}-smoke/harness.tsx"></script></body></html>`
  await mkdir(harness,{recursive:true})
  await writeFile(new URL('index.html',harness),html)
  await writeFile(new URL('harness.tsx',harness),source)
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{
    cwd:root,env:{...process.env,VITE_SUPABASE_URL:origin,VITE_SUPABASE_ANON_KEY:'browser-fixture-public-key'},stdio:['ignore','pipe','pipe'],
  })
  let output='',browser
  server.stdout.on('data',chunk=>{output+=chunk});server.stderr.on('data',chunk=>{output+=chunk})
  t.after(async()=>{
    if(browser)await browser.close()
    if(server.exitCode===null){const ended=once(server,'exit');server.kill('SIGTERM');await ended}
    await rm(harness,{recursive:true,force:true})
  })
  for(let attempt=0;;attempt++){
    try{if((await fetch(origin+entry)).ok)break}catch{/* Starting. */}
    if(attempt>100||server.exitCode!==null)throw new Error(output)
    await delay(50)
  }
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']})
  const renderedHtml = await (await fetch(origin+entry)).text()
  return {browser,origin,entry,html:renderedHtml}
}
