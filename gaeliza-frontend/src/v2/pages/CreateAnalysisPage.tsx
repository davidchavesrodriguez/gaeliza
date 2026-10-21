import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createAnalysis } from '../data/analyses'
import { listAnalyzableMatches } from '../data/matches'
import {
  formatMatchDate,
  formatRound,
  type AnalysisMode,
  type MatchOption,
} from '../domain/matches'

const steps = [
  {
    number: '01',
    title: 'Partido',
    text: 'Escolle un encontro oficial ou persoal.',
  },
  {
    number: '02',
    title: 'Convocatoria',
    text: 'Prepara xogadores persistentes e rivais temporais.',
  },
  {
    number: '03',
    title: 'Modo',
    text: 'Vídeo post-partido ou captura rápida en directo.',
  },
]

const modeOptions: Array<{
  value: AnalysisMode
  title: string
  description: string
}> = [
  {
    value: 'post_match',
    title: 'Desde vídeo',
    description:
      'Fluxo recomendado: etiqueta con calma, sincroniza o vídeo e completa detalles despois do partido.',
  },
  {
    value: 'live',
    title: 'En directo',
    description:
      'Captura rápida durante o encontro e enriquece as accións máis tarde desde vídeo.',
  },
]

function MatchCard({
  match,
  selected,
  onSelect,
}: {
  match: MatchOption
  selected: boolean
  onSelect: () => void
}) {
  const round = formatRound(match)
  const competitionName =
    match.competition?.shortName ?? match.competition?.name ?? 'Sen competición'

  return (
    <button
      className={selected ? 'match-card match-card-selected' : 'match-card'}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <div className="match-card-meta">
        <span className="badge">
          {match.scope === 'official' ? 'Oficial' : 'Persoal'}
        </span>
        <span>{competitionName}</span>
        {round ? <span>{round}</span> : null}
      </div>

      <div className="match-card-teams">
        <strong>{match.homeTeam.shortName ?? match.homeTeam.name}</strong>
        <span className="match-card-versus">vs</span>
        <strong>{match.awayTeam.shortName ?? match.awayTeam.name}</strong>
      </div>

      <span className="match-card-date">{formatMatchDate(match.scheduledAt)}</span>
    </button>
  )
}

export function CreateAnalysisPage() {
  const navigate = useNavigate()
  const [matches, setMatches] = useState<MatchOption[]>([])
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [mode, setMode] = useState<AnalysisMode>('post_match')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    void listAnalyzableMatches(controller.signal)
      .then((nextMatches) => {
        if (!active) {
          return
        }

        setMatches(nextMatches)
        setSelectedMatchId((current) => current ?? nextMatches[0]?.id ?? null)
        setError(null)
      })
      .catch((caughtError) => {
        if (!active) {
          return
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Non puidemos cargar os partidos.',
        )
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId) ?? null,
    [matches, selectedMatchId],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedMatch) {
      return
    }

    setCreating(true)
    setError(null)

    try {
      const analysisId = await createAnalysis({
        matchId: selectedMatch.id,
        mode,
      })

      navigate(`/app/analyses/${analysisId}`)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Non puidemos crear o análise.',
      )
      setCreating(false)
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading page-heading-narrow">
        <div>
          <span className="eyebrow">Novo análise</span>
          <h1>Prepara o partido antes de empezar a etiquetar.</h1>
          <p>
            Escolle o encontro e o modo de traballo. O análise créase de forma
            atómica coa estrutura de períodos xa preparada.
          </p>
        </div>
      </section>

      <ol className="flow-steps">
        {steps.map((step, index) => (
          <li
            className={index === 0 ? 'flow-step flow-step-active' : 'flow-step'}
            key={step.number}
          >
            <span className="flow-step-number">{step.number}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <form className="analysis-setup" onSubmit={handleSubmit}>
        <section className="state-card setup-card">
          <div className="section-heading-inline">
            <div>
              <span className="eyebrow">Paso 1 · Partido</span>
              <h2>Escolle o encontro</h2>
            </div>
            <span className="badge">{matches.length} dispoñibles</span>
          </div>

          {loading ? (
            <div className="inline-loading" aria-live="polite">
              <div className="spinner" aria-hidden="true" />
              <span>Cargando calendario…</span>
            </div>
          ) : null}

          {!loading && matches.length === 0 ? (
            <div className="empty-state">
              <strong>Non hai partidos dispoñibles.</strong>
              <p>
                Cando exista calendario oficial ou crees un partido persoal,
                aparecerá aquí. A creación manual de partido é o seguinte paso do
                fluxo.
              </p>
            </div>
          ) : null}

          {!loading && matches.length > 0 ? (
            <div className="match-list">
              {matches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  selected={match.id === selectedMatchId}
                  onSelect={() => {
                    setSelectedMatchId(match.id)
                  }}
                />
              ))}
            </div>
          ) : null}
        </section>

        <section className="state-card setup-card">
          <span className="eyebrow">Modo de captura</span>
          <h2>Como vas analizar este partido?</h2>

          <div className="mode-grid">
            {modeOptions.map((option) => (
              <label
                className={
                  mode === option.value
                    ? 'mode-card mode-card-selected'
                    : 'mode-card'
                }
                key={option.value}
              >
                <input
                  type="radio"
                  name="analysis-mode"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => {
                    setMode(option.value)
                  }}
                />
                <span>
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </div>
        </section>

        {error ? (
          <div className="form-error" role="alert">
            <strong>Non puidemos continuar.</strong>
            <span>{error}</span>
          </div>
        ) : null}

        <div className="form-actions">
          <div>
            {selectedMatch ? (
              <span className="selection-summary">
                {selectedMatch.homeTeam.shortName ?? selectedMatch.homeTeam.name}{' '}
                vs{' '}
                {selectedMatch.awayTeam.shortName ?? selectedMatch.awayTeam.name}
              </span>
            ) : (
              <span className="selection-summary">Escolle primeiro un partido</span>
            )}
          </div>

          <button
            className="button button-primary"
            type="submit"
            disabled={!selectedMatch || creating}
          >
            {creating ? 'Creando análise…' : 'Crear análise'}
          </button>
        </div>
      </form>
    </div>
  )
}
