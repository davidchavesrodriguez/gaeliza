// A typed select, shared by the small event-specific field components.
type Props<T extends string> = {
  label: string
  value: T | null
  options: readonly T[]
  labels?: Readonly<Record<string, string>>
  optional?: boolean
  disabled: boolean
  onChange: (value: T | null) => void
}
export function ChoiceField<T extends string>({ label, value, options, labels = {}, optional = true, disabled, onChange }: Props<T>) {
  return <label>
    <span>{label}</span>
    <select value={value ?? ''} disabled={disabled} onChange={(event) => {
      const selected = options.find((option) => option === event.target.value)
      if (selected !== undefined) onChange(selected)
      else if (optional && event.target.value === '') onChange(null)
    }}>
      {optional ? <option value="">Descoñecido</option> : null}
      {options.map((option) => <option key={option} value={option}>{labels[option] ?? option}</option>)}
    </select>
  </label>
}
