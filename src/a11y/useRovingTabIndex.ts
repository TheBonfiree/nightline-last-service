/* ---------------------------------------------------------------------------
 * useRovingTabIndex.ts
 *
 * Ten services must be one tab stop, not ten. The list owns a single
 * `tabindex="0"` which travels with the selection; every other row is -1 and
 * is reached with the arrow keys.
 *
 * Focus is only moved programmatically when the visitor is already inside the
 * list. Moving it on the first render would steal focus from the page on
 * load, and moving it after a mouse click would fight the browser.
 * ------------------------------------------------------------------------- */

import { useEffect, useRef } from 'react';

export function useRovingTabIndex(focusIndex: number, count: number) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  /** Whether focus currently lives inside the list. */
  const inside = useRef(false);

  const register = (i: number) => (el: HTMLElement | null) => {
    refs.current[i] = el;
  };

  useEffect(() => {
    if (!inside.current) return;
    refs.current[focusIndex]?.focus();
  }, [focusIndex]);

  /** Attach to the list container, not to each row. */
  const containerProps = {
    onFocus: () => { inside.current = true; },
    onBlur: (e: React.FocusEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) inside.current = false;
    },
  };

  const rowProps = (i: number) => ({
    ref: register(i),
    tabIndex: i === focusIndex ? 0 : -1,
  });

  return { containerProps, rowProps, count };
}
