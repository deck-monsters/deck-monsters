import { expect } from 'chai';
import { spawnSync } from 'node:child_process';

describe('connector module imports', () => {
	it('imports DiscordBot without requiring server database configuration', () => {
		const env = { ...process.env };
		delete env['DATABASE_URL'];

		const botModuleUrl = new URL('../bot.js', import.meta.url).href;
		// `isCommandRefusal` is a runtime value import from the engine, which
		// triggers the engine's lazy-helper initialisation and keeps the event loop
		// alive until the helpers resolve. We only need to verify that the import
		// does not throw; process.exit(0) forces a clean exit immediately after a
		// successful import so the test does not block on the engine's async setup.
		const result = spawnSync(
			process.execPath,
			[
				'--import',
				'tsx',
				'--input-type=module',
				'--eval',
				`await import(${JSON.stringify(botModuleUrl)}); process.exit(0);`,
			],
			{ env, encoding: 'utf8' }
		);

		expect(result.stderr).to.equal('');
		expect(result.status).to.equal(0);
	});
});
