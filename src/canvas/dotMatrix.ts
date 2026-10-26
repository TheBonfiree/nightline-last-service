/* ---------------------------------------------------------------------------
 * dotMatrix.ts — a real LED dot-matrix display, rendered to canvas.
 *
 * Why this exists alongside the filmed scrub:
 *   The footage proves the material — the bloom, the pitch, the unlit ghost
 *   grid behind the lit dots. But a video can only ever say one sentence.
 *   Below the fold the strip has to carry rotating service messages, the
 *   escape-hatch offer, and whatever the record's copy says next year, so it
 *   becomes a real display instead of a picture of one. The two are matched
 *   deliberately: same pitch, same amber, same ghost grid.
 *
 * The glyphs are a 5x7 bitmap font rather than a web font sampled on a grid.
 * Thresholding an outline face at seven pixels tall produces broken stems and
 * inconsistent counters; a bitmap font is what the real hardware used, and it
 * is about two kilobytes.
 *
 * Font data is column-major: five bytes per glyph, one per column, bit 0 at
 * the top row and bit 6 at the bottom.
 * ------------------------------------------------------------------------- */

const ROWS = 7;
const GAP = 1; // blank columns between glyphs

const FONT: Record<string, number[]> = {
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00],
  '!': [0x00, 0x00, 0x5f, 0x00, 0x00],
  '"': [0x00, 0x03, 0x00, 0x03, 0x00],
  '&': [0x36, 0x49, 0x55, 0x22, 0x50],
  "'": [0x00, 0x05, 0x03, 0x00, 0x00],
  '(': [0x00, 0x1c, 0x22, 0x41, 0x00],
  ')': [0x00, 0x41, 0x22, 0x1c, 0x00],
  '*': [0x14, 0x08, 0x3e, 0x08, 0x14],
  '+': [0x08, 0x08, 0x3e, 0x08, 0x08],
  ',': [0x00, 0x50, 0x30, 0x00, 0x00],
  '-': [0x08, 0x08, 0x08, 0x08, 0x08],
  '.': [0x00, 0x60, 0x60, 0x00, 0x00],
  '/': [0x20, 0x10, 0x08, 0x04, 0x02],
  '0': [0x3e, 0x51, 0x49, 0x45, 0x3e],
  '1': [0x00, 0x42, 0x7f, 0x40, 0x00],
  '2': [0x42, 0x61, 0x51, 0x49, 0x46],
  '3': [0x21, 0x41, 0x45, 0x4b, 0x31],
  '4': [0x18, 0x14, 0x12, 0x7f, 0x10],
  '5': [0x27, 0x45, 0x45, 0x45, 0x39],
  '6': [0x3c, 0x4a, 0x49, 0x49, 0x30],
  '7': [0x01, 0x71, 0x09, 0x05, 0x03],
  '8': [0x36, 0x49, 0x49, 0x49, 0x36],
  '9': [0x06, 0x49, 0x49, 0x29, 0x1e],
  ':': [0x00, 0x36, 0x36, 0x00, 0x00],
  ';': [0x00, 0x56, 0x36, 0x00, 0x00],
  '<': [0x08, 0x14, 0x22, 0x41, 0x00],
  '=': [0x14, 0x14, 0x14, 0x14, 0x14],
  '>': [0x00, 0x41, 0x22, 0x14, 0x08],
  '?': [0x02, 0x01, 0x51, 0x09, 0x06],
  A: [0x7e, 0x11, 0x11, 0x11, 0x7e],
  B: [0x7f, 0x49, 0x49, 0x49, 0x36],
  C: [0x3e, 0x41, 0x41, 0x41, 0x22],
  D: [0x7f, 0x41, 0x41, 0x22, 0x1c],
  E: [0x7f, 0x49, 0x49, 0x49, 0x41],
  F: [0x7f, 0x09, 0x09, 0x01, 0x01],
  G: [0x3e, 0x41, 0x41, 0x51, 0x32],
  H: [0x7f, 0x08, 0x08, 0x08, 0x7f],
  I: [0x00, 0x41, 0x7f, 0x41, 0x00],
  J: [0x20, 0x40, 0x41, 0x3f, 0x01],
  K: [0x7f, 0x08, 0x14, 0x22, 0x41],
  L: [0x7f, 0x40, 0x40, 0x40, 0x40],
  M: [0x7f, 0x02, 0x04, 0x02, 0x7f],
  N: [0x7f, 0x04, 0x08, 0x10, 0x7f],
  O: [0x3e, 0x41, 0x41, 0x41, 0x3e],
  P: [0x7f, 0x09, 0x09, 0x09, 0x06],
  Q: [0x3e, 0x41, 0x51, 0x21, 0x5e],
  R: [0x7f, 0x09, 0x19, 0x29, 0x46],
  S: [0x46, 0x49, 0x49, 0x49, 0x31],
  T: [0x01, 0x01, 0x7f, 0x01, 0x01],
  U: [0x3f, 0x40, 0x40, 0x40, 0x3f],
  V: [0x1f, 0x20, 0x40, 0x20, 0x1f],
  W: [0x7f, 0x20, 0x18, 0x20, 0x7f],
  X: [0x63, 0x14, 0x08, 0x14, 0x63],
  Y: [0x03, 0x04, 0x78, 0x04, 0x03],
  Z: [0x61, 0x51, 0x49, 0x45, 0x43],
};

/** Anything with no glyph becomes a space rather than a tofu box — a real
 *  sign controller simply cannot send a character it does not have. */
function glyph(ch: string): number[] {
  return FONT[ch.toUpperCase()] ?? FONT[' '];
}

/** Flatten a string into one column bitmap per matrix column. */
export function toColumns(text: string): number[] {
  const cols: number[] = [];
  for (const ch of text) {
    cols.push(...glyph(ch));
    for (let g = 0; g < GAP; g++) cols.push(0);
  }
  return cols;
}

export interface MatrixController {
  setText(text: string): void;
  /** Horizontal scroll position in columns. Fractional values are floored:
   *  a real matrix cannot light half a dot, and interpolating produces a
   *  smear that reads as video rather than as hardware. */
  setOffset(cols: number): void;
  /** Total columns in the current message, for the caller's scroll maths. */
  columnCount(): number;
  /** Centre the message instead of running it from the left edge. Switched
   *  at runtime rather than at construction, because a visitor can flip the
   *  OS reduced-motion setting mid-visit. */
  setCentred(on: boolean): void;
  resize(): void;
  destroy(): void;
}

interface Options {
  canvas: HTMLCanvasElement;
  lit: string;
  dim: string;
  ground: string;
  /** Centre a short message instead of running it from the left edge.
   *  Used under reduced motion, where the text swaps rather than travels. */
  centred?: boolean;
}

export function createMatrix({ canvas, lit, dim, ground, centred = false }: Options): MatrixController {
  const ctx = canvas.getContext('2d', { alpha: false });
  let isCentred = centred;
  let columns: number[] = [];
  let offset = 0;
  let queued = false;
  let alive = true;

  function paint() {
    queued = false;
    if (!ctx || !alive) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, w, h);

    // Pitch is derived from the panel height so the seven rows always fill
    // it exactly. Everything else snaps to this number; nothing on this
    // display sits at a fractional offset.
    const pitch = h / ROWS;
    const r = pitch * 0.34;
    const visible = Math.ceil(w / pitch) + 1;

    const start = isCentred
      ? Math.floor((columns.length - w / pitch) / 2)
      : Math.floor(offset);

    for (let sx = 0; sx < visible; sx++) {
      const col = columns[start + sx];
      const cx = sx * pitch + pitch / 2;
      for (let y = 0; y < ROWS; y++) {
        const on = col !== undefined && (col >> y) & 1;
        ctx.beginPath();
        ctx.arc(cx, y * pitch + pitch / 2, r, 0, Math.PI * 2);
        // The unlit dot is always drawn. The ghost grid is what makes this
        // read as a display with dark pixels rather than as text on black.
        ctx.fillStyle = on ? lit : dim;
        ctx.fill();
      }
    }
  }

  function request() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(paint);
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    request();
  }

  resize();
  /* A ResizeObserver, not a window resize listener. This strip is sized by
   * aspect-ratio inside a flex column, so its box changes without the window
   * ever changing: a late web font reflowing the heading above it, a mobile
   * URL bar collapsing, a container query. Missing those leaves the backing
   * store at the old size and the browser stretches it — on a dot matrix
   * that shows up immediately as oval dots, which is the one artifact the
   * material cannot survive. */
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  return {
    setText(text) {
      columns = toColumns(text);
      offset = 0;
      request();
    },
    setOffset(cols) {
      const next = Math.floor(cols);
      if (next === offset) return;
      offset = next;
      request();
    },
    columnCount: () => columns.length,
    setCentred(on) {
      if (on === isCentred) return;
      isCentred = on;
      request();
    },
    resize,
    destroy() {
      alive = false;
      ro.disconnect();
    },
  };
}
