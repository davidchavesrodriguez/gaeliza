import type { AnalysisParticipant } from '../../domain/analysis'
import { eligibleParticipants, participantRoles, type CaptureDraft, type SelectedRoles, type ParticipantRole } from '../../domain/event-capture'

type Props = {
  capture: CaptureDraft; teamId: string; roles: SelectedRoles; participants: AnalysisParticipant[]
  disabled: boolean; onChange: (role: ParticipantRole, id: string) => void
}
export function EventParticipantFields({ capture, teamId, roles, participants, disabled, onChange }: Props) {
  return <div className="tagging-participant-grid">
    {participantRoles(capture).map((spec) => <label key={spec.role}>
      <span>{spec.label}</span>
      <select value={roles[spec.role] ?? ''} disabled={disabled} onChange={(event) => onChange(spec.role, event.target.value)}>
        <option value="">Sen identificar</option>
        {eligibleParticipants(spec, teamId, participants).filter((participant) => {
          if (spec.role === 'assister') return participant.id !== roles.shooter
          if (spec.role === 'player_in') return participant.id !== roles.player_out
          if (spec.role === 'player_out') return participant.id !== roles.player_in
          if (spec.role === 'goalkeeper_in') return participant.id !== roles.goalkeeper_out
          if (spec.role === 'goalkeeper_out') return participant.id !== roles.goalkeeper_in
          return true
        }).map((participant) => <option key={participant.id} value={participant.id}>
          {participant.number !== null ? `#${participant.number} · ` : ''}{participant.displayName}
        </option>)}
      </select>
    </label>)}
  </div>
}
