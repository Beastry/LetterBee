"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LetterView } from "../types";
import { BgmPlayer, type BgmPlayerHandle } from "./BgmPlayer";
import { LetterBlocks } from "./LetterBlocks";

const OPENER_W = 168;
const OPENER_H = 28;

type Phase = "sealed" | "cutting" | "unfolding" | "open";

export function LetterExperience({
  view,
  preview = false,
}: {
  view: LetterView;
  preview?: boolean;
}) {
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
    if (started.current) {
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
    event.currentTarget.setPointerCapture(event.pointerId);

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
      event.currentTarget.removeEventListener("pointermove", onMove);
      event.currentTarget.removeEventListener("pointerup", onUp);
    };

    event.currentTarget.addEventListener("pointermove", onMove);
    event.currentTarget.addEventListener("pointerup", onUp);
  }

  return (
    <div data-testid="letter-experience">
      <BgmPlayer
        ref={bgmRef}
        playlist={view.bgm}
        audible={phase === "open"}
        ducked={duckedIds.length > 0}
      />
      {phase === "open" ? (
        <div className="lk-reading" data-testid="letter-open">
          <LetterBlocks blocks={view.blocks} setDucked={setDucked} />
          <p className="lk-colophon">{view.title}</p>
          <div className="lk-actions">
            <button type="button" className="lk-button" onClick={replay}>
              再封一次
            </button>
            <Link href="/app/write">去改这封信</Link>
            <Link href="/">回到首页</Link>
          </div>
        </div>
      ) : (
        <div className="lk-stage-wrap">
          <div>
            <div className="lk-stage" data-phase={phase} data-testid="envelope-stage" ref={stageRef}>
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
                  <i className="left" />
                  <i className="right" />
                  <b>缄</b>
                </div>
              </div>
              <div
                className="lk-opener"
                data-testid="letter-opener"
                role="presentation"
                style={pos ? { left: pos.x, top: pos.y, bottom: "auto" } : undefined}
                onPointerDown={onOpenerDown}
              />
            </div>
            <p className="lk-help">把拆信刀拖到火漆上。刀只在这封信的舞台里移动。</p>
            <div className="lk-actions">
              <button type="button" className="lk-button primary" data-testid="open-seal" onClick={beginCut}>
                用拆信刀划开火漆
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
