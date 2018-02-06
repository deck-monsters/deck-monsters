/* eslint-disable max-len */

const { expect } = require('../../shared/test-setup');

const getClosingTime = require('./closing-time');

describe('./items/store/closing-time.js', () => {
	it('tells you closes in 8 hours', () => {
		const now = new Date();
		const closingTime = getClosingTime({ closingTime: now.setHours(now.getHours() + 8), pronouns: { he: 'she', him: 'her', his: 'her' } });

		expect(closingTime).to.include('8 hours');
	});

	it('tells you closes in 4 hours', () => {
		const now = new Date();
		const closingTime = getClosingTime({ closingTime: now.setHours(now.getHours() + 4), pronouns: { he: 'she', him: 'her', his: 'her' } });

		expect(closingTime).to.include('4 hours');
	});

	it('tells you closes in 2.5 hours', () => {
		let now = new Date();
		now = new Date(now.setHours(now.getHours() + 4));
		now = now.setMinutes(now.getMinutes() + 30);
		const closingTime = getClosingTime({ closingTime: now, pronouns: { he: 'she', him: 'her', his: 'her' } });

		expect(closingTime).to.include('4 and a half hours');
	});

	it('tells you closes in about an hour', () => {
		let now = new Date();
		now = now.setMinutes(now.getMinutes() + 55);
		const closingTime = getClosingTime({ closingTime: now, pronouns: { he: 'she', him: 'her', his: 'her' } });

		expect(closingTime).to.include('about an hour');
	});

	it('tells you closes in about half an hour', () => {
		let now = new Date();
		now = now.setMinutes(now.getMinutes() + 30);
		const closingTime = getClosingTime({ closingTime: now, pronouns: { he: 'she', him: 'her', his: 'her' } });

		expect(closingTime).to.include('about half an hour');
	});

	it('tells you closes in a few minutes', () => {
		let now = new Date();
		now = now.setMinutes(now.getMinutes() + 10);
		const closingTime = getClosingTime({ closingTime: now, pronouns: { he: 'she', him: 'her', his: 'her' } });

		expect(closingTime).to.include('a few minutes');
	});

	it('tells you closes now', () => {
		let now = new Date();
		now = now.setMinutes(now.getMinutes() + 1);
		const closingTime = getClosingTime({ closingTime: now, pronouns: { he: 'she', him: 'her', his: 'her' } });

		expect(closingTime).to.include('actually, we are closing right now');
	});
});
