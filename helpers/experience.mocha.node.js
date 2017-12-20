const { expect } = require('../shared/test-setup');

const { calculateXP, BASE_XP_PER_KILL } = require('./experience');

describe('./helpers/experience.js', () => {
	describe('calculateXP', () => {
		it('assigns more XP if you kill a higher level monster', () => {
			const monster = {
				level: 1,
				killed: [{
					level: 2
				}]
			};

			expect(calculateXP(monster)).to.be.greaterThan(BASE_XP_PER_KILL);
		});

		it('assigns less XP if you kill a lower level monster', () => {
			const monster = {
				level: 2,
				killed: [{
					level: 1
				}]
			};

			expect(calculateXP(monster)).to.be.lessThan(BASE_XP_PER_KILL);
		});

		it('assigns no XP if you kill a monster that is 5 or more levels lower', () => {
			const monster = {
				level: 6,
				killed: [{
					level: 1
				}]
			};

			expect(calculateXP(monster)).to.equal(0);
		});
	});
});
