import type { AnalysisMode } from '../domain/matches'
import { supabase } from '../lib/supabase'

type CreateAnalysisInput = {
  matchId: string
  mode: AnalysisMode
  title?: string | null
}

export async function createAnalysis({
  matchId,
  mode,
  title = null,
}: CreateAnalysisInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_analysis', {
    p_match_id: matchId,
    p_mode: mode,
    p_title: title,
  })

  if (error) {
    throw new Error(`Could not create analysis: ${error.message}`)
  }

  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('Supabase did not return an analysis id.')
  }

  return data
}

export async function completeAnalysis(analysisId: string): Promise<void> {
  const { error } = await supabase.from('analyses').update({ status: 'completed' })
    .eq('id', analysisId).select('id').single()
  if (error) throw new Error(`Non puidemos finalizar o análise: ${error.message}`)
}
