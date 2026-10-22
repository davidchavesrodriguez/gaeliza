import { useLayoutEffect, useRef } from 'react'
export function CompleteAnalysisDialog({ busy, onCancel, onConfirm, error }: {
  busy: boolean; error?: string | null; onCancel: () => void; onConfirm: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const element = dialog.current
    element?.showModal()
    return () => { element?.close(); if (opener?.isConnected) opener.focus() }
  }, [])
  return <dialog ref={dialog} className="confirmation-dialog" aria-labelledby="complete-title"
    aria-describedby="complete-description" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}>
    <h2 id="complete-title">Finalizar esta análise?</h2>
    <p id="complete-description">A análise quedará en só lectura. Os datos non se eliminan e poderás reabrila para facer correccións. Rexistra os eventos pendentes antes de finalizar.</p>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className="dialog-actions">
      <button className="button button-secondary" type="button" autoFocus disabled={busy} onClick={onCancel}>Seguir analizando</button>
      <button className="button button-primary" type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Finalizando…' : 'Confirmar finalización'}</button>
    </div>
  </dialog>
}
