/**
 * Finds the emoji in a line of narration that stand for a known monster, so the feed can draw
 * that monster's pixel sprite in their place (docs/roadmap/24-pixel-monsters-everywhere.md).
 *
 * The engine's text is shared with Discord, so it carries no markup saying "this emoji is
 * that monster" — only the monster's icon and name, placed by a handful of templates. Every
 * one of them was surveyed, and two rules cover them all:
 *
 * 1. **Icon before its own name.** `identity` (`🐍 Gin`), effects, heals (`🐍 💊 Gin`), the
 *    hit's HP line (`🐍 *Gin has 12HP.*`) and level-ups (`🐍  **Gin**`). Looking back from
 *    each name, skipping whitespace, `*`/`_` markup and at most one other emoji, the icon
 *    must be the monster's own.
 * 2. **The hit and miss cluster.** `🐍 🔪 💪  Gin hits Ben` puts attacker icon, damage icon
 *    and target icon first, *then* the names. The first and third emoji map to the first and
 *    second monster named after them (the first again if only one is — a monster that hit
 *    itself). The middle emoji is the damage flavour and is never touched.
 *
 * Anything else keeps its emoji. The failure mode is "looks like today", never "wrong
 * monster" — and pairing each icon with a name is what keeps two default-🐍 basilisks in
 * one fight apart.
 */

export interface KnownMonster {
  name: string;
  icon: string;
  creatureType: string;
  appearance?: string;
  appearanceHex?: string | null;
}

export interface MentionSpan {
  /** Offsets into the searched text; `[start, end)` covers the icon only. */
  start: number;
  end: number;
  monster: KnownMonster;
}

export interface MentionIndex {
  find(text: string): MentionSpan[];
}

const EMPTY: MentionIndex = { find: () => [] };

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isNameChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char);
}

/**
 * One whole emoji grapheme: a flag (a pair of regional indicators), or a pictograph with an
 * optional variation selector or skin-tone modifier, subdivision-flag tags, and any number of
 * ZWJ-joined parts. The first version stopped at the base pictograph, so a custom icon like
 * `💪🏽` read as `💪` and `🇨🇦` as `🇨` — the hit/miss cluster then failed to parse and those
 * monsters kept their emoji in exactly the lines that matter most.
 */
const EMOJI_PART = '(?:\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})?[\\u{E0020}-\\u{E007F}]*)';
const EMOJI = `(?:\\p{Regional_Indicator}{2}|${EMOJI_PART}(?:\\u200D${EMOJI_PART})*)`;
/** One emoji at the very end of `text`. */
const TRAILING_EMOJI = new RegExp(`${EMOJI}$`, 'u');
/** One emoji at the very start of `text`. */
const LEADING_EMOJI = new RegExp(`^${EMOJI}`, 'u');
const GAP = /[\s*_]*$/;

/**
 * Builds a matcher for the monsters a room has seen. Rebuild when the set changes; `find` is
 * then cheap enough to run on every rendered line.
 */
export function buildMentionIndex(
  monsters: readonly KnownMonster[],
  /**
   * Names of Beastmasters seen in the same room. Card drops and item use print a
   * Beastmaster's identity exactly like a monster's (`🐍 Gin`), and character and monster
   * names are checked for uniqueness separately — so a Beastmaster and a monster can share a
   * name *and* an icon. Rule 1 cannot tell them apart, so it leaves a shared name alone:
   * Beastmasters have no sprites, and an emoji is the safe failure. Rule 2 is unaffected;
   * the hit/miss cluster only ever holds monsters.
   */
  beastmasterNames: readonly string[] = [],
): MentionIndex {
  const usable = monsters.filter((monster) => monster.name && monster.icon);
  if (usable.length === 0) return EMPTY;
  const ambiguous = new Set(beastmasterNames);
  // Longest first, so a slot holding `💪🏽` is not read as a `💪` monster.
  const icons = [...new Set(usable.map((monster) => monster.icon))].sort((a, b) => b.length - a.length);

  const byName = new Map(usable.map((monster) => [monster.name, monster]));
  // Longest first, so "Gin & Tonic" wins over a monster called "Gin".
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  const namePattern = new RegExp(names.map(escapeRegExp).join('|'), 'gu');

  function namesIn(text: string, from = 0): Array<{ index: number; monster: KnownMonster }> {
    const found: Array<{ index: number; monster: KnownMonster }> = [];
    namePattern.lastIndex = from;
    let match = namePattern.exec(text);
    while (match !== null) {
      const end = match.index + match[0].length;
      // Whole names only: "Kaa" must not match inside "Kaaba".
      if (!isNameChar(text[match.index - 1]) && !isNameChar(text[end])) {
        found.push({ index: match.index, monster: byName.get(match[0])! });
      }
      namePattern.lastIndex = match.index + 1;
      match = namePattern.exec(text);
    }
    return found;
  }

  return {
    find(text) {
      const spans = new Map<number, MentionSpan>();
      const add = (start: number, monster: KnownMonster) => {
        spans.set(start, { start, end: start + monster.icon.length, monster });
      };

      // Rule 1 — icon before its own name.
      for (const { index, monster } of namesIn(text)) {
        if (ambiguous.has(monster.name)) continue;
        let cursor = index - (text.slice(0, index).match(GAP)?.[0].length ?? 0);
        if (text.slice(cursor - monster.icon.length, cursor) === monster.icon) {
          add(cursor - monster.icon.length, monster);
          continue;
        }
        // One other emoji may sit between: the heal line's 💊.
        const between = text.slice(0, cursor).match(TRAILING_EMOJI)?.[0];
        if (!between) continue;
        cursor -= between.length;
        cursor -= text.slice(0, cursor).match(GAP)?.[0].length ?? 0;
        if (text.slice(cursor - monster.icon.length, cursor) === monster.icon) {
          add(cursor - monster.icon.length, monster);
        }
      }

      // Rule 2 — the hit/miss cluster: three emoji, single-spaced, then two or more spaces.
      // Anchored to the start of the segment, because hit.ts and miss.ts both open their text
      // with it. If a template ever puts the cluster mid-line, this rule needs to search.
      // Runs after rule 1 and overwrites it on purpose: in `💪 🔪 💪  Ben hits Max`, rule 1
      // alone pins the third 💪 to Ben (it sits right before his name); only the cluster
      // knows that slot is the target's.
      const cluster: Array<{ start: number; text: string }> = [];
      let cursor = text.match(/^\s*/)?.[0].length ?? 0;
      for (let slot = 0; slot < 3; slot += 1) {
        // A known icon first: it may be any string a player typed, not just one emoji.
        const rest = text.slice(cursor);
        const emoji = icons.find((icon) => rest.startsWith(icon)) ?? rest.match(LEADING_EMOJI)?.[0];
        if (!emoji) break;
        cluster.push({ start: cursor, text: emoji });
        cursor += emoji.length;
        if (slot < 2) {
          if (text[cursor] !== ' ') break;
          cursor += 1;
        }
      }
      if (cluster.length === 3 && /^ {2,}/.test(text.slice(cursor))) {
        const named = namesIn(text, cursor);
        const attacker = named[0]?.monster;
        const target = named.find(({ monster }) => monster !== attacker)?.monster ?? attacker;
        if (attacker && cluster[0]!.text === attacker.icon) add(cluster[0]!.start, attacker);
        if (target && cluster[2]!.text === target.icon) add(cluster[2]!.start, target);
      }

      return [...spans.values()].sort((a, b) => a.start - b.start);
    },
  };
}
