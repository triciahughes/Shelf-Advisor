import { z } from "zod";
import { ALLOWED_MODEL_IDS, MAX_COMPARE_MODELS } from "@/config/models";
import { runModel } from "@/lib/recommend";
import type { RecommendResponse } from "@/lib/types";

// Free models can be slow. Give Vercel room so long calls aren't cut off.
export const maxDuration = 60;

const bookTitle = z.string().trim().min(1).max(200);

const RequestSchema = z.object({
  loved: z.array(bookTitle).min(3).max(5),
  disliked: z.array(bookTitle).max(5).optional().default([]),
  models: z
    .array(z.string())
    .min(1)
    .max(MAX_COMPARE_MODELS)
    // Only models from our config. Otherwise anyone could spend our key on
    // an expensive model by editing the request.
    .refine((ids) => ids.every((id) => ALLOWED_MODEL_IDS.has(id)), "Unknown model")
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate models"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request.", issues: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }

  const { loved, disliked, models } = parsed.data;

  // Run models in parallel. runModel never throws: each result is success or a
  // typed failure, so one model failing never hides the others in compare mode.
  const results = await Promise.all(models.map((m) => runModel(m, loved, disliked)));

  return Response.json({ results } satisfies RecommendResponse);
}
