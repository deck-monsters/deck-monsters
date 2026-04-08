// Zero out all delay functions for the duration of the test run so that fight
// tests complete in milliseconds rather than accumulating seconds of real-time
// pacing.  Must be set before any spec file is evaluated (delay-times checks
// the var at call time, so this is safe even after module load).
process.env.DECK_MONSTERS_SKIP_DELAYS = '1';

import { use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

import { helpersReady } from '../characters/helpers/random.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

// Ensure the async dynamic helpers (monster classes, colors, emoji, deck) are
// fully loaded before any test runs.  Without this, randomCharacter() may
// return a character with zero monsters when the module's fire-and-forget
// loadHelpers() call has not yet resolved — a race condition that surfaces in
// CI where test startup is faster than the local warm-cache baseline.
before(async () => {
	await helpersReady;
});
