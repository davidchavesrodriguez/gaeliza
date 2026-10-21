import { kickoutLengths, kickoutResults, type DraftOf } from '../../domain/event-capture'
import { ChoiceField } from './ChoiceField'

type Props = { draft: DraftOf<'kickout'>; disabled: boolean; onChange: (draft: DraftOf<'kickout'>) => void }
export function KickoutFields({ draft, disabled, onChange }: Props) {
  return <div className="tagging-detail-grid">
    <ChoiceField label="Lonxitude *" value={draft.detail.length} options={kickoutLengths}
      labels={{"short": "Curto", "long": "Longo"}}
      optional={false} disabled={disabled} onChange={(value) => { if (value !== null) onChange({ ...draft, detail: { ...draft.detail, length: value } }) }} />
    <ChoiceField label="Resultado" value={draft.detail.result} options={kickoutResults} labels={{retained:"Retido", contested_won:"Disputado gañado", contested_lost:"Disputado perdido", directly_lost:"Perdido directo"}}
      optional={true} disabled={disabled} onChange={(value) => { onChange({ ...draft, detail: { ...draft.detail, result: value } }) }} />
  </div>
}
