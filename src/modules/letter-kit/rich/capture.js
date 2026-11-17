// Source 7771c20 capture tools; no content, assets or credentials.
/**
 * Capture helpers for the editor (injected via toString()):
 *  - prepareImage: decode (EXIF orientation applied by the browser), resize to <= 1800px, re-encode JPEG/WebP ~0.78.
 *    Re-encoding through a canvas drops every EXIF block, GPS included. GIFs are kept (animation; GIF has no EXIF).
 *    HEIC: decoded when the browser can (Safari); otherwise a friendly error (iOS pickers usually hand over JPEG anyway).
 *  - camera: desktop getUserMedia modal (front/back switch, shutter, retake, use photo); mobile uses <input capture>.
 *  - recorder: getUserMedia + MediaRecorder panel (live level waveform, timer, pause/resume, stop, listen back, re-record, save).
 *    Prefers audio/mp4 (AAC: plays everywhere incl. iOS Safari); a WebM/Ogg take can be transcoded to WAV (mono 24 kHz) client-side.
 */
export function createCaptureTools() {
  const activeCleanups = new Set();
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const coarse = () => matchMedia("(hover:none) and (pointer:coarse)").matches;
  const hasGUM = () =>
    !!(
      window.isSecureContext !== false &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    );
  const stamp = () => {
    const d = new Date(),
      p = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() +
      p(d.getMonth() + 1) +
      p(d.getDate()) +
      "-" +
      p(d.getHours()) +
      p(d.getMinutes()) +
      p(d.getSeconds())
    );
  };
  const MSG = {
    insecure:
      "录音和相机只能在 HTTPS 页面里使用（正式网址就是 HTTPS，可以直接用）。",
    deniedMic:
      "没有麦克风权限。点地址栏左侧的 🔒 / ⓘ，把「麦克风」改成允许，再点一次录音。iPhone：设置 › Safari › 麦克风。",
    deniedCam:
      "没有相机权限。点地址栏左侧的 🔒 / ⓘ，把「相机」改成允许后再试；也可以直接从相册选照片。",
    noMic:
      "没有找到麦克风。接上耳机麦克风或换台设备再试，也可以直接上传录好的音频文件。",
    noCam: "没有找到摄像头，可以改为从相册 / 文件选照片。",
    busy: "设备正被别的应用占用（比如视频会议），关掉后再试。",
    noRec: "这个浏览器不支持网页录音，请上传录好的音频文件（m4a / mp3）。",
  };
  function gumError(e, kind) {
    const n = (e && e.name) || String(e || "");
    if (/NotAllowed|Security|PermissionDenied/.test(n))
      return kind === "mic" ? MSG.deniedMic : MSG.deniedCam;
    if (/NotFound|DevicesNotFound|Overconstrained/.test(n))
      return kind === "mic" ? MSG.noMic : MSG.noCam;
    if (/NotReadable|TrackStart|Abort/.test(n)) return MSG.busy;
    if (n === "insecure") return MSG.insecure;
    return "无法打开" + (kind === "mic" ? "麦克风" : "相机") + "（" + n + "）";
  }
  function modal(cls, label) {
    const m = el("div", "cap-modal " + cls);
    m.setAttribute("role", "dialog");
    m.setAttribute("aria-modal", "true");
    m.setAttribute("aria-label", label);
    document.body.appendChild(m);
    requestAnimationFrame(() => m.classList.add("show"));
    return m;
  }
  const closeModal = (m) => {
    m.classList.remove("show");
    setTimeout(() => m.remove(), 220);
  };

  /* ── images ── */
  const isHeic = (f) =>
    /^image\/hei[cf]/i.test((f && f.type) || "") ||
    /\.(heic|heif)$/i.test((f && f.name) || "");
  async function decode(f) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(f, { imageOrientation: "from-image" });
      } catch {}
    }
    const u = URL.createObjectURL(f);
    try {
      return await new Promise((res, rej) => {
        const i = new Image();
        i.decoding = "async";
        i.onload = () => res(i);
        i.onerror = () => rej(new Error("decode"));
        i.src = u;
      });
    } finally {
      setTimeout(() => URL.revokeObjectURL(u), 4000);
    }
  }
  let WEBP = null;
  const canEncode = (t) => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    return c.toDataURL(t).indexOf("data:" + t) === 0;
  };
  const fail = (code) => Object.assign(new Error(code), { code });
  const IMG_MAX = 1800,
    IMG_Q = 0.78;
  async function prepareImage(f, o) {
    o = o || {};
    const max = o.max || IMG_MAX,
      q = o.quality || IMG_Q;
    if (!f) throw fail("empty");
    if (/^image\/gif$/i.test(f.type || "")) return { file: f, kept: true };
    if (f.type && !/^image\//i.test(f.type) && !isHeic(f))
      throw fail("notimage");
    let img;
    try {
      img = await decode(f);
    } catch {
      throw fail(isHeic(f) ? "heic" : "decode");
    }
    const w0 = img.width || img.naturalWidth,
      h0 = img.height || img.naturalHeight;
    if (!w0 || !h0) throw fail(isHeic(f) ? "heic" : "decode");
    const k = Math.min(1, max / Math.max(w0, h0)),
      w = Math.max(1, Math.round(w0 * k)),
      h = Math.max(1, Math.round(h0 * k));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    const alpha = !!o.alpha && /png|webp|avif/i.test(f.type || "");
    if (!alpha) {
      g.fillStyle = "#fff";
      g.fillRect(0, 0, w, h);
    }
    g.drawImage(img, 0, 0, w, h);
    if (img.close) img.close();
    if (WEBP == null) WEBP = canEncode("image/webp");
    const type = WEBP ? "image/webp" : alpha ? "image/png" : "image/jpeg";
    const blob = await new Promise((res) =>
      c.toBlob(res, type, alpha && !WEBP ? undefined : q),
    );
    if (!blob) throw fail("encode");
    const base =
      String(f.name || "photo")
        .replace(/\.[^.]+$/, "")
        .replace(/[^A-Za-z0-9_\u4e00-\u9fff-]+/g, "_")
        .slice(0, 50) || "photo";
    return {
      file: new File(
        [blob],
        base +
          (type === "image/jpeg"
            ? ".jpg"
            : type === "image/webp"
              ? ".webp"
              : ".png"),
        { type },
      ),
      w,
      h,
      w0,
      h0,
      resized: k < 1,
    };
  }
  const IMG_ERR = {
    heic: "这张是 HEIC（iPhone 高效格式），当前浏览器读不了。请在 iPhone「设置 › 相机 › 格式」选「兼容性最佳」，或用 Safari 上传（会自动转成 JPEG）。",
    decode: "这张图片读不出来，可能已损坏或格式不受支持。",
    notimage: "这不是图片文件。",
    encode: "图片压缩失败。",
    empty: "没有选择文件。",
  };

  /* ── file pickers ── */
  function pick(accept, opt) {
    opt = opt || {};
    return new Promise((res) => {
      const inp = el("input");
      inp.type = "file";
      inp.accept = accept;
      inp.multiple = !!opt.multiple;
      inp.hidden = true;
      inp.dataset.picker = "1";
      if (opt.capture) inp.setAttribute("capture", opt.capture);
      document.body.appendChild(inp);
      let done = false;
      const fin = (v) => {
        if (done) return;
        done = true;
        inp.remove();
        res(v);
      };
      inp.addEventListener("change", () => fin(Array.from(inp.files || [])));
      inp.addEventListener("cancel", () => fin([]));
      inp.click();
    });
  }

  /* ── camera ── */
  function cameraModal(o) {
    o = o || {};
    return new Promise((resolve) => {
      let facing = o.facing || "environment",
        stream = null,
        shot = null,
        alive = true,
        cams = 0;
      const m = modal("cap-cam", o.title || "拍照");
      m.innerHTML =
        '<div class="cap-box"><div class="cap-head"><span class="cap-t"></span><button type="button" class="cap-x" aria-label="关闭">✕</button></div>' +
        '<div class="cap-stage"><video playsinline muted autoplay></video><canvas hidden></canvas><div class="cap-flash"></div><p class="cap-msg" role="alert" hidden></p></div>' +
        '<div class="cap-bar"><button type="button" class="cap-flip" data-role="cam-flip" aria-label="切换前后摄像头">⇄ 前 / 后</button>' +
        '<button type="button" class="cap-shutter" data-role="cam-shutter" aria-label="拍照"><i></i></button>' +
        '<button type="button" class="cap-retake" data-role="cam-retake" hidden>重拍</button><button type="button" class="cap-use" data-role="cam-use" hidden>使用这张</button>' +
        '<button type="button" class="cap-alt" data-role="cam-files" hidden>改为选择照片</button></div></div>';
      const $q = (s) => m.querySelector(s),
        video = $q("video"),
        cv = $q("canvas"),
        msg = $q(".cap-msg");
      const bFlip = $q(".cap-flip"),
        bShut = $q(".cap-shutter"),
        bRe = $q(".cap-retake"),
        bUse = $q(".cap-use"),
        bAlt = $q(".cap-alt");
      $q(".cap-t").textContent = o.title || "拍照";
      const stopStream = () => {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        stream = null;
      };
      const close = (v) => {
        if (!alive) return;
        alive = false;
        activeCleanups.delete(dispose);
        stopStream();
        document.removeEventListener("keydown", kd, true);
        closeModal(m);
        resolve(v);
      };
      const kd = (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close(null);
        }
      };
      const dispose = () => close(null);
      activeCleanups.add(dispose);
      document.addEventListener("keydown", kd, true);
      const showErr = (t) => {
        msg.textContent = t;
        msg.hidden = false;
        bShut.disabled = true;
        bFlip.hidden = true;
        bAlt.hidden = false;
        video.hidden = true;
      };
      const live = (on) => {
        video.hidden = !on;
        cv.hidden = on;
        bShut.hidden = !on;
        bFlip.hidden = !on || cams < 2;
        bRe.hidden = on;
        bUse.hidden = on;
      };
      async function start() {
        stopStream();
        msg.hidden = true;
        bShut.disabled = true;
        if (!hasGUM()) {
          showErr(MSG.insecure);
          return;
        }
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facing },
              width: { ideal: 1920 },
              height: { ideal: 1440 },
            },
            audio: false,
          });
        } catch (e) {
          if (alive) showErr(gumError(e, "cam"));
          return;
        }
        if (!alive) {
          stopStream();
          return;
        }
        video.srcObject = stream;
        video.classList.toggle("mirror", facing === "user");
        try {
          await video.play();
        } catch {}
        try {
          cams = (await navigator.mediaDevices.enumerateDevices()).filter(
            (d) => d.kind === "videoinput",
          ).length;
        } catch {
          cams = 1;
        }
        bShut.disabled = false;
        live(true);
      }
      $q(".cap-x").onclick = () => close(null);
      m.addEventListener("click", (e) => {
        if (e.target === m) close(null);
      });
      bFlip.onclick = () => {
        facing = facing === "user" ? "environment" : "user";
        start();
      };
      bAlt.onclick = () => close({ fallback: true });
      bShut.onclick = () => {
        const w = video.videoWidth,
          h = video.videoHeight;
        if (!w || !h) return;
        cv.width = w;
        cv.height = h;
        cv.getContext("2d").drawImage(video, 0, 0, w, h);
        cv.classList.toggle("mirror", facing === "user");
        m.querySelector(".cap-flash").classList.remove("go");
        void m.offsetWidth;
        m.querySelector(".cap-flash").classList.add("go");
        shot = true;
        live(false);
      };
      bRe.onclick = () => {
        shot = null;
        live(true);
      };
      bUse.onclick = () => {
        if (!shot) return;
        cv.toBlob(
          (b) => {
            if (b)
              close({
                file: new File([b], "camera-" + stamp() + ".jpg", {
                  type: "image/jpeg",
                }),
              });
          },
          "image/jpeg",
          0.92,
        );
      };
      start();
      setTimeout(() => bShut.focus(), 60);
    });
  }
  /** Take a photo: mobile -> native camera via <input capture>; desktop -> getUserMedia modal (falls back to the file picker). Resolves File[]. */
  async function takePhoto(o) {
    o = o || {};
    if (coarse() || !hasGUM())
      return pick("image/*", {
        capture: o.facing === "user" ? "user" : "environment",
      });
    const r = await cameraModal(o);
    if (r && r.file) return [r.file];
    if (r && r.fallback) return pick("image/*", { multiple: !!o.multiple });
    return [];
  }

  /* ── voice recorder ── */
  const MIMES = [
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  function pickMime() {
    if (!window.MediaRecorder) return null;
    if (typeof MediaRecorder.isTypeSupported !== "function") return "";
    for (const t of MIMES) {
      try {
        if (MediaRecorder.isTypeSupported(t)) return t;
      } catch {}
    }
    return "";
  }
  // AAC-in-MP4 (Safari, Chrome on macOS/Windows), MP3 and WAV play on every iPhone; Opus (even inside MP4, as Chrome on Linux/Android records) needs iOS 17+.
  const iosSafe = (t) =>
    !/opus|vorbis/i.test(t || "") && /mp4|aac|m4a|mpeg|wav/i.test(t || "");
  const extFor = (t) =>
    /mp4|aac|m4a/i.test(t)
      ? ".m4a"
      : /webm/i.test(t)
        ? ".webm"
        : /ogg/i.test(t)
          ? ".ogg"
          : /wav/i.test(t)
            ? ".wav"
            : ".audio";
  function wavFromBuffer(ab) {
    const ch = ab.getChannelData(0),
      n = ch.length,
      rate = ab.sampleRate,
      buf = new ArrayBuffer(44 + n * 2),
      v = new DataView(buf);
    const s = (o, t) => {
      for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i));
    };
    s(0, "RIFF");
    v.setUint32(4, 36 + n * 2, true);
    s(8, "WAVE");
    s(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    s(36, "data");
    v.setUint32(40, n * 2, true);
    for (let i = 0, o = 44; i < n; i++, o += 2) {
      const x = Math.max(-1, Math.min(1, ch[i]));
      v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
    }
    return new Blob([buf], { type: "audio/wav" });
  }
  async function toWav(blob, rate) {
    rate = rate || 22050;
    const AC = window.AudioContext || window.webkitAudioContext,
      OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const c = new AC();
    let src;
    const data = await blob.arrayBuffer();
    try {
      src = await new Promise((res, rej) => {
        const p = c.decodeAudioData(data, res, rej);
        if (p && p.then) p.then(res, rej);
      });
    } finally {
      try {
        c.close();
      } catch {}
    }
    const len = Math.max(1, Math.ceil(src.duration * rate)),
      off = new OAC(1, len, rate),
      node = off.createBufferSource();
    node.buffer = src;
    node.connect(off.destination);
    node.start();
    return wavFromBuffer(await off.startRendering());
  }
  const fmt = (s) => {
    s = Math.max(0, Math.floor(s));
    return (
      String(Math.floor(s / 60)).padStart(2, "0") +
      ":" +
      String(s % 60).padStart(2, "0")
    );
  };
  /**
   * o.onSave(file, setProgress) -> Promise<boolean> (upload; true closes the panel); o.beforeSave() -> Promise<boolean> (e.g. confirm replace);
   * o.maxSec (default 600); o.title.
   */
  function recorder(o) {
    o = o || {};
    return new Promise((resolve) => {
      const maxSec = o.maxSec || 600;
      const m = modal("cap-rec", o.title || "录一段语音");
      m.innerHTML =
        '<div class="cap-box rec-box"><div class="cap-head"><span class="cap-t"></span><button type="button" class="cap-x" aria-label="关闭">✕</button></div>' +
        '<div class="rec-viz"><canvas width="720" height="120" aria-hidden="true"></canvas><div class="rec-dot" aria-hidden="true"></div></div>' +
        '<div class="rec-meta"><span class="rec-time" data-role="rec-time">00:00</span><span class="rec-state" role="status" aria-live="polite"></span></div>' +
        '<div class="rec-ctl">' +
        '<button type="button" class="rec-big rec-start" data-role="rec-start" aria-label="开始录音"><i></i></button>' +
        '<button type="button" class="rec-btn" data-role="rec-pause" hidden>❚❚ 暂停</button>' +
        '<button type="button" class="rec-big rec-stop" data-role="rec-stop" aria-label="停止" hidden><i></i></button>' +
        '<button type="button" class="rec-btn" data-role="rec-play" hidden>▶ 试听</button>' +
        '<button type="button" class="rec-btn" data-role="rec-redo" hidden>重录</button>' +
        '<button type="button" class="rec-btn rec-save" data-role="rec-save" hidden>保存这段</button>' +
        '</div><label class="rec-opt" hidden><input type="checkbox" data-role="rec-wav" checked> 转成 iPhone 也能播放的 WAV（文件会大一些）</label>' +
        '<div class="rec-prog" hidden><i></i></div><p class="rec-note"></p><p class="rec-err" role="alert" hidden></p></div>';
      const $q = (s) => m.querySelector(s),
        cv = $q("canvas"),
        g = cv.getContext("2d");
      const B = {
        start: $q("[data-role=rec-start]"),
        pause: $q("[data-role=rec-pause]"),
        stop: $q("[data-role=rec-stop]"),
        play: $q("[data-role=rec-play]"),
        redo: $q("[data-role=rec-redo]"),
        save: $q("[data-role=rec-save]"),
      };
      const tEl = $q(".rec-time"),
        sEl = $q(".rec-state"),
        note = $q(".rec-note"),
        errEl = $q(".rec-err"),
        opt = $q(".rec-opt"),
        wav = $q("[data-role=rec-wav]"),
        prog = $q(".rec-prog"),
        progI = prog.querySelector("i");
      $q(".cap-t").textContent = o.title || "录一段语音";
      const mime = pickMime();
      let state = "idle",
        stream = null,
        rec = null,
        chunks = [],
        ac = null,
        an = null,
        raf = 0,
        t0 = 0,
        acc = 0,
        levels = [],
        blob = null,
        url = "",
        audio = null,
        alive = true,
        recMime = "";
      m.dataset.state = state;
      const setState = (s, text) => {
        state = s;
        m.dataset.state = s;
        sEl.textContent = text || "";
        B.start.hidden = s !== "idle";
        B.pause.hidden = !(s === "rec" || s === "paused");
        B.stop.hidden = !(s === "rec" || s === "paused");
        B.play.hidden = B.redo.hidden = B.save.hidden = s !== "review";
        B.pause.textContent = s === "paused" ? "● 继续" : "❚❚ 暂停";
        B.pause.setAttribute(
          "aria-label",
          s === "paused" ? "继续录音" : "暂停录音",
        );
      };
      const showErr = (t) => {
        errEl.textContent = t;
        errEl.hidden = !t;
      };
      const elapsed = () =>
        acc + (state === "rec" ? (performance.now() - t0) / 1000 : 0);
      if (mime === null) {
        showErr(MSG.noRec);
        B.start.disabled = true;
      } else if (!hasGUM()) {
        showErr(MSG.insecure);
        B.start.disabled = true;
      }
      const fmtNote = (t) => {
        const nm = (t || "浏览器默认").replace(/\s+/g, "");
        note.textContent = !/codecs/i.test(t || "")
          ? "录音格式：" + nm
          : iosSafe(t)
            ? "录音格式：" + nm + "（iPhone / 安卓 / 电脑都能播放）"
            : "录音格式：" +
              nm +
              " · 旧版 iPhone（iOS 16 及以前）可能放不出来，保存时可转成 WAV";
      };
      if (mime !== null) fmtNote(mime);
      setState("idle", mime === null ? "" : "准备好了就点红色按钮");
      function draw() {
        const W = cv.width,
          H = cv.height;
        g.clearRect(0, 0, W, H);
        const bw = 6,
          gap = 3,
          n = Math.floor(W / (bw + gap));
        let arr = levels,
          playK = -1;
        if (state === "review" || state === "saving") {
          // whole take, compressed to the width; playhead while listening back
          arr = [];
          const L = levels.length || 1;
          for (let i = 0; i < n; i++) {
            let mx = 0;
            const a = Math.floor((i * L) / n),
              b = Math.max(a + 1, Math.floor(((i + 1) * L) / n));
            for (let j = a; j < b; j++) mx = Math.max(mx, levels[j] || 0);
            arr.push(mx);
          }
          if (audio && !audio.paused)
            playK = (audio.currentTime / Math.max(0.1, acc)) * n;
        } else arr = levels.slice(-n);
        for (let i = 0; i < arr.length; i++) {
          const v = Math.min(1, arr[i] * 1.6),
            h = Math.max(3, v * (H - 12)),
            x =
              state === "review" || state === "saving"
                ? i * (bw + gap)
                : W - (arr.length - i) * (bw + gap);
          g.fillStyle =
            playK >= 0
              ? i <= playK
                ? "#e8c98e"
                : "rgba(239,230,216,.3)"
              : state === "paused"
                ? "rgba(239,230,216,.35)"
                : i > arr.length - 4
                  ? "#f0d9a8"
                  : "#c9a46a";
          g.fillRect(x, (H - h) / 2, bw, h);
        }
      }
      function loop() {
        if (!alive) return;
        if (an && state === "rec") {
          const d = new Uint8Array(an.fftSize);
          an.getByteTimeDomainData(d);
          let s = 0;
          for (let i = 0; i < d.length; i++) {
            const x = (d[i] - 128) / 128;
            s += x * x;
          }
          const rms = Math.sqrt(s / d.length);
          levels.push(rms);
          m.style.setProperty("--lvl", Math.min(1, rms * 3).toFixed(3));
          const e = elapsed();
          tEl.textContent =
            fmt(e) + (maxSec - e < 30 ? " / " + fmt(maxSec) : "");
          if (e >= maxSec) stop();
        }
        draw();
        raf = requestAnimationFrame(loop);
      }
      const release = () => {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        stream = null;
        if (ac) {
          try {
            ac.close();
          } catch {}
        }
        ac = null;
        an = null;
      };
      async function start() {
        showErr("");
        setState("asking", "请允许使用麦克风…");
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        } catch (e) {
          setState("idle", "");
          showErr(gumError(e, "mic"));
          return;
        }
        if (!alive) {
          release();
          return;
        }
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          ac = new AC();
          an = ac.createAnalyser();
          an.fftSize = 1024;
          ac.createMediaStreamSource(stream).connect(an);
        } catch {
          an = null;
        }
        try {
          rec = new MediaRecorder(
            stream,
            mime ? { mimeType: mime, audioBitsPerSecond: 96000 } : undefined,
          );
        } catch {
          try {
            rec = new MediaRecorder(stream);
          } catch {
            release();
            setState("idle", "");
            showErr(MSG.noRec);
            return;
          }
        }
        chunks = [];
        levels = [];
        acc = 0;
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size) chunks.push(e.data);
        };
        rec.onstop = () => {
          recMime = rec.mimeType || mime || "audio/webm";
          blob = new Blob(chunks, {
            type: recMime.split(";")[0] || "audio/webm",
          });
          release();
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(blob);
          audio = new Audio();
          audio.preload = "auto";
          audio.src = url;
          audio.onended = () => {
            B.play.textContent = "▶ 试听";
          };
          opt.hidden = iosSafe(recMime);
          fmtNote(recMime);
          setState("review", "时长 " + fmt(acc) + " · 可以试听，满意就保存");
          setTimeout(() => B.save.focus(), 30);
        };
        rec.start(250);
        t0 = performance.now();
        setState("rec", "正在录音");
        if (rec.mimeType) fmtNote(rec.mimeType);
        m.classList.add("live");
      }
      function stop() {
        if (!rec || (state !== "rec" && state !== "paused")) return;
        if (state === "rec") acc += (performance.now() - t0) / 1000;
        state = "stopping";
        m.classList.remove("live");
        try {
          rec.stop();
        } catch {}
      }
      function reset() {
        if (audio) {
          audio.pause();
          audio = null;
        }
        if (url) URL.revokeObjectURL(url);
        url = "";
        blob = null;
        levels = [];
        acc = 0;
        tEl.textContent = "00:00";
        prog.hidden = true;
        setState("idle", "再来一次，准备好了就点红色按钮");
      }
      const dirty = () =>
        state === "rec" || state === "paused" || state === "review";
      async function close(force) {
        if (!alive) return;
        if (!force && dirty()) {
          const ok = o.confirm
            ? await o.confirm(
                "放弃这段录音？",
                "还没有保存，关掉后这段录音会丢失。",
                "放弃",
              )
            : window.confirm("放弃这段录音？");
          if (!ok) return;
        }
        alive = false;
        activeCleanups.delete(dispose);
        cancelAnimationFrame(raf);
        if (rec && rec.state !== "inactive") {
          rec.onstop = null;
          try {
            rec.stop();
          } catch {}
        }
        release();
        if (audio) audio.pause();
        if (url) URL.revokeObjectURL(url);
        document.removeEventListener("keydown", kd, true);
        closeModal(m);
        resolve(m.__result || null);
      }
      const kd = (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close(false);
        }
      };
      const dispose = () => {
        void close(true);
      };
      activeCleanups.add(dispose);
      document.addEventListener("keydown", kd, true);
      $q(".cap-x").onclick = () => close(false);
      B.start.onclick = start;
      B.pause.onclick = () => {
        if (state === "rec") {
          rec.pause();
          acc += (performance.now() - t0) / 1000;
          setState("paused", "已暂停");
          m.classList.remove("live");
        } else if (state === "paused") {
          rec.resume();
          t0 = performance.now();
          setState("rec", "正在录音");
          m.classList.add("live");
        }
      };
      B.stop.onclick = stop;
      B.play.onclick = () => {
        if (!audio) return;
        if (audio.paused) {
          audio.currentTime = 0;
          audio.play().catch(() => {});
          B.play.textContent = "❚❚ 停止试听";
        } else {
          audio.pause();
          B.play.textContent = "▶ 试听";
        }
      };
      B.redo.onclick = reset;
      B.save.onclick = async () => {
        if (!blob) return;
        if (o.beforeSave && !(await o.beforeSave())) return;
        if (audio) {
          audio.pause();
          B.play.textContent = "▶ 试听";
        }
        setState("saving", "处理中…");
        showErr("");
        let file = new File([blob], "voice-" + stamp() + extFor(recMime), {
            type: blob.type || "audio/webm",
          }),
          conv = false;
        if (!iosSafe(recMime) && wav.checked) {
          try {
            const w = await toWav(blob);
            if (w.size <= 24 * 1024 * 1024) {
              file = new File([w], "voice-" + stamp() + ".wav", {
                type: "audio/wav",
              });
              conv = true;
            } else
              showErr(
                "录音太长，转 WAV 会超过 24MB，已按原格式保存（旧版 iPhone 可能无法播放）。",
              );
          } catch {
            showErr("转码失败，已按原格式保存（旧版 iPhone 可能无法播放）。");
          }
        }
        prog.hidden = false;
        progI.style.width = "0%";
        sEl.textContent = "上传中…";
        const ok = o.onSave
          ? await o.onSave(file, (p) => {
              progI.style.width = p + "%";
              sEl.textContent = "上传中 " + p + "%";
            })
          : true;
        if (!ok) {
          prog.hidden = true;
          setState("review", "上传没有成功，可以再试一次");
          return;
        }
        m.__result = {
          file,
          mime: file.type,
          dur: acc,
          converted: conv,
          recordedAs: recMime,
        };
        close(true);
      };
      raf = requestAnimationFrame(loop);
      setTimeout(() => B.start.focus(), 60);
    });
  }
  return {
    dispose() {
      for (const cleanup of [...activeCleanups]) cleanup();
      activeCleanups.clear();
    },
    prepareImage,
    IMG_MAX,
    IMG_Q,
    IMG_ERR,
    isHeic,
    pick,
    takePhoto,
    cameraModal,
    recorder,
    pickMime,
    iosSafe,
    toWav,
    gumError,
    coarse,
    hasGUM,
  };
}
