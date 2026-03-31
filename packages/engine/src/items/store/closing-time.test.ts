import { expect } from 'chai';

import { getClosingTime } from './closing-time.js';

const pronouns = { he: 'she', him: 'her', his: 'her' };

describe('./items/store/closing-time.ts', () => {
	it('tells you closes in 8 hours', () => {
		const now = new Date();
		const closingTime = getClosingTime({ closingTime: new Date(now.setHours(now.getHours() + 8)), pronouns });

		expect(closingTime).to.include('8 hours');
	});

	it('tells you closes in 4 hours', () => {
		const now = new Date();
		const closingTime = getClosingTime({ closingTime: new Date(now.setHours(now.getHours() + 4)), pronouns });

		expect(closingTime).to.include('4 hours');
	});

	it('tells you closes in 2.5 hours', () => {
		let now = new Date();
		now = new Date(now.setHours(now.getHours() + 4));
		const later = new Date(now.setMinutes(now.getMinutes() + 30));
		const closingTime = getClosingTime({ closingTime: later, pronouns });

		expect(closingTime).to.include('4 and a half hours');
	});

	it('tells you closes in about an hour', () => {
		const now = new Date();
		const closingTime = getClosingTime({ closingTime: new Date(now.setMinutes(now.getMinutes() + 55)), pronouns });

		expect(closingTime).to.include('about an hour');
	});

	it('tells you closes in about half an hour', () => {
		const now = new Date();
		const closingTime = getClosingTime({ closingTime: new Date(now.setMinutes(now.getMinutes() + 30)), pronouns });

		expect(closingTime).to.include('about half an hour');
	});

	it('tells you closes in a few minutes', () => {
		const now = new Date();
		const closingTime = getClosingTime({ closingTime: new Date(now.setMinutes(now.getMinutes() + 10)), pronouns });

		expect(closingTime).to.include('a few minutes');
	});

	it('tells you closes now', () => {
		const now = new Date();
		const closingTime = getClosingTime({ closingTime: new Date(now.setMinutes(now.getMinutes() + 1)), pronouns });

		expect(closingTime).to.include('actually, we are closing right now');
	});
});
