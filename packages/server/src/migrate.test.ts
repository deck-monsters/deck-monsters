import { expect } from 'chai';

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { defaultMigrationsDir, findForbiddenKeyword, listMigrationFiles, parseMigrationFilename } from './migrate.js';

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

describe('findForbiddenKeyword', () => {
	for (const kw of ['begin', 'commit', 'rollback', 'start transaction', 'savepoint', 'concurrently']) {
		it(`detects ${kw}`, () => {
			const sql = `create table t (id int);\n${kw.toUpperCase()} ${kw === 'concurrently' ? 'x' : ''};`;
			expect(findForbiddenKeyword(sql)).to.equal(kw);
		});
	}

	it('ignores the words in dollar bodies, comments and strings', () => {
		const sql = `
			-- begin; commit;
			/* rollback; /* nested savepoint */ concurrently */
			create function f() returns trigger language plpgsql as $$ begin commit; return new; end $$;
			create function g() returns int language plpgsql as $fn$ begin return 1; end $fn$;
			comment on table t is 'we begin, then commit; it''s not rollback';
			select "begin" from t;
		`;
		expect(findForbiddenKeyword(sql)).to.equal(null);
	});

	it('does not match longer identifiers', () => {
		expect(findForbiddenKeyword('select committed_at, beginning from t;')).to.equal(null);
	});

	it('passes every real repo migration', () => {
		const dir = defaultMigrationsDir();
		for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql'))) {
			expect(findForbiddenKeyword(readFileSync(path.join(dir, f), 'utf8')), f).to.equal(null);
		}
	});
});

describe('listMigrationFiles', () => {
	it('throws on two files with the same name', () => {
		const d = mkdtempSync(path.join(os.tmpdir(), 'dm-mig-'));
		try {
			writeFileSync(path.join(d, '20260101000000_same.sql'), 'select 1;');
			writeFileSync(path.join(d, '20260102000000_same.sql'), 'select 1;');
			expect(() => listMigrationFiles(d)).to.throw(/Duplicate migration name "same"/);
		} finally {
			rmSync(d, { recursive: true, force: true });
		}
	});
});

describe('defaultMigrationsDir', () => {
	it('finds the repo migrations regardless of working directory', () => {
		expect(listMigrationFiles(defaultMigrationsDir())).to.have.length(16);
	});
});
