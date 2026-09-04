import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const MAILKETING_URL = "https://stackapi.mailketing.co.id/api/v2";
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

const signTracking = async (value: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
  );
  return Array.from(signature)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const addTracking = async (
  html: string,
  campaignId: string,
  recipientId: string,
  supabaseUrl: string,
  secret: string,
) => {
  const signature = await signTracking(`${campaignId}:${recipientId}`, secret);
  const base = `${supabaseUrl}/functions/v1/email-track?c=${encodeURIComponent(campaignId)}&r=${encodeURIComponent(recipientId)}&t=${signature}`;
  const links = html.replace(
    /href=(["'])(https?:\/\/[^"'\s]+)\1/gi,
    (_, quote, target) =>
      `href=${quote}${base}&a=click&u=${encodeURIComponent(target)}${quote}`,
  );
  return `${links}<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font:12px Arial,sans-serif;color:#64748b">Anda menerima email ini dari Safar Mail. <a href="${base}&a=unsubscribe" style="color:#047857">Berhenti berlangganan</a></div><img src="${base}&a=open" width="1" height="1" alt="" style="display:block;width:1px;height:1px;opacity:0" />`;
};

const requestMailketing = async (token: string, path: string, body?: unknown, corporate = false) => {
  const response = await fetch(`${MAILKETING_URL}${corporate ? "/corporate" : ""}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-Api-Token": token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({ success: false, message: `HTTP ${response.status}` }));
  return { ...payload, http_status: response.status };
};

const extractCreditBalance = (payload: any): number | null => {
  const candidates = [
    payload?.data?.credits,
    payload?.data?.credit,
    payload?.credits,
    payload?.credit,
    payload?.saldo,
    payload?.data?.saldo,
  ];
  const raw = candidates.find(
    (value) => value !== undefined && value !== null && value !== "",
  );
  if (raw === undefined) return null;
  const normalized =
    typeof raw === "string" ? raw.replace(/[^\d.-]/g, "") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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
      const adminOnly = ["get-settings", "save-settings", "retry", "process-queue", "pause-campaign", "resume-campaign", "cancel-campaign", "list-users", "create-user", "update-user"];
      if (adminOnly.includes(action) && profile.role !== "admin") {
        return json({ success: false, message: "Akses khusus admin." }, 403);
      }

      if (action === "get-settings") {
        const [{ data: settings, error: settingsError }, { data: storedToken, error: tokenError }] = await Promise.all([
          admin.from("app_settings")
            .select("default_from_name,default_from_email,corporate_mode,updated_at")
            .eq("id", true)
            .maybeSingle(),
          admin.rpc("read_mailketing_token"),
        ]);
        if (settingsError) return json({ success: false, message: settingsError.message }, 400);
        return json({
          success: true,
          settings: settings ?? {},
          token_configured: !tokenError && Boolean(normalizeToken(storedToken)),
        });
      }

      if (action === "save-settings") {
        const submittedToken = normalizeToken(input.token);
        const { data: storedToken } = await admin.rpc("read_mailketing_token");
        const token = submittedToken || normalizeToken(storedToken);
        if (token.length < 8) return json({ success: false, message: "Token Mailketing wajib diisi." }, 422);
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
        if (submittedToken) {
          const { error } = await admin.rpc("store_mailketing_token", { p_token: token, p_user_id: userId });
          if (error) return json({ success: false, message: error.message }, 400);
        }
        const { error: settingsError } = await admin.from("app_settings").update({
          default_from_name: input.default_from_name || null,
          default_from_email: input.default_from_email || null,
          corporate_mode: Boolean(input.corporate_mode),
          updated_by: userId,
          updated_at: new Date().toISOString(),
        }).eq("id", true);
        if (settingsError) return json({ success: false, message: settingsError.message }, 400);
        return json({
          success: true,
          token_configured: true,
          message: submittedToken
            ? "Pengaturan API dan token tersimpan dengan aman."
            : "Pengaturan API diperbarui. Token tersimpan tetap digunakan.",
        });
      }

      if (action === "list-users") {
        const { data, error } = await admin.from("profiles").select("*").order("created_at");
        if (error) return json({ success: false, message: error.message }, 400);
        return json({ success: true, users: data ?? [] });
      }
      if (action === "create-user") {
        const email = String(input.email ?? "").trim().toLowerCase();
        const password = String(input.password ?? "");
        if (!email || password.length < 8)
          return json({ success: false, message: "Email dan password minimal 8 karakter wajib diisi." }, 422);
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: String(input.full_name ?? "") },
        });
        if (error || !data.user) return json({ success: false, message: error?.message ?? "Akun gagal dibuat." }, 400);
        await admin.from("profiles").upsert({
          id: data.user.id,
          email,
          full_name: String(input.full_name ?? "") || null,
          role: input.role === "admin" ? "admin" : "operator",
          active: input.active !== false,
          updated_at: new Date().toISOString(),
        });
        await admin.from("audit_logs").insert({ user_id: userId, action: "user.created", entity_type: "profile", entity_id: data.user.id, metadata: { email, role: input.role } });
        return json({ success: true, message: "Akun pengguna berhasil dibuat." });
      }
      if (action === "update-user") {
        if (!input.user_id || input.user_id === userId)
          return json({ success: false, message: "Akun sendiri tidak dapat dinonaktifkan dari menu ini." }, 422);
        const updates = {
          role: input.role === "admin" ? "admin" : "operator",
          active: Boolean(input.active),
          updated_at: new Date().toISOString(),
        };
        const { error } = await admin.from("profiles").update(updates).eq("id", input.user_id);
        if (error) return json({ success: false, message: error.message }, 400);
        await admin.from("audit_logs").insert({ user_id: userId, action: "user.updated", entity_type: "profile", entity_id: input.user_id, metadata: updates });
        return json({ success: true, message: "Hak akses pengguna diperbarui." });
      }

      const { data: token, error: tokenError } = await admin.rpc("read_mailketing_token");
      if (tokenError || !token) return json({ success: false, message: "Token Mailketing belum dikonfigurasi." }, 422);
      const provider = (path: string, body?: unknown, corporate = false) =>
        requestMailketing(normalizeToken(token), path, body, corporate);

      if (action === "sync") {
        const [credits, senders, lists] = await Promise.all([
          provider("/credits"), provider("/senders"), provider("/lists"),
        ]);
        const creditBalance = extractCreditBalance(credits);
        return json({
          success: credits.success !== false && creditBalance !== null,
          credit_balance: creditBalance,
          credits,
          senders,
          lists,
          message:
            creditBalance !== null
              ? "Kredit Mailketing berhasil diperbarui."
              : credits.message || "Saldo kredit tidak ditemukan pada respons Mailketing.",
        });
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
        const idempotencyKey = String(input.idempotency_key ?? "").trim();
        const requested = Array.isArray(input.recipients) ? input.recipients.slice(0, 10000) : [];
        if (!campaign.name || !campaign.from_email || !campaign.subject || !campaign.html_content || !requested.length) {
          return json({ success: false, message: "Data kampanye belum lengkap." }, 422);
        }
        if (idempotencyKey) {
          const { data: duplicate } = await admin.from("campaigns").select("id,status").eq("idempotency_key", idempotencyKey).maybeSingle();
          if (duplicate) return json({ success: false, code: "DUPLICATE_CAMPAIGN", campaign_id: duplicate.id, message: "Kampanye ini sudah pernah dibuat. Pengiriman ganda dicegah." }, 409);
        }
        const [{ data: suppressed }, { data: inactive }] = await Promise.all([
          admin.from("suppressions").select("email").limit(10000),
          admin.from("contacts").select("email").neq("status", "active").limit(10000),
        ]);
        const blocked = new Set([
          ...(suppressed ?? []).map((row: any) => String(row.email).toLowerCase()),
          ...(inactive ?? []).map((row: any) => String(row.email).toLowerCase()),
        ]);
        const recipients = requested.filter((item: any) => !blocked.has(String(item.email).trim().toLowerCase()));
        if (!recipients.length) return json({ success: false, message: "Semua penerima berada di daftar unsubscribe/blacklist." }, 422);
        const creditCheck = await provider("/credits");
        const credits = Number(creditCheck?.data?.credits ?? 0);
        if (creditCheck.success && recipients.length > credits) {
          return json({ success: false, code: "INSUFFICIENT_CREDITS", message: `Kredit tidak cukup. Dibutuhkan ${recipients.length}, tersedia ${credits}.` }, 422);
        }
        const status = campaign.scheduled_at ? "scheduled" : "processing";
        const { data: created, error } = await admin.from("campaigns").insert({
          ...campaign,
          idempotency_key: idempotencyKey || null,
          status,
          total_count: recipients.length,
          created_by: userId,
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
        await admin.from("audit_logs").insert({
          user_id: userId,
          action: "campaign.created",
          entity_type: "campaign",
          entity_id: created.id,
          metadata: { count: rows.length, suppressed: requested.length - rows.length },
        });
        return json({
          success: true,
          campaign_id: created.id,
          status,
          suppressed_count: requested.length - rows.length,
          message: campaign.scheduled_at
            ? "Kampanye berhasil dijadwalkan."
            : "Kampanye dibuat dan siap diproses.",
        });
      }
      if (action === "pause-campaign") {
        await admin.from("campaigns").update({ status: "paused", paused_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", input.campaign_id).in("status", ["processing", "scheduled"]);
        await admin.from("audit_logs").insert({ user_id: userId, action: "campaign.paused", entity_type: "campaign", entity_id: input.campaign_id });
        return json({ success: true, message: "Kampanye dijeda." });
      }
      if (action === "resume-campaign") {
        await admin.from("campaigns").update({ status: "processing", paused_at: null, updated_at: new Date().toISOString() }).eq("id", input.campaign_id).eq("status", "paused");
        await admin.from("audit_logs").insert({ user_id: userId, action: "campaign.resumed", entity_type: "campaign", entity_id: input.campaign_id });
        return json({ success: true, message: "Kampanye dilanjutkan." });
      }
      if (action === "cancel-campaign") {
        await admin.from("campaigns").update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", input.campaign_id).in("status", ["draft", "scheduled", "processing", "paused"]);
        await admin.from("campaign_recipients").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("campaign_id", input.campaign_id).in("status", ["pending", "processing"]);
        await admin.from("audit_logs").insert({ user_id: userId, action: "campaign.cancelled", entity_type: "campaign", entity_id: input.campaign_id });
        return json({ success: true, message: "Kampanye dibatalkan." });
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
            const personalizedContent = interpolate(campaign.html_content, variables);
            const trackedContent = await addTracking(
              personalizedContent,
              campaign.id,
              recipient.id,
              url,
              secret,
            );
            const response = await provider("/send", {
              from_name: campaign.from_name,
              from_email: campaign.from_email,
              subject: interpolate(campaign.subject, variables),
              recipient: recipient.email,
              content: trackedContent,
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
