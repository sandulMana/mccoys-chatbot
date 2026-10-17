import { describe, expect, it } from "vitest";
import { isRecoveryLink, recoveryLinkError } from "@/lib/password-recovery";

describe("Password recovery links", () => {
  it("recognizes a recovery callback", () => {
    expect(isRecoveryLink("#type=recovery&access_token=test")).toBe(true);
  });
  it("does not treat a regular sign-in callback as password recovery", () => {
    expect(isRecoveryLink("#type=signup")).toBe(false);
    expect(isRecoveryLink("")).toBe(false);
  });
  it("rejects an expired recovery callback", () => {
    expect(isRecoveryLink("#type=recovery&error_code=otp_expired")).toBe(false);
    expect(recoveryLinkError("#error=access_denied&error_code=otp_expired")).not.toBeNull();
  });
});