type Props = {
  captureDisabled: boolean
  recoveryMethod: string
  setRecoveryMethod: (value: string) => void
}

export function RecoveryFields({ captureDisabled, recoveryMethod, setRecoveryMethod }: Props) {
  return (
            <div className="tagging-detail-grid tagging-detail-grid-single">
              <label>
                <span>Tipo de recuperación</span>
                <select
                  value={recoveryMethod}
                  disabled={captureDisabled}
                  onChange={(event) => setRecoveryMethod(event.target.value)}
                >
                  <option value="">Descoñecido</option>
                  <option value="interception">Intercepción</option>
                  <option value="tackle">Tackle</option>
                  <option value="loose_ball">Balón solto</option>
                  <option value="rebound">Rexeite</option>
                  <option value="kickout">Saque de porta</option>
                  <option value="other">Outro</option>
                </select>
              </label>
            </div>
  )
}
