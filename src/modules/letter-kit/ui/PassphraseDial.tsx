"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function PassphraseDial({
  slug,
  title,
  hint,
  dials,
  charset,
}: {
  slug: string;
  title: string;
  hint: string;
  dials: number;
  charset: string;
}) {
  const router = useRouter();
  const characters = [...charset];
  const [code, setCode] = useState(() => (characters[0] ?? "0").repeat(dials));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function setDigit(index: number, direction: number) {
    setCode((current) => {
      const next = Array.from({ length: dials }, (_, digitIndex) => current[digitIndex] ?? characters[0] ?? "0");
      const at = Math.max(0, characters.indexOf(next[index] ?? ""));
      next[index] = characters[(at + direction + characters.length) % characters.length] ?? next[index]!;
      return next.join("");
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const passphrase = code.padEnd(dials, characters[0] ?? "0").slice(0, dials);
      const response = await fetch(`/api/letters/${slug}/gate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error || "口令还对不上。");
        return;
      }

      router.refresh();
    } catch (submitError) {
      console.error(submitError);
      setError("刚才没有送出去，可以再试一次。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="lk-gate" onSubmit={onSubmit}>
      <p className="lk-kicker">纸短情长</p>
      <h1>{title}</h1>
      <p>{hint}</p>
      <div className="lk-dials" role="group" aria-label="口令盘">
        {Array.from({ length: dials }, (_, index) => {
          const digit = code[index] ?? "";
          return (
            <div className="lk-dial" key={index}>
              <button type="button" aria-label={`第 ${index + 1} 位往前`} onClick={() => setDigit(index, -1)}>
                上
              </button>
              <div
                className="lk-dial-window"
                role="spinbutton"
                aria-valuetext={digit}
                aria-label={`第 ${index + 1} 位`}
                onPointerDown={(event) => {
                  const startY = event.clientY;
                  let lastStep = 0;
                  const target = event.currentTarget;
                  target.setPointerCapture(event.pointerId);
                  const onMove = (moveEvent: PointerEvent) => {
                    const step = Math.trunc((startY - moveEvent.clientY) / 18);
                    if (step !== lastStep) {
                      setDigit(index, step > lastStep ? 1 : -1);
                      lastStep = step;
                    }
                  };
                  const onUp = () => {
                    target.removeEventListener("pointermove", onMove);
                    target.removeEventListener("pointerup", onUp);
                  };
                  target.addEventListener("pointermove", onMove);
                  target.addEventListener("pointerup", onUp);
                }}
              >
                {digit}
              </div>
              <button type="button" aria-label={`第 ${index + 1} 位往后`} onClick={() => setDigit(index, 1)}>
                下
              </button>
            </div>
          );
        })}
      </div>
      <label>
        口令
        <input
          className="lk-passphrase-input"
          data-testid="passphrase-input"
          value={code}
          inputMode={/^\d+$/.test(charset) ? "numeric" : "text"}
          autoComplete="off"
          onChange={(event) => {
            // Keep the typed digits only. Padding here turns the first key of
            // "7041" into "7000" and drops the rest of a fast entry.
            const next = [...event.target.value.normalize("NFKC")]
              .filter((character) => characters.includes(character))
              .slice(0, dials)
              .join("");
            setCode(next);
          }}
        />
      </label>
      {error ? (
        <p className="lk-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="lk-actions">
        <button className="lk-button primary" type="submit" disabled={pending}>
          {pending ? "正在核对" : "核对口令"}
        </button>
        <Link href="/">回到首页</Link>
      </div>
    </form>
  );
}
