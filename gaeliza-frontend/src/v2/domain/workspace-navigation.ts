import type { AnalysisStatus } from './analysis'
export type WorkspaceStep = 'roster' | 'video' | 'tagging'
export function workspaceStep(value: string | null, status?: AnalysisStatus): WorkspaceStep {
  if (value === 'roster' || value === 'video' || value === 'tagging') return value
  return status === 'completed' ? 'tagging' : 'roster'
}
