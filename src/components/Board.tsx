/* ---------------------------------------------------------------------------
 * Board.tsx — the departure board.
 *
 * Keyboard contract, which is the part that has to be right:
 *
 *   Tab          enters the list once. Ten services are one tab stop.
 *   Up / Down    move the selection, clamped at both ends.
 *   Home / End   first and last service.
 *   Enter/Space  expand or collapse the selected service (native <button>).
 *   Escape       collapse the open service.
 *   T            open the plain timetable, as the ticker advertises.
 *
 * Escape and T are bound on the section rather than on the window, so they
 * do not fire while the visitor is in the plain layer or has focus somewhere
 * else on the page.
 * ------------------------------------------------------------------------- */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AMBIENT, BRAND, prefersReducedMotion } from '../config';
import { SERVICES } from '../data/tracks';
import { boardReducer, initialBoardState } from '../state/boardReducer';
import { useRovingTabIndex } from '../a11y/useRovingTabIndex';
import { BoardRow } from './BoardRow';
import { LedBoard } from './LedBoard';
import { chimeEnabled, playChime, setChimeEnabled } from '../audio/chime';
import { IdlePattern } from './IdlePattern';
import { StationClock } from './StationClock';
import { TickerStrip } from './TickerStrip';

/** Must match --calling-close in board.css. The region is unmounted on this
 *  beat, so a shorter value here would cut the exit off mid-animation. */
const CLOSE_MS = 150;

export function Board({ onLeave }: { onLeave: () => void }) {
  const [state, dispatch] = useReducer(boardReducer, initialBoardState);
  const { containerProps, rowProps } = useRovingTabIndex(state.focusIndex, SERVICES.length);
  const count = SERVICES.length;
  /* -1 so the first increment lands on variant 0. Starting at 0 showed the
   * second pattern first, which is only ever noticeable to whoever wrote
   * the first one. */
  const variant = useRef(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const [chime, setChime] = useState(chimeEnabled);

  /* The chime is punctuation on a state change that is already complete
   * without it, so it rides along with the toggle rather than gating it. */
  const toggleService = useCallback((i: number) => {
    dispatch({ type: 'toggle', index: i });
    playChime();
  }, []);

  const toggleChime = useCallback(() => {
    setChime((on) => {
      const next = !on;
      setChimeEnabled(next);
      // Sound the thing being switched on, from inside the click that
      // switched it — which is also the user gesture the AudioContext needs.
      if (next) playChime();
      return next;
    });
  }, []);

  /* --- Retiring a closing row -------------------------------------------
   * The exit is 150ms of CSS; this unmounts the region once that has run.
   * Under reduced motion there is no transition to wait for, so it goes
   * immediately. */
  useEffect(() => {
    if (state.closingIndex === null) return;
    const index = state.closingIndex;
    const wait = prefersReducedMotion() ? 0 : CLOSE_MS;
    const id = window.setTimeout(() => dispatch({ type: 'closed', index }), wait);
    return () => window.clearTimeout(id);
  }, [state.closingIndex]);

  /* --- Ambient device 5: the idle timer ---------------------------------- */
  useEffect(() => {
    if (prefersReducedMotion()) return; // never arms at all

    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        variant.current = (variant.current + 1) % AMBIENT.idleVariants;
        dispatch({ type: 'idleIn', variant: variant.current });
      }, AMBIENT.idleAfterMs);
    };

    const wake = () => {
      dispatch({ type: 'idleOut' });
      arm();
    };

    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    arm();

    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, []);

  /* --- The T shortcut ------------------------------------------------------
   * Bound to the document, not to the board section. The ticker tells the
   * visitor to "PRESS T", and a shortcut that silently stops working once
   * focus leaves one subtree is worse than no shortcut: tabbing past the last
   * service lands focus on <body>, where a section-scoped handler never
   * fires. Guarded against text entry so it stays safe if a field is ever
   * added. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 't' && e.key !== 'T') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? '')) return;
      e.preventDefault();
      onLeave();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onLeave]);

  /* --- Keyboard ---------------------------------------------------------- */
  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); dispatch({ type: 'move', delta: 1, count }); break;
      case 'ArrowUp':   e.preventDefault(); dispatch({ type: 'move', delta: -1, count }); break;
      case 'Home':      e.preventDefault(); dispatch({ type: 'jump', to: 'first', count }); break;
      case 'End':       e.preventDefault(); dispatch({ type: 'jump', to: 'last', count }); break;
      case 'Escape':
        if (state.expandedIndex !== null) { e.preventDefault(); dispatch({ type: 'collapse' }); }
        break;
    }
  };

  return (
    <section className="station" onKeyDown={onKeyDown} aria-labelledby="board-h">
      <div className="canopy">
        <span className="canopy__mark">{BRAND.artist}</span>
        <span>{BRAND.station} &mdash; departures</span>
      </div>

      <div className="board">
        {/* Decoration. Neither is in the accessibility tree. */}
        <div className="board__grid matrix-grid" aria-hidden="true" />
        <div className="board__acrylic" aria-hidden="true" />

        <div className="board__inner">
          <div className="board__head">
            <h2 id="board-h" className="board__title">
              {BRAND.release}
              <span className="board__sub"> &mdash; ten services</span>
            </h2>
            <StationClock />
            {/* Grouped so the two controls wrap together as a unit. Left as
                four loose flex children, a narrow header broke onto three
                lines and pushed the board most of a screen down. */}
            <div className="board__controls">
              {/* Off by default, persisted, and nothing on the page depends on
                  hearing it. The label states the current state, not the
                  action, because that is what a station switch would read. */}
              <button
                type="button"
                className="notice"
                aria-pressed={chime}
                onClick={toggleChime}
              >
                {/* The state word is for the eye only. aria-pressed already
                    carries the state, and leaving both in the accessible name
                    announces it twice — "PA chime on, pressed". */}
                PA chime{' '}
                <span aria-hidden="true" className={chime ? 'notice__on' : undefined}>
                  {chime ? 'on' : 'off'}
                </span>
              </button>
              {/* The escape hatch, offered inside the fiction as a station
                  notice rather than as a grey "accessible version" button. */}
              <button type="button" className="notice" onClick={onLeave}>
                Large print timetable <kbd>T</kbd>
              </button>
            </div>
          </div>

          <div className="board__cols" aria-hidden="true">
            <span>Plat</span><span>Destination</span><span>Time</span><span>Expected</span>
          </div>

          {/* The panel wrapper is the canvas's positioning context. Without
              it the canvas resolves against .board and every rendered line
              lands one header-height too high. */}
          <div className="board__panel">
          <ul className="board__list" ref={listRef} {...containerProps}>
            {SERVICES.map((s, i) => (
              <BoardRow
                key={s.plat}
                service={s}
                expanded={state.expandedIndex === i}
                closing={state.closingIndex === i}
                rowProps={rowProps(i)}
                onToggle={() => toggleService(i)}
                onFocus={() => dispatch({ type: 'focus', index: i })}
              />
            ))}
          </ul>

          {/* Painted over the list above. The rows underneath keep their text,
              their focus rings and their hit areas; this only replaces how
              they look. */}
          <LedBoard listRef={listRef} expandedIndex={state.expandedIndex} />
          </div>

          <TickerStrip />
        </div>

        {state.idle && <IdlePattern variant={state.idleVariant} />}
      </div>
    </section>
  );
}
