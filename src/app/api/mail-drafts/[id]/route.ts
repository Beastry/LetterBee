import { getMailDraft, saveMailDraft } from "@/lib/mail-store";
import {
  apiUser,
  mailError,
  readMailJSON,
  privateHeaders,
} from "@/lib/mail-api";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const user = await apiUser(request);
    return Response.json(await getMailDraft(user.id, (await params).id), {
      headers: privateHeaders,
    });
  } catch (e) {
    return mailError(e);
  }
}
export async function PUT(request: Request, { params }: Context) {
  try {
    const user = await apiUser(request, true),
      data = await readMailJSON(request);
    return Response.json(
      await saveMailDraft(
        user.id,
        (await params).id,
        Number(data.revision),
        data.document,
      ),
      { headers: privateHeaders },
    );
  } catch (e) {
    return mailError(e);
  }
}
