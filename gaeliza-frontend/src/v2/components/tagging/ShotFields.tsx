type Props = {
  captureDisabled: boolean
  shotResult: string
  shotTechnique: string
  shotSituation: string
  setShotResult: (value: string) => void
  setShotTechnique: (value: string) => void
  setShotSituation: (value: string) => void
  setSecondaryParticipantId: (value: string) => void
}

export function ShotFields({ captureDisabled, shotResult, shotTechnique, shotSituation, setShotResult, setShotTechnique, setShotSituation, setSecondaryParticipantId }: Props) {
  return (
            <div className="tagging-detail-grid">
              <label>
                <span>Resultado *</span>
                <select
                  value={shotResult}
                  disabled={captureDisabled}
                  onChange={(event) => {
                    setShotResult(event.target.value)
                    setSecondaryParticipantId('')
                  }}
                >
                  <option value="goal">Gol</option>
                  <option value="point">Punto</option>
                  <option value="wide">Fóra</option>
                  <option value="saved">Parado</option>
                  <option value="blocked">Bloqueado</option>
                  <option value="post">Pao</option>
                </select>
              </label>
              <label>
                <span>Técnica</span>
                <select
                  value={shotTechnique}
                  disabled={captureDisabled}
                  onChange={(event) => setShotTechnique(event.target.value)}
                >
                  <option value="">Descoñecida</option>
                  <option value="foot">Pé</option>
                  <option value="hand">Man</option>
                </select>
              </label>
              <label>
                <span>Situación</span>
                <select
                  value={shotSituation}
                  disabled={captureDisabled}
                  onChange={(event) => setShotSituation(event.target.value)}
                >
                  <option value="">Descoñecida</option>
                  <option value="open_play">Xogo aberto</option>
                  <option value="free">Libre</option>
                  <option value="forty_five">45</option>
                  <option value="penalty">Penalti</option>
                </select>
              </label>
            </div>
  )
}
