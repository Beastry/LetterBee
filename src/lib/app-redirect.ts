import { redirect } from "next/navigation";
import { appPath } from "./app-path";
/** Native Next Server Action HTTP 303 responses do not add basePath themselves. */
export function appRedirect(path: string): never {
  return redirect(appPath(path));
}
