import { afterEach, describe, expect, it, vi } from 'vitest';
import { feedTimings, isFeedTimingsEnabled, resetFeedTimingsEnabledCache } from './feed-timings.js';

afterEach(() => {
  feedTimings.reset();
  vi.useRealTimers();
});

describe('feedTimings', () => {
  it('counts', () => {
    feedTimings.count('a');
    feedTimings.count('a', 4);
    expect(feedTimings.snapshot().counters.a).toBe(5);
  });

  it('aggregates durations', () => {
    feedTimings.duration('d', 10);
    feedTimings.duration('d', 30);
    feedTimings.duration('d', 20);
    expect(feedTimings.snapshot().durations.d).toEqual({ count: 3, last: 20, min: 10, max: 30, total: 60 });
  });

  it('since records only when the mark exists', () => {
    feedTimings.since('nope', 'x');
    expect(feedTimings.snapshot().durations.x).toBeUndefined();
    feedTimings.mark('m');
    feedTimings.since('m', 'x');
    expect(feedTimings.snapshot().durations.x?.count).toBe(1);
    expect(feedTimings.snapshot().marks.m).toBeTypeOf('number');
  });

  it('events bump counters and cap at 200, newest last', () => {
    for (let i = 0; i < 205; i += 1) feedTimings.event('e', { i });
    const snap = feedTimings.snapshot();
    expect(snap.counters.e).toBe(205);
    expect(snap.events).toHaveLength(200);
    expect(snap.events[199]?.detail).toEqual({ i: 204 });
    expect(snap.events[0]?.detail).toEqual({ i: 5 });
  });

  it('snapshot is a deep copy', () => {
    feedTimings.event('e', { a: 1 });
    feedTimings.duration('d', 1);
    const snap = feedTimings.snapshot();
    snap.counters.e = 99;
    snap.durations.d!.count = 99;
    snap.events[0]!.detail!.a = 99;
    const again = feedTimings.snapshot();
    expect(again.counters.e).toBe(1);
    expect(again.durations.d!.count).toBe(1);
    expect(again.events[0]!.detail!.a).toBe(1);
  });

  it('reset clears everything', () => {
    feedTimings.event('e');
    feedTimings.mark('m');
    feedTimings.duration('d', 1);
    feedTimings.reset();
    expect(feedTimings.snapshot()).toEqual({ counters: {}, durations: {}, marks: {}, events: [] });
  });

  it('coalesces subscriber notifications', () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    const off = feedTimings.subscribe(listener);
    for (let i = 0; i < 50; i += 1) feedTimings.count('c');
    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    feedTimings.count('c');
    vi.advanceTimersByTime(1000);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('is exposed on window', () => {
    expect(window.__feedTimings).toBe(feedTimings);
  });
});

describe('isFeedTimingsEnabled', () => {
  afterEach(() => {
    window.localStorage.removeItem('dm:feedTimings');
    window.history.replaceState(null, '', '/');
    resetFeedTimingsEnabledCache();
  });

  it('is off by default', () => {
    resetFeedTimingsEnabledCache();
    expect(isFeedTimingsEnabled()).toBe(false);
  });

  it('?feedTimings=1 enables and persists; ?feedTimings=0 clears', () => {
    window.history.replaceState(null, '', '/?feedTimings=1');
    resetFeedTimingsEnabledCache();
    expect(isFeedTimingsEnabled()).toBe(true);
    expect(window.localStorage.getItem('dm:feedTimings')).toBe('1');

    window.history.replaceState(null, '', '/?feedTimings=0');
    resetFeedTimingsEnabledCache();
    expect(isFeedTimingsEnabled()).toBe(false);
    expect(window.localStorage.getItem('dm:feedTimings')).toBeNull();
  });

  it('honours the stored key', () => {
    window.localStorage.setItem('dm:feedTimings', '1');
    resetFeedTimingsEnabledCache();
    expect(isFeedTimingsEnabled()).toBe(true);
  });
});
