import type { AnalysisStatus } from './analysis'
export type AnalysisListItem = {
  id: string; title: string | null; status: AnalysisStatus; updatedAt: string
  scheduledAt: string | null; homeTeam: string; awayTeam: string
  eventCount: number; videoCount: number
}
export function groupAnalyses(items: AnalysisListItem[]) {
  return { ongoing: items.filter((item) => item.status !== 'completed'), completed: items.filter((item) => item.status === 'completed') }
}
export function analysisResumePath(item: Pick<AnalysisListItem, 'id' | 'status'>) {
  const step = item.status === 'draft' ? 'roster' : 'tagging'
  return `/app/analyses/${encodeURIComponent(item.id)}?step=${step}`
}
export function formatUpdatedAt(value: string, now = Date.now()): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return 'Actualización descoñecida'
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000))
  if (minutes === 0) return 'Hai un intre'
  if (minutes < 60) return `Hai ${minutes} min`
  if (minutes < 1440) return `Hai ${Math.floor(minutes / 60)} h`
  const days = Math.floor(minutes / 1440)
  return `Hai ${days} ${days === 1 ? 'día' : 'días'}`
}
