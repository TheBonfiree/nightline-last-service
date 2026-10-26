/* ---------------------------------------------------------------------------
 * LedBoard.tsx — drives the panel renderer over the real DOM rows.
 *
 * The canvas does not own the layout. It measures it. Each line's position
 * comes from the actual `.service__line` box, because an expanded service
 * pushes everything below it down and because a late web font reflows the
 * rows — neither of which a computed layout would see. Measuring also means
 * the focus ring, the hover state and the hit area all stay on the real
 * button, exactly where they were.
 * ------------------------------------------------------------------------- */

import { useEffect, useRef } from 'react';
import { GLYPH, createLedPanel, type LedPanel, type PanelRow } from '../canvas/ledPanel';
import { SERVICES, type ServiceStatus } from '../data/tracks';

/* Field layout, declared in characters. The widest destination on the record
 * is "REPLACEMENT BUS SERVICE" at 23, and the panel is sized so it fits
 * rather than truncating — a board that clips its own longest service reads
 * as misconfigured rather than as authentic. */
const F = {
  plat: { chars: 2, col: 4 },
  dest: { chars: 23, col: 22 },
  time: { chars: 5, col: 168 },
  status: { chars: 11, col: 206 },
};
const COLUMNS = 276;

/* The panel runs only when a dot is big enough to read as a dot.
 *
 * This was a viewport media query at 769px, which was the wrong axis: the
 * constraint is pitch, and pitch is board width over COLUMNS. At an 800px
 * viewport the board is ~719px wide, which is 2.6 CSS px per column — the
 * same washed-out smear the 390px case was guarding against, waved through
 * because the viewport number happened to pass.
 *
 * 3.5px is the floor at which the lit dot and the unlit ghost behind it stay
 * distinguishable at dpr 1. Below it the rows stay as type: DotGothic16 is
 * already legible and already reads as a board, and a fainter, wronger
 * version of the effect is worse than none.
 *
 * The narrow layout also reflows each service onto two lines while the panel
 * draws exactly one, so the type fallback is required there regardless. */
const MIN_PITCH_PX = 3.5;
const MIN_PANEL_WIDTH = COLUMNS * MIN_PITCH_PX;

const TONE: Record<ServiceStatus, 'lit' | 'amber' | 'off'> = {
  'ON TIME': 'lit',
  BOARDING: 'amber',
  DELAYED: 'amber',
  CANCELLED: 'off',
};

function buildRows(expanded: number | null): PanelRow[] {
  return SERVICES.map((s, i) => ({
    key: String(s.plat),
    cells: [
      { text: String(s.plat), col: F.plat.col, width: F.plat.chars * GLYPH },
      { text: s.destination, col: F.dest.col, width: F.dest.chars * GLYPH },
      { text: s.time, col: F.time.col, width: F.time.chars * GLYPH, align: 'right' as const },
      {
        /* The selected service shows CALLING AT in place of its status, which
         * is what a real board does when you ask it about one departure — and
         * it is what gives the row something to mechanically roll to. */
        text: expanded === i ? 'CALLING AT' : s.status,
        col: F.status.col,
        width: F.status.chars * GLYPH,
        align: 'right' as const,
        tone: expanded === i ? ('amber' as const) : TONE[s.status],
      },
    ],
  }));
}

interface Props {
  listRef: React.RefObject<HTMLUListElement | null>;
  expandedIndex: number | null;
}

export function LedBoard({ listRef, expandedIndex }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<LedPanel | null>(null);
  /** Read inside build() so a rebuild picks up the row that is open now,
   *  rather than the one that was open when the component mounted. */
  const expandedRef = useRef(expandedIndex);
  expandedRef.current = expandedIndex;

  useEffect(() => {
    const canvas = canvasRef.current;
    const list = listRef.current;
    if (!canvas || !list) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const wideEnough = () => list.getBoundingClientRect().width >= MIN_PANEL_WIDTH;

    const css = getComputedStyle(document.documentElement);
    const v = (n: string, fallback: string) => css.getPropertyValue(n).trim() || fallback;

    let panel: LedPanel | null = null;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;

    const remeasure = () => {
      if (!panel) return;
      const lines = list.querySelectorAll<HTMLElement>('.service__line');
      if (!lines.length) return;
      const base = list.getBoundingClientRect().top;
      const tops: number[] = [];
      let lineHeight = 0;
      lines.forEach((el) => {
        const r = el.getBoundingClientRect();
        tops.push(r.top - base);
        lineHeight = r.height;
      });
      canvas.style.height = `${list.offsetHeight}px`;
      panel.setGeometry({ tops, lineHeight });
    };

    const teardown = () => {
      io?.disconnect();
      panel?.destroy();
      panel = null;
      panelRef.current = null;
      io = null;
      // Back to readable type. The rows must never be left transparent with
      // nothing drawing them.
      list.classList.remove('board__list--led');

      /* Wipe the canvas and give back the height remeasure() assigned.
       * Without this, narrowing past the threshold left the last desktop
       * frame painted underneath the now-visible DotGothic16 rows and the
       * board showed two overlapping tracklists. It never happened on a
       * fresh narrow load, only on a resize, a tablet rotation, or zooming
       * to 200% from a wide window — which is exactly the accessibility
       * path that must not break. */
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.height = '';
    };

    const build = () => {
      panel = createLedPanel({
        canvas,
        columns: COLUMNS,
        colors: {
          dim: v('--led-dim', '#1a2026'),
          lit: v('--led', '#e8eef2'),
          amber: v('--amber', '#ffa733'),
          off: v('--ink-off', '#6f7d87'),
        },
        /* Only now is it safe to hide the DOM text. If the canvas had failed
         * to get a context, or thrown, the board stays readable type instead
         * of becoming an empty black panel. */
        onFirstPaint: () => list.classList.add('board__list--led'),
      });
      panelRef.current = panel;

      panel.setInstant(reduced.matches);
      panel.setRows(buildRows(expandedRef.current));
      remeasure();
      if (!reduced.matches) panel.boot();

      // Nothing renders while the board is off screen.
      io = new IntersectionObserver(
        ([e]) => panel?.setActive(e.isIntersecting),
        { rootMargin: '200px' },
      );
      io.observe(list);
    };

    /* One observer does both jobs. The list resizes when a service expands,
     * when a font lands and when the window changes — none of which reliably
     * fires a window resize — and the same measurement decides whether the
     * panel should be running at all. */
    ro = new ResizeObserver(() => {
      const ok = wideEnough();
      if (ok && !panel) build();
      else if (!ok && panel) teardown();
      else remeasure();
    });
    ro.observe(list);

    const onReduced = () => {
      panel?.setInstant(reduced.matches);
      remeasure();
    };

    if (wideEnough()) build();
    reduced.addEventListener('change', onReduced);

    return () => {
      reduced.removeEventListener('change', onReduced);
      ro?.disconnect();
      ro = null;
      teardown();
    };
    // listRef is a stable ref object, and expandedIndex is applied by the
    // effect below so a row opening never tears the panel down and reboots it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    panelRef.current?.setRows(buildRows(expandedIndex));
  }, [expandedIndex]);

  return <canvas ref={canvasRef} className="board__led" aria-hidden="true" />;
}
