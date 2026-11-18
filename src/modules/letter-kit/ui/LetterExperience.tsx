"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { LetterView } from "../types";
import { BgmPlayer, type BgmPlayerHandle } from "./BgmPlayer";
import { LetterBlocks } from "./LetterBlocks";
import { RichMusicPlayer } from "../rich/MusicPlayer";
import { appearance, type Appearance } from "../rich/appearance";
import { appPath } from "@/lib/app-path";
import type { Music } from "../rich/model";
import { LetterCeremony } from "../ceremony/Ceremony";
import "../ceremony/skin.css";

export function LetterExperience({
  view,
  preview = false,
  reading,
  music,
  style,
  lockedUntil,
}: {
  view: LetterView;
  preview?: boolean;
  reading?: (setDucked: (id: string, on: boolean) => void) => ReactNode;
  music?: Music;
  style?: Appearance;
  lockedUntil?: string;
}) {
  const [sealImage, setSealImage] = useState<string | null>(null);
  const [open, setOpen] = useState(preview);
  const [duckedIds, setDuckedIds] = useState<string[]>([]);
  const bgmRef = useRef<BgmPlayerHandle>(null);

  useEffect(() => {
    let active = true;
    if (style?.seal) {
      const s = { ...style.seal, image: style.seal.image ? appPath(style.seal.image) : "" };
      void appearance.makeSeal(s, view.slug).then((src) => {
        if (active) setSealImage(src);
      }).catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [style, view.slug]);

  function setDucked(id: string, on: boolean) {
    setDuckedIds((current) => (on ? (current.includes(id) ? current : [...current, id]) : current.filter((item) => item !== id)));
  }

  const vars = {
    ...(style ? appearance.styleVars(style) : {}),
    ...(sealImage ? { "--seal": `url("${sealImage}")` } : {}),
  } as CSSProperties;

  return (
    <div className="lb-skin" style={vars} data-testid="letter-experience">
      <canvas className="lb-fx" aria-hidden="true" />
      {music ? (
        <RichMusicPlayer ref={bgmRef} music={music} audible={open} ducked={duckedIds.length > 0} />
      ) : (
        <BgmPlayer ref={bgmRef} playlist={view.bgm} audible={open} ducked={duckedIds.length > 0} />
      )}
      {open ? (
        <div id="yearView" className="on" data-testid="letter-open">
          <article className="ypaper" id="ypaper">
            {reading ? reading(setDucked) : <LetterBlocks blocks={view.blocks} setDucked={setDucked} />}
            <div className="reading-actions">
              {!preview && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setDuckedIds([]);
                    bgmRef.current?.stop();
                  }}
                >
                  再封一次
                </button>
              )}
              <Link href="/app/write">再写一封信</Link>
              <Link href="/app">回到邮局</Link>
            </div>
          </article>
        </div>
      ) : (
        <LetterCeremony
          title={view.title}
          to={view.envelope.to}
          from={view.envelope.from}
          postmark={view.envelope.postmark}
          locked={lockedUntil}
          onMusic={() => bgmRef.current?.start()}
          onOpen={() => setOpen(true)}
        />
      )}
    </div>
  );
}
