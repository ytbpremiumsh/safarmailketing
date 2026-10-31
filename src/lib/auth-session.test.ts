import { describe, expect, it, vi } from "vitest";
import { restoreCloudSession } from "./auth-session";

describe("Cloud session restoration", () => {
  it("keeps the current Cloud user instead of restoring an old cached user", async () => {
    const session = { access_token: "current", user: { id: "cloud-user" } };
    const auth = { getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }), setSession: vi.fn() };
    expect(await restoreCloudSession(auth as never, "invalid old cache")).toBe(session);
    expect(auth.setSession).not.toHaveBeenCalled();
  });
  it("migrates complete legacy credentials through Auth validation", async () => {
    const session = { access_token: "validated", user: { id: "cloud-user" } };
    const auth = { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }), setSession: vi.fn().mockResolvedValue({ data: { session }, error: null }) };
    expect(await restoreCloudSession(auth as never, JSON.stringify({ access_token: "old", refresh_token: "refresh" }))).toBe(session);
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: "old", refresh_token: "refresh" });
  });
  it("does not send malformed legacy caches to Auth", async () => {
    const auth = { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }), setSession: vi.fn() };
    for (const saved of [null, "broken", "null", "{}", '{"access_token":"only"}']) {
      expect(await restoreCloudSession(auth as never, saved)).toBeNull();
    }
    expect(auth.setSession).not.toHaveBeenCalled();
  });
  it("never accepts a cache whose tokens Auth rejects", async () => {
    const error = new Error("Invalid refresh token");
    const auth = { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }), setSession: vi.fn().mockResolvedValue({ data: { session: null }, error }) };
    await expect(restoreCloudSession(auth as never, '{"access_token":"old","refresh_token":"bad"}')).rejects.toBe(error);
  });
});
