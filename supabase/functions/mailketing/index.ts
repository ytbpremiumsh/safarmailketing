import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const MAILKETING_URL = "https://stackapi.mailketing.co.id/api/v2";
const MAILKETING_FALLBACK_URL = "https://api.mailketing.co.id/api/v2";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: CORS });

const interpolate = (value: string, variables: Record<string, unknown>) =>
  value.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => String(variables[key] ?? ""));

const normalizeToken = (value: unknown) => {
  let token = String(value ?? "").trim();
  token = token.replace(/^['\"]|['\"]$/g, "");
  token = token.replace(/^authorization\s*:\s*bearer\s+/i, "");
  token = token.replace(/^bearer\s+/i, "");
  token = token.replace(/^x-api-token\s*:\s*/i, "");
  if (/api_token=/i.test(token)) {
    try { token = new URL(token).searchParams.get("api_token") ?? token; }
    catch { token = token.replace(/^.*api_token=/i, "").split(/[&#\s]/)[0]; }
  }
  return token.trim();
};

const requestMailketing = async (token: string, path: string, body?: unknown, corporate = false) => {
  const bases = corporate
    ? [MAILKETING_FALLBACK_URL, MAILKETING_URL]
    : [MAILKETING_URL, MAILKETING_FALLBACK_URL];
  let last: Record<string, unknown> = { success: false, message: "Mailketing tidak dapat dihubungi.", http_status: 502 };
  for (const base of bases) {
    const response = await fetch(`${base}${corporate ? "/corporate" : ""}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "X-Api-Token": token,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({ success: false, message: `HTTP ${response.status}` }));
    last = { ...payload, http_status: response.status, api_host: new URL(base).host };
    if (response.status !== 401 || payload.success) return last;
  }
  return last;
};

export default {
  fetch: async (request: Request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
    const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!bearer) return json({ success: false, message: "Sesi login tidak ditemukan." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const secretMap = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? secretMap.default;
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(bearer);
    if (authError || !authData.user) return json({ success: false, message: "Sesi tidak valid atau sudah berakhir." }, 401);
    const userId = authData.user.id;
      const { data: profile } = await admin
        .from("profiles").select("role,active").eq("id", userId).single();
      if (!profile?.active) return json({ success: false, message: "Akun tidak aktif." }, 403);

      const input = await request.json().catch(() => ({}));
      const action = String(input.action ?? "");
      const adminOnly = ["save-settings", "retry", "process-queue"];
      if (adminOnly.includes(action) && profile.role !== "admin") {
        return json({ success: false, message: "Akses khusus admin." }, 403);
      }

      if (action === "save-settings") {
        const token = normalizeToken(input.token);
        if (token.length < 8) return json({ success: false, message: "Token tidak valid." }, 422);
        const validation = await requestMailketing(token, "/credits");
        if (!validation.success) {
          return json({
            success: false,
            message: validation.http_status === 401
              ? "Token ditolak Mailketing. Salin hanya nilai token dari Dashboard Mailketing → API Integration, tanpa label atau tanda kutip."
              : validation.message,
            provider_status: validation.http_status,
          }, validation.http_status === 429 ? 429 : 422);
        }
        const { error } = await admin.rpc("store_mailketing_token", { p_token: token, p_user_id: userId });
        if (error) return json({ success: false, message: error.message }, 400);
        await admin.from("app_settings").update({
          default_from_name: input.default_from_name || null,
          default_from_email: input.default_from_email || null,
          corporate_mode: Boolean(input.corporate_mode),
          updated_by: userId,
          updated_at: new Date().toISOString(),
        }).eq("id", true);
        return json({ success: true, message: "Pengaturan API tersimpan dengan aman." });
      }

      const { data: token, error: tokenError } = await admin.rpc("read_mailketing_token");
      if (tokenError || !token) return json({ success: false, message: "Token Mailketing belum dikonfigurasi." }, 422);
      const provider = (path: string, body?: unknown, corporate = false) =>
        requestMailketing(normalizeToken(token), path, body, corporate);

      if (action === "sync") {
        const [credits, senders, lists] = await Promise.all([
          provider("/credits"), provider("/senders"), provider("/lists"),
        ]);
        return json({ success: credits.success, credits, senders, lists, message: credits.message });
      }
      if (action === "add-subscriber") {
        return json(await provider("/subscribers", input.subscriber));
      }
      if (action === "verify-corporate") {
        return json(await provider("/verify-sender", { email: input.email }, true));
      }
      if (action === "send-test") {
        const payload = { ...input.email, recipient: input.recipient };
        return json(await provider("/send", payload, Boolean(input.corporate)));
      }
      if (action === "create-campaign") {
        const campaign = input.campaign ?? {};
        const recipients = Array.isArray(input.recipients) ? input.recipients.slice(0, 10000) : [];
        if (!campaign.name || !campaign.from_email || !campaign.subject || !campaign.html_content || !recipients.length) {
          return json({ success: false, message: "Data kampanye belum lengkap." }, 422);
        }
        const status = campaign.scheduled_at ? "scheduled" : "processing";
        const { data: created, error } = await admin.from("campaigns").insert({
          ...campaign, status, total_count: recipients.length, created_by: userId,
        }).select("id").single();
        if (error) return json({ success: false, message: error.message }, 400);
        const rows = recipients.map((item: any) => ({
          campaign_id: created.id,
          contact_id: item.contact_id || null,
          email: String(item.email).trim().toLowerCase(),
          variables: item.variables ?? {},
        }));
        for (let i = 0; i < rows.length; i += 500) {
          const { error: recipientError } = await admin.from("campaign_recipients").insert(rows.slice(i, i + 500));
          if (recipientError) return json({ success: false, message: recipientError.message }, 400);
        }
        await admin.from("audit_logs").insert({ user_id: userId, action: "campaign.created", entity_type: "campaign", entity_id: created.id, metadata: { count: rows.length } });
        return json({ success: true, campaign_id: created.id, status, message: campaign.scheduled_at ? "Kampanye berhasil dijadwalkan." : "Kampanye dibuat dan siap diproses." });
      }
      if (action === "retry") {
        await admin.from("campaign_recipients").update({ status: "pending", last_error: null, updated_at: new Date().toISOString() }).eq("campaign_id", input.campaign_id).eq("status", "failed");
        await admin.from("campaigns").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", input.campaign_id);
        return json({ success: true, message: "Email gagal dimasukkan kembali ke antrean." });
      }
      if (action === "process-queue") {
        const now = new Date().toISOString();
        await admin.from("campaigns").update({ status: "processing" }).eq("status", "scheduled").lte("scheduled_at", now);
        const { data: campaigns } = await admin.from("campaigns").select("*").eq("status", "processing").limit(5);
        let processed = 0;
        for (const campaign of campaigns ?? []) {
          const { data: recipients } = await admin.from("campaign_recipients").select("*").eq("campaign_id", campaign.id).eq("status", "pending").limit(50);
          for (const recipient of recipients ?? []) {
            await admin.from("campaign_recipients").update({ status: "processing", attempts: recipient.attempts + 1, updated_at: now }).eq("id", recipient.id).eq("status", "pending");
            const variables = { email: recipient.email, ...(recipient.variables ?? {}) };
            const response = await provider("/send", {
              from_name: campaign.from_name,
              from_email: campaign.from_email,
              subject: interpolate(campaign.subject, variables),
              recipient: recipient.email,
              content: interpolate(campaign.html_content, variables),
              ...(campaign.attachments?.[0] ? { attach1: campaign.attachments[0] } : {}),
              ...(campaign.attachments?.[1] ? { attach2: campaign.attachments[1] } : {}),
              ...(campaign.attachments?.[2] ? { attach3: campaign.attachments[2] } : {}),
            });
            await admin.from("campaign_recipients").update(response.success ? {
              status: "queued", message_id: response.data?.message_id ?? null, provider_message: response.message, queued_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            } : {
              status: "failed", last_error: response.message, provider_message: response.message, updated_at: new Date().toISOString(),
            }).eq("id", recipient.id);
            processed++;
          }
          const { data: all } = await admin.from("campaign_recipients").select("status").eq("campaign_id", campaign.id);
          const sent = all?.filter((r: any) => ["queued", "sent"].includes(r.status)).length ?? 0;
          const failed = all?.filter((r: any) => r.status === "failed").length ?? 0;
          const pending = all?.filter((r: any) => ["pending", "processing"].includes(r.status)).length ?? 0;
          await admin.from("campaigns").update({ sent_count: sent, failed_count: failed, status: pending ? "processing" : failed ? (sent ? "partial" : "failed") : "completed", completed_at: pending ? null : new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", campaign.id);
        }
        return json({ success: true, processed, message: `${processed} email diproses.` });
      }
      return json({ success: false, message: "Aksi tidak dikenali." }, 400);
    
  },
};
