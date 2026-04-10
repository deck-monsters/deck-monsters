import {
	pgTable,
	uuid,
	text,
	timestamp,
	bigserial,
	integer,
	jsonb,
	boolean,
	primaryKey,
	unique,
	index,
} from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
	id: uuid('id').primaryKey(),
	displayName: text('display_name').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userConnectors = pgTable(
	'user_connectors',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => profiles.id, { onDelete: 'cascade' }),
		connectorType: text('connector_type').notNull(),
		externalId: text('external_id').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [unique('user_connectors_type_external_id_key').on(t.connectorType, t.externalId)]
);

export const rooms = pgTable('rooms', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	ownerId: uuid('owner_id')
		.notNull()
		.references(() => profiles.id),
	inviteCode: text('invite_code').notNull().unique(),
	stateBlob: text('state_blob'),
	quarantinedBlob: text('quarantined_blob'),
	fightCounter: integer('fight_counter').notNull().default(0),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roomEvents = pgTable(
	'room_events',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		roomId: uuid('room_id')
			.notNull()
			.references(() => rooms.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		scope: text('scope').notNull(),
		targetUserId: uuid('target_user_id'),
		payload: jsonb('payload').notNull().default({}),
		text: text('text').notNull().default(''),
		eventId: text('event_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index('room_events_room_id_id_idx').on(t.roomId, t.id),
		unique('room_events_room_id_event_id_key').on(t.roomId, t.eventId),
	]
);

export const guildRooms = pgTable(
	'guild_rooms',
	{
		guildId: text('guild_id').notNull(),
		roomId: uuid('room_id')
			.notNull()
			.references(() => rooms.id, { onDelete: 'cascade' }),
		channelId: text('channel_id'),
		isDefault: boolean('is_default').notNull().default(true),
	},
	(t) => [primaryKey({ columns: [t.guildId, t.roomId] })]
);

export const roomMembers = pgTable(
	'room_members',
	{
		roomId: uuid('room_id')
			.notNull()
			.references(() => rooms.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => profiles.id, { onDelete: 'cascade' }),
		joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
		role: text('role').notNull().default('member'),
		lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
	},
	(t) => [primaryKey({ columns: [t.roomId, t.userId] })]
);

export const roomPlayerStats = pgTable(
	'room_player_stats',
	{
		roomId: uuid('room_id')
			.notNull()
			.references(() => rooms.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => profiles.id, { onDelete: 'cascade' }),
		xp: integer('xp').notNull().default(0),
		wins: integer('wins').notNull().default(0),
		losses: integer('losses').notNull().default(0),
		draws: integer('draws').notNull().default(0),
		coinsEarned: integer('coins_earned').notNull().default(0),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.roomId, t.userId] })]
);

export const roomMonsterStats = pgTable(
	'room_monster_stats',
	{
		roomId: uuid('room_id')
			.notNull()
			.references(() => rooms.id, { onDelete: 'cascade' }),
		monsterId: text('monster_id').notNull(),
		ownerUserId: uuid('owner_user_id').references(() => profiles.id, { onDelete: 'set null' }),
		displayName: text('display_name').notNull(),
		monsterType: text('monster_type').notNull(),
		xp: integer('xp').notNull().default(0),
		level: integer('level').notNull().default(1),
		wins: integer('wins').notNull().default(0),
		losses: integer('losses').notNull().default(0),
		draws: integer('draws').notNull().default(0),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.roomId, t.monsterId] })]
);

export const fightSummaries = pgTable(
	'fight_summaries',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		roomId: uuid('room_id')
			.notNull()
			.references(() => rooms.id, { onDelete: 'cascade' }),
		fightNumber: integer('fight_number').notNull(),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
		endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
		outcome: text('outcome').notNull(),
		winnerMonsterId: text('winner_monster_id'),
		winnerMonsterName: text('winner_monster_name'),
		winnerOwnerUserId: uuid('winner_owner_user_id'),
		loserMonsterId: text('loser_monster_id'),
		loserMonsterName: text('loser_monster_name'),
		loserOwnerUserId: uuid('loser_owner_user_id'),
		roundCount: integer('round_count').notNull(),
		winnerXpGained: integer('winner_xp_gained').notNull().default(0),
		loserXpGained: integer('loser_xp_gained').notNull().default(0),
		cardDropName: text('card_drop_name'),
		notableCards: text('notable_cards').array(),
		participants: jsonb('participants').$type<unknown[]>().notNull().default([]),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		unique('fight_summaries_room_fight_number_key').on(t.roomId, t.fightNumber),
		index('fight_summaries_room_ended_idx').on(t.roomId, t.endedAt),
		index('fight_summaries_room_winner_monster_idx').on(t.roomId, t.winnerMonsterId),
		index('fight_summaries_room_loser_monster_idx').on(t.roomId, t.loserMonsterId),
	]
);
