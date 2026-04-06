import { formatCommandList } from './catalog.js';

const HELP_REGEX = /^(?:help|commands?)$/i;

function helpAction({ channel }: any): Promise<unknown> {
	return channel({ announce: formatCommandList() });
}

const helpHandler = {
	matcher: HELP_REGEX,
	action: helpAction,
};

export default helpHandler;
export { helpHandler };
