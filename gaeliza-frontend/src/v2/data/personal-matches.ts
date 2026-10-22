import { supabase } from '../lib/supabase'
import { validatePersonalMatch, type PersonalMatchInput } from '../domain/personal-setup'
export async function createPersonalMatchAnalysis(input: PersonalMatchInput): Promise<{ matchId: string; analysisId: string }> {
  validatePersonalMatch(input)
  const { data, error } = await supabase.rpc('create_personal_match_analysis', {
    p_home_team_id: input.homeTeamId, p_away_team_id: input.awayTeamId, p_scheduled_at: input.scheduledAt,
    p_round_label: input.roundLabel.trim() || null, p_mode: input.mode,
  })
  if (error) throw new Error(`Non puidemos crear o partido e a análise: ${error.message}`)
  if (!data || typeof data.match_id !== 'string' || typeof data.analysis_id !== 'string') throw new Error('Resposta de análise non válida.')
  return { matchId: data.match_id, analysisId: data.analysis_id }
}
