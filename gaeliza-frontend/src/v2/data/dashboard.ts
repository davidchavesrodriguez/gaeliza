import type { AnalysisListItem } from '../domain/dashboard'
import type { AnalysisStatus } from '../domain/analysis'
import { supabase } from '../lib/supabase'

type RawItem = {
  id: string; title: string | null; status: AnalysisStatus; updated_at: string
  match: { scheduled_at: string | null; home: { name: string } | null; away: { name: string } | null } | null
  event_count: { count: number }[]; videos: { count: number }[]
}
export const analysisPageSize = 50
export async function listOwnedAnalyses(ownerId: string, offset: number, signal: AbortSignal): Promise<AnalysisListItem[]> {
  // The database versions the whole workspace through analyses.updated_at.
  // Counts stay embedded; no child timestamp approximation or per-analysis reads.
  const { data, error } = await supabase.from('analyses').select(`
    id, title, status, updated_at,
    match:matches!analyses_match_id_fkey(scheduled_at,
      home:teams!matches_home_team_id_fkey(name), away:teams!matches_away_team_id_fkey(name)),
    event_count:events(count), videos:analysis_videos(count)
  `).eq('owner_user_id', ownerId).order('updated_at', { ascending: false }).order('id')
    .range(offset, offset + analysisPageSize - 1).abortSignal(signal)
  if (error) throw new Error(`Non puidemos cargar as túas análises: ${error.message}`)
  // Assertion restricted to the ungenerated PostgREST transport boundary.
  const rows = data as unknown as RawItem[]
  return rows.map((row) => ({ id: row.id, title: row.title, status: row.status, updatedAt: row.updated_at,
      scheduledAt: row.match?.scheduled_at ?? null, homeTeam: row.match?.home?.name ?? 'Equipo local non dispoñible',
      awayTeam: row.match?.away?.name ?? 'Equipo visitante non dispoñible',
      eventCount: row.event_count[0]?.count ?? 0, videoCount: row.videos[0]?.count ?? 0 }))
}
