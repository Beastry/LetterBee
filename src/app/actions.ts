"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/navigation";
import { cityOptions } from "@/lib/cities";
import { validateProfileSelection } from "@/lib/profile";
import { clearCurrentUser, ensurePublicId, getCurrentUser, setCurrentUser } from "@/lib/session";

export async function loginAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();

  const next = safeNextPath(String(formData.get("next") ?? ""));
  if (!name || name.length > 24) {
    redirect(`/login?error=missing-name&next=${encodeURIComponent(next)}`);
  }
  const existing = await getCurrentUser();
  await ensurePublicId({ ...(existing ?? {}), name });
  redirect(next);

}

export async function saveProfileAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const cityId = String(formData.get("cityId") ?? "");
  const postOfficeId = String(formData.get("postOfficeId") ?? "");
  const result = validateProfileSelection({
    cityId,
    postOfficeId,
    cities: cityOptions,
  });

  if (!result.ok) {
    redirect(`/app/settings?error=${encodeURIComponent(result.error)}`);
  }

  const userWithId = await ensurePublicId(currentUser);
  await setCurrentUser({
    ...userWithId,
    cityId,
    postOfficeId,
  });

  redirect("/app");
}

export async function logoutAction() {
  await clearCurrentUser();
  redirect("/");
}
