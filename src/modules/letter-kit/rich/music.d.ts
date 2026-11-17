import type { Music } from "./model";
export type MusicEngine = {
  load(m: Music): boolean;
  update(m: Music): void;
  play(o?: { unmute?: boolean; at?: number; fade?: number }): Promise<boolean>;
  pause(): void;
  halt(): void;
  dispose(): void;
  unlock(): void;
  duck(on: boolean): void;
  section(s: string): void;
  vis(hidden: boolean): void;
  next(): void;
  jump(i: number): void;
  seam(): void;
  isOn(): boolean;
  setMuted(v: boolean): void;
  isMuted(): boolean;
};
export function createMusicEngine(hooks?: {
  state?: (s: { playing: boolean; muted: boolean; blocked: boolean }) => void;
  track?: (s: { i: number; n: number; title: string }) => void;
}): MusicEngine;
