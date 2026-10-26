/* ---------------------------------------------------------------------------
 * boardReducer.ts — every piece of board state, in one typed place.
 *
 * The board is a fake window manager for a list, and a fake window manager is
 * a real one to anyone using a keyboard. Keeping selection, expansion and the
 * idle takeover in a single reducer is what makes the keyboard contract
 * checkable: there is exactly one place where focus can move, and exactly one
 * place where the idle timer can be reset.
 * ------------------------------------------------------------------------- */

export interface BoardState {
  /** Index of the row that currently owns the list's single tab stop. */
  focusIndex: number;
  /** Index of the expanded row, or null. Only one opens at a time — a board
   *  shows the calling points of the selected service, not of several. */
  expandedIndex: number | null;
  /** The row whose calling points are on their way out. React would unmount
   *  the region the instant it collapsed, which bypasses any CSS exit
   *  transition — so it is kept mounted for the length of the close. */
  closingIndex: number | null;
  /** True once the idle timer has fired. Never set under reduced motion. */
  idle: boolean;
  /** Which of the two idle variants is showing. */
  idleVariant: number;
}

export const initialBoardState: BoardState = {
  focusIndex: 0,
  expandedIndex: null,
  closingIndex: null,
  idle: false,
  idleVariant: 0,
};

export type BoardAction =
  | { type: 'focus'; index: number }
  | { type: 'move'; delta: number; count: number }
  | { type: 'jump'; to: 'first' | 'last'; count: number }
  | { type: 'toggle'; index: number }
  | { type: 'collapse' }
  | { type: 'closed'; index: number }
  | { type: 'idleIn'; variant: number }
  | { type: 'idleOut' };

/** Clamp rather than wrap. A board is a physical list with a top and a
 *  bottom; arrowing off the end and reappearing at the other one is a menu
 *  behaviour and reads as a bug here. */
const clamp = (n: number, count: number) => Math.max(0, Math.min(count - 1, n));

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case 'focus':
      return { ...state, focusIndex: action.index };

    case 'move':
      return { ...state, focusIndex: clamp(state.focusIndex + action.delta, action.count) };

    case 'jump':
      return { ...state, focusIndex: action.to === 'first' ? 0 : action.count - 1 };

    /* Expanding also moves the tab stop onto the expanded row, so Escape and
     * the arrow keys stay anchored to the thing the visitor just opened. */
    case 'toggle': {
      const open = state.expandedIndex === action.index ? null : action.index;
      return {
        ...state,
        expandedIndex: open,
        // Closing this row, or swapping to another: either way the old one
        // has to stay mounted long enough to animate shut.
        closingIndex: open === null ? action.index : state.expandedIndex,
        focusIndex: action.index,
      };
    }

    case 'collapse':
      return { ...state, expandedIndex: null, closingIndex: state.expandedIndex };

    /* Guarded: a second row may have opened and closed while the first was
     * still on its way out, and clearing blindly would unmount that one. */
    case 'closed':
      return state.closingIndex === action.index ? { ...state, closingIndex: null } : state;

    case 'idleIn':
      return { ...state, idle: true, idleVariant: action.variant };

    /* Waking never disturbs focus or the open row. The screensaver is a
     * display taking over, not a navigation event. */
    case 'idleOut':
      return state.idle ? { ...state, idle: false } : state;

    default:
      return state;
  }
}
