import {
	pgTable,
	uuid,
	text,
	timestamp,
	bigserial,
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
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index('room_events_room_id_id_idx').on(t.roomId, t.id)]
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
	},
	(t) => [primaryKey({ columns: [t.roomId, t.userId] })]
);
