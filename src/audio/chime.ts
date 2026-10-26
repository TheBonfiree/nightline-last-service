/* ---------------------------------------------------------------------------
 * chime.ts — the platform announcement chime.
 *
 * Two descending tones, the "bing-bong" that precedes a station announcement.
 * Synthesised rather than sampled: it is about 40 lines and no bytes, and a
 * sample would be the only audio asset on a page about a record that has no
 * audio on it.
 *
 * Rules this obeys, none of them optional:
 *
 *   - OFF by default. Nothing makes sound until the visitor asks for it.
 *   - The AudioContext is not even constructed until the toggle is switched
 *     on, which is itself a user gesture — so autoplay policy is satisfied by
 *     construction rather than by a resume() that may silently fail.
 *   - The preference persists, so it never surprises the same person twice.
 *   - Nothing on the page depends on hearing it. It accompanies a visual
 *     state change that is complete without it.
 * ------------------------------------------------------------------------- */

const STORAGE_KEY = 'nightline:chime';

/** G5 then C5 — a falling fourth, which is the interval the real thing uses. */
const NOTES = [783.99, 523.25];

let ctx: AudioContext | null = null;

export function chimeEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function setChimeEnabled(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch { /* private mode */ }
  if (!on && ctx) {
    void ctx.close();
    ctx = null;
  }
}

/**
 * Play the chime. Silent and side-effect free when disabled, so callers do
 * not have to check first.
 *
 * Must be reached from a user gesture the first time, which the toggle
 * guarantees.
 */
export function playChime() {
  if (!chimeEnabled()) return;

  try {
    ctx ??= new AudioContext();
  } catch {
    return; // no Web Audio: the visual change still happened
  }
  if (ctx.state === 'suspended') void ctx.resume();

  const now = ctx.currentTime;

  // A gentle lowpass takes the glassy edge off a bare sine and leaves
  // something closer to a struck bar heard across a concourse.
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2600;

  const out = ctx.createGain();
  out.gain.value = 0.16;   // quiet. It is punctuation, not an event.
  tone.connect(out).connect(ctx.destination);

  NOTES.forEach((hz, i) => {
    const t = now + i * 0.42;
    const osc = ctx!.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = hz;

    const env = ctx!.createGain();
    // 8ms attack, then an exponential tail. A linear release on a struck
    // tone reads as a fade-out; the exponential reads as a decay.
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);

    osc.connect(env).connect(tone);
    osc.start(t);
    osc.stop(t + 1);
  });
}
