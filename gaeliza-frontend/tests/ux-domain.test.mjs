import assert from 'node:assert/strict'
import test from 'node:test'
import { groupAnalyses, analysisResumePath, formatUpdatedAt } from '../src/v2/domain/dashboard.ts'
import { workspaceStep } from '../src/v2/domain/workspace-navigation.ts'
import { analysisStatusLabels, domainLabel, positionLabel, formatProductDate } from '../src/v2/domain/presentation.ts'
import { resolveTheme } from '../src/v2/domain/theme.ts'
import { buildYouTubeEmbedUrl } from '../src/v2/domain/video-navigation.ts'

test('dashboard groups all editable states separately from completed and handles an empty owner', () => {
  const rows = [{id:'draft-id',status:'draft'},{id:'active-id',status:'in_progress'},{id:'completed-id',status:'completed'}]
  assert.deepEqual(groupAnalyses(rows),{ongoing:rows.slice(0,2),completed:rows.slice(2)})
  assert.deepEqual(groupAnalyses([]),{ongoing:[],completed:[]})
  assert.equal(analysisResumePath(rows[0]),'/app/analyses/draft-id?step=roster')
  assert.equal(analysisResumePath(rows[1]),'/app/analyses/active-id?step=tagging')
  assert.equal(analysisResumePath(rows[2]),'/app/analyses/completed-id?step=tagging')
  assert.match(analysisResumePath({id:'a/b',status:'draft'}),/a%2Fb/)
})
test('workspace URLs retain explicitly selected steps; completed defaults to review', () => {
  for(const step of ['roster','video','tagging'])assert.equal(workspaceStep(step,'completed'),step)
  assert.equal(workspaceStep(null,'completed'),'tagging')
  assert.equal(workspaceStep('invalid','in_progress'),'roster')
})
test('last update labels use real timestamps without negative elapsed values', () => {
  const now=Date.parse('2026-10-22T10:00:00Z')
  assert.equal(formatUpdatedAt('2026-10-22T10:01:00Z',now),'Hai un intre')
  assert.equal(formatUpdatedAt('2026-10-22T09:52:00Z',now),'Hai 8 min')
  assert.match(formatUpdatedAt('2026-10-22T08:00:00Z',now),/2/)
  assert.equal(formatUpdatedAt('invalid',now),'Actualización descoñecida')
})
test('presentation translates internal enums while preserving free-text position snapshots', () => {
  for(const [raw,label] of Object.entries({Goalkeeper:'Porteiro',Defender:'Defensa',midfielder:'Centrocampista',midfield:'Centrocampista',forward:'Dianteiro',attacker:'Atacante'}))assert.equal(positionLabel(raw),label)
  assert.equal(positionLabel('Lateral esquerdo'),'Lateral esquerdo')
  for(const raw of ['intercepted','open_play','contested_won','goalkeeper_out','bad_control','kickout_receiver'])assert.notEqual(domainLabel(raw),raw)
  assert.equal(domainLabel('future_enum'),'Sen especificar');assert.equal(domainLabel(null),'Sen especificar')
  assert.deepEqual(Object.values(analysisStatusLabels),['Borrador','En curso','Completada'])
  assert.equal(domainLabel('out_of_play'),'Balón fóra')
  assert.equal(domainLabel('completed'),'Completado') // A completed pass remains masculine.
})
test('theme follows OS unless a valid stored preference overrides it', () => {
  assert.equal(resolveTheme(null,true),'dark');assert.equal(resolveTheme(null,false),'light')
  assert.equal(resolveTheme('dark',false),'dark');assert.equal(resolveTheme('light',true),'light')
  assert.equal(resolveTheme('invalid',false),'light')
})
test('YouTube embeds use a validated ID and trusted host, exact derived start, and no autoplay', () => {
  const source='https://youtu.be/dQw4w9WgXcQ?t=200'
  const url=new URL(buildYouTubeEmbedUrl(source,12.8))
  assert.equal(url.origin,'https://www.youtube-nocookie.com');assert.equal(url.pathname,'/embed/dQw4w9WgXcQ')
  assert.equal(url.searchParams.get('start'),'12');assert.equal(url.searchParams.get('autoplay'),'0')
  for(const input of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','https://example.test/watch','https://cdn.test/a.mp4'])assert.equal(buildYouTubeEmbedUrl(input,0),null)
  assert.equal(buildYouTubeEmbedUrl(source,NaN),null)
})

test('product dates use Galician words without relying on an installed browser locale',()=>{
  assert.match(formatProductDate('2026-10-22T12:00:00'),/^22 out\. 2026, 12:00$/)
  assert.equal(formatProductDate(null),'Data por confirmar')
  assert.equal(formatProductDate('invalid'),'Data por confirmar')
})
