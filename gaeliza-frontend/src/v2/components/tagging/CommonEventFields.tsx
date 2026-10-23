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
  </div>
}
