type Payload = Record<string, unknown>;

function record(value: unknown): Payload {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Payload : {};
}

function creditNumber(value: unknown): number | null {
  if (typeof value === "string") {
    const text = value.trim();
    // Credits are whole units. Accept plain integers and unambiguous thousands groups.
    if (!/^\d+$/.test(text) && !/^\d{1,3}(?:,\d{3})+$/.test(text) && !/^\d{1,3}(?:\.\d{3})+$/.test(text)) return null;
    value = Number(text.replace(/[.,]/g, ""));
  }
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** V1 ceksaldo and V2 credits, including a normalized sync response. */
export function extractCreditBalance(payload: unknown): number | null {
  const root = record(payload);
  const status = String(root["status"] ?? "").toLowerCase();
  if (root["success"] === false || ["false", "failed", "error"].includes(status) || Number(root["http_status"] ?? 200) >= 400) return null;
  const data = record(root["data"]);
  for (const value of [root["credit_balance"], data["credits"], data["credit"], root["credits"], root["credit"], root["saldo"], data["saldo"]]) {
    const parsed = creditNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

export function getCreditBalance(provider: unknown): number | undefined {
  const root = record(provider);
  if (root["token_configured"] === false) return undefined;
  const sources = record(root["credit_sources"]);
  return extractCreditBalance(provider) ?? extractCreditBalance(root["credits"]) ??
    extractCreditBalance(sources["official"]) ?? extractCreditBalance(sources["stack"]) ?? undefined;
}
