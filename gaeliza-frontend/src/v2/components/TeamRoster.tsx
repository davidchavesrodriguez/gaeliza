import { type FormEvent } from 'react'
import { getPlayerDisplayName, type AnalysisParticipant, type RosterPlayer } from '../domain/analysis'
import type { TeamSummary } from '../domain/matches'
import { positionLabel } from '../domain/presentation'

type Props = {
  team: TeamSummary
  otherTeam: TeamSummary
  participants: AnalysisParticipant[]
  availablePlayers: RosterPlayer[]
  busy: boolean
  draft: { name: string; number: string }
  onDraftChange: (draft: { name: string; number: string }) => void
  onAddPlayer: (player: RosterPlayer) => void
  onRemoveParticipant: (participant: AnalysisParticipant) => void
  onAddTemporary: (name: string, number: number | null) => Promise<boolean>
}

export function TeamRoster({ team, otherTeam, participants, availablePlayers, busy, draft, onDraftChange, onAddPlayer, onRemoveParticipant, onAddTemporary }: Props) {
  const { name, number } = draft
  async function addTemporary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !name.trim()) return
    const parsed = number.trim() ? Number(number) : null
    if (parsed !== null && (!Number.isInteger(parsed) || parsed <= 0)) return
    if (await onAddTemporary(name, parsed)) { onDraftChange({ name: '', number: '' }) }
  }
  return <section className="roster-team-card" aria-label={`Convocatoria de ${team.name}`}>
    <div className="roster-team-heading">
      <h2 id={`roster-${team.id}`} tabIndex={-1}>{team.name}</h2>
      <span className="roster-count" aria-live="polite">{participants.length} {participants.length === 1 ? 'convocado' : 'convocados'}</span>
    </div>
    <div className="participant-list">
      {participants.length === 0 ? <p className="roster-empty">Aínda non hai xogadores convocados.</p> : participants.map((participant) =>
        <div className="participant-row" key={participant.id}>
          <span className="participant-number">{participant.number !== null ? `#${participant.number}` : '—'}</span>
          <div className="participant-identity"><strong className="roster-player-name">{participant.displayName}</strong>
          <span className="roster-position">{participant.position ? positionLabel(participant.position) : '—'}</span></div>
          <button className="participant-remove" type="button" disabled={busy}
            aria-label={`Quitar ${participant.displayName}`} onClick={() => onRemoveParticipant(participant)}>Quitar</button>
        </div>)}
    </div>
    <form className="team-temporary-form" onSubmit={(event) => { void addTemporary(event) }}>
      <label><span>Nome ou etiqueta</span><input type="text" value={name} required maxLength={200} disabled={busy}
        onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} /></label>
      <label><span>Dorsal <small>(opcional)</small></span><input type="number" min="1" step="1" inputMode="numeric"
        value={number} disabled={busy} onChange={(event) => onDraftChange({ ...draft, number: event.target.value })} /></label>
      <button className="button button-secondary" type="submit" disabled={busy || !name.trim()}>Engadir temporal</button>
      <p className="form-hint">Só nesta análise; non crea un xogador no equipo.</p>
    </form>
    {availablePlayers.length ? <div className="available-roster">
      <h3 className="roster-subheading">Dispoñibles no equipo · {availablePlayers.length}</h3>
      <div className="available-player-list" aria-label={`Dispoñibles de ${team.name}`}>
        {availablePlayers.map((player) => <button className="available-player" type="button" key={player.playerId} disabled={busy}
          onClick={() => onAddPlayer(player)}>
          <span>{player.defaultNumber !== null ? `#${player.defaultNumber} · ` : ''}{getPlayerDisplayName(player)}</span>
          <strong>Engadir</strong>
        </button>)}
      </div>
    </div> : null}
    <nav className="roster-jumps" aria-label={`Saltos desde ${team.name}`}><a href={`#roster-${otherTeam.id}`}>Ir a {otherTeam.name}</a><a href="#roster-continue">Volver a Continuar</a></nav>
  </section>
}
