import "server-only";
import OpenAI from "openai";
import { getServerEnv } from "./env";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

let client: OpenAI | null = null;

/**
 * Lazily creates one OpenAI SDK client pointed at OpenRouter.
 * It's lazy so a missing key fails at request time with a clear error,
 * not at import time during `next build`.
 */
export function getOpenRouter(): OpenAI {
  if (client) return client;

  const env = getServerEnv();
  client = new OpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: env.openRouterApiKey,
    // The SDK retries 429/5xx twice by default. Turn that off: OpenRouter's
    // `models` fallback already covers failures, and hidden retries would
    // skew the latency we report and burn free-tier quota (20 req/min).
    maxRetries: 0,
    timeout: 60_000,
    defaultHeaders: {
      // Optional attribution headers per OpenRouter's app-attribution docs
      "HTTP-Referer": env.siteUrl,
      "X-OpenRouter-Title": env.appTitle,
    },
  });
  return client;
}
