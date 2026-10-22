import type { AnalysisListItem } from '../domain/dashboard'
import type { AnalysisStatus } from '../domain/analysis'
import { supabase } from '../lib/supabase'

type RawItem = {
  id: string; title: string | null; status: AnalysisStatus; updated_at: string
  match: { scheduled_at: string | null; home: { name: string } | null; away: { name: string } | null } | null
  event_count: { count: number }[]; videos: { count: number }[]; activity: { updated_at: string }[]
}
export const analysisPageSize = 50
export async function listOwnedAnalyses(ownerId: string, offset: number, signal: AbortSignal): Promise<AnalysisListItem[]> {
  // Embedded counts and one latest event timestamp; no per-analysis HTTP reads
  // or full event histories. The owner filter is explicit as public rows exist.
  const { data, error } = await supabase.from('analyses').select(`
    id, title, status, updated_at,
    match:matches!analyses_match_id_fkey(scheduled_at,
      home:teams!matches_home_team_id_fkey(name), away:teams!matches_away_team_id_fkey(name)),
    event_count:events(count), videos:analysis_videos(count), activity:events(updated_at)
  `).eq('owner_user_id', ownerId).order('updated_at', { ascending: false }).order('id')
    .order('updated_at', { referencedTable: 'activity', ascending: false }).limit(1, { referencedTable: 'activity' })
    .range(offset, offset + analysisPageSize - 1).abortSignal(signal)
  if (error) throw new Error(`Non puidemos cargar os teus análises: ${error.message}`)
  // Assertion restricted to the ungenerated PostgREST transport boundary.
  const rows = data as unknown as RawItem[]
  return rows.map((row) => {
    const activity = row.activity[0]?.updated_at
    const updatedAt = activity && Date.parse(activity) > Date.parse(row.updated_at) ? activity : row.updated_at
    return { id: row.id, title: row.title, status: row.status, updatedAt,
      scheduledAt: row.match?.scheduled_at ?? null, homeTeam: row.match?.home?.name ?? 'Equipo local non dispoñible',
      awayTeam: row.match?.away?.name ?? 'Equipo visitante non dispoñible',
      eventCount: row.event_count[0]?.count ?? 0, videoCount: row.videos[0]?.count ?? 0 }
  })
}
