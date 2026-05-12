"use server";

import { redirect } from "next/navigation";
import { cityOptions } from "@/lib/cities";
import { validateProfileSelection } from "@/lib/profile";
import { clearCurrentUser, getCurrentUser, setCurrentUser } from "@/lib/session";

export async function loginAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    redirect("/login?error=missing-name");
  }

  await setCurrentUser({ name });
  redirect("/app/settings");
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

  await setCurrentUser({
    ...currentUser,
    cityId,
    postOfficeId,
  });

  redirect("/app");
}

export async function logoutAction() {
  await clearCurrentUser();
  redirect("/");
}
