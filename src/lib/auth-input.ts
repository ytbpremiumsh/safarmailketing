export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function canSubmitCredentials(email: string, password: string, registering = false): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeLoginEmail(email)) &&
    password.length >= (registering ? 8 : 1);
}

export function recoveryCredentials(hash: string): { access_token: string; refresh_token: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (params.get("type") !== "recovery" || !access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}