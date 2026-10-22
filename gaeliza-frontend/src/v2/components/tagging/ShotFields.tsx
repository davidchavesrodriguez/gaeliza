import { shotResults, techniques, shotSituations, type DraftOf } from '../../domain/event-capture'
import { ChoiceField } from './ChoiceField'

type Props = { draft: DraftOf<'shot'>; disabled: boolean; section: 'primary' | 'enrichment'; onChange: (draft: DraftOf<'shot'>) => void }
export function ShotFields({ draft, disabled, onChange, section }: Props) {
  return <div className="tagging-detail-grid">
    {section === 'primary' ? <>
    <ChoiceField label="Resultado" value={draft.detail.result} options={shotResults}
      optional={true} disabled={disabled} onChange={(value) => { onChange({ ...draft, detail: { ...draft.detail, result: value } }) }} />
    </> : <>
    <ChoiceField label="Técnica" value={draft.detail.technique} options={techniques}
      labels={{"hand": "Man", "foot": "Pé"}}
      optional={true} disabled={disabled} onChange={(value) => { onChange({ ...draft, detail: { ...draft.detail, technique: value } }) }} />
    <ChoiceField label="Situación" value={draft.detail.situation} options={shotSituations} labels={{open_play:"Xogo aberto", free:"Libre", forty_five:"45", penalty:"Penalti"}}
      optional={true} disabled={disabled} onChange={(value) => { onChange({ ...draft, detail: { ...draft.detail, situation: value } }) }} />
    </>}
  </div>
}
