// Presentation only. Stored enum values and participant snapshots never change.
export const analysisStatusLabels = { draft: 'Borrador', in_progress: 'En curso', completed: 'Completada' } as const
const terms: Readonly<Record<string, string>> = {
  goalkeeper: 'Porteiro', defender: 'Defensa', midfielder: 'Centrocampista', midfield: 'Centrocampista',
  forward: 'Dianteiro', attacker: 'Atacante', full_back: 'Defensa central', half_back: 'Defensa lateral',
  half_forward: 'Medio dianteiro', full_forward: 'Dianteiro central',
  goal: 'Gol', point: 'Punto', wide: 'Fóra', saved: 'Parado', blocked: 'Bloqueado', post: 'Pau',
  completed: 'Completado', incomplete: 'Incompleto', intercepted: 'Interceptado',
  hand: 'Man', foot: 'Pé', open_play: 'Xogo aberto', free: 'Libre', forty_five: '45 metros', penalty: 'Penalti',
  interception: 'Intercepción', tackle: 'Entrada', loose_ball: 'Balón dividido', rebound: 'Rexeitamento',
  kickout: 'Saque de porta', other: 'Outro', bad_pass: 'Pase defectuoso', bad_control: 'Mal control',
  steps: 'Pasos', out_of_play: 'Balón fóra', offensive_foul: 'Falta en ataque', dispossessed: 'Balón roubado',
  holding: 'Agarre', striking: 'Golpe', obstruction: 'Obstrución', pickup: 'Recollida', push: 'Empurrón', trip: 'Cambadela',
  advantage: 'Vantaxe', none: 'Sen sanción', yellow: 'Amarela', black: 'Negra', red: 'Vermella',
  short: 'Curto', long: 'Longo', retained: 'Retido', contested_won: 'Disputado gañado',
  contested_lost: 'Disputado perdido', directly_lost: 'Perdido directo',
  aerial: 'Aéreo', ground: 'No chan', successful: 'Completado', failed: 'Non completado',
  sideline: 'Banda', throw_in: 'Balón ao aire',
  shooter: 'Tirador', assister: 'Asistencia', blocker: 'Bloqueador', blocked_player: 'Xogador bloqueado',
  recoverer: 'Recuperador', turnover_player: 'Xogador da perda', offender: 'Infractor', fouled: 'Xogador que recibe a falta',
  card_recipient: 'Sancionado', kicker: 'Lanzador', passer: 'Pasador', receiver: 'Receptor',
  intended_receiver: 'Receptor previsto', interceptor: 'Interceptor', duel_winner: 'Gañador do duelo',
  duel_loser: 'Perdedor do duelo', dribbler: 'Regateador', restart_taker: 'Executor do reinicio',
  player_out: 'Xogador que sae', player_in: 'Xogador que entra', goalkeeper_out: 'Porteiro que sae', goalkeeper_in: 'Porteiro que entra',
  target: 'Destinatario', kickout_receiver: 'Receptor do saque', opponent: 'Rival',
  scheduled: 'Programado', played: 'Disputado', postponed: 'Adiado', cancelled: 'Cancelado',
  official: 'Oficial', personal: 'Persoal', live: 'En directo', post_match: 'Desde vídeo',
}
export function domainLabel(value: string | null | undefined): string {
  if (!value) return 'Sen especificar'
  return terms[value.trim().toLowerCase().replaceAll(' ', '_')] ?? 'Sen especificar'
}

// Positions are free text snapshots, unlike typed detail enums. Translate known
// terms while retaining a custom label supplied by the analyst.
export function positionLabel(value: string): string {
  return terms[value.trim().toLowerCase().replaceAll(' ', '_')] ?? value
}

// Chromium builds without a Galician Intl locale silently fall back to English.
// These fixed presentation words keep dates Galician in the client's timezone.
const months = ['xan.', 'feb.', 'mar.', 'abr.', 'maio', 'xuño', 'xullo', 'ago.', 'set.', 'out.', 'nov.', 'dec.']
export function formatProductDate(value: string | null): string {
  if (!value) return 'Data por confirmar'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Data por confirmar'
  const clock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}, ${clock}`
}
