import { useState } from 'react'
import type { TeamOption } from '../../domain/personal-setup'
import { TeamPlayerSetup } from './TeamPlayerSetup'

type Props = {
  label: string; selected: TeamOption | null; userId: string | undefined
  busy: boolean; onBusy: (busy: boolean) => void
}

export function SetupTeamRoster({ label, selected, userId, busy, onBusy }: Props) {
  const [open, setOpen] = useState(false)
  if (!selected || selected.scope !== 'personal' || selected.ownerUserId !== userId) return null

  return <section className="setup-team-roster" aria-label={`Plantel de ${label.toLowerCase()}`}>
    <div className="setup-roster-heading">
      <div><h3>{label}</h3><p>{selected.name}</p></div>
      <button className="text-link" type="button" disabled={busy} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Pechar plantel' : 'Xestionar plantel'}</button>
    </div>
    {open ? <TeamPlayerSetup key={selected.id} teamId={selected.id} busy={busy} onBusy={onBusy} /> : null}
  </section>
}
