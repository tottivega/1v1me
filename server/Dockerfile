FROM node:20-alpine AS base
WORKDIR /app

# Copy shared types (needed by server via @shared alias)
COPY shared/ ./shared/

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server source
COPY server/ ./server/

WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 3001

CMD ["npx", "tsx", "index.ts"]
