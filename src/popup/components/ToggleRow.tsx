interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ToggleRow({ label, checked, onChange }: ToggleRowProps) {
  return (
    <div className="toggle-row">
      <span className="toggle-row-label">{label}</span>
      <button
        type="button"
        className={`toggle${checked ? ' is-on' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}
