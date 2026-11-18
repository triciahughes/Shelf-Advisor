"use client";

import { errorTitle, formatMs, formatTokens, formatUsd, modelLabel } from "@/lib/format";
import { summarize, summarizeByModel, servedModel, type UsageRecord } from "@/lib/usage";

type Props = {
  records: UsageRecord[];
  onClear: () => void;
};

/**
 * Session usage: headline totals, a per-model breakdown, and a per-request log.
 * Tables, not charts: a session is a handful of rows and exact numbers matter.
 */
export function UsagePanel({ records, onClear }: Props) {
  const totals = summarize(records);
  const byModel = summarizeByModel(records);
  const newestFirst = [...records].reverse();

  return (
    <section aria-labelledby="usage-heading" className="space-y-6 border-t border-neutral-200 pt-10 dark:border-neutral-800">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 id="usage-heading" className="text-lg font-semibold">
            Session usage
          </h2>
          <p className="text-xs text-neutral-500">Every OpenRouter call since this page loaded. Clears on refresh.</p>
        </div>
        <button type="button" onClick={onClear} className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
          Clear
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Requests"
          value={formatTokens(totals.requests)}
          detail={`${totals.succeeded} ok · ${totals.failed} failed${totals.fallbacks ? ` · ${totals.fallbacks} fallback` : ""}`}
        />
        <StatTile label="Tokens in" value={formatTokens(totals.promptTokens)} />
        <StatTile
          label="Tokens out"
          value={formatTokens(totals.completionTokens)}
          detail={totals.reasoningTokens > 0 ? `${formatTokens(totals.reasoningTokens)} reasoning` : undefined}
        />
        <StatTile
          label="Cost"
          value={formatUsd(totals.costUsd)}
          detail={totals.costIncomplete ? "Some calls reported no cost" : undefined}
        />
        <StatTile
          label="Avg latency"
          value={totals.avgLatencyMs === null ? "n/a" : formatMs(totals.avgLatencyMs)}
          detail="Successful calls only"
        />
      </dl>

      <Table
        caption="By model (the model that answered, which is the one billed)"
        columns={[
          { label: "Model" },
          ...["Requests", "Failed", "Tokens in", "Tokens out", "Reasoning", "Cost", "Avg latency"].map(numeric),
        ]}
        rows={byModel.map((m) => [
          <ModelCell key="m" slug={m.model} />,
          formatTokens(m.requests),
          formatTokens(m.failed),
          formatTokens(m.promptTokens),
          formatTokens(m.completionTokens),
          formatTokens(m.reasoningTokens),
          formatUsd(m.costUsd),
          m.avgLatencyMs === null ? "n/a" : formatMs(m.avgLatencyMs),
        ])}
      />

      <Table
        caption="Requests, newest first"
        columns={[
          { label: "Time" },
          { label: "Model" },
          { label: "Status" },
          ...["Tokens in", "Tokens out", "Reasoning", "Cost", "Latency"].map(numeric),
        ]}
        rows={newestFirst.map(({ id, at, result: r }) => [
          new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }),
          <div key={id}>
            <ModelCell slug={servedModel(r)} />
            {r.ok && r.usedFallback && (
              <span className="block text-xs text-amber-700 dark:text-amber-300">fallback for {modelLabel(r.requestedModel)}</span>
            )}
          </div>,
          <Status key="s" ok={r.ok} label={r.ok ? "OK" : errorTitle(r.error.kind)} />,
          r.usage ? formatTokens(r.usage.promptTokens) : "–",
          r.usage ? formatTokens(r.usage.completionTokens) : "–",
          r.usage ? formatTokens(r.usage.reasoningTokens) : "–",
          r.usage ? formatUsd(r.usage.costUsd) : "–",
          formatMs(r.latencyMs),
        ])}
      />
    </section>
  );
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
      {detail && <dd className="mt-0.5 text-xs text-neutral-500">{detail}</dd>}
    </div>
  );
}

function ModelCell({ slug }: { slug: string }) {
  return (
    <span title={slug} className="whitespace-nowrap">
      {modelLabel(slug)}
    </span>
  );
}

/** Status never relies on color alone: an icon and a word carry it too. */
function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
      <span aria-hidden>{ok ? "✓" : "✕"}</span>
      {label}
    </span>
  );
}

type Column = { label: string; numeric?: boolean };
const numeric = (label: string): Column => ({ label, numeric: true });

function Table({ caption, columns, rows }: { caption: string; columns: Column[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="mb-2 text-left text-xs font-medium text-neutral-500">{caption}</caption>
        <thead>
          <tr className="border-b border-neutral-200 text-xs text-neutral-500 dark:border-neutral-800">
            {columns.map((c) => (
              <th key={c.label} scope="col" className={`py-2 pr-4 font-medium ${c.numeric ? "text-right" : ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, r) => (
            <tr key={r} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
              {cells.map((cell, i) => (
                <td
                  key={i}
                  className={`py-2 pr-4 align-top ${columns[i]?.numeric ? "text-right font-mono text-xs tabular-nums" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
