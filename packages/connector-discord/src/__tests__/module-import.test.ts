import { expect } from 'chai';
import { spawnSync } from 'node:child_process';

describe('connector module imports', () => {
	it('imports DiscordBot without requiring server database configuration', () => {
		const env = { ...process.env };
		delete env['DATABASE_URL'];

		const botModuleUrl = new URL('../bot.js', import.meta.url).href;
		const result = spawnSync(
			process.execPath,
			[
				'--import',
				'tsx',
				'--input-type=module',
				'--eval',
				`await import(${JSON.stringify(botModuleUrl)})`,
			],
			{ env, encoding: 'utf8' }
		);

		expect(result.stderr).to.equal('');
		expect(result.status).to.equal(0);
	});
});
