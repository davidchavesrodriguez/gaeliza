import type { AnalysisWorkspace } from '../../domain/analysis'
import type { CaptureFormState } from '../../domain/event-capture'

type Props = {
  workspace: AnalysisWorkspace; form: CaptureFormState; disabled: boolean
  onChange: (field: 'periodId' | 'clock', value: string) => void
}
export function EventTimeControls({ workspace, form, disabled, onChange }: Props) {
  return <section className="event-time-controls" aria-label="Tempo do evento">
    <strong>Tempo do evento</strong>
    <label><span>Período</span><select value={form.periodId} disabled={disabled}
      onChange={(event) => onChange('periodId', event.target.value)}>
      {workspace.periods.map((period) => <option key={period.id} value={period.id}>{period.name ?? `Período ${period.number}`}</option>)}
    </select></label>
    <label><span>Tempo no período</span><input type="text" inputMode="numeric" value={form.clock}
      placeholder="12:34" disabled={disabled} onChange={(event) => onChange('clock', event.target.value)} /></label>
  </section>
}
