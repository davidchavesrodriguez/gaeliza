type Props = {
  captureDisabled: boolean
  cardType: string
  setCardType: (value: string) => void
}

export function CardFields({ captureDisabled, cardType, setCardType }: Props) {
  return (
            <div className="tagging-detail-grid tagging-detail-grid-single">
              <label>
                <span>Tarxeta *</span>
                <select
                  value={cardType}
                  disabled={captureDisabled}
                  onChange={(event) => setCardType(event.target.value)}
                >
                  <option value="yellow">Amarela</option>
                  <option value="black">Negra</option>
                  <option value="red">Vermella</option>
                </select>
              </label>
            </div>
  )
}
