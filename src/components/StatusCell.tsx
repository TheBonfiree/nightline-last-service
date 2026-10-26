/* ---------------------------------------------------------------------------
 * StatusCell.tsx — the EXPECTED column.
 *
 * There is no flicker animation here any more. The panel renderer now scrolls
 * the whole row mechanically when its content changes, which is both what a
 * real board does and a far better version of the same idea; two competing
 * treatments of one state change is exactly the "layered extraordinary
 * moments" that turns focus into noise.
 *
 * The status word is aria-hidden and paired with a plain-English meaning, so
 * the timetable conceit never becomes the only way to understand the state.
 * ------------------------------------------------------------------------- */

import type { ServiceStatus } from '../data/tracks';

const CLASS: Record<ServiceStatus, string> = {
  'ON TIME': 'status--on-time',
  BOARDING: 'status--boarding',
  DELAYED: 'status--delayed',
  CANCELLED: 'status--cancelled',
};

/** What the status actually means, for anyone who did not come here for the
 *  conceit. Read by screen readers in place of the board's own word. */
const MEANING: Record<ServiceStatus, string> = {
  'ON TIME': 'Out now',
  BOARDING: 'Current single',
  DELAYED: 'Not yet released',
  CANCELLED: 'Cut from the record',
};

export function StatusCell({ status }: { status: ServiceStatus }) {
  return (
    <span className={`service__status ${CLASS[status]}`}>
      <span aria-hidden="true">{status}</span>
      <span className="visually-hidden">{MEANING[status]}</span>
    </span>
  );
}
