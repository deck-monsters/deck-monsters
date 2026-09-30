import { expect } from 'chai';

// The *.pg.test.ts suites skip themselves when TEST_DATABASE_URL is unset, so for months CI
// "passed" them without a database (roadmap 10, item H). CI now provides one; this fails the run
// if it ever goes missing again, instead of the suites quietly skipping.
describe('real-Postgres test gate', () => {
	it('has TEST_DATABASE_URL when running in CI', function () {
		if (process.env['CI'] !== 'true') this.skip();
		expect(process.env['TEST_DATABASE_URL'], 'CI must set TEST_DATABASE_URL (see .github/workflows/ci.yml)').to.be.a(
			'string'
		).and.not.be.empty;
	});
});
