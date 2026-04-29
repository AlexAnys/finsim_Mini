FROM node:20-alpine AS base

# === deps stage: install all dependencies ===
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# === builder stage: build the Next.js app ===
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# === runner stage: production image ===
# 关键：把 standalone 拆成多个 COPY 层，让"运行时 node_modules"（最大层 ~250MB）
# 在 package.json 不变时稳定缓存，每次部署只需重传应用代码层（~10-30MB）。
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Layer 1: public assets（仅 public/ 内容变才变）
COPY --from=builder /app/public ./public

# Layer 2: standalone 的运行时 node_modules（最大层；仅 package-lock.json 变才变）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/node_modules ./node_modules

# Layer 3: standalone 的服务端构建产物（每次 build 都变，但 ~50MB）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/.next ./.next

# Layer 4: standalone 入口（极小，几乎不变）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/server.js ./server.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/package.json ./package.json

# Layer 5: 静态 chunks（每次 build 都变，~10-30MB）
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Layer 6: prisma schema（仅 schema 变才变）
COPY --from=builder /app/prisma ./prisma

# Layer 7: prisma generated client + engines（仅 schema 变才变）
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Layer 8: prisma CLI（用于 migrate deploy；仅 prisma 版本变才变）
RUN npm install --no-save prisma@6.19.2

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
