# =============================================================================
# CORSAIR CLI — Multi-stage Dockerfile
# Runtime: Bun (oven/bun:1) — NOT Node.js
# Entry: bun run corsair.ts
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Install dependencies
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --production --frozen-lockfile 2>/dev/null || bun install --production

# ---------------------------------------------------------------------------
# Stage 2: Runtime — copies only what's needed
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS runtime

LABEL org.opencontainers.image.title="Corsair"
LABEL org.opencontainers.image.description="Open protocol for machine-readable, cryptographically verifiable compliance attestations"
LABEL org.opencontainers.image.url="https://grcorsair.com"
LABEL org.opencontainers.image.source="https://github.com/Arudjreis/corsair"
LABEL org.opencontainers.image.version="0.5.1"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.vendor="Corsair"

ENV NODE_ENV=production

WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy only what the CLI needs — no tests, no apps, no keys, no .env
COPY package.json ./
COPY corsair.ts ./
COPY src/ ./src/
COPY bin/ ./bin/
COPY examples/ ./examples/

ENTRYPOINT ["bun", "run", "corsair.ts"]
