import { createHmac, timingSafeEqual } from "node:crypto";
import { getSessionSecret } from "@/modules/letter-kit/gate";

export function encodeSession(user: object): string {
  const payload = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(`user:${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}
export function decodeSession(value: string): unknown {
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", getSessionSecret()).update(`user:${payload}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); }
  catch { return null; }
}
