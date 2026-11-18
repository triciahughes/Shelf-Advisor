"use client";

import { useRef, useState } from "react";
import { DEFAULT_MODEL, MAX_COMPARE_MODELS, MODELS } from "@/config/models";
import { useCooldown, useElapsedSeconds } from "@/hooks/timers";
import { modelLabel } from "@/lib/format";
import type { RecommendRequest, RecommendResponse, RunResult } from "@/lib/types";
import { BookListInput } from "./BookListInput";
import { ModelPicker, type Mode } from "./ModelPicker";
import { ResultCard } from "./ResultCard";

const MIN_LOVED = 3;
const MAX_BOOKS = 5;

/** One result slot per model. Each fills in independently as its request finishes. */
type Slot =
  | { model: string; state: "loading"; startedAt: number }
  | { model: string; state: "done"; result: RunResult }
  | { model: string; state: "error"; message: string };

export function ShelfAdvisor() {
  const [loved, setLoved] = useState<string[]>(["", "", ""]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("single");
  const [singleModel, setSingleModel] = useState(DEFAULT_MODEL);
  const [compareModels, setCompareModels] = useState<string[]>(MODELS.slice(0, 2).map((m) => m.id));
  const [slots, setSlots] = useState<Slot[]>([]);
  /** Blocks submits after a 429 until OpenRouter says it's OK */
  const cooldown = useCooldown();
  const abortRef = useRef<AbortController | null>(null);

  const cleanLoved = loved.map((b) => b.trim()).filter(Boolean);
  const cleanDisliked = disliked.map((b) => b.trim()).filter(Boolean);
  const models = mode === "single" ? [singleModel] : compareModels;

  const loading = slots.some((s) => s.state === "loading");
  const cooldownLeft = cooldown.secondsLeft;
  const hasEnoughModels = mode === "single" || compareModels.length >= 2;
  const canSubmit = cleanLoved.length >= MIN_LOVED && hasEnoughModels && !loading && cooldownLeft <= 0;

  function updateSlot(slot: Slot) {
    setSlots((prev) => prev.map((s) => (s.model === slot.model ? slot : s)));
  }

  async function runOne(model: string, signal: AbortSignal) {
    const body: RecommendRequest = { loved: cleanLoved, disliked: cleanDisliked, models: [model] };
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        updateSlot({ model, state: "error", message: data?.error ?? `Request failed (${res.status}).` });
        return;
      }
      const { results }: RecommendResponse = await res.json();
      const result = results[0];
      updateSlot({ model, state: "done", result });

      if (!result.ok && result.error.kind === "rate_limited") {
        cooldown.start(result.error.retryAfterSec ?? 30);
      }
    } catch (err) {
      if (signal.aborted) return;
      console.error(err);
      updateSlot({ model, state: "error", message: "Couldn't reach the server. Check your connection and try again." });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // One request per model, in parallel. A slow reasoning model no longer
    // holds back a fast one, and arrival order is part of the comparison.
    const startedAt = Date.now();
    setSlots(models.map((model) => ({ model, state: "loading", startedAt })));
    models.forEach((model) => void runOne(model, controller.signal));
  }

  function handleCancel() {
    abortRef.current?.abort();
    setSlots([]);
  }

  return (
    <div className="space-y-10">
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <BookListInput
          label="Books you loved"
          hint={`At least ${MIN_LOVED}, up to ${MAX_BOOKS}.`}
          values={loved}
          onChange={setLoved}
          minRows={MIN_LOVED}
          maxRows={MAX_BOOKS}
          placeholders={["Piranesi", "The Night Circus", "Circe"]}
          disabled={loading}
        />
        <BookListInput
          label="Books you didn't like"
          hint="Optional. Helps steer away from the wrong vibe."
          values={disliked}
          onChange={setDisliked}
          minRows={0}
          maxRows={MAX_BOOKS}
          disabled={loading}
        />

        <ModelPicker
          mode={mode}
          onModeChange={setMode}
          singleModel={singleModel}
          onSingleModelChange={setSingleModel}
          compareModels={compareModels}
          onCompareModelsChange={setCompareModels}
          maxCompare={MAX_COMPARE_MODELS}
          disabled={loading}
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            {loading
              ? "Finding books…"
              : cooldownLeft > 0
                ? `Try again in ${cooldownLeft}s`
                : mode === "compare"
                  ? `Compare ${compareModels.length} models`
                  : "Get recommendations"}
          </button>
          {loading && (
            <button type="button" onClick={handleCancel} className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
              Cancel
            </button>
          )}
          {!loading && <SubmitHint lovedCount={cleanLoved.length} mode={mode} compareCount={compareModels.length} />}
        </div>
      </form>

      {slots.length > 0 && (
        <section
          aria-live="polite"
          aria-busy={loading}
          className={
            slots.length === 1
              ? "max-w-2xl"
              : `grid items-start gap-4 md:grid-cols-2 ${slots.length === 3 ? "lg:grid-cols-3" : ""}`
          }
        >
          {slots.map((slot) => (
            <SlotView key={slot.model} slot={slot} />
          ))}
        </section>
      )}
    </div>
  );
}

function SlotView({ slot }: { slot: Slot }) {
  if (slot.state === "loading") return <LoadingCard model={slot.model} startedAt={slot.startedAt} />;
  if (slot.state === "done") return <ResultCard result={slot.result} />;
  return (
    <div role="alert" className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <h3 className="mb-3 font-medium">{modelLabel(slot.model)}</h3>
      <p className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">{slot.message}</p>
    </div>
  );
}

function SubmitHint({ lovedCount, mode, compareCount }: { lovedCount: number; mode: Mode; compareCount: number }) {
  const missing = MIN_LOVED - lovedCount;
  let text: string | null = null;
  if (missing > 0) text = `Add ${missing} more book${missing === 1 ? "" : "s"} you loved.`;
  else if (mode === "compare" && compareCount < 2) text = "Pick at least 2 models to compare.";
  else if (mode === "compare") text = `Uses ${compareCount} requests (free tier: 20/min).`;
  return text ? <span className="text-xs text-neutral-500">{text}</span> : null;
}

/** Free reasoning models can take 15s+, so show elapsed time, not just a spinner. */
function LoadingCard({ model, startedAt }: { model: string; startedAt: number }) {
  const seconds = useElapsedSeconds(startedAt);
  return (
    <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <h3 className="mb-4 font-medium">{modelLabel(model)}</h3>
      <div className="animate-pulse">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="mb-3 space-y-1.5">
            <div className="h-3 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-3 w-5/6 rounded bg-neutral-100 dark:bg-neutral-900" />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Waiting on the model… {seconds}s{seconds >= 10 && " (free reasoning models can take a while)"}
      </p>
    </div>
  );
}
