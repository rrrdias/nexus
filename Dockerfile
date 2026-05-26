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
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY . .

# Set environment variables for Next.js build (e.g. public API URL)
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NODE_ENV=production

# Build the Next.js app
RUN npm run build -w @nexus-core/frontend

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/apps/frontend/package.json ./apps/frontend/
COPY --from=builder /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public
COPY --from=builder /app/apps/frontend/next.config.ts ./apps/frontend/
COPY --from=builder /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY --from=builder /app/node_modules ./node_modules

USER nextjs

EXPOSE 3002

ENV PORT=3002

CMD ["npm", "run", "start", "-w", "@nexus-core/frontend"]
