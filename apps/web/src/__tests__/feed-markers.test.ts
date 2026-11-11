import { describe, expect, it } from 'vitest';

import {
  LOSS_MARKER_DELAY_MS,
  closeOutageMarkers,
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
      expect(shouldAppendMarker([], 'disconnected')).toBe(false);
    });

    it('given a kind, only a divider of that kind blocks it', () => {
      // "connection lost" under "you joined here" is a real thing to say (baseline C5).
      expect(shouldAppendMarker([createFeedMarker('joined')], 'disconnected')).toBe(true);
      expect(shouldAppendMarker([createFeedMarker('disconnected')], 'disconnected')).toBe(false);
      expect(shouldAppendMarker([createFeedMarker('disconnected')], 'reconnected')).toBe(true);
    });
  });

  describe('closeOutageMarkers', () => {
    const row = (id: string) => ({ id, type: 'announce', text: id }) as never;
    const texts = (events: Array<{ id: string; text?: string }>) =>
      events.map((e) => (e.id.startsWith('marker-') ? e.text : e.id));
    const base = { anchorId: 'a', lossMarkerDrawn: false, outageMs: 5_000, missed: 0, lostAt: 100, reconnectedAt: 200 };

    it('draws "reconnected" after a loss marker that was drawn live', () => {
      const live = [row('a'), createFeedMarker('disconnected')];
      expect(texts(closeOutageMarkers(live, { ...base, lossMarkerDrawn: true }))).toEqual([
        'a', 'connection lost', 'reconnected',
      ]);
    });

    it('draws nothing for a blip with nothing missed', () => {
      const feed = [row('a')];
      expect(closeOutageMarkers(feed, { ...base, outageMs: LOSS_MARKER_DELAY_MS - 1 })).toBe(feed);
    });

    it('puts the loss back after the anchor when events were missed in a short outage', () => {
      const feed = [row('a'), row('replayed1'), row('replayed2')];
      expect(texts(closeOutageMarkers(feed, { ...base, outageMs: 300, missed: 2 }))).toEqual([
        'a', 'connection lost', 'replayed1', 'replayed2', 'reconnected',
      ]);
    });

    it('a long outage with nothing missed still draws the pair, back to back', () => {
      expect(texts(closeOutageMarkers([row('a')], base))).toEqual(['a', 'connection lost', 'reconnected']);
    });

    it('never draws "reconnected" without a loss: empty feed, unknown anchor, no anchor', () => {
      expect(closeOutageMarkers([], base)).toEqual([]);
      const feed = [row('b')];
      expect(closeOutageMarkers(feed, base)).toBe(feed);
      expect(closeOutageMarkers(feed, { ...base, anchorId: null })).toBe(feed);
    });

    it('does not double a loss divider already at the anchor, or a reconnected already at the tail', () => {
      const feed = [row('a'), createFeedMarker('disconnected'), createFeedMarker('reconnected')];
      expect(texts(closeOutageMarkers(feed, base))).toEqual(['a', 'connection lost', 'reconnected']);
    });
  });
});
