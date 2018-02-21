const lookAtHandlers = require('./look-at');
const monsterHandlers = require('./monster');
const characterHandlers = require('./character');
const storeHandlers = require('./store');

const ALIAS_REGEX = /(.+) as (.+?)\s*$/i;
const handlers = [];

function listen (options) {
	const { game } = options;

	let { command = '' } = options;

	const aliasCheck = command.match(ALIAS_REGEX);
	if (aliasCheck) {
		command = aliasCheck[1];
	}

	command = command.trim().toLowerCase();

	const action = handlers.reduce((result, handler) => result || handler(command), null);

	if (action) {
		return actionOptions => Promise.resolve()
			.then(() => {
				const {
					channel,
					channelName,
					isAdmin
				} = actionOptions;

				let {
					id,
					name
				} = actionOptions;

				if (aliasCheck) {
					if (!isAdmin) {
						return Promise.reject(new Error('Aliases are a debugging feature and are only usable by admins'));
					}

					name = aliasCheck[2];
					id = `${id}_${name}`;
				}

				return game.getCharacter(channel, channelName, { id, name });
			})
			.then(character => action({ character, game, ...actionOptions }));
	}

	return null;
}

function registerHandler (matcher, action) {
	const func = (typeof matcher === 'function') ? matcher : (command = '') => command.match(matcher);

	const handler = (command) => {
		const results = func(command);

		if (results) return options => action({ results, ...options });

		return null;
	};

	handlers.push(handler);
}

function loadHandlers () {
	lookAtHandlers(registerHandler);
	monsterHandlers(registerHandler);
	characterHandlers(registerHandler);
	storeHandlers(registerHandler);
}

module.exports = {
	listen,
	loadHandlers,
	registerHandler
};
