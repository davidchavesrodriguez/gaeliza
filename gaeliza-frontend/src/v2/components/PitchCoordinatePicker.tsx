import type { PointerEvent } from 'react'

type PitchCoordinatePickerProps = {
  x: number | null
  y: number | null
  disabled?: boolean
  onChange: (x: number | null, y: number | null) => void
}

function clampCoordinate(value: number) {
  return Math.min(100, Math.max(0, value))
}

export function PitchCoordinatePicker({
  x,
  y,
  disabled = false,
  onChange,
}: PitchCoordinatePickerProps) {
  function handlePointer(event: PointerEvent<HTMLButtonElement>) {
    if (disabled || event.button !== 0) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const nextX = clampCoordinate(
      ((event.clientX - rect.left) / rect.width) * 100,
    )
    const nextY = clampCoordinate(
      ((event.clientY - rect.top) / rect.height) * 100,
    )

    onChange(
      Math.round(nextX * 100) / 100,
      Math.round(nextY * 100) / 100,
    )
  }

  return (
    <div className="pitch-coordinate-control">
      <button
        className="tagging-pitch"
        type="button"
        disabled={disabled}
        aria-label="Escolle a posición do evento no campo"
        onPointerDown={handlePointer}
      >
        <span className="pitch-halfway-line" aria-hidden="true" />
        <span className="pitch-45 pitch-45-left" aria-hidden="true" />
        <span className="pitch-45 pitch-45-right" aria-hidden="true" />
        <span className="pitch-small-rectangle pitch-small-left" aria-hidden="true" />
        <span className="pitch-small-rectangle pitch-small-right" aria-hidden="true" />
        {x !== null && y !== null ? (
          <span
            className="pitch-marker"
            aria-hidden="true"
            style={{ left: `${x}%`, top: `${y}%` }}
          />
        ) : null}
      </button>

      <div className="coordinate-inputs">
        <label>
          <span>X</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            disabled={disabled}
            value={x ?? ''}
            placeholder="—"
            onChange={(event) => {
              const value = event.target.value
              onChange(value === '' ? null : clampCoordinate(Number(value)), y)
            }}
          />
        </label>
        <label>
          <span>Y</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            disabled={disabled}
            value={y ?? ''}
            placeholder="—"
            onChange={(event) => {
              const value = event.target.value
              onChange(x, value === '' ? null : clampCoordinate(Number(value)))
            }}
          />
        </label>
        <button
          className="coordinate-clear"
          type="button"
          disabled={disabled || (x === null && y === null)}
          onClick={() => {
            onChange(null, null)
          }}
        >
          Limpar
        </button>
      </div>
    </div>
  )
}
