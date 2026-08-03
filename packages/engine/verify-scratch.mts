/* Independent runtime verification of the two P1 findings. */
process.env.DECK_MONSTERS_SKIP_DELAYS = '1';
process.env.DECK_MONSTERS_DETERMINISTIC_RING = '1';

import { engineReady } from './src/helpers/engine-ready.js';
import Game from './src/game.js';
import Basilisk from './src/monsters/basilisk.js';
import Beastmaster from './src/characters/beastmaster.js';
import { RING_EVENTS, ALLIANCE_TEAM } from './src/ring/ring-events.js';
import BlastCard from './src/cards/blast.js';

const ev = (id: string) => RING_EVENTS.find((e) => e.id === id)!;

const addPlayer = (ring: any, id: string) => {
  const character = new Beastmaster();
  const monster = new Basilisk();
  character.addMonster(monster);
  ring.addMonster({ monster, character, userId: id });
  return ring.contestants.find((c: any) => c.monster === monster);
};

async function commonCause() {
  console.log('\n=== P1 #1: Common Cause — do allies turn on each other? ===');
  let alliesFoughtEachOther = 0;
  let rans = 0;

  for (let i = 0; i < 12; i++) {
    const game = new Game({ spawnBosses: false } as any);
    const ring = game.getRing();
    addPlayer(ring, 'p1');
    addPlayer(ring, 'p2');
    ring.spawnBoss();
    ring.ringEvent = ev('common-cause');

    await ring.fight();
    rans++;

    const cs = (ring as any).battles.at(-1)?.contestants ?? [];
    for (const c of cs) {
      if (c.isBoss) continue;
      const killedNames = (c.killed ?? []).map((m: any) => m.givenName);
      const allyNames = cs.filter((o: any) => !o.isBoss && o !== c).map((o: any) => o.monster.givenName);
      if (killedNames.some((n: string) => allyNames.includes(n))) alliesFoughtEachOther++;
    }

    // Survivors must all be one faction.
    const survivors = cs.filter((c: any) => !c.monster.dead && !c.fled);
    const factions = new Set(
      survivors.map((c: any) => c.team || c.monster.team || c.character.team || c.userId)
    );
    if (survivors.length > 0 && factions.size > 1) {
      console.log(`  !! run ${i}: fight ended with ${factions.size} factions still alive`);
    }
    const allies = cs.filter((c: any) => !c.isBoss);
    if (allies.some((c: any) => c.team !== ALLIANCE_TEAM)) {
      console.log(`  !! run ${i}: an ally was missing the Alliance team override`);
    }
    game.dispose();
  }

  console.log(`  ran ${rans} Common Cause fights`);
  console.log(`  ally-killed-ally incidents: ${alliesFoughtEachOther} (expected 0)`);
}

async function bloodFeud() {
  console.log('\n=== P1 #2: Blood Feud — does Blast hit fellow bosses? ===');
  const game = new Game({ spawnBosses: false } as any);
  const ring = game.getRing();
  addPlayer(ring, 'p1');
  const bossA = ring.spawnBoss()!;
  ring.spawnBoss();

  const active = ring.contestants;
  const caster = active.find((c: any) => c.monster === bossA.monster) ?? active.find((c: any) => c.isBoss)!;
  const blast = new BlastCard();

  ring.ringEvent = undefined;
  const withoutEvent = blast.getTargets(caster.monster, null, ring, active);
  console.log(`  no event      -> Blast hits ${withoutEvent.length} of ${active.length - 1} possible`);

  ring.ringEvent = ev('blood-feud');
  ring.ringEvent.apply(active);
  const withEvent = blast.getTargets(caster.monster, null, ring, active);
  console.log(`  Blood Feud    -> Blast hits ${withEvent.length} of ${active.length - 1} possible`);
  console.log(`  ring.encounterFreeForAll = ${ring.encounterFreeForAll}`);

  const otherBossHit = withEvent.some(
    (m: any) => active.some((c: any) => c.isBoss && c.monster === m && c.monster !== caster.monster)
  );
  console.log(`  hits a fellow boss: ${otherBossHit} (expected true)`);
  game.dispose();
}

void (async () => {
  await engineReady;
  await commonCause();
  await bloodFeud();
  console.log('\ndone');
})();
