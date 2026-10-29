"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { BgmPlaylist } from "../types";

export type BgmPlayerHandle = {
  start: () => void;
  stop: () => void;
};

function nextTrackIndex(current: number, count: number, mode: BgmPlaylist["mode"]): number {
  if (count <= 1) {
    return 0;
  }

  if (mode === "sequence") {
    return (current + 1) % count;
  }

  let next = current;
  while (next === current) {
    next = Math.floor(Math.random() * count);
  }
  return next;
}

export const BgmPlayer = forwardRef<
  BgmPlayerHandle,
  { playlist: BgmPlaylist; audible: boolean; ducked: boolean }
>(function BgmPlayer({ playlist, audible, ducked }, ref) {
  const tracks = playlist.tracks.filter((track) => track.src);
  const audioA = useRef<HTMLAudioElement>(null);
  const audioB = useRef<HTMLAudioElement>(null);
  const slot = useRef<0 | 1>(0);
  const index = useRef(0);
  const fading = useRef(false);
  const started = useRef(false);
  const audibleRef = useRef(audible);
  const duckedRef = useRef(ducked);
  const tracksRef = useRef(tracks);
  const modeRef = useRef(playlist.mode);
  const fadeMs = useRef(playlist.crossfadeMs);
  const [mode, setMode] = useState<BgmPlaylist["mode"]>(playlist.mode);
  const [title, setTitle] = useState(tracks[0]?.title ?? "");
  const [playing, setPlaying] = useState(false);

  audibleRef.current = audible;
  duckedRef.current = ducked;
  tracksRef.current = tracks;
  modeRef.current = mode;
  fadeMs.current = playlist.crossfadeMs;

  function level() {
    if (!audibleRef.current) {
      return 0;
    }
    return duckedRef.current ? 0.16 : 0.55;
  }

  function clampVolume(value: number) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.min(1, Math.max(0, value));
  }

  function element(which: 0 | 1) {
    return which === 0 ? audioA.current : audioB.current;
  }

  function ramp(audio: HTMLAudioElement, to: number) {
    const target = clampVolume(to);
    const duration = fadeMs.current;
    if (duration <= 0) {
      audio.volume = target;
      return;
    }
    const from = clampVolume(audio.volume);
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / duration));
      audio.volume = clampVolume(from + (target - from) * progress);
      if (progress < 1 && started.current) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }

  function playOn(which: 0 | 1, trackIndex: number, fadeIn: boolean) {
    const audio = element(which);
    const track = tracksRef.current[trackIndex];
    if (!audio || !track) {
      return;
    }

    const absolute = new URL(track.src, window.location.origin).href;
    if (audio.src !== absolute) {
      audio.src = track.src;
    }
    if (fadeIn) {
      audio.currentTime = 0;
    }
    audio.volume = clampVolume(fadeIn ? 0 : level());
    void audio.play().catch((error: unknown) => {
      console.info("背景声需要再点一次播放", error);
      setPlaying(false);
      started.current = false;
    });
    if (fadeIn) {
      ramp(audio, level());
    }
  }

  function start() {
    if (tracksRef.current.length === 0) {
      return;
    }
    started.current = true;
    setPlaying(true);
    const current = element(slot.current);
    if (current?.paused !== false) {
      playOn(slot.current, index.current, false);
    }
    setTitle(tracksRef.current[index.current]?.title ?? "");
  }

  function stop() {
    started.current = false;
    fading.current = false;
    setPlaying(false);
    audioA.current?.pause();
    audioB.current?.pause();
  }

  useImperativeHandle(ref, () => ({ start, stop }));

  useEffect(() => {
    const current = element(slot.current);
    if (!current || !started.current || fading.current) {
      return;
    }
    ramp(current, level());
    // `ramp` is recreated each render and only needs to run when the level inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audible, ducked]);

  function crossfade(which: 0 | 1) {
    if (which !== slot.current || fading.current || !started.current) {
      return;
    }
    const audio = element(which);
    if (!audio || !Number.isFinite(audio.duration) || audio.duration === 0) {
      return;
    }
    if (audio.duration - audio.currentTime > fadeMs.current / 1000) {
      return;
    }

    const upcoming = nextTrackIndex(index.current, tracksRef.current.length, modeRef.current);
    const other: 0 | 1 = which === 0 ? 1 : 0;
    fading.current = true;
    playOn(other, upcoming, true);
    ramp(audio, 0);
    window.setTimeout(() => {
      audio.pause();
      slot.current = other;
      index.current = upcoming;
      fading.current = false;
      setTitle(tracksRef.current[upcoming]?.title ?? "");
      const nextAudio = element(other);
      if (nextAudio) {
        nextAudio.volume = level();
      }
    }, fadeMs.current);
  }

  if (tracks.length === 0) {
    return null;
  }

  return (
    <div className="lk-bgm" data-testid="bgm-player">
      <audio ref={audioA} preload="auto" onTimeUpdate={() => crossfade(0)} onEnded={() => crossfade(0)} />
      <audio ref={audioB} preload="auto" onTimeUpdate={() => crossfade(1)} onEnded={() => crossfade(1)} />
      <button type="button" onClick={() => (playing && started.current ? stop() : start())}>
        {playing ? "暂停配乐" : "播放配乐"}
      </button>
      <span>{title}</span>
      <button
        type="button"
        onClick={() => setMode((value) => (value === "sequence" ? "shuffle" : "sequence"))}
      >
        {mode === "sequence" ? "顺序" : "随机"}
      </button>
    </div>
  );
});
