import "server-only";

/**
 * Server-only env access. The `server-only` import makes the build fail if a
 * Client Component ever imports this file, so the key can't leak into the
 * browser bundle by accident. (Next.js only inlines `NEXT_PUBLIC_*` vars into
 * client code. Never give the key that prefix.)
 */

export class MissingEnvError extends Error {}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new MissingEnvError(
      `Missing env var ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function getServerEnv() {
  return {
    openRouterApiKey: required("OPENROUTER_API_KEY"),
    // Optional: OpenRouter app attribution headers
    siteUrl: process.env.SITE_URL ?? "http://localhost:3000",
    appTitle: process.env.APP_TITLE ?? "Shelf Advisor",
  };
}
