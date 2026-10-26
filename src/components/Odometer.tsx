/* ---------------------------------------------------------------------------
 * Odometer.tsx — a counting readout whose digits roll.
 *
 * Two stacked digits per column in an overflow-hidden box, moved by
 * translateY. Two details carry it, and both are easy to leave out:
 *
 *   - `width: 1ch` on the column, so the readout does not jitter sideways as
 *     the digits change. It needs a monospaced face or tabular numerals; on a
 *     proportional face the whole number shifts on every tick and the effect
 *     is worse than plain text. VT323 is monospaced, which is why the machine
 *     voice owns this role.
 *   - `letter-spacing: 0` locally. The surrounding machine type is tracked,
 *     and tracking inside a 1ch box breaks the alignment it depends on.
 *
 * Reduced motion writes the value straight in with no roll.
 * ------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../config';

interface Props {
  value: number;
  /** Fixed column count, so the readout never changes width as it counts. */
  digits?: number;
}

function Column({ digit }: { digit: string }) {
  const [prev, setPrev] = useState(digit);
  const [rolling, setRolling] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    if (digit === prev) return;
    if (prefersReducedMotion()) { setPrev(digit); return; }
    setRolling(true);
    // Land the new digit and drop the outgoing one once the roll has run.
    const id = window.setTimeout(() => { setPrev(digit); setRolling(false); }, 260);
    return () => window.clearTimeout(id);
  }, [digit, prev]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <span className={`roll-col${rolling ? ' is-rolling' : ''}`}>
      <span className="roll-num">{prev}</span>
      <span className="roll-num">{digit}</span>
    </span>
  );
}

export function Odometer({ value, digits = 3 }: Props) {
  const text = String(Math.max(0, Math.round(value))).padStart(digits, '0');
  return (
    <span className="roll" role="presentation">
      {[...text].map((d, i) => <Column key={i} digit={d} />)}
    </span>
  );
}
