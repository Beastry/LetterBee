"use client";

import { useEffect, useRef, useState } from "react";

const knifeSrc = new URL("./assets/knife.svg", import.meta.url).href;

type Phase = "desk" | "sealed" | "opening" | "done";

function tone(name: "tick" | "seal" | "paper" | "open") {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const spec = {
      tick: [680, 0.05, 0.03],
      seal: [180, 0.16, 0.05],
      paper: [420, 0.05, 0.02],
      open: [220, 0.28, 0.03],
    }[name];
    o.frequency.value = spec[0];
    o.type = name === "seal" ? "triangle" : "sine";
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(spec[2], ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + spec[1]);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + spec[1] + 0.02);
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    /* autoplay or missing audio is non-fatal */
  }
}

export function LetterCeremony({
  title,
  to,
  from,
  postmark,
  locked,
  onOpen,
  onMusic,
}: {
  title: string;
  to: string;
  from: string;
  postmark: string;
  locked?: string;
  onOpen: () => void;
  onMusic: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("desk");
  const [magnify, setMagnify] = useState(false);
  const [envClass, setEnvClass] = useState("");
  const [wrapClass, setWrapClass] = useState("");
  const envRef = useRef<HTMLDivElement>(null);
  const knifeRef = useRef<HTMLButtonElement>(null);
  const sealRef = useRef<HTMLButtonElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const fast = useRef(false);
  const opening = useRef(false);

  useEffect(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".lb-fx");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const dust = Array.from({ length: reduce ? 0 : 36 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.1 + 0.3,
      v: Math.random() * 0.00035 + 0.00008,
      a: Math.random() * 6.28,
    }));
    const draw = () => {
      const w = (canvas.width = window.innerWidth * Math.min(devicePixelRatio || 1, 2));
      const h = (canvas.height = window.innerHeight * Math.min(devicePixelRatio || 1, 2));
      ctx.clearRect(0, 0, w, h);
      dust.forEach((p) => {
        p.y -= p.v;
        p.a += 0.01;
        if (p.y < 0) p.y = 1;
        ctx.globalAlpha = 0.08 + 0.1 * Math.sin(p.a);
        ctx.fillStyle = "#e2c896";
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r, 0, 6.28);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    if (!reduce) frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  function sleep(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
  async function wait(ms: number) {
    let elapsed = 0;
    while (elapsed < ms) {
      await sleep(40);
      elapsed += fast.current ? 160 : 40;
    }
  }

  async function startCeremony() {
    if (locked || opening.current) return;
    opening.current = true;
    setMagnify(false);
    setPhase("opening");
    onMusic();
    tone("tick");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const env = envRef.current;
    const knife = knifeRef.current;
    if (reduce || !env || !knife) {
      setEnvClass("broken open1 flipped open2 rise");
      await sleep(280);
      setPhase("done");
      onOpen();
      return;
    }
    setWrapClass("cutting");
    const er = env.getBoundingClientRect();
    env.style.setProperty("--fall", `${(er.height * 0.55 + 40) | 0}px`);
    const kr = knife.getBoundingClientRect();
    const sr = sealRef.current?.getBoundingClientRect();
    if (sr) {
      const tip = { x: kr.left + kr.width * 0.98, y: kr.top + kr.height * 0.5 };
      const vtip = { x: er.left + er.width * 0.5, y: er.top + er.height * 0.58 };
      const ang = (Math.atan2(vtip.y - er.top, vtip.x - er.left) * 180) / Math.PI;
      const sc = { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2 };
      const T = (x: number, y: number, a: number) =>
        `translate(${(x - tip.x).toFixed(1)}px, ${(y - tip.y).toFixed(1)}px) rotate(${a.toFixed(1)}deg)`;
      knife.animate(
        [
          { transform: "translate(0,0) rotate(-5deg)" },
          { transform: T(er.left + (vtip.x - er.left) * 0.16, er.top + (vtip.y - er.top) * 0.16 - 10, ang), offset: 0.34 },
          { transform: T(sc.x - sr.width * 0.1, sc.y, ang), offset: 0.8 },
          { transform: T(sc.x + sr.width * 0.28, sc.y - sr.height * 0.1, ang + 7), offset: 0.87 },
          { transform: "translate(0,0) rotate(-5deg)" },
        ],
        { duration: fast.current ? 900 : 2600 },
      );
    }
    await wait(fast.current ? 700 : 2200);
    setEnvClass("broken");
    tone("seal");
    await wait(700);
    tone("open");
    tone("paper");
    setEnvClass("broken open1");
    await wait(1150);
    setEnvClass("broken open1 flipped open2");
    await wait(1250);
    setEnvClass("broken open1 flipped open2 rise");
    await wait(1600);
    setWrapClass("cutting handoff");
    await wait(900);
    setPhase("done");
    onOpen();
  }

  function onKnifePointer(event: React.PointerEvent<HTMLButtonElement>) {
    if (locked || opening.current) return;
    const knife = event.currentTarget;
    const origin = { x: event.clientX, y: event.clientY };
    knife.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => {
      const seal = sealRef.current?.getBoundingClientRect();
      const env = envRef.current;
      if (!seal || !env) return;
      const near =
        e.clientX > seal.left - 16 &&
        e.clientX < seal.right + 16 &&
        e.clientY > seal.top - 16 &&
        e.clientY < seal.bottom + 16;
      if (!near) return;
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      const len = Math.hypot(dx, dy);
      if (len < 8) return;
      let line = env.querySelector<HTMLElement>(".wax-scratch");
      if (!line) {
        line = document.createElement("div");
        line.className = "wax-scratch";
        env.appendChild(line);
      }
      const er = env.getBoundingClientRect();
      line.style.left = `${origin.x - er.left}px`;
      line.style.top = `${origin.y - er.top}px`;
      line.style.width = `${len}px`;
      line.style.transform = `rotate(${((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(1)}deg)`;
      line.classList.add("on");
    };
    const up = () => {
      knife.removeEventListener("pointermove", move);
      knife.removeEventListener("pointerup", up);
      void startCeremony();
    };
    knife.addEventListener("pointermove", move);
    knife.addEventListener("pointerup", up);
  }

  if (phase === "done") return null;

  return (
    <>
      <div className={`stage ${phase === "desk" ? "show" : ""}`} aria-label="信笺">
        <div className="stage-paper">
          <p className="stage-kicker">LETTERS</p>
          <h1 className="stage-title">{title || "给你的信"}</h1>
          <p className="stage-hint">桌上有一封信 · 慢慢拆开</p>
          <div className="year-row">
            <button
              type="button"
              className="year-env"
              style={{ ["--seal" as string]: undefined }}
              disabled={!!locked}
              onClick={() => {
                tone("tick");
                setPhase("sealed");
              }}
            >
              <span className="ye-body">
                <span className="ye-flap" />
                <span className="ye-seal" aria-hidden="true" />
                {to ? (
                  <span className="ye-to">
                    <i>致</i>
                    {to}
                  </span>
                ) : null}
              </span>
              <span className="ye-meta">
                <span className="ye-label">{title || "一封信"}</span>
                <span className="ye-sub">
                  {from ? `寄 ${from}` : ""}
                  {postmark ? ` · ${postmark}` : ""}
                </span>
              </span>
            </button>
          </div>
          {locked ? <p className="stage-hint">这封信 {locked}（上海时区）才展开</p> : null}
        </div>
      </div>
      <div
        className={`envelope ${phase === "desk" ? "gone" : ""} ${wrapClass}`}
        aria-hidden={phase === "desk"}
        onClick={(event) => {
          if (phase !== "opening") return;
          if ((event.target as HTMLElement).closest("button")) return;
          fast.current = true;
          setWrapClass((c) => (c.includes("accelerated") ? c : `${c} accelerated`));
        }}
      >
        <p className="env-kicker" aria-hidden="true">
          for you
        </p>
        <div className="ceremony">
          <div className="scene" ref={sceneRef}>
            <div
              className={`env ${envClass}`}
              ref={envRef}
              data-testid="envelope-stage"
              aria-label={to ? `信封 · 致 ${to}` : "信封"}
            >
              <div className="back" />
              <div className="sheet">
                <span>{title}</span>
              </div>
              <div className="front">
                {to ? <span className="env-to">致 {to}</span> : null}
              </div>
              <div className="flap">
                <i />
                <span className="shard s1" aria-hidden="true" />
              </div>
              <span className="shard s2" aria-hidden="true" />
              <span className="shard s3" aria-hidden="true" />
              <button
                type="button"
                className="seal"
                ref={sealRef}
                data-testid="wax-seal"
                aria-label="细看火漆印记"
                onClick={() => setMagnify(true)}
              />
            </div>
            <button
              type="button"
              className="knife"
              ref={knifeRef}
              data-testid="letter-opener"
              aria-label="用拆信刀开启信封"
              disabled={!!locked}
              style={{ backgroundImage: `url("${knifeSrc}")` }}
              onPointerDown={onKnifePointer}
              onClick={(event) => {
                event.stopPropagation();
                void startCeremony();
              }}
            />
          </div>
          <p className="env-tip">
            慢一点 · 像拆开一封等了很久的信
            <br />
            <button type="button" data-testid="open-seal" disabled={!!locked} onClick={() => void startCeremony()}>
              {locked ? `定时信 · ${locked} 展开` : "用拆信刀划开火漆"}
            </button>
          </p>
        </div>
      </div>
      <div className="seal-lb" hidden={!magnify} role="dialog" aria-modal="true" aria-label="火漆细看">
        <button type="button" className="slb-x" aria-label="关闭" onClick={() => setMagnify(false)}>
          ✕
        </button>
        <div className="slb-card">
          <div className="slb-seal" role="img" aria-label="火漆印" />
          <p className="slb-title">火漆印记</p>
          <p className="slb-sub">双环相扣。轻触拆信刀，或在这里直接开启。</p>
          <div className="slb-actions">
            <button type="button" onClick={() => setMagnify(false)}>
              收起
            </button>
            <button type="button" className="primary" onClick={() => void startCeremony()}>
              用拆信刀开启
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
