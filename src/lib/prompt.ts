import { z } from "zod";
import type { Recommendation } from "./types";

/**
 * We ask for JSON in the prompt instead of using `response_format`, because
 * free models vary in structured-output support. The parser below tolerates
 * the usual mess (code fences, chatter around the JSON) and validates the result.
 */

const SYSTEM_PROMPT = `You are a well-read book recommender.
Given books a reader loved (and optionally disliked), recommend exactly 5 OTHER books.
Rules:
- Never recommend a book the reader listed.
- Prefer variety: no more than 2 books by the same author.
- "why" is one sentence (max 25 words) tying the pick to what they loved.
Respond with ONLY this JSON, no other text:
{"recommendations":[{"title":"...","author":"...","why":"..."}]}`;

export function buildMessages(loved: string[], disliked: string[] = []) {
  const lines = [
    "Books I loved:",
    ...loved.map((b) => `- ${b}`),
  ];
  if (disliked.length > 0) {
    lines.push("", "Books I didn't like:", ...disliked.map((b) => `- ${b}`));
  }
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: lines.join("\n") },
  ];
}

const RecommendationSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  why: z.string().min(1),
});

const OutputSchema = z.object({
  recommendations: z.array(RecommendationSchema).min(1),
});

/** Returns up to 5 recommendations, or null if the output can't be used. */
export function parseRecommendations(raw: string): Recommendation[] | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    const parsed = OutputSchema.safeParse(JSON.parse(raw.slice(start, end + 1)));
    return parsed.success ? parsed.data.recommendations.slice(0, 5) : null;
  } catch {
    return null;
  }
}
