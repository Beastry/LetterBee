import { cookies } from "next/headers";

const SESSION_COOKIE = "zqc_user";

export type CurrentUser = {
  name: string;
  cityId?: string;
  postOfficeId?: string;
};

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
