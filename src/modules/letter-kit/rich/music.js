// Adapted from source 7771c20 musicEngine.js; no media/default personal content.
/**
 * Background-music engine for uploaded audio (visitor page + editor preview; imported as a client module).
 *  - fade in/out on a master GainNode (Web Audio, so it also works on iOS where media.volume is read-only);
 *  - a playlist (music.tracks; legacy single src = one track) in order or shuffled, each song's clip [cs, ce),
 *    joined by an equal-power crossfade between two media elements; only the next song is buffered;
 *  - a mix gain follows the page: base volume x section level x ducking (voice message / video).
 * Cross-origin sources (or no Web Audio) fall back to tweening element.volume (ignored by iOS, still plays).
 * NetEase's official player is a cross-origin iframe and cannot be controlled at all; it is not handled here.
 */
export const MUSIC_DEFAULTS = {
  fi: 2.5,
  fo: 1.5,
  xf: 2,
  vol: 0.85,
  dk: 0.2,
  lv: { photos: 0.55 },
};

function musicClientLib(DEF) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
  const sameOrigin = (s) => {
    try {
      return new URL(s, location.href).origin === location.origin;
    } catch {
      return false;
    }
  };
  let ctx = null;
  const getCtx = () => {
    if (!ctx && AC) {
      try {
        ctx = new AC();
      } catch {
        ctx = null;
      }
    }
    return ctx;
  };
  const shape = (a, b, k, eq) =>
    eq
      ? b > a
        ? a + (b - a) * Math.sin((k * Math.PI) / 2)
        : b + (a - b) * Math.cos((k * Math.PI) / 2)
      : a + (b - a) * k;

  const MAXT = 20;
  /** Playlist of an entry: music.tracks (uploaded files) or, for older content, the single legacy src. */
  const tracksOf = (m) => {
    m = m || {};
    const t = Array.isArray(m.tracks)
      ? m.tracks.filter((x) => x && typeof x.src === "string" && x.src)
      : [];
    if (Array.isArray(m.tracks)) return t.slice(0, MAXT);
    return m.src
      ? [{ src: String(m.src), title: m.title, cs: m.cs, ce: m.ce }]
      : [];
  };
  const shuffled = (n, avoid) => {
    const a = [];
    for (let i = 0; i < n; i++) a.push(i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    if (n > 1 && a[0] === avoid) {
      const k = 1 + Math.floor(Math.random() * (n - 1));
      const t = a[0];
      a[0] = a[k];
      a[k] = t;
    }
    return a;
  };

  function create(hooks) {
    hooks = hooks || {};
    const routed = [];
    let pair = null,
      wa = false,
      master = null,
      mix = null;
    let C = {},
      list = [],
      key = "",
      order = [],
      pos = 0,
      pending = null,
      trk = [-1, -1];
    let cur = 0,
      want = false,
      muted = false,
      blocked = false,
      duckN = 0,
      sec = "",
      secLv = 1,
      xfBusy = false,
      tick = 0,
      pT = 0,
      xT = 0,
      pfT = 0,
      hid = false;
    const trackAt = (ei) => list[trk[ei == null ? cur : ei]] || null;
    const csOf = (ei) => {
      const t = trackAt(ei);
      return num(t && t.cs, 0);
    };
    const tvOf = (ei) => {
      const t = trackAt(ei);
      return Math.max(0, Math.min(1, num(t && t.vol, 1)));
    };
    const conf = () => {
      const t = trackAt() || {};
      return {
        fi: num(C.fi, DEF.fi),
        fo: num(C.fo, DEF.fo),
        xf: num(C.xf, DEF.xf),
        vol: num(C.vol, DEF.vol),
        dk: num(C.dk, DEF.dk),
        cs: num(t.cs, 0),
        ce: num(t.ce, 0),
        tv: num(t.vol, 1),
      };
    };
    const lvFor = (s) =>
      C.lv && typeof C.lv[s] === "number"
        ? C.lv[s]
        : typeof DEF.lv[s] === "number"
          ? DEF.lv[s]
          : 1;
    /* params: Web Audio AudioParam ramps, or JS tweens applied to element.volume */
    const tweens = new Set();
    let tLoop = 0;
    const applyEl = () => {
      if (wa || !pair) return;
      pair.forEach((q, i) => {
        q.el.volume = Math.max(0, Math.min(1, W[i].v * fadeP.v * mixP.v));
      });
    };
    const stepTw = () => {
      const n = performance.now();
      tweens.forEach((p) => {
        const k = Math.min(1, (n - p.t0) / p.d);
        p.v = shape(p.a, p.b, k, p.eq);
        if (k >= 1) tweens.delete(p);
      });
      applyEl();
      if (!tweens.size) {
        clearInterval(tLoop);
        tLoop = 0;
      }
    };
    const mkParam = (get, init) => {
      const p = { v: init, a: init, b: init, t0: 0, d: 0, eq: false };
      p.set = (to, dur, eq) => {
        to = Math.max(0, Math.min(1, to));
        dur = Math.max(0, dur || 0);
        const ap = wa ? get() : null;
        if (ap) {
          const n = ctx.currentTime,
            from = ap.value;
          ap.cancelScheduledValues(n);
          ap.setValueAtTime(from, n);
          if (dur > 0.02 && eq) {
            const c = new Float32Array(32);
            for (let i = 0; i < 32; i++) c[i] = shape(from, to, i / 31, true);
            try {
              ap.setValueCurveAtTime(c, n, dur);
            } catch {
              ap.linearRampToValueAtTime(to, n + dur);
            }
          } else if (dur > 0.02) ap.linearRampToValueAtTime(to, n + dur);
          else ap.setValueAtTime(to, n);
          p.v = to;
          return;
        }
        tweens.delete(p);
        p.a = p.v;
        p.b = to;
        p.eq = !!eq;
        p.t0 = performance.now();
        p.d = dur * 1000;
        if (p.d < 20) {
          p.v = to;
          applyEl();
          return;
        }
        tweens.add(p);
        if (!tLoop) tLoop = setInterval(stepTw, 40);
      };
      p.now = () => {
        const ap = wa ? get() : null;
        return ap ? ap.value : p.v;
      };
      return p;
    };
    const fadeP = mkParam(() => master && master.gain, 0);
    const mixP = mkParam(() => mix && mix.gain, 1);
    const W = [
      mkParam(() => pair && pair[0].g && pair[0].g.gain, 1),
      mkParam(() => pair && pair[1].g && pair[1].g.gain, 0),
    ];

    const mkEl = () => {
      const a = new Audio();
      a.preload = "auto";
      a.setAttribute("playsinline", "");
      a.addEventListener("ended", onEnded);
      return a;
    };
    const ensurePair = (useWa) => {
      const c = useWa ? getCtx() : null;
      if (c) {
        if (!master) {
          master = c.createGain();
          mix = c.createGain();
          master.gain.value = 0;
          master.connect(mix);
          mix.connect(c.destination);
        }
        if (!routed.length)
          for (let i = 0; i < 2; i++) {
            const el = mkEl(),
              g = c.createGain();
            g.gain.value = i ? 0 : 1;
            c.createMediaElementSource(el).connect(g);
            g.connect(master);
            routed.push({ el, g });
          }
        wa = true;
        return routed;
      }
      wa = false;
      return [
        { el: mkEl(), g: null },
        { el: mkEl(), g: null },
      ];
    };
    const emit = () => {
      if (hooks.state)
        hooks.state({ playing: want && !blocked, muted, blocked });
    };
    const info = () => {
      const t = trackAt() || {};
      return {
        i: trk[cur],
        n: list.length,
        pos,
        title: String(t.title || ""),
        order: C.order === "shuffle" ? "shuffle" : "seq",
      };
    };
    const emitTrack = () => {
      if (hooks.track) hooks.track(info());
    };
    const seek = (a, t) => {
      try {
        a.currentTime = t;
      } catch {}
    };
    /* a freshly assigned src has no metadata yet: seek now (default start position) and again once it is known */
    const seekReady = (a, t) => {
      seek(a, t);
      if (a.readyState < 1)
        a.addEventListener(
          "loadedmetadata",
          () => {
            if (Math.abs(a.currentTime - t) > 0.3) seek(a, t);
          },
          { once: true },
        );
    };
    const level = () => {
      const c = conf();
      return c.vol * secLv * (duckN > 0 ? c.dk : 1);
    };
    const applyMix = (d) => mixP.set(level(), d);
    /* play order: sequential, or shuffled per cycle without repeating the song that just played */
    const mkOrder = (avoid) => {
      const n = list.length,
        a = [];
      if (C.order === "shuffle" && n > 1) return shuffled(n, avoid);
      for (let i = 0; i < n; i++) a.push(i);
      return a;
    };
    const peek = () => {
      if (pos + 1 < order.length) return order[pos + 1];
      if (!pending) pending = mkOrder(order[pos]);
      return pending[0];
    };
    const advance = () => {
      if (pos + 1 < order.length) pos++;
      else {
        order = pending || mkOrder(order[pos]);
        pending = null;
        pos = 0;
      }
      return order[pos];
    };
    const posTo = (ti) => {
      const k = order.indexOf(ti);
      if (k >= 0) pos = k;
      pending = null;
    };
    /** load track ti into element ei (only that one file is fetched) */
    const setEl = (ei, ti, pre) => {
      if (!pair || !list[ti]) return;
      const q = pair[ei];
      if (pre) q.el.preload = pre;
      if (trk[ei] === ti) return;
      trk[ei] = ti;
      q.el.src = list[ti].src;
    };
    /* lazy: once a song is playing, buffer only the one that comes next */
    function prefetch() {
      if (!pair || list.length < 2 || xfBusy) return;
      setEl(1 - cur, peek(), "auto");
    }
    function onEnded(e) {
      if (!pair || e.target !== pair[cur].el || !want) return;
      if (list.length > 1) {
        go(0);
        return;
      }
      seek(e.target, conf().cs);
      e.target.play().catch(() => {});
    }
    const clipEnd = (a, ei) => {
      const t = trackAt(ei) || {},
        ce = num(t.ce, 0),
        d = a.duration;
      const e = ce > 0 ? (isFinite(d) && d > 0 ? Math.min(ce, d) : ce) : d;
      return isFinite(e) && e > 0 ? e : 0;
    };
    function onTick() {
      if (!pair) return;
      const c = conf(),
        a = pair[cur].el,
        end = clipEnd(a, cur);
      if (!end) return;
      if (hooks.time)
        hooks.time(
          Math.max(
            0,
            Math.min(1, (a.currentTime - c.cs) / Math.max(0.1, end - c.cs)),
          ),
          a.currentTime,
        );
      if (xfBusy || a.paused) return;
      if (a.currentTime < c.cs - 0.5) {
        seek(a, c.cs);
        return;
      }
      const xf = Math.min(c.xf, Math.max(0, (end - c.cs) / 3)),
        left = end - a.currentTime;
      if (xf > 0.05 && left <= xf + 0.03) go(xf);
      else if (xf <= 0.05 && left <= 0.09) {
        if (list.length > 1) go(0);
        else seek(a, c.cs);
      }
    }
    /**
     * Move to the next song in the order (or to song ti) with an equal-power crossfade of xf seconds between the two elements.
     * A one-song list crossfades back into its own clip start (the old loop seam).
     */
    function go(xf, ti) {
      if (!pair) return;
      if (ti == null) ti = advance();
      else posTo(ti);
      const o = cur,
        n = 1 - cur,
        b = pair[n].el;
      clearTimeout(xT);
      if (xfBusy) {
        W[n].set(0, 0);
        b.pause();
      }
      setEl(n, ti, "auto");
      const d = Math.max(0.05, xf || 0);
      seekReady(b, csOf(n));
      W[n].set(0, 0);
      b.play().catch(() => {});
      W[n].set(tvOf(n), d, true);
      W[o].set(0, d, true);
      cur = n;
      xfBusy = true;
      if (hooks.loop) hooks.loop();
      emitTrack();
      xT = setTimeout(
        () => {
          if (pair) pair[o].el.pause();
          xfBusy = false;
          prefetch();
        },
        d * 1000 + 80,
      );
    }
    const startTick = () => {
      if (!tick) tick = setInterval(onTick, 100);
    };
    const stopTick = () => {
      clearInterval(tick);
      tick = 0;
    };

    function load(m) {
      m = m || {};
      const L = tracksOf(m),
        k =
          L.map((t) => t.src).join("\n") +
          "|" +
          (m.order === "shuffle" ? "s" : "q");
      C = m;
      if (L.length && pair && k === key) {
        list = L;
        if (!xfBusy) W[cur].set(tvOf(cur), 0.2);
        applyMix(0.2);
        emitTrack();
        return true;
      }
      halt();
      key = k;
      list = L;
      trk = [-1, -1];
      pending = null;
      pos = 0;
      cur = 0;
      if (!L.length) {
        pair = null;
        order = [];
        emitTrack();
        return false;
      }
      pair = ensurePair(L.every((t) => sameOrigin(t.src)));
      order = mkOrder(-1);
      setEl(0, order[0], "auto");
      // the standby element holds the next song without buffering it (iOS can unlock it in the opening gesture)
      setEl(1, peek(), L.length > 1 ? "none" : "metadata");
      W[0].set(tvOf(0), 0);
      W[1].set(0, 0);
      fadeP.set(0, 0);
      applyMix(0);
      emitTrack();
      return true;
    }
    /** editor: settings changed. Same song list -> live update; a different list / order -> reload (stops a preview). */
    function update(m) {
      m = m || {};
      const L = tracksOf(m),
        k =
          L.map((t) => t.src).join("\n") +
          "|" +
          (m.order === "shuffle" ? "s" : "q");
      if (pair && k !== key) {
        load(m);
        return;
      }
      C = m;
      list = L;
      if (pair && !xfBusy) W[cur].set(tvOf(cur), 0.25);
      applyMix(0.25);
      emitTrack();
    }
    function halt() {
      want = false;
      clearTimeout(pT);
      clearTimeout(xT);
      clearTimeout(pfT);
      xfBusy = false;
      stopTick();
      if (pair) pair.forEach((q) => q.el.pause());
      fadeP.set(0, 0);
      emit();
    }
    async function play(opt) {
      opt = opt || {};
      if (!pair) return false;
      const c = conf();
      // Repeated lifecycle requests must not seek, restart a fade or disturb a crossfade.
      if (want && !blocked && !muted && !pair[cur].el.paused && opt.at == null)
        return true;
      want = true;
      clearTimeout(pT);
      if (opt.unmute) muted = false;
      if (muted) {
        want = false;
        emit();
        return false;
      }
      const a = pair[cur].el;
      if (opt.at != null) seekReady(a, opt.at);
      else if (
        a.currentTime < c.cs - 0.05 ||
        (clipEnd(a, cur) && a.currentTime >= clipEnd(a, cur) - 0.1) ||
        a.currentTime === 0
      )
        seekReady(a, c.cs);
      if (wa && ctx.state !== "running") {
        try {
          await ctx.resume();
        } catch {}
      }
      if (!xfBusy) {
        pair[1 - cur].el.pause();
        W[cur].set(tvOf(cur), 0);
        W[1 - cur].set(0, 0);
      }
      if (a.paused) fadeP.set(0, 0);
      try {
        await a.play();
      } catch {
        blocked = true;
        emit();
        return false;
      }
      if (wa && ctx.state !== "running") {
        blocked = true;
        emit();
        return false;
      }
      blocked = false;
      fadeP.set(muted ? 0 : 1, opt.fade != null ? opt.fade : c.fi);
      startTick();
      emit();
      clearTimeout(pfT);
      pfT = setTimeout(prefetch, 1500);
      return true;
    }
    function pause(d) {
      if (!pair) return;
      const c = conf();
      d = d == null ? c.fo : d;
      want = false;
      emit();
      fadeP.set(0, d);
      clearTimeout(pT);
      pT = setTimeout(
        () => {
          if (want || !pair) return;
          pair.forEach((q) => q.el.pause());
          stopTick();
          clearTimeout(xT);
          xfBusy = false;
        },
        d * 1000 + 40,
      );
    }
    /** 「下一首」: crossfade into the next song while playing; when stopped, switch to it and start (unless muted). */
    function next() {
      if (!pair || list.length < 2) return false;
      if (want && !blocked && !pair[cur].el.paused) {
        go(Math.min(Math.max(conf().xf, 0.6), 1.5));
        return true;
      }
      const ti = advance(),
        o = 1 - cur;
      clearTimeout(xT);
      xfBusy = false;
      pair[o].el.pause();
      W[o].set(0, 0);
      if (trk[o] === ti) cur = o;
      else setEl(cur, ti, "auto");
      seekReady(pair[cur].el, csOf(cur));
      W[cur].set(tvOf(cur), 0);
      emitTrack();
      if (!muted) play();
      return true;
    }
    /** editor: preview song ti (optionally from time at) */
    function jump(ti, opt) {
      if (!pair || !list[ti]) return false;
      opt = opt || {};
      posTo(ti);
      const o = 1 - cur;
      clearTimeout(xT);
      xfBusy = false;
      pair[o].el.pause();
      W[o].set(0, 0);
      if (trk[cur] !== ti) {
        if (trk[o] === ti) {
          pair[cur].el.pause();
          cur = o;
        } else setEl(cur, ti, "auto");
      }
      emitTrack();
      return play({
        at: opt.at != null ? opt.at : csOf(cur),
        fade: opt.fade != null ? opt.fade : 0.3,
        unmute: true,
      });
    }
    function setMuted(m) {
      muted = !!m;
      if (muted) {
        if (want) {
          pause();
          muted = true;
        }
      } else play();
      emit();
    }
    /* call inside a user gesture: resumes the AudioContext and lets iOS play both elements later */
    function unlock() {
      const c = wa ? ctx : AC ? getCtx() : null;
      if (c && c.state !== "running") c.resume().catch(() => {});
      if (!pair) return;
      pair.forEach((q, i) => {
        if (!q.el.paused || q.unlocked || !q.el.getAttribute("src")) return;
        q.unlocked = true;
        if (i === cur && want) return;
        const mu = q.el.muted;
        q.el.muted = true;
        const p = q.el.play();
        if (p && p.then)
          p.then(
            () => {
              if (!(i === cur && want)) q.el.pause();
              q.el.muted = mu;
            },
            () => {
              q.el.muted = mu;
              q.unlocked = false;
            },
          );
      });
    }
    function duck(on) {
      duckN = Math.max(0, duckN + (on ? 1 : -1));
      applyMix(on ? 0.35 : 0.9);
    }
    function section(s) {
      if (s === sec) return;
      sec = s;
      secLv = lvFor(s);
      applyMix(duckN > 0 ? 0.35 : 1);
    }
    /* editor: jump close to the end of the current song to hear the crossfade into the next one (or the loop seam) */
    function seam() {
      if (!pair) return;
      const a = pair[cur].el,
        c = conf(),
        end = clipEnd(a, cur) || c.ce;
      return play({
        at: Math.max(c.cs, end - Math.min(c.xf, (end - c.cs) / 3) - 2.5),
        fade: 0.3,
        unmute: true,
      });
    }
    function vis(hidden) {
      if (hidden) {
        if (want) {
          hid = true;
          pause(Math.min(conf().fo, 0.8));
        }
      } else if (hid) {
        hid = false;
        if (!muted) play();
      }
    }
    const debug = () => ({
      wa,
      ctx: ctx ? ctx.state : "none",
      want,
      muted,
      blocked,
      cur,
      sec,
      duck: duckN,
      fade: +fadeP.now().toFixed(3),
      mix: +mixP.now().toFixed(3),
      w: W.map((p) => +p.now().toFixed(3)),
      t: pair ? +pair[cur].el.currentTime.toFixed(2) : 0,
      paused: pair ? pair.map((q) => q.el.paused) : [],
      src: (trackAt() || {}).src || "",
      level: +level().toFixed(3),
      cfg: conf(),
      ti: trk[cur],
      trk: trk.slice(),
      n: list.length,
      order: order.slice(),
      pos,
      title: (trackAt() || {}).title || "",
      xfBusy,
      elSrc: pair ? pair.map((q) => q.el.getAttribute("src") || "") : [],
      pre: pair ? pair.map((q) => q.el.preload) : [],
    });
    function dispose() {
      halt();
      clearInterval(tLoop);
      tweens.clear();
      if (pair)
        pair.forEach((q) => {
          q.el.removeEventListener("ended", onEnded);
          q.el.removeAttribute("src");
          q.el.load();
          if (q.g) q.g.disconnect();
        });
      pair = null;
      if (master) master.disconnect();
      if (mix) mix.disconnect();
      if (ctx) {
        ctx.close().catch(() => {});
        ctx = null;
      }
    }
    return {
      dispose,
      load,
      update,
      play,
      pause,
      halt,
      setMuted,
      unlock,
      duck,
      section,
      seam,
      next,
      jump,
      vis,
      debug,
      info,
      isMuted: () => muted,
      isOn: () => want,
      has: () => !!pair,
      count: () => list.length,
    };
  }
  return { create, DEF };
}

export function createMusicEngine(hooks) {
  return musicClientLib(MUSIC_DEFAULTS).create(hooks);
}
