// Adapted from neardws/bday-gy-k7q4m 7771c20 src/ui/journalLayout.js. Geometry only; no content/assets.
export function createJournalLayout() {
  function boxOf(it, W) {
    const w = (it.w / 100) * W,
      ar = it.ar || 1;
    const h =
      it.t === "photo" ? w * (0.88 / ar + (it.caption ? 0.3 : 0.2)) : w / ar;
    const a = ((it.r || 0) * Math.PI) / 180;
    const scale = Math.min(
      1,
      W / (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))),
    );
    return {
      w: w * scale,
      h: h * scale,
      bw: (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) * scale,
      bh: (Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a))) * scale,
    };
  }
  // Separating-axis test of the actual rotated rectangles (touching is not overlap).
  function rotatedIntersects(a, b) {
    const quad = (q) => {
      const r = ((q.r || 0) * Math.PI) / 180,
        c = Math.cos(r),
        s = Math.sin(r);
      return [
        [-q.w / 2, -q.h / 2],
        [q.w / 2, -q.h / 2],
        [q.w / 2, q.h / 2],
        [-q.w / 2, q.h / 2],
      ].map(([x, y]) => ({
        x: q.x + q.w / 2 + x * c - y * s,
        y: q.y + q.h / 2 + x * s + y * c,
      }));
    };
    if (![a, b].every((q) => q && q.w > 0 && q.h > 0)) return false;
    const aa = quad(a),
      bb = quad(b);
    for (const q of [aa, bb])
      for (let i = 0; i < 2; i++) {
        const u = q[i],
          v = q[i + 1],
          nx = -(v.y - u.y),
          ny = v.x - u.x;
        const ap = aa.map((p) => p.x * nx + p.y * ny),
          bp = bb.map((p) => p.x * nx + p.y * ny);
        if (
          Math.max(...ap) <= Math.min(...bp) + 1e-7 ||
          Math.max(...bp) <= Math.min(...ap) + 1e-7
        )
          return false;
      }
    return true;
  }
  // DOMRect-compatible AABB test for the measured, rotated tape corners.
  function rectIntersects(a, b) {
    return (
      a.width > 0 &&
      a.height > 0 &&
      b.width > 0 &&
      b.height > 0 &&
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top
    );
  }
  // Pure default-placement helper, shared by editor add() and its unit tests.
  function freeSpot(b, placed, L) {
    let y = b.y;
    const pad = 0.4 * L;
    for (let n = 0; n <= placed.length; n++) {
      const hit = placed.find(
        (q) =>
          q.id !== b.id &&
          b.bx < q.bx + q.bw + pad &&
          b.bx + b.bw + pad > q.bx &&
          y + (b.h - b.bh) / 2 < q.by + q.bh + pad &&
          y + (b.h + b.bh) / 2 + pad > q.by,
      );
      if (!hit) break;
      y = hit.by + hit.bh + pad + (b.bh - b.h) / 2;
    }
    return { x: b.x, y };
  }
  function endingNote(it, ref) {
    return it.t === "easter" && ref?.t === "ending" && autoNote(it);
  }
  // Auto-placed easter note (migration flag, or the untouched pre-flag signature). It is never
  // "浮于文字上": only a mode explicitly chosen by the writer (which drops autoPlace) may cover text.
  function autoNote(it) {
    return (
      it.t === "easter" &&
      (it.autoPlace === "ending" ||
        (it.mode === "over" &&
          it.x === 76 &&
          it.w === 18 &&
          it.r === -6 &&
          it.dy === -0.4))
    );
  }
  const closing = /[，。、；：？！】〕］｝〉》」』”’）·…—、]/u,
    opening = /[【〔［｛〈《「『“‘（]/u;
  function breakText(text, width, measure) {
    const cs = Array.from(text);
    let n = 0;
    while (
      n < cs.length &&
      cs[n] !== "\n" &&
      measure(cs.slice(0, n + 1).join("")) <= width + 1e-7
    )
      n++;
    if (!n) return { text: "", rest: text, newline: false };
    if (
      n < cs.length &&
      /[a-zA-Z0-9]/.test(cs[n]) &&
      /[a-zA-Z0-9]/.test(cs[n - 1])
    ) {
      let start = n;
      while (start && /[a-zA-Z0-9]/.test(cs[start - 1])) start--;
      let end = n;
      while (end < cs.length && /[a-zA-Z0-9]/.test(cs[end])) end++;
      if (start || measure(cs.slice(0, end).join("")) <= width) n = start;
    }
    while (
      n > 0 &&
      (opening.test(cs[n - 1]) || (n < cs.length && closing.test(cs[n])))
    )
      n--;
    if (!n) return { text: "", rest: text, newline: false };
    const newline = cs[n] === "\n";
    return {
      text: cs.slice(0, n).join(""),
      rest: cs.slice(n + (newline ? 1 : 0)).join(""),
      newline,
    };
  }
  function layout(paras, items, opt, measure) {
    items = items.map((it) =>
      autoNote(it) && it.mode === "over"
        ? Object.assign({}, it, { mode: "wrap", autoPlace: "ending" })
        : it,
    );
    const W = opt.W,
      L = opt.L,
      gap = opt.gap == null ? 10.8 : opt.gap,
      minW = opt.minW == null ? 126 : opt.minW;
    const anchors = [],
      placed = [],
      lines = [],
      bands = [];
    const order = items
      .map((it, i) => i)
      .sort(
        (a, b) =>
          Number(items[a].id === opt.lastId) -
          Number(items[b].id === opt.lastId),
      );
    let y = 0,
      finishing = false;
    // Activate at the paragraph anchor; forward references are resolved recursively.
    const byId = new Map(items.map((it, i) => [it.id, i]));
    const cyclic = new Set();
    items.forEach((it, i) => {
      const path = [];
      let k = i;
      while (k != null && !path.includes(k)) {
        path.push(k);
        k = byId.get(items[k].ref);
      }
      if (k != null) path.slice(path.indexOf(k)).forEach((j) => cyclic.add(j));
    });
    function place(i, visiting) {
      if (placed[i]) return placed[i];
      const it = items[i],
        pi = Math.max(0, Math.min(paras.length - 1, it.pi || 0));
      if (anchors[pi] == null) return null;
      visiting = visiting || new Set();
      visiting.add(i);
      let base = anchors[pi];
      const ri = byId.get(it.ref);
      if (ri != null && !cyclic.has(i) && !visiting.has(ri)) {
        const ref = place(ri, new Set(visiting));
        if (ref)
          base = endingNote(it, items[ri])
            ? ref.y
            : Math.max(base, ref.by + ref.bh); // never above its own paragraph anchor: text before it is already laid out
      }
      if (finishing && (it.t === "ending" || it.t === "locked"))
        base = Math.max(base, y);
      const b = boxOf(it, W),
        pad = 0.4 * L;
      const at = (x, top) =>
        Object.assign(
          {
            id: it.id,
            base,
            r: it.r || 0,
            x: Math.max((b.bw - b.w) / 2, Math.min(W - (b.bw + b.w) / 2, x)),
            y: top,
          },
          b,
        );
      const bounds = (q) =>
        Object.assign(q, {
          bx: q.x + (q.w - q.bw) / 2,
          by: q.y + (q.h - q.bh) / 2,
        });
      let q = bounds(at((it.x / 100) * W, base + (it.dy || 0) * L));
      const original = { x: q.x, y: q.y };
      const blockers = placed.filter((p, j) => p && items[j].mode !== "over");
      const hits = (a, b) => {
        if (
          a.bx >= b.bx + b.bw + pad - 1e-7 ||
          a.bx + a.bw + pad <= b.bx + 1e-7 ||
          a.by >= b.by + b.bh + pad - 1e-7 ||
          a.by + a.bh + pad <= b.by + 1e-7
        )
          return false;
        const quad = (b) => {
          const r = (b.r * Math.PI) / 180,
            c = Math.cos(r),
            s = Math.sin(r);
          return [
            [-b.w / 2, -b.h / 2],
            [b.w / 2, -b.h / 2],
            [b.w / 2, b.h / 2],
            [-b.w / 2, b.h / 2],
          ].map(([x, y]) => ({
            x: b.x + b.w / 2 + x * c - y * s,
            y: b.y + b.h / 2 + x * s + y * c,
          }));
        };
        const aa = quad(a),
          bb = quad(b);
        for (const q of [aa, bb])
          for (let i = 0; i < 2; i++) {
            const u = q[i],
              v = q[i + 1],
              len = Math.hypot(v.x - u.x, v.y - u.y),
              nx = -(v.y - u.y) / len,
              ny = (v.x - u.x) / len;
            const ap = aa.map((p) => p.x * nx + p.y * ny),
              bp = bb.map((p) => p.x * nx + p.y * ny);
            if (
              Math.max(...ap) + pad <= Math.min(...bp) + 1e-7 ||
              Math.max(...bp) + pad <= Math.min(...ap) + 1e-7
            )
              return false;
          }
        return true;
      };
      const ending =
        ri != null && endingNote(it, items[ri]) ? placed[ri] : null;
      if (it.mode !== "over" || ending) {
        const obstacles = ending ? placed.filter(Boolean) : blockers;
        for (let n = 0; n < obstacles.length * 3 + 3; n++) {
          const hit = obstacles.find((p) => hits(q, p));
          if (!hit) {
            // Rotation and dy can reach into text emitted before activation.
            // Apply the flow floor after collision resolution and horizontal
            // clamping, then check collisions again at the corrected position.
            if (it.mode !== "over" && q.by < y) {
              q = bounds(at(q.x, y + (b.bh - b.h) / 2));
              continue;
            }
            break;
          }
          const sides = [
            hit.bx + hit.bw + pad + (b.bw - b.w) / 2,
            hit.bx - pad - (b.bw + b.w) / 2,
          ];
          const free = sides
            .map((x) => bounds(at(x, q.y)))
            .find((c) => !obstacles.some((p) => hits(c, p)));
          q = free || bounds(at(q.x, hit.by + hit.bh + pad + (b.bh - b.h) / 2)); // never upward: text above is already laid out
        }
      }
      if (it.mode !== "over" && q.by < y)
        q = bounds(at(q.x, y + (b.bh - b.h) / 2));
      q.resolved =
        Math.abs(q.x - original.x) > 0.01 || Math.abs(q.y - original.y) > 0.01;
      return (placed[i] = q);
    }
    function obstacles(top, h) {
      return placed
        .map((b, i) =>
          b &&
          items[i].mode !== "over" &&
          b.by - gap < top + h &&
          b.by + b.bh + gap > top
            ? { b, mode: items[i].mode }
            : null,
        )
        .filter(Boolean);
    }
    function freeIntervals(top, h) {
      let intervals = [[0, W]];
      obstacles(top, h).forEach((o) => {
        const left = o.mode === "break" ? 0 : Math.max(0, o.b.bx - gap),
          right = o.mode === "break" ? W : Math.min(W, o.b.bx + o.b.bw + gap);
        if (right <= left) return;
        intervals = intervals.flatMap((v) =>
          right <= v[0] || left >= v[1]
            ? [v]
            : [
                [v[0], Math.max(v[0], left)],
                [Math.min(v[1], right), v[1]],
              ],
        );
      });
      return intervals;
    }
    for (let pi = 0; pi < paras.length; pi++) {
      if (pi === 0) {
        anchors[0] = 0;
        items.forEach((it, i) => {
          if (it.t === "hero") {
            anchors[0] = y;
            const b = place(i);
            y = Math.max(y, b.by + b.bh + gap);
          }
        });
      }
      anchors[pi] = y;
      order.forEach((i) => {
        const it = items[i];
        if (
          !endingNote(it, items[byId.get(it.ref)]) &&
          (it.pi || 0) <= pi &&
          !(it.t === "ending" && it.mode === "break") &&
          it.t !== "locked"
        )
          place(i);
      });
      const p = paras[pi],
        start = y;
      if (p.hidden) {
        if (p.collapsed && !p.revealed) {
          bands.push({ pi, y, h: 0, x: 0, w: W });
          continue;
        }
        let h = Math.max(L, Math.ceil((p.h || L) / L) * L),
          interval;
        for (;;) {
          interval = freeIntervals(y, h).sort(
            (a, b) => b[1] - b[0] - (a[1] - a[0]),
          )[0];
          if (
            !interval ||
            interval[1] - interval[0] < Math.max(Math.min(minW, W), W * 0.45)
          ) {
            y += L;
            continue;
          }
          const needed = opt.hiddenHeight
            ? Math.max(
                L,
                Math.ceil(opt.hiddenHeight(pi, interval[1] - interval[0]) / L) *
                  L,
              )
            : h;
          if (needed > h) {
            h = needed;
            continue;
          }
          break;
        }
        bands.push({ pi, y, h, x: interval[0], w: interval[1] - interval[0] });
        y += h;
        continue;
      }
      let rest = String(p.text || ""),
        first = true;
      if (!rest && opt.edit) {
        bands.push({ pi, y, h: L, x: opt.indent || 0, w: W - (opt.indent || 0) });
        y += L;
        continue;
      }
      while (rest.length) {
        let intervals = freeIntervals(y, L);
        intervals = intervals.filter((v) => v[1] - v[0] >= Math.min(minW, W));
        const segs = [];
        if (rest[0] === "\n" && intervals.length) {
          rest = rest.slice(1);
          first = false;
          y += L;
          continue;
        }
        for (const v of intervals) {
          const x = v[0] + (first ? opt.indent || 0 : 0),
            w = v[1] - x;
          const part = breakText(rest, w, measure);
          if (!part.text) continue;
          segs.push({ x, w, text: part.text, first, last: !part.rest });
          first = false;
          rest = part.rest;
          if (!rest || part.newline) break;
        }
        if (segs.length) lines.push({ pi, y, segs });
        // Impossible glyph/kinsoku clusters must not cause an infinite layout.
        if (!segs.length && !obstacles(y, L).length)
          throw new RangeError("Text cluster exceeds usable line width");
        y += L;
      }
      bands.push({ pi, y: start, h: y - start });
    }
    y = Math.max(y, ...placed.filter(Boolean).map((b) => b.by + b.bh));
    finishing = true;
    items.forEach((it, i) => {
      if (!placed[i]) {
        anchors[Math.max(0, Math.min(paras.length - 1, it.pi || 0))] = y;
        const b = place(i);
        if (b) y = Math.max(y, b.by + b.bh + gap);
      }
    });
    const height =
      Math.ceil(
        Math.max(
          y,
          ...placed
            .filter(Boolean)
            .map((b) => Math.max(b.y + b.h, b.by + b.bh)),
        ) / L,
      ) * L;
    return { lines, items: placed, paras: bands, height };
  }
  return {
    layout,
    boxOf,
    breakText,
    freeSpot,
    rotatedIntersects,
    rectIntersects,
  };
}
