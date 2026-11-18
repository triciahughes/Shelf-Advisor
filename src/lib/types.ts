/**
 * Shared shapes between the API route and the UI.
 * No server-only imports here, so client components can use these types.
 */

export type Recommendation = {
  title: string;
  author: string;
  why: string;
};

export type Usage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** OpenRouter `usage.cost` (credits, 1 credit = $1). null if not returned. */
  costUsd: number | null;
};

export type ErrorKind =
  | "rate_limited" // 429: free tier is 20 req/min and 50 or 1,000 req/day
  | "insufficient_credits" // 402: includes a negative balance, even on :free
  | "bad_request" // 400: our request was invalid
  | "auth" // 401/403: key missing or invalid (a config problem)
  | "timeout"
  | "upstream" // 5xx or a provider error, after fallbacks were exhausted
  | "invalid_output"; // model answered, but not in the shape we asked for

export type RunError = {
  kind: ErrorKind;
  message: string;
  /** Seconds until it's worth retrying, when OpenRouter tells us */
  retryAfterSec?: number;
};

type RunBase = {
  /** The model the user picked */
  requestedModel: string;
  /** Wall-clock time for the OpenRouter call, measured on our server */
  latencyMs: number;
};

export type RunSuccess = RunBase & {
  ok: true;
  /** OpenRouter's `model` field: the model that actually answered */
  respondedModel: string;
  usedFallback: boolean;
  recommendations: Recommendation[];
  usage: Usage;
};

export type RunFailure = RunBase & {
  ok: false;
  error: RunError;
  /** Present when a model answered but the output was unusable. Tokens were still spent. */
  respondedModel?: string;
  usage?: Usage;
};

export type RunResult = RunSuccess | RunFailure;

export type RecommendRequest = {
  loved: string[];
  disliked?: string[];
  /** 1 model = single mode, 2–3 = compare mode */
  models: string[];
};

export type RecommendResponse = {
  results: RunResult[];
};
