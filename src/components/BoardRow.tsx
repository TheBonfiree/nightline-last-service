/* ---------------------------------------------------------------------------
 * BoardRow.tsx — one service.
 *
 * The row is a <button>, not a link: it expands something in place, it does
 * not navigate. It carries aria-expanded and aria-controls, so the expansion
 * is announced as what it is rather than as content appearing from nowhere.
 *
 * The expansion is a region, not a dialog. The board is never modal, so focus
 * is never trapped — the visitor must always be able to tab out to the rest
 * of the station.
 * ------------------------------------------------------------------------- */

import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../config';
import { StatusCell } from './StatusCell';
import type { Service } from '../data/tracks';

/** Open matches the panel's mechanical roll exactly: seven dot-rows at 34ms.
 *  Selecting a service is one action and both halves of it now take the same
 *  time. The close is faster, as exits should be, and Board unmounts the
 *  region on the same beat. */
const OPEN_MS = 238;
const CLOSE_MS = 150;

interface Props {
  service: Service;
  expanded: boolean;
  /** Still mounted, but on its way out. */
  closing?: boolean;
  rowProps: { ref: (el: HTMLElement | null) => void; tabIndex: number };
  onToggle: () => void;
  onFocus: () => void;
}

export function BoardRow({ service, expanded, closing = false, rowProps, onToggle, onFocus }: Props) {
  const panelId = `calling-${service.plat}`;
  const labelId = `dest-${service.plat}`;

  /* Height, animated imperatively.
   *
   * Two declarative routes were tried first and neither ran. `@starting-style`
   * pinned the region at its starting value. `grid-template-rows: 0fr -> 1fr`
   * jumped straight to the end — confirmed in an isolated test outside this
   * component, where a 400ms linear transition still produced a one-frame
   * 0 -> 100px change. So the height is measured and animated directly.
   *
   * `height: auto` is restored once open, so a font landing late or the copy
   * changing does not leave the region locked to a stale pixel value. */
  const wrapRef = useRef<HTMLDivElement>(null);
  /** The animation currently owning this element's height. */
  const animRef = useRef<Animation | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    const inner = el?.firstElementChild as HTMLElement | undefined;
    if (!el || !inner) return;

    // Whatever was running loses ownership immediately, so a fast
    // open-close-open cannot leave two animations fighting over one height.
    animRef.current?.cancel();
    animRef.current = null;

    if (prefersReducedMotion()) {
      el.style.height = expanded ? 'auto' : '0px';
      return;
    }

    const from = el.getBoundingClientRect().height;
    // Measure against the content box, which is correct even while the
    // wrapper is clipped to zero.
    const to = expanded ? inner.getBoundingClientRect().height : 0;

    el.style.height = `${from}px`;
    const anim = el.animate(
      [{ height: `${from}px` }, { height: `${to}px` }],
      {
        duration: expanded ? OPEN_MS : CLOSE_MS,
        // Confident arrival, no bounce: the board is machinery.
        easing: 'cubic-bezier(.3, 0, 0, 1)',
      },
    );
    animRef.current = anim;

    anim.onfinish = () => {
      // Only the animation that still owns the element may write the final
      // value. A superseded one would otherwise stomp a newer state.
      if (animRef.current !== anim) return;
      animRef.current = null;
      // `auto` rather than a pixel value, so a late font or changed copy does
      // not leave the region locked to a stale height.
      el.style.height = expanded ? 'auto' : '0px';
    };
  }, [expanded]);

  return (
    <li className="service">
      <button
        type="button"
        className="service__line"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        onFocus={onFocus}
        ref={rowProps.ref as React.Ref<HTMLButtonElement>}
        tabIndex={rowProps.tabIndex}
      >
        <span className="service__plat">{service.plat}</span>
        <span className="service__dest" id={labelId}>{service.destination}</span>
        <span className="service__time">{service.time}</span>
        <StatusCell status={service.status} />
      </button>

      {/* Mounted while open OR closing. An always-present hidden panel would
          put ten collapsed regions in the accessibility tree for no gain, but
          unmounting on the same tick as the collapse would skip the exit.

          The outer element animates grid-template-rows 0fr -> 1fr; the inner
          one carries the padding and the overflow clip, because padding on
          the animating box would stop it collapsing to nothing. */}
      {(expanded || closing) && (
        <div
          className="service__calling"
          ref={wrapRef}
          id={panelId}
          role="region"
          aria-labelledby={labelId}
          // Out of the tab order and out of the a11y tree the moment it starts
          // closing, so it is never a region a keyboard user can land inside.
          aria-hidden={!expanded || undefined}
        >
          <div className="service__calling-inner">
            <h3 className="visually-hidden">Calling points</h3>
            <ul className="service__points">
              {service.callingAt.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="service__note">{service.note}</p>
          </div>
        </div>
      )}
    </li>
  );
}
