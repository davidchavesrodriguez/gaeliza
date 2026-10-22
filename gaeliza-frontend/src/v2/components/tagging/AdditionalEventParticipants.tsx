import { useState } from 'react'
import type { AnalysisParticipant } from '../../domain/analysis'
import { editingRoleSpecs } from '../../domain/event-editing'
import { eligibleParticipants, type CaptureDraft } from '../../domain/event-capture'
import type { EventParticipantInput } from '../../domain/tagging'

type Props = {
  capture: CaptureDraft; teamId: string; roster: AnalysisParticipant[]
  items: EventParticipantInput[]; disabled: boolean; onChange: (items: EventParticipantInput[]) => void
}
export function AdditionalEventParticipants({ capture, teamId, roster, items, disabled, onChange }: Props) {
  const [role, setRole] = useState('')
  const [personId, setPersonId] = useState('')
  const specs = editingRoleSpecs(capture)
  const selected = specs.find((spec) => spec.role === role)
  const candidates = selected ? eligibleParticipants(selected, teamId, roster) : []
  return <fieldset disabled={disabled} className="additional-event-roles">
    <legend>Roles adicionais</legend>
    <p>Consérvanse os roles que a captura rápida non amosaba. Podes revisalos aquí.</p>
    {items.map((item, index) => <div key={`${item.role}:${item.participantId}`}>
      <span>{item.role} · {roster.find((p) => p.id === item.participantId)?.displayName ?? 'Participante non dispoñible'}</span>
      <button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))}>Quitar rol {item.role}</button>
    </div>)}
    <div className="tagging-participant-grid">
      <label><span>Engadir rol</span><select value={selected?.role ?? ''} onChange={(event) => { setRole(event.target.value); setPersonId('') }}>
        <option value="">Escolle rol</option>
        {specs.map((spec) => <option key={spec.role} value={spec.role}>{spec.label}</option>)}
      </select></label>
      <label><span>Participante adicional</span><select value={personId} onChange={(event) => setPersonId(event.target.value)}>
        <option value="">Sen seleccionar</option>
        {candidates.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
      </select></label>
      <button type="button" disabled={!selected || !candidates.some((p) => p.id === personId)} onClick={() => {
        if (selected && candidates.some((p) => p.id === personId)) { onChange([...items, { role: selected.role, participantId: personId }]); setPersonId('') }
      }}>Engadir participante</button>
    </div>
  </fieldset>
}
