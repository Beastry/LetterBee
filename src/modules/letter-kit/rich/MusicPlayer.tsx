"use client";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { appPath } from "@/lib/app-path";
import { createMusicEngine, type MusicEngine } from "./music";
import type { Music } from "./model";
import type { BgmPlayerHandle } from "../ui/BgmPlayer";
export const RichMusicPlayer = forwardRef<
  BgmPlayerHandle,
  { music: Music; audible: boolean; ducked: boolean }
>(function RichMusicPlayer({ music, audible, ducked }, ref) {
  const engine = useRef<MusicEngine | null>(null),
    requested = useRef(false);
  const [status, setStatus] = useState({
      playing: false,
      muted: false,
      blocked: false,
    }),
    [title, setTitle] = useState("");
  useEffect(() => {
    const e = createMusicEngine({
      state: setStatus,
      track: (t) => setTitle(t.title),
    });
    engine.current = e;
    return () => {
      e.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    engine.current?.load({
      ...music,
      tracks: music.tracks.map((t) => ({ ...t, src: appPath(t.src) })),
    });
  }, [music]);
  useEffect(() => {
    const e = engine.current;
    if (audible && requested.current) void e?.play({ unmute: true });
    if (!audible) e?.halt();
  }, [audible]);
  useEffect(() => {
    if (!ducked) return;
    const e = engine.current;
    e?.duck(true);
    return () => e?.duck(false);
  }, [ducked]);
  useEffect(() => {
    const vis = () => engine.current?.vis(document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, []);
  useImperativeHandle(
    ref,
    () => ({
      start() {
        requested.current = true;
        engine.current?.unlock();
        if (audible) void engine.current?.play({ unmute: true });
      },
      stop() {
        requested.current = false;
        engine.current?.halt();
      },
    }),
    [audible],
  );
  if (!music.tracks.length) return null;
  const shown = audible || status.playing;
  return (
    <div className={`music glass ${shown ? "" : "hide"} ${status.playing ? "playing" : ""}`} aria-label="背景音乐">
      <button
        type="button"
        className="disc"
        aria-label={status.playing ? "暂停背景音乐" : "播放背景音乐"}
        onClick={() => {
          requested.current = true;
          engine.current?.unlock();
          if (status.playing) engine.current?.pause();
          else void engine.current?.play({ unmute: true });
        }}
      >
        <span>{status.playing ? "❚❚" : "▶"}</span>
      </button>
      <div className="mi">
        <div className="mt">{title || "背景音乐"}</div>
        <div className="ms">{status.blocked ? "轻触播放" : status.playing ? "正在播放" : "轻触播放"}</div>
      </div>
      <button type="button" className="mnext" onClick={() => engine.current?.next()}>
        下一首
      </button>
      <button
        type="button"
        className="mute"
        aria-label={status.muted ? "取消静音" : "静音"}
        onClick={() => engine.current?.setMuted(!status.muted)}
      >
        {status.muted ? "🔇" : "🔊"}
      </button>
    </div>
  );
});
