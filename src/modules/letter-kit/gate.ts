import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const GATE_MAX_ATTEMPTS = 5;
export const GATE_WINDOW_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SCRYPT_KEYLEN = 32;
const DEV_SESSION_SECRET = "dev-only-letter-session-not-for-production";

export type AttemptBucket = {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number;
};

export function hashPassphrase(passphrase: string, salt = randomBytes(16)): string {
  const key = scryptSync(normalizePassphrase(passphrase), salt, SCRYPT_KEYLEN, {
    N: 16384,
    r: 8,
    p: 1,
  });

  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export function verifyPassphrase(passphrase: string, encoded: string): boolean {
  const [algorithm, saltPart, keyPart] = encoded.split("$");

  if (algorithm !== "scrypt" || !saltPart || !keyPart) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;

  try {
    salt = Buffer.from(saltPart, "base64url");
    expected = Buffer.from(keyPart, "base64url");
  } catch {
    return false;
  }

  if (salt.length === 0 || expected.length === 0) {
    return false;
  }

  const actual = scryptSync(normalizePassphrase(passphrase), salt, expected.length, {
    N: 16384,
    r: 8,
    p: 1,
  });

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function normalizePassphrase(passphrase: string): string {
  return passphrase.normalize("NFKC").trim();
}

export function letterSessionCookieName(slug: string): string {
  return `zqc_letter_${slug}`;
}

export function getSessionSecret(): string {
  const fromEnv = process.env.LETTER_SESSION_SECRET?.trim();

  if (fromEnv && fromEnv.length >= 16) {
    return fromEnv;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("生产环境必须设置 LETTER_SESSION_SECRET");
  }

  return DEV_SESSION_SECRET;
}

export function signLetterSession({
  slug,
  secret,
  now,
  ttlMs = SESSION_TTL_MS,
}: {
  slug: string;
  secret: string;
  now: number;
  ttlMs?: number;
}): string {
  const payload = Buffer.from(
    JSON.stringify({ slug, exp: now + ttlMs }),
    "utf8",
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");

  return `${payload}.${signature}`;
}

export function letterSessionIsOpen(token: string | undefined, slug: string): boolean {
  return verifyLetterSession(token, slug, getSessionSecret(), Date.now());
}

export function verifyLetterSession(
  token: string | undefined,
  slug: string,
  secret: string,
  now: number,
): boolean {
  if (!token || !secret) {
    return false;
  }

  const separator = token.lastIndexOf(".");

  if (separator <= 0) {
    return false;
  }

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return false;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      slug?: unknown;
      exp?: unknown;
    };

    return data.slug === slug && typeof data.exp === "number" && data.exp > now;
  } catch {
    return false;
  }
}

export function assessAttempt(
  state: AttemptBucket | undefined,
  now: number,
): { blocked: boolean; state: AttemptBucket } {
  if (state && state.blockedUntil > now) {
    return { blocked: true, state };
  }

  if (!state || now - state.windowStartedAt >= GATE_WINDOW_MS) {
    return {
      blocked: false,
      state: { failures: 0, windowStartedAt: now, blockedUntil: 0 },
    };
  }

  return { blocked: false, state };
}

export function recordFailure(state: AttemptBucket, now: number): AttemptBucket {
  const failures = state.failures + 1;

  if (failures >= GATE_MAX_ATTEMPTS) {
    return {
      ...state,
      failures,
      blockedUntil: now + GATE_WINDOW_MS,
    };
  }

  return { ...state, failures };
}

export function createAttemptStore() {
  const buckets = new Map<string, AttemptBucket>();

  return {
    blocked(key: string, now: number): boolean {
      const assessed = assessAttempt(buckets.get(key), now);
      buckets.set(key, assessed.state);
      return assessed.blocked;
    },
    fail(key: string, now: number): AttemptBucket {
      const assessed = assessAttempt(buckets.get(key), now);
      const next = recordFailure(assessed.state, now);
      buckets.set(key, next);
      return next;
    },
    succeed(key: string): void {
      buckets.delete(key);
    },
  };
}

const globalBuckets = globalThis as typeof globalThis & {
  __zqcLetterGateAttempts?: Map<string, AttemptBucket>;
};

function sharedBuckets(): Map<string, AttemptBucket> {
  if (!globalBuckets.__zqcLetterGateAttempts) {
    globalBuckets.__zqcLetterGateAttempts = new Map();
  }

  return globalBuckets.__zqcLetterGateAttempts;
}

export function gateAttemptKey(ip: string, slug: string): string {
  return `${ip}:${slug}`;
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "local";
  }

  return headers.get("x-real-ip")?.trim() || "local";
}

export const letterGateAttempts = {
  blocked(key: string, now = Date.now()): boolean {
    const buckets = sharedBuckets();
    const assessed = assessAttempt(buckets.get(key), now);
    buckets.set(key, assessed.state);
    return assessed.blocked;
  },
  fail(key: string, now = Date.now()): void {
    const buckets = sharedBuckets();
    const assessed = assessAttempt(buckets.get(key), now);
    buckets.set(key, recordFailure(assessed.state, now));
  },
  succeed(key: string): void {
    sharedBuckets().delete(key);
  },
};
