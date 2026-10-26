/* ---------------------------------------------------------------------------
 * TickerStrip.tsx — ambient device 3. The live service ticker at the base of
 * the board.
 *
 * The filmed hero proves the material; this proves the board is a display
 * rather than a picture of one. Same pitch, same amber, same ghost grid, but
 * the text is real and can say anything.
 *
 * Accessibility: the messages are NOT announced as they rotate. A live region
 * that fires every twenty seconds is hostile, and one that fires mid-sentence
 * is worse. Instead every message exists once, statically, in a
 * visually-hidden list a screen reader can read at its own pace.
 * ------------------------------------------------------------------------- */

import { useEffect, useRef } from 'react';
import { createMatrix, type MatrixController } from '../canvas/dotMatrix';
import { AMBIENT } from '../config';
import { TICKER_MESSAGES } from '../data/tracks';

/** Columns per second. A real station ticker takes the better part of ten
 *  seconds to cross its panel; anything much faster stops being readable and
 *  starts being a decorative smear. At the coarse pitch this strip uses, 18
 *  columns per second is roughly four seconds end to end. */
const SPEED = 18;

export function TickerStrip() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const styles = getComputedStyle(document.documentElement);
    const matrix: MatrixController = createMatrix({
      canvas,
      lit: styles.getPropertyValue('--amber').trim() || '#ffa733',
      dim: styles.getPropertyValue('--led-dim').trim() || '#1a2026',
      ground: '#000',
    });

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let index = 0;
    let raf = 0;
    let timer = 0;
    let startedAt = 0;

    matrix.setText(TICKER_MESSAGES[0]);

    const next = () => {
      index = (index + 1) % TICKER_MESSAGES.length;
      matrix.setText(TICKER_MESSAGES[index]);
      startedAt = performance.now();
    };

    /* Scrolling mode: the message travels right to left and the next one
     * follows it on when it has fully cleared the panel. The travel time is
     * the interval here — AMBIENT.messageIntervalMs governs the reduced-motion
     * swap below, where nothing moves and something has to decide the dwell. */
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const elapsed = (now - startedAt) / 1000;
      const cols = matrix.columnCount();
      const width = canvas.clientWidth;
      const pitch = canvas.clientHeight / 7;
      const runway = cols + Math.ceil(width / pitch);

      const travelled = elapsed * SPEED;
      matrix.setOffset(travelled - Math.ceil(width / pitch));

      if (travelled >= runway) next();
    };

    /* Reduced motion: nothing travels. The message is centred and swapped on
     * the interval, which is the same information without the movement. */
    const swap = () => {
      timer = window.setTimeout(() => {
        next();
        swap();
      }, AMBIENT.messageIntervalMs);
    };

    /** Whether the strip is anywhere near the viewport. */
    let visible = true;

    const stop = () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      raf = 0;
      timer = 0;
    };

    const apply = () => {
      stop();
      matrix.setCentred(reduced.matches);
      matrix.setText(TICKER_MESSAGES[index]);
      startedAt = performance.now();
      if (!visible) return;
      if (reduced.matches) swap();
      else raf = requestAnimationFrame(tick);
    };

    apply();
    reduced.addEventListener('change', apply);

    /* Unlike the board panel, this one legitimately needs a continuous loop —
     * it is a message physically travelling across a display. So it has to be
     * switched off by hand when nobody can see it: the hero is more than a
     * viewport tall, which means the ticker would otherwise animate at 60fps
     * for the entire time a visitor is reading the top of the page.
     *
     * Restarting resets the clock rather than resuming mid-travel, so a
     * message the visitor scrolled away from starts again from its beginning
     * instead of arriving already half gone. */
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting === visible) return;
        visible = e.isIntersecting;
        if (visible) apply();
        else stop();
      },
      { rootMargin: '120px' },
    );
    io.observe(canvas);

    return () => {
      reduced.removeEventListener('change', apply);
      io.disconnect();
      stop();
      matrix.destroy();
    };
  }, []);

  return (
    <div className="ticker">
      <canvas ref={canvasRef} className="ticker__canvas" aria-hidden="true" />
      <ul className="visually-hidden">
        {TICKER_MESSAGES.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
