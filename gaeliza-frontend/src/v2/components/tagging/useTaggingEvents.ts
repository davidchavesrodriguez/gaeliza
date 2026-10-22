import { useEffect, useRef, useState } from 'react'
import { listAnalysisEvents } from '../../data/tagging'
import type { SaveState } from '../PersistenceStatus'
import type { AnalysisEventSummary } from '../../domain/tagging'

export function useTaggingEvents(analysisId: string, onWorkspaceChanged: () => Promise<void>,
  onSaveStateChange?: (state: SaveState) => void, onInteractionLockChange?: (locked: boolean) => void) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  function reportSaveState(state: SaveState) { setSaveState(state); onSaveStateChange?.(state) }
  const [events, setEvents] = useState<AnalysisEventSummary[]>([])
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const mutationPending = useRef(false)
  const lifetime = useRef<AbortController | null>(null)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    let active = true

    setLoadingEvents(true)

    void listAnalysisEvents(analysisId, controller.signal)
      .then((nextEvents) => {
        if (!active) {
          return
        }

        setEvents(nextEvents)
        setError(null)
      })
      .catch((caughtError) => {
        if (!active) {
          return
        }

        setNeedsRefresh(true)
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Non puidemos cargar os eventos.',
        )
      })
      .finally(() => {
        if (active) {
          setLoadingEvents(false)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [analysisId])

  useEffect(() => { onInteractionLockChange?.(busy || loadingEvents || needsRefresh) }, [busy, loadingEvents, needsRefresh, onInteractionLockChange])

  async function refreshData() {
    if (mutationPending.current) return
    mutationPending.current = true
    setBusy(true)
    setError(null)
    const signal = lifetime.current?.signal
    try {
      const [nextEvents] = await Promise.all([
        listAnalysisEvents(analysisId, signal), onWorkspaceChanged(),
      ])
      if (!signal?.aborted) {
        setEvents(nextEvents)
        setNeedsRefresh(false)
      }
    } catch (caughtError) {
      if (!signal?.aborted) {
        setError(caughtError instanceof Error ? caughtError.message : 'Fallou a recarga.')
      }
    } finally {
      mutationPending.current = false
      if (!signal?.aborted) setBusy(false)
    }
  }

  async function runTaggingMutation(action: () => Promise<string>) {
    if (mutationPending.current || loadingEvents) return false
    mutationPending.current = true
    setBusy(true)
    setError(null)
    setNotice(null)
    const signal = lifetime.current?.signal
    let saved = false
    reportSaveState('pending')

    try {
      const message = await action()
      saved = true
      if (!signal?.aborted) reportSaveState('saved')
      if (signal?.aborted) return saved
      setNotice(message)
      setNeedsRefresh(true)
      // Keep capture locked until both the timeline and status are fresh.
      // A failed read must not invite retrying an already committed write.
      const [nextEvents] = await Promise.all([
        listAnalysisEvents(analysisId, signal),
        onWorkspaceChanged(),
      ])
      if (!signal?.aborted) {
        setEvents(nextEvents)
        setNeedsRefresh(false)
      }
    } catch (caughtError) {
      if (signal?.aborted) return saved
      if (!saved) reportSaveState('error')
      const message = caughtError instanceof Error
        ? caughtError.message
        : 'Non puidemos completar a acción.'
      setError(saved
        ? `A acción gardouse, pero fallou a recarga. Non repitas a captura. ${message}`
        : message,
      )
    } finally {
      mutationPending.current = false
      if (!signal?.aborted) setBusy(false)
    }
    return saved
  }

  return { saveState, events, loadingEvents, busy, error, notice, needsRefresh, refreshData, runTaggingMutation }
}
