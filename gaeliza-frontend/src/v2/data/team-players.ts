import { supabase } from '../lib/supabase'
import type { TeamPlayerInput } from '../domain/personal-setup'
export type TeamPlayer = { id: string; firstName: string; lastName: string | null; number: number | null; position: string | null }
export async function listTeamPlayers(teamId: string, page: number, signal: AbortSignal) {
  const { data, error } = await supabase.from('team_players')
    .select('default_number, player:players!team_players_player_id_fkey(id, first_name, last_name, primary_position)')
    .eq('team_id', teamId).eq('active', true).order('default_number', { nullsFirst: false }).order('player_id')
    .range(page * 30, page * 30 + 30).abortSignal(signal)
  if (error) throw new Error(`Non puidemos cargar o plantel: ${error.message}`)
  const rows = data as unknown as { default_number: number | null; player: { id: string; first_name: string; last_name: string | null; primary_position: string | null } | null }[]
  return { hasMore: rows.length > 30, players: rows.slice(0, 30).flatMap(({ player: p, default_number }) => p ? [{ id: p.id, firstName: p.first_name, lastName: p.last_name, number: default_number, position: p.primary_position }] : []) }
}
export async function createTeamPlayer(input: TeamPlayerInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_team_player', {
    p_team_id: input.teamId, p_first_name: input.firstName.trim(), p_last_name: input.lastName.trim() || null,
    p_default_number: input.defaultNumber, p_primary_position: input.primaryPosition.trim() || null,
  })
  if (error) throw new Error(`Non puidemos engadir o xogador: ${error.message}`)
  if (typeof data !== 'string') throw new Error('Resposta de xogador non válida.')
  return data
}
