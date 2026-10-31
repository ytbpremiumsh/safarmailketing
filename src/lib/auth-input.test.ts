import { describe, expect, it } from "vitest";
import { canSubmitCredentials, normalizeLoginEmail, recoveryCredentials } from "./auth-input";

describe("safe login and recovery", () => {
  it("normalizes email without modifying the password", () => {
    expect(normalizeLoginEmail("  Owner@Example.com ")).toBe("owner@example.com");
    expect(canSubmitCredentials("owner@example.com", "short")).toBe(true);
    expect(canSubmitCredentials("owner@example.com", "")).toBe(false);
  });
  it("keeps minimum length for new passwords at eight characters", () => {
    expect(canSubmitCredentials("owner@example.com", "1234567", true)).toBe(false);
    expect(canSubmitCredentials("owner@example.com", "12345678", true)).toBe(true);
  });
  it("rejects ordinary sign-in links and incomplete recovery links", () => {
    expect(recoveryCredentials("#type=signup&access_token=test&refresh_token=test")).toBeNull();
    expect(recoveryCredentials("#type=recovery&access_token=test")).toBeNull();
    expect(recoveryCredentials("#type=recovery&access_token=test&refresh_token=refresh")).toEqual({ access_token: "test", refresh_token: "refresh" });
  });
});