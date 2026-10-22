import { foulCauses, foulOutcomes, type DraftOf } from '../../domain/event-capture'
import { ChoiceField } from './ChoiceField'

type Props = { draft: DraftOf<'foul'>; disabled: boolean; onChange: (draft: DraftOf<'foul'>) => void }
export function FoulFields({ draft, disabled, onChange }: Props) {
  return <div className="tagging-detail-grid">
    <ChoiceField label="Causa" value={draft.detail.cause} options={foulCauses}
      optional={true} disabled={disabled} onChange={(value) => { onChange({ ...draft, detail: { ...draft.detail, cause: value } }) }} />
    <ChoiceField label="Resultado" value={draft.detail.outcome} options={foulOutcomes} labels={{free:"Libre", forty_five:"45", penalty:"Penalti", advantage:"Vantaxe", none:"Sen continuación"}}
      optional={true} disabled={disabled} onChange={(value) => { onChange({ ...draft, detail: { ...draft.detail, outcome: value } }) }} />
  </div>
}
