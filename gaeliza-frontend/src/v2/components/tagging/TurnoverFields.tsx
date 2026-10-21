type Props = {
  captureDisabled: boolean
  turnoverCause: string
  setTurnoverCause: (value: string) => void
}

export function TurnoverFields({ captureDisabled, turnoverCause, setTurnoverCause }: Props) {
  return (
            <div className="tagging-detail-grid tagging-detail-grid-single">
              <label>
                <span>Causa da perda</span>
                <select
                  value={turnoverCause}
                  disabled={captureDisabled}
                  onChange={(event) => setTurnoverCause(event.target.value)}
                >
                  <option value="">Descoñecida</option>
                  <option value="bad_pass">Mal pase</option>
                  <option value="bad_control">Mal control</option>
                  <option value="steps">Steps</option>
                  <option value="out_of_play">Fóra</option>
                  <option value="offensive_foul">Falta en ataque</option>
                  <option value="dispossessed">Desposuído</option>
                  <option value="other">Outra</option>
                </select>
              </label>
            </div>
  )
}
