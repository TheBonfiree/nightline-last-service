/* ---------------------------------------------------------------------------
 * config.ts — single source of truth
 *
 * Frame counts, timings and device budgets. Re-extracting the ticker sequence
 * at a different length should never require touching another file.
 * ------------------------------------------------------------------------- */

export const BRAND = {
  artist: 'NIGHTLINE',
  release: 'LAST SERVICE',
  station: 'PLATFORM 4',
} as const;

/* Ticker scrub sequence ---------------------------------------------------
 * Counts must match the files actually present under public/frames/.
 * scripts/extract-frames.sh prints both numbers when it finishes.
 *
 * Mobile is its own contiguous 0..N sequence at 640px, so the index needs no
 * remapping — only the directory changes.
 */
export const TICKER = {
  count: 111,
  mobileCount: 74,
  path: '/frames/desktop/',
  mobilePath: '/frames/mobile/',
  prefix: 'frame_',
  ext: '.webp',
  pad: 4,

  /* The frame shown instead of a scrub under reduced motion: the phrase at
   * its most legible, not frame 0000 and not a slowed scrub. */
  peakFrame: 55,
} as const;

/* Ambient device budget — five, and that is the number. DIEGETIC counts
 * devices the way a scrub register counts frames. Adding a sixth means
 * removing one of these, not appending to the list. */
export const AMBIENT = {
  /** 1. Station clock — ticks even under reduced motion; a clock is
   *  information, not decoration. */
  clockTickMs: 1000,

  /** 3. Live ticker — how long a message is held under reduced motion, where
   *  it swaps in place instead of travelling. When it does travel, the time
   *  it takes to cross the panel is the interval and this is unused. */
  messageIntervalMs: 22_000,

  /** 4. Row status flicker — a dot-matrix refresh, `steps()` only. */
  flickerMs: 120,

  /** 5. Idle test pattern. Never fires under reduced motion. */
  idleAfterMs: 60_000,
  idleVariants: 2,
} as const;

export const STORAGE_KEY = 'nightline:layer';

export const MOBILE_QUERY = '(max-width: 768px)';

export const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;

/* Read live rather than cached: a visitor can flip the OS setting mid-visit,
 * and every effect on this page branches in JavaScript because a CSS media
 * query never sees a canvas scrub or an idle timer. */
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const tickerCount = () =>
  isMobile() ? TICKER.mobileCount : TICKER.count;

export const tickerSrc = (i: number) => {
  const dir = isMobile() ? TICKER.mobilePath : TICKER.path;
  return `${dir}${TICKER.prefix}${String(i).padStart(TICKER.pad, '0')}${TICKER.ext}`;
};

/** Peak frame rescaled to whichever sequence is in use. */
export const peakFrameIndex = () =>
  Math.round((TICKER.peakFrame / TICKER.count) * (tickerCount() - 1));
