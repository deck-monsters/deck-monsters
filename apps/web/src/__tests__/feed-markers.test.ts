import { describe, expect, it } from 'vitest';

import {
  createFeedMarker,
  feedMarkerKind,
  isFeedMarker,
  shouldAppendMarker,
} from '../utils/feed-markers.js';

describe('feed markers (#107)', () => {
  it('labels each kind for the reader', () => {
    expect(createFeedMarker('joined').text).toBe('you joined here');
    expect(createFeedMarker('disconnected').text).toBe('connection lost');
    expect(createFeedMarker('reconnected').text).toBe('reconnected');
  });

  it('gives every marker a distinct id, even within the same millisecond', () => {
    const a = createFeedMarker('joined', 1000);
    const b = createFeedMarker('joined', 1000);
    expect(a.id).not.toBe(b.id);
  });

  it('round-trips its kind', () => {
    expect(feedMarkerKind(createFeedMarker('disconnected'))).toBe('disconnected');
  });

  it('recognises markers and leaves real events alone', () => {
    expect(isFeedMarker(createFeedMarker('joined'))).toBe(true);
    expect(isFeedMarker({ type: 'ring.add' } as never)).toBe(false);
    expect(feedMarkerKind({ type: 'ring.add' } as never)).toBe(null);
  });

  describe('shouldAppendMarker', () => {
    it('refuses to stack two dividers in a row', () => {
      // A drop with no events in between, or a reconnect that recovered nothing, would
      // otherwise draw "connection lost" directly above "reconnected", saying nothing.
      expect(shouldAppendMarker([createFeedMarker('disconnected')])).toBe(false);
    });

    it('allows a divider after a real event', () => {
      expect(shouldAppendMarker([{ type: 'ring.add' } as never])).toBe(true);
    });

    it('refuses to open the feed with a divider', () => {
      expect(shouldAppendMarker([])).toBe(false);
    });
  });
});
