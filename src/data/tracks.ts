/* ---------------------------------------------------------------------------
 * tracks.ts — the record, expressed as a timetable.
 *
 * NIGHTLINE and "Last Service" are invented. No real artist, label, artwork
 * or catalogue number appears anywhere in this project.
 *
 * The column mapping is the whole concept and is not decorative:
 *
 *   PLAT         track number
 *   DESTINATION  title
 *   TIME         runtime
 *   EXPECTED     release state
 *   calling at   credits
 *
 * `CANCELLED` is a track cut from the record, listed anyway. A real board
 * shows a cancelled service rather than hiding it, and that is the detail
 * that proves the metaphor carries weight instead of being applied on top.
 * ------------------------------------------------------------------------- */

export type ServiceStatus =
  | 'ON TIME'    // out now
  | 'BOARDING'   // the current single
  | 'DELAYED'    // written, not yet released
  | 'CANCELLED'; // cut from the record

export interface Service {
  /** Track number. Displayed in the PLAT column. */
  plat: number;
  /** Track title. Displayed in the DESTINATION column. */
  destination: string;
  /** Runtime as m:ss. Displayed in the TIME column. */
  time: string;
  status: ServiceStatus;
  /** Credits, shown as calling points when the row expands. */
  callingAt: string[];
  /** One line of prose about the track. Present in the HTML, so it survives
   *  with JavaScript off. */
  note: string;
}

export const SERVICES: Service[] = [
  {
    plat: 1,
    destination: 'MARYLEBONE',
    time: '4:12',
    status: 'ON TIME',
    callingAt: ['Written by R. Vane', 'Drums — Ada Foss', 'Mixed at Coldharbour'],
    note: 'Opens the record on a platform announcement sampled at 04:40 and never cleaned up.',
  },
  {
    plat: 2,
    destination: 'THE LONG WAY ROUND',
    time: '3:48',
    status: 'ON TIME',
    callingAt: ['Written by R. Vane, J. Okonjo', 'Bass — J. Okonjo', 'Strings — The Sidings Quartet'],
    note: 'Three verses that each take a different route to the same chorus.',
  },
  {
    plat: 3,
    destination: 'COACH D',
    time: '5:31',
    status: 'BOARDING',
    callingAt: ['Written by R. Vane', 'Featuring MERIDIAN', 'Produced by Halt Sign'],
    note: 'The single. Recorded in one take in a stationary carriage outside Banbury.',
  },
  {
    plat: 4,
    destination: 'SODIUM LIGHT',
    time: '3:07',
    status: 'ON TIME',
    callingAt: ['Written by A. Foss', 'Synths — R. Vane', 'Mixed at Coldharbour'],
    note: 'Named for the orange lamps that were replaced everywhere while the record was being made.',
  },
  {
    plat: 5,
    destination: 'NOBODY MEETS THE 23:50',
    time: '6:02',
    status: 'ON TIME',
    callingAt: ['Written by R. Vane', 'Piano — Elin Marsh', 'Field recording — Crewe, February'],
    note: 'The longest thing on the record and the only one with no drums.',
  },
  {
    plat: 6,
    destination: 'REPLACEMENT BUS SERVICE',
    time: '2:55',
    status: 'DELAYED',
    callingAt: ['Written by J. Okonjo', 'Guitar — R. Vane', 'Unmastered'],
    note: 'Finished, held back. It arrives when the rest of the line reopens.',
  },
  {
    plat: 7,
    destination: 'ALL STATIONS TO YOURS',
    time: '4:40',
    status: 'DELAYED',
    callingAt: ['Written by R. Vane', 'Featuring Elin Marsh', 'Produced by Halt Sign'],
    note: 'The slow one. Stops everywhere, which is the point.',
  },
  {
    plat: 8,
    destination: 'TERMINUS',
    time: '7:18',
    status: 'ON TIME',
    callingAt: ['Written by R. Vane, A. Foss', 'Drums — Ada Foss', 'Mixed at Coldharbour'],
    note: 'Ends with four minutes of the room the record was made in.',
  },
  {
    plat: 9,
    destination: 'GHOST TRAIN',
    time: '3:22',
    status: 'CANCELLED',
    callingAt: ['Written by R. Vane', 'Cut from the final sequence'],
    note: 'Kept on the board because it was on the board. Some services run once a year and then stop.',
  },
  {
    plat: 10,
    destination: 'LAST SERVICE (REPRISE)',
    time: '1:44',
    status: 'ON TIME',
    callingAt: ['Written by R. Vane', 'Voice — the 23:50 announcer'],
    note: 'Forty seconds of the first track, played back through the station PA.',
  },
];

/* Rotating service messages for the live ticker. Device 3 of the ambient
 * budget. The first is the self-declaration; the escape-hatch offer is
 * pinned in the rotation rather than buried, because the register requires
 * the plain reading to be offered inside the fiction. */
export const TICKER_MESSAGES: string[] = [
  'NIGHTLINE — LAST SERVICE. YES, IT IS A DEPARTURE BOARD. A TRACKLIST IS A TIMETABLE; WE JUST PRINTED IT ON THE RIGHT SCREEN.',
  'LARGE PRINT TIMETABLE AVAILABLE — PRESS T',
  'THE 23:50 SERVICE TO MARYLEBONE IS THE LAST SERVICE OF THE DAY',
  'PLEASE DO NOT LEAVE YOUR RECORD UNATTENDED',
  'CANCELLED SERVICES REMAIN ON THIS BOARD UNTIL THE END OF THE TIMETABLE',
  'I WANNA BE YOURS',
  'USE ARROW KEYS TO MOVE BETWEEN SERVICES — ENTER FOR CALLING POINTS',
];

/* Device 5: the idle test pattern. Two variants, per the budget. */
export const IDLE_PATTERNS: string[] = [
  'NO DEPARTURES — PLATFORM CLOSED',
  'THIS DISPLAY IS UNDERGOING ROUTINE MAINTENANCE',
];
