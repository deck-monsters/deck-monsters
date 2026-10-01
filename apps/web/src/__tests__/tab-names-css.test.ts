import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const src = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');

// Roadmap 39 B4: one name per place; the tab names win.
describe('one name per place', () => {
  it('the tab names are The Ring, Console, Chat, Workshop, Fights, Leaders', () => {
    // Read as text: importing surfaces.ts pulls in every panel and the Supabase client.
    const labels = [...src('components/surfaces.ts').matchAll(/^\s+label: '([^']+)',/gm)].map((m) => m[1]);
    expect(labels).toEqual(['The Ring', 'Console', 'Chat', 'Workshop', 'Fights', 'Leaders']);
  });

  it('the menus and headings no longer use the old names', () => {
    const shell = src('components/AppShell.tsx');
    expect(shell).not.toMatch(/>\s*(Terminal|Leaderboard|Fight log)\s*</);
    // Exact link text, so "Deck Workshop" would fail: a bare `toContain('Workshop')` passes it.
    for (const name of ['The Ring', 'Leaders', 'Workshop', 'Fights']) {
      expect(shell).toMatch(new RegExp(`>\\s*${name}\\s*<`));
    }
    expect(src('components/WorkshopPanel.tsx')).toContain('<h1>Workshop</h1>');
    expect(src('components/FightLogPanel.tsx')).toContain('<h1>Fights</h1>');
    expect(src('components/LeaderboardPanel.tsx')).toContain('<h1>Leaders</h1>');
  });

  it('keeps the Help and guides entry', () => {
    expect(src('components/AppShell.tsx')).toContain('Help and guides');
  });
});

describe('the Chat surface registry entry', () => {
  it('has the plan\'s description, a route, and an unread badge hook', () => {
    expect(src('components/surface-descriptions.ts')).toContain("chat: 'Talk with everyone in this room, or send a message to one player.'");
    const surfaces = src('components/surfaces.ts');
    expect(surfaces).toContain('/room/${roomId}/chat');
    expect(surfaces).toContain('badge: ({ chatUnread }) => chatUnread');
  });
});

describe('six tabs fit at phone width', () => {
  const css = src('styles/terminal.css');
  const phone = css.match(/@media \(max-width: 480px\) \{\s*\.terminal-tab \{([^}]*)\}/);

  it('has a phone rule that shares the bar instead of scrolling it', () => {
    expect(phone).toBeTruthy();
    const body = phone![1]!;
    // Sized from the label, then the spare room shared: equal shares starved "Workshop" with six.
    expect(body).toMatch(/flex:\s*1 1 auto/);
    expect(body).toMatch(/min-width:\s*0/);
  });

  it('keeps a 44px touch height and small side padding', () => {
    const body = phone![1]!;
    expect(body).toMatch(/min-height:\s*44px/);
    expect(body).toMatch(/padding:\s*0\.5rem 0\.15rem/);
  });

  it('comes after the tablet rule so it wins the cascade', () => {
    expect(css.indexOf('max-width: 480px')).toBeGreaterThan(css.indexOf('min-width: max-content'));
  });
});
