import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { parseAnalysisClock, type AnalysisWorkspace, type AnalysisParticipant } from '../../domain/analysis'
import { quickEventLabels, type QuickEventType, type EventParticipantInput, type LogQuickEventInput } from '../../domain/tagging'
import { PitchCoordinatePicker } from '../PitchCoordinatePicker'
import { ShotFields } from './ShotFields'
import { RecoveryFields } from './RecoveryFields'
import { TurnoverFields } from './TurnoverFields'
import { FoulFields } from './FoulFields'
import { CardFields } from './CardFields'
import { KickoutFields } from './KickoutFields'

type Props = {
  workspace: AnalysisWorkspace
  captureDisabled: boolean
  busy: boolean
  onSave: (input: LogQuickEventInput) => Promise<boolean>
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

export function QuickEventForm({ workspace, captureDisabled, busy, onSave }: Props) {
  const [error, setError] = useState<string | null>(null)
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
  const [kickoutLength, setKickoutLength] = useState('short')
  const [kickoutResult, setKickoutResult] = useState('')

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
          length: kickoutLength,
          result: kickoutResult || null,
        }
      case 'block':
        return {}
    }
  }

  function buildParticipants(): EventParticipantInput[] {
    const participants: EventParticipantInput[] = []

    if (primaryParticipants.some((participant) => participant.id === primaryParticipantId)) {
      participants.push({
        participantId: primaryParticipantId,
        role: primaryRole.role,
      })
    }

    if (secondaryRole && secondaryParticipants.some((participant) => participant.id === secondaryParticipantId)) {
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

    if (captureDisabled) return
    const saved = await onSave({
      analysisId: workspace.id, periodId: currentPeriod.id, teamId, eventType,
      secondInPeriod, x, y, detail: buildDetail(), participants: buildParticipants(),
    })
    if (saved) resetEventSpecificFields()
  }

  return <>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
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
                disabled={captureDisabled}
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
                disabled={captureDisabled}
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
                disabled={captureDisabled}
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
                disabled={captureDisabled}
                inputMode="numeric"
                placeholder="12:34"
                onChange={(event) => {
                  setClock(event.target.value)
                }}
              />
            </label>
          </div>

          {eventType === 'shot' ? <ShotFields captureDisabled={captureDisabled} shotResult={shotResult} shotTechnique={shotTechnique} shotSituation={shotSituation} setShotResult={setShotResult} setShotTechnique={setShotTechnique} setShotSituation={setShotSituation} setSecondaryParticipantId={setSecondaryParticipantId} /> : null}

          {eventType === 'recovery' ? <RecoveryFields captureDisabled={captureDisabled} recoveryMethod={recoveryMethod} setRecoveryMethod={setRecoveryMethod} /> : null}

          {eventType === 'turnover' ? <TurnoverFields captureDisabled={captureDisabled} turnoverCause={turnoverCause} setTurnoverCause={setTurnoverCause} /> : null}

          {eventType === 'foul' ? <FoulFields captureDisabled={captureDisabled} foulCause={foulCause} foulOutcome={foulOutcome} setFoulCause={setFoulCause} setFoulOutcome={setFoulOutcome} /> : null}

          {eventType === 'card' ? <CardFields captureDisabled={captureDisabled} cardType={cardType} setCardType={setCardType} /> : null}

          {eventType === 'kickout' ? <KickoutFields captureDisabled={captureDisabled} kickoutLength={kickoutLength} kickoutResult={kickoutResult} setKickoutLength={setKickoutLength} setKickoutResult={setKickoutResult} /> : null}

          <div className="tagging-participant-grid">
            <label>
              <span>{primaryRole.label}</span>
              <select
                value={primaryParticipantId}
                disabled={captureDisabled}
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
                  disabled={captureDisabled}
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

            <div className="tagging-pitch-section">
              <div>
                <span className="roster-subheading">Posición no campo</span>
                <small>Opcional · coordenadas raw 0–100</small>
              </div>
              <PitchCoordinatePicker
                x={x}
                y={y}
                disabled={captureDisabled}
                onChange={(nextX, nextY) => {
                  setX(nextX)
                  setY(nextY)
                }}
              />
            </div>

          <button
            className="button button-primary tagging-save-button"
            type="submit"
            disabled={captureDisabled}
          >
            {busy ? 'Gardando…' : `Gardar ${quickEventLabels[eventType].toLowerCase()}`}
          </button>
        </form>

  </>
}
