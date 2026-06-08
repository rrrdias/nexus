# apps/backend/Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy workspace package.json and lock files
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/

# Install dependencies using npm workspace options
RUN npm ci --workspace=@nexus-core/backend --include=dev

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the NestJS app
RUN npm run build -w @nexus-core/backend

# Production dependencies only
FROM base AS runner-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
RUN npm ci --workspace=@nexus-core/backend --omit=dev

# Production image, copy all the files and run nest
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/drizzle ./apps/backend/drizzle
COPY --from=builder /app/apps/backend/drizzle.config.ts ./apps/backend/
COPY --from=builder /app/apps/backend/profiles ./apps/backend/profiles
COPY --from=runner-deps /app/node_modules ./node_modules

# Ensure we have drizzle migrations folder copied in the right path for scripts
COPY --from=builder /app/apps/backend/src/db/schema.ts ./apps/backend/src/db/schema.ts
COPY --from=builder /app/apps/backend/src/db/index.ts ./apps/backend/src/db/index.ts
COPY --from=builder /app/apps/backend/src/db/seed-openlms.ts ./apps/backend/src/db/seed-openlms.ts
COPY --from=builder /app/apps/backend/src/db/seed.ts ./apps/backend/src/db/seed.ts

USER nestjs

EXPOSE 3001

ENV PORT=3001

CMD ["node", "apps/backend/dist/main.js"]
