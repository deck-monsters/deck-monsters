import { describe, expect, it } from 'vitest';
import { mapConsoleHistoryEvent } from '../utils/console-history-event-map.js';

describe('mapConsoleHistoryEvent', () => {
  it('maps console input system events to input rows', () => {
    const mapped = mapConsoleHistoryEvent({
      id: 'evt-1',
      type: 'system',
      text: 'send elm to the ring',
      payload: { consoleInput: true },
    });

    expect(mapped).toEqual({
      id: 'evt-1',
      type: 'input',
      text: 'send elm to the ring',
    });
  });

  it('keeps regular system events as system rows', () => {
    const mapped = mapConsoleHistoryEvent({
      id: 'evt-2',
      type: 'system',
      text: '-- reconnecting --',
      payload: {},
    });

    expect(mapped).toEqual({
      id: 'evt-2',
      type: 'system',
      text: '-- reconnecting --',
    });
  });

  it('maps system.gap to a system row', () => {
    const mapped = mapConsoleHistoryEvent({
      id: 'gap-1',
      type: 'system.gap',
      text: '── missed ──',
      payload: { reason: 'buffer_or_retention' },
    });

    expect(mapped).toEqual({
      id: 'gap-1',
      type: 'system',
      text: '── missed ──',
    });
  });

  it('carries only the mechanic slice of a tagged announce payload (roadmap 39 C4)', () => {
    const mapped = mapConsoleHistoryEvent({
      id: 'evt-m',
      type: 'announce',
      text: 'An ambush!',
      payload: { mechanic: 'ambush', contestant: { big: 'object' } },
    });
    expect(mapped).toEqual({ id: 'evt-m', type: 'announce', text: 'An ambush!', payload: { mechanic: 'ambush' } });
  });
});
