/* ---------------------------------------------------------------------------
 * scrubSequence.ts — scroll-driven frame sequence on a canvas.
 *
 * Ported from the CARTA 60 build, with the loader removed.
 *
 * Why a frame sequence and not <video>:
 *   Setting video.currentTime forces the decoder to seek to the preceding
 *   keyframe and decode forward to the target on every scroll tick. Forward
 *   scrubbing is merely uneven; reverse scrubbing is pathological, because
 *   each step backwards re-decodes from an earlier keyframe. Pre-decoded
 *   frames blitted with drawImage() have no per-tick decode cost at all and
 *   reverse exactly as cheaply as they advance. Safari and mobile are where
 *   this difference stops being academic.
 *
 * Why no loader:
 *   entry.md's argument holds here — the board renders its rows before a
 *   single frame downloads, so a gate would be a tax paid on every visit for
 *   nothing. Frames stream in behind the already-usable page, and a frame
 *   that has not arrived coarsens the scrub rather than punching a hole in
 *   it.
 * ------------------------------------------------------------------------- */

export interface ScrubController {
  /** 0..1 along the sequence. Coalesced to one paint per animation frame. */
  setProgress(p: number): void;
  /** Paint one specific frame immediately. Used for the reduced-motion still. */
  showFrame(i: number): void;
  resize(): void;
  destroy(): void;
}

interface Options {
  canvas: HTMLCanvasElement;
  count: number;
  src: (i: number) => string;
  /** Painted behind the letterboxed frame. The panel ground, so the
   *  letterbox is invisible rather than a grey band. */
  background: string;
}

function decodeImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    // decode() is a genuine "ready to paint" signal; onload alone can still
    // leave the first drawImage() paying decode cost on the main thread.
    if (img.decode) {
      img.decode().then(() => resolve(img)).catch(() => resolve(img.complete ? img : null));
    } else {
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    }
  });
}

export function createScrub({ canvas, count, src, background }: Options): ScrubController {
  const ctx = canvas.getContext('2d', { alpha: false });
  /** Sparse: holes are frames that have not arrived or failed. */
  const frames: (HTMLImageElement | undefined)[] = [];

  let current = -1;   // last index actually painted
  let target = 0;     // index the scroll position asks for
  let queued = false;
  let alive = true;

  /** Nearest frame that actually decoded. A missing frame coarsens the scrub
   *  instead of blanking the strip. */
  function nearest(i: number): HTMLImageElement | null {
    if (frames[i]) return frames[i]!;
    for (let d = 1; d < count; d++) {
      if (frames[i - d]) return frames[i - d]!;
      if (frames[i + d]) return frames[i + d]!;
    }
    return null;
  }

  function draw() {
    queued = false;
    if (!ctx || !alive) return;
    const img = nearest(target);
    if (!img) return;
    // Repaint on a size change even when the index has not moved.
    if (target === current && canvas.dataset.painted === String(canvas.width)) return;
    current = target;
    canvas.dataset.painted = String(canvas.width);

    const cw = canvas.width;
    const ch = canvas.height;
    // Cover, not contain: the strip is a window onto a longer sign, so
    // cropping the ends is correct and letterboxing would expose the panel.
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  function requestDraw() {
    if (!queued) {
      queued = true;
      requestAnimationFrame(draw);
    }
  }

  function resize() {
    // Cap DPR at 2 — beyond that the extra pixels cost fill rate and buy
    // nothing visible, least of all on a source that is mostly flat black.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    requestDraw();
  }

  // Stream every frame in parallel. No gate, no progress bar, no ceiling to
  // hang on: whatever arrives improves the scrub, and what does not arrive
  // is simply skipped by nearest().
  for (let i = 0; i < count; i++) {
    decodeImage(src(i)).then((img) => {
      if (!alive || !img) return;
      frames[i] = img;
      // The first frame to land must paint, or the strip stays black until
      // the visitor happens to scroll.
      if (current === -1) requestDraw();
    });
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
    setProgress(p) {
      target = Math.min(count - 1, Math.max(0, Math.round(p * (count - 1))));
      requestDraw();
    },
    showFrame(i) {
      target = Math.min(count - 1, Math.max(0, i));
      requestDraw();
    },
    resize,
    destroy() {
      alive = false;
      ro.disconnect();
    },
  };
}
