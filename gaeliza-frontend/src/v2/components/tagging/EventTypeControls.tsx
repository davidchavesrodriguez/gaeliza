import { useId } from 'react'
import { quickEventLabels, type QuickEventType } from '../../domain/tagging'
const eventTypeGroups = [
  { label: 'Principais', types: ['shot', 'pass', 'recovery', 'turnover'] },
  { label: 'Xogo', types: ['duel', 'dribble', 'block'] },
  { label: 'Reinicios', types: ['kickout', 'restart'] },
  { label: 'Disciplina', types: ['foul', 'card'] },
  { label: 'Cambios', types: ['substitution', 'goalkeeper_change'] },
] as const
export function EventTypeControls({ active, disabled, onSelect }: { active: QuickEventType; disabled: boolean; onSelect: (type: QuickEventType) => void }) {
  const selectId = useId()
  return <>
    <div className="event-type-mobile"><label htmlFor={selectId}>Acción</label>
      <select id={selectId} value={active} disabled={disabled} onChange={(event) => onSelect(event.target.value as QuickEventType)}>
        {eventTypeGroups.map((group) => <optgroup key={group.label} label={group.label}>
          {group.types.map((type) => <option key={type} value={type}>{quickEventLabels[type]}</option>)}
        </optgroup>)}
      </select>
    </div>
    <div className="event-type-controls" role="group" aria-label="Tipo de evento">
    {eventTypeGroups.map((group) => <fieldset className="event-type-group" key={group.label}>
      <legend>{group.label}</legend><div className="event-type-buttons">
        {group.types.map((type) => <button className={`event-type-button${type === active ? ' event-type-button-active' : ''}`}
          type="button" key={type} disabled={disabled} aria-pressed={type === active} onClick={() => onSelect(type)}>{quickEventLabels[type]}</button>)}
      </div>
    </fieldset>)}
  </div></>
}
