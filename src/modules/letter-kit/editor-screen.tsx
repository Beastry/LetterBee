import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { readLetter } from "@/modules/letter-kit/storage";
import { formatISODate } from "@/modules/letter-kit/today";
import type { LetterDocument } from "@/modules/letter-kit/types";
import { LetterValidationError } from "@/modules/letter-kit/validate";
import { LetterEditor } from "@/modules/letter-kit/ui/LetterEditor";
import "@/modules/letter-kit/ui/letter-kit.css";

export async function LetterEditorScreen({ slug }: { slug: string }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  let document: LetterDocument | null = null;
  let invalidMessage = "";

  try {
    document = await readLetter(slug);
  } catch (error) {
    if (error instanceof LetterValidationError) {
      invalidMessage = error.message;
    } else {
      throw error;
    }
  }

  if (invalidMessage) {
    return (
      <main className="lk-root">
        <div className="lk-shell">
          <p>{invalidMessage}</p>
        </div>
      </main>
    );
  }

  if (!document) {
    notFound();
  }

  const today = formatISODate(new Date(), document.timezone);

  return (
    <main className="lk-root">
      <div className="lk-shell">
        <div className="lk-topbar">
          <Link href="/app">← 回到工作台</Link>
          <span>{user.name} 的写信台</span>
        </div>
        <LetterEditor initial={document} today={today} />
      </div>
    </main>
  );
}
