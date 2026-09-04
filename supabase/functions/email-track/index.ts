import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const hex = (bytes: Uint8Array) =>
  Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");

const hmac = async (value: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
};

const safeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
};

const pixel = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="),
  (character) => character.charCodeAt(0),
);

export default {
  fetch: async (request: Request) => {
    const requestUrl = new URL(request.url);
    const campaignId = requestUrl.searchParams.get("c") ?? "";
    const recipientId = requestUrl.searchParams.get("r") ?? "";
    const token = requestUrl.searchParams.get("t") ?? "";
    const requestedAction = requestUrl.searchParams.get("a");
    const action = requestedAction === "click"
      ? "click"
      : requestedAction === "unsubscribe"
        ? "unsubscribe"
        : "open";
    const target = requestUrl.searchParams.get("u") ?? "";

    const url = Deno.env.get("SUPABASE_URL")!;
    const secretMap = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? secretMap.default;
    const expected = await hmac(`${campaignId}:${recipientId}`, secret);
    if (!campaignId || !recipientId || !safeEqual(token, expected))
      return new Response("Invalid tracking token", { status: 403 });

    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: recipient } = await admin
      .from("campaign_recipients")
      .select("contact_id,email,opened_at,first_clicked_at,open_count,click_count")
      .eq("id", recipientId)
      .eq("campaign_id", campaignId)
      .maybeSingle();

    if (recipient && action === "unsubscribe") {
      const now = new Date().toISOString();
      if (recipient.contact_id)
        await admin
          .from("contacts")
          .update({ status: "unsubscribed", unsubscribed_at: now })
          .eq("id", recipient.contact_id);
      await admin.from("suppressions").upsert(
        {
          email: recipient.email,
          contact_id: recipient.contact_id,
          reason: "unsubscribe",
          source: "email_link",
          created_by: null,
        },
        { onConflict: "email" },
      );
      return new Response(
        `<!doctype html><html lang="id"><meta name="viewport" content="width=device-width"><title>Berhenti Berlangganan</title><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a"><main style="max-width:520px;margin:10vh auto;padding:24px"><div style="background:white;border:1px solid #e2e8f0;border-radius:20px;padding:32px;text-align:center"><h1 style="color:#047857">Berhasil</h1><p>Email Anda telah dikeluarkan dari daftar pengiriman Safar Mail.</p></div></main></body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
      );
    }

    if (recipient) {
      const now = new Date().toISOString();
      const firstEvent = action === "open" ? !recipient.opened_at : !recipient.first_clicked_at;
      await admin
        .from("campaign_recipients")
        .update(
          action === "open"
            ? {
                opened_at: recipient.opened_at ?? now,
                open_count: (recipient.open_count ?? 0) + 1,
                updated_at: now,
              }
            : {
                first_clicked_at: recipient.first_clicked_at ?? now,
                click_count: (recipient.click_count ?? 0) + 1,
                updated_at: now,
              },
        )
        .eq("id", recipientId);

      if (firstEvent) {
        const field = action === "open" ? "opened_count" : "clicked_count";
        const { data: campaign } = await admin
          .from("campaigns")
          .select(field)
          .eq("id", campaignId)
          .single();
        await admin
          .from("campaigns")
          .update({ [field]: Number(campaign?.[field] ?? 0) + 1, updated_at: now })
          .eq("id", campaignId);
      }

      const forwarded = request.headers.get("x-forwarded-for") ?? "";
      const ipHash = forwarded
        ? hex(new Uint8Array(await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(`${forwarded}:${secret}`),
          )))
        : null;
      await admin.from("email_events").insert({
        campaign_id: campaignId,
        recipient_id: recipientId,
        event_type: action,
        target_url: action === "click" ? target : null,
        user_agent: request.headers.get("user-agent"),
        ip_hash: ipHash,
      });
    }

    if (action === "click") {
      try {
        const destination = new URL(target);
        if (["http:", "https:"].includes(destination.protocol))
          return Response.redirect(destination.toString(), 302);
      } catch {}
      return new Response("Invalid destination", { status: 400 });
    }

    return new Response(pixel, {
      headers: {
        "Content-Type": "image/gif",
        "Content-Length": String(pixel.length),
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  },
};
