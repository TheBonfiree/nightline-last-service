/* ---------------------------------------------------------------------------
 * App.tsx — one closed world.
 *
 * No router. The artifact and the plain layer are two states of one document,
 * because a page transition breaking mid-fiction is exactly what the register
 * cannot survive. The URL follows with history.replaceState so a link is
 * shareable, but nothing navigates.
 *
 * The choice is sticky: a visitor who asked for the plain timetable gets it
 * again next time without having to ask twice.
 * ------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { STORAGE_KEY, prefersReducedMotion } from './config';
import { Board } from './components/Board';
import { Loader } from './components/Loader';
import { HeroTicker } from './components/HeroTicker';
import { PlainLayer } from './components/PlainLayer';
import './styles/tokens.css';
import './styles/board.css';
import './styles/hero.css';
import './styles/loader.css';
import './styles/plain.css';

type Layer = 'board' | 'plain';

/** A URL fragment wins over the stored preference, so a shared link lands
 *  where the sharer meant it to. localStorage may throw in private modes. */
function initialLayer(): Layer {
  if (window.location.hash === '#timetable') return 'plain';
  try {
    return localStorage.getItem(STORAGE_KEY) === 'plain' ? 'plain' : 'board';
  } catch {
    return 'board';
  }
}

export default function App() {
  const [layer, setLayer] = useState<Layer>(initialLayer);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, layer); } catch { /* private mode */ }
    history.replaceState(null, '', layer === 'plain' ? '#timetable' : ' ');
  }, [layer]);

  /* Switching layers is the only navigation this page has, and it used to
   * teleport: the whole document was replaced on one tick and the scroll
   * jumped to the top with nothing to explain either.
   *
   * A view transition gives it a cause. The board is an LED panel, so it does
   * not cross-fade — it loses power, fast, and the printed timetable is what
   * is behind it. See the ::view-transition rules in tokens.css.
   *
   * flushSync is required: startViewTransition snapshots the DOM when its
   * callback returns, and React's default batching would still be holding the
   * update at that point, producing a transition from one state to itself. */
  const go = useCallback((next: Layer) => {
    const apply = () => {
      setLayer(next);
      // Inside the callback so the new scroll position is part of the
      // captured end state rather than a jump after it.
      window.scrollTo(0, 0);
    };

    // No API, or the visitor asked for less motion: switch plainly. The
    // destination is identical either way.
    if (!document.startViewTransition || prefersReducedMotion()) {
      apply();
      return;
    }
    document.startViewTransition(() => flushSync(apply));
  }, []);

  const toPlain = useCallback(() => go('plain'), [go]);
  const toBoard = useCallback(() => go('board'), [go]);

  /* The gate is a sibling of the content, never a wrapper around it. The
   * page renders and is readable underneath from the first paint, so a script
   * that throws leaves a working site rather than a black rectangle. */
  if (layer === 'plain') return <><Loader /><PlainLayer onReturn={toBoard} /></>;

  /* A <main> around both sections. The plain layer already had one, and a
   * landmark that exists on only one of two layers is worse than none: it
   * makes the artifact look like the version where structure was optional. */
  return (
    <>
      <Loader />
      <main>
        <HeroTicker />
        <Board onLeave={toPlain} />
      </main>
    </>
  );
}
