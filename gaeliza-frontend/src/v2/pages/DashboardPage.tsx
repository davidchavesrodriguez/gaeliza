import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { analysisPageSize, listOwnedAnalyses } from '../data/dashboard'
import { analysisResumePath, formatUpdatedAt, groupAnalyses, type AnalysisListItem } from '../domain/dashboard'
import { analysisStatusLabels, formatProductDate } from '../domain/presentation'
import { formatMatchDate } from '../domain/matches'

function AnalysisList({ title, items }: { title: string; items: AnalysisListItem[] }) {
  return <section className="analysis-list-section" aria-label={title}>
    <h2>{title} <span className="list-count">{items.length}</span></h2>
    {items.length === 0 ? <p className="list-empty">Non hai análises nesta sección.</p> : <ul className="analysis-list">
      {items.map((item) => <li className="analysis-list-row" key={item.id}>
        <div className="analysis-list-match">
          <h3>{item.homeTeam} <span aria-hidden="true">—</span> {item.awayTeam}</h3>
          <span>Partido: {item.scheduledAt && Number.isFinite(Date.parse(item.scheduledAt))
            ? <time dateTime={item.scheduledAt}>{formatMatchDate(item.scheduledAt)}</time>
            : formatMatchDate(item.scheduledAt)}</span>
          {item.title ? <span>{item.title}</span> : null}
          <small>{item.eventCount} {item.eventCount === 1 ? 'evento' : 'eventos'} · {item.videoCount > 0 ? 'Vídeo configurado' : 'Sen vídeo'}</small>
        </div>
        <div className="analysis-list-reentry">
          <div className="analysis-list-status"><span>{analysisStatusLabels[item.status]}</span>
            <span>Actualizada: <time dateTime={item.updatedAt} title={formatProductDate(item.updatedAt)}>{formatUpdatedAt(item.updatedAt)}</time></span></div>
          <Link className="text-link" to={analysisResumePath(item)}
            aria-label={`${item.status === 'completed' ? 'Revisar' : 'Continuar'} análise: ${item.homeTeam} — ${item.awayTeam}, ${formatMatchDate(item.scheduledAt)}${item.title ? `, ${item.title}` : ''}`}>
            {item.status === 'completed' ? 'Revisar análise' : 'Continuar análise'} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </li>)}
    </ul>}
  </section>
}
export function DashboardPage() {
  const { session, isAnonymous } = useAuth()
  const ownerId = session?.user.id
  const [items, setItems] = useState<AnalysisListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [retry, setRetry] = useState(0)
  const request = useRef<AbortController | null>(null)
  const pending = useRef(false)
  const nextOffset = useRef(0)
  useEffect(() => {
    const controller = new AbortController()
    request.current = controller
    setLoading(true); setItems([]); setError(null)
    if (!ownerId) { setLoading(false); return () => controller.abort() }
    void listOwnedAnalyses(ownerId, 0, controller.signal).then((rows) => {
      if (controller.signal.aborted) return
      setItems(rows); nextOffset.current = rows.length; setHasMore(rows.length === analysisPageSize)
    }).catch((caught) => {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Fallou a carga.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [ownerId, retry])
  async function loadMore() {
    if (!ownerId || pending.current || loading) return
    pending.current = true; setLoading(true); setError(null)
    const signal = request.current?.signal ?? new AbortController().signal
    try {
      const rows = await listOwnedAnalyses(ownerId, nextOffset.current, signal)
      if (!signal.aborted) { nextOffset.current += rows.length; setItems((current) => [...new Map([...current, ...rows].map((row) => [row.id, row])).values()]); setHasMore(rows.length === analysisPageSize) }
    } catch (caught) { if (!signal.aborted) setError(caught instanceof Error ? caught.message : 'Fallou a carga.') }
    finally { pending.current = false; if (!signal.aborted) setLoading(false) }
  }
  const groups = groupAnalyses(items)
  return <div className="page-stack dashboard-page">
    <section className="page-heading"><div><h1>As túas análises</h1><p>Continúa unha análise ou revisa as que xa completaches.</p></div>
      <Link className="button button-primary" to="/app/new">Nova análise</Link></section>
    {isAnonymous ? <p className="guest-banner">Sesión de invitado: para retomar o traballo, volve desde este mesmo navegador.</p> : null}
    {error ? <div className="form-error" role="alert"><span>{error}</span>
      <button className="button button-secondary" type="button" disabled={loading} onClick={() => { if (items.length) void loadMore(); else setRetry((value) => value + 1) }}>Reintentar</button></div> : null}
    {loading ? <p role="status">Cargando análises…</p> : null}
    {!loading && !error && items.length === 0 ? <section className="empty-state"><h2>Aínda non tes análises.</h2><p>Escolle «Nova análise» para preparar un partido e a súa convocatoria.</p></section> : null}
    {items.length > 0 ? <><AnalysisList title="En curso" items={groups.ongoing} /><AnalysisList title="Completadas" items={groups.completed} /></> : null}
    {hasMore ? <p className="form-hint">Mostrando {items.length} análises cargadas. Carga máis para ver as restantes.</p> : null}
    {hasMore && !error ? <button className="button button-secondary load-more" type="button" disabled={loading} onClick={() => { void loadMore() }}>Cargar máis análises</button> : null}
  </div>
}
