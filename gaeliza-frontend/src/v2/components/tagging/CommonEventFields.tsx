import type { AnalysisWorkspace } from '../../domain/analysis'
import type { CaptureFormState } from '../../domain/event-capture'

type Props = { workspace: AnalysisWorkspace; form: CaptureFormState; disabled: boolean; onChange: (field: 'teamId' | 'periodId' | 'clock', value: string) => void }
export function CommonEventFields({ workspace, form, disabled, onChange }: Props) {
  return <div className="tagging-fields-grid">
    <label><span>Equipo do evento</span>
      <select value={form.teamId} disabled={disabled} onChange={(event) => onChange('teamId', event.target.value)}>
        {[workspace.homeTeam, workspace.awayTeam].map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select>
    </label>
    <label><span>Período</span>
      <select value={form.periodId} disabled={disabled} onChange={(event) => onChange('periodId', event.target.value)}>
        {workspace.periods.map((period) => <option key={period.id} value={period.id}>{period.name ?? `Período ${period.number}`}</option>)}
      </select>
    </label>
    <label><span>Tempo no período</span>
      <input type="text" inputMode="numeric" value={form.clock} placeholder="12:34" disabled={disabled}
        onChange={(event) => onChange('clock', event.target.value)} />
    </label>
  </div>
}
