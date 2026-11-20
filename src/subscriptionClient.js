// Signed HMAC client for the central subscription service.
async function sign(secret,payload){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const bytes=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload));
 return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,"0")).join("");
}
export async function signedRequest(env,method,path,body=null){
 const secret=env.SUBSCRIPTION_VERIFICATION_SECRET;
 const centerUrl=String(env.SUBSCRIPTION_CENTER_URL||"https://subscription-center.tootosael.workers.dev").replace(/\/+$/,"");
 if(!env.SUBSCRIPTION_PROJECT_KEY||!secret) throw new Error("subscription_credentials_missing");
 const raw=body===null?"":JSON.stringify(body),timestamp=String(Math.floor(Date.now()/1000));
 const signature=await sign(secret,method+"\n"+path+"\n"+timestamp+"\n"+raw);
 const response=await fetch(centerUrl+path,{method,headers:{"content-type":"application/json","X-Project-Key":env.SUBSCRIPTION_PROJECT_KEY,"X-Timestamp":timestamp,"X-Signature":signature},body:method==="GET"?undefined:raw});
 const data=await response.json().catch(()=>({}));
 if(!response.ok) throw new Error(data.error||"subscription_center_error");
 return data;
}
export async function activateProject(env){return signedRequest(env,"POST","/api/v1/activate",{});}
export async function getSubscriptionStatus(env){const data=await signedRequest(env,"GET","/api/v1/subscription/status");return data.subscription;}
export async function requestSubscriptionPlan(env,planId){return signedRequest(env,"POST","/api/v1/subscription/request-plan",{plan_id:Number(planId)});}
