/* ---------------------------------------------------------------------------
 * HeroTicker.tsx — ambient device 2, and the reason this project exists.
 *
 * The filmed sign, with its playback driven by scroll position instead of by
 * time. A tall section provides the scroll distance; a sticky inner panel
 * holds the strip in view while the frames advance under it.
 *
 * Under reduced motion the section collapses to a single viewport and paints
 * one still: the frame at the phrase's most legible point, not frame 0000 and
 * not a slowed scrub.
 * ------------------------------------------------------------------------- */

import { useEffect, useRef } from 'react';
import { createScrub, type ScrubController } from '../canvas/scrubSequence';
import { peakFrameIndex, tickerCount, tickerSrc } from '../config';

export function HeroTicker() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    const scrub: ScrubController = createScrub({
      canvas,
      count: tickerCount(),
      src: tickerSrc,
      background: '#000',
    });

    // Branch in JavaScript. The scrub lives in a scroll handler and a CSS
    // media query never sees it.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const { top, height } = section.getBoundingClientRect();
        // 0 when the section's top reaches the viewport top, 1 when its
        // bottom does. Clamped, so overscroll does not run past the end.
        const travel = height - window.innerHeight;
        const p = travel > 0 ? Math.min(1, Math.max(0, -top / travel)) : 0;
        scrub.setProgress(p);
      });
    };

    const apply = () => {
      if (reduced.matches) {
        window.removeEventListener('scroll', onScroll);
        section.classList.add('hero--static');
        scrub.showFrame(peakFrameIndex());
      } else {
        section.classList.remove('hero--static');
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      }
    };

    apply();
    reduced.addEventListener('change', apply);

    return () => {
      reduced.removeEventListener('change', apply);
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
      scrub.destroy();
    };
  }, []);

  return (
    <section ref={sectionRef} className="hero" aria-labelledby="hero-h">
      <div className="hero__stick">
        <h1 id="hero-h" className="hero__h1">
          Last Service
        </h1>

        {/* The strip is decoration carrying one sentence of copy. That
            sentence is in the DOM above it, so nothing here needs reading. */}
        <div className="ticker ticker--hero">
          <canvas ref={canvasRef} className="ticker__canvas" aria-hidden="true" />
        </div>

        <p className="hero__note">
          Nightline&rsquo;s overnight services. A tracklist is a timetable, so
          this one is printed on the screen that already knows how to show
          one. Scroll for departures.
        </p>
      </div>
    </section>
  );
}
