import { randomInt } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const LENGTH = 7;

export function generatePublicId(): string {
  return Array.from({ length: LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export async function allocatePublicId(
  exists: (id: string) => Promise<boolean> | boolean,
  maxAttempts = 10,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const id = generatePublicId();
    if (!(await exists(id))) return id;
  }
  throw new Error("Unable to allocate a public ID after maximum attempts");
}
