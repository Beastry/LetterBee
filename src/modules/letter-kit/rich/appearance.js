// Adapted from source 7771c20 yearStyle.js. Procedural textures only, no source assets/fonts.
export const PRESETS = {
  sealColors: {
    wine: { name: "深酒红", c: "#6d1d2e" },
    green: { name: "墨绿", c: "#1f3a2c" },
    navy: { name: "藏青", c: "#1c2944" },
    gold: { name: "哑金", c: "#9a7a4a" },
    black: { name: "墨黑", c: "#1d1c1f" },
  },
  shapes: { round: "圆形", drip: "流淌" },
  emblems: { rings: "双环纹样", letter: "字母", image: "上传图片" },
  paperTex: {
    linen: "奶油亚麻",
    handmade: "手工纸",
    lined: "横线",
    plain: "素白",
  },
  paperColors: {
    cream: "#f2e9dc",
    ivory: "#f7f1e5",
    white: "#fbfaf6",
    blush: "#f2e4dd",
    sage: "#e7e9dc",
    mist: "#e6e8ec",
  },
  fonts: { serif: "宋体衬线", kai: "楷体（系统字体）", sans: "黑体" },
  envMat: { linen: "亚麻", cotton: "棉浆纸", kraft: "牛皮纸", laid: "条纹纸" },
  envColors: {
    cream: "#ece0cc",
    ivory: "#f3ece0",
    kraft: "#b8946a",
    rose: "#d9b8ae",
    forest: "#33473b",
    navy: "#2b3550",
    ink: "#2a2729",
  },
  liners: {
    lozenge: "菱格",
    damask: "花卉",
    stripe: "条纹",
    dots: "星点",
    none: "无",
  },
};

const pick = (v, obj, d) =>
  Object.prototype.hasOwnProperty.call(obj, v) ? v : d;
const hex = (v, d) =>
  /^#[0-9a-fA-F]{6}$/.test(String(v || "")) ? String(v).toLowerCase() : d;
const num = (v, a, b, d) => {
  const n = +v;
  return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d;
};
const safeMedia = (v) => {
  const s = String(v || "");
  return /^\/api\/mail-media\/[a-f0-9-]{36}$/.test(s) && !s.includes("..")
    ? s
    : "";
};

/** Server-side whitelist — run on save and before handing content to visitors. */
export function cleanStyle(s) {
  if (!s || typeof s !== "object") return undefined;
  const o = {};
  if (s.seal && typeof s.seal === "object") {
    const x = s.seal;
    o.seal = {
      color: pick(x.color, PRESETS.sealColors, "wine"),
      shape: pick(x.shape, PRESETS.shapes, "round"),
      gloss: num(x.gloss, 0, 1, 0.55),
      emblem: pick(x.emblem, PRESETS.emblems, "rings"),
      letter: Array.from(
        String(x.letter || "").replace(/[\u0000-\u001f<>]/g, ""),
      )
        .slice(0, 3)
        .join(""),
      image: safeMedia(x.image),
      invert: !!x.invert,
      gilt: x.gilt !== false,
    };
  }
  if (s.paper && typeof s.paper === "object") {
    const x = s.paper;
    o.paper = {
      tex: pick(x.tex, PRESETS.paperTex, "linen"),
      color: hex(x.color, PRESETS.paperColors.cream),
      font: pick(x.font, PRESETS.fonts, "serif"),
      lh: Math.round(num(x.lh, 1.6, 2.4, 2) * 10) / 10,
    };
  }
  if (s.envelope && typeof s.envelope === "object") {
    const x = s.envelope;
    o.envelope = {
      mat: pick(x.mat, PRESETS.envMat, "linen"),
      color: hex(x.color, PRESETS.envColors.cream),
      liner: pick(x.liner, PRESETS.liners, "lozenge"),
      linerColor: pick(x.linerColor, PRESETS.sealColors, "wine"),
    };
  }
  return Object.keys(o).length ? o : undefined;
}

function clientStyleLib(P) {
  const SEAL_DEFAULT = {
    color: "wine",
    shape: "round",
    gloss: 0.55,
    emblem: "rings",
    letter: "",
    image: "",
    invert: false,
    gilt: true,
  };
  const PAPER_DEFAULT = {
    tex: "linen",
    color: P.paperColors.cream,
    font: "serif",
    lh: 2,
  };
  const ENV_DEFAULT = {
    mat: "linen",
    color: P.envColors.cream,
    liner: "lozenge",
    linerColor: "wine",
  };
  const VAR_NAMES = [
    "--lp-color",
    "--lp-tex",
    "--lp-lines",
    "--lp-font",
    "--lp-lh",
    "--env-c",
    "--env-c2",
    "--env-c3",
    "--env-tex",
    "--env-ink",
    "--liner-img",
  ];

  function rgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toHex(a) {
    return (
      "#" +
      a
        .map((v) =>
          Math.max(0, Math.min(255, Math.round(v)))
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  }
  function mix(h, t, k) {
    const a = rgb(h),
      b = rgb(t);
    return toHex(a.map((v, i) => v + (b[i] - v) * k));
  }
  function lum(h) {
    const [r, g, b] = rgb(h);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  function svgUrl(svg) {
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  function noiseTex(alpha, freq, tint) {
    const c = rgb(tint || "#5a4026").map((v) => (v / 255).toFixed(3));
    return svgUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="' +
        freq +
        '" numOctaves="3" stitchTiles="stitch"/>' +
        '<feColorMatrix values="0 0 0 0 ' +
        c[0] +
        " 0 0 0 0 " +
        c[1] +
        " 0 0 0 0 " +
        c[2] +
        " 0 0 0 " +
        alpha +
        ' 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>',
    );
  }
  function fiberTex(alpha) {
    return (
      svgUrl(
        '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260"><filter id="f"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.35" numOctaves="2" seed="7" stitchTiles="stitch"/>' +
          '<feColorMatrix values="0 0 0 0 .38 0 0 0 0 .3 0 0 0 0 .2 0 0 0 ' +
          alpha +
          ' 0"/></filter><rect width="100%" height="100%" filter="url(#f)"/></svg>',
      ) +
      "," +
      noiseTex(0.07, 0.85)
    );
  }
  function paperTex(t) {
    if (t === "handmade") return fiberTex(0.16);
    if (t === "lined") return noiseTex(0.03, 0.9); // rules are drawn by --lp-lines on the writing area so they align with text
    if (t === "plain") return noiseTex(0.025, 0.9);
    return fiberTex(0.08);
  }
  function envTex(m) {
    if (m === "cotton") return noiseTex(0.06, 0.7);
    if (m === "kraft") return fiberTex(0.22);
    if (m === "laid")
      return (
        "repeating-linear-gradient(90deg,rgba(40,25,10,.05) 0 1px,transparent 1px 6px)," +
        noiseTex(0.04, 0.8)
      );
    return fiberTex(0.08);
  }
  function linerImg(kind, colorKey) {
    if (kind === "none") return "none";
    const base = (P.sealColors[colorKey] || P.sealColors.wine).c;
    const g = "#d8b77a",
      bg = base,
      bg2 = mix(base, "#000000", 0.25);
    let body = "";
    if (kind === "lozenge")
      body =
        '<rect width="28" height="28" fill="' +
        bg +
        '"/><path d="M14 0L28 14L14 28L0 14Z" fill="none" stroke="' +
        g +
        '" stroke-opacity=".55" stroke-width="1"/><circle cx="14" cy="14" r="1.6" fill="' +
        g +
        '" fill-opacity=".7"/>';
    else if (kind === "damask")
      body =
        '<rect width="28" height="28" fill="' +
        bg +
        '"/><g fill="' +
        g +
        '" fill-opacity=".38"><ellipse cx="14" cy="8" rx="2.4" ry="5"/><ellipse cx="14" cy="20" rx="2.4" ry="5"/><ellipse cx="8" cy="14" rx="5" ry="2.4"/><ellipse cx="20" cy="14" rx="5" ry="2.4"/></g><circle cx="14" cy="14" r="2" fill="' +
        g +
        '" fill-opacity=".7"/><circle cx="0" cy="0" r="2" fill="' +
        g +
        '" fill-opacity=".35"/><circle cx="28" cy="28" r="2" fill="' +
        g +
        '" fill-opacity=".35"/>';
    else if (kind === "stripe")
      body =
        '<rect width="28" height="28" fill="' +
        bg +
        '"/><rect x="0" width="9" height="28" fill="' +
        bg2 +
        '"/><rect x="11" width="1" height="28" fill="' +
        g +
        '" fill-opacity=".5"/>';
    else if (kind === "dots")
      body =
        '<rect width="28" height="28" fill="' +
        bg +
        '"/><path d="M14 9l1.2 3.8L19 14l-3.8 1.2L14 19l-1.2-3.8L9 14l3.8-1.2z" fill="' +
        g +
        '" fill-opacity=".55"/><circle cx="0" cy="0" r="1.2" fill="' +
        g +
        '" fill-opacity=".45"/><circle cx="28" cy="28" r="1.2" fill="' +
        g +
        '" fill-opacity=".45"/>';
    return svgUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">' +
        body +
        "</svg>",
    );
  }

  function fontStack(f) {
    if (f === "kai") return '"Kaiti SC","STKaiti","KaiTi",var(--serif)';
    if (f === "sans") return "var(--sans)";
    return "var(--serif)";
  }

  /** CSS custom properties for paper + envelope. Missing sections → not set (CSS falls back to the default look). */
  function styleVars(style) {
    const v = {};
    if (!style) return v;
    if (style.paper) {
      const p = Object.assign({}, PAPER_DEFAULT, style.paper);
      v["--lp-color"] = p.color;
      v["--lp-tex"] = paperTex(p.tex);
      if (p.tex === "lined")
        v["--lp-lines"] =
          "linear-gradient(180deg,transparent calc(100% - 1px),rgba(70,90,130,.22) calc(100% - 1px))";
      v["--lp-font"] = fontStack(p.font);
      v["--lp-lh"] = String(p.lh);
    }
    if (style.envelope) {
      const e = Object.assign({}, ENV_DEFAULT, style.envelope);
      v["--env-c"] = e.color;
      v["--env-c2"] = mix(e.color, "#ffffff", 0.12);
      v["--env-c3"] = mix(e.color, "#000000", 0.1);
      v["--env-tex"] = envTex(e.mat);
      v["--env-ink"] = lum(e.color) < 0.38 ? "#e6d2a8" : "#5b1826";
      v["--liner-img"] = linerImg(e.liner, e.linerColor);
    }
    return v;
  }
  function applyVars(el, style) {
    VAR_NAMES.forEach((k) => el.style.removeProperty(k));
    const v = styleVars(style);
    Object.keys(v).forEach((k) => el.style.setProperty(k, v[k]));
  }
  function hasSeal(style) {
    return !!(style && style.seal);
  }

  /* ── wax seal generator (canvas) ── */
  function rng(seed) {
    let h = 2166136261;
    const s = String(seed);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return function () {
      h += 0x6d2b79f5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function blobPath(ctx, cx, cy, R, shape, rand) {
    const N = 120,
      ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
    const drips = [];
    if (shape === "drip") {
      const k = 3 + Math.floor(rand() * 3);
      for (let i = 0; i < k; i++)
        drips.push({
          a: rand() * 6.28,
          h: 0.1 + rand() * 0.16,
          w: 0.12 + rand() * 0.12,
        });
    }
    const pts = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      let r =
        1 +
        0.018 * Math.sin(a * 7 + ph[0]) +
        0.012 * Math.sin(a * 13 + ph[1]) +
        0.008 * Math.sin(a * 23 + ph[2]);
      if (shape === "drip") {
        r += 0.03 * Math.sin(a * 3 + ph[1]);
        drips.forEach((d) => {
          let da = Math.abs(
            ((a - d.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI,
          );
          r += d.h * Math.exp(-(da * da) / (2 * d.w * d.w));
        });
      }
      pts.push([cx + Math.cos(a) * R * r, cy + Math.sin(a) * R * r]);
    }
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const p = pts[i],
        q = pts[(i + 1) % N],
        m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      if (i === 0) ctx.moveTo(m[0], m[1]);
      else ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
    }
    const p0 = pts[0],
      q0 = pts[1];
    ctx.quadraticCurveTo(
      p0[0],
      p0[1],
      (p0[0] + q0[0]) / 2,
      (p0[1] + q0[1]) / 2,
    );
    ctx.closePath();
  }
  function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h || w;
    return c;
  }
  function tint(mask, fill) {
    const c = canvas(mask.width, mask.height),
      x = c.getContext("2d");
    x.fillStyle = fill;
    x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = "destination-in";
    x.drawImage(mask, 0, 0);
    return c;
  }
  function loadImg(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = src;
    });
  }
  /** Image → binary relief mask: grayscale, Otsu threshold, auto-invert when the subject covers most of the frame. */
  function imageMask(im, m, invert) {
    const c = canvas(m),
      x = c.getContext("2d");
    const s = Math.min(m / im.naturalWidth, m / im.naturalHeight) * 0.92;
    const w = im.naturalWidth * s,
      h = im.naturalHeight * s;
    x.fillStyle = "#fff";
    x.fillRect(0, 0, m, m);
    x.drawImage(im, (m - w) / 2, (m - h) / 2, w, h);
    const d = x.getImageData(0, 0, m, m),
      px = d.data,
      hist = new Array(256).fill(0),
      L = new Uint8Array(m * m);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      const l =
        px[i + 3] < 128
          ? 255
          : Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
      L[j] = l;
      hist[l]++;
    }
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sB = 0,
      wB = 0,
      best = 0,
      th = 128;
    const tot = m * m;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = tot - wB;
      if (!wF) break;
      sB += t * hist[t];
      const mB = sB / wB,
        mF = (sum - sB) / wF,
        b = wB * wF * (mB - mF) * (mB - mF);
      if (b > best) {
        best = b;
        th = t;
      }
    }
    let cover = 0;
    for (let j = 0; j < L.length; j++) if (L[j] <= th) cover++;
    let inv = cover / tot > 0.55;
    if (invert) inv = !inv;
    for (let j = 0, i = 0; j < L.length; j++, i += 4) {
      const on = L[j] <= th !== inv;
      px[i] = px[i + 1] = px[i + 2] = 255;
      px[i + 3] = on ? 255 : 0;
    }
    x.putImageData(d, 0, 0);
    const o = canvas(m),
      ox = o.getContext("2d");
    ox.beginPath();
    ox.arc(m / 2, m / 2, (m / 2) * 0.98, 0, Math.PI * 2);
    ox.clip();
    ox.filter = "blur(" + (m / 260).toFixed(2) + "px)";
    ox.drawImage(c, 0, 0);
    return o;
  }
  function ringsMask(m) {
    const c = canvas(m),
      x = c.getContext("2d"),
      R = m / 2;
    x.strokeStyle = "#fff";
    x.fillStyle = "#fff";
    x.lineWidth = m * 0.05;
    x.lineCap = "round";
    x.beginPath();
    x.arc(R - m * 0.12, R + m * 0.07, m * 0.17, 0, Math.PI * 2);
    x.stroke();
    x.beginPath();
    x.arc(R + m * 0.12, R + m * 0.07, m * 0.17, 0, Math.PI * 2);
    x.stroke();
    const sx = R,
      sy = R - m * 0.25,
      s = m * 0.075;
    x.beginPath();
    x.moveTo(sx, sy - s);
    x.lineTo(sx + s * 0.3, sy - s * 0.3);
    x.lineTo(sx + s, sy);
    x.lineTo(sx + s * 0.3, sy + s * 0.3);
    x.lineTo(sx, sy + s);
    x.lineTo(sx - s * 0.3, sy + s * 0.3);
    x.lineTo(sx - s, sy);
    x.lineTo(sx - s * 0.3, sy - s * 0.3);
    x.closePath();
    x.fill();
    x.lineWidth = m * 0.012;
    x.beginPath();
    x.arc(R, R, m * 0.47, 0, Math.PI * 2);
    x.stroke();
    return c;
  }
  async function letterMask(m, text) {
    const c = canvas(m),
      x = c.getContext("2d"),
      R = m / 2,
      t =
        Array.from(text || "")
          .slice(0, 3)
          .join("") || "·";
    const n = Array.from(t).length,
      size = m * (n === 1 ? 0.5 : n === 2 ? 0.36 : 0.27);
    const font = "600 " + Math.round(size) + 'px "Noto Serif SC",Georgia,serif';
    try {
      await document.fonts.load(font, t);
    } catch {}
    x.fillStyle = "#fff";
    x.strokeStyle = "#fff";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.font = font;
    x.fillText(t, R, R + size * 0.04);
    x.lineWidth = m * 0.016;
    x.beginPath();
    x.arc(R, R, m * 0.47, 0, Math.PI * 2);
    x.stroke();
    x.lineWidth = m * 0.006;
    x.beginPath();
    x.arc(R, R, m * 0.42, 0, Math.PI * 2);
    x.stroke();
    return c;
  }

  const cache = new Map();
  function makeSeal(sealIn, seed, size) {
    const s = Object.assign({}, SEAL_DEFAULT, sealIn || {});
    const N = size || 440,
      key = JSON.stringify(s) + "|" + seed + "|" + N;
    if (cache.has(key)) return cache.get(key);
    const job = (async () => {
      const c = canvas(N),
        x = c.getContext("2d"),
        cx = N / 2,
        cy = N / 2;
      const R = N * (s.shape === "drip" ? 0.36 : 0.43),
        rand = rng(seed + s.shape);
      const base = (P.sealColors[s.color] || P.sealColors.wine).c;
      const light = mix(base, "#ffffff", s.color === "black" ? 0.22 : 0.28),
        dark = mix(base, "#000000", 0.5);
      // 1 wax body
      blobPath(x, cx, cy, R, s.shape, rand);
      const g = x.createRadialGradient(
        cx - R * 0.32,
        cy - R * 0.38,
        R * 0.05,
        cx,
        cy,
        R * 1.3,
      );
      g.addColorStop(0, light);
      g.addColorStop(0.5, base);
      g.addColorStop(1, dark);
      x.fillStyle = g;
      x.fill();
      x.save();
      x.clip();
      // 2 rolled wax edge: inner shadow + lit lip
      x.filter = "blur(" + N / 60 + "px)";
      x.lineWidth = N * 0.05;
      x.strokeStyle = "rgba(0,0,0,.32)";
      x.stroke();
      x.filter = "blur(" + N / 140 + "px)";
      x.translate(-N * 0.006, -N * 0.008);
      x.lineWidth = N * 0.012;
      x.strokeStyle = "rgba(255,255,255," + (0.1 + s.gloss * 0.2) + ")";
      x.stroke();
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.filter = "none";
      // 3 pressed recess (where the stamp met the wax)
      const rr = N * 0.3;
      const g2 = x.createRadialGradient(
        cx + rr * 0.2,
        cy + rr * 0.25,
        rr * 0.1,
        cx,
        cy,
        rr * 1.05,
      );
      g2.addColorStop(0, mix(base, "#000000", 0.12));
      g2.addColorStop(1, mix(base, "#000000", 0.3));
      x.beginPath();
      x.arc(cx, cy, rr, 0, Math.PI * 2);
      x.fillStyle = g2;
      x.fill();
      x.save();
      x.beginPath();
      x.arc(cx, cy, rr, 0, Math.PI * 2);
      x.clip();
      x.filter = "blur(" + N / 90 + "px)";
      x.lineWidth = N * 0.03;
      x.strokeStyle = "rgba(0,0,0,.45)";
      x.beginPath();
      x.arc(cx + N * 0.012, cy + N * 0.014, rr, 0, Math.PI * 2);
      x.stroke();
      x.restore();
      x.filter = "blur(" + N / 200 + "px)";
      x.lineWidth = N * 0.008;
      x.strokeStyle = "rgba(255,255,255," + (0.12 + s.gloss * 0.22) + ")";
      x.beginPath();
      x.arc(cx, cy, rr + N * 0.006, Math.PI * 0.05, Math.PI * 0.95);
      x.stroke();
      x.filter = "none";
      // 4 emblem relief
      const m = Math.round(rr * 2 * 0.94);
      let mask = null;
      if (s.emblem === "image" && s.image) {
        try {
          mask = imageMask(await loadImg(s.image), m, s.invert);
        } catch {
          mask = null;
        }
      }
      if (!mask && s.emblem === "letter") mask = await letterMask(m, s.letter);
      if (!mask) mask = ringsMask(m);
      const ox = cx - m / 2,
        oy = cy - m / 2,
        d = Math.max(1.5, N / 170);
      x.save();
      x.filter = "blur(" + N / 300 + "px)";
      x.globalAlpha = 0.55;
      x.drawImage(tint(mask, "#000"), ox + d, oy + d);
      x.globalAlpha = 0.28 + s.gloss * 0.3;
      x.drawImage(tint(mask, "#fff"), ox - d * 0.8, oy - d * 0.8);
      x.restore();
      const gilt = s.gilt && s.color !== "gold";
      let face;
      if (gilt) {
        const gg = x.createLinearGradient(ox, oy, ox + m, oy + m);
        gg.addColorStop(0, "#b98a58");
        gg.addColorStop(0.5, "#efd2a0");
        gg.addColorStop(1, "#a87c50");
        face = gg;
      } else
        face =
          s.color === "gold"
            ? mix(base, "#3a2a14", 0.35)
            : mix(base, "#ffffff", 0.08);
      const fc = canvas(m),
        fx = fc.getContext("2d");
      fx.fillStyle = face;
      fx.save();
      fx.translate(-ox, -oy);
      fx.fillRect(ox, oy, m, m);
      fx.restore();
      fx.globalCompositeOperation = "destination-in";
      fx.drawImage(mask, 0, 0);
      x.globalAlpha = gilt ? 0.92 : 1;
      x.drawImage(fc, ox, oy);
      x.globalAlpha = 1;
      // 5 gloss sheen
      const sh = x.createRadialGradient(
        cx - R * 0.38,
        cy - R * 0.46,
        0,
        cx - R * 0.3,
        cy - R * 0.35,
        R * 0.75,
      );
      sh.addColorStop(
        0,
        "rgba(255,255,255," + (s.gloss * 0.42).toFixed(3) + ")",
      );
      sh.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = sh;
      x.fillRect(0, 0, N, N);
      if (s.gloss > 0.35) {
        x.fillStyle =
          "rgba(255,255,255," + ((s.gloss - 0.35) * 0.5).toFixed(3) + ")";
        x.beginPath();
        x.ellipse(
          cx - R * 0.5,
          cy - R * 0.55,
          R * 0.09,
          R * 0.05,
          -0.6,
          0,
          Math.PI * 2,
        );
        x.fill();
      }
      x.restore();
      return c.toDataURL("image/png");
    })();
    if (cache.size > 40) cache.clear();
    cache.set(key, job);
    job.catch(() => cache.delete(key));
    return job;
  }
  function sealLabel(style) {
    const s = Object.assign({}, SEAL_DEFAULT, (style && style.seal) || {});
    const c = (P.sealColors[s.color] || P.sealColors.wine).name;
    const e =
      s.emblem === "image" && s.image
        ? "手作印面"
        : s.emblem === "letter" && s.letter
          ? "印着「" + s.letter + "」"
          : "双环相扣，星辰落于其间";
    return c + "火漆 · " + e;
  }
  return {
    P,
    SEAL_DEFAULT,
    PAPER_DEFAULT,
    ENV_DEFAULT,
    styleVars,
    applyVars,
    hasSeal,
    makeSeal,
    sealLabel,
    mix,
    lum,
  };
}

export const appearance = clientStyleLib(PRESETS);
