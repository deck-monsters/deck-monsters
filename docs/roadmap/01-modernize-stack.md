# Modernize Stack: TypeScript, Testing, and Dependencies

**Category**: Tech Debt / Modernization  
**Priority**: High (blocker for most other work)

## Background

The engine was written targeting Node.js 8, which has been EOL since 2019. Several dependencies are significantly outdated, and the test runner (`@salesforce-mc/devtest`) is an internal Salesforce package unavailable publicly. The migration to TypeScript is being done at the same time to get type safety across the engine and all connectors.

## TypeScript Migration

Convert the entire engine to TypeScript:

- Add `tsconfig.json` targeting ES2022 / Node.js v22, `"module": "NodeNext"` (ESM)
- Migrate source files `.js` → `.ts` incrementally (start with `constants/`, `helpers/`, then work inward to the core classes)
- Define shared types for the engine's public surface: `Monster`, `Character`, `Card`, `Item`, `Game`, `RoomState`
- Export types from the engine package so connectors and apps can import them — this is the main payoff of TypeScript across the monorepo
- Use **Zod** for runtime validation at system boundaries (restoring serialized state, incoming commands from connectors)

### Key Types to Define

```typescript
// Engine public API
export interface GameOptions { ... }
export interface CharacterInfo { id: string; name: string; icon?: string }
export type PublicChannelFn = (message: string) => Promise<void>
export type PrivateChannelFn = (message: string) => Promise<void>
export type StateSaveFn = (state: string) => Promise<void>

// Connector-facing character API (replace string-command dispatch)
export interface CharacterActions {
  spawnMonster(opts: SpawnOptions): Promise<void>
  sendMonsterToTheRing(opts: RingOptions): Promise<void>
  equipMonster(opts: EquipOptions): Promise<void>
  // ...
}
```

## Testing: Vitest

Replace `@salesforce-mc/devtest` with **Vitest**:

- Jest-compatible API — nearly all existing test logic migrates without changes
- Native ESM + TypeScript support out of the box (no `ts-jest` or Babel config needed)
- Significantly faster than Jest for large test suites (Vite-based transformer)
- Built-in coverage via `@vitest/coverage-v8`

```bash
npm test              # vitest run
npm run test:watch    # vitest --watch
npm run test:coverage # vitest run --coverage
```

Rename test files from `*.mocha.node.js` → `*.test.ts` as part of the TypeScript migration.

## Monorepo Structure

With multiple connectors and apps, organize as a **pnpm workspace** monorepo:

```
packages/
  engine/           # This repo's code, compiled to TypeScript
  connector-slack/  # Slack Bolt adapter
  connector-discord/# discord.js adapter
  connector-web/    # Fastify HTTP + WebSocket adapter
apps/
  web/              # React web frontend
  mobile/           # React Native + Expo
```

Shared TypeScript types flow from `engine` → connectors → apps automatically.

Use **Turborepo** for task orchestration (`turbo build`, `turbo test` runs everything in dependency order with caching).

## Other Dependencies

| Current | Replace With | Reason |
|---------|-------------|--------|
| `bluebird` | native `async/await` | Unnecessary with modern Node.js |
| `moment` | `date-fns` or native `Temporal` | moment is in maintenance mode |
| lodash piecemeal | native ES2022+ | Most use cases covered natively |
| `aws-sdk` v2 | `@aws-sdk/client-s3` v3 | v2 in maintenance mode |
| `@salesforce-mc/devtest` | Vitest | Internal package, unavailable publicly |
| `event-emitter-es6` | Node.js `EventEmitter` (typed) | No external dep needed |
| Salesforce ESLint config | `@typescript-eslint` + Prettier | Standard toolchain |

## Tasks

- [ ] Add `tsconfig.json` (ESM, strict mode, Node.js v22 target)
- [ ] Add `.nvmrc` (Node.js 22 LTS) and update `engines` in `package.json`
- [ ] Replace `@salesforce-mc/devtest` with Vitest + rename test files to `*.test.ts`
- [ ] Set up ESLint with `@typescript-eslint` + Prettier
- [ ] Set up GitHub Actions CI (test + lint on every PR)
- [ ] Migrate `constants/` and `helpers/` to TypeScript first (low risk, high type leverage)
- [ ] Migrate `cards/`, `monsters/`, `creatures/` (more complex — do with test coverage)
- [ ] Define and export public engine types (`Monster`, `Character`, `Card`, `Game`, etc.)
- [ ] Add Zod schemas for state deserialization and incoming command validation
- [ ] Replace `bluebird` with async/await
- [ ] Replace `moment`, lodash, other outdated deps
- [ ] Upgrade `aws-sdk` v2 → v3
- [ ] Set up pnpm workspace monorepo structure
- [ ] Add Turborepo for task orchestration

## Notes

- Migrate TypeScript incrementally — `allowJs: true` initially so JS and TS files coexist during migration
- The 93 existing test files are the safety net for the migration; get Vitest running on them first before touching source files
- `creatures/base.js` is the hardest file to type (2000 lines, many dynamic patterns) — leave it for last
