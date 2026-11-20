const json = (data, status=200) => new Response(JSON.stringify(data), { status, headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" } });
const cors = { "access-control-allow-origin":"*", "access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS", "access-control-allow-headers":"content-type,authorization" };
function withCors(r){ const h=new Headers(r.headers); for(const [k,v] of Object.entries(cors)) h.set(k,v); return new Response(r.body,{status:r.status,headers:h}); }
async function body(req){ try{return await req.json()}catch{return {}} }
async function setting(db,key,fallback=""){ const row=await db.prepare("SELECT value FROM settings WHERE key=?").bind(key).first(); return row?.value ?? fallback; }
function authorized(req,env){ const auth=req.headers.get("authorization")||""; return !!env.ADMIN_PASSWORD && auth === "Bearer "+env.ADMIN_PASSWORD; }
async function getLocalSubscription(env){
 await env.DB.prepare("INSERT OR IGNORE INTO subscriptions (id,status,plan,trial_used,trial_started_at,trial_ends_at,starts_at,ends_at) VALUES (1,'trial','trial',1,CURRENT_TIMESTAMP,datetime('now','+2 months'),CURRENT_TIMESTAMP,datetime('now','+2 months'))").run();
 const row=await env.DB.prepare("SELECT * FROM subscriptions WHERE id=1").first();
 const end=row?.ends_at?new Date(String(row.ends_at).replace(' ','T')+'Z').getTime():0;
 const active=!!row && ['trial','active'].includes(row.status) && end>Date.now();
 return {...row,active,display_status:active?row.status:(row.status==='suspended'?'suspended':'expired'),days_left:active?Math.ceil((end-Date.now())/86400000):0};
}
async function sendTelegram(env,message){
 if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID) return false;
 try{
  const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text:message})});
  return response.ok;
 }catch{return false;}
}
async function runSubscriptionAlerts(env){
 const s=await getLocalSubscription(env);
 if(!s.ends_at) return;
 const end=new Date(String(s.ends_at).replace(' ','T')+'Z').getTime();
 const remaining=end-Date.now(), day=Math.ceil(remaining/86400000), key=String(s.ends_at);
 const name='سعودي دايت';
 if(remaining>0&&day<=7&&day>1&&s.notified_7d_for_end!==key){
  if(await sendTelegram(env,'⏳ تنبيه اشتراك\nالمشروع: '+name+'\nمتبقي '+day+' أيام على انتهاء الاشتراك.\nتاريخ الانتهاء: '+key))
   await env.DB.prepare("UPDATE subscriptions SET notified_7d_for_end=? WHERE id=1").bind(key).run();
 }
 if(remaining>0&&day<=1&&s.notified_1d_for_end!==key){
  if(await sendTelegram(env,'⚠️ اشتراك على وشك الانتهاء\nالمشروع: '+name+'\nينتهي خلال 24 ساعة.\nتاريخ الانتهاء: '+key))
   await env.DB.prepare("UPDATE subscriptions SET notified_1d_for_end=? WHERE id=1").bind(key).run();
 }
 if(remaining<=0&&s.notified_expired_for_end!==key){
  if(await sendTelegram(env,'🔴 انتهى الاشتراك\nالمشروع: '+name+'\nانتهى الاشتراك بتاريخ: '+key+'\nتم إيقاف استقبال الطلبات.'))
   await env.DB.prepare("UPDATE subscriptions SET notified_expired_for_end=? WHERE id=1").bind(key).run();
 }
}
export default {
 async fetch(req,env){
  const url=new URL(req.url), path=url.pathname, method=req.method;
  // Subscription is stored locally in this project's D1 database.
  if(method==="OPTIONS") return withCors(new Response(null,{status:204}));
  // Public, read-only diagnostics endpoint. It never grants access to store APIs.
  // It must remain reachable even when the storefront subscription gate is active.
  if(path==="/api/check" && method==="GET"){
   const status=await getLocalSubscription(env);
   return withCors(json({project_name:"سعودي دايت",subscription_status:status.status,active:status.active,days_left:status.days_left,reason:status.active?"ok":"subscription_inactive"}));
  }
  // Keep the storefront catalogue visible; validate the local subscription only when an order is submitted.
  const protectedOrder=path==="/api/orders" && method==="POST";
  if(protectedOrder){
   const subscription=await getLocalSubscription(env);
   if(!subscription.active) return withCors(json({error:"اشتراك المتجر غير نشط",subscription_inactive:true},402));
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
     if(path==="/api/admin/subscription-check" && method==="GET"){
      return withCors(json(await getLocalSubscription(env)));
     }
     if(path==="/api/admin/subscription-action" && method==="POST"){
      const b=await body(req),action=String(b.action||"");
      if(!["monthly","yearly","suspend"].includes(action)) return withCors(json({error:"الإجراء غير معروف"},400));
      if(action==="suspend"){
       await env.DB.prepare("UPDATE subscriptions SET status='suspended',updated_at=CURRENT_TIMESTAMP WHERE id=1").run();
      }else{
       const interval=action==="monthly"?"+1 month":"+1 year";
       await env.DB.prepare("UPDATE subscriptions SET status='active',plan=?,starts_at=COALESCE(starts_at,CURRENT_TIMESTAMP),ends_at=datetime(CASE WHEN ends_at>CURRENT_TIMESTAMP THEN ends_at ELSE CURRENT_TIMESTAMP END,?),updated_at=CURRENT_TIMESTAMP WHERE id=1").bind(action,interval).run();
      }
      return withCors(json({ok:true,subscription:await getLocalSubscription(env)}));
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
 },
 async scheduled(event,env,ctx){
  ctx.waitUntil(runSubscriptionAlerts(env));
 }
};
