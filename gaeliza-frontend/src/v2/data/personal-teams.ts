import { supabase } from '../lib/supabase'
import type { PersonalTeamInput, TeamOption } from '../domain/personal-setup'

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Non puidemos comprobar a sesión. Reintenta.')
  return data.user.id
}
type TeamRow = { id: string; name: string; short_name: string | null; scope: 'official' | 'personal'; owner_user_id: string | null }
const columns = 'id, name, short_name, scope, owner_user_id'
const mapTeam = (row: TeamRow): TeamOption => ({ id: row.id, name: row.name, shortName: row.short_name, scope: row.scope, ownerUserId: row.owner_user_id })
export async function listTeamOptions(search: string, page: number, signal: AbortSignal) {
  const userId = await currentUserId()
  let query = supabase.from('teams').select(columns).eq('active', true)
    .or(`scope.eq.official,owner_user_id.eq.${userId}`)
    .order('name').order('id').range(page * 30, page * 30 + 30)
  if (search.trim()) query = query.ilike('name', `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`)
  const { data, error } = await query.abortSignal(signal)
  if (error) throw new Error(`Non puidemos cargar os equipos: ${error.message}`)
  return { teams: (data as TeamRow[]).slice(0, 30).map(mapTeam), hasMore: data.length > 30 }
}
export async function createPersonalTeam(input: PersonalTeamInput): Promise<TeamOption> {
  const owner = await currentUserId()
  // Ownership/scope are never supplied by the form; RLS verifies the caller.
  const { data, error } = await supabase.from('teams').insert({
    name: input.name.trim(), short_name: input.shortName.trim() || null, gender: input.gender,
    scope: 'personal', owner_user_id: owner, club_id: null, default_venue_id: null, active: true,
  }).select(columns).single()
  if (error) throw new Error(`Non puidemos crear o equipo: ${error.message}`)
  return mapTeam(data as TeamRow)
}
