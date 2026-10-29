import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { saveLetterMedia } from "@/modules/letter-kit/storage";
import { LetterValidationError, isValidSlug } from "@/modules/letter-kit/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "需要先登录，再上传。" }, { status: 401 });
  }

  const { slug } = await context.params;

  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "没有这封信。" }, { status: 404 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new LetterValidationError("没有收到文件");
    }

    const saved = await saveLetterMedia({
      slug,
      bytes: new Uint8Array(await file.arrayBuffer()),
      mime: file.type,
    });
    console.info(`letter media saved slug=${slug} url=${saved.url} editor=${user.name}`);
    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof LetterValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "文件没有收下。" }, { status: 500 });
  }
}
