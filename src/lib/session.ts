import { decodeSession, encodeSession } from "./session-codec";
import { cookies } from "next/headers";
import { registerMailUser, type MailUser } from "./mail-store";

import { cookieOptions } from "./app-path";

const SESSION_COOKIE = "zqc_user";

export type CurrentUser = {
  id?: string;
  name: string;
  publicId?: string;
  cityId?: string;
  postOfficeId?: string;
};

export async function ensurePublicId(user: Omit<CurrentUser, "id"> & { id?: string }): Promise<MailUser> {
  const updatedUser = await registerMailUser(user);
  if (!user.id || user.publicId !== updatedUser.publicId) await writeSessionCookie(updatedUser);
  return updatedUser;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;

  if (!value) {
    return null;
  }

  try {
    const user = decodeSession(value) as CurrentUser | null;
    return user && typeof user.name === "string" && typeof user.id === "string" && typeof user.publicId === "string" ? user : null;
  } catch {
    return null;
  }
}

export async function setCurrentUser(user: CurrentUser): Promise<void> {
  const registered = await registerMailUser(user);
  await writeSessionCookie(registered);
}

async function writeSessionCookie(registered: CurrentUser): Promise<void> {
  const cookieStore = await cookies();
  const value = encodeSession(registered);

  cookieStore.set(SESSION_COOKIE, value, {
    ...cookieOptions(),
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearCurrentUser(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0, expires: new Date(0) });
}
