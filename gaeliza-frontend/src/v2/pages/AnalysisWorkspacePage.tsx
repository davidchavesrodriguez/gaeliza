import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { VideoSetupPanel } from '../components/VideoSetupPanel'
import {
  addAnalysisVideo,
  addRosterParticipant,
  addTemporaryParticipant,
  addVideoSyncPoint,
  getAnalysisWorkspace,
  removeAnalysisParticipant,
  removeAnalysisVideo,
  removeVideoSyncPoint,
  setPeriodAttackingDirection,
} from '../data/analysis-workspace'
import {
  getPlayerDisplayName,
  type AnalysisParticipant,
  type AnalysisWorkspace,
  type AttackingDirection,
  type RosterPlayer,
} from '../domain/analysis'
import { formatMatchDate, type TeamSummary } from '../domain/matches'

type WorkspaceStep = 'roster' | 'video'

function TeamRoster({
  team,
  participants,
  availablePlayers,
  busy,
  onAddPlayer,
  onRemoveParticipant,
}: {
  team: TeamSummary
  participants: AnalysisParticipant[]
  availablePlayers: RosterPlayer[]
  busy: boolean
  onAddPlayer: (player: RosterPlayer) => void
  onRemoveParticipant: (participant: AnalysisParticipant) => void
}) {
  return (
    <section className="roster-team-card">
      <div className="roster-team-heading">
        <div>
          <span className="eyebrow">Equipo</span>
          <h2>{team.name}</h2>
        </div>
        <span className="badge">{participants.length} convocados</span>
      </div>

      <div className="participant-list">
        {participants.length === 0 ? (
          <p className="roster-empty">Aínda non hai xogadores na convocatoria.</p>
        ) : (
          participants.map((participant) => (
            <div className="participant-row" key={participant.id}>
              <span className="participant-number">
                {participant.number ? `#${participant.number}` : '—'}
              </span>
              <div className="participant-identity">
                <strong>{participant.displayName}</strong>
                <small>
                  {participant.playerId ? 'Xogador persistente' : 'Identidade temporal'}
                  {participant.position ? ` · ${participant.position}` : ''}
                </small>
              </div>
              <button
                className="participant-remove"
                type="button"
                disabled={busy}
                onClick={() => {
                  onRemoveParticipant(participant)
                }}
              >
                Quitar
              </button>
            </div>
          ))
        )}
      </div>

      {availablePlayers.length > 0 ? (
        <div className="available-roster">
          <span className="roster-subheading">Dispoñibles no equipo</span>
          <div className="available-player-list">
            {availablePlayers.map((player) => (
              <button
                className="available-player"
                type="button"
                key={player.playerId}
                disabled={busy}
                onClick={() => {
                  onAddPlayer(player)
                }}
              >
                <span>
                  {player.defaultNumber ? `#${player.defaultNumber} · ` : ''}
                  {getPlayerDisplayName(player)}
                </span>
                <strong>Engadir +</strong>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export function AnalysisWorkspacePage() {
  const { analysisId } = useParams<{ analysisId: string }>()
  const [workspace, setWorkspace] = useState<AnalysisWorkspace | null>(null)
  const [activeStep, setActiveStep] = useState<WorkspaceStep>('roster')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [temporaryTeamId, setTemporaryTeamId] = useState('')
  const [temporaryName, setTemporaryName] = useState('')
  const [temporaryNumber, setTemporaryNumber] = useState('')

  useEffect(() => {
    if (!analysisId) {
      setError('Falta o identificador do análise.')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    let active = true

    setLoading(true)

    void getAnalysisWorkspace(analysisId, controller.signal)
      .then((nextWorkspace) => {
        if (!active) {
          return
        }

        setWorkspace(nextWorkspace)
        setTemporaryTeamId((current) => {
          const validTeamIds = [
            nextWorkspace.homeTeam.id,
            nextWorkspace.awayTeam.id,
          ]

          return validTeamIds.includes(current)
            ? current
            : nextWorkspace.awayTeam.id
        })
        setError(null)
      })
      .catch((caughtError) => {
        if (!active) {
          return
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Non puidemos cargar o análise.',
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
  }, [analysisId, revision])

  const participantsByTeam = useMemo(() => {
    if (!workspace) {
      return new Map<string, AnalysisParticipant[]>()
    }

    const groups = new Map<string, AnalysisParticipant[]>([
      [workspace.homeTeam.id, []],
      [workspace.awayTeam.id, []],
    ])

    for (const participant of workspace.participants) {
      groups.get(participant.teamId)?.push(participant)
    }

    return groups
  }, [workspace])

  const availablePlayersByTeam = useMemo(() => {
    if (!workspace) {
      return new Map<string, RosterPlayer[]>()
    }

    const existingPlayerIds = new Set(
      workspace.participants
        .map((participant) => participant.playerId)
        .filter((playerId): playerId is string => playerId !== null),
    )
    const groups = new Map<string, RosterPlayer[]>([
      [workspace.homeTeam.id, []],
      [workspace.awayTeam.id, []],
    ])

    for (const player of workspace.rosterPlayers) {
      if (!existingPlayerIds.has(player.playerId)) {
        groups.get(player.teamId)?.push(player)
      }
    }

    return groups
  }, [workspace])

  async function runMutation(action: () => Promise<void>): Promise<boolean> {
    setBusy(true)
    setError(null)

    try {
      await action()
      setRevision((current) => current + 1)
      return true
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Non puidemos actualizar o análise.',
      )
      return false
    } finally {
      setBusy(false)
    }
  }

  function handleAddRosterPlayer(player: RosterPlayer) {
    if (!analysisId) {
      return
    }

    void runMutation(() => addRosterParticipant(analysisId, player))
  }

  function handleRemoveParticipant(participant: AnalysisParticipant) {
    void runMutation(() => removeAnalysisParticipant(participant.id))
  }

  function handleAddTemporary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!analysisId || !temporaryTeamId || !temporaryName.trim()) {
      return
    }

    const parsedNumber = temporaryNumber.trim()
      ? Number.parseInt(temporaryNumber, 10)
      : null

    if (
      parsedNumber !== null &&
      (!Number.isInteger(parsedNumber) || parsedNumber <= 0)
    ) {
      setError('O dorsal debe ser un número enteiro maior ca cero.')
      return
    }

    void runMutation(async () => {
      await addTemporaryParticipant({
        analysisId,
        teamId: temporaryTeamId,
        displayName: temporaryName,
        number: parsedNumber,
      })
      setTemporaryName('')
      setTemporaryNumber('')
    })
  }

  if (loading && !workspace) {
    return (
      <div className="centered-panel" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <p>Cargando o espazo de análise…</p>
      </div>
    )
  }

  if (!workspace) {
    return (
      <section className="state-card">
        <span className="eyebrow">Non dispoñible</span>
        <h1>Non puidemos abrir este análise.</h1>
        <p>{error ?? 'O análise non existe ou non tes acceso.'}</p>
      </section>
    )
  }

  const teams = [workspace.homeTeam, workspace.awayTeam]

  return (
    <div className="page-stack">
      <section className="analysis-header-card">
        <div>
          <span className="eyebrow">
            {workspace.mode === 'live' ? 'Análise en directo' : 'Análise desde vídeo'}
          </span>
          <h1>
            {workspace.homeTeam.shortName ?? workspace.homeTeam.name}
            <span> vs </span>
            {workspace.awayTeam.shortName ?? workspace.awayTeam.name}
          </h1>
          <p>
            {formatMatchDate(workspace.scheduledAt)} · {workspace.periods.length}{' '}
            períodos preparados
          </p>
        </div>
        <span className="badge">{workspace.status}</span>
      </section>

      <div className="workspace-step-strip" aria-label="Preparación do análise">
        <span className="workspace-step workspace-step-done">1 · Partido</span>
        <span
          className={
            activeStep === 'roster'
              ? 'workspace-step workspace-step-active'
              : 'workspace-step workspace-step-done'
          }
        >
          2 · Convocatoria
        </span>
        <span
          className={
            activeStep === 'video'
              ? 'workspace-step workspace-step-active'
              : 'workspace-step'
          }
        >
          3 · Vídeo / directo
        </span>
        <span className="workspace-step">4 · Tagging</span>
      </div>

      {error ? (
        <div className="form-error" role="alert">
          <strong>Non puidemos completar a acción.</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {activeStep === 'video' ? (
        <VideoSetupPanel
          workspace={workspace}
          busy={busy}
          onAddVideo={(input) => runMutation(() => addAnalysisVideo(input))}
          onRemoveVideo={(videoId) =>
            runMutation(() => removeAnalysisVideo(videoId))
          }
          onSetDirection={(periodId, direction: AttackingDirection) =>
            runMutation(() => setPeriodAttackingDirection(periodId, direction))
          }
          onAddSyncPoint={(input) => runMutation(() => addVideoSyncPoint(input))}
          onRemoveSyncPoint={(syncPointId) =>
            runMutation(() => removeVideoSyncPoint(syncPointId))
          }
          onBack={() => {
            setError(null)
            setActiveStep('roster')
          }}
        />
      ) : (
        <>
          <div className="roster-grid">
            {teams.map((team) => (
              <TeamRoster
                key={team.id}
                team={team}
                participants={participantsByTeam.get(team.id) ?? []}
                availablePlayers={availablePlayersByTeam.get(team.id) ?? []}
                busy={busy}
                onAddPlayer={handleAddRosterPlayer}
                onRemoveParticipant={handleRemoveParticipant}
              />
            ))}
          </div>

          <section className="state-card temporary-player-card">
            <div>
              <span className="eyebrow">Identidade temporal</span>
              <h2>Engade un rival sen crear un xogador global</h2>
              <p>
                Útil cando só coñeces o dorsal ou un nome provisional. Poderás ligar
                esta identidade a un xogador persistente máis adiante sen perder os
                eventos rexistrados.
              </p>
            </div>

            <form className="temporary-player-form" onSubmit={handleAddTemporary}>
              <label>
                <span>Equipo</span>
                <select
                  value={temporaryTeamId}
                  disabled={busy}
                  onChange={(event) => {
                    setTemporaryTeamId(event.target.value)
                  }}
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Nome ou etiqueta</span>
                <input
                  type="text"
                  value={temporaryName}
                  disabled={busy}
                  maxLength={200}
                  placeholder="Ex. #8 ou Dianteiro 12"
                  onChange={(event) => {
                    setTemporaryName(event.target.value)
                  }}
                />
              </label>

              <label>
                <span>Dorsal</span>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={temporaryNumber}
                  disabled={busy}
                  placeholder="8"
                  onChange={(event) => {
                    setTemporaryNumber(event.target.value)
                  }}
                />
              </label>

              <button
                className="button button-secondary"
                type="submit"
                disabled={busy || !temporaryName.trim()}
              >
                {busy ? 'Gardando…' : 'Engadir temporal'}
              </button>
            </form>
          </section>

          <div className="workspace-next-card">
            <div>
              <span className="eyebrow">Seguinte</span>
              <strong>Vídeo, sincronización e orientación do campo</strong>
            </div>
            <button
              className="button button-primary"
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null)
                setActiveStep('video')
              }}
            >
              Continuar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
