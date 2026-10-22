import { TeamRoster } from '../components/TeamRoster'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { completeAnalysis } from '../data/analyses'
import { reopenAnalysis } from '../data/tagging'
import { PersistenceStatus, type SaveState } from '../components/PersistenceStatus'
import { CompleteAnalysisDialog } from '../components/CompleteAnalysisDialog'
import { analysisStatusLabels } from '../domain/presentation'
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
  type AnalysisParticipant,
  type AnalysisWorkspace,
  type AttackingDirection,
  type RosterPlayer,
} from '../domain/analysis'
import { formatMatchDate } from '../domain/matches'

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
  const [temporaryDrafts, setTemporaryDrafts] = useState<Record<string, { name: string; number: string }>>({})

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

  const currentWorkspace = workspace
  const teams = [workspace.homeTeam, workspace.awayTeam]

  // Tagging supplies the scoreboard from its existing event read; the page owns
  // the same navigation/lifecycle chrome for every step, without another query.
  function renderContext(scoreboard?: ReactNode) {
    return <header className="workspace-context">
      <div className="workspace-toolbar">
        <Link className="text-link" to="/app">← Inicio</Link>
        <p className="workspace-match-meta">{formatMatchDate(currentWorkspace.scheduledAt)} · {currentWorkspace.mode === 'live' ? 'En directo' : 'Desde vídeo'}</p>
        <PersistenceStatus state={saveState} />
      </div>
      {scoreboard ?? <h1 className="workspace-match-name">{currentWorkspace.homeTeam.shortName ?? currentWorkspace.homeTeam.name} <span>—</span> {currentWorkspace.awayTeam.shortName ?? currentWorkspace.awayTeam.name}</h1>}
      <div className="workspace-navigation">
        <nav className="workspace-step-strip" aria-label="Seccións da análise">
          {([['roster','Convocatoria'],['video','Vídeo e sincronización'],['tagging','Tagging']] as const).map(([step,label]) =>
            <button key={step} type="button" className={`workspace-step${activeStep === step ? ' workspace-step-active' : ''}`}
              aria-current={activeStep === step ? 'page' : undefined} disabled={busy || taggingLocked}
              onClick={() => { setError(null); setActiveStep(step) }}>{label}</button>)}
        </nav>
        <div className="workspace-lifecycle">
          <span className={`workspace-analysis-status status-${currentWorkspace.status}`}>{analysisStatusLabels[currentWorkspace.status]}</span>
          {currentWorkspace.status === 'completed' ? <button className="workspace-lifecycle-action" type="button"
            disabled={busy || loading || taggingLocked || requiresReload}
            onClick={() => { void runMutation(() => reopenAnalysis(currentWorkspace.id), true) }}>Reabrir análise</button> :
            <button className="workspace-lifecycle-action" type="button" disabled={busy || loading || taggingLocked || requiresReload}
              onClick={() => { setError(null); setConfirmingComplete(true) }}>Finalizar análise</button>}
        </div>
      </div>
      {currentWorkspace.status === 'completed' ? <p className="completed-summary">Análise finalizada. Os datos consérvanse; podes revisar a timeline e navegar polo vídeo. Reábrea para facer cambios.</p> : null}
      {error ? <div className="form-error" role="alert">
        <strong>Non puidemos completar a acción.</strong><span>{error}</span>
        {requiresReload ? <button className="button button-secondary" type="button" disabled={busy} onClick={() => setRevision((value) => value + 1)}>Recargar datos</button> : null}
      </div> : null}
    </header>
  }

  return (
    <div className="page-stack workspace-page">
      {activeStep !== 'tagging' ? renderContext() : null}
      {confirmingComplete ? <CompleteAnalysisDialog busy={busy} error={error} onCancel={() => setConfirmingComplete(false)}
        onConfirm={() => { void runMutation(() => completeAnalysis(workspace.id), true).then((saved) => {
          if (saved) { setConfirmingComplete(false); setActiveStep('tagging') }
        }) }} /> : null}
      {activeStep === 'tagging' ? (
        <TaggingPanel
          key={workspace.id}
          workspace={workspace}
          lifecycleManaged
          renderContext={renderContext}
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
          <div className="workspace-next-card roster-navigation">
            <div>

              <strong>Vídeo e sincronización</strong>
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
          <fieldset className="workspace-fields" disabled={busy || loading || requiresReload || workspace.status === 'completed'}>
          <div className="roster-grid">
            {teams.map((team) => (
              <TeamRoster
                key={team.id}
                team={team}
                draft={temporaryDrafts[team.id] ?? { name: '', number: '' }}
                onDraftChange={(draft) => setTemporaryDrafts((current) => ({ ...current, [team.id]: draft }))}
                participants={participantsByTeam.get(team.id) ?? []}
                availablePlayers={availablePlayersByTeam.get(team.id) ?? []}
                busy={busy}
                onAddPlayer={handleAddRosterPlayer}
                onRemoveParticipant={handleRemoveParticipant}
                onAddTemporary={(displayName, number) => runMutation(() => addTemporaryParticipant({
                  analysisId, teamId: team.id, displayName, number,
                }))}
              />
            ))}
          </div>

          </fieldset>

        </>
      )}
    </div>
  )
}
