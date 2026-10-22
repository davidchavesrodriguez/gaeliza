import { duelTypes, type DraftOf } from '../../domain/event-capture'
import { ChoiceField } from './ChoiceField'

type Props = { draft: DraftOf<'duel'>; disabled: boolean; onChange: (draft: DraftOf<'duel'>) => void }
export function DuelFields({ draft, disabled, onChange }: Props) {
  return <div className="tagging-detail-grid">
    <p className="roster-empty">O equipo do evento é o gañador do duelo.</p>
    <ChoiceField label="Tipo de duelo" value={draft.detail.duel_type} options={duelTypes}
      labels={{"aerial": "Aéreo", "ground": "Chan", "other": "Outro"}}
      optional={true} disabled={disabled} onChange={(value) => { onChange({ ...draft, detail: { ...draft.detail, duel_type: value } }) }} />
  </div>
}
