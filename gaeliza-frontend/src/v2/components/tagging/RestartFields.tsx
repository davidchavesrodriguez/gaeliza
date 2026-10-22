import { restartTypes, type DraftOf } from '../../domain/event-capture'
import { ChoiceField } from './ChoiceField'

type Props = { draft: DraftOf<'restart'>; disabled: boolean; onChange: (draft: DraftOf<'restart'>) => void }
export function RestartFields({ draft, disabled, onChange }: Props) {
  return <div className="tagging-detail-grid">
    <ChoiceField label="Tipo de reinicio" value={draft.detail.restart_type} options={restartTypes}
      labels={{"free": "Libre", "sideline": "Banda", "throw_in": "Salto", "forty_five": "45", "penalty": "Penalti", "other": "Outro"}}
      optional={true} disabled={disabled} onChange={(value) => { onChange({ ...draft, detail: { ...draft.detail, restart_type: value } }) }} />
  </div>
}
