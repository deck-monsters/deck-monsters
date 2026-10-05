/**
 * Keep a tapped control where it was on screen across a re-render that changes the height of
 * content above it (bug 228).
 *
 * Selecting a card in Your cards adds hint lines to every monster panel above it ("Can use
 * selected inventory card.", "Tap destination slot…"). Chrome's scroll anchoring hides that;
 * iOS Safari has none, so the page jumped by the added height, a whole screen with six
 * stacked monsters, and the card the player had just tapped was gone.
 */

const ANCHOR_TTL_MS = 1000;

export interface ScrollAnchor {
  el: HTMLElement;
  top: number;
  at: number;
}

/** The control a click landed on and where it sat, recorded before React re-renders. */
export function anchorFor(target: EventTarget | null): ScrollAnchor | null {
  const el = target instanceof Element ? target.closest<HTMLElement>('button') : null;
  return el ? { el, top: el.getBoundingClientRect().top, at: Date.now() } : null;
}

/** The nearest ancestor that scrolls vertically, or the document's scroller. */
function scrollParent(el: HTMLElement): Element | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
  }
  return document.scrollingElement;
}

/**
 * After the re-render, scroll by however far the anchor moved, so it is back under the
 * player's finger. A stale anchor (an older click that changed nothing) is ignored.
 */
export function restoreAnchor(anchor: ScrollAnchor | null): void {
  if (!anchor || Date.now() - anchor.at > ANCHOR_TTL_MS || !anchor.el.isConnected) return;
  const delta = anchor.el.getBoundingClientRect().top - anchor.top;
  if (Math.abs(delta) < 1) return;
  const scroller = scrollParent(anchor.el);
  if (!scroller) return;
  // The document's scroller ignores scrollBy on some engines; window.scrollBy is the reliable form.
  if (scroller === document.scrollingElement) window.scrollBy(0, delta);
  else scroller.scrollTop += delta;
}
