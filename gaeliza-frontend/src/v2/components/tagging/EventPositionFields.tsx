import { useState } from 'react'
import type { CaptureDraft } from '../../domain/event-capture'
import type { QuickEventType } from '../../domain/tagging'
import { PitchCoordinatePicker } from '../PitchCoordinatePicker'

const positionLabels: Record<QuickEventType, string> = {
  shot: 'Posición do tiro', pass: 'Orixe do pase', recovery: 'Punto de recuperación',
  turnover: 'Posición da perda', duel: 'Posición do duelo', dribble: 'Posición do regate',
  block: 'Posición do bloqueo', foul: 'Posición da falta', card: 'Posición da tarxeta',
  restart: 'Posición do reinicio', substitution: 'Posición do cambio',
  goalkeeper_change: 'Posición do cambio de porteiro', kickout: 'Destino do saque',
}
type Props = {
  capture: CaptureDraft; x: number | null; y: number | null; disabled: boolean
  onOrigin: (x: number | null, y: number | null) => void
  onDestination: (x: number | null, y: number | null) => void
}
export function EventPositionFields({ capture, x, y, disabled, onOrigin, onDestination }: Props) {
  // These events retain their existing optional position controls, without
  // reserving a pitch column when the user is only recording a personnel change.
  const supplementary = ['card', 'substitution', 'goalkeeper_change'].includes(capture.eventType)
  const [expanded, setExpanded] = useState(x !== null || y !== null)
  const fields = <>
    {capture.eventType !== 'kickout' ? <section className="tagging-pitch-section" aria-label={positionLabels[capture.eventType]}>
      <div><strong>{positionLabels[capture.eventType]}</strong><small>Opcional · 0–100</small></div>
      <PitchCoordinatePicker x={x} y={y} disabled={disabled} onChange={onOrigin} />
    </section> : null}
    {capture.eventType === 'pass' || capture.eventType === 'kickout' ? <section className="tagging-pitch-section" aria-label={capture.eventType === 'kickout' ? 'Destino do saque' : 'Destino do pase'}>
      <div><strong>{capture.eventType === 'kickout' ? 'Destino do saque' : 'Destino do pase'}</strong><small>Opcional · 0–100</small></div>
      <PitchCoordinatePicker labelPrefix="Destino" x={capture.detail.end_x} y={capture.detail.end_y}
        disabled={disabled} onChange={onDestination} />
    </section> : null}
  </>
  return supplementary ? <details className="supplementary-position" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary>Posición do evento (opcional)</summary>{fields}
  </details> : <div className="event-coordinate-sections">{fields}</div>
}
