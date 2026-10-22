import { useEffect, useState, type ReactNode } from 'react'
import { getEventForEditing } from '../../data/event-editing'
import { editingTitle, type EventForEditing } from '../../domain/event-editing'
import type { AnalysisWorkspace } from '../../domain/analysis'
import type { LogQuickEventInput } from '../../domain/tagging'
import { QuickEventForm } from './QuickEventForm'

type Props = {
  eventId: string; workspace: AnalysisWorkspace; busy: boolean; disabled: boolean
  videoToggle?: ReactNode
  onCancel: () => void; onSave: (event: EventForEditing, input: LogQuickEventInput) => Promise<boolean>
}
export function EventEditor({ eventId, workspace, busy, disabled, onCancel, onSave, videoToggle }: Props) {
  const [event, setEvent] = useState<EventForEditing | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void getEventForEditing(workspace.id, eventId, controller.signal).then((next) => {
      if (!controller.signal.aborted) setEvent(next)
    }).catch((caught) => {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Fallou a carga do evento.')
    })
    return () => controller.abort()
  }, [eventId, workspace.id])
  if (!event) return <section className="state-card" aria-live="polite">
    <p>{error ?? 'Cargando evento para editar…'}</p>
    <button className="button button-secondary" type="button" onClick={onCancel}>Cancelar edición</button>
  </section>
  return <section aria-label={editingTitle(event)}>
    <p>Ao gardar, revisa as posesións inferidas. Os eventos ligados a posesións manuais requiren revisar esa asociación primeiro.</p>
    <QuickEventForm videoToggle={videoToggle} initialEvent={event} workspace={workspace} busy={busy} captureDisabled={disabled}
      onCancel={onCancel} onSave={(input) => onSave(event, input)} />
  </section>
}
