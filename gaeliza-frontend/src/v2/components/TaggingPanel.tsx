import { logQuickEvent, removeAnalysisEvent, rebuildInferredPossessions, reopenAnalysis } from '../data/tagging'
import type { AnalysisWorkspace } from '../domain/analysis'
import { quickEventLabels } from '../domain/tagging'
import { QuickEventForm } from './tagging/QuickEventForm'
import { TaggingTimeline } from './tagging/TaggingTimeline'
import { TaggingScoreboard } from './tagging/TaggingScoreboard'
import { useTaggingEvents } from './tagging/useTaggingEvents'

type Props = {
  workspace: AnalysisWorkspace
  onBack: () => void
  onWorkspaceChanged: () => Promise<void>
}

export function TaggingPanel({ workspace, onBack, onWorkspaceChanged }: Props) {
  const { events, loadingEvents, busy, error, notice, needsRefresh, refreshData, runTaggingMutation } =
    useTaggingEvents(workspace.id, onWorkspaceChanged)
  const captureDisabled = busy || loadingEvents || needsRefresh || workspace.status === 'completed'
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
              void runTaggingMutation(async () => { await reopenAnalysis(workspace.id); return 'Análise reaberto. Xa podes volver editar eventos.' })
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

      <TaggingScoreboard workspace={workspace} events={events} />
      <div className="tagging-layout">
        <QuickEventForm workspace={workspace} captureDisabled={captureDisabled} busy={busy}
          onSave={(input) => runTaggingMutation(async () => {
            await logQuickEvent(input)
            return `${quickEventLabels[input.eventType]} gardado.`
          })} />
        <TaggingTimeline workspace={workspace} events={events} loadingEvents={loadingEvents} disabled={captureDisabled}
          onDelete={async (id) => {
            if (captureDisabled) return
            await runTaggingMutation(async () => { await removeAnalysisEvent(id); return 'Evento eliminado.' })
          }}
          onRebuild={async () => {
            if (captureDisabled) return
            await runTaggingMutation(async () => {
              const count = await rebuildInferredPossessions(workspace.id)
              return `${count} posesións inferidas a partir dos eventos canónicos.`
            })
          }} />
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
