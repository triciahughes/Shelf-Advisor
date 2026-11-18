import type { RunResult, Usage } from "@/lib/types";
import { errorTitle, formatMs, formatTokens, formatUsd, modelLabel } from "@/lib/format";

export function ResultCard({ result }: { result: RunResult }) {
  // Label the card with whoever actually answered, when we know.
  const shownModel = result.respondedModel ?? result.requestedModel;

  return (
    <article className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{modelLabel(shownModel)}</h3>
        {result.ok && result.usedFallback && (
          <span
            className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
            title={`You picked ${result.requestedModel}; OpenRouter fell back to ${result.respondedModel}.`}
          >
            Fallback · requested {modelLabel(result.requestedModel)}
          </span>
        )}
      </header>

      {result.ok ? (
        <ol className="space-y-3">
          {result.recommendations.map((rec, i) => (
            <li key={`${rec.title}-${i}`} className="text-sm">
              <p>
                <span className="font-medium">{rec.title}</span>{" "}
                <span className="text-neutral-500">by {rec.author}</span>
              </p>
              <p className="mt-0.5 text-neutral-600 dark:text-neutral-400">{rec.why}</p>
            </li>
          ))}
        </ol>
      ) : (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-medium">{errorTitle(result.error.kind)}</p>
          <p className="mt-0.5">{result.error.message}</p>
        </div>
      )}

      <UsageLine latencyMs={result.latencyMs} usage={result.usage} />
    </article>
  );
}

/** Compact per-request stats. The full usage table comes in a later step. */
function UsageLine({ latencyMs, usage }: { latencyMs: number; usage?: Usage }) {
  return (
    <footer className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-neutral-200 pt-3 font-mono text-xs text-neutral-500 dark:border-neutral-800">
      {usage && (
        <>
          <span>in {formatTokens(usage.promptTokens)}</span>
          <span>
            out {formatTokens(usage.completionTokens)}
            {usage.reasoningTokens > 0 && ` (${formatTokens(usage.reasoningTokens)} reasoning)`}
          </span>
          <span>{formatUsd(usage.costUsd)}</span>
        </>
      )}
      <span>{formatMs(latencyMs)}</span>
    </footer>
  );
}
