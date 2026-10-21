export function PossessionControls({ disabled, onRebuild }: { disabled: boolean; onRebuild: () => Promise<void> }) {
  return (
          <div className="possession-inference-box">
            <div>
              <strong>Posesións</strong>
              <small>
                Reconstrúeas de forma determinista desde os eventos. As correccións
                manuais nunca se pisan.
              </small>
            </div>
            <button
              className="button button-secondary"
              type="button"
              disabled={disabled}
              onClick={() => {
                void onRebuild()
              }}
            >
              Inferir posesións
            </button>
          </div>
  )
}
