import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AnalysisWorkspace } from '../../domain/analysis'
import { buildCaptureInput, changeCapture, defaultCapture, pruneRoles, withDestination, type CaptureDraft, type CaptureFormState } from '../../domain/event-capture'
import { quickEventLabels, type LogQuickEventInput } from '../../domain/tagging'
import { compatibleAdditionalParticipants, mergeEditingParticipants, type EventForEditing } from '../../domain/event-editing'
import { AdditionalEventParticipants } from './AdditionalEventParticipants'
import { PitchCoordinatePicker } from '../PitchCoordinatePicker'
import { CommonEventFields } from './CommonEventFields'
import { EventDetailFields } from './EventDetailFields'
import { EventParticipantFields } from './EventParticipantFields'

type Props = {
  workspace: AnalysisWorkspace
  captureDisabled: boolean
  busy: boolean
  initialEvent?: EventForEditing
  onCancel?: () => void
  onSave: (input: LogQuickEventInput) => Promise<boolean>
}
export function QuickEventForm({ workspace, captureDisabled, busy, onSave, initialEvent, onCancel }: Props) {
  const [form, setForm] = useState<CaptureFormState>(() => initialEvent?.form ?? ({
    teamId: workspace.homeTeam.id, periodId: workspace.periods[0]?.id ?? '', clock: '0:00',
    x: null, y: null, capture: defaultCapture('shot'), roles: {},
  }))
  const [additional, setAdditional] = useState(initialEvent?.additionalParticipants ?? [])
  const [error, setError] = useState<string | null>(null)
  const submitting = useRef(false)

  useEffect(() => {
    // Editing must reject stale snapshots rather than silently drop identities.
    if (initialEvent) return
    setForm((current) => ({ ...current, roles: pruneRoles(current.capture, current.roles, current.teamId, workspace.participants) }))
  }, [workspace.participants, initialEvent])

  function updateCapture(next: CaptureDraft) {
    setError(null)
    const nextForm = changeCapture(form, next, workspace.participants)
    setAdditional((items) => compatibleAdditionalParticipants(items, nextForm, workspace.participants))
    setForm(nextForm)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (captureDisabled || submitting.current) return
    setError(null)
    let input: LogQuickEventInput
    try {
      input = buildCaptureInput(form, workspace)
      if (initialEvent) input.participants = mergeEditingParticipants(input.participants, additional, form, workspace.participants)
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Revisa os datos do evento.'); return }
    submitting.current = true
    try {
      if (await onSave(input)) {
        if (initialEvent) { onCancel?.(); return }
        setForm((current) => ({ ...current, roles: {}, x: null, y: null,
          capture: withDestination(current.capture, null, null),
        }))
      }
    } finally { submitting.current = false }
  }

  const { capture } = form
  const saveLabel = initialEvent ? 'Gardar cambios' : `Gardar ${quickEventLabels[capture.eventType].toLowerCase()}`
  return <form className="state-card tagging-capture-card" onSubmit={handleSubmit}>
    <div className="section-heading-inline"><div>
      <span className="eyebrow">{initialEvent ? 'Edición de evento' : 'Captura rápida'}</span><h2>{initialEvent ? 'Modificar evento' : 'Rexistra un feito do partido'}</h2>
      <p>Garda o mínimo que coñezas. Xogador e posición son opcionais; o evento segue sendo válido a nivel de equipo.</p>
    </div></div>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    {initialEvent ? <p>Tipo: {quickEventLabels[capture.eventType]}. Para outro tipo físico, elimina e crea un evento novo.</p> : <div className="event-type-grid" role="group" aria-label="Tipo de evento">
      {eventTypes.map((type) => <button
        className={`event-type-button${type === capture.eventType ? ' event-type-button-active' : ''}`}
        type="button" key={type} disabled={captureDisabled} aria-pressed={type === capture.eventType}
        onClick={() => { if (type !== capture.eventType) updateCapture(defaultCapture(type)) }}>{quickEventLabels[type]}</button>)}
    </div>}
    <CommonEventFields workspace={workspace} form={form} disabled={captureDisabled} onChange={(field, value) => {
      setError(null)
      const next = { ...form, [field]: value, roles: form.roles }
      if (field === 'teamId') next.roles = pruneRoles(form.capture, form.roles, value, workspace.participants)
      setAdditional((items) => compatibleAdditionalParticipants(items, next, workspace.participants))
      setForm(next)
    }} />
    <EventDetailFields draft={capture} disabled={captureDisabled} onChange={updateCapture} />
    <EventParticipantFields capture={capture} teamId={form.teamId} roles={form.roles} participants={workspace.participants}
      disabled={captureDisabled} onChange={(role, id) => setForm((current) => ({ ...current, roles: { ...current.roles, [role]: id } }))} />
    {initialEvent ? <AdditionalEventParticipants capture={capture} teamId={form.teamId} roster={workspace.participants}
      items={additional} disabled={captureDisabled} onChange={setAdditional} /> : null}
    <div className="tagging-pitch-section">
      <div><span className="roster-subheading">Posición no campo</span><small>Opcional · coordenadas raw 0–100</small></div>
      <PitchCoordinatePicker x={form.x} y={form.y} disabled={captureDisabled}
        onChange={(x, y) => setForm((current) => ({ ...current, x, y }))} />
    </div>
    {capture.eventType === 'pass' || capture.eventType === 'kickout' ? <div className="tagging-pitch-section">
      <div><span className="roster-subheading">Destino no campo</span><small>Opcional · coordenadas raw 0–100</small></div>
      <PitchCoordinatePicker labelPrefix="Destino" x={capture.detail.end_x} y={capture.detail.end_y} disabled={captureDisabled}
        onChange={(end_x, end_y) => updateCapture(withDestination(capture, end_x, end_y))} />
    </div> : null}
    <button className="button button-primary tagging-save-button" type="submit" disabled={captureDisabled}>
      {busy ? 'Gardando…' : saveLabel}

    </button>
    {onCancel ? <button className="button button-secondary" type="button" disabled={busy} onClick={onCancel}>Cancelar edición</button> : null}
  </form>
}

const eventTypes = ['shot', 'recovery', 'turnover', 'foul', 'card', 'kickout', 'block',
  'pass', 'duel', 'dribble', 'restart', 'substitution', 'goalkeeper_change'] as const
