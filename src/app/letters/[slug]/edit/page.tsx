import { LetterEditorScreen } from "@/modules/letter-kit/editor-screen";
import { isValidSlug } from "@/modules/letter-kit/validate";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LetterEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!isValidSlug(slug)) {
    notFound();
  }

  return <LetterEditorScreen slug={slug} />;
}
