import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { completeAnalysis } from '../data/analyses'
import { reopenAnalysis } from '../data/tagging'
import { PersistenceStatus, type SaveState } from '../components/PersistenceStatus'
import { CompleteAnalysisDialog } from '../components/CompleteAnalysisDialog'
import { analysisStatusLabels, positionLabel } from '../domain/presentation'
import { workspaceStep, type WorkspaceStep } from '../domain/workspace-navigation'
import { TaggingPanel } from '../components/TaggingPanel'
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

          <h2>{team.name}</h2>
        </div>
        <span className="badge">{participants.length} {participants.length === 1 ? 'convocado' : 'convocados'}</span>
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
                  {participant.playerId ? 'Xogador do equipo' : 'Nome provisional'}
                  {participant.position ? ` · ${positionLabel(participant.position)}` : ''}
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
  if (!analysisId) return <section><Link to="/app">← Inicio</Link><h1>Falta o identificador da análise.</h1></section>
  return <AnalysisWorkspaceView key={analysisId} analysisId={analysisId} />
}

function AnalysisWorkspaceView({ analysisId }: { analysisId: string }) {
  const [search, setSearch] = useSearchParams()
  const readController = useRef<AbortController | null>(null)
  const [workspace, setWorkspace] = useState<AnalysisWorkspace | null>(null)
  const activeStep = workspaceStep(search.get('step'), workspace?.status)
  function setActiveStep(step: WorkspaceStep) { setTaggingLocked(false); setSearch({ step }) }
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [taggingLocked, setTaggingLocked] = useState(false)
  const [requiresReload, setRequiresReload] = useState(false)
  const [confirmingComplete, setConfirmingComplete] = useState(false)
  const mutationPending = useRef(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [temporaryTeamId, setTemporaryTeamId] = useState('')
  const [temporaryName, setTemporaryName] = useState('')
  const [temporaryNumber, setTemporaryNumber] = useState('')

  useEffect(() => {
    if (!analysisId) {
      setError('Falta o identificador da análise.')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    readController.current = controller
    let active = true

    setLoading(true)

    void getAnalysisWorkspace(analysisId, controller.signal)
      .then((nextWorkspace) => {
        if (!active) {
          return
        }

        setWorkspace(nextWorkspace)
        setRequiresReload(false)
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
            : 'Non puidemos cargar a análise.',
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

  async function runMutation(action: () => Promise<void>, lifecycle = false): Promise<boolean> {
    if (mutationPending.current || loading || requiresReload || (!lifecycle && workspace?.status === 'completed')) return false
    mutationPending.current = true
    setBusy(true); setError(null); setSaveState('pending')
    const signal = readController.current?.signal
    let saved = false
    try {
      await action()
      saved = true
      if (signal?.aborted) return saved
      setSaveState('saved')
      setRequiresReload(true)
      const next = await getAnalysisWorkspace(analysisId, signal)
      if (!signal?.aborted) { setWorkspace(next); setRequiresReload(false) }
    } catch (caught) {
      if (!signal?.aborted) {
        if (!saved) setSaveState('error')
        const message = caught instanceof Error ? caught.message : 'Non puidemos actualizar a análise.'
        setError(saved ? `A acción gardouse, pero fallou a recarga. Non a repitas. ${message}` : message)
      }
    } finally {
      mutationPending.current = false
      if (!signal?.aborted) setBusy(false)
    }
    return saved
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

  if (loading && (!workspace || workspace.id !== analysisId)) {
    return (
      <div className="centered-panel" aria-live="polite">
        <Link to="/app">← Inicio</Link>
        <div className="spinner" aria-hidden="true" />
        <p>Cargando o espazo de análise…</p>
      </div>
    )
  }

  if (!workspace || workspace.id !== analysisId) {
    return (
      <section className="state-card">
        <Link to="/app">← Inicio</Link>
        <h1>Non puidemos abrir esta análise.</h1>
        <p>{error ?? 'A análise non existe ou non tes acceso.'}</p>
        <button className="button button-secondary" type="button" onClick={() => setRevision((value) => value + 1)}>Reintentar</button>
      </section>
    )
  }

  const teams = [workspace.homeTeam, workspace.awayTeam]

  return (
    <div className="page-stack workspace-page">
      <div className="workspace-toolbar">
        <Link className="text-link" to="/app">← Inicio</Link>
        <PersistenceStatus state={saveState} />
      </div>
      <header className="analysis-header-card">
        <div><h1>{workspace.homeTeam.shortName ?? workspace.homeTeam.name} <span>—</span> {workspace.awayTeam.shortName ?? workspace.awayTeam.name}</h1>
          <p>{formatMatchDate(workspace.scheduledAt)} · {workspace.mode === 'live' ? 'En directo' : 'Desde vídeo'}</p></div>
        <div className="workspace-lifecycle">
          <span className={`badge status-${workspace.status}`}>{analysisStatusLabels[workspace.status]}</span>
          {workspace.status === 'completed' ? <button className="button button-primary" type="button"
            disabled={busy || loading || taggingLocked || requiresReload}
            onClick={() => { void runMutation(() => reopenAnalysis(workspace.id), true) }}>Reabrir análise</button> :
            <button className="button button-secondary" type="button" disabled={busy || loading || taggingLocked || requiresReload}
              onClick={() => { setError(null); setConfirmingComplete(true) }}>Finalizar análise</button>}
        </div>
      </header>
      {workspace.status === 'completed' ? <p className="completed-summary">Análise finalizada. Os datos consérvanse; podes revisar a timeline e navegar polo vídeo. Reábrea para facer cambios.</p> : null}
      <nav className="workspace-step-strip" aria-label="Seccións da análise">
        {([['roster','Convocatoria'],['video','Vídeo e sincronización'],['tagging','Tagging']] as const).map(([step,label]) =>
          <button key={step} type="button" className={`workspace-step${activeStep === step ? ' workspace-step-active' : ''}`}
            aria-current={activeStep === step ? 'page' : undefined} disabled={busy || taggingLocked}
            onClick={() => { setError(null); setActiveStep(step) }}>{label}</button>)}
      </nav>
      {confirmingComplete ? <CompleteAnalysisDialog busy={busy} error={error} onCancel={() => setConfirmingComplete(false)}
        onConfirm={() => { void runMutation(() => completeAnalysis(workspace.id), true).then((saved) => {
          if (saved) { setConfirmingComplete(false); setActiveStep('tagging') }
        }) }} /> : null}
      {error ? (
        <div className="form-error" role="alert">
          <strong>Non puidemos completar a acción.</strong>
          <span>{error}</span>
          {requiresReload ? <button className="button button-secondary" type="button" disabled={busy} onClick={() => setRevision((value) => value + 1)}>Recargar datos</button> : null}
        </div>
      ) : null}

      {activeStep === 'tagging' ? (
        <TaggingPanel
          key={workspace.id}
          workspace={workspace}
          lifecycleManaged
          onSaveStateChange={setSaveState}
          onInteractionLockChange={setTaggingLocked}
          onBack={() => {
            setError(null)
            setActiveStep('video')
          }}
          onWorkspaceChanged={async () => {
            const signal = readController.current?.signal
            const nextWorkspace = await getAnalysisWorkspace(workspace.id, signal)
            if (!signal?.aborted) setWorkspace(nextWorkspace)
          }}
        />
      ) : activeStep === 'video' ? (
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
          onContinue={() => {
            setError(null)
            setActiveStep('tagging')
          }}
        />
      ) : (
        <>
          <fieldset className="workspace-fields" disabled={busy || loading || requiresReload || workspace.status === 'completed'}>
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

              <h2>Engadir á convocatoria</h2>
              <p>
                Usa o nome ou dorsal se aínda non coñeces o xogador. A identidade queda asociada só a esta análise.
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

          </fieldset>
          <div className="workspace-next-card">
            <div>

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
