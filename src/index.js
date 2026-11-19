const json = (data, status=200) => new Response(JSON.stringify(data), { status, headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" } });
const cors = { "access-control-allow-origin":"*", "access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS", "access-control-allow-headers":"content-type,authorization" };
function withCors(r){ const h=new Headers(r.headers); for(const [k,v] of Object.entries(cors)) h.set(k,v); return new Response(r.body,{status:r.status,headers:h}); }
async function body(req){ try{return await req.json()}catch{return {}} }
async function setting(db,key,fallback=""){ const row=await db.prepare("SELECT value FROM settings WHERE key=?").bind(key).first(); return row?.value ?? fallback; }
function authorized(req,env){ const auth=req.headers.get("authorization")||""; return !!env.ADMIN_PASSWORD && auth === "Bearer "+env.ADMIN_PASSWORD; }
async function subscriptionStatus(env){
 const diagnostics={project_key_configured:!!env.SUBSCRIPTION_PROJECT_KEY,verification_token_configured:!!env.SUBSCRIPTION_VERIFICATION_TOKEN};
 if(!diagnostics.project_key_configured || !diagnostics.verification_token_configured) return {active:false,unavailable:true,reason:"credentials_missing",diagnostics};
 try {
  const centerUrl=String(env.SUBSCRIPTION_CENTER_URL||"https://subscription-center.tootosael.workers.dev").replace(/\/+$/, "");
  const response=await fetch(centerUrl+"/api/check",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({project_key:env.SUBSCRIPTION_PROJECT_KEY,verification_token:env.SUBSCRIPTION_VERIFICATION_TOKEN})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok) return {active:false,unavailable:response.status>=500,reason:result.reason||result.error||(response.status===404?"invalid_project":"verification_failed"),diagnostics};
  return {active:result.active===true,unavailable:false,reason:result.reason||null,status:result.status||"inactive",starts_at:result.starts_at||null,ends_at:result.ends_at||null,plan_name:result.plan_name||null,duration_months:result.duration_months??null,price_sar:result.price_sar??null,payment_details:result.payment_details||null,diagnostics};
 } catch { return {active:false,unavailable:true,reason:"center_unreachable",diagnostics}; }
}
function subscriptionPage(unavailable=false){
 const title=unavailable?"تعذر التحقق من الاشتراك":"المتجر متوقف مؤقتاً";
 const message=unavailable?"تعذر الاتصال بخدمة الاشتراكات حالياً. يرجى المحاولة بعد قليل.":"انتهت فترة الاشتراك أو تم إيقافه. يرجى التواصل مع إدارة المتجر لتجديد الاشتراك.";
 return new Response(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#080d0b"><title>${title} | سعودي دايت</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#080d0b;color:#f4f8f4;font-family:system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box"><main style="max-width:440px;border:1px solid #40552f;border-radius:22px;padding:30px;background:#101a14"><div style="font-size:42px;margin-bottom:12px">🥗</div><h1 style="color:#b5f34a;font-size:25px">${title}</h1><p style="line-height:1.9;color:#d6e2d8">${message}</p></main></body></html>`,{status:unavailable?503:402,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
}
export default {
 async fetch(req,env){
  const url=new URL(req.url), path=url.pathname, method=req.method;
  // Subscription management is centralized in subscription-center; no separate control Worker is used.
  if(method==="OPTIONS") return withCors(new Response(null,{status:204}));
  // Keep the storefront catalog and subscription plans visible to customers.
  // Only validate the central subscription when a customer submits an order.
  const protectedOrder=path==="/api/orders" && method==="POST";
  if(protectedOrder){
   const subscription=await subscriptionStatus(env);
   if(!subscription.active){
    return withCors(json({error:subscription.unavailable?"تعذر التحقق من الاشتراك حالياً":"اشتراك المتجر غير نشط",subscription_inactive:true},subscription.unavailable?503:402));
   }
  }
  if(path.startsWith("/api/")){
   try {
    if(path==="/api/store" && method==="GET"){
     const keys=["store_name","tagline","whatsapp","delivery_fee","free_delivery_minimum","hero_title","hero_subtitle"];
     const settings={}; for(const k of keys) settings[k]=await setting(env.DB,k,k==="whatsapp"?"966553243108":"");
     if(!settings.whatsapp || settings.whatsapp==="96653243108"){settings.whatsapp="966553243108";await env.DB.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind("whatsapp",settings.whatsapp).run();}
     return withCors(json({settings}));
    }
    if(path==="/api/catalog" && method==="GET"){
     const [meals,categories,plans]=await Promise.all([
      env.DB.prepare("SELECT m.*,c.name category FROM meals m LEFT JOIN categories c ON c.id=m.category_id WHERE m.available=1 ORDER BY m.id DESC").all(),
      env.DB.prepare("SELECT * FROM categories ORDER BY sort_order,id").all(),
      env.DB.prepare("SELECT * FROM plans WHERE active=1 ORDER BY price").all()
     ]);
     return withCors(json({meals:meals.results,categories:categories.results,plans:plans.results}));
    }
    if(path==="/api/orders" && method==="POST"){
     const b=await body(req);
     if(!Array.isArray(b.items) || !b.items.length) return withCors(json({error:"أضف المنتجات أولاً"},400));
     const total=Number(b.total)||0;
     const result=await env.DB.prepare("INSERT INTO orders(customer_name,customer_phone,order_type,items_json,total,notes) VALUES(?,?,?,?,?,?)")
      .bind(String(b.customer_name||"").slice(0,100),String(b.customer_phone||"").slice(0,30),b.order_type==="subscription"?"subscription":"single",JSON.stringify(b.items),total,String(b.notes||"").slice(0,1000)).run();
     return withCors(json({ok:true,order_id:result.meta.last_row_id}));
    }
    if(path.startsWith("/api/admin/")){
     if(path==="/api/admin/login" && method==="POST"){
      const b=await body(req);
      if(!env.ADMIN_PASSWORD) return withCors(json({error:"كلمة مرور اللوحة غير مضبوطة في إعدادات الخادم"},503));
      if(String(b.password||"")!==env.ADMIN_PASSWORD) return withCors(json({error:"كلمة المرور غير صحيحة"},401));
      return withCors(json({ok:true}));
     }
     if(!authorized(req,env)) return withCors(json({error:"يلزم تسجيل الدخول إلى لوحة التحكم"},401));
     if(path==="/api/admin/subscription" && method==="GET"){
      const status=await subscriptionStatus(env);
      return withCors(json(status));
     }
     if(path==="/api/admin/overview" && method==="GET"){
      const [orders,meals,plans]=await Promise.all([env.DB.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 100").all(),env.DB.prepare("SELECT * FROM meals ORDER BY id DESC").all(),env.DB.prepare("SELECT * FROM plans ORDER BY id DESC").all()]);
      return withCors(json({orders:orders.results,meals:meals.results,plans:plans.results}));
     }
     if(path==="/api/admin/meal" && method==="POST"){
      const b=await body(req); if(!b.name) return withCors(json({error:"اسم الوجبة مطلوب"},400));
      const vals=[b.name,b.description||"",Number(b.category_id)||null,Number(b.price)||0,b.image_url||"",Number(b.calories)||0,Number(b.protein)||0,Number(b.carbs)||0,Number(b.fat)||0,b.available===false?0:1];
      if(b.id) await env.DB.prepare("UPDATE meals SET name=?,description=?,category_id=?,price=?,image_url=?,calories=?,protein=?,carbs=?,fat=?,available=? WHERE id=?").bind(...vals,Number(b.id)).run();
      else await env.DB.prepare("INSERT INTO meals(name,description,category_id,price,image_url,calories,protein,carbs,fat,available) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(...vals).run();
      return withCors(json({ok:true}));
     }
     if(path==="/api/admin/plan" && method==="POST"){
      const b=await body(req); if(!b.name) return withCors(json({error:"اسم الباقة مطلوب"},400));
      if(b.id) await env.DB.prepare("UPDATE plans SET name=?,duration=?,price=?,description=?,meals_per_day=?,active=? WHERE id=?").bind(b.name,b.duration,Number(b.price)||0,b.description||"",Number(b.meals_per_day)||3,b.active===false?0:1,Number(b.id)).run();
      else await env.DB.prepare("INSERT INTO plans(name,duration,price,description,meals_per_day) VALUES(?,?,?,?,?)").bind(b.name,b.duration,Number(b.price)||0,b.description||"",Number(b.meals_per_day)||3).run();
      return withCors(json({ok:true}));
     }
     if(path==="/api/admin/settings" && method==="POST"){
      const b=await body(req); const allowed=["store_name","tagline","whatsapp","delivery_fee","free_delivery_minimum","hero_title","hero_subtitle"];
      for(const k of allowed) if(b[k]!==undefined) await env.DB.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(k,String(b[k])).run();
      return withCors(json({ok:true}));
     }
     if(path==="/api/admin/order-status" && method==="POST"){
      const b=await body(req); await env.DB.prepare("UPDATE orders SET status=? WHERE id=?").bind(String(b.status||"new"),Number(b.id)).run(); return withCors(json({ok:true}));
     }
     return withCors(json({error:"المسار غير موجود"},404));
    }
    return withCors(json({error:"المسار غير موجود"},404));
   } catch(e){ return withCors(json({error:"حدث خطأ في الخادم",detail:env.ENVIRONMENT==="development"?e.message:undefined},500)); }
  }
  if(url.hostname.startsWith("saudi-diet-control.") && path==="/"){
   const target=new URL("/admin.html",url);
   return env.ASSETS.fetch(new Request(target,req));
  }
  if(path==="/saudi-diet-control" || path==="/saudi-diet-control/"){
   const target=new URL("/admin.html",url);
   return env.ASSETS.fetch(new Request(target,req));
  }
  return env.ASSETS.fetch(req);
 }
};
