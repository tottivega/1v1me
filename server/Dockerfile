# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy shared types (needed by server via @shared alias)
COPY shared/ ./shared/

# Install all deps (devDeps needed for esbuild)
COPY server/package*.json ./server/
RUN cd server && npm ci

# Copy server source
COPY server/ ./server/

# Bundle to a single self-contained JS file.
# esbuild resolves the @shared/* path alias at build time — no tsconfig-paths
# needed at runtime. bufferutil/utf-8-validate are optional native add-ons for
# ws; marking them external is safe (ws falls back to its pure-JS path).
RUN cd server && npx esbuild index.ts \
    --bundle \
    --platform=node \
    --target=node20 \
    --outfile=dist/bundle.js \
    --external:bufferutil \
    --external:utf-8-validate

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 3001
COPY --from=builder /app/server/dist/bundle.js ./dist/bundle.js
CMD ["node", "dist/bundle.js"]
