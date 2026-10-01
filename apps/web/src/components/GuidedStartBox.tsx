import { BOSS_SUMMON_LIMIT } from '@deck-monsters/engine';
import type { GuidedPhase } from '../hooks/useGuidedStart.js';

/**
 * The getting-started box, shared by the Console and the Workshop (both read
 * `useGuidedStart`). The Console version has a command chip and a hint; the Workshop
 * version is words only, because its buttons are already on the monsters below it.
 * Wording is the orchestrator's (docs/roadmap/39-in-game-help.md, batch 3, C3).
 */
export interface GuidedStartBoxProps {
	surface: 'console' | 'workshop';
	phase: GuidedPhase;
	name: string;
	slots: number;
	dismiss: () => void;
	/** Console only: runs the chip's command. */
	onRun?: (command: string) => void;
}

interface Copy {
	text: string;
	chip?: string;
	hint?: string;
}

const bossLimit: number = BOSS_SUMMON_LIMIT;
const bosses = `${bossLimit} ${bossLimit === 1 ? 'boss' : 'bosses'}`;

export function guidedCopy(surface: 'console' | 'workshop', phase: GuidedPhase, name: string, slots: number): Copy | null {
	const console_ = surface === 'console';
	switch (phase) {
		case 'spawn':
			if (!console_) return null;
			return {
				text: 'Welcome, Beastmaster. Train your first monster to begin.',
				chip: 'train a monster',
				hint: 'New here? Help and guides in the ☰ menu has the rules.',
			};
		case 'equip':
			return console_
				? { text: `Give ${name} a full deck of ${slots} cards.`, chip: `equip ${name}`, hint: 'Or use the Workshop: tap an empty slot to add cards.' }
				: { text: `Give ${name} a full deck: tap an empty slot to add cards until all ${slots} are filled.` };
		case 'send':
			return console_
				? { text: `${name}'s deck is full. Send ${name} to the ring.`, chip: `send ${name} to the ring` }
				: { text: `${name}'s deck is full. Press Send to ring.` };
		case 'waiting':
			return console_
				? {
					text: `${name} is in the ring. A fight starts when a second monster joins. Nobody else here? Summon a boss.`,
					chip: 'summon a boss',
					hint: `You can summon ${bosses} a day.`,
				}
				: { text: `${name} is in the ring. A fight starts when a second monster joins. Nobody else here? Type summon a boss in the Console.` };
		case 'fallen':
			return console_
				? { text: `${name} has fallen. Revive ${name} to fight again.`, chip: `revive ${name}`, hint: 'Above level 0, a revival takes a few minutes.' }
				: { text: `${name} has fallen. Press Revive to bring ${name} back.` };
		case 'change_card':
			return console_
				? { text: `${name} has fought a fight. Now try changing a card. Type help unequip to see how, or use the Workshop.`, chip: 'help unequip' }
				// DRAFT(39): the Workshop moves a card by selecting it and tapping a destination slot or the inventory drop zone (drag and drop on desktop); "tap one of {name}'s cards, then tap an empty slot or your cards" matches that.
				: { text: `${name} has fought a fight. Now try changing a card: tap one of ${name}'s cards, then tap an empty slot or your cards to move it.` };
		default:
			return null;
	}
}

export default function GuidedStartBox({ surface, phase, name, slots, dismiss, onRun }: GuidedStartBoxProps) {
	const copy = guidedCopy(surface, phase, name, slots);
	if (!copy) return null;
	return (
		<section className="ftux-guide" aria-label="Getting started guide">
			<button
				onClick={dismiss}
				aria-label="Dismiss guide"
				title="Dismiss guide"
				style={{
					position: 'absolute',
					top: 0,
					right: 0,
					background: 'transparent',
					border: 'none',
					color: 'var(--color-fg-dim)',
					cursor: 'pointer',
					fontSize: '0.75rem',
					padding: '0 0.25rem',
					lineHeight: 1,
				}}
			>
				✕
			</button>
			<p className="ftux-guide-copy">{copy.text}</p>
			{copy.chip && onRun && (
				<div className="ftux-guide-actions">
					<button title={`Run: ${copy.chip}`} className="quick-action-chip" onClick={() => onRun(copy.chip!)}>
						{copy.chip}
					</button>
				</div>
			)}
			{copy.hint && onRun && <p className="ftux-guide-hint">{copy.hint}</p>}
		</section>
	);
}
