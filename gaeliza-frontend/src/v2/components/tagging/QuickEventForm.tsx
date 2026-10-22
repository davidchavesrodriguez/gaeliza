import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AnalysisWorkspace } from '../../domain/analysis'
import { buildCaptureInput, changeCapture, defaultCapture, pruneRoles, withDestination, type CaptureDraft, type CaptureFormState } from '../../domain/event-capture'
import { quickEventLabels, type FoulDiscipline, type LogQuickEventInput } from '../../domain/tagging'
import { compatibleAdditionalParticipants, mergeEditingParticipants, type EventForEditing } from '../../domain/event-editing'
import { AdditionalEventParticipants } from './AdditionalEventParticipants'
import { PitchCoordinatePicker } from '../PitchCoordinatePicker'
import { CommonEventFields } from './CommonEventFields'
import { EventTypeControls } from './EventTypeControls'
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
  const [cardType, setCardType] = useState<FoulDiscipline['cardType'] | ''>('')
  // null means no explicit choice yet; empty string is an explicit unknown.
  const [recipient, setRecipient] = useState<string | null>(null)
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
    if (next.eventType !== form.capture.eventType) { setCardType(''); setRecipient(null) }
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
      if (!initialEvent && input.eventType === 'foul' && cardType) {
        const recipientId = recipient ?? form.roles.offender ?? ''
        if (recipientId && !workspace.participants.some((p) => p.id === recipientId && p.teamId === form.teamId)) {
          throw new Error('Revisa o participante sancionado.')
        }
        input.foulDiscipline = { cardType, recipientId: recipientId || null }
      }
      if (initialEvent) input.participants = mergeEditingParticipants(input.participants, additional, form, workspace.participants)
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Revisa os datos do evento.'); return }
    submitting.current = true
    try {
      if (await onSave(input)) {
        if (initialEvent) { onCancel?.(); return }
        setCardType(''); setRecipient(null)
        setForm((current) => ({ ...current, roles: {}, x: null, y: null,
          capture: withDestination(current.capture, null, null),
        }))
      }
    } finally { submitting.current = false }
  }

  const { capture } = form
  const saveLabel = initialEvent ? 'Gardar cambios' : `Gardar ${quickEventLabels[capture.eventType].toLowerCase()}`
  return <form className="state-card tagging-capture-card" onSubmit={handleSubmit}>
    {!initialEvent ? <EventTypeControls active={capture.eventType} disabled={captureDisabled}
      onSelect={(type) => { if (type !== capture.eventType) updateCapture(defaultCapture(type)) }} /> : null}
    <div className="active-event-heading"><h3>{initialEvent ? 'Modificar evento' : quickEventLabels[capture.eventType]}</h3>
      <p className="form-hint">Rexistra o que coñezas. O borrador queda gardado cando confirmas o evento.</p>
      {initialEvent ? <p className="form-hint">Tipo: {quickEventLabels[capture.eventType]}. Para outro tipo físico, elimina e crea un evento novo.</p> : null}
    </div>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    <div className="capture-fields-and-pitch"><div className="capture-fields">
    <CommonEventFields workspace={workspace} form={form} disabled={captureDisabled} onChange={(field, value) => {
      setError(null)
      const next = { ...form, [field]: value, roles: form.roles }
      if (field === 'teamId') { setRecipient(null) }
      if (field === 'teamId') next.roles = pruneRoles(form.capture, form.roles, value, workspace.participants)
      setAdditional((items) => compatibleAdditionalParticipants(items, next, workspace.participants))
      setForm(next)
    }} />
    <EventDetailFields draft={capture} disabled={captureDisabled} onChange={updateCapture} />
    <EventParticipantFields capture={capture} teamId={form.teamId} roles={form.roles} participants={workspace.participants}
      disabled={captureDisabled} onChange={(role, id) => setForm((current) => ({ ...current, roles: { ...current.roles, [role]: id } }))} />
    {!initialEvent && capture.eventType === 'foul' ? <div className="tagging-participant-grid">
      <label><span>Sanción disciplinaria · opcional</span>
        <select value={cardType} disabled={captureDisabled} onChange={(e) => setCardType(e.target.value as typeof cardType)}>
          <option value="">Sen tarxeta</option><option value="yellow">Amarela</option>
          <option value="black">Negra</option><option value="red">Vermella</option>
        </select>
      </label>
      {cardType ? <label><span>Sancionado</span><select disabled={captureDisabled}
        value={recipient ?? form.roles.offender ?? ''} onChange={(e) => setRecipient(e.target.value)}>
        <option value="">Sen identificar</option>
        {workspace.participants.filter((p) => p.teamId === form.teamId).map((p) =>
          <option key={p.id} value={p.id}>{p.number !== null ? `#${p.number} · ` : ''}{p.displayName}</option>)}
      </select></label> : null}
    </div> : null}
    {initialEvent ? <AdditionalEventParticipants capture={capture} teamId={form.teamId} roster={workspace.participants}
      items={additional} disabled={captureDisabled} onChange={setAdditional} /> : null}
    {capture.eventType === 'kickout' ? <p className="form-hint">O saque de porta gárdase sen posición inicial. Marca só o destino se o coñeces.</p> : null}
    </div><div className="event-coordinate-sections">
    {capture.eventType !== 'kickout' ? <div className="tagging-pitch-section">
      <div><span className="roster-subheading">Posición no campo</span><small>Opcional · escala 0–100</small></div>
      <PitchCoordinatePicker x={form.x} y={form.y} disabled={captureDisabled}
        onChange={(x, y) => setForm((current) => ({ ...current, x, y }))} />
    </div> : null}
    {capture.eventType === 'pass' || capture.eventType === 'kickout' ? <div className="tagging-pitch-section">
      <div><span className="roster-subheading">Destino no campo</span><small>Opcional · escala 0–100</small></div>
      <PitchCoordinatePicker labelPrefix="Destino" x={capture.detail.end_x} y={capture.detail.end_y} disabled={captureDisabled}
        onChange={(end_x, end_y) => updateCapture(withDestination(capture, end_x, end_y))} />
    </div> : null}
    </div>
    </div>
    <button className="button button-primary tagging-save-button" type="submit" disabled={captureDisabled}>
      {busy ? 'Gardando…' : saveLabel}
    </button>
    {onCancel ? <button className="button button-secondary" type="button" disabled={busy} onClick={onCancel}>Cancelar edición</button> : null}
  </form>
}
