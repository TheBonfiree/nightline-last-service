/* ---------------------------------------------------------------------------
 * heart.ts — the mark, as an 11x10 bitmap.
 *
 * A pixel heart is the only logo this artifact can honestly carry. Everything
 * on the page is drawn dot by dot on a matrix that cannot describe a curve,
 * so a vector mark would have to be imported from outside the world; a
 * bitmap heart is native to it. It is also the record's own subject — the
 * source footage the whole page grew out of is a sign scrolling "I wanna be
 * yours".
 *
 * Authored on the grid rather than traced: at eleven dots wide the shape is
 * decided by which individual dots are lit, and the two lobes have to clear
 * each other by exactly one unlit column or the top reads as a blob.
 *
 * Row-major, one entry per dot row, LSB at the LEFT — the opposite of the
 * 5x7 text font, which is column-major, because a sprite is authored by rows
 * and a typeface is authored by columns.
 * ------------------------------------------------------------------------- */

export const HEART_W = 11;
export const HEART_H = 10;

const ROWS = [
  '01100000110',
  '11110001111',
  '11111011111',
  '11111111111',
  '11111111111',
  '01111111110',
  '00111111100',
  '00011111000',
  '00001110000',
  '00000100000',
] as const;

/** `true` where a dot is lit. Indexed [y][x]. */
export const HEART: boolean[][] = ROWS.map((r) => [...r].map((c) => c === '1'));

export interface HeartOptions {
  canvas: HTMLCanvasElement;
  lit: string;
  dim: string;
}

export interface HeartMark {
  /** 0 = resting, 1 = full contraction. Drives brightness and dot size. */
  setBeat(v: number): void;
  resize(): void;
  destroy(): void;
}

/**
 * Draws the mark on its own matrix, with the same materials as the board:
 * every dot position is drawn, unlit ones included, and the lit ones get a
 * second wider low-alpha pass for the bloom. Without the unlit grid behind
 * it the shape reads as a picture of a heart rather than as a heart on a
 * display.
 */
export function createHeart({ canvas, lit, dim }: HeartOptions): HeartMark {
  const ctx = canvas.getContext('2d');
  let beat = 0;
  let queued = false;
  let alive = true;
  let dpr = 1;

  function paint() {
    queued = false;
    if (!ctx || !alive) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Fit the sprite to the shorter axis so the mark never distorts.
    const pitch = Math.min(w / HEART_W, h / HEART_H);
    const ox = (w - pitch * HEART_W) / 2;
    const oy = (h - pitch * HEART_H) / 2;

    // A contracting LED does not move; it gets brighter and blooms wider.
    const rad = pitch * (0.34 + beat * 0.05);
    const glow = 0.14 + beat * 0.22;

    const bloom = new Path2D();
    const dots = new Path2D();
    const ghost = new Path2D();

    for (let y = 0; y < HEART_H; y++) {
      for (let x = 0; x < HEART_W; x++) {
        const cx = ox + x * pitch + pitch / 2;
        const cy = oy + y * pitch + pitch / 2;
        const target = HEART[y][x] ? dots : ghost;
        target.moveTo(cx + rad, cy);
        target.arc(cx, cy, rad, 0, Math.PI * 2);
        if (HEART[y][x]) {
          bloom.moveTo(cx + rad * 2.2, cy);
          bloom.arc(cx, cy, rad * 2.2, 0, Math.PI * 2);
        }
      }
    }

    ctx.fillStyle = dim;
    ctx.fill(ghost);

    ctx.globalAlpha = glow;
    ctx.fillStyle = lit;
    ctx.fill(bloom);

    ctx.globalAlpha = 0.75 + beat * 0.25;
    ctx.fill(dots);
    ctx.globalAlpha = 1;
  }

  function request() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(paint);
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    request();
  }

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  return {
    setBeat(v) {
      const next = Math.max(0, Math.min(1, v));
      if (Math.abs(next - beat) < 0.01) return;
      beat = next;
      request();
    },
    resize,
    destroy() {
      alive = false;
      ro.disconnect();
    },
  };
}
