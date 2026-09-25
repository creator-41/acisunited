import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { buildPushPayload } from "npm:@block65/webcrypto-web-push@2.0.0";
import postgres from "npm:postgres@3.4.3";

const allowedOrigins = new Set([
  "https://acisunited.com.tr",
  "https://www.acisunited.com.tr",
  "https://creator-41.github.io",
]);
function corsHeaders(request: Request) {
  const requestOrigin = request.headers.get("origin") || "";
  return {
    ...(allowedOrigins.has(requestOrigin) ? { "Access-Control-Allow-Origin": requestOrigin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const projectUrl = Deno.env.get("SUPABASE_URL") || "";
const publicKey = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default || "";
const secretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || "";
const vapid = {
  subject: "https://acisunited.com.tr/",
  publicKey: "BK-Cf0R9W_wuRYirWHsvfldfXRclp45bxDxwSPIecggeT7HsRqmTGHLl0pIVEoGa0j5BV164a0KKWcViFJ8kDc0",
};
const sql = postgres(Deno.env.get("SUPABASE_DB_URL") || "", { prepare: false, max: 1 });
const service = createClient(projectUrl, secretKey, { auth: { persistSession: false } });
const client = createClient(projectUrl, publicKey, { auth: { persistSession: false } });

function allowedEndpoint(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return host === "fcm.googleapis.com" || host === "fcm-xm.googleapis.com"
      || host === "android.googleapis.com" || host === "updates.push.services.mozilla.com"
      || host === "push.services.mozilla.com" || host === "web.push.apple.com"
      || host.endsWith(".notify.windows.com");
  } catch { return false; }
}

Deno.serve(async (request) => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== "POST") return reply({ error: "Yalnızca POST." }, 405);
  if (!vapid.publicKey || !secretKey || !publicKey) {
    return reply({ error: "Bildirim sunucusu henüz hazır değil." }, 503);
  }
  let input: Record<string, unknown>;
  try { input = await request.json(); }
  catch { return reply({ error: "Geçersiz istek." }, 400); }

  if (input.action === "config") return reply({ publicKey: vapid.publicKey });

  if (input.action === "subscribe") {
    const sub = input.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined;
    if (!sub || typeof sub.endpoint !== "string" || !allowedEndpoint(sub.endpoint)
      || sub.endpoint.length > 2048 || !/^[A-Za-z0-9_-]{20,512}$/.test(sub.keys?.p256dh || "")
      || !/^[A-Za-z0-9_-]{8,512}$/.test(sub.keys?.auth || "")) {
      return reply({ error: "Geçersiz bildirim aboneliği." }, 400);
    }
    const { error } = await service.from("acisu_push_subscriptions").upsert({
      endpoint: sub.endpoint, p256dh: sub.keys!.p256dh, auth: sub.keys!.auth,
    });
    return error ? reply({ error: "Abonelik kaydedilemedi." }, 500) : reply({ ok: true });
  }

  if (input.action === "send") {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Oturum açmalısın." }, 401);
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user) return reply({ error: "Geçersiz oturum." }, 401);
    const scoped = createClient(projectUrl, publicKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: admin } = await scoped.from("acisu_admins")
      .select("user_id").eq("user_id", user.id).maybeSingle();
    if (!admin) return reply({ error: "Yönetici yetkisi gerekli." }, 403);
    const secrets = await sql`select decrypted_secret from vault.decrypted_secrets where name = 'acisu_vapid_private' limit 1`;
    const privateKey = secrets[0]?.decrypted_secret;
    if (!privateKey) return reply({ error: "Bildirim anahtarı bulunamadı." }, 503);
    const title = typeof input.title === "string" ? input.title.trim().slice(0, 100) : "";
    const body = typeof input.body === "string" ? input.body.trim().slice(0, 500) : "";
    if (!title || !body) return reply({ error: "Başlık ve mesaj gerekli." }, 400);
    const { data: subs, error } = await service.from("acisu_push_subscriptions")
      .select("endpoint,p256dh,auth").limit(500);
    if (error) return reply({ error: "Abonelikler alınamadı." }, 500);
    let sent = 0, failed = 0;
    for (const sub of subs || []) {
      if (!allowedEndpoint(sub.endpoint)) continue;
      try {
        const payload = await buildPushPayload(
          { data: JSON.stringify({ title, body, url: "https://acisunited.com.tr/#fikstur" }), options: { ttl: 3600 } },
          { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          { ...vapid, privateKey },
        );
        const result = await fetch(sub.endpoint, payload);
        if (result.ok) sent++;
        else {
          failed++;
          if (result.status === 404 || result.status === 410)
            await service.from("acisu_push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      } catch (error) { console.error("Push gönderimi başarısız:", error); failed++; }
    }
    return reply({ sent, failed });
  }
  return reply({ error: "Bilinmeyen işlem." }, 400);
});
