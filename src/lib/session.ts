import { cookies } from "next/headers";
import { allocatePublicId } from "./public-id";

const SESSION_COOKIE = "zqc_user";

export type CurrentUser = {
  name: string;
  publicId?: string;
  cityId?: string;
  postOfficeId?: string;
};

export async function ensurePublicId(user: CurrentUser): Promise<CurrentUser & { publicId: string }> {
  if (user.publicId) return { ...user, publicId: user.publicId };

  // Cookie-only MVP: there is no shared user registry to check yet.
  const publicId = await allocatePublicId(() => false);
  const updatedUser = { ...user, publicId };
  await setCurrentUser(updatedUser);
  return updatedUser;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function setCurrentUser(user: CurrentUser): Promise<void> {
  const cookieStore = await cookies();
  const value = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");

  cookieStore.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearCurrentUser(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
