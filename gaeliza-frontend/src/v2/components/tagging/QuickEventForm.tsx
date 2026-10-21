import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AnalysisWorkspace } from '../../domain/analysis'
import { buildCaptureInput, changeCapture, defaultCapture, pruneRoles, withDestination, type CaptureDraft, type CaptureFormState } from '../../domain/event-capture'
import { quickEventLabels, type LogQuickEventInput } from '../../domain/tagging'
import { PitchCoordinatePicker } from '../PitchCoordinatePicker'
import { CommonEventFields } from './CommonEventFields'
import { EventDetailFields } from './EventDetailFields'
import { EventParticipantFields } from './EventParticipantFields'

type Props = {
  workspace: AnalysisWorkspace
  captureDisabled: boolean
  busy: boolean
  onSave: (input: LogQuickEventInput) => Promise<boolean>
}
export function QuickEventForm({ workspace, captureDisabled, busy, onSave }: Props) {
  const [form, setForm] = useState<CaptureFormState>(() => ({
    teamId: workspace.homeTeam.id, periodId: workspace.periods[0]?.id ?? '', clock: '0:00',
    x: null, y: null, capture: defaultCapture('shot'), roles: {},
  }))
  const [error, setError] = useState<string | null>(null)
  const submitting = useRef(false)

  useEffect(() => {
    setForm((current) => ({ ...current, roles: pruneRoles(current.capture, current.roles, current.teamId, workspace.participants) }))
  }, [workspace.participants])

  function updateCapture(next: CaptureDraft) {
    setError(null)
    setForm((current) => changeCapture(current, next, workspace.participants))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (captureDisabled || submitting.current) return
    setError(null)
    let input: LogQuickEventInput
    try { input = buildCaptureInput(form, workspace) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Revisa os datos do evento.'); return }
    submitting.current = true
    try {
      if (await onSave(input)) {
        setForm((current) => ({ ...current, roles: {}, x: null, y: null,
          capture: withDestination(current.capture, null, null),
        }))
      }
    } finally { submitting.current = false }
  }

  const { capture } = form
  return <form className="state-card tagging-capture-card" onSubmit={handleSubmit}>
    <div className="section-heading-inline"><div>
      <span className="eyebrow">Captura rápida</span><h2>Rexistra un feito do partido</h2>
      <p>Garda o mínimo que coñezas. Xogador e posición son opcionais; o evento segue sendo válido a nivel de equipo.</p>
    </div></div>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    <div className="event-type-grid" role="group" aria-label="Tipo de evento">
      {eventTypes.map((type) => <button
        className={`event-type-button${type === capture.eventType ? ' event-type-button-active' : ''}`}
        type="button" key={type} disabled={captureDisabled} aria-pressed={type === capture.eventType}
        onClick={() => { if (type !== capture.eventType) updateCapture(defaultCapture(type)) }}>{quickEventLabels[type]}</button>)}
    </div>
    <CommonEventFields workspace={workspace} form={form} disabled={captureDisabled} onChange={(field, value) => {
      setError(null)
      setForm((current) => ({ ...current, [field]: value,
        roles: field === 'teamId' ? pruneRoles(current.capture, current.roles, value, workspace.participants) : current.roles,
      }))
    }} />
    <EventDetailFields draft={capture} disabled={captureDisabled} onChange={updateCapture} />
    <EventParticipantFields capture={capture} teamId={form.teamId} roles={form.roles} participants={workspace.participants}
      disabled={captureDisabled} onChange={(role, id) => setForm((current) => ({ ...current, roles: { ...current.roles, [role]: id } }))} />
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
      {busy ? 'Gardando…' : `Gardar ${quickEventLabels[capture.eventType].toLowerCase()}`}
    </button>
  </form>
}

const eventTypes = ['shot', 'recovery', 'turnover', 'foul', 'card', 'kickout', 'block',
  'pass', 'duel', 'dribble', 'restart', 'substitution', 'goalkeeper_change'] as const
