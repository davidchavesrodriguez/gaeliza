import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PersistenceStatus, type SaveState } from './PersistenceStatus'
import { updateAnalysisEvent } from '../data/event-editing'
import { logQuickEvent, removeAnalysisEvent, rebuildInferredPossessions, reopenAnalysis } from '../data/tagging'
import type { AnalysisWorkspace } from '../domain/analysis'
import { quickEventLabels } from '../domain/tagging'
import { buildVideoSeekTarget, type VideoNavigationInput, type VideoNavigationRequest } from '../domain/video-navigation'
import { TaggingVideoPanel } from './tagging/TaggingVideoPanel'
import { QuickEventForm } from './tagging/QuickEventForm'
import { EventEditor } from './tagging/EventEditor'
import { TaggingTimeline } from './tagging/TaggingTimeline'
import { TaggingScoreboard } from './tagging/TaggingScoreboard'
import { useTaggingEvents } from './tagging/useTaggingEvents'

type Props = {
  workspace: AnalysisWorkspace
  onBack: () => void
  onWorkspaceChanged: () => Promise<void>
  renderContext?: (scoreboard: ReactNode) => ReactNode
  lifecycleManaged?: boolean
  onSaveStateChange?: (state: SaveState) => void
  onInteractionLockChange?: (locked: boolean) => void
}

export function TaggingPanel({ workspace, onBack, onWorkspaceChanged, lifecycleManaged, onSaveStateChange, onInteractionLockChange, renderContext }: Props) {
  const [focusVideoOnRequest, setFocusVideoOnRequest] = useState(false)
  const [videoVisible, setVideoVisible] = useState(workspace.videos.length > 0)
  const [videoRequest, setVideoRequest] = useState<VideoNavigationRequest | null>(() => {
    const first = workspace.videos[0]
    const target = first ? buildVideoSeekTarget(first.url, 0, first.durationSeconds) : null
    return first && target ? { ...target, videoId: first.id, title: first.title || 'Vídeo', requestId: 0 } : null
  })
  function navigateVideo(request: VideoNavigationInput, focus = true) {
    setFocusVideoOnRequest(focus)
    setVideoVisible(true)
    setVideoRequest((current) => ({ ...request, requestId: (current?.requestId ?? 0) + 1 }))
  }
  const [editingId, setEditingId] = useState<string | null>(null)
  const editOrigin = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (editingId === null && editOrigin.current) {
      editOrigin.current.focus()
      editOrigin.current = null
    }
  }, [editingId])
  const videoToggleRef = useRef<HTMLButtonElement>(null)
  const returnToVideoToggle = useRef(false)
  useEffect(() => {
    if (returnToVideoToggle.current) {
      videoToggleRef.current?.focus()
      returnToVideoToggle.current = false
    }
  }, [videoVisible])
  const videoToggle = !videoVisible ? <button ref={videoToggleRef} className="video-visibility-action" type="button" aria-expanded="false"
    aria-controls="tagging-video-panel" onClick={() => { returnToVideoToggle.current = true; setVideoVisible(true) }}>Mostrar vídeo</button> : null
  const [possessionsNeedReview, setPossessionsNeedReview] = useState(false)
  const { saveState, events, loadingEvents, busy, error, notice, needsRefresh, refreshData, runTaggingMutation } =
    useTaggingEvents(workspace.id, onWorkspaceChanged, onSaveStateChange, onInteractionLockChange)
  const eventsUnavailable = needsRefresh && events.length === 0
  const captureDisabled = busy || loadingEvents || needsRefresh || workspace.status === 'completed'
  const timeline = <TaggingTimeline workspace={workspace} events={events} loadingEvents={loadingEvents} disabled={captureDisabled} activeEventId={editingId} unavailable={eventsUnavailable}
          onSeek={navigateVideo}
          onEdit={(id) => { if (!captureDisabled) { editOrigin.current = document.activeElement as HTMLElement; setEditingId(id) } }}
          onDelete={async (id) => {
            if (captureDisabled) return
            await runTaggingMutation(async () => { await removeAnalysisEvent(id); return 'Evento eliminado.' })
          }}
          onRebuild={async () => {
            if (captureDisabled) return
            await runTaggingMutation(async () => {
              const count = await rebuildInferredPossessions(workspace.id)
              setPossessionsNeedReview(false)
              return `${count} posesións inferidas a partir dos eventos canónicos.`
            })
          }} />
  const eventForm = (editingId && workspace.status !== 'completed' ? <EventEditor key={editingId} eventId={editingId}
          videoToggle={videoToggle} workspace={workspace} busy={busy} disabled={captureDisabled} onCancel={() => setEditingId(null)}
          onSave={(event, input) => runTaggingMutation(async () => {
            await updateAnalysisEvent(event, input)
            setPossessionsNeedReview(true)
            return 'Evento actualizado.'
          })} /> : <QuickEventForm videoToggle={videoToggle} workspace={workspace} captureDisabled={captureDisabled} busy={busy}
          onSave={(input) => runTaggingMutation(async () => {
            await logQuickEvent(input)
            return input.foulDiscipline ? 'Falta e tarxeta gardadas.' : `Evento gardado: ${quickEventLabels[input.eventType]}.`
          })} />)
  const scoreboard = <TaggingScoreboard workspace={workspace} events={events} loading={loadingEvents} unavailable={eventsUnavailable} />
  return (
    <div className="tagging-stack">
      {renderContext ? renderContext(scoreboard) : null}
      {!onSaveStateChange ? <PersistenceStatus state={saveState} /> : null}
      {workspace.status === 'completed' && !lifecycleManaged ? (
        <div className="tagging-readonly-banner">
          <div>
            <strong>Análise completada.</strong>
            <span>
              Os eventos están bloqueados para evitar cambios accidentais. Reábrea se
              necesitas corrixir o tagging.
            </span>
          </div>
          <button
            className="button button-secondary"
            type="button"
            disabled={busy}
            onClick={() => {
              void runTaggingMutation(async () => { await reopenAnalysis(workspace.id); return 'Análise reaberta. Xa podes volver editar eventos.' })
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
          <button
            className="button button-secondary"
            type="button"
            disabled={busy}
            onClick={() => { void refreshData() }}
          >
            Recargar datos
          </button>
        </div>
      ) : null}

      {notice ? (
        <div className="tagging-notice" role="status">
          {notice}
        </div>
      ) : null}

      {!renderContext ? scoreboard : null}
      {possessionsNeedReview ? <p role="status">Evento actualizado. Revisa e reconstrúe explicitamente as posesións inferidas; non se reconstruíron automaticamente.</p> : null}
      <h2 className="visually-hidden">{workspace.status === 'completed' ? 'Revisión de eventos' : 'Rexistro de eventos'}</h2>
      {workspace.status === 'completed' && videoToggle ? <div className="tagging-review-tools">{videoToggle}</div> : null}
      <div className={`tagging-layout${videoVisible ? ' tagging-layout-with-video' : ''}`}>
        {workspace.status === 'completed' ? timeline : eventForm}
        {videoVisible ? <TaggingVideoPanel visibilityControlRef={videoToggleRef} onHide={() => { returnToVideoToggle.current = true; setVideoVisible(false) }} videos={workspace.videos} request={videoRequest} focusOnRequest={focusVideoOnRequest} onSelect={(id) => {
          const video = workspace.videos.find((item) => item.id === id)
          const target = video ? buildVideoSeekTarget(video.url, 0, video.durationSeconds) : null
          if (video && target) navigateVideo({ ...target, videoId: video.id, title: video.title || 'Vídeo' }, false)
          else setVideoRequest(null)
        }} /> : null}
      </div>
      {workspace.status !== 'completed' ? timeline : null}
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

          <strong>Captura de eventos do partido</strong>
          <small>
            Os eventos gardados aparecen na timeline. Podes volver á configuración
            do vídeo cando o necesites.
          </small>
        </div>
      </div>
    </div>
  )
}
