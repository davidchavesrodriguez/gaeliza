import { recoveryMethods, type DraftOf } from '../../domain/event-capture'
import { ChoiceField } from './ChoiceField'

type Props = { draft: DraftOf<'recovery'>; disabled: boolean; onChange: (draft: DraftOf<'recovery'>) => void }
export function RecoveryFields({ draft, disabled, onChange }: Props) {
  return <div className="tagging-detail-grid">
    <ChoiceField label="Tipo de recuperación" value={draft.detail.method} options={recoveryMethods}
      labels={{"interception": "Intercepción", "tackle": "Tackle", "loose_ball": "Balón solto", "rebound": "Rexeite", "kickout": "Saque de porta", "other": "Outro"}}
      optional={true} disabled={disabled} onChange={(value) => { onChange({ ...draft, detail: { ...draft.detail, method: value } }) }} />
  </div>
}
