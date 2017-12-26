const { expect } = require('../shared/test-setup');

const { calculateXP, BASE_XP_PER_KILL } = require('./experience');

describe('./helpers/experience.js', () => {
	describe.only('calculateXP', () => {
		it('assigns more XP if you kill a higher level monster', () => {
			const constestant1 = {
				monster: {
					level: 2
				}
			};
			const constestant2 = {
				monster: {
					level: 1
				},
				killed: [constestant1]
			};

			const contestants = [constestant1, constestant2]

			expect(calculateXP(constestant2, contestants)).to.be.greaterThan(BASE_XP_PER_KILL);
		});

		it('assigns less XP if you kill a lower level monster', () => {
			const monster = {
				level: 2
			};
			const killed = [{
				level: 1
			}];

			expect(calculateXP(monster, killed)).to.be.lessThan(BASE_XP_PER_KILL);
		});

		it('assigns no XP if you kill a monster that is 5 or more levels lower', () => {
			const monster = {
				level: 6
			};
			const killed = [{
				level: 1
			}];

			expect(calculateXP(monster, killed)).to.equal(0);
		});

		it('assigns XP if you are killed by a higher level monster', () => {
			const monster = {
				level: 1
			};
			const killed = [{
				level: 2
			}];

			expect(calculateXP(monster, killed)).to.be.greaterThan(BASE_XP_PER_KILL);
		});
	});
});
