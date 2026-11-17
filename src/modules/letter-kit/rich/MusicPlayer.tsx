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
  return (
    <div className="rich-music" aria-label="背景音乐">
      <button
        type="button"
        onClick={() => {
          requested.current = true;
          engine.current?.unlock();
          if (status.playing) engine.current?.pause();
          else void engine.current?.play({ unmute: true });
        }}
      >
        {status.playing ? "暂停音乐" : "播放音乐"}
      </button>
      <span>{title}</span>
      <button type="button" onClick={() => engine.current?.next()}>
        下一首
      </button>
      <button
        type="button"
        onClick={() => engine.current?.setMuted(!status.muted)}
      >
        {status.muted ? "取消静音" : "静音"}
      </button>
      {status.blocked && (
        <span role="status">浏览器阻止自动播放，请点击播放</span>
      )}
    </div>
  );
});
