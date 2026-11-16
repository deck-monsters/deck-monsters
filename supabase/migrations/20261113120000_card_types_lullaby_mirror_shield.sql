-- Lullaby and Mirror Shield (roadmap 52 E2). A new card needs a card_types row so the operator
-- views name it; room-state-views.test.ts fails without one (docs/architecture/rooms-and-identity.md).
insert into public.card_types (class_name, card_type) values
  ('LullabyCard', 'Lullaby'),
  ('MirrorShieldCard', 'Mirror Shield')
on conflict (class_name) do update set card_type = excluded.card_type;
