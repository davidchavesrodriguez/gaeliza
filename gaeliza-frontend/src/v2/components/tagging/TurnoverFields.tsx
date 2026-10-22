import { turnoverCauses, type DraftOf } from '../../domain/event-capture'
import { ChoiceField } from './ChoiceField'

type Props = { draft: DraftOf<'turnover'>; disabled: boolean; onChange: (draft: DraftOf<'turnover'>) => void }
export function TurnoverFields({ draft, disabled, onChange }: Props) {
  return <div className="tagging-detail-grid">
    <ChoiceField label="Causa da perda" value={draft.detail.cause} options={turnoverCauses}
      labels={{"bad_pass": "Mal pase", "bad_control": "Mal control", "steps": "Steps", "out_of_play": "Fóra", "offensive_foul": "Falta en ataque", "dispossessed": "Desposuído", "other": "Outra"}}
      optional={true} disabled={disabled} onChange={(value) => { onChange({ ...draft, detail: { ...draft.detail, cause: value } }) }} />
  </div>
}
