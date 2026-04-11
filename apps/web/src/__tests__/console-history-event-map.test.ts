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
});
