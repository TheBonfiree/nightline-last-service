/* ---------------------------------------------------------------------------
 * IdlePattern.tsx — ambient device 5.
 *
 * After sixty seconds of no input the board drops to a test pattern, as a
 * real one does out of service hours. Two variants, per the budget.
 *
 * Three rules make this acceptable rather than hostile:
 *
 *   1. It NEVER fires under prefers-reduced-motion. An unrequested
 *      full-screen takeover is the single most aggressive thing this register
 *      can do, and the timer lives in JavaScript where a CSS media query
 *      would never have caught it.
 *   2. It never steals focus. It is aria-hidden and inert to the keyboard;
 *      whatever the visitor had selected is still selected underneath.
 *   3. Any input wakes it — including a key press, so a keyboard visitor is
 *      not locked behind a mouse gesture.
 * ------------------------------------------------------------------------- */

import { IDLE_PATTERNS } from '../data/tracks';

export function IdlePattern({ variant }: { variant: number }) {
  return (
    <div className="idle" aria-hidden="true">
      <span>{IDLE_PATTERNS[variant % IDLE_PATTERNS.length]}</span>
    </div>
  );
}
