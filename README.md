# سعودي دايت

متجر وجبات صحية واشتراكات أسبوعية وشهرية، مع طلبات واتساب ولوحة تحكم خاصة بصاحب المتجر.

## التقنية
- Cloudflare Workers + Static Assets
- Cloudflare D1
- واجهة عربية RTL متجاوبة

## الإعداد والنشر
1. أنشئ قاعدة D1 باسم `saudi-diet`.
2. ضع معرّف القاعدة في `wrangler.toml` بدل `REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID`.
3. اضبط متغير البيئة السري `ADMIN_PASSWORD` في إعدادات Worker.
4. نفّذ `npm install` ثم `npm run db:migrate` ثم `npm run deploy`.
5. افتح `/admin.html` وسجّل الدخول بكلمة مرور الإدارة.
6. أدخل رقم واتساب بصيغة دولية، مثال: `9665xxxxxxxx`.

> لا يمكن تشغيل الطلبات وحفظها قبل إنشاء D1 وربطها بالـ Worker. ولا تضع كلمة مرور الإدارة داخل ملفات GitHub.
