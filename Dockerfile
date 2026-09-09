FROM node:22-alpine AS base

# === deps stage: install all dependencies ===
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com
RUN npm ci

# === builder stage: build the Next.js app ===
FROM base AS builder
WORKDIR /app
ARG APP_GIT_SHA=development
ENV APP_GIT_SHA=$APP_GIT_SHA
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Keep the exact lockfile production dependency tree, including Prisma CLI/OCR workers.
FROM builder AS production-deps
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM base AS runner
WORKDIR /app
ARG APP_GIT_SHA=development
ENV APP_GIT_SHA=$APP_GIT_SHA
ENV NODE_ENV=production
# The deploy target is in mainland China; the default Alpine CDN can stall long
# enough to hit the GitHub Actions timeout while installing OCR runtime deps.
RUN sed -i 's|https://dl-cdn.alpinelinux.org/alpine|https://mirrors.aliyun.com/alpine|g' /etc/apk/repositories \
  && apk add --no-cache poppler-utils
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 -G nodejs nextjs

# Layer 1: public assets（仅 public/ 内容变才变）
COPY --from=builder /app/public ./public

# Layer 2: lockfile-pinned production dependencies, Prisma CLI and generated client
COPY --from=production-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Layer 3: standalone 的服务端构建产物（每次 build 都变，但 ~10MB）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/.next ./.next

# Layer 4: standalone 入口（极小，几乎不变）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/server.js ./server.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/package.json ./package.json

# Layer 5: 静态 chunks（每次 build 都变，~10-30MB）
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma CLI and its transitive dependencies come from package-lock.json above.

# Layer 7: prisma schema（仅 schema/migration 变才变）— migrate deploy 需要
COPY --from=builder /app/prisma ./prisma
# One-off root maintenance process only; the app still runs as nextjs.
COPY --from=builder /app/scripts/ops/migrate-text-ai-settings.mjs ./scripts/ops/migrate-text-ai-settings.mjs
COPY --from=builder /app/lib/ai/text-model-policy.json ./lib/ai/text-model-policy.json

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
