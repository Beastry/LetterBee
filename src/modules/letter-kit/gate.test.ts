import { describe, expect, it } from "vitest";
import {
  GATE_MAX_ATTEMPTS,
  GATE_WINDOW_MS,
  assessAttempt,
  createAttemptStore,
  hashPassphrase,
  recordFailure,
  signLetterSession,
  verifyLetterSession,
  verifyPassphrase,
} from "./gate";

describe("passphrase hash", () => {
  it("verifies the same passphrase and rejects a different one", () => {
    const encoded = hashPassphrase("7041");

    expect(encoded.startsWith("scrypt$")).toBe(true);
    expect(encoded).not.toContain("7041");
    expect(verifyPassphrase("7041", encoded)).toBe(true);
    expect(verifyPassphrase("7042", encoded)).toBe(false);
    expect(verifyPassphrase("7041", "not-a-hash")).toBe(false);
    expect(verifyPassphrase("7041", "scrypt$%%%$%%%")).toBe(false);
  });
});

describe("letter session", () => {
  const secret = "test-secret-at-least-16";

  it("accepts a signed token for the same letter before expiry", () => {
    const token = signLetterSession({ slug: "sample", secret, now: 1_000, ttlMs: 5_000 });

    expect(verifyLetterSession(token, "sample", secret, 1_000)).toBe(true);
    expect(verifyLetterSession(token, "sample", secret, 5_999)).toBe(true);
  });

  it("rejects expiry, the wrong letter, a bad signature, and a missing token", () => {
    const token = signLetterSession({ slug: "sample", secret, now: 1_000, ttlMs: 5_000 });

    expect(verifyLetterSession(token, "sample", secret, 6_000)).toBe(false);
    expect(verifyLetterSession(token, "other", secret, 1_000)).toBe(false);
    expect(verifyLetterSession(token, "sample", "another-secret-value", 1_000)).toBe(false);
    expect(verifyLetterSession(undefined, "sample", secret, 1_000)).toBe(false);
    expect(verifyLetterSession(`${token}x`, "sample", secret, 1_000)).toBe(false);
  });
});

describe("gate rate limit", () => {
  it("allows five failures and then blocks until the window passes", () => {
    let state = assessAttempt(undefined, 1_000).state;

    for (let attempt = 0; attempt < GATE_MAX_ATTEMPTS - 1; attempt += 1) {
      expect(assessAttempt(state, 1_000 + attempt).blocked).toBe(false);
      state = recordFailure(state, 1_000 + attempt);
    }

    expect(assessAttempt(state, 2_000).blocked).toBe(false);
    state = recordFailure(state, 2_000);
    expect(state.failures).toBe(GATE_MAX_ATTEMPTS);
    expect(assessAttempt(state, 2_000).blocked).toBe(true);
    expect(assessAttempt(state, 2_000 + GATE_WINDOW_MS).blocked).toBe(false);
  });

  it("keeps an active block after the original window start has expired", () => {
    const state = { failures: GATE_MAX_ATTEMPTS, windowStartedAt: 0, blockedUntil: 20_000 };

    expect(assessAttempt(state, 15_000).blocked).toBe(true);
  });

  it("resets a store bucket after success", () => {
    const store = createAttemptStore();

    for (let attempt = 0; attempt < GATE_MAX_ATTEMPTS; attempt += 1) {
      expect(store.blocked("local:sample", 5_000)).toBe(false);
      store.fail("local:sample", 5_000);
    }

    expect(store.blocked("local:sample", 5_000)).toBe(true);
    store.succeed("local:sample");
    expect(store.blocked("local:sample", 5_000)).toBe(false);
  });
});
