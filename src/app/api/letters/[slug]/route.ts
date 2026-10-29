import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { hashPassphrase } from "@/modules/letter-kit/gate";
import { readLetter, writeLetter } from "@/modules/letter-kit/storage";
import {
  LetterValidationError,
  assertPassphraseMatchesDial,
  isValidSlug,
  parseLetterDocument,
} from "@/modules/letter-kit/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "需要先登录，再改这封信。" }, { status: 401 });
  }

  const { slug } = await context.params;

  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "没有这封信。" }, { status: 404 });
  }

  try {
    const previous = await readLetter(slug);

    if (!previous) {
      return NextResponse.json({ error: "没有这封信。" }, { status: 404 });
    }

    const body = (await request.json()) as { document?: unknown; newPassphrase?: unknown };
    const parsed = parseLetterDocument(body.document, slug);
    const dialChanged =
      parsed.gate.dials !== previous.gate.dials || parsed.gate.charset !== previous.gate.charset;
    let passphraseHash = previous.gate.passphraseHash;

    if (typeof body.newPassphrase === "string" && body.newPassphrase.trim()) {
      const passphrase = assertPassphraseMatchesDial(
        body.newPassphrase,
        parsed.gate.dials,
        parsed.gate.charset,
      );
      passphraseHash = hashPassphrase(passphrase);
    } else if (dialChanged) {
      throw new LetterValidationError("改了口令盘之后要设置新口令");
    }

    await writeLetter({
      ...parsed,
      gate: { ...parsed.gate, passphraseHash },
    });
    console.info(`letter draft saved slug=${slug} editor=${user.name}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof LetterValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "信笺没有写成。" }, { status: 500 });
  }
}
