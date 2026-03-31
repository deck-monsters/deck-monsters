---
name: Modernize Stack Implementation
overview: A phased plan to migrate Deck Monsters from Node 8 / CommonJS / Mocha to Node 22 / TypeScript / ESM / Vitest, replace outdated dependencies, add CI, and set up a pnpm monorepo — ordered so each phase is safe, testable, and suitable for a junior developer.
todos:
  - id: phase-01-node
    content: "Phase 1: Add .nvmrc (22) and update engines in package.json"
    status: pending
  - id: phase-02-vitest
    content: "Phase 2: Replace @salesforce-mc/devtest with Vitest — install deps, create vitest.config.js, rewrite test-setup.js to CJS, update scripts, fix and run all 93 tests"
    status: pending
  - id: phase-03-eslint
    content: "Phase 3: Replace Salesforce ESLint config with @eslint/js + Prettier flat config"
    status: pending
  - id: phase-04-ci
    content: "Phase 4: Create .github/workflows/ci.yml (lint + test on push/PR)"
    status: pending
  - id: phase-05-tsconfig
    content: "Phase 5: Add tsconfig.json with allowJs:true, install TypeScript + @typescript-eslint"
    status: pending
  - id: phase-06-constants
    content: "Phase 6: Convert all 8 constants/ files from .js to .ts (use 'as const' for objects, named exports)"
    status: pending
  - id: phase-07-helpers
    content: "Phase 7: Convert 24 helpers/ files to .ts (tier 1 pure utilities first, tier 2 deps on constants, tier 3 external deps); convert companion test files to .test.ts"
    status: pending
  - id: phase-08-types
    content: "Phase 8: Create types/ directory with shared engine types (Game, Character, Monster, Card, Item, Ring, State) and barrel index.ts"
    status: pending
  - id: phase-09-classes
    content: "Phase 9: Convert core class hierarchy to TS bottom-up — BaseClass -> BaseItem -> BaseCard -> 60+ cards -> BaseCreature -> monsters -> characters -> ChannelManager -> Ring -> commands -> announcements -> items -> exploration -> Game -> index"
    status: pending
  - id: phase-10-zod
    content: "Phase 10: Add Zod schemas for state deserialization and command validation, use z.infer to derive types"
    status: pending
  - id: phase-11-deps
    content: "Phase 11: Replace bluebird (async/await), moment (Intl), lodash (native), event-emitter-es6 (node:events), aws-sdk v2 (v3)"
    status: pending
  - id: phase-12-monorepo
    content: "Phase 12: Restructure into pnpm workspace monorepo + Turborepo — move engine to packages/engine, create root workspace config, update CI"
    status: pending
isProject: false
---

# Modernize Stack: Detailed Implementation Plan

This plan converts the Deck Monsters engine from its legacy Node 8 / CommonJS / Mocha stack to Node 22 / TypeScript / ESM / Vitest. It is broken into 12 sequential phases. Each phase ends with a working, testable codebase — never leave things broken between phases.

---

## Phase 1 — Node.js version and `.nvmrc`

**Goal:** Declare Node 22 as the target runtime.

1. Create `[.nvmrc](.nvmrc)` at the repo root containing `22`.
2. In `[package.json](package.json)`, change `"engines"` to:

```json
"engines": {
  "node": ">=22",
  "npm": ">=10"
}
```

1. Run `nvm install 22 && nvm use 22` locally to switch.
2. Run `node -v` to confirm you are on v22.x.

No code changes yet — this is just a declaration.

---

## Phase 2 — Replace the test runner with Vitest

**Why first:** The roadmap says "the 93 existing test files are the safety net for the migration; get Vitest running on them first before touching source files." Every later phase depends on green tests.

### 2a. Install Vitest and compatibility shims

```bash
npm install --save-dev vitest @vitest/coverage-v8
npm install --save-dev chai sinon sinon-chai chai-as-promised
npm uninstall @salesforce-mc/devtest @salesforce-mc/devscripts
```

`chai`, `sinon`, `sinon-chai`, and `chai-as-promised` were previously bundled inside `@salesforce-mc/devtest`. They now become direct devDependencies.

### 2b. Create `vitest.config.js`

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.mocha.node.js'],
    globals: false,
    testTimeout: 30000,
  },
});
```

The key setting is `include` — Vitest will find the existing `*.mocha.node.js` files without renaming them yet.

### 2c. Rewrite `[shared/test-setup.js](shared/test-setup.js)` to CommonJS

This is the only file using ES module syntax (`import`/`export`). The internal test runner handled that transpilation. Vitest can handle ESM, but all 93 test files consume this module via `require()`, so convert it to CommonJS for now:

```javascript
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const chaiAsPromised = require('chai-as-promised');

const { assert, expect } = chai;
chai.use(sinonChai);
chai.use(chaiAsPromised);

module.exports = { assert, chai, expect, sinon };
```

### 2d. Update `package.json` scripts

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest --watch",
  "test:coverage": "vitest run --coverage",
  "build": "node ./build",
  "lint": "eslint \"**/*.{js,jsx}\"",
  "lint:fix": "npm run lint -- --fix"
}
```

Remove the `tag`, `make-notes`, `test:debug`, and `recalculate` scripts (they depend on removed internal packages). Keep `build`, `lint`, `lint:fix`.

### 2e. Run `npm test` and fix failures

Run `npm test`. Vitest uses a different globals model than Mocha. Common issues to expect:

- `describe`/`it`/`before`/`after`/`beforeEach`/`afterEach` — Vitest supports these natively as Mocha-compatible; they should just work.
- Timer-related tests using `sinon.useFakeTimers()` — these should work with Vitest, but verify any tests that depend on `setTimeout`/`setInterval` (ring fight timers, healing intervals).
- Promise-based assertions — `chai-as-promised` returns thenables that Vitest supports, but every `it()` block that uses `.eventually` must `return` the expectation. Scan for missing `return` statements.
- `bluebird` promises — `Promise.mapSeries`, `Promise.delay`, etc. still work on Node 22; leave bluebird removal for Phase 11.

Fix tests one at a time. The test files themselves do not need renaming yet.

### 2f. Verify all 93 tests pass

Run `npm test` and confirm the full suite is green. This is the gate for proceeding.

---

## Phase 3 — ESLint + Prettier

**Goal:** Replace the Salesforce-internal ESLint config with a standard open-source setup.

### 3a. Uninstall old config

```bash
npm uninstall @salesforce-mc/eslint-config-sfmc
```

### 3b. Install new tooling

```bash
npm install --save-dev eslint @eslint/js prettier eslint-config-prettier eslint-plugin-prettier
```

### 3c. Create `eslint.config.js` (flat config format, ESLint v9+)

```javascript
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    ignores: ['node_modules/', 'coverage/', 'dist/', 'build/'],
  },
];
```

Note: use `sourceType: 'commonjs'` for now. It changes to `'module'` after the TypeScript/ESM migration.

### 3d. Create `.prettierrc`

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "tabWidth": 2,
  "useTabs": true,
  "printWidth": 120
}
```

Use `useTabs: true` to match the existing code style (the codebase uses tabs).

### 3e. Delete the old `[.eslintrc](.eslintrc)` file

The new `eslint.config.js` replaces it.

### 3f. Run `npx eslint .` and fix or suppress errors

Do not auto-fix formatting across the entire codebase yet — that creates a massive diff that obscures real changes. Instead:

- Fix genuine errors (undeclared variables, unreachable code).
- Suppress anything cosmetic with `eslint-disable` comments if needed, or defer to a separate formatting commit later.

---

## Phase 4 — GitHub Actions CI

**Goal:** Run tests and linting automatically on every push and PR.

### 4a. Create `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test
```

This is intentionally simple. It grows later (pnpm, Turborepo, matrix builds).

### 4b. Verify locally

Run `npm run lint && npm test` and confirm both pass.

---

## Phase 5 — TypeScript configuration (coexistence mode)

**Goal:** Add TypeScript to the project with `allowJs: true` so `.js` and `.ts` files coexist during the incremental migration.

### 5a. Install TypeScript

```bash
npm install --save-dev typescript @types/node
```

### 5b. Create `[tsconfig.json](tsconfig.json)`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "allowJs": true,
    "checkJs": false,
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["**/*.ts", "**/*.js"],
  "exclude": ["node_modules", "dist", "coverage", "build"]
}
```

Key choices:

- `allowJs: true` — existing `.js` files pass through the compiler untouched.
- `checkJs: false` — don't type-check JS files (too many errors initially).
- `module: "NodeNext"` — enables ESM with `.ts` extension resolution.
- `strict: true` — new `.ts` files get full strictness from day one.

### 5c. Add `@typescript-eslint` for `.ts` files

```bash
npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

Update `eslint.config.js` to add a TypeScript override block that applies to `**/*.ts` files:

```javascript
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

// Add this block to the config array:
{
  files: ['**/*.ts'],
  languageOptions: {
    parser: tsparser,
    parserOptions: {
      project: './tsconfig.json',
    },
  },
  plugins: { '@typescript-eslint': tseslint },
  rules: {
    ...tseslint.configs.recommended.rules,
  },
}
```

### 5d. Update `vitest.config.js` to handle `.ts` files

Vitest handles TypeScript natively via esbuild — no config change needed. Just confirm it still finds and runs `*.mocha.node.js` files. Later, when test files are renamed to `*.test.ts`, update the `include` pattern.

### 5e. Add a `build` script for TypeScript compilation

In `package.json`:

```json
"scripts": {
  "build:ts": "tsc --build",
  "build:docs": "node ./build"
}
```

Run `npx tsc --noEmit` to verify the config is valid. It will report zero errors on zero `.ts` files (there are none yet).

---

## Phase 6 — Migrate `constants/` to TypeScript

**Why first:** The 8 constants files are the simplest in the project — pure data, no classes, no imports from other source files (except each other). They are imported everywhere, so typing them propagates type information outward.

### 6a. Migration pattern for each file

Take `[constants/stats.js](constants/stats.js)` as the template. The current file:

```javascript
const AC_VARIANCE = 2;
const BASE_AC = 5;
// ...
module.exports = { AC_VARIANCE, BASE_AC, /* ... */ };
```

Becomes `constants/stats.ts`:

```typescript
export const AC_VARIANCE = 2;
export const BASE_AC = 5;
export const BASE_DEX = 5;
export const BASE_HP = 28;
export const BASE_INT = 5;
export const BASE_STR = 5;
export const HP_VARIANCE = 5;

export const MAX_BOOSTS = {
  ac: (BASE_AC * 2) + AC_VARIANCE,
  dex: 10,
  hp: (BASE_HP * 2) + HP_VARIANCE,
  int: 8,
  str: 6,
} as const;

export const MAX_PROP_MODIFICATIONS = {
  ac: 1, dex: 1, hp: 12, int: 1, str: 1, xp: 40,
} as const;
```

Use `as const` for object literals to get literal types instead of `number`.

### 6b. Order of conversion

Convert all 8 files in `constants/`:

1. `constants/stats.ts` (no internal deps)
2. `constants/coins.ts` (no internal deps)
3. `constants/card-classes.ts`
4. `constants/creature-types.ts`
5. `constants/creature-classes.ts`
6. `constants/effect-types.ts`
7. `constants/phases.ts`
8. `constants/teams.ts`

### 6c. Handling imports from JS files

When a `.js` file does `require('./constants/stats')`, Node/Vitest will resolve `constants/stats.ts` if the `.js` file is gone. However, during coexistence, you need to verify this works in Vitest. Vitest's esbuild transformer handles mixed `.js`/`.ts` imports. The `.js` files using `require()` will continue to work because `esModuleInterop` is enabled and Vitest's transformer handles the CJS/ESM interop.

After converting each file, delete the old `.js` version and run `npm test` to confirm nothing breaks.

### 6d. Run tests after each file

After each conversion: `npm test`. Fix any import resolution issues before moving to the next file.

---

## Phase 7 — Migrate `helpers/` to TypeScript

**Goal:** Convert the 24 helper source files (not test files yet) from `.js` to `.ts`.

### 7a. Conversion order (by dependency)

Start with files that have no internal imports, then work outward:

**Tier 1 — No internal deps (pure utility):**

1. `helpers/capitalize.js`
2. `helpers/signed-number.js`
3. `helpers/get-array.js`
4. `helpers/difference.js`
5. `helpers/tense.js`
6. `helpers/pronouns.js`
7. `helpers/flavor.js`
8. `helpers/is-probable.js`
9. `helpers/delay-times.js`
10. `helpers/pause.js`
11. `helpers/probabilities.js`
12. `helpers/costs.js`
13. `helpers/names.js`
14. `helpers/sort.js`
15. `helpers/choices.js`

**Tier 2 — Depends on constants or Tier 1:**
16. `helpers/levels.js` (depends on constants)
17. `helpers/experience.js` (depends on constants, levels)
18. `helpers/chance.js` (wraps the `roll` package)
19. `helpers/is-invisible.js` (depends on effect-types)
20. `helpers/card.js` (depends on card helpers)
21. `helpers/targeting-strategies.js` (11KB — the largest helper, depends on several others)

**Tier 3 — External service deps:**
22. `helpers/aws.js` (depends on `aws-sdk` — type with `any` for now, upgraded in Phase 11)
23. `helpers/bosses.js` (depends on monster types)
24. `helpers/semaphore.js` (wraps `event-emitter-es6`)

### 7b. Typing strategy for `semaphore.ts`

`[helpers/semaphore.js](helpers/semaphore.js)` wraps `event-emitter-es6`, which has no `@types` package. Create a declaration file `types/event-emitter-es6.d.ts`:

```typescript
declare module 'event-emitter-es6' {
  class EventEmitter {
    constructor(options?: { emitDelay?: number });
    on(event: string, callback: (...args: any[]) => void): void;
    off(event: string, callback: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
  }
  export = EventEmitter;
}
```

Add `"types"` or `"typeRoots"` to `tsconfig.json` to include this folder.

### 7c. Convert test files alongside source

For each helper that has a corresponding `*.mocha.node.js` test, convert the test file to `*.test.ts` at the same time:

- Replace `const { expect, sinon } = require('../shared/test-setup')` with `import { expect, sinon } from '../shared/test-setup.js'`
- Replace `const Foo = require('./foo')` with `import { ... } from './foo.js'`
- Replace `describe`/`it` with Vitest's `describe`/`it`/`expect` if desired, or keep Chai assertions — both work under Vitest

Update `vitest.config.js` include to also match `**/*.test.ts`:

```javascript
include: ['**/*.mocha.node.js', '**/*.test.ts'],
```

### 7d. Gate: `npm test` passes after all helpers are converted

---

## Phase 8 — Define and export public engine types

**Goal:** Create the shared type definitions that connectors and apps will import.

### 8a. Create `types/` directory at the repo root

Create these type definition files:

- `types/game.ts` — `GameOptions`, `PublicChannelFn`, `PrivateChannelFn`, `ChannelCallback`, `StateSaveFn`
- `types/character.ts` — `CharacterInfo`, `CharacterActions`, `CharacterOptions`
- `types/monster.ts` — `MonsterStats`, `MonsterOptions`, `CreatureType`
- `types/card.ts` — `CardClass`, `CardType`, `CardOptions`, `DeckSlot`
- `types/item.ts` — `ItemType`, `ItemOptions`
- `types/ring.ts` — `RingOptions`, `Contestant`, `BattleResult`
- `types/state.ts` — `SerializedGameState`, `SerializedCharacter`, `SerializedMonster`
- `types/index.ts` — barrel file re-exporting everything

### 8b. Derive types from existing code

Look at the actual shapes used in the codebase. For example, from `[shared/baseClass.js](shared/baseClass.js)` line 97-112, `toJSON()` returns `{ name, options }`. That tells you the serialized shape.

From `[game.js](game.js)`, the constructor takes `(publicChannel, options, log)` — derive `GameOptions` from what `options` contains (characters map, ring state, etc.).

Start with loose types (using `Record<string, any>` where needed) and tighten them as more files are converted.

### 8c. Export from package root

Create `types/index.ts` as the barrel file. Later, when the monorepo is set up, this becomes the engine package's public type surface.

---

## Phase 9 — Migrate core classes to TypeScript

**Goal:** Convert the class hierarchy. This is the bulk of the work.

### 9a. Conversion order (bottom-up through the inheritance chain)

```
BaseClass (shared/)
  -> BaseItem (items/base)
       -> BaseCard (cards/base)
            -> 60+ card types (cards/*.js)
  -> BaseCreature (creatures/base)
       -> BaseMonster (monsters/base)
            -> 5 monster types
       -> BaseCharacter (characters/base)
            -> Beastmaster
  -> ChannelManager (channel/)
  -> Ring (ring/)
  -> Game (game.js)
```

Convert in this order:

1. `shared/baseClass.ts` + `shared/baseClass.test.ts`
2. `items/base.ts` (BaseItem)
3. `cards/base.ts` (BaseCard) + type the card helper files (`cards/helpers/*.ts`)
4. Individual card files — batch by complexity:
  - Simple cards first (e.g., `hit.ts`, `heal.ts`, `flee.ts`, `blast.ts`)
  - Complex cards last (e.g., `enchanted-faceswap.ts`, `pick-pocket.ts`)
  - Convert each card's `.mocha.node.js` test to `.test.ts` at the same time
5. `creatures/base.ts` (BaseCreature — 804 lines, the hardest file; see note below)
6. `monsters/base.ts` + the 5 monster types + `monsters/environment.ts`
7. `characters/base.ts` + `characters/beastmaster.ts` + character helpers
8. `channel/index.ts` (ChannelManager — only 93 lines)
9. `ring/index.ts` (Ring — 750 lines)
10. `commands/*.ts` (4 command handler files)
11. `announcements/*.ts` (24 files, mostly string templates)
12. `items/` subdirectories — potions, scrolls, store, helpers
13. `exploration/*.ts`
14. `game.ts` + `index.ts` (the public API — do last)

### 9b. Typing `creatures/base.ts` (the hard one)

This file is ~800 lines with many dynamic patterns. Strategy:

- Type the constructor options as a `Partial<CreatureOptions>` interface
- Use getter return types explicitly (`get hp(): number`, `get ac(): number`, etc.)
- The `setOptions` method on `BaseClass` uses dynamic keys — type the options object rather than individual property assignments
- The `hit()`, `heal()`, `miss()` methods use `bluebird` `Promise.resolve()` — leave as `Promise<void>` (bluebird is replaced later)
- For `encounter` effects that dynamically modify properties, use `Record<string, number>` for now
- Add `// @ts-expect-error` comments sparingly for patterns that are genuinely hard to type (dynamic property access on `this`), and create follow-up issues to fix them

### 9c. Converting card files in bulk

The 60+ card files follow a very consistent pattern (they all extend `BaseCard` and override `effect()`). Create a script or use find-and-replace for the mechanical parts:

- `const X = require(...)` becomes `import X from '...'`
- `module.exports = ClassName` becomes `export default ClassName`
- Add parameter types to `effect(player: BaseCreature, target: BaseCreature, ring: Ring)`
- Add static property type annotations

### 9d. Run tests after each batch

Never convert more than ~10 files without running `npm test`.

---

## Phase 10 — Add Zod schemas for runtime validation

**Goal:** Validate data at system boundaries — deserialized state and incoming commands.

### 10a. Install Zod

```bash
npm install zod
```

### 10b. Create schemas alongside the types from Phase 8

In each `types/*.ts` file, add Zod schemas that mirror the TypeScript interfaces:

```typescript
import { z } from 'zod';

export const CharacterInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().optional(),
});
export type CharacterInfo = z.infer<typeof CharacterInfoSchema>;
```

Use `z.infer<>` so the TypeScript type and the Zod schema are always in sync.

### 10c. Validate in `restoreGame` and `getOptions`

In `[index.ts](index.js)` (the public API), wrap the `getOptions` function to validate the deserialized state with the Zod schema before passing it to the `Game` constructor. On validation failure, throw a descriptive error.

### 10d. Validate incoming commands

In `commands/index.ts`, add a `CommandInput` schema:

```typescript
const CommandInputSchema = z.object({
  command: z.string().min(1),
});
```

Parse incoming command objects through this schema before dispatching.

---

## Phase 11 — Replace outdated dependencies

**Goal:** Remove `bluebird`, `moment`, individual lodash packages, `event-emitter-es6`, and upgrade `aws-sdk`.

### 11a. Remove `bluebird`

The codebase uses these bluebird features:

- `Promise.resolve()` / `Promise.reject()` — native
- `Promise.mapSeries(array, fn)` — replace with a `for...of` loop with `await`
- `Promise.delay(ms)` — replace with a utility: `const delay = (ms: number) => new Promise(r => setTimeout(r, ms))`
- `Promise.each()` — replace with `for...of` + `await`

Search for `require('bluebird')` across all files — it appears in `cards/base.js`, `creatures/base.js`, `characters/beastmaster.js`, `ring/index.js`, `game.js`, and several others.

For each file:

1. Remove the `require('bluebird')` import
2. Replace bluebird-specific methods with native equivalents
3. Convert `.then()` chains to `async`/`await` where it simplifies the code
4. Run `npm test` after each file

### 11b. Remove `moment`

`moment` is used in `creatures/base.js` for healing timer formatting. Replace with `Intl.RelativeTimeFormat` or a small helper function. Search for `require('moment')` to find all usages.

### 11c. Remove individual lodash packages

The project imports 10 individual lodash methods:

- `lodash.find` → `Array.prototype.find()`
- `lodash.foreach` → `Array.prototype.forEach()` or `for...of`
- `lodash.random` → `Math.floor(Math.random() * (max - min + 1)) + min` or a small utility
- `lodash.reduce` → `Array.prototype.reduce()`
- `lodash.sample` → `array[Math.floor(Math.random() * array.length)]`
- `lodash.shuffle` → Fisher-Yates shuffle utility
- `lodash.some` → `Array.prototype.some()`
- `lodash.startcase` → small utility or keep (this one is non-trivial)
- `lodash.throttle` → small utility or use a lightweight package
- `lodash.upperfirst` → `str.charAt(0).toUpperCase() + str.slice(1)`

For `lodash.startcase` and `lodash.throttle`, consider keeping a single `lodash-es` import or writing small utilities.

### 11d. Replace `event-emitter-es6` with Node.js `EventEmitter`

In `[helpers/semaphore.ts](helpers/semaphore.js)`, change:

```typescript
import { EventEmitter } from 'node:events';

export const globalSemaphore = new EventEmitter();
export { EventEmitter };
```

The Node.js `EventEmitter` API is a superset of `event-emitter-es6`. The only difference is the constructor option `{ emitDelay: 0 }` which `event-emitter-es6` uses to make `emit()` synchronous — Node's `EventEmitter` is already synchronous by default.

Update `[shared/baseClass.ts](shared/baseClass.js)` constructor accordingly (remove the `{ emitDelay: 0 }` option).

### 11e. Upgrade `aws-sdk` v2 to v3

```bash
npm uninstall aws-sdk
npm install @aws-sdk/client-s3
```

Only `[helpers/aws.js](helpers/aws.js)` uses the SDK. Rewrite it to use the v3 modular client:

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
```

### 11f. Run `npm test` and confirm all 93+ tests pass

---

## Phase 12 — pnpm monorepo + Turborepo

**Goal:** Restructure into a monorepo to support multiple connectors and apps.

### 12a. Install pnpm

```bash
npm install -g pnpm
```

### 12b. Create the monorepo directory structure

```
deck-monsters/
  pnpm-workspace.yaml
  turbo.json
  package.json              (root — workspace scripts only)
  packages/
    engine/                 (move all current code here)
      package.json
      tsconfig.json
      vitest.config.ts
      src/                  (all source + test files)
      types/
  apps/                     (empty for now — web, mobile added later)
```

### 12c. Move the engine code

1. Create `packages/engine/`
2. Move all source directories (`cards/`, `monsters/`, `creatures/`, `characters/`, `items/`, `ring/`, `channel/`, `commands/`, `announcements/`, `exploration/`, `helpers/`, `constants/`, `shared/`, `types/`) into `packages/engine/`
3. Move `game.ts`, `index.ts`, `battlefield.js`, `wander.js` into `packages/engine/`
4. Move `vitest.config.ts` and `tsconfig.json` into `packages/engine/` (adjust paths)
5. Create a new `packages/engine/package.json`:

```json
{
  "name": "@deck-monsters/engine",
  "version": "0.14.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc --build",
    "test": "vitest run",
    "test:watch": "vitest --watch",
    "lint": "eslint ."
  }
}
```

### 12d. Create root `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

### 12e. Create root `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {}
  }
}
```

### 12f. Create root `package.json`

```json
{
  "name": "deck-monsters",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

### 12g. Install and verify

```bash
pnpm install
pnpm test
pnpm build
```

### 12h. Update CI

Update `.github/workflows/ci.yml` to use pnpm:

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 9
- uses: actions/setup-node@v4
  with:
    node-version-file: '.nvmrc'
    cache: 'pnpm'
- run: pnpm install --frozen-lockfile
- run: pnpm lint
- run: pnpm test
```

---

## Dependency removal cheat sheet


| Package             | Where used                               | Replace with                                 |
| ------------------- | ---------------------------------------- | -------------------------------------------- |
| `bluebird`          | 15+ files (cards, creatures, ring, game) | Native `async`/`await`, `for...of` loops     |
| `moment`            | `creatures/base.js`                      | `Intl.RelativeTimeFormat` or helper          |
| `lodash.find`       | ~5 files                                 | `Array.prototype.find()`                     |
| `lodash.foreach`    | ~3 files                                 | `for...of`                                   |
| `lodash.random`     | ~8 files                                 | Small `random(min, max)` utility             |
| `lodash.reduce`     | `index.js`, helpers                      | `Array.prototype.reduce()`                   |
| `lodash.sample`     | ~12 files                                | Small `sample(arr)` utility                  |
| `lodash.shuffle`    | ~5 files                                 | Fisher-Yates `shuffle(arr)` utility          |
| `lodash.some`       | ~3 files                                 | `Array.prototype.some()`                     |
| `lodash.startcase`  | ~4 files                                 | Small `startCase(str)` utility               |
| `lodash.throttle`   | `game.js`                                | Small `throttle(fn, ms)` utility             |
| `lodash.upperfirst` | ~2 files                                 | `str.charAt(0).toUpperCase() + str.slice(1)` |
| `event-emitter-es6` | `helpers/semaphore.js`                   | `node:events` `EventEmitter`                 |
| `aws-sdk`           | `helpers/aws.js`                         | `@aws-sdk/client-s3`                         |


---

## Ground rules for the whole migration

- Never convert more than one "tier" of files without running `npm test` and confirming green.
- Commit after each phase (or sub-phase for large ones). Small commits are easier to review and revert.
- Use `// @ts-expect-error` sparingly and always with a comment explaining why. Create a follow-up issue for each one.
- Do not reformat files you are not converting. A formatting-only commit (via Prettier) can happen once at the very end.
- When in doubt about a type, use `unknown` rather than `any` — it forces callers to narrow, which catches bugs.

