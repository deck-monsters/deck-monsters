import { describe, expect, it } from 'vitest';
import { buildMentionIndex, type KnownMonster } from '../utils/monster-mentions.js';

const gin: KnownMonster = { name: 'Gin & Tonic', icon: '🐍', creatureType: 'Basilisk' };
const hissy: KnownMonster = { name: 'Hissy Fit', icon: '🐍', creatureType: 'Basilisk' };
const ben: KnownMonster = { name: 'Ben Franklin', icon: '💪', creatureType: 'Gladiator' };
const max: KnownMonster = { name: 'Max', icon: '💪', creatureType: 'Gladiator' };

/** Which monster each replaced emoji was matched to, in order. */
function matched(text: string, monsters: KnownMonster[], beastmasters: string[] = []): string[] {
  return buildMentionIndex(monsters, beastmasters).find(text).map(({ start, end, monster }) =>
    `${text.slice(start, end)}=${monster.name}`);
}

describe('monster mentions — the engine templates', () => {
  it('identity: icon, space, name', () => {
    expect(matched('🐍 Gin & Tonic lays down the following card:', [gin])).toEqual(['🐍=Gin & Tonic']);
  });

  it('effect lines name two monsters by identity', () => {
    expect(matched('🐍 Gin & Tonic is currently immobilized by 💪 Ben Franklin.', [gin, ben]))
      .toEqual(['🐍=Gin & Tonic', '💪=Ben Franklin']);
  });

  it('heal: one other emoji between icon and name', () => {
    expect(matched('🐍 💊 Gin & Tonic healed 3 hp and has *20 hp*.', [gin])).toEqual(['🐍=Gin & Tonic']);
  });

  it('the HP line: markup between icon and name', () => {
    expect(matched('💪 *Ben Franklin is now bloodied. Ben Franklin has only 11HP.*', [ben]))
      .toEqual(['💪=Ben Franklin']);
  });

  it('level-up: two spaces and double markup', () => {
    expect(matched('🎉 🐍  **Gin & Tonic** has reached level 2! (Lvl 2)', [gin])).toEqual(['🐍=Gin & Tonic']);
  });

  it('hit: attacker and target icons, never the damage icon', () => {
    expect(matched('🐍 🔪 💪  Gin & Tonic hits Ben Franklin for 4 damage.', [gin, ben]))
      .toEqual(['🐍=Gin & Tonic', '💪=Ben Franklin']);
  });

  it('miss: same cluster, wider gap', () => {
    expect(matched('💪 🏓 🐍    Ben Franklin misses Gin & Tonic entirely.', [gin, ben]))
      .toEqual(['💪=Ben Franklin', '🐍=Gin & Tonic']);
  });
});

describe('monster mentions — telling look-alikes apart', () => {
  it('two basilisks with the same default icon each get their own sprite', () => {
    expect(matched('🐍 🔪 🐍  Gin & Tonic hits Hissy Fit for 4 damage.', [gin, hissy]))
      .toEqual(['🐍=Gin & Tonic', '🐍=Hissy Fit']);
  });

  it('two gladiators: the cluster overrides the icon-before-name rule', () => {
    // Rule 1 alone would give the third 💪 to Ben, because it sits right before his name.
    expect(matched('💪 🔪 💪  Ben Franklin hits Max for 2 damage.', [ben, max]))
      .toEqual(['💪=Ben Franklin', '💪=Max']);
  });

  it('a monster that hit itself owns both ends of the cluster', () => {
    expect(matched('🐍 🔪 🐍  Gin & Tonic hits himself by mistake for 2 damage.', [gin]))
      .toEqual(['🐍=Gin & Tonic', '🐍=Gin & Tonic']);
  });

  it('prefers the longest name', () => {
    const shortGin: KnownMonster = { name: 'Gin', icon: '🍸', creatureType: 'Jinn' };
    expect(matched('🐍 Gin & Tonic arrives.', [shortGin, gin])).toEqual(['🐍=Gin & Tonic']);
  });
});

describe('monster mentions — leaving everything else alone', () => {
  it('ignores an icon that is not the named monster\'s', () => {
    expect(matched('🔥 Gin & Tonic is on fire.', [gin])).toEqual([]);
  });

  it('ignores a monster icon with no name after it', () => {
    expect(matched('The crowd hisses 🐍 and roars.', [gin])).toEqual([]);
  });

  it('matches whole names only', () => {
    const kaa: KnownMonster = { name: 'Kaa', icon: '🐍', creatureType: 'Basilisk' };
    expect(matched('🐍 Kaaba stands silent.', [kaa])).toEqual([]);
  });

  it('does nothing for a monster the room has not seen', () => {
    expect(matched('🐍 Stranger Danger arrives.', [gin])).toEqual([]);
  });

  it('handles an empty registry', () => {
    expect(matched('🐍 Gin & Tonic arrives.', [])).toEqual([]);
  });

  it('copes with a multi-codepoint custom icon', () => {
    const wizard: KnownMonster = { name: 'Merl', icon: '🧙‍♂️', creatureType: 'Jinn' };
    expect(matched('🧙‍♂️ 💊 Merl healed 2 hp.', [wizard])).toEqual(['🧙‍♂️=Merl']);
  });

  it('escapes names containing regex characters', () => {
    const odd: KnownMonster = { name: 'Mr. (Bones)?', icon: '💀', creatureType: 'Minotaur' };
    expect(matched('💀 Mr. (Bones)? arrives.', [odd])).toEqual(['💀=Mr. (Bones)?']);
  });

  it('reads a skin-toned custom icon whole in a hit line', () => {
    // The cluster regex stopped at the base pictograph, reading 💪🏽 as 💪 and bailing out.
    const toned: KnownMonster = { name: 'Flex', icon: '💪🏽', creatureType: 'Gladiator' };
    expect(matched('💪🏽 🔪 🐍  Flex hits Gin & Tonic for 3 damage.', [toned, gin]))
      .toEqual(['💪🏽=Flex', '🐍=Gin & Tonic']);
  });

  it('reads a flag icon whole in a hit line', () => {
    const maple: KnownMonster = { name: 'Maple', icon: '🇨🇦', creatureType: 'Minotaur' };
    expect(matched('🐍 🤜 🇨🇦  Gin & Tonic hits Maple for 2 damage.', [gin, maple]))
      .toEqual(['🐍=Gin & Tonic', '🇨🇦=Maple']);
  });

  it('refuses a name a Beastmaster shares, since their identities print alike', () => {
    // cardDrop.ts: "<monster identity> finds a card for <character identity>". A Beastmaster
    // named Gin with a 🐍 avatar is indistinguishable from the monster; the emoji stays.
    expect(matched('💪 Ben Franklin finds a card for 🐍 Gin & Tonic in the dust.', [gin, ben], ['Gin & Tonic']))
      .toEqual(['💪=Ben Franklin']);
  });

  it('still matches a shared name inside the hit cluster, which only ever holds monsters', () => {
    expect(matched('🐍 🔪 💪  Gin & Tonic hits Ben Franklin for 4 damage.', [gin, ben], ['Gin & Tonic']))
      .toEqual(['🐍=Gin & Tonic', '💪=Ben Franklin']);
  });
});
