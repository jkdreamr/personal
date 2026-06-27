import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken, timingSafeEqualStr } from "@/lib/auth/session";
import { verifySessionTokenEdge } from "@/lib/auth/edge-session";

const SECRET = "a-strong-test-secret-at-least-32-characters-long";

describe("beta session cookie", () => {
  it("round-trips a valid token", () => {
    const token = createSessionToken(SECRET);
    expect(verifySessionToken(token, SECRET)).toBe(true);
  });
  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken(SECRET);
    expect(verifySessionToken(token, "another-secret-also-32-characters-xx")).toBe(false);
  });
  it("rejects tampered tokens and junk", () => {
    const token = createSessionToken(SECRET);
    expect(verifySessionToken(token + "x", SECRET)).toBe(false);
    expect(verifySessionToken("not.a.token", SECRET)).toBe(false);
    expect(verifySessionToken(undefined, SECRET)).toBe(false);
    expect(verifySessionToken(token, "")).toBe(false);
  });
  it("edge verifier agrees with the node signer (byte-compatible HMAC)", async () => {
    const token = createSessionToken(SECRET);
    expect(await verifySessionTokenEdge(token, SECRET)).toBe(true);
    expect(await verifySessionTokenEdge(token, "wrong-secret-32-characters-minimum-x")).toBe(false);
  });
});

describe("timing-safe comparison", () => {
  it("is true only for exact matches", () => {
    expect(timingSafeEqualStr("harbor-beta", "harbor-beta")).toBe(true);
    expect(timingSafeEqualStr("harbor-beta", "harbor-Beta")).toBe(false);
    expect(timingSafeEqualStr("harbor-beta", "harbor-beta-extra")).toBe(false);
    expect(timingSafeEqualStr("", "")).toBe(true);
  });
});
