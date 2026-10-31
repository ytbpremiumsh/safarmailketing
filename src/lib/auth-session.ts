import type { Session, SupabaseClient } from "@supabase/supabase-js";

type SessionAuth = Pick<SupabaseClient["auth"], "getSession" | "setSession">;

/** A current Cloud session takes precedence over the former application cache. */
export async function restoreCloudSession(auth: SessionAuth, legacy: string | null): Promise<Session | null> {
  const { data, error } = await auth.getSession();
  if (error) throw error;
  if (data.session || !legacy) return data.session;
  let saved: unknown;
  try { saved = JSON.parse(legacy); } catch { return null; }
  if (!saved || typeof saved !== "object") return null;
  const tokens = saved as Record<string, unknown>;
  if (typeof tokens["access_token"] !== "string" || !tokens["access_token"] ||
      typeof tokens["refresh_token"] !== "string" || !tokens["refresh_token"]) return null;
  const restored = await auth.setSession({ access_token: tokens["access_token"], refresh_token: tokens["refresh_token"] });
  if (restored.error) throw restored.error;
  return restored.data.session;
}
