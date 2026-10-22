import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createTeamPlayer, listTeamPlayers, type TeamPlayer } from '../../data/team-players'
import { positionLabel } from '../../domain/presentation'

type Props = { teamId: string; busy: boolean; onBusy: (busy: boolean) => void }
export function TeamPlayerSetup({ teamId, busy, onBusy }: Props) {
  const [players, setPlayers] = useState<TeamPlayer[]>([])
  const [page, setPage] = useState(0), [more, setMore] = useState(false), [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState({ firstName: '', lastName: '', number: '', position: '' })
  const [notice, setNotice] = useState('')
  const pending = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void listTeamPlayers(teamId, page, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setPlayers(result.players); setMore(result.hasMore); setError(null)
    }).catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Non puidemos cargar o plantel.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [teamId, page, revision])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || pending.current) return
    const number = draft.number ? Number(draft.number) : null
    if (!draft.firstName.trim() || (number !== null && (!Number.isInteger(number) || number <= 0 || number > 2147483647))) return
    pending.current = true; onBusy(true); setError(null); setNotice('')
    try {
      await createTeamPlayer({ teamId, firstName: draft.firstName, lastName: draft.lastName, defaultNumber: number, primaryPosition: draft.position })
      setDraft({ firstName: '', lastName: '', number: '', position: '' }); setNotice('Xogador gardado. Poderás convocalo no seguinte paso.')
      setPage(0); setRevision((v) => v + 1)
    } catch (e) { setError(e instanceof Error ? e.message : 'Non puidemos gardar o xogador.') }
    finally { pending.current = false; onBusy(false) }
  }
  return <section className="team-player-setup" aria-label="Plantel persistente">
    <h3>Plantel</h3>
    {loading ? <p role="status">Cargando plantel…</p> : <ul className="setup-player-list">{players.map((p) =>
      <li key={p.id}><span>{p.number !== null ? `#${p.number}` : '—'}</span><strong>{p.firstName} {p.lastName}</strong><span>{p.position ? positionLabel(p.position) : '—'}</span></li>)}</ul>}
    {!loading && !players.length && !error ? <p>Aínda non hai xogadores.</p> : null}
    <div className="setup-pagination">
      {page > 0 ? <button type="button" className="button button-secondary" disabled={busy || loading} onClick={() => setPage(page - 1)}>Anteriores</button> : null}
      {more ? <button type="button" className="button button-secondary" disabled={busy || loading} onClick={() => setPage(page + 1)}>Máis xogadores</button> : null}
    </div>
    {error ? <div role="alert" className="form-error">{error}<button type="button" className="button button-secondary" disabled={busy} onClick={() => setRevision((v) => v + 1)}>Recargar plantel</button></div> : null}
    {notice ? <p role="status">{notice}</p> : null}
    <form className="setup-player-form" onSubmit={(event) => { void submit(event) }}>
      <label>Nome<input required maxLength={120} value={draft.firstName} disabled={busy} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} /></label>
      <label>Apelidos (opcional)<input maxLength={160} value={draft.lastName} disabled={busy} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} /></label>
      <label>Dorsal (opcional)<input type="number" min="1" max="2147483647" step="1" value={draft.number} disabled={busy} onChange={(e) => setDraft({ ...draft, number: e.target.value })} /></label>
      <label>Posición (opcional)<select value={draft.position} disabled={busy} onChange={(e) => setDraft({ ...draft, position: e.target.value })}>
        <option value="">Sen indicar</option><option value="Goalkeeper">Porteiro</option><option value="Defender">Defensa</option><option value="Midfielder">Centrocampista</option><option value="Forward">Dianteiro</option>
      </select></label>
      <button type="submit" className="button button-secondary" disabled={busy || !draft.firstName.trim()}>Engadir xogador</button>
    </form>
  </section>
}
