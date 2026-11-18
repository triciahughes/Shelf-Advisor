"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Seconds since `startedAt`, updated twice a second.
 * State only changes inside the interval callback (never synchronously in the
 * effect), and Date.now() never runs during render, which keeps prerendering
 * and the React hooks lint rules happy.
 */
export function useElapsedSeconds(startedAt: number): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(id);
  }, [startedAt]);
  return seconds;
}

/** A countdown you start from an event handler, e.g. after a 429. */
export function useCooldown() {
  const [until, setUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (until === null) return;
    const id = setInterval(() => {
      const left = Math.ceil((until - Date.now()) / 1000);
      if (left <= 0) {
        setUntil(null);
        setSecondsLeft(0);
      } else {
        setSecondsLeft(left);
      }
    }, 250);
    return () => clearInterval(id);
  }, [until]);

  const start = useCallback((seconds: number) => {
    setUntil(Date.now() + seconds * 1000);
    setSecondsLeft(seconds);
  }, []);

  return { secondsLeft, start };
}
