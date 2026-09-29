import { expect } from 'chai';

import { parseMigrationFilename } from './migrate.js';

describe('parseMigrationFilename', () => {
	it('splits version and name at the first underscore', () => {
		expect(parseMigrationFilename('20260101000000_initial.sql')).to.deep.equal({
			version: '20260101000000',
			name: 'initial',
			filename: '20260101000000_initial.sql',
		});
		expect(parseMigrationFilename('20260407120000_room_events_unique_event_id.sql')?.name).to.equal(
			'room_events_unique_event_id'
		);
	});

	it('ignores files that are not migrations', () => {
		expect(parseMigrationFilename('README.md')).to.equal(null);
		expect(parseMigrationFilename('notes_2026.sql')).to.equal(null);
	});

	it('orders by filename, which is by version', () => {
		const names = ['20260401000000_b.sql', '20260101000000_a.sql', '20260917000000_c.sql'];
		const sorted = [...names].sort().map((n) => parseMigrationFilename(n)!.version);
		expect(sorted).to.deep.equal(['20260101000000', '20260401000000', '20260917000000']);
	});
});
