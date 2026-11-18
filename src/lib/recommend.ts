import "server-only";
import { APIConnectionTimeoutError, APIError } from "openai";
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { GENERATION, fallbacksFor } from "@/config/models";
import { MissingEnvError } from "./env";
import { getOpenRouter } from "./openrouter";
import { buildMessages, parseRecommendations } from "./prompt";
import type { RunError, RunResult, Usage } from "./types";

/** OpenRouter-only request fields the OpenAI SDK types don't know about. */
type OpenRouterParams = ChatCompletionCreateParamsNonStreaming & {
  models?: string[];
  reasoning?: { effort?: string; exclude?: boolean };
};

/** OpenRouter adds `cost` to usage, and can put an `error` in a 200 body. */
type OpenRouterCompletion = ChatCompletion & {
  usage?: ChatCompletion["usage"] & { cost?: number };
  error?: { code?: number; message?: string };
};

export async function runModel(
  requestedModel: string,
  loved: string[],
  disliked: string[],
): Promise<RunResult> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);

  const params: OpenRouterParams = {
    model: requestedModel,
    models: fallbacksFor(requestedModel),
    messages: buildMessages(loved, disliked),
    temperature: GENERATION.temperature,
    max_tokens: GENERATION.maxTokens,
    // exclude: we don't display reasoning, so don't send it over the wire.
    // It's still generated and billed, and shows up in reasoning_tokens.
    reasoning: { effort: GENERATION.reasoningEffort, exclude: true },
  };

  let completion: OpenRouterCompletion;
  try {
    completion = (await getOpenRouter().chat.completions.create(params)) as OpenRouterCompletion;
  } catch (err) {
    return { ok: false, requestedModel, latencyMs: elapsed(), error: toRunError(err) };
  }
  const latencyMs = elapsed();

  // OpenRouter docs: check the body for an error even on HTTP 200.
  if (completion.error) {
    return {
      ok: false,
      requestedModel,
      latencyMs,
      error: fromStatus(completion.error.code, completion.error.message),
    };
  }

  const respondedModel = completion.model;
  const usage = toUsage(completion.usage);
  const choice = completion.choices?.[0];
  const recommendations = parseRecommendations(choice?.message?.content ?? "");

  if (!recommendations && choice?.finish_reason === "length") {
    return {
      ok: false,
      requestedModel,
      latencyMs,
      respondedModel,
      usage,
      error: {
        kind: "truncated",
        message: `The model hit the ${GENERATION.maxTokens}-token limit before finishing (${usage.reasoningTokens} spent reasoning).`,
      },
    };
  }

  if (!recommendations) {
    return {
      ok: false,
      requestedModel,
      latencyMs,
      respondedModel,
      usage,
      error: {
        kind: "invalid_output",
        message: "The model answered, but not in the expected format. Try again or pick another model.",
      },
    };
  }

  return {
    ok: true,
    requestedModel,
    respondedModel,
    usedFallback: baseSlug(respondedModel) !== baseSlug(requestedModel),
    recommendations,
    usage,
    latencyMs,
  };
}

/** Compare slugs without the ":free" suffix, in case OpenRouter reports it differently. */
function baseSlug(slug: string): string {
  return slug.replace(/:free$/, "");
}

function toUsage(u: OpenRouterCompletion["usage"]): Usage {
  return {
    promptTokens: u?.prompt_tokens ?? 0,
    completionTokens: u?.completion_tokens ?? 0,
    reasoningTokens: u?.completion_tokens_details?.reasoning_tokens ?? 0,
    totalTokens: u?.total_tokens ?? 0,
    costUsd: typeof u?.cost === "number" ? u.cost : null,
  };
}

function toRunError(err: unknown): RunError {
  if (err instanceof MissingEnvError) {
    console.error(err.message);
    return { kind: "auth", message: "Server isn't configured with a valid OpenRouter key." };
  }
  if (err instanceof APIConnectionTimeoutError) {
    return { kind: "timeout", message: "The model took too long to respond." };
  }
  if (err instanceof APIError) {
    const base = fromStatus(err.status, err.message);
    if (base.kind === "rate_limited") {
      base.retryAfterSec = retryAfterSeconds(err.headers);
    }
    return base;
  }
  console.error("Unexpected OpenRouter error", err);
  return { kind: "upstream", message: "Something went wrong reaching OpenRouter." };
}

function fromStatus(status: number | undefined, message?: string): RunError {
  switch (status) {
    case 429:
      return { kind: "rate_limited", message: "Rate limited. Free models allow 20 requests per minute and a daily cap." };
    case 402:
      return { kind: "insufficient_credits", message: "OpenRouter account has insufficient credits." };
    case 400:
      return { kind: "bad_request", message: message ?? "Bad request." };
    case 401:
    case 403:
      // Don't echo upstream auth details to the client.
      return { kind: "auth", message: "Server isn't configured with a valid OpenRouter key." };
    case 408:
      return { kind: "timeout", message: "The model took too long to respond." };
    default:
      return { kind: "upstream", message: "All models in the fallback chain failed. Try again shortly." };
  }
}

/** Prefer Retry-After (seconds). Fall back to X-RateLimit-Reset (a timestamp). */
function retryAfterSeconds(headers: Headers | undefined): number | undefined {
  if (!headers) return undefined;

  const retryAfter = Number(headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.ceil(retryAfter);

  const reset = Number(headers.get("x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) {
    // Handle both epoch seconds and epoch milliseconds.
    const resetMs = reset > 1e12 ? reset : reset * 1000;
    const seconds = Math.ceil((resetMs - Date.now()) / 1000);
    if (seconds > 0) return seconds;
  }
  return undefined;
}
