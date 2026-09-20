import { expect } from 'chai';
import { TRPCError } from '@trpc/server';
import sinon from 'sinon';

import { createProfileRouter } from './profile.js';

const USER_ID = '11111111-2222-3333-4444-555555555555';

type ProfileRow = { displayName: string };

function makeDbStub(profileRows: ProfileRow[]) {
	const limitStub = sinon.stub().resolves(profileRows);
	const whereStub = sinon.stub().returns({ limit: limitStub });
	const fromStub = sinon.stub().returns({ where: whereStub });
	const selectStub = sinon.stub().returns({ from: fromStub });
	const updateWhereStub = sinon.stub().resolves([]);
	const setStub = sinon.stub().returns({ where: updateWhereStub });
	const updateStub = sinon.stub().returns({ set: setStub });

	return {
		select: selectStub,
		update: updateStub,
		_stubs: { limitStub, whereStub, selectStub, updateStub, setStub, updateWhereStub },
	};
}

function makeRoomManager(rooms: Array<{ roomId: string }> = [], games = new Map<string, unknown>()) {
	return {
		listRoomsForUser: sinon.stub().resolves(rooms),
		getGame: sinon.stub().callsFake(async (roomId: string) => {
			const game = games.get(roomId);
			if (!game) throw new Error(`missing ${roomId}`);
			return game;
		}),
		runSerializedEngineWork: sinon.stub().callsFake(async (_roomId: string, work: () => Promise<unknown>) => work()),
	};
}

function createCaller(db: ReturnType<typeof makeDbStub>, roomManager = makeRoomManager()) {
	return {
		caller: createProfileRouter({
			db: db as never,
			roomManager: roomManager as never,
		}).createCaller({ userId: USER_ID, serviceTokenValid: false }),
		roomManager,
	};
}

function makeConcurrentProfileDb(initialDisplayName: string) {
	let displayName = initialDisplayName;
	let releaseSelects!: () => void;
	const selectsReleased = new Promise<void>((resolve) => {
		releaseSelects = resolve;
	});
	let pendingDisplayName: string | undefined;

	const updateWhereStub = sinon.stub().callsFake(async () => {
		displayName = pendingDisplayName!;
		return [];
	});
	const setStub = sinon.stub().callsFake(({ displayName: nextDisplayName }: ProfileRow) => {
		pendingDisplayName = nextDisplayName;
		return { where: updateWhereStub };
	});
	const updateStub = sinon.stub().returns({ set: setStub });
	const selectStub = sinon.stub().returns({
		from: sinon.stub().returns({
			where: sinon.stub().returns({
				limit: sinon.stub().callsFake(
					() =>
						selectsReleased.then(() => [{ displayName }])
				),
			}),
		}),
	});

	return {
		db: { select: selectStub, update: updateStub },
		resolvePendingSelects() {
			releaseSelects();
		},
		get displayName() {
			return displayName;
		},
	};
}

describe('trpc/profile', () => {
	afterEach(() => {
		sinon.restore();
	});

	it('returns a masked global display name for profile.me', async () => {
		const { caller } = createCaller(makeDbStub([{ displayName: 'ada+test@example.com' }]));

		expect(await caller.me()).to.deep.equal({ displayName: 'ada' });
	});

	it('trims and saves the updated display name', async () => {
		const db = makeDbStub([{ displayName: 'Ada Lovelace' }]);
		const { caller } = createCaller(db);

		expect(await caller.updateDisplayName({ displayName: '  Grace Hopper  ' })).to.deep.equal({
			displayName: 'Grace Hopper',
			renamedCharacters: 0,
		});
		expect(db._stubs.setStub).to.have.been.calledWith({ displayName: 'Grace Hopper' });
	});

	for (const [label, displayName, message] of [
		['email-like value', 'ada@example.com', "Display names can't look like an email address."],
		['at-sign value', '@stary', "Display names can't look like an email address."],
		['too-short value', 'A'],
		['too-long value', 'A'.repeat(33)],
		['punctuation-only value', '?! —', 'Display names must include a letter or number.'],
	] as const) {
		it(`rejects a ${label}`, async () => {
			const { caller } = createCaller(makeDbStub([{ displayName: 'Ada Lovelace' }]));

			const error = await caller.updateDisplayName({ displayName }).catch((err: unknown) => err);

			expect(error).to.be.instanceOf(TRPCError);
			expect((error as TRPCError).code).to.equal('BAD_REQUEST');
			if (message) expect((error as TRPCError).message).to.equal(message);
		});
	}

	it('renames only room characters that still match the previous global display name', async () => {
		const matchingCharacter = {
			givenName: 'Ada Lovelace',
			setOptions: sinon.stub(),
		};
		const renamedCharacter = {
			givenName: 'Ring Alias',
			setOptions: sinon.stub(),
		};
		const matchingGame = {
			characters: { [USER_ID]: matchingCharacter },
			emit: sinon.stub(),
		};
		const renamedGame = {
			characters: { [USER_ID]: renamedCharacter },
			emit: sinon.stub(),
		};
		const rooms = [{ roomId: 'room-one' }, { roomId: 'room-two' }];
		const games = new Map<string, unknown>([
			['room-one', matchingGame],
			['room-two', renamedGame],
		]);
		const { caller } = createCaller(makeDbStub([{ displayName: 'Ada Lovelace' }]), makeRoomManager(rooms, games));

		expect(await caller.updateDisplayName({ displayName: 'Grace Hopper' })).to.deep.equal({
			displayName: 'Grace Hopper',
			renamedCharacters: 1,
		});
		expect(matchingCharacter.setOptions).to.have.been.calledOnceWith({ name: 'Grace Hopper' });
		expect(matchingGame.emit).to.have.been.calledOnceWith('stateChange', { character: matchingCharacter });
		expect(renamedCharacter.setOptions).not.to.have.been.called;
	});

	it('renames a room character seeded with the masked prior display name', async () => {
		const character = {
			givenName: 'ada',
			setOptions: sinon.stub(),
		};
		const game = { characters: { [USER_ID]: character }, emit: sinon.stub() };
		const { caller } = createCaller(
			makeDbStub([{ displayName: 'ada+test@example.com' }]),
			makeRoomManager([{ roomId: 'room-one' }], new Map([['room-one', game]]))
		);

		expect(await caller.updateDisplayName({ displayName: 'Grace Hopper' })).to.deep.equal({
			displayName: 'Grace Hopper',
			renamedCharacters: 1,
		});
		expect(character.setOptions).to.have.been.calledOnceWith({ name: 'Grace Hopper' });
	});

	it('does not rename a character whose name differs by surrounding whitespace', async () => {
		const character = {
			givenName: ' Ada Lovelace ',
			setOptions: sinon.stub(),
		};
		const game = { characters: { [USER_ID]: character }, emit: sinon.stub() };
		const { caller } = createCaller(
			makeDbStub([{ displayName: 'Ada Lovelace' }]),
			makeRoomManager([{ roomId: 'room-one' }], new Map([['room-one', game]]))
		);

		expect(await caller.updateDisplayName({ displayName: 'Grace Hopper' })).to.deep.equal({
			displayName: 'Grace Hopper',
			renamedCharacters: 0,
		});
		expect(character.setOptions).not.to.have.been.called;
	});

	it('serializes concurrent profile updates before propagating character names', async () => {
		const character = { givenName: 'Ada Lovelace', setOptions: sinon.stub() };
		character.setOptions.callsFake(({ name }: { name: string }) => {
			character.givenName = name;
		});
		const game = { characters: { [USER_ID]: character }, emit: sinon.stub() };
		const database = makeConcurrentProfileDb('Ada Lovelace');
		const { caller } = createCaller(
			database.db as ReturnType<typeof makeDbStub>,
			makeRoomManager([{ roomId: 'room-one' }], new Map([['room-one', game]]))
		);

		const first = caller.updateDisplayName({ displayName: 'Grace Hopper' });
		const second = caller.updateDisplayName({ displayName: 'Katherine Johnson' });
		await Promise.resolve();
		database.resolvePendingSelects();

		await Promise.all([first, second]);

		expect(database.displayName).to.equal('Katherine Johnson');
		expect(character.setOptions).to.have.been.calledTwice;
		expect(character.setOptions.secondCall).to.have.been.calledWith({ name: 'Katherine Johnson' });
		expect(character.givenName).to.equal('Katherine Johnson');
	});

	it('continues when a member room cannot be loaded', async () => {
		const db = makeDbStub([{ displayName: 'Ada Lovelace' }]);
		const roomManager = makeRoomManager([{ roomId: 'unavailable-room' }]);
		const { caller } = createCaller(db, roomManager);

		expect(await caller.updateDisplayName({ displayName: 'Grace Hopper' })).to.deep.equal({
			displayName: 'Grace Hopper',
			renamedCharacters: 0,
		});
		expect(db._stubs.setStub).to.have.been.calledOnceWith({ displayName: 'Grace Hopper' });
	});
});
