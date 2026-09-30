-- Roadmap 37 task 7: read-only query views over rooms.state.
--
-- For operators and the SQL editor only ("which Dragons own Enchanted Faceswap?"). App code
-- keeps reading game state through a room id; nothing in the server imports these views.
--
-- Exposure: the views are security_invoker, and neither they, card_types nor the level function
-- are granted to anon or authenticated, so the Supabase API cannot reach them. (Supabase's
-- default privileges grant new public objects to those roles, hence the explicit revokes.)
-- card_types also has RLS enabled with no policy, as a second lock.
--
-- Shape of rooms.state (a serialized Game, verified against a real one in
-- room-state-views.pg.test.ts):
--   options.characters : { "<userId>": { name, options: { xp, coins, deck: [card...], monsters: [...] } } }
--   monster            : { name: "<class>", options: { stableId?, name (given name), xp, cards: [card...] } }
--   card               : { name: "<class name>", options }
-- The serializer strips options equal to their defaults, so xp/coins/deck can be absent: read
-- them with coalesce. stableId is minted on first read of the getter, so a monster nobody has
-- looked at since it was created has none; the views also expose owner_user_id + monster_index
-- so cards can be joined to their monster without it.

create table if not exists public.card_types (
  class_name text primary key,
  card_type text not null
);

comment on table public.card_types is
  'Card class name (as serialized in rooms.state) to display name. Seeded from the engine card registry; a server test fails when a registered card is missing (roadmap 37).';

alter table public.card_types enable row level security;
revoke all on public.card_types from anon, authenticated;

insert into public.card_types (class_name, card_type) values
  ('AdrenalineRushCard', 'Adrenaline Rush'),
  ('AsinineCompanionCard', 'Asinine Companion'),
  ('BadBatchCard', 'Bad Batch'),
  ('BasicShieldCard', 'Basic Shield'),
  ('BattleFocusCard', 'Battle Focus'),
  ('BerserkCard', 'Berserk'),
  ('Blast2Card', 'Blast II'),
  ('BlastCard', 'Blast'),
  ('BlinkCard', 'Blink'),
  ('BoostCard', 'Harden'),
  ('BrainDrainCard', 'Brain Drain'),
  ('CalisthenicsCard', 'Calisthenics'),
  ('CamouflageVestCard', 'Camouflage Vest'),
  ('CloakOfInvisibilityCard', 'Cloak of Invisibility'),
  ('CoilCard', 'Coil'),
  ('ConcussionCard', 'Concussion'),
  ('ConstrictCard', 'Constrict'),
  ('CurseCard', 'Soften'),
  ('DelayedHit', 'Delayed Hit'),
  ('DissonantVoiceCard', 'Dissonant Voice'),
  ('EcdysisCard', 'Ecdysis'),
  ('EnchantedFaceswapCard', 'Enchanted Faceswap'),
  ('EnthrallCard', 'Enthrall'),
  ('EntranceCard', 'Entrance'),
  ('FelineCompanionCard', 'Feline Companion'),
  ('FightOrFlightCard', 'Fight or Flight'),
  ('FireBreathCard', 'Fire Breath'),
  ('FistsOfVillainyCard', 'Fists of Villainy'),
  ('FistsOfVirtueCard', 'Fists of Virtue'),
  ('FleeCard', 'Flee'),
  ('ForkedMetalRodCard', 'Forked Metal Rod'),
  ('ForkedStickCard', 'Forked Stick'),
  ('GloamingRestCard', 'Gloaming Rest'),
  ('HealCard', 'Heal'),
  ('HelmOfAweCard', 'Helm of Awe'),
  ('HitCard', 'Hit'),
  ('HitHarder', 'Hit Harder'),
  ('HornGore', 'Horn Gore'),
  ('HornOfProofCard', 'Horn of Proof'),
  ('HornSwipeCard', 'Horn Swipe'),
  ('IocaneCard', 'Iocane'),
  ('KalevalaCard', 'The Kalevala'),
  ('LuckyStrike', 'Lucky Strike'),
  ('MesmerizeCard', 'Mesmerize'),
  ('MolassesCard', 'Molasses'),
  ('MoodScalesCard', 'Mood Scales'),
  ('PickPocketCard', 'Pick Pocket'),
  ('PoundCard', 'Pound'),
  ('PrionDiseaseCard', '1993-09-7202 18:58'),
  ('RandomCard', 'Random Play'),
  ('Rehit', 'Rehit'),
  ('SandstormCard', 'Sandstorm'),
  ('ScotchCard', 'Scotch'),
  ('StickethCard', 'Sticketh'),
  ('SurvivalKnifeCard', 'Survival Knife'),
  ('TailLashCard', 'Tail Lash'),
  ('TakeWingCard', 'Take Wing'),
  ('ThickSkinCard', 'Thick Skin'),
  ('TsunamiCard', 'Tsunami'),
  ('TurkeyThighCard', 'Turkey Thigh'),
  ('UnconquerableHornCard', 'Unconquerable Horn'),
  ('VenegefulRampageCard', 'Vengeful Rampage'),
  ('WhiskeyShotCard', 'Whiskey Shot'),
  ('WoodenSpearCard', 'Wooden Spear')
on conflict (class_name) do update set card_type = excluded.card_type;

-- Level from XP, using the engine's thresholds (helpers/levels.ts discountedLevelThreshold,
-- levels 1..40; level 40 needs 8.3 billion XP, so the cap is unreachable). Chosen over joining
-- room_monster_stats because that table only updates after a fight and can lag or miss a
-- monster; this is exact for whatever xp the state holds. The server test compares it with the
-- engine's getLevel at and around every threshold, so a retuned curve fails there.
create or replace function public.room_state_level_for_xp(xp numeric)
returns integer
language sql
immutable
as $$
  select count(*)::integer
    from unnest(array[
      28, 65, 113, 213, 380, 650, 1050, 1700, 2750, 4450, 7200, 11650, 18850, 30500, 49350,
      79850, 129200, 209050, 338250, 547300, 885550, 1432850, 2318400, 3751250, 6069650,
      9820900, 15890550, 25711450, 41602000, 67313450, 108915450, 176228900, 285144350,
      461373250, 746517600, 1207890850, 1954408450, 3162299300, 5116707750, 8279007050
    ]::bigint[]) as threshold
   where xp >= threshold
$$;

revoke all on function public.room_state_level_for_xp(numeric) from public, anon, authenticated;

create or replace view public.room_state_characters
with (security_invoker = true) as
select r.id as room_id,
       c.key as user_id,
       coalesce((c.value #>> '{options,coins}')::numeric, 0) as coins,
       coalesce((c.value #>> '{options,xp}')::numeric, 0) as xp,
       case when jsonb_typeof(c.value #> '{options,deck}') = 'array'
            then jsonb_array_length(c.value #> '{options,deck}') else 0 end as deck_size
  from public.rooms r
 cross join lateral jsonb_each(
   case when jsonb_typeof(r.state #> '{options,characters}') = 'object'
        then r.state #> '{options,characters}' else '{}'::jsonb end
 ) as c(key, value);

create or replace view public.room_state_monsters
with (security_invoker = true) as
select r.id as room_id,
       c.key as owner_user_id,
       (m.ord - 1)::integer as monster_index,
       m.value ->> 'name' as monster_type,
       m.value #>> '{options,stableId}' as stable_id,
       m.value #>> '{options,name}' as given_name,
       coalesce((m.value #>> '{options,xp}')::numeric, 0) as xp,
       public.room_state_level_for_xp(coalesce((m.value #>> '{options,xp}')::numeric, 0)) as level
  from public.rooms r
 cross join lateral jsonb_each(
   case when jsonb_typeof(r.state #> '{options,characters}') = 'object'
        then r.state #> '{options,characters}' else '{}'::jsonb end
 ) as c(key, value)
 cross join lateral jsonb_array_elements(
   case when jsonb_typeof(c.value #> '{options,monsters}') = 'array'
        then c.value #> '{options,monsters}' else '[]'::jsonb end
 ) with ordinality as m(value, ord);

create or replace view public.room_state_monster_cards
with (security_invoker = true) as
select r.id as room_id,
       c.key as owner_user_id,
       (m.ord - 1)::integer as monster_index,
       m.value #>> '{options,stableId}' as stable_id,
       k.value ->> 'name' as card,
       coalesce(t.card_type, k.value ->> 'name') as card_type
  from public.rooms r
 cross join lateral jsonb_each(
   case when jsonb_typeof(r.state #> '{options,characters}') = 'object'
        then r.state #> '{options,characters}' else '{}'::jsonb end
 ) as c(key, value)
 cross join lateral jsonb_array_elements(
   case when jsonb_typeof(c.value #> '{options,monsters}') = 'array'
        then c.value #> '{options,monsters}' else '[]'::jsonb end
 ) with ordinality as m(value, ord)
 cross join lateral jsonb_array_elements(
   case when jsonb_typeof(m.value #> '{options,cards}') = 'array'
        then m.value #> '{options,cards}' else '[]'::jsonb end
 ) as k(value)
  left join public.card_types t on t.class_name = k.value ->> 'name';

revoke all on public.room_state_characters, public.room_state_monsters, public.room_state_monster_cards
  from anon, authenticated;
