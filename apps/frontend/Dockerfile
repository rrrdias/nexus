# apps/frontend/Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy workspace package.json and lock files
COPY package.json package-lock.json ./
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies using npm workspace options
RUN npm ci --workspace=@nexus-core/frontend --include=dev

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for Next.js build
ARG NEXT_PUBLIC_API_URL=http://localhost:3004
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG NEXT_PUBLIC_NEXUS_DEFAULT_PERIOD=2026-2
ENV NEXT_PUBLIC_NEXUS_DEFAULT_PERIOD=$NEXT_PUBLIC_NEXUS_DEFAULT_PERIOD

ARG NEXT_PUBLIC_NEXUS_FASE1_START=2026-02-13
ARG NEXT_PUBLIC_NEXUS_FASE1_END=2026-03-29
ARG NEXT_PUBLIC_NEXUS_FASE2_START=2026-03-30
ARG NEXT_PUBLIC_NEXUS_FASE2_END=2026-05-11
ARG NEXT_PUBLIC_NEXUS_FASE3_START=2026-05-12
ARG NEXT_PUBLIC_NEXUS_FASE3_END=2026-06-19
ENV NEXT_PUBLIC_NEXUS_FASE1_START=$NEXT_PUBLIC_NEXUS_FASE1_START
ENV NEXT_PUBLIC_NEXUS_FASE1_END=$NEXT_PUBLIC_NEXUS_FASE1_END
ENV NEXT_PUBLIC_NEXUS_FASE2_START=$NEXT_PUBLIC_NEXUS_FASE2_START
ENV NEXT_PUBLIC_NEXUS_FASE2_END=$NEXT_PUBLIC_NEXUS_FASE2_END
ENV NEXT_PUBLIC_NEXUS_FASE3_START=$NEXT_PUBLIC_NEXUS_FASE3_START
ENV NEXT_PUBLIC_NEXUS_FASE3_END=$NEXT_PUBLIC_NEXUS_FASE3_END

ARG NEXT_BASE_PATH=""
ENV NEXT_BASE_PATH=$NEXT_BASE_PATH

ENV NODE_ENV=production

# Build the Next.js app
RUN npm run build -w @nexus-core/frontend

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_BASE_PATH=/nexus

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone build
COPY --from=builder /app/apps/frontend/.next/standalone ./

# Garante a cópia dos estáticos tanto na raiz quanto no caminho do workspace
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public
COPY --from=builder /app/apps/frontend/.next/static ./.next/static
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static

USER nextjs

EXPOSE 3002

ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/frontend/server.js"]
