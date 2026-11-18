"use client";

type Props = {
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  /** Rows below this index can't be removed */
  minRows: number;
  maxRows: number;
  placeholders?: string[];
  disabled?: boolean;
};

/** A short list of text inputs with add/remove, for book titles. */
export function BookListInput({
  label,
  hint,
  values,
  onChange,
  minRows,
  maxRows,
  placeholders = [],
  disabled,
}: Props) {
  const update = (i: number, value: string) =>
    onChange(values.map((v, j) => (j === i ? value : v)));
  const remove = (i: number) => onChange(values.filter((_, j) => j !== i));
  const add = () => onChange([...values, ""]);

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">{label}</legend>
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}

      {values.map((value, i) => (
        // Index keys are fine here: rows have no identity beyond position.
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={value}
            maxLength={200}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholders[i] ?? "Title (author optional)"}
            aria-label={`${label} ${i + 1}`}
            className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-neutral-900 disabled:opacity-60 dark:border-neutral-700 dark:focus:border-neutral-100"
          />
          {i >= minRows && (
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
              className="rounded-md px-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              ×
            </button>
          )}
        </div>
      ))}

      {values.length < maxRows && (
        <button
          type="button"
          onClick={add}
          className="text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          + Add another
        </button>
      )}
    </fieldset>
  );
}
