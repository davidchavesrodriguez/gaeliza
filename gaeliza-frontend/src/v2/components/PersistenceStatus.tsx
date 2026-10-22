export type SaveState = 'idle' | 'pending' | 'saved' | 'error'
const messages: Record<SaveState, string> = {
  idle: 'As accións gárdanse ao confirmalas', pending: 'Gardando…', saved: 'Gardado', error: 'Erro ao gardar',
}
export function PersistenceStatus({ state }: { state: SaveState }) {
  return <span className={`persistence-status persistence-${state}`} role="status" aria-live="polite" aria-atomic="true">
    {messages[state]}
  </span>
}
