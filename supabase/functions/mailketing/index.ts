import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const MAILKETING_URL = "https://stackapi.mailketing.co.id/api/v2";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-queue-key",
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

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const safeEqual = (left: string, right: string) => {
  if (!left || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
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
  return `${links}<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font:12px Arial,sans-serif;color:#64748b">Anda menerima email ini dari Safar Mail. <a href="${base}&amp;a=unsubscribe" style="color:#047857">Berhenti berlangganan</a></div><img src="${base}&amp;a=open" width="1" height="1" alt="" style="display:block;width:1px;height:1px;opacity:0" />`;
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

const requestMailketingV1Send = async (
  token: string,
  payload: Record<string, unknown>,
) => {
  const form = new URLSearchParams();
  form.set("api_token", token);
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      form.set(key, String(value));
    }
  });
  const response = await fetch("https://api.mailketing.co.id/api/v1/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "Accept": "application/json,text/plain,*/*",
    },
    body: form.toString(),
  });
  const raw = await response.text();
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { message: raw };
  }
  const status = String(data.status ?? data.success ?? "").toLowerCase();
  const message = String(
    data.message ?? data.result ?? data.status_message ?? raw ?? "",
  ).trim();
  const success =
    response.ok &&
    (
      data.success === true ||
      ["success", "true", "1"].includes(status) ||
      /mail sent|queued successfully|email queued|success/i.test(message)
    );
  return {
    ...data,
    success,
    message: message || (success ? "Email queued successfully" : `HTTP ${response.status}`),
    http_status: response.status,
    transport: "mailketing-v1",
  };
};

const requestMailketingV1Credits = async (token: string) => {
  const form = new URLSearchParams({ api_token: token });
  const response = await fetch("https://api.mailketing.co.id/api/v1/ceksaldo", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "Accept": "application/json,text/plain,*/*",
    },
    body: form.toString(),
  });
  const raw = await response.text();
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { message: raw };
  }
  const status = String(data.status ?? data.success ?? "").toLowerCase();
  const balance = extractCreditBalance(data);
  const success =
    response.ok &&
    balance !== null &&
    (data.success === true || ["success", "true", "1"].includes(status));
  return {
    ...data,
    success,
    message: String(
      data.message ??
        (success ? "Kredit Mailketing berhasil diperbarui." : `HTTP ${response.status}`),
    ),
    http_status: response.status,
    transport: "mailketing-v1",
  };
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

const extractVerifiedSenders = (payload: any): string[] => {
  const emails = new Set<string>();
  const visit = (value: any, depth = 0) => {
    if (depth > 5 || value === null || value === undefined) return;
    if (typeof value === "string") {
      const email = value.trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) emails.add(email);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    Object.values(value).forEach((item) => visit(item, depth + 1));
  };
  visit(payload);
  return Array.from(emails);
};

type BounceKind = "hard_bounce" | "soft_bounce" | "blacklist";

const classifyBounce = (reasonValue: unknown): {
  kind: BounceKind;
  category: string;
  expiresAt: string | null;
} => {
  const reason = String(reasonValue ?? "").trim();
  if (/blacklist|blocked by recipient|spam complaint/i.test(reason)) {
    return { kind: "blacklist", category: "Blacklist", expiresAt: null };
  }
  if (/(smtp[^0-9]*4[0-9]{2}|(^|[^0-9])4\.2\.2([^0-9]|$)|(^|[^0-9])452([^0-9]|$)|mailbox full|inbox full|over.?quota|out of storage|temporar)/i.test(reason)) {
    return {
      kind: "soft_bounce",
      category: "Inbox Penuh",
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  return { kind: "hard_bounce", category: "Email Tidak Valid", expiresAt: null };
};

export default {
  fetch: async (request: Request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
    const url = Deno.env.get("SUPABASE_URL")!;
    const secretMap = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? secretMap.default;
    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const input = await request.json().catch(() => ({}));
    const action = String(input.action ?? "");
    const queueKey = request.headers.get("x-queue-key") ?? "";
    let backgroundWorker = false;
    let workerConfig: any = null;
    let userId: string | null = null;
    let profile: { role: string; active: boolean } | null = null;

    if (action === "process-queue" && queueKey) {
      const { data: config } = await admin
        .from("queue_worker_config")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      const suppliedHash = await sha256(queueKey);
      if (
        !config?.active ||
        !safeEqual(suppliedHash, String(config?.secret_hash ?? ""))
      ) {
        return json({ success: false, message: "Kunci worker tidak valid." }, 401);
      }
      backgroundWorker = true;
      workerConfig = config;
      profile = { role: "admin", active: true };
    } else {
      const bearer = request.headers
        .get("Authorization")
        ?.replace(/^Bearer\s+/i, "");
      if (!bearer)
        return json(
          { success: false, message: "Sesi login tidak ditemukan." },
          401,
        );
      const { data: authData, error: authError } =
        await admin.auth.getUser(bearer);
      if (authError || !authData.user)
        return json(
          { success: false, message: "Sesi tidak valid atau sudah berakhir." },
          401,
        );
      userId = authData.user.id;
      const { data: userProfile } = await admin
        .from("profiles")
        .select("role,active")
        .eq("id", userId)
        .single();
      profile = userProfile;
      if (!profile?.active)
        return json({ success: false, message: "Akun tidak aktif." }, 403);
    }

    const adminOnly = [
      "get-settings",
      "save-settings",
      "retry",
      "process-queue",
      "pause-campaign",
      "resume-campaign",
      "cancel-campaign",
      "list-users",
      "create-user",
      "update-user",
    ];
    if (
      adminOnly.includes(action) &&
      !backgroundWorker &&
      profile?.role !== "admin"
    ) {
      return json({ success: false, message: "Akses khusus admin." }, 403);
    }

      if (action === "get-settings") {
        const [{ data: settings, error: settingsError }, { data: storedToken, error: tokenError }] = await Promise.all([
          admin.from("app_settings")
            .select("default_from_name,default_from_email,available_senders,corporate_mode,updated_at")
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
        const [{ data: storedToken }, { data: currentSettings }] = await Promise.all([
          admin.rpc("read_mailketing_token"),
          admin.from("app_settings")
            .select("available_senders")
            .eq("id", true)
            .maybeSingle(),
        ]);
        const token = submittedToken || normalizeToken(storedToken);
        if (token.length < 8) return json({ success: false, message: "Token Mailketing wajib diisi." }, 422);
        const officialValidation = await requestMailketingV1Credits(token).catch(
          (error) => ({
            success: false,
            message: error instanceof Error ? error.message : "Endpoint saldo tidak dapat dihubungi.",
            http_status: 0,
          }),
        );
        const validation =
          officialValidation.success
            ? officialValidation
            : await requestMailketing(token, "/credits");
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
        const selectedSender = String(input.default_from_email ?? "")
          .trim()
          .toLowerCase();
        const availableSenders = Array.from(new Set([
          ...(Array.isArray(currentSettings?.available_senders) ? currentSettings.available_senders : []),
          ...(Array.isArray(input.available_senders) ? input.available_senders : []),
          ...(selectedSender ? [selectedSender] : []),
        ].map((email) => String(email).trim().toLowerCase()).filter(Boolean)));
        const { error: settingsError } = await admin.from("app_settings").update({
          default_from_name: input.default_from_name || null,
          default_from_email: selectedSender || null,
          available_senders: availableSenders,
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
      const safeProvider = (
        path: string,
        body?: unknown,
        corporate = false,
      ) =>
        provider(path, body, corporate).catch((error) => ({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Mailketing tidak dapat dihubungi.",
          http_status: 0,
          data: null,
        }));
      const safeOfficialCredits = () =>
        requestMailketingV1Credits(normalizeToken(token)).catch((error) => ({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Endpoint saldo Mailketing tidak dapat dihubungi.",
          http_status: 0,
        }));
      const sendEmail = async (payload: Record<string, unknown>) => {
        const primary = await provider("/send", payload);
        if (
          primary.success ||
          !/internal server error|http 5\d\d/i.test(
            String(primary.message ?? `HTTP ${primary.http_status ?? ""}`),
          )
        ) {
          return primary;
        }
        console.warn("Mailketing v2 send failed; using official v1 transport", {
          provider_status: primary.http_status,
        });
        return requestMailketingV1Send(normalizeToken(token), payload);
      };

      if (action === "sync") {
        const [officialCredits, stackCredits, senders, lists, settingsResult] = await Promise.all([
          safeOfficialCredits(),
          safeProvider("/credits"),
          safeProvider("/senders"),
          safeProvider("/lists"),
          admin.from("app_settings")
            .select("default_from_email,available_senders")
            .eq("id", true)
            .maybeSingle(),
        ]);
        const officialBalance = extractCreditBalance(officialCredits);
        const stackBalance = extractCreditBalance(stackCredits);
        const credits = officialBalance !== null ? officialCredits : stackCredits;
        const creditBalance = officialBalance ?? stackBalance;
        const defaultSender = String(
          settingsResult.data?.default_from_email ?? "",
        ).trim().toLowerCase();
        const configuredSenders = Array.isArray(
          settingsResult.data?.available_senders,
        )
          ? settingsResult.data.available_senders
              .map((email: unknown) => String(email).trim().toLowerCase())
              .filter(Boolean)
          : [];
        const verifiedSenders = Array.from(
          new Set([
            ...extractVerifiedSenders(senders),
            ...configuredSenders,
            ...(defaultSender ? [defaultSender] : []),
          ]),
        );
        return json({
          success:
            creditBalance !== null ||
            senders.success === true ||
            lists.success === true,
          credit_balance: creditBalance,
          credits,
          credit_sources: {
            official: officialCredits,
            stack: stackCredits,
          },
          senders,
          verified_senders: verifiedSenders,
          active_sender: defaultSender || verifiedSenders[0] || null,
          lists,
          message:
            creditBalance !== null
              ? "Kredit Mailketing berhasil diperbarui."
              : `Saldo belum ditemukan. Official: ${officialCredits.message ?? "gagal"}; Stack: ${stackCredits.message ?? "gagal"}.`,
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
        if (input.corporate) {
          return json(await provider("/send", payload, true));
        }
        return json(await sendEmail(payload));
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
          admin.from("suppressions").select("email")
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
            .limit(10000),
          admin.from("contacts").select("email").neq("status", "active").limit(10000),
        ]);
        const blocked = new Set([
          ...(suppressed ?? []).map((row: any) => String(row.email).toLowerCase()),
          ...(inactive ?? []).map((row: any) => String(row.email).toLowerCase()),
        ]);
        const recipients = requested.filter((item: any) => !blocked.has(String(item.email).trim().toLowerCase()));
        if (!recipients.length) return json({ success: false, message: "Semua penerima berada di daftar unsubscribe/blacklist." }, 422);
        const officialCreditCheck = await safeOfficialCredits();
        const creditCheck =
          extractCreditBalance(officialCreditCheck) !== null
            ? officialCreditCheck
            : await safeProvider("/credits");
        const credits = extractCreditBalance(creditCheck) ?? 0;
        if (creditCheck.success !== false && recipients.length > credits) {
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
        const [{ data: failedRows }, { data: suppressions }, { data: inactiveContacts }] = await Promise.all([
          admin.from("campaign_recipients")
            .select("id,email,contact_id")
            .eq("campaign_id", input.campaign_id)
            .eq("status", "failed")
            .limit(10000),
          admin.from("suppressions").select("email")
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
            .limit(10000),
          admin.from("contacts")
            .select("id,email")
            .or("status.neq.active,unsubscribed_at.not.is.null,bounce_count.gt.0")
            .limit(10000),
        ]);
        const blockedEmails = new Set([
          ...(suppressions ?? []).map((row: any) => String(row.email).trim().toLowerCase()),
          ...(inactiveContacts ?? []).map((row: any) => String(row.email).trim().toLowerCase()),
        ]);
        const blockedContactIds = new Set(
          (inactiveContacts ?? []).map((row: any) => String(row.id)),
        );
        const eligibleIds = (failedRows ?? [])
          .filter((row: any) =>
            !blockedEmails.has(String(row.email).trim().toLowerCase()) &&
            (!row.contact_id || !blockedContactIds.has(String(row.contact_id)))
          )
          .map((row: any) => row.id);
        if (eligibleIds.length) {
          await admin.from("campaign_recipients").update({
            status: "pending",
            last_error: null,
            provider_message: "Menunggu pengiriman ulang",
            provider_response: null,
            provider_status_code: null,
            updated_at: new Date().toISOString(),
          }).in("id", eligibleIds);
        }
        await admin.from("campaigns").update({
          status: eligibleIds.length ? "processing" : "partial",
          updated_at: new Date().toISOString(),
        }).eq("id", input.campaign_id);
        return json({
          success: true,
          retry_count: eligibleIds.length,
          suppressed_count: (failedRows ?? []).length - eligibleIds.length,
          message: `${eligibleIds.length} email aman dimasukkan kembali ke antrean; ${(failedRows ?? []).length - eligibleIds.length} kontak bounce/nonaktif diblokir.`,
        });
      }
      if (action === "process-queue") {
        const startedAt = new Date();
        const now = startedAt.toISOString();
        if (!workerConfig) {
          const { data: config } = await admin
            .from("queue_worker_config")
            .select("*")
            .eq("id", true)
            .maybeSingle();
          workerConfig = config;
        }
        if (!workerConfig?.active)
          return json({
            success: true,
            processed: 0,
            message: "Worker background sedang nonaktif.",
          });

        const batchSize = Math.min(
          50,
          Math.max(1, Number(workerConfig.batch_size) || 20),
        );
        const maxAttempts = Math.min(
          10,
          Math.max(1, Number(workerConfig.max_attempts) || 3),
        );
        const staleBefore = new Date(
          startedAt.getTime() - 10 * 60 * 1000,
        ).toISOString();
        const { data: run } = await admin
          .from("queue_worker_runs")
          .insert({ started_at: now, status: "running" })
          .select("id")
          .single();

        await admin
          .from("queue_worker_config")
          .update({
            last_started_at: now,
            last_error: null,
            updated_at: now,
          })
          .eq("id", true);

        try {
          await admin
            .from("campaign_recipients")
            .update({
              status: "pending",
              next_attempt_at: now,
              provider_message: "Antrean macet dipulihkan otomatis.",
              updated_at: now,
            })
            .eq("status", "processing")
            .lt("updated_at", staleBefore)
            .lt("attempts", maxAttempts);

          await admin
            .from("campaign_recipients")
            .update({
              status: "failed",
              last_error: "Batas percobaan worker telah tercapai.",
              updated_at: now,
            })
            .eq("status", "processing")
            .lt("updated_at", staleBefore)
            .gte("attempts", maxAttempts);

          await admin
            .from("campaigns")
            .update({ status: "processing", updated_at: now })
            .eq("status", "scheduled")
            .lte("scheduled_at", now);

          const { data: campaigns } = await admin
            .from("campaigns")
            .select("*")
            .eq("status", "processing")
            .order("created_at")
            .limit(10);

          let processed = 0;
          let sentThisRun = 0;
          let retryThisRun = 0;
          let failedThisRun = 0;

          for (const campaign of campaigns ?? []) {
            const capacity = batchSize - processed;
            if (capacity <= 0) break;
            const { data: candidates } = await admin
              .from("campaign_recipients")
              .select("*")
              .eq("campaign_id", campaign.id)
              .eq("status", "pending")
              .order("updated_at")
              .limit(Math.max(capacity * 3, capacity));
            const recipients = (candidates ?? [])
              .filter(
                (recipient: any) =>
                  !recipient.next_attempt_at ||
                  new Date(recipient.next_attempt_at).getTime() <=
                    startedAt.getTime(),
              )
              .slice(0, capacity);

            let campaignBlockedByCredits = false;
            for (const recipient of recipients) {
              const attempt = Number(recipient.attempts ?? 0) + 1;
              const { data: claimed } = await admin
                .from("campaign_recipients")
                .update({
                  status: "processing",
                  attempts: attempt,
                  next_attempt_at: null,
                  updated_at: now,
                })
                .eq("id", recipient.id)
                .eq("status", "pending")
                .select("id")
                .maybeSingle();
              if (!claimed) continue;

              const variables = {
                email: recipient.email,
                ...(recipient.variables ?? {}),
              };
              const personalizedContent = interpolate(
                campaign.html_content,
                variables,
              );
              const trackedContent = await addTracking(
                personalizedContent,
                campaign.id,
                recipient.id,
                url,
                secret,
              );
              const stableMessageId =
                recipient.message_id || String(recipient.id);
              const sendPayload = {
                from_name: campaign.from_name,
                from_email: campaign.from_email,
                subject: interpolate(campaign.subject, variables),
                recipient: recipient.email,
                message_id: stableMessageId,
                ...(campaign.attachments?.[0]
                  ? { attach1: campaign.attachments[0] }
                  : {}),
                ...(campaign.attachments?.[1]
                  ? { attach2: campaign.attachments[1] }
                  : {}),
                ...(campaign.attachments?.[2]
                  ? { attach3: campaign.attachments[2] }
                  : {}),
              };

              let response: any;
              try {
                response = await sendEmail({
                  ...sendPayload,
                  content: trackedContent,
                });
              } catch (error) {
                response = {
                  success: false,
                  http_status: 0,
                  message:
                    error instanceof Error
                      ? error.message
                      : "Koneksi Mailketing terputus.",
                  transport: "worker-network-error",
                };
              }

              let trackingFallback = false;
              if (
                !response.success &&
                /internal server error/i.test(
                  String(response.message ?? ""),
                )
              ) {
                try {
                  response = await sendEmail({
                    ...sendPayload,
                    content: personalizedContent,
                  });
                  trackingFallback = Boolean(response.success);
                } catch (error) {
                  response = {
                    success: false,
                    http_status: 0,
                    message:
                      error instanceof Error
                        ? error.message
                        : "Koneksi Mailketing terputus.",
                    transport: "worker-network-error",
                  };
                }
              }

              const providerMessage = trackingFallback
                ? `${response.message ?? "Email queued successfully"} (tracking fallback)`
                : response.message;
              const responseText = String(response.message ?? "");
              const statusCode = Number(response.http_status ?? 0);
              const isInsufficientCredits =
                !response.success &&
                (statusCode === 402 ||
                  /insufficient credits?|kredit (tidak cukup|habis)|saldo (tidak cukup|habis)/i.test(
                    responseText,
                  ));
              const isBounce =
                !response.success &&
                !isInsufficientCredits &&
                /bounce|blacklist|bad address|invalid (recipient|email)|mailbox (not found|unavailable|full)|inbox full|over.?quota|out of storage|user unknown|domain not found|smtp[^0-9]*[45][0-9]{2}|(^|[^0-9])(452|550)([^0-9]|$)/i.test(
                  responseText,
                );
              const isRejected =
                !response.success &&
                !isInsufficientCredits &&
                !isBounce &&
                statusCode >= 400 &&
                statusCode < 500 &&
                statusCode !== 429;
              const isTemporary =
                !response.success &&
                !isBounce &&
                !isRejected &&
                attempt < maxAttempts &&
                (statusCode === 0 ||
                  statusCode === 429 ||
                  statusCode >= 500 ||
                  /timeout|temporar|network|connection|try again/i.test(
                    responseText,
                  ));
              const eventTime = new Date().toISOString();

              if (isInsufficientCredits) {
                await admin
                  .from("campaign_recipients")
                  .update({
                    status: "pending",
                    attempts: Math.max(0, attempt - 1),
                    last_error: "Kredit Mailketing tidak mencukupi. Kampanye dijeda otomatis.",
                    provider_message: providerMessage,
                    provider_response: response,
                    provider_status_code: response.http_status ?? null,
                    next_attempt_at: null,
                    updated_at: eventTime,
                  })
                  .eq("id", recipient.id);
                await admin
                  .from("campaigns")
                  .update({
                    status: "paused",
                    paused_at: eventTime,
                    completed_at: null,
                    updated_at: eventTime,
                  })
                  .eq("id", campaign.id);
                campaignBlockedByCredits = true;
              } else if (response.success) {
                await admin
                  .from("campaign_recipients")
                  .update({
                    status: "sent",
                    message_id:
                      response.data?.message_id ??
                      response.message_id ??
                      stableMessageId,
                    provider_message: providerMessage,
                    provider_response: response,
                    provider_status_code: response.http_status ?? null,
                    last_error: null,
                    sent_at: eventTime,
                    queued_at: eventTime,
                    next_attempt_at: null,
                    updated_at: eventTime,
                  })
                  .eq("id", recipient.id);
                sentThisRun++;
              } else if (isTemporary) {
                const retryAt = new Date(
                  Date.now() + Math.pow(2, attempt - 1) * 60 * 1000,
                ).toISOString();
                await admin
                  .from("campaign_recipients")
                  .update({
                    status: "pending",
                    message_id: stableMessageId,
                    last_error: responseText || "Gangguan sementara.",
                    provider_message:
                      (providerMessage || "Gangguan sementara") +
                      " · dicoba ulang otomatis",
                    provider_response: response,
                    provider_status_code: response.http_status ?? null,
                    next_attempt_at: retryAt,
                    updated_at: eventTime,
                  })
                  .eq("id", recipient.id);
                retryThisRun++;
              } else {
                const failedStatus = isBounce
                  ? "bounced"
                  : isRejected
                    ? "rejected"
                    : "failed";
                await admin
                  .from("campaign_recipients")
                  .update({
                    status: failedStatus,
                    message_id: stableMessageId,
                    last_error:
                      responseText || "Pengiriman ditolak Mailketing.",
                    provider_message: providerMessage,
                    provider_response: response,
                    provider_status_code: response.http_status ?? null,
                    bounced_at: isBounce ? eventTime : null,
                    rejected_at: isRejected ? eventTime : null,
                    next_attempt_at: null,
                    updated_at: eventTime,
                  })
                  .eq("id", recipient.id);
                if (isBounce) {
                  const classification = classifyBounce(responseText);
                  if (recipient.contact_id) {
                    const { data: contact } = await admin.from("contacts")
                      .select("category,previous_category")
                      .eq("id", recipient.contact_id)
                      .maybeSingle();
                    const systemCategories = ["Email Tidak Valid", "Inbox Penuh", "Blacklist", "Unsubscribe"];
                    const previousCategory = !systemCategories.includes(String(contact?.category ?? "Umum"))
                      ? String(contact?.category ?? "Umum")
                      : contact?.previous_category ?? null;
                    await admin
                      .from("contacts")
                      .update({
                        previous_category: previousCategory,
                        category: classification.category,
                        status: "bounced",
                        bounce_count: 1,
                        suppression_kind: classification.kind,
                        suppression_reason: responseText || "Bounce dilaporkan Mailketing",
                        suppressed_until: classification.expiresAt,
                        updated_at: eventTime,
                      })
                      .eq("id", recipient.contact_id);
                  }
                  await admin.from("suppressions").upsert({
                    email: String(recipient.email).trim().toLowerCase(),
                    contact_id: recipient.contact_id ?? null,
                    reason: responseText || "mailketing_bounce",
                    source: "mailketing_worker",
                    kind: classification.kind,
                    expires_at: classification.expiresAt,
                    updated_at: eventTime,
                    created_by: null,
                  }, { onConflict: "email" });
                }
                failedThisRun++;
              }

              processed++;
              if (campaignBlockedByCredits) break;
              await new Promise((resolve) => setTimeout(resolve, 750));
            }

            // Gunakan COUNT di database. Mengambil semua status dengan select()
            // dibatasi maksimum 1.000 baris oleh API dan membuat statistik kampanye
            // besar kembali menjadi nol atau tidak lengkap.
            const [
              { count: sentCount, error: sentCountError },
              { count: failedCount, error: failedCountError },
              { count: pendingCount, error: pendingCountError },
            ] = await Promise.all([
              admin
                .from("campaign_recipients")
                .select("id", { count: "exact", head: true })
                .eq("campaign_id", campaign.id)
                .in("status", ["sent", "delivered"]),
              admin
                .from("campaign_recipients")
                .select("id", { count: "exact", head: true })
                .eq("campaign_id", campaign.id)
                .in("status", ["failed", "bounced", "rejected"]),
              admin
                .from("campaign_recipients")
                .select("id", { count: "exact", head: true })
                .eq("campaign_id", campaign.id)
                .in("status", ["pending", "processing"]),
            ]);
            const countError =
              sentCountError ?? failedCountError ?? pendingCountError;
            if (countError) throw countError;
            const sent = sentCount ?? 0;
            const failed = failedCount ?? 0;
            const pending = pendingCount ?? 0;
            await admin
              .from("campaigns")
              .update({
                sent_count: sent,
                failed_count: failed,
                status: campaignBlockedByCredits
                  ? "paused"
                  : pending
                  ? "processing"
                  : failed
                    ? sent
                      ? "partial"
                      : "failed"
                    : "completed",
                completed_at:
                  campaignBlockedByCredits || pending
                    ? null
                    : new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", campaign.id);
          }

          const completedAt = new Date().toISOString();
          await admin
            .from("queue_worker_config")
            .update({
              last_completed_at: completedAt,
              last_processed: processed,
              last_error: null,
              updated_at: completedAt,
            })
            .eq("id", true);
          if (run?.id) {
            await admin
              .from("queue_worker_runs")
              .update({
                completed_at: completedAt,
                processed_count: processed,
                sent_count: sentThisRun,
                retry_count: retryThisRun,
                failed_count: failedThisRun,
                status: "completed",
              })
              .eq("id", run.id);
          }
          return json({
            success: true,
            background: backgroundWorker,
            processed,
            sent: sentThisRun,
            retries: retryThisRun,
            failed: failedThisRun,
            message: `${processed} email diproses oleh worker background.`,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Worker gagal.";
          const completedAt = new Date().toISOString();
          await admin
            .from("queue_worker_config")
            .update({
              last_completed_at: completedAt,
              last_error: errorMessage,
              updated_at: completedAt,
            })
            .eq("id", true);
          if (run?.id) {
            await admin
              .from("queue_worker_runs")
              .update({
                completed_at: completedAt,
                status: "failed",
                error_message: errorMessage,
              })
              .eq("id", run.id);
          }
          return json(
            { success: false, message: errorMessage, background: true },
            500,
          );
        }
      }
      return json({ success: false, message: "Aksi tidak dikenali." }, 400);
    
  },
};
