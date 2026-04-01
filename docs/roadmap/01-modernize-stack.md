# Modernize Stack: TypeScript, Testing, and Dependencies

**Category**: Tech Debt / Modernization  
**Priority**: High (blocker for most other work)  
**Status**: Mostly complete — TypeScript migration, dependency replacement, CI, monorepo structure, legacy cleanup, and server package scaffold are all done. Vitest migration is the remaining open question.

## Background

The engine was written targeting Node.js 8, which has been EOL since 2019. Several dependencies were significantly outdated, and the test runner (`@salesforce-mc/devtest`) was an internal Salesforce package unavailable publicly. The migration to TypeScript has been completed to get type safety across the engine and all future connectors.

## TypeScript Migration — Done

The entire engine has been converted to TypeScript under `packages/engine/src/` (303 `.ts` files, zero `.js` files in the engine package). Key details:

- `tsconfig.json` targets ES2022 / `NodeNext` (ESM with `.js` extension imports)
- `strict: true`, `allowJs: false` in the engine package
- Emits declarations, declaration maps, and source maps
- Shared types defined and exported from `packages/engine/src/types/` (card, character, game, item, monster, ring, state)
- Zod schemas in `packages/engine/src/schemas/` for runtime validation of game state deserialization and command input

### Key Types Defined

```typescript
// packages/engine/src/types/game.ts
export type PublicChannelFn = (message: ChannelMessage) => Promise<unknown> | unknown;
export type PrivateChannelFn = (message: ChannelMessage) => Promise<unknown> | unknown;
export type StateSaveFn = (state: SerializedState) => Promise<unknown> | unknown;
export type CommandAction = (context: CommandContext) => Promise<unknown> | unknown;

// Also: ChannelMessage, GameOptions, CommandContext, GamePublicApi, CharacterActions, etc.
```

Legacy `.js` files at the repository root have been cleaned up: `wander.js`, `config/include-paths.js`, `shared/baseClass.js`, `shared/baseClass.ts`, `shared/test-setup.js`, and `shared/test-setup.ts` have been deleted. The remaining root-level `.js` files (`battlefield.js` and the `build/` doc-generation scripts) are intentionally kept — they work as-is and converting them gains little (see decision in section below).

## Testing: Mocha → Vitest — Partially Done

`@salesforce-mc/devtest` has been fully removed. The engine currently uses **Mocha** with **tsx** (TypeScript execution without compilation), **Chai** + **Sinon** for assertions/mocking, and **c8** for coverage.

77 test files exist as `*.test.ts` under `packages/engine/src/`.

The original plan was to migrate to Vitest. This was deferred to reduce risk during the TypeScript migration — Mocha provided a known-good baseline while source files were being converted. Now that the TypeScript migration is complete, the Vitest migration can proceed:

- Vitest's Jest-compatible API means most test logic migrates without changes
- The main work is replacing Chai/Sinon patterns with Vitest's built-in `expect` and `vi` mocking
- Or: use `vitest` with Chai/Sinon as-is initially (Vitest can run with external assertion libraries), then migrate assertions incrementally

### Decision Needed

Whether to migrate to Vitest at all, or stay with Mocha. The case for Vitest is speed and native ESM/TS support without the tsx loader. The case for staying is that Mocha works fine now and migration has a nonzero cost. Either way, the test suite is healthy and covers the engine well.

## Monorepo Structure — Done

Organized as a **pnpm workspace** monorepo with **Turborepo** for task orchestration:

```
packages/
  engine/           # Game engine (TypeScript, fully migrated)
  server/           # Fastify + tRPC + Drizzle API server (done)
  connector-slack/  # (not yet created)
  connector-discord/# (not yet created)
apps/
  web/              # (not yet created)
  mobile/           # (not yet created)
```

- `pnpm-workspace.yaml` declares `packages/*`
- `turbo.json` defines `build`, `lint`, `lint:fix`, `test`, and `test:coverage` tasks
- Root `package.json` specifies `"packageManager": "pnpm@10.33.0"` and delegates scripts to Turborepo

Shared TypeScript types flow from `engine` → connectors → apps automatically via package imports.

## Dependency Replacement — Done

| Original | Replaced With | Status |
|----------|--------------|--------|
| `bluebird` | Native `async/await` (`helpers/promise.ts`) | Done |
| `moment` | Native Date handling (`helpers/time.ts`) | Done |
| lodash piecemeal | Native ES2022+ (`helpers/collection.ts`, `helpers/random.ts`, `helpers/start-case.ts`, etc.) | Done |
| `event-emitter-es6` | Node.js `EventEmitter` from `node:events` | Done |
| `aws-sdk` v2 / `@aws-sdk/client-s3` v3 | Removed — S3 backup replaced by Supabase Postgres | Done |
| `@salesforce-mc/devtest` | Mocha (Vitest still planned) | Done |
| Salesforce ESLint config | `@typescript-eslint` + Prettier | Done |

Remaining runtime dependencies: `roll` (dice), `node-emoji`, `word-wrap`, `fantasy-names`, `grab-color-names`, `escape-string-regexp`, `zod`.

## CI — Done

GitHub Actions workflow at `.github/workflows/ci.yml` with three parallel jobs:

1. TypeScript — `tsc --noEmit` type-check
2. Lint — `pnpm run lint`
3. Tests — `pnpm run test`

Runs on push to `main` and all PRs. Uses pnpm 10, Node.js 22 (from `.nvmrc`), `ubuntu-latest`.

## Other Completed Items

- `.nvmrc` set to `22`; `engines` field requires Node >= 22, npm >= 10
- ESLint flat config with `@typescript-eslint` and Prettier integration
- AWS S3 backup code removed: `helpers/aws.ts` deleted, `@aws-sdk/client-s3` dependency removed, `awsSave` call removed from `game.ts`
- Hardcoded time constants extracted to `constants/timing.ts` (`TIME_TO_HEAL_MS`, `TIME_TO_RESURRECT_MS`)
- `creatures/base.ts` decomposed from ~2000 lines into focused modules: `creatures/encounter.ts`, `creatures/health.ts`, `creatures/items.ts`, `creatures/stats.ts` — `base.ts` now ~400 lines handling only identity, teams, cards, battles, and coin logic
- Command system (`commands/`) fully migrated with Zod validation via `commandInputSchema`
- Legacy root-level files cleaned up: `wander.js`, `config/include-paths.js`, `shared/baseClass.{js,ts}`, `shared/test-setup.{js,ts}` deleted
- `packages/server/` created: Fastify + tRPC + Drizzle + `RoomManager` + `PostgresStateStore`
- `StateStore` interface added to `packages/engine/src/types/` and exported from the engine; `Game.persistState()` calls `stateStore.save()` when injected

## Remaining Tasks

- [ ] Evaluate Mocha → Vitest migration (decision: migrate or stay with Mocha)
- [ ] If migrating to Vitest: replace Mocha + c8 with Vitest + `@vitest/coverage-v8`, update test scripts
- [x] ~~Fix 2 flaky tests in `cards/blast.test.ts`~~ — tests used `randomCharacter()` whose lazy dynamic imports race with test execution; replaced with direct `new Basilisk()` calls, same as other tests in the file
- [x] ~~Fix `MaxListenersExceededWarning` spam in tests~~ — `globalSemaphore` is a singleton bus that legitimately accumulates listeners from all active Game instances; added `setMaxListeners(0)` in `helpers/semaphore.ts`
- [ ] Create remaining monorepo packages as other roadmap items are implemented (`connector-discord`, `apps/web`; `connector-slack` and `apps/mobile` deferred)
