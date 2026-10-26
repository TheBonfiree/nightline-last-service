/* ---------------------------------------------------------------------------
 * PlainLayer.tsx — the escape hatch's second art direction.
 *
 * The register's entry fee. Four rules make it work rather than merely exist:
 *
 *   Both directions   — a one-way exit tells the visitor the concept was a
 *                       hazard. The header carries the way back.
 *   Same content      — every service on the board is here, credits and all,
 *                       plus the two things the fiction has no honest place
 *                       for: the streaming links and the biography.
 *   Offered in-world  — the ticker advertises it as a large print timetable.
 *   Sticky            — the choice is remembered, in App.
 * ------------------------------------------------------------------------- */

import { BRAND } from '../config';
import { SERVICES } from '../data/tracks';

const STATE_LABEL: Record<string, string> = {
  'ON TIME': 'Out now',
  BOARDING: 'Single',
  DELAYED: 'Unreleased',
  CANCELLED: 'Cut',
};

const LINKS = [
  { name: 'Streaming', note: 'All platforms', href: '#' },
  { name: 'Vinyl', note: 'Limited pressing of 500', href: '#' },
  { name: 'Live dates', note: 'Six shows, spring', href: '#' },
  { name: 'Contact', note: 'Booking and press', href: '#' },
];

export function PlainLayer({ onReturn }: { onReturn: () => void }) {
  return (
    <div className="plain">
      <header className="plain__head">
        <p className="plain__wordmark">{BRAND.artist}</p>
        <button type="button" className="plain__back" onClick={onReturn}>
          Return to platform display
        </button>
      </header>

      <main className="plain__body">
        <h1 className="plain__display">{BRAND.release}</h1>
        <p className="plain__standfirst">
          Ten tracks about the last train and the people who are not on it.
          Recorded between Coldharbour and a stationary carriage outside
          Banbury.
        </p>

        <h2 className="plain__h2">Tracklist</h2>
        <ol className="plain__tracks">
          {SERVICES.map((s) => (
            <li className="plain__track" key={s.plat}>
              <span className="plain__num">{s.plat}</span>
              <div>
                <h3 className="plain__name">
                  {s.destination}
                  <span className="plain__state">{STATE_LABEL[s.status]}</span>
                </h3>
                <p className="plain__note">{s.note}</p>
                <ul className="plain__credits">
                  {s.callingAt.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </div>
              <span className="plain__dur">{s.time}</span>
            </li>
          ))}
        </ol>

        <h2 className="plain__h2">Listen</h2>
        <div className="plain__links">
          {LINKS.map((l) => (
            <a className="plain__link" href={l.href} key={l.name}>
              {l.name}
              <span>{l.note}</span>
            </a>
          ))}
        </div>

        <h2 className="plain__h2">About</h2>
        <div className="plain__prose">
          <p>
            NIGHTLINE is R. Vane, Ada Foss and J. Okonjo. They have been
            playing together since a cancelled service left the three of them
            on the same platform for four hours, which is either true or the
            kind of thing a band says.
          </p>
          <p>
            <em>Last Service</em> was written on the 23:50 and recorded in
            eleven days. One track was cut and is listed anyway.
          </p>
        </div>

        <h2 className="plain__h2">About this site</h2>
        <div className="plain__prose">
          <p>
            The other version of this page is a station departure board. It is
            a deliberate concept, not a novelty: a tracklist is a timetable,
            so it is printed on the screen that already knows how to show one.
            This version exists because a concept that cannot be opted out of
            is an obstacle.
          </p>
        </div>
      </main>
    </div>
  );
}
