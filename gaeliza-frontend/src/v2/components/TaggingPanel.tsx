import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  rebuildInferredPossessions,
  listAnalysisEvents,
  logQuickEvent,
  removeAnalysisEvent,
  reopenAnalysis,
} from '../data/tagging'
import {
  formatAnalysisClock,
  parseAnalysisClock,
  type AnalysisParticipant,
  type AnalysisWorkspace,
} from '../domain/analysis'
import {
  getEventResultLabel,
  mapPeriodSecondToVideoSecond,
  quickEventLabels,
  type AnalysisEventSummary,
  type EventParticipantInput,
  type QuickEventType,
} from '../domain/tagging'
import { PitchCoordinatePicker } from './PitchCoordinatePicker'

type TaggingPanelProps = {
  workspace: AnalysisWorkspace
  onBack: () => void
  onWorkspaceChanged: () => void
}

type SecondaryRoleConfig = {
  role: string
  label: string
  team: 'same' | 'opponent'
} | null

const eventTypes: QuickEventType[] = [
  'shot',
  'recovery',
  'turnover',
  'foul',
  'card',
  'kickout',
  'block',
]

function getPrimaryRole(eventType: QuickEventType) {
  switch (eventType) {
    case 'shot':
      return { role: 'shooter', label: 'Tirador' }
    case 'recovery':
      return { role: 'recoverer', label: 'Recuperador' }
    case 'turnover':
      return { role: 'turnover_player', label: 'Xogador da perda' }
    case 'foul':
      return { role: 'offender', label: 'Infractor' }
    case 'card':
      return { role: 'card_recipient', label: 'Sancionado' }
    case 'kickout':
      return { role: 'kicker', label: 'Lanzador' }
    case 'block':
      return { role: 'blocker', label: 'Bloqueador' }
  }
}

function getSecondaryRole(
  eventType: QuickEventType,
  shotResult: string,
): SecondaryRoleConfig {
  if (eventType === 'shot') {
    if (shotResult === 'goal' || shotResult === 'point') {
      return { role: 'assister', label: 'Asistencia', team: 'same' }
    }

    if (shotResult === 'saved') {
      return { role: 'goalkeeper', label: 'Porteiro rival', team: 'opponent' }
    }

    if (shotResult === 'blocked') {
      return { role: 'blocker', label: 'Bloqueador rival', team: 'opponent' }
    }
  }

  if (eventType === 'foul') {
    return { role: 'fouled', label: 'Xogador que recibe a falta', team: 'opponent' }
  }

  if (eventType === 'block') {
    return { role: 'blocked_player', label: 'Xogador bloqueado', team: 'opponent' }
  }

  return null
}

function participantLabel(participant: AnalysisParticipant) {
  return `${participant.number ? `#${participant.number} · ` : ''}${participant.displayName}`
}

function eventTypeLabel(event: AnalysisEventSummary) {
  if (event.eventType in quickEventLabels) {
    return quickEventLabels[event.eventType as QuickEventType]
  }

  return event.eventType
}

function scoreForTeam(events: AnalysisEventSummary[], teamId: string) {
  let goals = 0
  let points = 0

  for (const event of events) {
    if (event.teamId !== teamId || event.eventType !== 'shot') {
      continue
    }

    if (event.shotResult === 'goal') {
      goals += 1
    } else if (event.shotResult === 'point') {
      points += 1
    }
  }

  return { goals, points, total: goals * 3 + points }
}

function buildVideoLabel(video: AnalysisWorkspace['videos'][number]) {
  if (video.title) {
    return video.title
  }

  try {
    return new URL(video.url).hostname
  } catch {
    return 'Vídeo'
  }
}

export function TaggingPanel({
  workspace,
  onBack,
  onWorkspaceChanged,
}: TaggingPanelProps) {
  const [events, setEvents] = useState<AnalysisEventSummary[]>([])
  const [eventRevision, setEventRevision] = useState(0)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [eventType, setEventType] = useState<QuickEventType>('shot')
  const [teamId, setTeamId] = useState(workspace.homeTeam.id)
  const [periodId, setPeriodId] = useState(workspace.periods[0]?.id ?? '')
  const [clock, setClock] = useState('0:00')
  const [primaryParticipantId, setPrimaryParticipantId] = useState('')
  const [secondaryParticipantId, setSecondaryParticipantId] = useState('')
  const [x, setX] = useState<number | null>(null)
  const [y, setY] = useState<number | null>(null)

  const [shotResult, setShotResult] = useState('point')
  const [shotTechnique, setShotTechnique] = useState('')
  const [shotSituation, setShotSituation] = useState('')
  const [recoveryMethod, setRecoveryMethod] = useState('')
  const [turnoverCause, setTurnoverCause] = useState('')
  const [foulCause, setFoulCause] = useState('')
  const [foulOutcome, setFoulOutcome] = useState('')
  const [cardType, setCardType] = useState('yellow')
  const [kickoutLength, setKickoutLength] = useState('')
  const [kickoutResult, setKickoutResult] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setLoadingEvents(true)

    void listAnalysisEvents(workspace.id, controller.signal)
      .then((nextEvents) => {
        if (!active) {
          return
        }

        setEvents(nextEvents)
        setError(null)
      })
      .catch((caughtError) => {
        if (!active) {
          return
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Non puidemos cargar os eventos.',
        )
      })
      .finally(() => {
        if (active) {
          setLoadingEvents(false)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [eventRevision, workspace.id])

  const currentPeriod = useMemo(
    () => workspace.periods.find((period) => period.id === periodId) ?? null,
    [periodId, workspace.periods],
  )

  const primaryRole = getPrimaryRole(eventType)
  const secondaryRole = getSecondaryRole(eventType, shotResult)

  const primaryParticipants = useMemo(
    () => workspace.participants.filter((participant) => participant.teamId === teamId),
    [teamId, workspace.participants],
  )

  const opponentTeamId =
    teamId === workspace.homeTeam.id
      ? workspace.awayTeam.id
      : workspace.homeTeam.id

  const secondaryParticipants = useMemo(() => {
    if (!secondaryRole) {
      return []
    }

    const targetTeamId = secondaryRole.team === 'same' ? teamId : opponentTeamId

    return workspace.participants.filter(
      (participant) =>
        participant.teamId === targetTeamId &&
        participant.id !== primaryParticipantId,
    )
  }, [
    opponentTeamId,
    primaryParticipantId,
    secondaryRole,
    teamId,
    workspace.participants,
  ])

  useEffect(() => {
    if (
      primaryParticipantId &&
      !primaryParticipants.some(
        (participant) => participant.id === primaryParticipantId,
      )
    ) {
      setPrimaryParticipantId('')
    }
  }, [primaryParticipantId, primaryParticipants])

  useEffect(() => {
    if (
      secondaryParticipantId &&
      !secondaryParticipants.some(
        (participant) => participant.id === secondaryParticipantId,
      )
    ) {
      setSecondaryParticipantId('')
    }
  }, [secondaryParticipantId, secondaryParticipants])

  const homeScore = useMemo(
    () => scoreForTeam(events, workspace.homeTeam.id),
    [events, workspace.homeTeam.id],
  )
  const awayScore = useMemo(
    () => scoreForTeam(events, workspace.awayTeam.id),
    [events, workspace.awayTeam.id],
  )

  const timeline = useMemo(() => [...events].reverse(), [events])

  function resetEventSpecificFields() {
    setPrimaryParticipantId('')
    setSecondaryParticipantId('')
    setX(null)
    setY(null)
  }

  function buildDetail(): Record<string, string | number | null> {
    switch (eventType) {
      case 'shot':
        return {
          result: shotResult,
          technique: shotTechnique || null,
          situation: shotSituation || null,
        }
      case 'recovery':
        return { method: recoveryMethod || null }
      case 'turnover':
        return { cause: turnoverCause || null }
      case 'foul':
        return {
          cause: foulCause || null,
          outcome: foulOutcome || null,
        }
      case 'card':
        return { card_type: cardType }
      case 'kickout':
        return {
          length: kickoutLength || null,
          result: kickoutResult || null,
        }
      case 'block':
        return {}
    }
  }

  function buildParticipants(): EventParticipantInput[] {
    const participants: EventParticipantInput[] = []

    if (primaryParticipantId) {
      participants.push({
        participantId: primaryParticipantId,
        role: primaryRole.role,
      })
    }

    if (secondaryRole && secondaryParticipantId) {
      participants.push({
        participantId: secondaryParticipantId,
        role: secondaryRole.role,
      })
    }

    return participants
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (workspace.status === 'completed') {
      setError('Reabre o análise antes de engadir ou editar eventos.')
      return
    }

    if (!currentPeriod) {
      setError('Escolle un período válido.')
      return
    }

    const secondInPeriod = parseAnalysisClock(clock, { integer: true })

    if (secondInPeriod === null) {
      setError('Introduce un tempo válido do período, por exemplo 12:34.')
      return
    }

    if (secondInPeriod > currentPeriod.expectedDurationSeconds) {
      setError('O tempo supera a duración configurada para este período.')
      return
    }

    if ((x === null) !== (y === null)) {
      setError('A posición no campo debe ter X e Y, ou quedar completamente baleira.')
      return
    }

    if (eventType === 'shot' && !shotResult) {
      setError('Escolle o resultado do tiro.')
      return
    }

    if (eventType === 'card' && !cardType) {
      setError('Escolle o tipo de tarxeta.')
      return
    }

    setBusy(true)

    try {
      await logQuickEvent({
        analysisId: workspace.id,
        periodId: currentPeriod.id,
        teamId,
        eventType,
        secondInPeriod,
        x: eventType === 'card' ? null : x,
        y: eventType === 'card' ? null : y,
        detail: buildDetail(),
        participants: buildParticipants(),
      })

      setEventRevision((current) => current + 1)
      setNotice(`${quickEventLabels[eventType]} gardado.`)
      resetEventSpecificFields()
      onWorkspaceChanged()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Non puidemos gardar o evento.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(eventId: string) {
    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      await removeAnalysisEvent(eventId)
      setEventRevision((current) => current + 1)
      setNotice('Evento eliminado.')
      onWorkspaceChanged()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Non puidemos eliminar o evento.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleRebuildPossessions() {
    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      const count = await rebuildInferredPossessions(workspace.id)
      setNotice(`${count} posesións inferidas a partir dos eventos canónicos.`)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Non puidemos reconstruír as posesións.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleReopen() {
    setBusy(true)
    setError(null)

    try {
      await reopenAnalysis(workspace.id)
      setNotice('Análise reaberto. Xa podes volver editar eventos.')
      onWorkspaceChanged()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Non puidemos reabrir o análise.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tagging-stack">
      {workspace.status === 'completed' ? (
        <div className="tagging-readonly-banner">
          <div>
            <strong>Análise completado.</strong>
            <span>
              Os eventos están bloqueados para evitar cambios accidentais. Reábreo se
              necesitas corrixir o tagging.
            </span>
          </div>
          <button
            className="button button-secondary"
            type="button"
            disabled={busy}
            onClick={() => {
              void handleReopen()
            }}
          >
            Reabrir análise
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="form-error" role="alert">
          <strong>Non puidemos completar a acción.</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {notice ? (
        <div className="tagging-notice" role="status">
          {notice}
        </div>
      ) : null}

      <section className="tagging-scoreboard">
        <div className="tagging-score-team">
          <span>{workspace.homeTeam.shortName ?? workspace.homeTeam.name}</span>
          <strong>
            {homeScore.goals}-{String(homeScore.points).padStart(2, '0')}
          </strong>
          <small>{homeScore.total} pts</small>
        </div>
        <div className="tagging-score-center">
          <span className="eyebrow">Marcador analítico</span>
          <strong>{events.length} eventos</strong>
        </div>
        <div className="tagging-score-team tagging-score-away">
          <span>{workspace.awayTeam.shortName ?? workspace.awayTeam.name}</span>
          <strong>
            {awayScore.goals}-{String(awayScore.points).padStart(2, '0')}
          </strong>
          <small>{awayScore.total} pts</small>
        </div>
      </section>

      <div className="tagging-layout">
        <form className="state-card tagging-capture-card" onSubmit={handleSubmit}>
          <div className="section-heading-inline">
            <div>
              <span className="eyebrow">Captura rápida</span>
              <h2>Rexistra un feito do partido</h2>
              <p>
                Garda o mínimo que coñezas. Xogador e posición son opcionais; o
                evento segue sendo válido a nivel de equipo.
              </p>
            </div>
          </div>

          <div className="event-type-grid" role="group" aria-label="Tipo de evento">
            {eventTypes.map((candidate) => (
              <button
                className={
                  candidate === eventType
                    ? 'event-type-button event-type-button-active'
                    : 'event-type-button'
                }
                type="button"
                key={candidate}
                disabled={busy || workspace.status === 'completed'}
                onClick={() => {
                  setEventType(candidate)
                  resetEventSpecificFields()
                }}
              >
                {quickEventLabels[candidate]}
              </button>
            ))}
          </div>

          <div className="tagging-fields-grid">
            <label>
              <span>Equipo do evento</span>
              <select
                value={teamId}
                disabled={busy || workspace.status === 'completed'}
                onChange={(event) => {
                  setTeamId(event.target.value)
                  setPrimaryParticipantId('')
                  setSecondaryParticipantId('')
                }}
              >
                <option value={workspace.homeTeam.id}>{workspace.homeTeam.name}</option>
                <option value={workspace.awayTeam.id}>{workspace.awayTeam.name}</option>
              </select>
            </label>

            <label>
              <span>Período</span>
              <select
                value={periodId}
                disabled={busy || workspace.status === 'completed'}
                onChange={(event) => {
                  setPeriodId(event.target.value)
                }}
              >
                {workspace.periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name ?? `Período ${period.number}`}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Tempo no período</span>
              <input
                type="text"
                value={clock}
                disabled={busy || workspace.status === 'completed'}
                inputMode="numeric"
                placeholder="12:34"
                onChange={(event) => {
                  setClock(event.target.value)
                }}
              />
            </label>
          </div>

          {eventType === 'shot' ? (
            <div className="tagging-detail-grid">
              <label>
                <span>Resultado *</span>
                <select
                  value={shotResult}
                  disabled={busy || workspace.status === 'completed'}
                  onChange={(event) => {
                    setShotResult(event.target.value)
                    setSecondaryParticipantId('')
                  }}
                >
                  <option value="goal">Gol</option>
                  <option value="point">Punto</option>
                  <option value="wide">Fóra</option>
                  <option value="saved">Parado</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="post">Pao</option>
                </select>
              </label>
              <label>
                <span>Técnica</span>
                <select
                  value={shotTechnique}
                  disabled={busy || workspace.status === 'completed'}
                  onChange={(event) => setShotTechnique(event.target.value)}
                >
                  <option value="">Descoñecida</option>
                  <option value="foot">Pé</option>
                  <option value="hand">Man</option>
                </select>
              </label>
              <label>
                <span>Situación</span>
                <select
                  value={shotSituation}
                  disabled={busy || workspace.status === 'completed'}
                  onChange={(event) => setShotSituation(event.target.value)}
                >
                  <option value="">Descoñecida</option>
                  <option value="open_play">Xogo aberto</option>
                  <option value="free">Libre</option>
                  <option value="forty_five">45</option>
                  <option value="penalty">Penalti</option>
                </select>
              </label>
            </div>
          ) : null}

          {eventType === 'recovery' ? (
            <div className="tagging-detail-grid tagging-detail-grid-single">
              <label>
                <span>Tipo de recuperación</span>
                <select
                  value={recoveryMethod}
                  disabled={busy || workspace.status === 'completed'}
                  onChange={(event) => setRecoveryMethod(event.target.value)}
                >
                  <option value="">Descoñecido</option>
                  <option value="interception">Intercepción</option>
                  <option value="tackle">Tackle</option>
                  <option value="loose_ball">Balón solto</option>
                  <option value="rebound">Rexeite</option>
                  <option value="kickout">Saque de porta</option>
                  <option value="other">Outro</option>
                </select>
              </label>
            </div>
          ) : null}

          {eventType === 'turnover' ? (
            <div className="tagging-detail-grid tagging-detail-grid-single">
              <label>
                <span>Causa da perda</span>
                <select
                  value={turnoverCause}
                  disabled={busy || workspace.status === 'completed'}
                  onChange={(event) => setTurnoverCause(event.target.value)}
                >
                  <option value="">Descoñecida</option>
                  <option value="bad_pass">Mal pase</option>
                  <option value="bad_control">Mal control</option>
                  <option value="steps">Steps</option>
                  <option value="out_of_play">Fóra</option>
                  <option value="offensive_foul">Falta en ataque</option>
                  <option value="dispossessed">Desposuído</option>
                  <option value="other">Outra</option>
                </select>
              </label>
            </div>
          ) : null}

          {eventType === 'foul' ? (
            <div className="tagging-detail-grid">
              <label>
                <span>Causa</span>
                <select
                  value={foulCause}
                  disabled={busy || workspace.status === 'completed'}
                  onChange={(event) => setFoulCause(event.target.value)}
                >
                  <option value="">Descoñecida</option>
                  <option value="holding">Agarrón</option>
                  <option value="striking">Golpe</option>
                  <option value="obstruction">Obstrución</option>
                  <option value="pickup">Pickup</option>
                  <option value="steps">Steps</option>
                  <option value="push">Empurrón</option>
                  <option value="trip">Zancadilla</option>
                  <option value="other">Outra</option>
                </select>
              </label>
              <label>
                <span>Resultado</span>
                <select
                  value={foulOutcome}
                  disabled={busy || workspace.status === 'completed'}
                  onChange={(event) => setFoulOutcome(event.target.value)}
                >
                  <option value="">Descoñecido</option>
                  <option value="free">Libre</option>
                  <option value="forty_five">45</option>
                  <option value="penalty">Penalti</option>
                  <option value="advantage">Vantaxe</option>
                  <option value="none">Sen continuación</option>
                </select>
              </label>
            </div>
          ) : null}

          {eventType === 'card' ? (
            <div className="tagging-detail-grid tagging-detail-grid-single">
              <label>
                <span>Tarxeta *</span>
                <select
                  value={cardType}
                  disabled={busy || workspace.status === 'completed'}
                  onChange={(event) => setCardType(event.target.value)}
                >
                  <option value="yellow">Amarela</option>
                  <option value="black">Negra</option>
                  <option value="red">Vermella</option>
                </select>
              </label>
            </div>
          ) : null}

          {eventType === 'kickout' ? (
            <div className="tagging-detail-grid">
              <label>
                <span>Lonxitude</span>
                <select
                  value={kickoutLength}
                  disabled={busy || workspace.status === 'completed'}
                  onChange={(event) => setKickoutLength(event.target.value)}
                >
                  <option value="">Descoñecida</option>
                  <option value="short">Curto</option>
                  <option value="long">Longo</option>
                </select>
              </label>
              <label>
                <span>Resultado</span>
                <select
                  value={kickoutResult}
                  disabled={busy || workspace.status === 'completed'}
                  onChange={(event) => setKickoutResult(event.target.value)}
                >
                  <option value="">Descoñecido</option>
                  <option value="retained">Retido</option>
                  <option value="contested_won">Disputado gañado</option>
                  <option value="contested_lost">Disputado perdido</option>
                  <option value="directly_lost">Perdido directo</option>
                </select>
              </label>
            </div>
          ) : null}

          <div className="tagging-participant-grid">
            <label>
              <span>{primaryRole.label}</span>
              <select
                value={primaryParticipantId}
                disabled={busy || workspace.status === 'completed'}
                onChange={(event) => setPrimaryParticipantId(event.target.value)}
              >
                <option value="">Sen identificar</option>
                {primaryParticipants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participantLabel(participant)}
                  </option>
                ))}
              </select>
            </label>

            {secondaryRole ? (
              <label>
                <span>{secondaryRole.label}</span>
                <select
                  value={secondaryParticipantId}
                  disabled={busy || workspace.status === 'completed'}
                  onChange={(event) => setSecondaryParticipantId(event.target.value)}
                >
                  <option value="">Sen identificar</option>
                  {secondaryParticipants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participantLabel(participant)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {eventType !== 'card' ? (
            <div className="tagging-pitch-section">
              <div>
                <span className="roster-subheading">Posición no campo</span>
                <small>Opcional · coordenadas raw 0–100</small>
              </div>
              <PitchCoordinatePicker
                x={x}
                y={y}
                disabled={busy || workspace.status === 'completed'}
                onChange={(nextX, nextY) => {
                  setX(nextX)
                  setY(nextY)
                }}
              />
            </div>
          ) : null}

          <button
            className="button button-primary tagging-save-button"
            type="submit"
            disabled={busy || workspace.status === 'completed'}
          >
            {busy ? 'Gardando…' : `Gardar ${quickEventLabels[eventType].toLowerCase()}`}
          </button>
        </form>

        <aside className="state-card tagging-timeline-card">
          <div className="section-heading-inline">
            <div>
              <span className="eyebrow">Timeline</span>
              <h2>Eventos rexistrados</h2>
            </div>
            <span className="badge">{events.length}</span>
          </div>

          {loadingEvents ? (
            <div className="timeline-loading">
              <div className="spinner" aria-hidden="true" />
              <span>Cargando eventos…</span>
            </div>
          ) : timeline.length === 0 ? (
            <div className="empty-state compact-empty-state">
              <strong>Aínda non hai eventos.</strong>
              <p>O primeiro evento moverá o análise de borrador a en progreso.</p>
            </div>
          ) : (
            <div className="tagging-timeline-list">
              {timeline.map((timelineEvent) => {
                const team =
                  timelineEvent.teamId === workspace.homeTeam.id
                    ? workspace.homeTeam
                    : workspace.awayTeam
                const videoTimes = workspace.videos
                  .map((video) => ({
                    video,
                    second: mapPeriodSecondToVideoSecond(
                      workspace.syncPoints,
                      video.id,
                      timelineEvent.periodId,
                      timelineEvent.secondInPeriod,
                    ),
                  }))
                  .filter(
                    (value): value is { video: (typeof workspace.videos)[number]; second: number } =>
                      value.second !== null,
                  )

                return (
                  <article className="timeline-event" key={timelineEvent.id}>
                    <div className="timeline-event-time">
                      <strong>{formatAnalysisClock(timelineEvent.secondInPeriod)}</strong>
                      <small>Parte {timelineEvent.periodNumber}</small>
                    </div>
                    <div className="timeline-event-main">
                      <div>
                        <strong>{eventTypeLabel(timelineEvent)}</strong>
                        <span>
                          {team.shortName ?? team.name} · {getEventResultLabel(timelineEvent)}
                        </span>
                      </div>
                      {videoTimes.length > 0 ? (
                        <div className="timeline-video-times">
                          {videoTimes.slice(0, 2).map(({ video, second }) => (
                            <span key={video.id}>
                              {buildVideoLabel(video)} · {formatAnalysisClock(second)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button
                      className="participant-remove"
                      type="button"
                      disabled={busy || workspace.status === 'completed'}
                      onClick={() => {
                        void handleDelete(timelineEvent.id)
                      }}
                    >
                      Quitar
                    </button>
                  </article>
                )
              })}
            </div>
          )}

          <div className="possession-inference-box">
            <div>
              <strong>Posesións</strong>
              <small>
                Reconstrúeas de forma determinista desde os eventos. As correccións
                manuais nunca se pisan.
              </small>
            </div>
            <button
              className="button button-secondary"
              type="button"
              disabled={busy || events.length === 0}
              onClick={() => {
                void handleRebuildPossessions()
              }}
            >
              Inferir posesións
            </button>
          </div>
        </aside>
      </div>

      <div className="workspace-next-card">
        <button
          className="button button-secondary"
          type="button"
          disabled={busy}
          onClick={onBack}
        >
          ← Vídeo / directo
        </button>
        <div className="workspace-next-copy">
          <span className="eyebrow">Tagging v2</span>
          <strong>Captura rápida conectada ao modelo canónico</strong>
          <small>
            O modo completo engadirá pases, duelos, edición e ferramentas avanzadas
            sobre esta mesma base.
          </small>
        </div>
      </div>
    </div>
  )
}
