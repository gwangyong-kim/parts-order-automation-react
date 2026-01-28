# ==========================================
# PartSync MRP - Docker Build
# ==========================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# ==========================================
# Stage 2: Builder
# ==========================================
FROM node:20-alpine AS builder
# Install build dependencies for native modules
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client again (needed for build)
RUN npx prisma generate

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Build-time dummy secret (overridden at runtime)
ENV AUTH_SECRET=build-time-placeholder-secret

RUN npm run build

# Copy local database (managed by user)
RUN mkdir -p /app/data
COPY prisma/dev.db /app/data/partsync.db

# ==========================================
# Stage 3: Runner (Production)
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install runtime dependencies
# - sqlite3: for database integrity check in entrypoint
# - libc6-compat: for native modules compatibility
RUN apk add --no-cache sqlite libc6-compat

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Create uploads directory with proper permissions
RUN mkdir -p /app/public/uploads/profiles && chown -R nextjs:nodejs /app/public/uploads

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma client and CLI for database initialization
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy better-sqlite3 for selective restore and compare features
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=builder /app/node_modules/prebuild-install ./node_modules/prebuild-install

# Copy Google Cloud Storage and all dependencies for cloud backup
# Install GCS dependencies directly in runner stage for proper dependency resolution
COPY --from=builder /app/package.json ./package-gcs.json
RUN npm install @google-cloud/storage --no-save --legacy-peer-deps 2>/dev/null || true

# Copy entrypoint script and fix line endings (Windows CRLF to Unix LF)
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

# Create data directory, backups directory, and copy initialized database as template
RUN mkdir -p /app/data /app/data/backups /app/data-template && chown -R nextjs:nodejs /app/data /app/data-template
COPY --from=builder --chown=nextjs:nodejs /app/data/partsync.db /app/data-template/partsync.db

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/partsync.db"

# Backup configuration defaults
ENV BACKUP_ON_STARTUP=true
ENV BACKUP_MAX_COUNT=30

# Start the application with entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]
