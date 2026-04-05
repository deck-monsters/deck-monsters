# Multi-stage build for the Deck Monsters server
# Runs the @deck-monsters/server package on Railway.

# ── Stage 1: Install dependencies ──────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Install pnpm
RUN corepack enable pnpm

# Copy workspace manifests and lockfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/engine/package.json ./packages/engine/package.json
COPY packages/server/package.json ./packages/server/package.json

# Install all deps (prod + dev — needed for TypeScript build)
RUN pnpm install --frozen-lockfile


# ── Stage 2: Build ─────────────────────────────────────────────────────────
FROM deps AS builder

WORKDIR /app

# Copy source files for all packages
COPY packages/engine ./packages/engine
COPY packages/server ./packages/server

# Build engine first (produces dist/ with .d.ts), then server
RUN pnpm --filter @deck-monsters/engine build
RUN pnpm --filter @deck-monsters/server build


# ── Stage 3: Production image ───────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable pnpm

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/engine/package.json ./packages/engine/package.json
COPY packages/server/package.json ./packages/server/package.json

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/packages/engine/dist ./packages/engine/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "packages/server/dist/index.js"]
