import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { createAnalysis } from '../data/analyses'
import { listAnalyzableMatches } from '../data/matches'
import { createPersonalMatchAnalysis } from '../data/personal-matches'
import { localDateTimeToInstant, type TeamOption } from '../domain/personal-setup'
import type { AnalysisMode, MatchOption } from '../domain/matches'
import { SetupTeamSelector } from '../components/setup/SetupTeamSelector'
import { ExistingMatchOption } from '../components/setup/ExistingMatchOption'

export function CreateAnalysisPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [path, setPath] = useState<'existing' | 'new'>('existing')
  const [matches, setMatches] = useState<MatchOption[]>([]), [selectedMatchId, setSelectedMatchId] = useState('')
  const [home, setHome] = useState<TeamOption | null>(null), [away, setAway] = useState<TeamOption | null>(null)
  const [date, setDate] = useState(''), [round, setRound] = useState(''), [mode, setMode] = useState<AnalysisMode>('post_match')
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null), [loadError, setLoadError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0), [catalogRevision, setCatalogRevision] = useState(0)
  const pending = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void listAnalyzableMatches(controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setMatches(result); setSelectedMatchId((id) => result.some((m) => m.id === id) ? id : result[0]?.id ?? ''); setLoadError(null)
    }).catch((e: unknown) => { if (!controller.signal.aborted) setLoadError(e instanceof Error ? e.message : 'Non puidemos cargar os partidos.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [retry])
  const locked = busy || creating
  const sameTeam = home !== null && home.id === away?.id
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (locked || pending.current || (path === 'existing' && (!selectedMatchId || loading))) return
    pending.current = true; setCreating(true); setError(null)
    try {
      const id = path === 'existing' ? await createAnalysis({ matchId: selectedMatchId, mode }) :
        (await createPersonalMatchAnalysis({ homeTeamId: home?.id ?? '', awayTeamId: away?.id ?? '', scheduledAt: localDateTimeToInstant(date), roundLabel: round, mode })).analysisId
      navigate(`/app/analyses/${id}?step=roster`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Non puidemos crear a análise.'); setCreating(false) }
    finally { pending.current = false }
  }
  return <div className="page-stack self-service-setup">
    <header className="page-heading"><h1>Nova análise</h1><p>Escolle un partido ou prepara un persoal.</p></header>
    <div className="workspace-step-strip" role="group" aria-label="Orixe do partido">
      <button className={`workspace-step${path === 'existing' ? ' workspace-step-active' : ''}`} type="button" aria-pressed={path === 'existing'} disabled={locked} onClick={() => { setPath('existing'); setError(null) }}>Partido existente</button>
      <button className={`workspace-step${path === 'new' ? ' workspace-step-active' : ''}`} type="button" aria-pressed={path === 'new'} disabled={locked} onClick={() => { setPath('new'); setError(null) }}>Crear partido</button>
    </div>
    {path === 'existing' ? <section aria-label="Partidos dispoñibles">
      {loading ? <p role="status">Cargando calendario…</p> : null}
      {loadError ? <div className="form-error" role="alert">{loadError}<button type="button" className="button button-secondary" disabled={locked} onClick={() => setRetry(retry + 1)}>Recargar partidos</button></div> : null}
      {!loading && !loadError && matches.length === 0 ? <div className="empty-state"><p>Aínda non hai partidos dispoñibles.</p>
        <button type="button" className="button button-secondary" disabled={locked} onClick={() => setPath('new')}>Crear o primeiro partido</button></div> : null}
      {matches.length > 0 ? <fieldset className="setup-existing-matches" disabled={locked}><legend>Escolle o encontro</legend><div className="match-list">
        {matches.map((match) => <ExistingMatchOption key={match.id} match={match} selected={match.id === selectedMatchId} onSelect={() => setSelectedMatchId(match.id)} />)}
      </div></fieldset> : null}
    </section> : <div className="setup-teams">
      <SetupTeamSelector label="Equipo local" selected={home} onSelect={setHome} userId={session?.user.id} busy={locked} onBusy={setBusy}
        revision={catalogRevision} onCreated={() => setCatalogRevision((v) => v + 1)} />
      <SetupTeamSelector label="Equipo visitante" selected={away} onSelect={setAway} userId={session?.user.id} busy={locked} onBusy={setBusy}
        revision={catalogRevision} onCreated={() => setCatalogRevision((v) => v + 1)} />
    </div>}
    <form className="setup-match-form" onSubmit={(event) => { void submit(event) }}>
      {path === 'new' ? <div className="setup-match-fields">
        <label>Data e hora<input type="datetime-local" required value={date} disabled={locked} onChange={(e) => setDate(e.target.value)} />
          <small>Hora local do teu dispositivo.</small></label>
        <label>Etiqueta do encontro (opcional)<input maxLength={100} value={round} disabled={locked} onChange={(e) => setRound(e.target.value)} /></label>
      </div> : null}
      <fieldset className="setup-mode" disabled={locked}><legend>Modo de análise</legend>
        <label><input type="radio" name="mode" value="post_match" checked={mode === 'post_match'} onChange={() => setMode('post_match')} />Desde vídeo</label>
        <label><input type="radio" name="mode" value="live" checked={mode === 'live'} onChange={() => setMode('live')} />En directo</label>
      </fieldset>
      {sameTeam && path === 'new' ? <p role="alert">O equipo local e o visitante deben ser distintos.</p> : null}
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <div className="form-actions"><span className="selection-summary">A convocatoria prepárase no seguinte paso.</span>
        <button className="button button-primary" type="submit" disabled={locked || (path === 'existing' ? loading || !selectedMatchId : !home || !away || sameTeam || !date)}>{creating ? 'Creando análise…' : 'Crear análise'}</button>
      </div>
    </form>
  </div>
}
