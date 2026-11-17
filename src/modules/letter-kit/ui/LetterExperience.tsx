"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import type { LetterView } from "../types";
import { BgmPlayer, type BgmPlayerHandle } from "./BgmPlayer";
import { LetterBlocks } from "./LetterBlocks";

import { RichMusicPlayer } from "../rich/MusicPlayer";
import { appearance, type Appearance } from "../rich/appearance";
import { appPath } from "@/lib/app-path";
import type { Music } from "../rich/model";

const OPENER_W = 168;
const OPENER_H = 28;

type Phase = "sealed" | "cutting" | "unfolding" | "open";

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
  useEffect(() => {
    let active = true;
    if (style?.seal) {
      const s = {
        ...style.seal,
        image: style.seal.image ? appPath(style.seal.image) : "",
      };
      void appearance
        .makeSeal(s, view.slug)
        .then((src) => {
          if (active) setSealImage(src);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [style, view.slug]);
  const sealStyle = sealImage
    ? {
        backgroundImage: `url("${sealImage}")`,
        backgroundSize: "100% 100%",
        backgroundColor: "transparent",
        boxShadow: "none",
        borderRadius: 0,
      }
    : undefined;
  const [phase, setPhase] = useState<Phase>(preview ? "open" : "sealed");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [duckedIds, setDuckedIds] = useState<string[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);
  const bgmRef = useRef<BgmPlayerHandle>(null);
  const started = useRef(preview);

  function setDucked(id: string, on: boolean) {
    setDuckedIds((current) => {
      if (on) {
        return current.includes(id) ? current : [...current, id];
      }
      return current.filter((item) => item !== id);
    });
  }

  function beginCut() {
    if (lockedUntil || started.current) {
      return;
    }

    started.current = true;
    bgmRef.current?.start();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("open");
      return;
    }

    setPhase("cutting");
  }

  useEffect(() => {
    if (phase !== "cutting" && phase !== "unfolding") {
      return;
    }

    const delay = phase === "cutting" ? 900 : 1500;
    const timer = window.setTimeout(() => {
      setPhase(phase === "cutting" ? "unfolding" : "open");
    }, delay);

    return () => window.clearTimeout(timer);
  }, [phase]);

  function replay() {
    started.current = false;
    setPos(null);
    setDuckedIds([]);
    setPhase("sealed");
    bgmRef.current?.stop();
  }

  function onOpenerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (phase !== "sealed") {
      return;
    }

    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) {
      return;
    }

    const opener = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - opener.left;
    const offsetY = event.clientY - opener.top;
    const target = event.currentTarget;
    const pointerId = event.pointerId;
    target.setPointerCapture(pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      const x = moveEvent.clientX - stage.left - offsetX;
      const y = moveEvent.clientY - stage.top - offsetY;
      setPos({ x, y });
      const seal = sealRef.current?.getBoundingClientRect();
      if (!seal) {
        return;
      }

      const overlaps =
        stage.left + x < seal.right &&
        stage.left + x + OPENER_W > seal.left &&
        stage.top + y < seal.bottom &&
        stage.top + y + OPENER_H > seal.top;

      if (overlaps) {
        beginCut();
      }
    };

    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      if (target.hasPointerCapture(pointerId))
        target.releasePointerCapture(pointerId);
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }

  return (
    <div
      className={style ? "rich-sealing" : undefined}
      style={style ? (appearance.styleVars(style) as CSSProperties) : undefined}
      data-testid="letter-experience"
    >
      {music ? (
        <RichMusicPlayer
          ref={bgmRef}
          music={music}
          audible={phase === "open"}
          ducked={duckedIds.length > 0}
        />
      ) : (
        <BgmPlayer
          ref={bgmRef}
          playlist={view.bgm}
          audible={phase === "open"}
          ducked={duckedIds.length > 0}
        />
      )}
      {phase === "open" ? (
        <div className="lk-reading" data-testid="letter-open">
          {reading ? (
            reading(setDucked)
          ) : (
            <LetterBlocks blocks={view.blocks} setDucked={setDucked} />
          )}
          <p className="lk-colophon">{view.title}</p>
          <div className="lk-actions">
            <button type="button" className="lk-button" onClick={replay}>
              再封一次
            </button>
            <Link href="/app/write">再写一封信</Link>
            <Link href="/">回到首页</Link>
          </div>
        </div>
      ) : (
        <div className="lk-stage-wrap">
          <div>
            <div
              className="lk-stage"
              data-phase={phase}
              data-testid="envelope-stage"
              ref={stageRef}
            >
              <div className="lk-envelope">
                <div className="lk-sheet" />
                <div className="lk-flap" />
                <div className="lk-pocket" />
                <div className="lk-address">
                  <p>
                    <small>致 </small>
                    {view.envelope.to}
                  </p>
                  <p>
                    <small>寄 </small>
                    {view.envelope.from}
                  </p>
                </div>
                <div className="lk-stamp">{view.envelope.postmark}</div>
                <div className="lk-seal" data-testid="wax-seal" ref={sealRef}>
                  <i className="left" style={sealStyle} />
                  <i className="right" style={sealStyle} />
                  {!sealImage && <b>缄</b>}
                </div>
              </div>
              <div
                className="lk-opener"
                data-testid="letter-opener"
                role="presentation"
                style={
                  pos ? { left: pos.x, top: pos.y, bottom: "auto" } : undefined
                }
                onPointerDown={onOpenerDown}
              />
            </div>
            <p className="lk-help">
              把拆信刀拖到火漆上。刀只在这封信的舞台里移动。
            </p>
            <div className="lk-actions">
              <button
                type="button"
                className="lk-button primary"
                disabled={!!lockedUntil}
                data-testid="open-seal"
                onClick={beginCut}
              >
                {lockedUntil
                  ? `定时信 · ${lockedUntil}（上海时区）展开`
                  : "用拆信刀划开火漆"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
