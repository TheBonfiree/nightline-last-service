/* ---------------------------------------------------------------------------
 * ledPanel.ts — the board rendered as actual hardware.
 *
 * Before this existed, the ticker at the base of the board was a real dot
 * matrix and the board above it was a pixel font with a CSS grid behind it —
 * a picture of a matrix sitting directly above the genuine article. The
 * register's whole claim is that the page IS a display rather than a picture
 * of one, so the board had to become one too.
 *
 * What that buys, beyond consistency:
 *
 *   - Dots warm up and cool down. An LED does not switch instantly, and the
 *     ~90ms ramp is most of why a real panel reads as lit glass rather than
 *     as text.
 *   - Rows can ROLL. A departure board's one famous behaviour is the
 *     mechanical scroll of a changing row, and it is not expressible in type.
 *   - The panel boots. Rows arrive staggered, the way a display that has just
 *     been powered does.
 *
 * The DOM text underneath stays exactly where it was and is what screen
 * readers read; this canvas is aria-hidden decoration painted on top. The DOM
 * text is only made transparent once this renderer has actually painted, so a
 * failed canvas leaves a legible board rather than an empty panel.
 *
 * Performance shape: there is no permanent animation loop. The rAF only runs
 * while something is settling, and it stops when everything has. Repaints are
 * per-row bands, and the unlit ghost grid — the overwhelming majority of the
 * dots — is a single cached Path2D stamped once per row.
 * ------------------------------------------------------------------------- */

import { toColumns } from './dotMatrix';

const ROWS = 7;          // dot-rows per line of text; the classic matrix height
/** 5 columns of glyph plus 1 blank. Exported so field widths are declared
 *  in characters rather than in magic column counts. */
export const GLYPH = 6;
const RAMP_MS = 90;      // LED warm-up / cool-down
const ROLL_STEP_MS = 34; // one dot-row of mechanical scroll
const BOOT_STAGGER_MS = 38;

export type Tone = 'lit' | 'amber' | 'off';

export interface PanelCell {
  text: string;
  /** Left edge in matrix columns. */
  col: number;
  /** Field width in matrix columns; the text is clipped to it. */
  width: number;
  align?: 'left' | 'right';
  tone?: Tone;
}

export interface PanelRow {
  /** Stable identity, so a reorder is not mistaken for a content change. */
  key: string;
  cells: PanelCell[];
}

export interface PanelGeometry {
  /** Top of each line, in CSS pixels relative to the canvas. */
  tops: number[];
  /** Height of one line box, in CSS pixels. */
  lineHeight: number;
}

export interface LedPanel {
  setRows(rows: PanelRow[]): void;
  setGeometry(g: PanelGeometry): void;
  /** Staggered power-on. No-op when instant. */
  boot(): void;
  /** Reduced motion: no ramp, no roll, no boot. Everything cuts. */
  setInstant(on: boolean): void;
  /** Stop all work while the panel is off-screen. */
  setActive(on: boolean): void;
  destroy(): void;
}

interface Options {
  canvas: HTMLCanvasElement;
  columns: number;
  colors: { dim: string; lit: string; amber: string; off: string };
  /** Called the first time a frame is actually painted, so the caller can
   *  hide the DOM text only once there is something to replace it with. */
  onFirstPaint?: () => void;
}

/** One line's worth of column bitmaps, laid out across the full panel width. */
function layout(cells: PanelCell[], columns: number): { bits: Uint8Array; tone: Uint8Array } {
  const bits = new Uint8Array(columns);
  const tone = new Uint8Array(columns);
  const toneIndex: Record<Tone, number> = { lit: 0, amber: 1, off: 2 };

  for (const cell of cells) {
    const cols = toColumns(cell.text);
    // Trailing gap column belongs to the glyph, not to the field.
    const used = Math.max(0, cols.length - 1);
    const start =
      cell.align === 'right'
        ? cell.col + Math.max(0, cell.width - used)
        : cell.col;

    for (let i = 0; i < used; i++) {
      const x = start + i;
      // Clip to the field, so an over-long title truncates at the column
      // boundary the way a real controller truncates it.
      if (x < cell.col || x >= cell.col + cell.width || x >= columns) continue;
      bits[x] = cols[i];
      tone[x] = toneIndex[cell.tone ?? 'lit'];
    }
  }
  return { bits, tone };
}

export function createLedPanel({ canvas, columns, colors, onFirstPaint }: Options): LedPanel {
  /* Transparent, not opaque. An expanded service pushes the rows below it
   * down and opens a gap of real DOM content — the calling points — inside
   * the panel's box. An opaque canvas would paint over them. So the canvas
   * clears to nothing and draws only the seven-dot band of each line, and
   * the board's own ground and CSS ghost grid show through everywhere else. */
  const ctx = canvas.getContext('2d');

  let rows: PanelRow[] = [];
  let geom: PanelGeometry = { tops: [], lineHeight: 0 };
  let instant = false;
  let active = true;
  let alive = true;
  let painted = false;

  /** Per line: the bitmap currently displayed, and the one rolling in. */
  let current: { bits: Uint8Array; tone: Uint8Array }[] = [];
  let incoming: ({ bits: Uint8Array; tone: Uint8Array } | null)[] = [];
  /** Roll progress in dot-rows, 0..ROWS. */
  let roll: number[] = [];
  let rollStart: number[] = [];
  /** Brightness 0..1 per line, for the warm-up ramp. */
  let level: number[] = [];
  let levelTarget: number[] = [];
  let bootAt: number[] = [];

  /** Per line: cached lit/bloom geometry. Invalidated by a content change,
   *  a roll step, or a pitch change. */
  let litCache: ({ dots: Path2D[]; bloom: Path2D[]; pitch: number; step: number } | null)[] = [];

  let raf = 0;
  let pitch = 0;
  let dimPath: Path2D | null = null;
  let dpr = 1;

  /* --- geometry ---------------------------------------------------------- */

  function measure() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    pitch = r.width / columns;

    // The ghost grid never changes, so one row of it is built once and
    // stamped per line. It is ~97% of the dots on the panel; drawing it
    // per-dot per-frame was the whole cost.
    const p = new Path2D();
    const rad = Math.max(0.55, pitch * 0.34);
    for (let x = 0; x < columns; x++) {
      for (let y = 0; y < ROWS; y++) {
        p.moveTo(x * pitch + pitch / 2 + rad, y * pitch + pitch / 2);
        p.arc(x * pitch + pitch / 2, y * pitch + pitch / 2, rad, 0, Math.PI * 2);
      }
    }
    dimPath = p;
    litCache = [];
    return true;
  }

  /* --- painting ---------------------------------------------------------- */

  function bitAt(i: number, x: number, y: number): number {
    const step = roll[i] | 0;
    const cur = current[i];
    const inc = incoming[i];
    if (!cur) return 0;
    if (step === 0 || !inc) return (cur.bits[x] >> y) & 1;
    // Old content scrolls up and out; new content follows it in from below.
    const src = y + step < ROWS ? cur : inc;
    const sy = y + step < ROWS ? y + step : y + step - ROWS;
    return (src.bits[x] >> sy) & 1;
  }

  function toneAt(i: number, x: number, y: number): number {
    const step = roll[i] | 0;
    const cur = current[i];
    const inc = incoming[i];
    if (!cur) return 0;
    if (step === 0 || !inc) return cur.tone[x];
    return y + step < ROWS ? cur.tone[x] : inc.tone[x];
  }

  /**
   * Lit-dot geometry for one line, built once and kept until that line's
   * content or the pitch changes.
   *
   * This is what makes it affordable for the rows to MOVE. Expanding a
   * service slides everything below it, so every frame of that 240ms has to
   * repaint the whole panel — and rebuilding the paths each time meant
   * iterating 276x7 cells and constructing arcs for all ten lines, sixty
   * times a second. Cached, a pure geometry change costs ten `clearRect`s
   * and about seventy `fill`s.
   *
   * Mid-roll lines are deliberately NOT cached: their bitmap is a moving
   * composite of two others and changes every step anyway.
   */
  function litPathsFor(i: number): { dots: Path2D[]; bloom: Path2D[] } | null {
    const rolling = !!incoming[i];
    const hit = litCache[i];
    if (!rolling && hit && hit.pitch === pitch && hit.step === -1) return hit;

    const rad = Math.max(0.55, pitch * 0.34);
    const dots = [new Path2D(), new Path2D(), new Path2D()];
    const bloom = [new Path2D(), new Path2D(), new Path2D()];
    let any = false;

    for (let x = 0; x < columns; x++) {
      for (let y = 0; y < ROWS; y++) {
        if (!bitAt(i, x, y)) continue;
        any = true;
        const t = toneAt(i, x, y);
        const cx = x * pitch + pitch / 2;
        const cy = y * pitch + pitch / 2;
        dots[t].moveTo(cx + rad, cy);
        dots[t].arc(cx, cy, rad, 0, Math.PI * 2);
        bloom[t].moveTo(cx + rad * 2.1, cy);
        bloom[t].arc(cx, cy, rad * 2.1, 0, Math.PI * 2);
      }
    }
    if (!any) return null;

    const entry = { dots, bloom, pitch, step: rolling ? roll[i] : -1 };
    litCache[i] = entry;
    return entry;
  }

  function paintLine(i: number) {
    if (!ctx || !dimPath) return;
    const top = geom.tops[i];
    if (top === undefined) return;

    const h = ROWS * pitch;
    const yOff = top + (geom.lineHeight - h) / 2;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(0, yOff);

    // Clear the band, then stamp the ghost grid in one fill.
    ctx.clearRect(0, 0, canvas.width / dpr, h);
    ctx.fillStyle = colors.dim;
    ctx.fill(dimPath);

    const bright = level[i] ?? 1;
    if (bright > 0.01) {
      const cache = litPathsFor(i);
      if (cache) {
        const palette = [colors.lit, colors.amber, colors.off];
        // Bloom is a second, wider, low-alpha pass — light spilling into the
        // acrylic. Deliberately NOT filter: blur(); the register bans it and
        // a real LED's spill has a hard falloff anyway.
        ctx.globalAlpha = bright * 0.16;
        for (let t = 0; t < 3; t++) { ctx.fillStyle = palette[t]; ctx.fill(cache.bloom[t]); }
        ctx.globalAlpha = bright;
        for (let t = 0; t < 3; t++) { ctx.fillStyle = palette[t]; ctx.fill(cache.dots[t]); }
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();

    if (!painted) {
      painted = true;
      onFirstPaint?.();
    }
  }

  function paintAll() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < rows.length; i++) paintLine(i);
  }

  /* --- the loop, which only runs while something is settling -------------- */

  function settled() {
    for (let i = 0; i < rows.length; i++) {
      if (incoming[i]) return false;
      if (Math.abs(level[i] - levelTarget[i]) > 0.004) return false;
    }
    return true;
  }

  function tick(now: number) {
    raf = 0;
    if (!alive || !active) return;

    let dirty = false;

    for (let i = 0; i < rows.length; i++) {
      // Warm-up / cool-down.
      const target = now >= (bootAt[i] ?? 0) ? levelTarget[i] : 0;
      if (Math.abs(level[i] - target) > 0.004) {
        // Exponential approach: fast off the mark, long tail — which is what
        // an LED's current curve actually looks like.
        const k = 1 - Math.exp(-16.7 / RAMP_MS * 6);
        level[i] += (target - level[i]) * k;
        if (Math.abs(level[i] - target) <= 0.004) level[i] = target;
        dirty = true;
        paintLine(i);
      }

      // Mechanical roll.
      if (incoming[i]) {
        const step = Math.floor((now - rollStart[i]) / ROLL_STEP_MS);
        if (step >= ROWS) {
          current[i] = incoming[i]!;
          incoming[i] = null;
          roll[i] = 0;
          litCache[i] = null;
          paintLine(i);
        } else if (step !== roll[i]) {
          roll[i] = step;
          litCache[i] = null;
          paintLine(i);
        }
        dirty = true;
      }
    }

    if (dirty || !settled()) raf = requestAnimationFrame(tick);
  }

  function kick() {
    if (!raf && alive && active) raf = requestAnimationFrame(tick);
  }

  /* --- public ------------------------------------------------------------ */

  function sameBits(a: { bits: Uint8Array; tone: Uint8Array } | undefined,
                    b: { bits: Uint8Array; tone: Uint8Array }) {
    if (!a) return false;
    for (let i = 0; i < b.bits.length; i++) {
      if (a.bits[i] !== b.bits[i] || a.tone[i] !== b.tone[i]) return false;
    }
    return true;
  }

  const api: LedPanel = {
    setRows(next) {
      const laidOut = next.map((r) => layout(r.cells, columns));
      const grew = next.length !== rows.length;
      rows = next;

      for (let i = 0; i < next.length; i++) {
        if (level[i] === undefined) { level[i] = 0; levelTarget[i] = 1; bootAt[i] = 0; roll[i] = 0; }
        if (!current[i] || grew) { current[i] = laidOut[i]; litCache[i] = null; continue; }
        if (sameBits(current[i], laidOut[i])) continue;

        litCache[i] = null;
        if (instant) {
          current[i] = laidOut[i];
        } else {
          incoming[i] = laidOut[i];
          roll[i] = 0;
          rollStart[i] = performance.now();
        }
      }
      if (instant) { for (let i = 0; i < next.length; i++) level[i] = 1; paintAll(); }
      else kick();
    },

    setGeometry(g) {
      geom = g;
      if (measure()) paintAll();
    },

    boot() {
      if (instant) { for (let i = 0; i < rows.length; i++) level[i] = 1; paintAll(); return; }
      const now = performance.now();
      for (let i = 0; i < rows.length; i++) {
        level[i] = 0;
        levelTarget[i] = 1;
        bootAt[i] = now + i * BOOT_STAGGER_MS;
      }
      kick();
    },

    setInstant(on) {
      instant = on;
      if (!on) return;
      for (let i = 0; i < rows.length; i++) {
        if (incoming[i]) { current[i] = incoming[i]!; incoming[i] = null; roll[i] = 0; litCache[i] = null; }
        level[i] = 1;
        bootAt[i] = 0;
      }
      paintAll();
    },

    setActive(on) {
      active = on;
      if (on) kick();
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    },

    destroy() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
    },
  };

  return api;
}
