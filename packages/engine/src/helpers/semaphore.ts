import { EventEmitter } from 'node:events';

export const globalSemaphore = new EventEmitter();

export { EventEmitter };
