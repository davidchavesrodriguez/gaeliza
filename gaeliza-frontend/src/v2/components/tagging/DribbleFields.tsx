import { dribbleResults, type DraftOf } from '../../domain/event-capture'
import { ChoiceField } from './ChoiceField'

type Props = { draft: DraftOf<'dribble'>; disabled: boolean; onChange: (draft: DraftOf<'dribble'>) => void }
export function DribbleFields({ draft, disabled, onChange }: Props) {
  return <div className="tagging-detail-grid">
    <ChoiceField label="Resultado do regate" value={draft.detail.result} options={dribbleResults}
      labels={{"successful": "Superado", "failed": "Fallido"}}
      optional={true} disabled={disabled} onChange={(value) => { onChange({ ...draft, detail: { ...draft.detail, result: value } }) }} />
  </div>
}
