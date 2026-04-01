import { EventEmitter } from 'node:events';

// Unlimited listeners: globalSemaphore is a single process-wide bus that
// accumulates listeners from every active Game instance (stateChange, creature.*,
// ring.*, etc.). The default limit of 10 would fire false-positive leak warnings
// when the test suite creates many Game instances.
export const globalSemaphore = new EventEmitter();
globalSemaphore.setMaxListeners(0);

export { EventEmitter };
