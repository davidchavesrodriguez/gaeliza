import { quickEventLabels, type QuickEventType } from '../../domain/tagging'
const eventTypeGroups = [
  { label: 'Principais', types: ['shot', 'pass', 'recovery', 'turnover'] },
  { label: 'Xogo', types: ['duel', 'dribble', 'block'] },
  { label: 'Reinicios', types: ['kickout', 'restart'] },
  { label: 'Disciplina', types: ['foul', 'card'] },
  { label: 'Cambios', types: ['substitution', 'goalkeeper_change'] },
] as const
export function EventTypeControls({ active, disabled, onSelect }: { active: QuickEventType; disabled: boolean; onSelect: (type: QuickEventType) => void }) {
  return <div className="event-type-controls" role="group" aria-label="Tipo de evento">
    {eventTypeGroups.map((group) => <fieldset className="event-type-group" key={group.label}>
      <legend>{group.label}</legend><div className="event-type-buttons">
        {group.types.map((type) => <button className={`event-type-button${type === active ? ' event-type-button-active' : ''}`}
          type="button" key={type} disabled={disabled} aria-pressed={type === active} onClick={() => onSelect(type)}>{quickEventLabels[type]}</button>)}
      </div>
    </fieldset>)}
  </div>
}
