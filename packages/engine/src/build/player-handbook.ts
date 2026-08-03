import {
	collectPlayerHandbookMarkdown,
	collectPlayerHandbookSections,
} from './player-handbook-content.js';

type ChannelFn = (opts: { announce: string }) => Promise<unknown>;

export const playerHandbook = (channel: ChannelFn): Promise<unknown> =>
	collectPlayerHandbookSections().reduce<Promise<unknown>>(
		(promise, section) => promise.then(() => channel({ announce: section })),
		Promise.resolve()
	);

export { collectPlayerHandbookMarkdown, collectPlayerHandbookSections };
export default playerHandbook;
