# Stage 1: Install dependencies
# pnpm 11 needs Node 22.13 or newer, so the build stages use Node 22. pnpm is
# installed here only; the runner stage has no package manager.
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm@11.28.13
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build the application
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@11.28.13
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
