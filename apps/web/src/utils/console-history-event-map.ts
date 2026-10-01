import { mechanicPayloadOf } from '../lib/mechanic-notes.js';

export type ConsoleHistoryEvent = {
  id: string;
  type: string;
  text: string;
  payload: Record<string, unknown>;
};

export type ConsoleHistoryDisplayEvent =
  | {
      id: string;
      type: 'announce' | 'system' | 'input' | 'tombstone';
      text: string;
      /** Only the parts of the payload a first-time mechanic note needs; absent on ordinary lines. */
      payload?: Record<string, unknown>;
    }
  | null;

/**
 * Convert a historical GameEvent row into a Console feed event.
 * Returns null for event types that should not render as a history line.
 */
export function mapConsoleHistoryEvent(event: ConsoleHistoryEvent): ConsoleHistoryDisplayEvent {
  const payload = event.payload ?? {};
  if (event.type === 'system' && payload.consoleInput) {
    return { id: event.id, type: 'input', text: event.text };
  }
  if (event.type === 'system.gap') {
    return { id: event.id, type: 'system', text: event.text };
  }
  if (event.type === 'announce' || event.type === 'system') {
    const notePayload = mechanicPayloadOf(payload);
    return {
      id: event.id,
      type: event.type as 'announce' | 'system',
      text: event.text,
      ...(notePayload ? { payload: notePayload } : {}),
    };
  }
  if (event.type === 'prompt.request') {
    return { id: event.id, type: 'announce', text: event.text || String(payload.question ?? '') };
  }
  if (event.type === 'prompt.timeout') {
    return { id: event.id, type: 'tombstone', text: event.text };
  }
  return null;
}
