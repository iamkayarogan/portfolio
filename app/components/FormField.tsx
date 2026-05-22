"use client";

export function Field({
  label,
  value,
  onChange,
  type = "text",
  className = "",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const isNumeric = type === "number";
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isNumeric) {
      const cleaned = e.target.value.replace(/[^\d.-]/g, "");
      if (
        cleaned === "" ||
        cleaned === "-" ||
        cleaned === "." ||
        /^-?\d*\.?\d*$/.test(cleaned)
      ) {
        onChange(cleaned);
      }
      return;
    }
    onChange(e.target.value);
  };
  return (
    <label className={`flex flex-col text-xs gap-1 ${className}`}>
      <span className="text-neutral-400">{label}</span>
      <input
        type={isNumeric ? "text" : type}
        inputMode={isNumeric ? "decimal" : undefined}
        autoComplete="off"
        value={value}
        onChange={handleChange}
        required={required}
        placeholder={placeholder}
        className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-sm"
      />
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  className = "",
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <label className={`flex flex-col text-xs gap-1 ${className}`}>
      <span className="text-neutral-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ErrorMessage({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-sm text-rose-400">{error}</p>;
}

export function SubmitButton({
  busy,
  label,
}: {
  busy: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-medium px-4 py-1.5 text-sm"
    >
      {busy ? "Saving…" : label}
    </button>
  );
}

export function PieCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <h3 className="text-sm font-medium text-neutral-300 mb-3">{title}</h3>
      {children}
    </div>
  );
}
