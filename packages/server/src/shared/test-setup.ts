// Set DATABASE_URL before any test file is loaded so that db/index.ts can import
// without throwing. Tests that touch the database inject a mock db instance and
// never use the real pool.
process.env['DATABASE_URL'] ??= 'postgresql://localhost/test-placeholder';

import { use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);
