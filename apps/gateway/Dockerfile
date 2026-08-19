# خادم البث الحي — حاوية مستقلة عن الواجهة عمدًا، لتُنشر حيث تُدعم
# اتصالات WebSocket طويلة الأمد (الاستضافة المشتركة لا تدعمها).
FROM node:22-alpine

RUN corepack enable

WORKDIR /app

# نسخ ملفات الاعتماديات أولًا: طبقة التثبيت تُخزَّن مؤقتًا فلا تُعاد
# مع كل تعديل في الكود
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
COPY apps/gateway/package.json ./apps/gateway/

RUN pnpm install --frozen-lockfile --filter @arabic-v2t/gateway...

COPY packages/core ./packages/core
COPY apps/gateway ./apps/gateway
COPY tsconfig.base.json ./

ENV NODE_ENV=production
EXPOSE 4000

# مستخدم غير جذر — الحاوية لا تحتاج صلاحيات الجذر بعد التثبيت
USER node

CMD ["pnpm", "--filter", "@arabic-v2t/gateway", "start"]
