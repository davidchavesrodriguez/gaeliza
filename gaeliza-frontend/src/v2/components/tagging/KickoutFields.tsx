type Props = {
  captureDisabled: boolean
  kickoutLength: string
  kickoutResult: string
  setKickoutLength: (value: string) => void
  setKickoutResult: (value: string) => void
}

export function KickoutFields({ captureDisabled, kickoutLength, kickoutResult, setKickoutLength, setKickoutResult }: Props) {
  return (
            <div className="tagging-detail-grid">
              <label>
                <span>Lonxitude *</span>
                <select
                  value={kickoutLength}
                  disabled={captureDisabled}
                  onChange={(event) => setKickoutLength(event.target.value)}
                >
                  <option value="short">Curto</option>
                  <option value="long">Longo</option>
                </select>
              </label>
              <label>
                <span>Resultado</span>
                <select
                  value={kickoutResult}
                  disabled={captureDisabled}
                  onChange={(event) => setKickoutResult(event.target.value)}
                >
                  <option value="">Descoñecido</option>
                  <option value="retained">Retido</option>
                  <option value="contested_won">Disputado gañado</option>
                  <option value="contested_lost">Disputado perdido</option>
                  <option value="directly_lost">Perdido directo</option>
                </select>
              </label>
            </div>
  )
}
