import { describe, expect, it } from 'vitest';
import { movedToMessage } from '../utils/moved-message.js';

describe('movedToMessage', () => {
  it('is singular for one card', () => {
    expect(movedToMessage(1, 'Fang')).toBe('Moved 1 card to Fang.');
  });
  it('is plural otherwise', () => {
    expect(movedToMessage(3, 'Fang')).toBe('Moved 3 cards to Fang.');
  });
});
