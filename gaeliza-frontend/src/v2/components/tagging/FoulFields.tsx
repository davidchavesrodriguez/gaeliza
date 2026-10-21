type Props = {
  captureDisabled: boolean
  foulCause: string
  foulOutcome: string
  setFoulCause: (value: string) => void
  setFoulOutcome: (value: string) => void
}

export function FoulFields({ captureDisabled, foulCause, foulOutcome, setFoulCause, setFoulOutcome }: Props) {
  return (
            <div className="tagging-detail-grid">
              <label>
                <span>Causa</span>
                <select
                  value={foulCause}
                  disabled={captureDisabled}
                  onChange={(event) => setFoulCause(event.target.value)}
                >
                  <option value="">Descoñecida</option>
                  <option value="holding">Agarrón</option>
                  <option value="striking">Golpe</option>
                  <option value="obstruction">Obstrución</option>
                  <option value="pickup">Pickup</option>
                  <option value="steps">Steps</option>
                  <option value="push">Empurrón</option>
                  <option value="trip">Zancadilla</option>
                  <option value="other">Outra</option>
                </select>
              </label>
              <label>
                <span>Resultado</span>
                <select
                  value={foulOutcome}
                  disabled={captureDisabled}
                  onChange={(event) => setFoulOutcome(event.target.value)}
                >
                  <option value="">Descoñecido</option>
                  <option value="free">Libre</option>
                  <option value="forty_five">45</option>
                  <option value="penalty">Penalti</option>
                  <option value="advantage">Vantaxe</option>
                  <option value="none">Sen continuación</option>
                </select>
              </label>
            </div>
  )
}
