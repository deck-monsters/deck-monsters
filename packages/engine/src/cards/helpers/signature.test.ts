import { expect } from 'chai';
import sinon from 'sinon';

import Game from '../../game.js';
import Jinn from '../../monsters/jinn.js';
import Dragon from '../../monsters/dragon.js';
import { SandstormCard } from '../sandstorm.js';
import { HitCard } from '../hit.js';
import { SIGNATURE_CARD_TYPES, makeSignatureCard, ownsCardType } from './signature.js';

/**
 * A winner whose owner holds no copy of its signature card very likely wins one; once a
 * copy is owned, the drop is the normal draw (owner, roadmap 33).
 */
describe('./cards/helpers/signature.ts', () => {
	let game: Game;
	beforeEach(() => {
		game = new Game({ roomId: 'signature-drop' }, () => {});
	});
	afterEach(() => {
		sinon.restore();
		game.dispose();
	});

	it('names a signature card every monster in the starting deck can hold', () => {
		for (const [creatureType, cardType] of Object.entries(SIGNATURE_CARD_TYPES)) {
			const card = makeSignatureCard({ creatureType });
			expect(card?.cardType, creatureType).to.equal(cardType);
		}
	});

	it('drops the signature card while the owner has none', () => {
		const monster = new Jinn({ name: 'sandy' });
		const character: any = { deck: [new HitCard()], monsters: [monster] };
		sinon.stub(Math, 'random').returns(0);
		expect(game.drawWinnerCard(character, monster).cardType).to.equal('Sandstorm');
	});

	it('counts a copy that is equipped, not only one in the deck', () => {
		const monster = new Jinn({ name: 'sandy' });
		monster.cards = [new SandstormCard()];
		const character: any = { deck: [], monsters: [monster] };
		expect(ownsCardType(character, 'Sandstorm')).to.equal(true);
		const draw = sinon.spy(game, 'drawCard');
		game.drawWinnerCard(character, monster);
		expect(draw.calledOnce).to.equal(true);
	});

	it('goes back to the normal draw once a copy is owned', () => {
		const monster = new Dragon({ name: 'smaug' });
		const character: any = { deck: [makeSignatureCard(monster)], monsters: [monster] };
		const draw = sinon.spy(game, 'drawCard');
		game.drawWinnerCard(character, monster);
		expect(draw.calledOnce).to.equal(true);
	});

	it('leaves the other 10% to the normal draw', () => {
		const monster = new Jinn({ name: 'sandy' });
		const character: any = { deck: [], monsters: [monster] };
		sinon.stub(Math, 'random').returns(0.95);
		const draw = sinon.stub(game, 'drawCard').returns(new HitCard());
		expect(game.drawWinnerCard(character, monster).cardType).to.equal('Hit');
		expect(draw.calledOnce).to.equal(true);
	});
});
