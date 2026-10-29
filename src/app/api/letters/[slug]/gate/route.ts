import { NextResponse } from "next/server";
import {
  GATE_WINDOW_MS,
  clientIpFromHeaders,
  gateAttemptKey,
  getSessionSecret,
  letterGateAttempts,
  letterSessionCookieName,
  signLetterSession,
  verifyPassphrase,
} from "@/modules/letter-kit/gate";
import { readLetter } from "@/modules/letter-kit/storage";
import { isValidSlug, LetterValidationError } from "@/modules/letter-kit/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "没有这封信。" }, { status: 404 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const key = gateAttemptKey(ip, slug);

  if (letterGateAttempts.blocked(key)) {
    console.info(`letter gate blocked slug=${slug} ip=${ip}`);
    return NextResponse.json(
      { error: "试得太勤了，请稍后再来。", retryAfterMs: GATE_WINDOW_MS },
      { status: 429 },
    );
  }

  let passphrase = "";

  try {
    const body = (await request.json()) as { passphrase?: unknown };
    if (typeof body.passphrase !== "string") {
      return NextResponse.json({ error: "口令还对不上。" }, { status: 400 });
    }
    passphrase = body.passphrase;
  } catch {
    return NextResponse.json({ error: "口令还对不上。" }, { status: 400 });
  }

  try {
    const document = await readLetter(slug);

    if (!document || !verifyPassphrase(passphrase, document.gate.passphraseHash)) {
      letterGateAttempts.fail(key);
      console.info(`letter gate rejected slug=${slug} ip=${ip}`);
      return NextResponse.json({ error: "口令还对不上。" }, { status: 401 });
    }

    letterGateAttempts.succeed(key);
    const token = signLetterSession({
      slug,
      secret: getSessionSecret(),
      now: Date.now(),
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(letterSessionCookieName(slug), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 12 * 60 * 60,
      secure: process.env.NODE_ENV === "production",
    });
    console.info(`letter gate opened slug=${slug} ip=${ip}`);
    return response;
  } catch (error) {
    if (error instanceof LetterValidationError) {
      return NextResponse.json({ error: "这封信的底稿读不出来。" }, { status: 500 });
    }
    console.error(error);
    return NextResponse.json({ error: "这封信的底稿读不出来。" }, { status: 500 });
  }
}
