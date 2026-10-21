import { passResults, techniques, type DraftOf } from '../../domain/event-capture'
import { ChoiceField } from './ChoiceField'

type Props = { draft: DraftOf<'pass'>; disabled: boolean; onChange: (draft: DraftOf<'pass'>) => void }
export function PassFields({ draft, disabled, onChange }: Props) {
  return <div className="tagging-detail-grid">
    <ChoiceField label="Resultado do pase" value={draft.detail.result} options={passResults}
      labels={{"completed": "Completado", "incomplete": "Incompleto", "intercepted": "Interceptado"}}
      optional={true} disabled={disabled} onChange={(value) => { onChange({ ...draft, detail: { ...draft.detail, result: value } }) }} />
    <ChoiceField label="Técnica do pase" value={draft.detail.technique} options={techniques}
      labels={{"hand": "Man", "foot": "Pé"}}
      optional={true} disabled={disabled} onChange={(value) => { onChange({ ...draft, detail: { ...draft.detail, technique: value } }) }} />
  </div>
}
