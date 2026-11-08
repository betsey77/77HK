import { useEffect, useRef } from 'react';

export const VISIBLE_POLL_INTERVAL_MS = 15_000;
export const VISIBLE_POLL_BACKOFF_MS = [15_000, 30_000, 60_000] as const;

/**
 * Run a lightweight task only while the page is visible.
 * Focus/visibility recovery runs immediately; failures back off to 60 seconds.
 */
export function useVisiblePolling(
  task: () => Promise<boolean | void>,
  enabled: boolean,
): void {
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    if (!enabled) return;

    let stopped = false;
    let running = false;
    let consecutiveFailures = 0;
    let timer: ReturnType<typeof window.setTimeout> | null = null;

    const clearTimer = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };

    const schedule = (delayMs: number) => {
      clearTimer();
      if (stopped || document.visibilityState !== 'visible') return;
      timer = window.setTimeout(() => { void run(); }, delayMs);
    };

    const run = async () => {
      if (stopped || running || document.visibilityState !== 'visible') return;
      clearTimer();
      running = true;
      let succeeded = false;
      try {
        const result = await taskRef.current();
        succeeded = result !== false;
      } catch {
        succeeded = false;
      } finally {
        running = false;
        if (stopped) return;
        if (succeeded) {
          consecutiveFailures = 0;
          schedule(VISIBLE_POLL_INTERVAL_MS);
        } else {
          consecutiveFailures = Math.min(
            consecutiveFailures + 1,
            VISIBLE_POLL_BACKOFF_MS.length,
          );
          schedule(VISIBLE_POLL_BACKOFF_MS[consecutiveFailures - 1]!);
        }
      }
    };

    const runImmediately = () => {
      if (document.visibilityState !== 'visible' || running) return;
      clearTimer();
      void run();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') runImmediately();
      else clearTimer();
    };

    window.addEventListener('focus', runImmediately);
    document.addEventListener('visibilitychange', onVisibilityChange);
    schedule(VISIBLE_POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      clearTimer();
      window.removeEventListener('focus', runImmediately);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled]);
}
