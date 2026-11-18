/**
 * The single place to change which models Shelf Advisor uses.
 *
 * Model slugs come from https://openrouter.ai/models (filter by "free").
 * `:free` variants churn often. If a request fails with "model not found",
 * check the catalog and swap the slug here.
 *
 * Billing note (from OpenRouter's fallback docs): a request is billed at the
 * model that actually answered. If a paid model is anywhere in a fallback
 * list, a fallback to it costs real money. Keep every entry `:free` in dev.
 */

export type ModelOption = {
  /** OpenRouter model slug, e.g. "google/gemma-4-31b-it:free" */
  id: string;
  /** Short label for the UI */
  label: string;
};

/** Models the user can pick from (single mode and compare mode). */
export const MODELS: ModelOption[] = [
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra" },
  { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B" },
  { id: "nvidia/nemotron-3.5-lightning:free", label: "Nemotron 3.5 Lightning" },
];

/**
 * Fallbacks tried, in order, after the chosen model. OpenRouter handles this
 * server-side through the `models` array (on errors like rate limits,
 * downtime, or moderation), so it's one HTTP request from our side.
 */
export const FALLBACK_MODELS: ModelOption[] = [
  { id: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B" },
  { id: "nvidia/nemotron-3.5-lightning:free", label: "Nemotron 3.5 Lightning" },
];

export const DEFAULT_MODEL = MODELS[0].id;

/** Compare mode runs at most this many models side by side. */
export const MAX_COMPARE_MODELS = 3;

/** Generation settings shared by every request, for a fair comparison. */
export const GENERATION = {
  temperature: 0.7,
  /**
   * Covers reasoning AND the visible answer: on most providers, thinking
   * tokens count against this limit. 800 was too low for reasoning models.
   */
  maxTokens: 4000,
  /**
   * OpenRouter's unified `reasoning` control. "low" keeps reasoning models
   * from spending the whole budget thinking. Non-reasoning models ignore it.
   * Options: "none" | "minimal" | "low" | "medium" | "high"
   */
  reasoningEffort: "low",
} as const;

/**
 * Fallbacks for one request, excluding the primary. With the OpenAI SDK,
 * OpenRouter tries `model` first, then the `models` array in order.
 */
export function fallbacksFor(primary: string): string[] {
  return FALLBACK_MODELS.map((m) => m.id).filter((id) => id !== primary);
}

export const ALLOWED_MODEL_IDS = new Set(MODELS.map((m) => m.id));
