# 1. Stage: Build
FROM node:20-slim AS builder

WORKDIR /app

# Required for native modules like Better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++

# Copy package config and install all dependencies (including dev)
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# 2. Stage: Runner
FROM node:20-slim AS runner

WORKDIR /app

# Copy built app and production dependencies
COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

# Final configuration
ENV NODE_ENV=production
# We assume PORT is set by the cloud environment or default to 8080
ENV PORT=8080

CMD ["node", "dist/index.js"]
