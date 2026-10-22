import type { AnalysisEventSummary } from './tagging'

// Keep chronological order and linked facts together, even at the recent cutoff.
export function timelineGroups(events: AnalysisEventSummary[], expanded: boolean, limit = 8) {
  const fouls = new Set(events.filter((e) => e.eventType === 'foul').map((e) => e.id))
  const parentId = (e: AnalysisEventSummary) => e.eventType === 'card' && e.relatedFoulEventId && fouls.has(e.relatedFoulEventId)
    ? e.relatedFoulEventId : e.id
  const visible = new Set((expanded ? events : events.slice(-limit)).map(parentId))
  const children = new Map<string, AnalysisEventSummary[]>()
  for (const e of events) {
    const parent = parentId(e)
    if (parent !== e.id) children.set(parent, [...(children.get(parent) ?? []), e])
  }
  const groups = events.filter((e) => parentId(e) === e.id && visible.has(e.id))
    .map((event) => ({ event, cards: children.get(event.id) ?? [] }))
  const shown = groups.reduce((sum, group) => sum + 1 + group.cards.length, 0)
  return { groups, hidden: events.length - shown }
}
