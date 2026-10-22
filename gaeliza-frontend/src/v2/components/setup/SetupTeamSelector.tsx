import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPersonalTeam, listTeamOptions } from '../../data/personal-teams'
import type { PersonalTeamInput, TeamOption } from '../../domain/personal-setup'
import { TeamPlayerSetup } from './TeamPlayerSetup'

type Props = {
  label: string; selected: TeamOption | null; userId: string | undefined; busy: boolean
  revision: number; onCreated: () => void; onSelect: (team: TeamOption | null) => void; onBusy: (busy: boolean) => void
}
export function SetupTeamSelector({ label, selected, userId, busy, revision, onCreated, onSelect, onBusy }: Props) {
  const [teams, setTeams] = useState<TeamOption[]>([]), [page, setPage] = useState(0), [more, setMore] = useState(false)
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false), [roster, setRoster] = useState(false)
  const [draft, setDraft] = useState<PersonalTeamInput>({ name: '', shortName: '', gender: 'mixed' })
  const pending = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void listTeamOptions(query, page, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setTeams(result.teams); setMore(result.hasMore); setError(null)
    }).catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Non puidemos cargar os equipos.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [query, page, revision, retry])
  async function create(event: FormEvent) {
    event.preventDefault()
    if (pending.current || busy || !draft.name.trim()) return
    pending.current = true; onBusy(true); setError(null)
    try {
      const team = await createPersonalTeam(draft)
      onSelect(team); setCreating(false); setRoster(false); setDraft({ name: '', shortName: '', gender: 'mixed' })
      setPage(0); setQuery(''); setSearch(''); onCreated()
    } catch (e) { setError(e instanceof Error ? e.message : 'Non puidemos crear o equipo.') }
    finally { pending.current = false; onBusy(false) }
  }
  const options = selected && !teams.some((t) => t.id === selected.id) ? [selected, ...teams] : teams
  return <section className="setup-team" aria-label={label}>
    <h2>{label}</h2>
    {error ? <div className="form-error" role="alert">{error}<button type="button" className="button button-secondary" disabled={busy} onClick={() => setRetry((v) => v + 1)}>Recargar equipos</button></div> : null}
    {!creating ? <>
      <form className="setup-team-search" onSubmit={(e) => { e.preventDefault(); setPage(0); setQuery(search); setRetry((v) => v + 1) }}>
        <label>Buscar equipo<input type="search" value={search} disabled={busy} onChange={(e) => setSearch(e.target.value)} /></label>
        <button type="submit" className="button button-secondary" disabled={busy || loading}>Buscar</button>
      </form>
      <label>Equipo<select value={selected?.id ?? ''} disabled={busy || loading} onChange={(e) => { onSelect(options.find((t) => t.id === e.target.value) ?? null); setRoster(false) }}>
        <option value="">{loading ? 'Cargando equipos…' : 'Selecciona un equipo'}</option>
        {options.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.scope === 'official' ? 'Oficial' : 'Persoal'}</option>)}
      </select></label>
      {!loading && !teams.length ? <p className="form-hint">Non hai equipos nesta busca. Podes crear un persoal.</p> : null}
      <div className="setup-pagination">
        {page > 0 ? <button type="button" className="button button-secondary" disabled={busy || loading} onClick={() => setPage(page - 1)}>Anteriores</button> : null}
        {more ? <button type="button" className="button button-secondary" disabled={busy || loading} onClick={() => setPage(page + 1)}>Máis equipos</button> : null}
        <button type="button" className="button button-secondary" disabled={busy} onClick={() => { setCreating(true); setRoster(false) }}>Crear equipo persoal</button>
      </div>
      {selected?.scope === 'personal' && selected.ownerUserId === userId ? <>
        <button className="text-link" type="button" disabled={busy} aria-expanded={roster} onClick={() => setRoster(!roster)}>{roster ? 'Pechar plantel' : 'Xestionar plantel'}</button>
        {roster ? <TeamPlayerSetup key={selected.id} teamId={selected.id} busy={busy} onBusy={onBusy} /> : null}
      </> : null}
    </> : <form className="setup-team-create" onSubmit={(event) => { void create(event) }}>
      <label>Nome do equipo<input required maxLength={160} value={draft.name} disabled={busy} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
      <label>Nome curto (opcional)<input maxLength={50} value={draft.shortName} disabled={busy} onChange={(e) => setDraft({ ...draft, shortName: e.target.value })} /></label>
      <label>Categoría<select value={draft.gender} disabled={busy} onChange={(e) => setDraft({ ...draft, gender: e.target.value as PersonalTeamInput['gender'] })}>
        <option value="mixed">Mixto</option><option value="male">Masculino</option><option value="female">Feminino</option>
      </select></label>
      <div className="setup-pagination"><button type="submit" className="button button-secondary" disabled={busy || !draft.name.trim()}>Gardar equipo</button>
        <button type="button" className="button button-secondary" disabled={busy} onClick={() => setCreating(false)}>Volver á selección</button></div>
    </form>}
  </section>
}
