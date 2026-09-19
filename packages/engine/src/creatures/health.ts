import { capitalize } from '../helpers/capitalize.js';
import { MELEE } from '../constants/card-classes.js';
import { TIME_TO_HEAL_MS, TIME_TO_RESURRECT_MS } from '../constants/timing.js';
import { hitLogTimestamp, subEventDelay } from '../helpers/delay-times.js';
import type { BaseCreature, CardInstance, HitLogEntry } from './base.js';

const encounterSpeed = (creature: BaseCreature): number =>
	(creature.encounter?.ring as { pacingMultiplier?: number } | undefined)?.pacingMultiplier ?? 1;

// Duck-type guard: real creatures have `emit`; the synthetic `{ identityWithHp: 'mysterious causes' }` object does not.
function isRealCreature (assailant: unknown): assailant is BaseCreature {
	return assailant !== undefined && assailant !== null &&
		typeof (assailant as Record<string, unknown>).emit === 'function';
}

export async function hit (self: BaseCreature, damage = 0, assailant?: BaseCreature, card?: CardInstance): Promise<boolean> {
	const hitLog: HitLogEntry[] = (self.encounterModifiers.hitLog as HitLogEntry[]) || [];
	// Same clock as DelayedHit's `whenPlayed`. Under DECK_MONSTERS_SKIP_DELAYS that clock is
	// a monotonic counter, so stamping `Date.now()` here made every hit ever recorded look
	// newer than any Delayed Hit — the card fired on blows that landed before it was played
	// in every test and harness simulation.
	hitLog.unshift({ assailant, damage, card, when: hitLogTimestamp() });
	self.encounterModifiers.hitLog = hitLog;

	const isMelee = card && typeof card.isCardClass === 'function' && card.isCardClass(MELEE);

	if (isMelee && (self.encounterModifiers.ac as number) >= damage) {
		(self.encounterModifiers as Record<string, unknown>).ac = (self.encounterModifiers.ac as number) - damage;

		self.emit('narration', {
			narration: `${self.givenName} was braced for a hit, and was able to absorb ${damage} damage. ${capitalize(self.pronouns.his)} ac boost is now ${self.encounterModifiers.ac}.`
		});
		await subEventDelay(encounterSpeed(self));
	} else {
		let adjustedDamage = damage;

		if (isMelee && (self.encounterModifiers.ac as number) > 0) {
			adjustedDamage -= self.encounterModifiers.ac as number;
			self.emit('narration', {
				narration: `${self.givenName} was braced for a hit, and was able to absorb ${self.encounterModifiers.ac} damage. ${capitalize(self.pronouns.his)} ac boost is now 0.`
			});
			await subEventDelay(encounterSpeed(self));
			(self.encounterModifiers as Record<string, unknown>).ac = 0;
		}

		const newHP = self.hp - adjustedDamage;
		const originalHP = self.hp;
		self.hp = newHP;

		self.emit('hit', { assailant, card, damage: adjustedDamage, newHP, prevHp: originalHP });
		await subEventDelay(encounterSpeed(self));

		if (originalHP > 0 && self.hp <= 0) {
			return self.die(assailant);
		}
	}

	return !self.dead;
}

export async function heal (self: BaseCreature, amount = 0): Promise<boolean> {
	const hp = self.hp + amount;
	const originalHP = self.hp;

	if (hp <= 0) {
		self.hp = 0;
	} else if (hp > self.maxHp) {
		self.hp = self.maxHp;
	} else {
		self.hp = hp;
	}

	self.emit('heal', { amount: self.hp - originalHP, hp: self.hp, prevHp: originalHP });
	await subEventDelay(encounterSpeed(self));

	if (hp <= 0) {
		return self.die(self);
	}

	return true;
}

export async function die (self: BaseCreature, assailant?: BaseCreature): Promise<boolean> {
	if (self.hp > 0) self.hp = 0;

	if (isRealCreature(assailant)) {
		if (!self.killedBy) {
			if (assailant !== (self as unknown as BaseCreature)) assailant.killed = self;
			self.killedBy = assailant;
			self.emit('die', { destroyed: self.destroyed, assailant });
			await subEventDelay(encounterSpeed(self));
		}
	}

	return false;
}

export function respawn (self: BaseCreature, immediate?: boolean): number {
	const now = Date.now();
	const timeoutLength = immediate ? 0 : self.level * TIME_TO_RESURRECT_MS;

	if (immediate || !self.respawnTimeout) {
		if (immediate) {
			// An instant-revival item starts recovery now, not at the beginning of the
			// cancelled natural-revival wait. Also cancel that old callback so it cannot
			// fire a second respawn later.
			if (self.respawnTimeout !== undefined) clearTimeout(self.respawnTimeout);
			self.respawnTimeout = undefined;
			self.respawnTimeoutBegan = now;
		} else {
			self.respawnTimeoutBegan = self.respawnTimeoutBegan || now;
		}
		self.respawnTimeoutLength = Math.max((self.respawnTimeoutBegan + timeoutLength) - now, 0);

		const reviveAt = self.respawnTimeoutBegan + timeoutLength;
		self.respawnTimeout = setTimeout(() => {
			// Timers do not run while a host is sleeping or a room is unloaded. Recover the
			// HP that would have accrued after the scheduled revival instead of restarting
			// the healing clock at one HP when the process wakes hours later.
			const passiveTicks = Math.floor(Math.max(0, Date.now() - reviveAt) / TIME_TO_HEAL_MS);
			const hp = Math.min(self.maxHp, Math.max(1, self.hp) + passiveTicks);
			self.setOptions({ hp, hpUpdatedAt: Date.now() });
			self.respawnTimeout = undefined;
			self.respawnTimeoutBegan = undefined as unknown as number;
			self.emit('respawn');
		}, self.respawnTimeoutLength);
	}

	return self.respawnTimeoutBegan + timeoutLength;
}
