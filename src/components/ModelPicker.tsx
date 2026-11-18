"use client";

import { MODELS } from "@/config/models";

export type Mode = "single" | "compare";

type Props = {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  singleModel: string;
  onSingleModelChange: (id: string) => void;
  compareModels: string[];
  onCompareModelsChange: (ids: string[]) => void;
  maxCompare: number;
  disabled?: boolean;
};

export function ModelPicker({
  mode,
  onModeChange,
  singleModel,
  onSingleModelChange,
  compareModels,
  onCompareModelsChange,
  maxCompare,
  disabled,
}: Props) {
  function toggle(id: string) {
    onCompareModelsChange(
      compareModels.includes(id)
        ? compareModels.filter((m) => m !== id)
        // Keep config order so columns don't shuffle based on click order.
        : MODELS.map((m) => m.id).filter((m) => m === id || compareModels.includes(m)),
    );
  }

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <div className="flex items-center justify-between">
        <legend className="text-sm font-medium">Model</legend>
        <div role="radiogroup" aria-label="Mode" className="flex rounded-md border border-neutral-300 p-0.5 text-xs dark:border-neutral-700">
          {(["single", "compare"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => onModeChange(m)}
              className={`rounded px-2.5 py-1 capitalize transition ${
                mode === m
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === "single" ? (
        <select
          aria-label="Model"
          value={singleModel}
          onChange={(e) => onSingleModelChange(e.target.value)}
          className="block w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs text-neutral-500">Pick 2–{maxCompare}. Same prompt, same settings.</p>
          {MODELS.map((m) => {
            const checked = compareModels.includes(m.id);
            const atMax = !checked && compareModels.length >= maxCompare;
            return (
              <label key={m.id} className={`flex items-center gap-2 text-sm ${atMax ? "opacity-40" : ""}`}>
                <input type="checkbox" checked={checked} disabled={atMax} onChange={() => toggle(m.id)} />
                {m.label}
                <span className="font-mono text-xs text-neutral-400">{m.id}</span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
