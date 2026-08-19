# دليل النشر

## ⚠ قبل كل شيء: قيد استضافة Hostinger

خطتك الحالية في Hostinger هي **استضافة ويب مشتركة** مع دعم تطبيقات Node.js. هذه تكفي
لتشغيل واجهة Next.js على `mshareeda.com`، لكنها **لا تصلح لخادم البث الحي**.

السبب تقني لا تفضيلي: الاستضافة المشتركة مبنية على افتراض عمليات قصيرة العمر (سكربت PHP
يعمل ثم يموت)، وحدود Entry Process فيها تقطع أي عملية Node تبقى حيّة، بينما اتصال
WebSocket للتفريغ الحي يجب أن يبقى مفتوحًا طوال التسجيل. ولهذا فُصل المشروع من البداية
إلى حاويتين مستقلتين.

### الخياران المتاحان

| الخيار                      | الواجهة                       | خادم البث                      | التكلفة الإضافية          |
| --------------------------- | ----------------------------- | ------------------------------ | ------------------------- |
| **أ — مختلط** (الأسرع الآن) | Hostinger على `mshareeda.com` | Railway أو Render              | صفر تقريبًا (طبقة مجانية) |
| **ب — موحّد** (الأنظف)      | Hostinger VPS                 | نفس الـ VPS عبر Docker Compose | ترقية خطة Hostinger       |

لا يتغيّر أي سطر كود بين الخيارين — فقط متغيّر البيئة `NEXT_PUBLIC_GATEWAY_URL`.

---

## المتغيّرات المطلوبة

```bash
# ولّد سرًا قويًا — يجب أن يكون **نفسه** في الواجهة وخادم البث،
# فهو ما يوقّع التذاكر التي يتحقّق منها الطرفان
openssl rand -base64 32
```

| المتغيّر                  | الواجهة | الـ gateway | ملاحظة                              |
| ------------------------- | ------- | ----------- | ----------------------------------- |
| `AUTH_SECRET`             | ✔       | ✔           | **نفس القيمة في الاثنين**           |
| `DATABASE_URL`            | ✔       | —           |                                     |
| `NEXT_PUBLIC_GATEWAY_URL` | ✔       | —           | `wss://` في الإنتاج لا `ws://`      |
| `SPEECHMATICS_API_KEY`    | —       | ✔           | لا يصل المتصفح أبدًا                |
| `ALLOWED_ORIGINS`         | —       | ✔           | نطاق الواجهة بالضبط                 |
| `NODE_ENV=production`     | ✔       | ✔           | **مطلوب**: بدونه تُعطَّل فحوص الأصل |

> **تحذير:** في وضع التطوير يقبل الـ gateway أي أصل، ويقبل الاتصال بلا تذكرة حين
> يكون `AUTH_SECRET` فارغًا. الحارس الوحيد ضد ذلك هو `NODE_ENV=production`.
> تأكّد من ضبطه قبل أي نشر عام.

---

## الخيار أ — الواجهة على Hostinger وخادم البث على Railway

### ١. خادم البث على Railway

```bash
# من جذر المشروع
railway init
railway up
```

ثم في لوحة Railway: New Service → Dockerfile → `apps/gateway/Dockerfile`، واضبط:

```
NODE_ENV=production
SPEECHMATICS_API_KEY=<مفتاحك>
AUTH_SECRET=<السر المولّد>
ALLOWED_ORIGINS=https://mshareeda.com
```

سجّل النطاق الذي يعطيك إياه Railway، مثل `arabic-v2t-gateway.up.railway.app`.

### ٢. قاعدة البيانات

أنشئ قاعدة PostgreSQL مجانية على [Neon](https://neon.tech) وانسخ رابط الاتصال، ثم:

```bash
DATABASE_URL="<رابط Neon>" pnpm --filter @arabic-v2t/db migrate:deploy
```

### ٣. الواجهة على Hostinger

```bash
pnpm --filter @arabic-v2t/db generate
pnpm --filter @arabic-v2t/web build
```

ارفع المشروع عبر FTP أو Git من hPanel، ثم في hPanel → Node.js App:

- **Application root:** `apps/web`
- **Startup file:** `node_modules/next/dist/bin/next` بوسيط `start`
- **Node version:** 22 أو أحدث
- **متغيّرات البيئة:**
  ```
  NODE_ENV=production
  DATABASE_URL=<رابط Neon>
  AUTH_SECRET=<نفس السر تمامًا>
  NEXT_PUBLIC_GATEWAY_URL=wss://arabic-v2t-gateway.up.railway.app
  ```

> `NEXT_PUBLIC_GATEWAY_URL` يُدمج في حزمة المتصفح **وقت البناء** لا وقت التشغيل.
> تغييره يستلزم إعادة بناء الواجهة، لا إعادة تشغيلها فقط.

---

## الخيار ب — كل شيء على Hostinger VPS

```bash
# على الـ VPS
git clone <رابط المستودع> && cd arabic-v2t
cp .env.example .env && nano .env      # عبّئ القيم

docker compose up -d --build
docker compose exec web pnpm --filter @arabic-v2t/db migrate:deploy
```

### Nginx مع ترقية WebSocket

الإعداد الحرج هنا هو ترويستا `Upgrade` و`Connection` على مسار `/live`؛ بدونهما
يفشل التفريغ الحي بصمت بينما يعمل كل شيء آخر.

```nginx
server {
    listen 443 ssl http2;
    server_name mshareeda.com;

    ssl_certificate     /etc/letsencrypt/live/mshareeda.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mshareeda.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # خادم البث الحي — الترقية إلى WebSocket
    location /live {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Origin $http_origin;

        # جلسة التفريغ تصل إلى 15 دقيقة — المهلة الافتراضية 60 ثانية تقطعها
        proxy_read_timeout 1200s;
        proxy_send_timeout 1200s;
    }

    location /upload {
        proxy_pass http://127.0.0.1:4000;
        client_max_body_size 70M;   # 50MB بعد تضخّم base64
        proxy_read_timeout 600s;
    }
}
```

```bash
certbot --nginx -d mshareeda.com
```

عندها يصبح `NEXT_PUBLIC_GATEWAY_URL=wss://mshareeda.com` (نفس النطاق، مسار مختلف).

---

## بعد النشر — قائمة تحقّق

```bash
# ١. خادم البث حي ويعرف المحرك الصحيح
curl https://<نطاق-الـgateway>/health
# المتوقع: {"status":"ok","provider":"speechmatics",...}

# ٢. الاتصال بلا تذكرة مرفوض (يجب أن يكون 401)
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGVzdA==" \
     https://<نطاق-الـgateway>/live

# ٣. زمن أول نص من المتصفح
GATEWAY_URL=wss://<نطاق-الـgateway> GATEWAY_TICKET=<تذكرة> \
  pnpm --filter @arabic-v2t/gateway probe ar-BH
```

ثم يدويًا في المتصفح: إنشاء حساب ← اختيار لهجة ← تسجيل ← التحقق من ظهور أول كلمة
خلال ثانيتين ← إيقاف ← التحقق من ظهور التفريغ في السجل.

---

## مراقبة التكلفة

الحدود الافتراضية محافظة عمدًا (15 دقيقة للجلسة، 60 دقيقة شهريًا للمستخدم، جلستان
متزامنتان). لمتابعة الاستهلاك الفعلي:

```sql
SELECT "userId", SUM("durationMs") / 60000 AS minutes
FROM "UsageRecord"
WHERE "createdAt" >= date_trunc('month', now())
GROUP BY "userId" ORDER BY minutes DESC;
```

> **ملاحظة على الحصص:** عدّاد الحصص يعيش في ذاكرة الـ gateway حاليًا، فيُصفَّر عند
> إعادة تشغيله ولا يُشارَك بين نسخ متعددة. هذا مقبول لنموذج أولي بنسخة واحدة؛ قبل
> تشغيل أكثر من نسخة اربط `setUsageRecorder` في `apps/gateway/src/quota.ts`
> بجدول `UsageRecord` واقرأ الحصة منه عند بدء كل جلسة.
