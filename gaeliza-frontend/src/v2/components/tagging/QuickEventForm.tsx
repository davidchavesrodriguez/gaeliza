import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { AnalysisWorkspace } from '../../domain/analysis'
import { buildCaptureInput, changeCapture, defaultCapture, pruneRoles, withDestination, type CaptureDraft, type CaptureFormState } from '../../domain/event-capture'
import { quickEventLabels, type FoulDiscipline, type LogQuickEventInput } from '../../domain/tagging'
import { compatibleAdditionalParticipants, mergeEditingParticipants, type EventForEditing } from '../../domain/event-editing'
import { AdditionalEventParticipants } from './AdditionalEventParticipants'
import { EventPositionFields } from './EventPositionFields'
import { EventTimeControls } from './EventTimeControls'
import { CommonEventFields } from './CommonEventFields'
import { EventTypeControls } from './EventTypeControls'
import { EventDetailFields } from './EventDetailFields'
import { EventParticipantFields } from './EventParticipantFields'

type Props = {
  workspace: AnalysisWorkspace
  captureDisabled: boolean
  busy: boolean
  videoToggle?: ReactNode
  initialEvent?: EventForEditing
  onCancel?: () => void
  onSave: (input: LogQuickEventInput) => Promise<boolean>
}
export function QuickEventForm({ workspace, captureDisabled, busy, onSave, initialEvent, onCancel, videoToggle }: Props) {
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
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (!initialEvent) return
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ block: 'nearest' })
  }, [initialEvent])

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
  function changeCommon(field: 'teamId' | 'periodId' | 'clock', value: string) {
    setError(null)
    const next = { ...form, [field]: value, roles: form.roles }
    if (field === 'teamId') { setRecipient(null); next.roles = pruneRoles(form.capture, form.roles, value, workspace.participants) }
    setAdditional((items) => compatibleAdditionalParticipants(items, next, workspace.participants))
    setForm(next)
  }
  const hasPitchColumn = !['card', 'substitution', 'goalkeeper_change'].includes(capture.eventType)
  return <form className="state-card tagging-capture-card" onSubmit={handleSubmit}>
    <div className="capture-temporal-toolbar"><EventTimeControls workspace={workspace} form={form} disabled={captureDisabled} onChange={changeCommon} /></div>
    {!initialEvent ? <EventTypeControls active={capture.eventType} disabled={captureDisabled}
      onSelect={(type) => { if (type !== capture.eventType) updateCapture(defaultCapture(type)) }} /> : null}
    <div className="active-event-heading"><h3 ref={heading} tabIndex={initialEvent ? -1 : undefined}>{initialEvent ? `Modificar ${quickEventLabels[capture.eventType].toLowerCase()}` : quickEventLabels[capture.eventType]}</h3>
      <p className="form-hint capture-save-hint">Confirma o evento para gardalo.</p>
      {initialEvent ? <p className="form-hint">Tipo: {quickEventLabels[capture.eventType]}. Para outro tipo físico, elimina e crea un evento novo.</p> : null}
    </div>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    <div className={`capture-fields-and-pitch${hasPitchColumn ? ` capture-with-position${capture.eventType === 'pass' ? ' capture-with-route' : ''}` : ''}`}><div className="capture-fields">
    <div className="capture-essential-fields">
      <CommonEventFields workspace={workspace} form={form} disabled={captureDisabled} onChange={changeCommon} />
      <EventDetailFields draft={capture} disabled={captureDisabled} onChange={updateCapture} />
    </div>
    <fieldset className="capture-protagonists"><legend className="visually-hidden">Protagonistas</legend>
    <EventParticipantFields capture={capture} teamId={form.teamId} roles={form.roles} participants={workspace.participants}
      disabled={captureDisabled} onChange={(role, id) => setForm((current) => ({ ...current, roles: { ...current.roles, [role]: id } }))} />
    </fieldset>
    <EventDetailFields draft={capture} section="enrichment" disabled={captureDisabled} onChange={updateCapture} />
    {!initialEvent && capture.eventType === 'foul' ? <fieldset className="foul-discipline"><legend>Consecuencia disciplinaria (opcional)</legend><div className="tagging-participant-grid">
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
    </div></fieldset> : null}
    {initialEvent ? <AdditionalEventParticipants capture={capture} teamId={form.teamId} roster={workspace.participants}
      items={additional} disabled={captureDisabled} onChange={setAdditional} /> : null}
    {capture.eventType === 'kickout' ? <p className="form-hint">O saque de porta gárdase sen posición inicial. Marca só o destino se o coñeces.</p> : null}
    </div>
    <EventPositionFields key={capture.eventType} capture={capture} x={form.x} y={form.y} disabled={captureDisabled}
      onOrigin={(x, y) => setForm((current) => ({ ...current, x, y }))}
      onDestination={(end_x, end_y) => updateCapture(withDestination(capture, end_x, end_y))} />
    </div>
    <div className="capture-submit">
    <button className="button button-primary tagging-save-button" type="submit" disabled={captureDisabled}>
      {busy ? 'Gardando…' : saveLabel}
    </button>
    {onCancel ? <button className="button button-secondary" type="button" disabled={busy} onClick={onCancel}>Cancelar edición</button> : null}
    {videoToggle}
    </div>
  </form>
}
