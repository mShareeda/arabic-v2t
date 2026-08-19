FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ── مرحلة البناء ────────────────────────────────────────────
FROM base AS builder

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps/web ./apps/web

# توليد عميل Prisma قبل البناء — مسارات الـ API تستورده
RUN pnpm --filter @arabic-v2t/db generate
RUN pnpm --filter @arabic-v2t/web build

# ── مرحلة التشغيل ───────────────────────────────────────────
FROM base AS runner

ENV NODE_ENV=production

COPY --from=builder /app ./

EXPOSE 3000
USER node

CMD ["pnpm", "--filter", "@arabic-v2t/web", "start"]
