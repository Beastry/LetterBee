import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { letterSessionCookieName, letterSessionIsOpen } from "@/modules/letter-kit/gate";
import { readLetter } from "@/modules/letter-kit/storage";
import { formatISODate } from "@/modules/letter-kit/today";
import { toLetterView } from "@/modules/letter-kit/unlock";
import type { LetterDocument } from "@/modules/letter-kit/types";
import { LetterValidationError, isValidSlug } from "@/modules/letter-kit/validate";
import { LetterExperience } from "@/modules/letter-kit/ui/LetterExperience";
import { PassphraseDial } from "@/modules/letter-kit/ui/PassphraseDial";

export const dynamic = "force-dynamic";

export default async function LetterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!isValidSlug(slug)) {
    notFound();
  }

  let document: LetterDocument | null = null;
  let unreadable = false;

  try {
    document = await readLetter(slug);
  } catch (error) {
    if (error instanceof LetterValidationError) {
      console.error(error);
      unreadable = true;
    } else {
      throw error;
    }
  }

  if (unreadable) {
    return (
      <main className="lk-root">
        <div className="lk-shell">
          <p>这封信的底稿读不出来。</p>
        </div>
      </main>
    );
  }

  if (!document) {
    notFound();
  }

  const token = (await cookies()).get(letterSessionCookieName(slug))?.value;

  if (!letterSessionIsOpen(token, slug)) {
    return (
      <main className="lk-root">
        <PassphraseDial
          slug={document.slug}
          title={document.title}
          hint={document.gate.hint}
          dials={document.gate.dials}
          charset={document.gate.charset}
        />
      </main>
    );
  }

  const today = formatISODate(new Date(), document.timezone);
  const view = toLetterView(document, today);

  return (
    <main className="lk-root">
      <LetterExperience view={view} />
    </main>
  );
}
