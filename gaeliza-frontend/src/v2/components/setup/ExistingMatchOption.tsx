import { formatMatchDate, formatRound, type MatchOption } from '../../domain/matches'

export function ExistingMatchOption({
  match,
  selected,
  onSelect,
}: {
  match: MatchOption
  selected: boolean
  onSelect: () => void
}) {
  const round = formatRound(match)
  const competitionName =
    match.competition?.shortName ?? match.competition?.name ?? 'Sen competición'

  return (
    <button
      className={selected ? 'match-card match-card-selected' : 'match-card'}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <div className="match-card-meta">
        <span className="badge">
          {match.scope === 'official' ? 'Oficial' : 'Persoal'}
        </span>
        <span>{competitionName}</span>
        {round ? <span>{round}</span> : null}
      </div>

      <div className="match-card-teams">
        <strong>{match.homeTeam.shortName ?? match.homeTeam.name}</strong>
        <span className="match-card-versus">vs</span>
        <strong>{match.awayTeam.shortName ?? match.awayTeam.name}</strong>
      </div>

      <span className="match-card-date">{formatMatchDate(match.scheduledAt)}</span>
    </button>
  )
}

