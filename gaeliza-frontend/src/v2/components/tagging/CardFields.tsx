import { cardTypes, type DraftOf } from '../../domain/event-capture'
import { ChoiceField } from './ChoiceField'

type Props = { draft: DraftOf<'card'>; disabled: boolean; onChange: (draft: DraftOf<'card'>) => void }
export function CardFields({ draft, disabled, onChange }: Props) {
  return <div className="tagging-detail-grid">
    <ChoiceField label="Tarxeta" value={draft.detail.card_type} options={cardTypes}
      labels={{"yellow": "Amarela", "black": "Negra", "red": "Vermella"}}
      optional={true} disabled={disabled} onChange={(value) => { onChange({ ...draft, detail: { ...draft.detail, card_type: value } }) }} />
  </div>
}
