import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatEventText, type MonsterMentions } from '../utils/format-event-text.js';
import { buildMentionIndex, type KnownMonster } from '../utils/monster-mentions.js';

const gin: KnownMonster = { name: 'Gin & Tonic', icon: '🐍', creatureType: 'Basilisk', appearance: 'green' };
const ben: KnownMonster = { name: 'Ben Franklin', icon: '💪', creatureType: 'Gladiator' };

const mentions: MonsterMentions = {
  index: buildMentionIndex([gin, ben]),
  render: (monster, key) => <img key={key} data-monster={monster.name} alt={monster.icon} />,
};

const html = (text: string, withMentions: MonsterMentions | null = mentions) =>
  renderToStaticMarkup(<>{formatEventText(text, withMentions)}</>);

describe('formatEventText with monster mentions', () => {
  it('swaps a known monster\'s emoji for its sprite and keeps the name as text', () => {
    expect(html('🐍 Gin & Tonic lays down a card.'))
      .toBe('<span><img data-monster="Gin &amp; Tonic" alt="🐍"/> Gin &amp; Tonic lays down a card.</span>');
  });

  it('finds the icon when markup has split the line into runs', () => {
    // The hit's HP line: the icon is in a plain run, the name inside the bold one.
    expect(html('💪 *Ben Franklin has 11HP.*'))
      .toBe('<span><img data-monster="Ben Franklin" alt="💪"/> <strong>Ben Franklin has 11HP.</strong></span>');
  });

  it('reaches an icon inside a bold run', () => {
    expect(html('*🐍 Gin & Tonic* strikes!'))
      .toBe('<span><strong><img data-monster="Gin &amp; Tonic" alt="🐍"/> Gin &amp; Tonic</strong> strikes!</span>');
  });

  it('renders a level-up\'s **bold** name without stray asterisks, sprite included', () => {
    // Pre-existing: `**Name**` rendered as <strong>*Name*</strong>.
    expect(html('🎉 🐍  **Gin & Tonic** has reached level 2!'))
      .toBe('<span>🎉 <img data-monster="Gin &amp; Tonic" alt="🐍"/>  <strong>Gin &amp; Tonic</strong> has reached level 2!</span>');
  });

  it('keeps an icon inside **double** bold on the right character', () => {
    expect(html('**🐍 Gin & Tonic** strikes!'))
      .toBe('<span><strong><img data-monster="Gin &amp; Tonic" alt="🐍"/> Gin &amp; Tonic</strong> strikes!</span>');
  });

  it('leaves the damage emoji in a hit line alone', () => {
    const out = html('🐍 🔪 💪  Gin & Tonic hits Ben Franklin for 4 damage.');
    expect(out).toContain('🔪');
    expect(out.match(/<img/g)).toHaveLength(2);
  });

  it('never touches a fenced card block, whose columns an image would shift', () => {
    const out = html('```\n🐍  Gin & Tonic\n```');
    expect(out).not.toContain('<img');
    expect(out).toContain('🐍  Gin &amp; Tonic');
  });

  it('renders exactly as before without mentions', () => {
    const text = '🐍 🔪 💪  Gin & Tonic hits *Ben Franklin*.';
    expect(html(text, null)).toBe(renderToStaticMarkup(<>{formatEventText(text)}</>));
    expect(html(text, null)).not.toContain('<img');
  });
});
