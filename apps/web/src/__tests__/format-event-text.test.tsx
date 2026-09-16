import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { formatEventText, truncateEventText } from '../utils/format-event-text.js';

const html = (text: string) => renderToStaticMarkup(<>{formatEventText(text)}</>);

describe('formatEventText: inline markup (#99)', () => {
  it('renders *asterisks* as bold rather than printing them', () => {
    expect(html("*It's Santi Brainer's turn.*")).toBe(
      "<span><strong>It&#x27;s Santi Brainer&#x27;s turn.</strong></span>"
    );
  });

  it('renders _underscores_ as italics', () => {
    // The engine formats every roll this way: "rolled _13 +4 on 1d20_ to see if…".
    expect(html('rolled _13 +4 on 1d20_')).toBe(
      '<span>rolled <em>13 +4 on 1d20</em></span>'
    );
  });

  it('leaves underscores inside a word alone', () => {
    // Otherwise `room_player_stats` renders its middle in italics.
    expect(html('room_player_stats')).toBe('<span>room_player_stats</span>');
  });

  it('leaves a lone delimiter alone', () => {
    expect(html('5 * 3 items')).toBe('<span>5 * 3 items</span>');
  });

  it('does NOT apply inline markup inside a fenced block', () => {
    // Fenced blocks are ASCII card boxes where * and _ are drawing characters.
    const out = html('before```=== *not bold* ===```after');
    expect(out).toContain('=== *not bold* ===');
    expect(out).not.toContain('<strong>');
  });

  it('still renders fenced blocks as card panels', () => {
    expect(html('intro```CARD```')).toContain('class="event-card-block"');
  });
});

describe('truncateEventText (#99)', () => {
  it('returns short text untouched', () => {
    expect(truncateEventText('hello', 200)).toBe('hello');
  });

  it('does not cut mid-word', () => {
    const out = truncateEventText('A powerful, gold, desert-dwelling basilisk', 20);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toContain('deser…');
  });

  it('closes a fence it cut through, so the rest does not become one runaway panel', () => {
    const text = `plain \`\`\`${'x'.repeat(400)}`;
    const out = truncateEventText(text, 50);
    expect((out.split('```').length - 1) % 2).toBe(0);
  });

  it('leaves an already balanced fence alone', () => {
    const out = truncateEventText('```abc```' + 'y'.repeat(400), 300);
    expect((out.split('```').length - 1) % 2).toBe(0);
  });
});
