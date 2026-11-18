"use client";

import { useRef, useState } from "react";
import { DEFAULT_MODEL, MODELS } from "@/config/models";
import { useCooldown, useElapsedSeconds } from "@/hooks/timers";
import type { RecommendRequest, RecommendResponse, RunResult } from "@/lib/types";
import { BookListInput } from "./BookListInput";
import { ResultCard } from "./ResultCard";

const MIN_LOVED = 3;
const MAX_BOOKS = 5;

type Status =
  | { state: "idle" }
  | { state: "loading"; startedAt: number }
  | { state: "done"; results: RunResult[] }
  | { state: "error"; message: string };

export function ShelfAdvisor() {
  const [loved, setLoved] = useState<string[]>(["", "", ""]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  /** Blocks submits after a 429 until OpenRouter says it's OK */
  const cooldown = useCooldown();
  const abortRef = useRef<AbortController | null>(null);

  const cleanLoved = loved.map((b) => b.trim()).filter(Boolean);
  const cleanDisliked = disliked.map((b) => b.trim()).filter(Boolean);

  const cooldownLeft = cooldown.secondsLeft;
  const loading = status.state === "loading";
  const canSubmit = cleanLoved.length >= MIN_LOVED && !loading && cooldownLeft <= 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({ state: "loading", startedAt: Date.now() });

    const body: RecommendRequest = { loved: cleanLoved, disliked: cleanDisliked, models: [model] };

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStatus({ state: "error", message: data?.error ?? `Request failed (${res.status}).` });
        return;
      }
      const data: RecommendResponse = await res.json();
      setStatus({ state: "done", results: data.results });

      // If any model was rate limited, pause the button until OpenRouter says it's OK.
      const waits = data.results.flatMap((r) =>
        !r.ok && r.error.kind === "rate_limited" ? [r.error.retryAfterSec ?? 30] : [],
      );
      if (waits.length > 0) cooldown.start(Math.max(...waits));
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      setStatus({ state: "error", message: "Couldn't reach the server. Check your connection and try again." });
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    setStatus({ state: "idle" });
  }

  return (
    <div className="space-y-10">
      <form onSubmit={handleSubmit} className="space-y-6">
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

        <div className="space-y-2">
          <label htmlFor="model" className="text-sm font-medium">
            Model
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading}
            className="block w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            {loading ? "Finding books…" : cooldownLeft > 0 ? `Try again in ${cooldownLeft}s` : "Get recommendations"}
          </button>
          {loading && (
            <button type="button" onClick={handleCancel} className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
              Cancel
            </button>
          )}
          {!loading && cleanLoved.length < MIN_LOVED && (
            <span className="text-xs text-neutral-500">
              Add {MIN_LOVED - cleanLoved.length} more book{MIN_LOVED - cleanLoved.length === 1 ? "" : "s"} you loved.
            </span>
          )}
        </div>
      </form>

      <section aria-live="polite" aria-busy={loading} className="space-y-4">
        {status.state === "loading" && (
          <LoadingCard startedAt={status.startedAt} />
        )}
        {status.state === "error" && (
          <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
            {status.message}
          </div>
        )}
        {status.state === "done" && status.results.map((r) => <ResultCard key={r.requestedModel} result={r} />)}
      </section>
    </div>
  );
}

/** Free reasoning models can take 15s+, so show elapsed time, not just a spinner. */
function LoadingCard({ startedAt }: { startedAt: number }) {
  const seconds = useElapsedSeconds(startedAt);
  return (
    <div className="animate-pulse rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="mb-4 h-4 w-40 rounded bg-neutral-200 dark:bg-neutral-800" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="mb-3 space-y-1.5">
          <div className="h-3 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-3 w-5/6 rounded bg-neutral-100 dark:bg-neutral-900" />
        </div>
      ))}
      <p className="mt-2 text-xs text-neutral-500">
        Waiting on the model… {seconds}s{seconds >= 10 && " (free reasoning models can take a while)"}
      </p>
    </div>
  );
}
