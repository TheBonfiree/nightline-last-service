/* ---------------------------------------------------------------------------
 * Loader.tsx — the board powering on.
 *
 * This project shipped deliberately WITHOUT a gate, and that was the right
 * default: entry.md's argument is that a loader added for atmosphere is a tax
 * the reader pays on every visit. A gate has to clear two conditions, and
 * here both actually do:
 *
 *   1. The page cannot render its opening without heavy assets. The hero is a
 *      111-frame WebP sequence, ~1.6MB, and scrolling into a half-decoded
 *      sequence is what the gate exists to prevent.
 *   2. There is an opening worth watching. A mark assembling on the same
 *      matrix the whole page is drawn on is a title sequence, not a spinner.
 *
 * Everything entry.md then makes mandatory is here rather than optional:
 *
 *   - A ceiling. If the payload has not arrived in TIMEOUT_MS the page is
 *     shown anyway. A loader with no timeout is a hang.
 *   - Progress tied to real decode completion, not to a timer.
 *   - The gate never covers the content. The page renders underneath from the
 *     first paint, so a thrown script leaves a readable site rather than a
 *     black rectangle — and with JavaScript off this component never exists
 *     at all, which is why the tracklist lives in index.html.
 *   - Reduced motion skips it outright. Not a shortened gate: no gate.
 *   - Repeat visits within a session skip it too. Holding someone at a
 *     loading screen for assets already in cache is theatre.
 * ------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from 'react';
import { createHeart, type HeartMark } from '../canvas/heart';
import { prefersReducedMotion, tickerSrc } from '../config';
import { Odometer } from './Odometer';

/** Frames that must decode before the board is considered ready. Not the
 *  whole sequence — gating the page on all 111 would be a single point of
 *  failure by design. The rest streams in behind the hero. */
const GATE_FRAMES = 14;

/** Hard ceiling. Past this the page is revealed whatever is still in flight.
 *  This is the emergency exit and it ignores the floor below. */
const TIMEOUT_MS = 6000;

/**
 * Floor on how long the gate is on screen, UNCONDITIONAL — it does not
 * shrink because the network was fast. On a warm cache the assets resolve in
 * under a tenth of a second, and without this the gate appeared and left
 * inside a single blink, which read as a flicker rather than as an opening.
 *
 * The counter's climb is paced to this window regardless of how quickly the
 * real decode finishes, so the readout is always moving rather than snapping
 * to 100 and idling. A slow connection can still push the wait past this
 * floor — real completion is still required, up to TIMEOUT_MS — but it never
 * goes below it. Paid once: a repeat visit in the same session skips the
 * gate entirely, as does reduced motion.
 */
const MIN_VISIBLE_MS = 3600;

const SESSION_KEY = 'nightline:booted';

/** lub — dub — rest. Offsets in ms within one cycle.
 *  ~48bpm, with a slow decay on each pulse so the beat reads as a contraction
 *  rather than as a blink. */
const BEATS = [0, 210];
const CYCLE_MS = 1400;
const PULSE_MS = 260;

function alreadyBooted() {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}

export function Loader() {
  // Decided once, before first paint, so the gate never flashes for someone
  // who is not going to see it.
  const [active, setActive] = useState(() => !alreadyBooted() && !prefersReducedMotion());
  const [leaving, setLeaving] = useState(false);
  const [pct, setPct] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  /* The .preanim guard. Applied for exactly one frame so the initial state is
   * set without transitioning into it from the browser's defaults — otherwise
   * the panel flashes its end state and animates backwards into its start. */
  useEffect(() => {
    if (!active) return;
    const el = rootRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => el.classList.remove('preanim'));
    return () => cancelAnimationFrame(id);
  }, [active]);

  /* The mark, and its pulse. */
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const css = getComputedStyle(document.documentElement);
    const heart: HeartMark = createHeart({
      canvas,
      lit: css.getPropertyValue('--amber').trim() || '#ffa733',
      dim: css.getPropertyValue('--led-dim').trim() || '#1a2026',
    });

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const t = (now - start) % CYCLE_MS;
      // Highest contribution of either beat, each decaying over PULSE_MS.
      let v = 0;
      for (const b of BEATS) {
        const d = t - b;
        if (d >= 0 && d < PULSE_MS) v = Math.max(v, 1 - d / PULSE_MS);
      }
      heart.setBeat(v);
    };
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); heart.destroy(); };
  }, [active]);

  /* Real progress: fonts, then the opening frames.
   *
   * Two numbers drive one readout. `real` is genuine decode completion, and
   * it is the one that decides when the page is ready. `paced` is elapsed
   * time across MIN_VISIBLE_MS. The counter shows whichever is LOWER, which
   * means it can never run ahead of the truth, and on a warm cache it climbs
   * on the clock instead of snapping to 100 and sitting there — a readout
   * parked at 100 for two seconds reads as a stall, which is exactly the
   * thing a progress indicator must not do. */
  useEffect(() => {
    if (!active) return;
    let done = 0;
    let real = 0;
    let cancelled = false;
    let finished = false;
    let raf = 0;
    const total = GATE_FRAMES + 1;
    const start = performance.now();

    const leave = () => {
      if (finished || cancelled) return;
      finished = true;
      cancelAnimationFrame(raf);
      setPct(100);
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* private mode */ }
      setLeaving(true);
      window.setTimeout(() => { if (!cancelled) setActive(false); }, 420);
    };

    const bump = () => {
      if (cancelled) return;
      done += 1;
      real = Math.min(100, (done / total) * 100);
    };

    let shownPct = -1;
    const step = () => {
      if (cancelled) return;
      raf = requestAnimationFrame(step);
      const paced = ((performance.now() - start) / MIN_VISIBLE_MS) * 100;
      const shown = Math.floor(Math.min(real, paced));
      // Only re-render when the integer actually changes.
      if (shown !== shownPct) { shownPct = shown; setPct(shown); }
      if (real >= 100 && paced >= 100) leave();
    };
    raf = requestAnimationFrame(step);

    const decode = (src: string) => new Promise<void>((res) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      const ok = () => res();
      if (img.decode) img.decode().then(ok, ok);
      else { img.onload = ok; img.onerror = ok; }
    });

    document.fonts.ready.then(bump, bump);
    for (let i = 0; i < GATE_FRAMES; i++) decode(tickerSrc(i)).then(bump);

    /* The ceiling, and it overrides the floor. Whatever happened, the page
     * appears: a loader that stops at 70% and lifts anyway reads as broken,
     * and one that never lifts is a hang. */
    const ceiling = window.setTimeout(leave, TIMEOUT_MS);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(ceiling);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={rootRef}
      className={`boot preanim${leaving ? ' is-leaving' : ''}`}
      /* A progressbar, not a live region. `aria-live="polite"` around a
       * counter announces every single increment — fifteen interruptions to
       * say a number nobody asked for. A progressbar exposes the same value
       * for assistive tech to read on demand, and the label says what is
       * actually happening once. */
      role="progressbar"
      aria-label="Preparing the departure board"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className="boot__grid matrix-grid" aria-hidden="true" />

      <div className="boot__inner">
        <canvas ref={canvasRef} className="boot__mark" aria-hidden="true" />

        <p className="boot__line" aria-hidden="true">
          Platform 4 &mdash; preparing departure board
        </p>

        {/* Decoration: the value it shows is already on the progressbar. */}
        <p className="boot__pct" aria-hidden="true">
          <Odometer value={pct} digits={3} />
          <span className="boot__pct-unit">%</span>
        </p>
      </div>
    </div>
  );
}
