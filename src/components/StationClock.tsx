/* ---------------------------------------------------------------------------
 * StationClock.tsx — ambient device 1.
 *
 * Real time, ticking, in the board header. It keeps ticking under reduced
 * motion: a clock is information, and freezing it would make the board look
 * broken rather than calm.
 *
 * Tabular numerals and a fixed 8-character string mean the header never
 * reflows on a tick.
 * ------------------------------------------------------------------------- */

import { useEffect, useState } from 'react';
import { AMBIENT } from '../config';

const pad = (n: number) => String(n).padStart(2, '0');
const format = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export function StationClock() {
  const [now, setNow] = useState(() => format(new Date()));

  useEffect(() => {
    const id = window.setInterval(() => setNow(format(new Date())), AMBIENT.clockTickMs);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time className="clock" aria-label={`Current time ${now}`}>
      {now}
    </time>
  );
}
