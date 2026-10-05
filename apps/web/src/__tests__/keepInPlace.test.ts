import { afterEach, describe, expect, it, vi } from 'vitest';
import { anchorFor, restoreAnchor } from '../utils/keep-in-place.js';

/**
 * Bug 228: selecting a card adds hint lines to the monster panels above Your cards, and iOS
 * Safari has no scroll anchoring, so the page jumped. jsdom has no layout: the rects are
 * stubbed to say where the button was and where the re-render put it.
 */
function setup() {
  const pane = document.createElement('div');
  pane.style.overflowY = 'auto';
  Object.defineProperty(pane, 'scrollHeight', { value: 2000 });
  Object.defineProperty(pane, 'clientHeight', { value: 800 });
  const button = document.createElement('button');
  const label = document.createElement('span');
  button.append(label);
  pane.append(button);
  document.body.append(pane);
  const top = vi.fn().mockReturnValue(500);
  button.getBoundingClientRect = () => ({ top: top() }) as DOMRect;
  return { pane, button, label, top };
}

describe('keep a tapped control in place across a re-render', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('scrolls the pane by however far the control moved', () => {
    const { pane, label, top } = setup();
    const anchor = anchorFor(label); // a tap on the label still anchors its button
    top.mockReturnValue(660); // 160px of hints appeared above it
    restoreAnchor(anchor);
    expect(pane.scrollTop).toBe(160);
  });

  it('leaves the pane alone when nothing moved', () => {
    const { pane, button } = setup();
    restoreAnchor(anchorFor(button));
    expect(pane.scrollTop).toBe(0);
  });

  it('ignores a stale anchor from an older click', () => {
    vi.useFakeTimers();
    const { pane, button, top } = setup();
    const anchor = anchorFor(button);
    vi.advanceTimersByTime(5000);
    top.mockReturnValue(660);
    restoreAnchor(anchor);
    expect(pane.scrollTop).toBe(0);
  });

  it('ignores a control that is gone (the card moved away)', () => {
    const { pane, button, top } = setup();
    const anchor = anchorFor(button);
    button.remove();
    top.mockReturnValue(660);
    restoreAnchor(anchor);
    expect(pane.scrollTop).toBe(0);
  });

  it('records nothing for a click that is not on a button', () => {
    expect(anchorFor(document.body)).toBeNull();
  });
});
