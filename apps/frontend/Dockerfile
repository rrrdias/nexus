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