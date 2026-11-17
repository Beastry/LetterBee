import { afterEach, expect, it, vi } from "vitest";
import { createMusicEngine } from "./music";
import { blankDocument } from "./model";
class FakeAudio {
  static all: FakeAudio[] = [];
  src = "";
  paused = true;
  muted = false;
  volume = 1;
  currentTime = 0;
  duration = 60;
  readyState = 4;
  preload = "none";
  listeners = new Map<string, EventListener>();
  constructor() {
    FakeAudio.all.push(this);
  }
  setAttribute() {}
  getAttribute(name: string) {
    return name === "src" ? this.src : null;
  }
  removeAttribute() {
    this.src = "";
  }
  addEventListener(name: string, cb: EventListener) {
    this.listeners.set(name, cb);
  }
  removeEventListener(name: string) {
    this.listeners.delete(name);
  }
  load() {}
  async play() {
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeAudio.all = [];
});
function setup() {
  vi.useFakeTimers();
  vi.stubGlobal("window", {});
  vi.stubGlobal("location", {
    href: "https://local.test/letterbee",
    origin: "https://local.test",
  });
  vi.stubGlobal("Audio", FakeAudio);
  const tracks = vi.fn();
  const e = createMusicEngine({ track: tracks });
  const music = blankDocument("甲").music;
  music.fi = 0;
  music.xf = 1;
  music.vol = 0.7;
  music.dk = 0.2;
  music.tracks = [
    {
      id: "a",
      title: "中性音轨A",
      src: "/api/mail-media/00000000-0000-4000-8000-000000000001",
      cs: 2,
      ce: 10,
      vol: 1,
    },
    {
      id: "b",
      title: "中性音轨B",
      src: "/api/mail-media/00000000-0000-4000-8000-000000000002",
      cs: 3,
      ce: 12,
      vol: 1,
    },
  ];
  e.load(music);
  return { e, music, tracks };
}
it("源音乐引擎：裁切、引用计数duck、顺序交叉淡化、后台暂停/恢复及释放", async () => {
  const { e, tracks } = setup();
  expect(FakeAudio.all).toHaveLength(2);
  await e.play({ unmute: true });
  await vi.advanceTimersByTimeAsync(300);
  const first = FakeAudio.all.find((a) => !a.paused)!;
  expect(first.currentTime).toBe(2);
  expect(e.isOn()).toBe(true);
  e.duck(true);
  e.duck(true);
  await vi.advanceTimersByTimeAsync(1100);
  expect(first.volume).toBeCloseTo(0.14, 2);
  e.duck(false);
  await vi.advanceTimersByTimeAsync(1100);
  expect(first.volume).toBeCloseTo(0.14, 2);
  e.duck(false);
  await vi.advanceTimersByTimeAsync(1100);
  expect(first.volume).toBeCloseTo(0.7, 2);
  first.currentTime = 9.5;
  await vi.advanceTimersByTimeAsync(1500);
  expect(tracks.mock.lastCall?.[0].title).toBe("中性音轨B");
  expect(FakeAudio.all.find((a) => !a.paused)?.currentTime).toBe(3);
  e.vis(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(e.isOn()).toBe(false);
  e.vis(false);
  await vi.advanceTimersByTimeAsync(1000);
  expect(e.isOn()).toBe(true);
  e.dispose();
  expect(FakeAudio.all.every((a) => a.paused && !a.src)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
it("源随机列表跨循环不紧接重复同一首", async () => {
  const { e, music, tracks } = setup();
  e.load({ ...music, order: "shuffle" });
  await e.play({ unmute: true });
  let previous = tracks.mock.lastCall?.[0].i;
  for (let i = 0; i < 8; i++) {
    e.next();
    await vi.advanceTimersByTimeAsync(1600);
    const now = tracks.mock.lastCall?.[0].i;
    expect(now).not.toBe(previous);
    previous = now;
  }
  e.dispose();
});
