# NIGHTLINE — Last Service

A music release page built as a railway departure board.

The register is DIEGETIC: the page does not present the record, it *is* the
display a station would show it on. That only works because the mapping is
structural rather than decorative —

| Board column | Carries |
| --- | --- |
| `PLAT` | track number |
| `DESTINATION` | title |
| `TIME` | runtime |
| `EXPECTED` | release state |
| calling points | credits |

`CANCELLED` is a track cut from the record, listed anyway, because a real
board shows a cancelled service rather than hiding it.

NIGHTLINE, *Last Service* and everyone credited on it are invented. No real
artist, label, artwork or catalogue number appears anywhere in this project.

## The escape hatch

Not optional in this register. The ticker advertises a **large print
timetable** (or press <kbd>T</kbd>), which switches to a complete second art
direction: a conventional release page with the same content plus the
streaming links and the biography. Its header returns to the board. The
choice is remembered in `localStorage` and `#timetable` links straight to it.

## Running it

```bash
npm install
npm run dev
npm run build
```

## The ticker frames

The hero strip is a scroll-driven frame sequence, not a `<video>`: setting
`video.currentTime` makes the decoder seek to the preceding keyframe on every
scroll tick, which is uneven forwards and pathological backwards.

Frames are derived from `assets/reference/ticker-master.mp4`, which is never
served:

```bash
bash scripts/extract-frames.sh
```

That script crops the clip to its text band, quantises the near-black noise
(the unlit ghost grid was costing ~60% of the encoded size), recolours the
footage from red to the page's single amber, and writes two tiers. It prints
the two frame counts; put them in `src/config.ts`.

Current payload: **111 frames / 1.6MB desktop, 74 frames / 581KB mobile.**
There is no loader — the board renders before a single frame downloads, and a
frame that has not arrived coarsens the scrub rather than blanking it.

## Budgets

- **Ambient devices: 5.** Station clock, hero scrub, live ticker, status
  flicker, idle test pattern. A sixth means removing one, not appending.
- **Script:** 18.9KB for the page itself (7.1KB gzip), plus React at 189.6KB
  in its own chunk.

## Non-negotiables

- Every effect branches on `prefers-reduced-motion` **in JavaScript**, because
  the scrub, the ticker and the idle timer all live there and a CSS media
  query never sees them. The idle test pattern never fires at all.
- Ten services are **one tab stop** with a roving `tabindex`.
- The prose is readable with JavaScript off — the whole tracklist is in
  `index.html` and React replaces it on mount.
- Nothing is rounded, nothing is blurred, and amber appears only on the
  status column and the ticker.
