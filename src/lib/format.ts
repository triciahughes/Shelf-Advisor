import { FALLBACK_MODELS, MODELS } from "@/config/models";

const stripFree = (slug: string) => slug.replace(/:free$/, "");

const KNOWN_MODELS = [...MODELS, ...FALLBACK_MODELS];

/** Friendly label for a slug, falling back to the slug itself if it's not in config. */
export function modelLabel(slug: string): string {
  return KNOWN_MODELS.find((m) => stripFree(m.id) === stripFree(slug))?.label ?? slug;
}

/**
 * Model calls often cost fractions of a cent, so a fixed 2 decimals would show
 * "$0.00" for real spend. Show enough significant digits to be meaningful.
 */
export function formatUsd(cost: number | null): string {
  if (cost === null) return "n/a";
  if (cost === 0) return "$0 (free)";
  if (cost < 0.01) return `$${cost.toPrecision(2)}`;
  return `$${cost.toFixed(4)}`;
}

export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function formatTokens(n: number): string {
  return n.toLocaleString("en-US");
}
