import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const safeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
};

export default {
  fetch: async (request: Request) => {
    if (request.method !== "POST") return json({ success: false, message: "POST required" }, 405);
    const requestUrl = new URL(request.url);
    const suppliedSecret = requestUrl.searchParams.get("key") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const secretMap = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? secretMap.default;
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: config } = await admin
      .from("mailketing_webhook_config")
      .select("secret_hash,active")
      .eq("id", true)
      .maybeSingle();
    const suppliedHash = suppliedSecret ? await sha256(suppliedSecret) : "";
    if (!config?.active || !safeEqual(suppliedHash, String(config?.secret_hash ?? "")))
      return json({ success: false, message: "Invalid webhook key" }, 401);

    const payload = await request.json().catch(() => null);
    const type = String(payload?.type ?? "").trim().toLowerCase();
    const email = String(payload?.email ?? "").trim().toLowerCase();
    const supported = ["emailopen", "emailclick", "bounce", "unsubscribe"];
    if (!supported.includes(type) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json({ success: false, message: "Unsupported webhook payload" }, 422);

    const eventDate = new Date(payload?.date ?? Date.now());
    const occurredAt = Number.isNaN(eventDate.getTime())
      ? new Date().toISOString()
      : eventDate.toISOString();
    let recipientQuery = admin
      .from("campaign_recipients")
      .select("id,campaign_id,contact_id,email,provider_opened_at,provider_first_clicked_at,provider_open_count,provider_click_count")
      .eq("email", email)
      .in("status", ["sent", "delivered", "bounced"])
      .order("sent_at", { ascending: false })
      .limit(1);
    if (!Number.isNaN(eventDate.getTime()))
      recipientQuery = recipientQuery.lte("sent_at", occurredAt);
    const { data: recipients } = await recipientQuery;
    const recipient = recipients?.[0];
    if (!recipient)
      return json({ success: true, matched: false, message: "Event diterima; penerima kampanye tidak ditemukan." });

    const link = String(payload?.link_clicked ?? "");
    const eventType = type === "emailopen" ? "open" : type === "emailclick" ? "click" : type;
    const eventKey = await sha256([type, email, occurredAt, link].join("|"));
    const { error: eventError } = await admin.from("email_events").insert({
      campaign_id: recipient.campaign_id,
      recipient_id: recipient.id,
      event_type: eventType,
      target_url: link || null,
      user_agent: request.headers.get("user-agent"),
      created_at: occurredAt,
      source: "mailketing",
      event_key: eventKey,
      provider_payload: payload,
    });
    if (eventError?.code === "23505")
      return json({ success: true, matched: true, duplicate: true });
    if (eventError) return json({ success: false, message: eventError.message }, 500);

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (type === "emailopen") {
      const count = Number(recipient.provider_open_count ?? 0) + 1;
      updates.provider_opened_at = recipient.provider_opened_at ?? occurredAt;
      updates.provider_open_count = count;
      updates.opened_at = recipient.provider_opened_at ?? occurredAt;
      updates.open_count = count;
    } else if (type === "emailclick") {
      const count = Number(recipient.provider_click_count ?? 0) + 1;
      updates.provider_first_clicked_at = recipient.provider_first_clicked_at ?? occurredAt;
      updates.provider_click_count = count;
      updates.first_clicked_at = recipient.provider_first_clicked_at ?? occurredAt;
      updates.click_count = count;
    } else if (type === "bounce") {
      updates.status = "bounced";
      updates.bounced_at = occurredAt;
      updates.last_error = String(payload?.reason ?? "Bounce dilaporkan Mailketing");
      if (recipient.contact_id) {
        await admin.from("contacts").update({
          status: "bounced",
          bounce_count: 1,
          updated_at: new Date().toISOString(),
        }).eq("id", recipient.contact_id);
      }
      await admin.from("suppressions").upsert({
        email,
        contact_id: recipient.contact_id,
        reason: String(payload?.reason ?? "mailketing_bounce"),
        source: "mailketing_webhook",
        created_by: null,
      }, { onConflict: "email" });
    } else if (type === "unsubscribe") {
      if (recipient.contact_id) {
        await admin.from("contacts").update({
          status: "unsubscribed",
          unsubscribed_at: occurredAt,
          updated_at: new Date().toISOString(),
        }).eq("id", recipient.contact_id);
      }
      await admin.from("suppressions").upsert({
        email,
        contact_id: recipient.contact_id,
        reason: "unsubscribe",
        source: "mailketing_webhook",
        created_by: null,
      }, { onConflict: "email" });
    }
    await admin.from("campaign_recipients").update(updates).eq("id", recipient.id);

    const [{ count: opened }, { count: clicked }, { count: bounced }] = await Promise.all([
      admin.from("campaign_recipients").select("id", { count: "exact", head: true })
        .eq("campaign_id", recipient.campaign_id).not("provider_opened_at", "is", null),
      admin.from("campaign_recipients").select("id", { count: "exact", head: true })
        .eq("campaign_id", recipient.campaign_id).not("provider_first_clicked_at", "is", null),
      admin.from("campaign_recipients").select("id", { count: "exact", head: true })
        .eq("campaign_id", recipient.campaign_id).eq("status", "bounced"),
    ]);
    await admin.from("campaigns").update({
      opened_count: opened ?? 0,
      clicked_count: clicked ?? 0,
      failed_count: bounced ?? 0,
      updated_at: new Date().toISOString(),
    }).eq("id", recipient.campaign_id);
    await admin.from("mailketing_webhook_config").update({
      last_event_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", true);
    return json({ success: true, matched: true, event: eventType });
  },
};
