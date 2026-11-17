import { createMailDraft } from "@/lib/mail-store";
import { apiUser, mailError, privateHeaders } from "@/lib/mail-api";
export async function POST(request: Request) {
  try {
    return Response.json(await createMailDraft(await apiUser(request, true)), {
      status: 201,
      headers: privateHeaders,
    });
  } catch (e) {
    return mailError(e);
  }
}
