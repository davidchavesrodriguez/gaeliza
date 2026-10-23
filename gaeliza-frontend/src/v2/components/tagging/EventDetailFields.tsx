import type { CaptureDraft } from '../../domain/event-capture'
import { ShotFields } from './ShotFields'
import { RecoveryFields } from './RecoveryFields'
import { TurnoverFields } from './TurnoverFields'
import { FoulFields } from './FoulFields'
import { CardFields } from './CardFields'
import { KickoutFields } from './KickoutFields'
import { PassFields } from './PassFields'
import { DuelFields } from './DuelFields'
import { DribbleFields } from './DribbleFields'
import { RestartFields } from './RestartFields'

type Props = { draft: CaptureDraft; disabled: boolean; section?: 'primary' | 'enrichment'; onChange: (draft: CaptureDraft) => void }
export function EventDetailFields({ draft, disabled, onChange, section = 'primary' }: Props) {
  if (section === 'enrichment' && !['shot', 'pass', 'foul', 'kickout'].includes(draft.eventType)) return null
  switch (draft.eventType) {
    case 'shot': return <ShotFields section={section} draft={draft} disabled={disabled} onChange={onChange} />
    case 'recovery': return <RecoveryFields draft={draft} disabled={disabled} onChange={onChange} />
    case 'turnover': return <TurnoverFields draft={draft} disabled={disabled} onChange={onChange} />
    case 'foul': return <FoulFields section={section} draft={draft} disabled={disabled} onChange={onChange} />
    case 'card': return <CardFields draft={draft} disabled={disabled} onChange={onChange} />
    case 'kickout': return <KickoutFields section={section} draft={draft} disabled={disabled} onChange={onChange} />
    case 'pass': return <PassFields section={section} draft={draft} disabled={disabled} onChange={onChange} />
    case 'duel': return <DuelFields draft={draft} disabled={disabled} onChange={onChange} />
    case 'dribble': return <DribbleFields draft={draft} disabled={disabled} onChange={onChange} />
    case 'restart': return <RestartFields draft={draft} disabled={disabled} onChange={onChange} />
    case 'substitution': case 'goalkeeper_change':
      return <p className="roster-empty">Selecciona quen sae e quen entra cando os coñezas. Podes gardar información parcial; o estado inicial da convocatoria non cambia.</p>
    case 'block': return null
  }
}
