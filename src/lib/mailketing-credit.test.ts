import { describe, expect, it } from "vitest";
import { extractCreditBalance, getCreditBalance } from "../../supabase/functions/_shared/mailketing-credit.ts";

describe("Mailketing balance compatibility", () => {
  it("reads the documented V1 and V2 responses and a normalized sync", () => {
    expect(getCreditBalance({ credits: { status: "true", credits: "1234" } })).toBe(1234);
    expect(getCreditBalance({ credits: { success: true, data: { credits: 2345 } } })).toBe(2345);
    expect(getCreditBalance({ credit_balance: 3456 })).toBe(3456);
  });
  it("keeps zero, including a fallback after a malformed preferred field", () => {
    expect(getCreditBalance({ credit_balance: "bad", credits: { saldo: 0 } })).toBe(0);
    expect(extractCreditBalance({ data: { credits: {} }, credits: "1.234" })).toBe(1234);
  });
  it("does not turn errors, objects, booleans or empty fields into a balance", () => {
    for (const credits of [null, "", "  ", {}, [], false, "Error 401", "-2", "1.5", Infinity]) {
      expect(extractCreditBalance({ credits })).toBeNull();
    }
    expect(extractCreditBalance({ success: false, credits: 500 })).toBeNull();
    expect(getCreditBalance({ token_configured: false, credit_balance: 500 })).toBeUndefined();
  });
  it("uses a valid alternative when a provider reports failure", () => {
    expect(getCreditBalance({ credit_sources: { official: { success: false, credits: 100 }, stack: { success: true, data: { credits: "2,000" } } } })).toBe(2000);
  });
});
