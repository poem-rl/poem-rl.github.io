(function () {
  "use strict";
  const NAME = "space3d";
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
  const VIEW0 = { yaw: -0.62, pitch: 0.36 };
  const DOT_SCALE = 0.55;

  async function mountOne(el, ctx) {
    const d = ctx.data, S = ctx.svg, H = ctx.h, fmt = ctx.fmt;
    el.classList.add("c-" + NAME);
    el.textContent = "";
    const view = { ...VIEW0 };
    const st = { dots: true, spin: false, hover: null, raf: 0, last: 0 };

    const bSpin = H("button", { type: "button", class: "s3-btn", "aria-pressed": "false" }, "Spin");
    const bReset = H("button", { type: "button", class: "s3-btn" }, "Reset view");
    const cbId = NAME + "-dots";
    const cb = H("input", { type: "checkbox", id: cbId, checked: true });
    const ctl = H("div", { class: "s3-ctl" }, bSpin, bReset, H("label", { class: "ctl", for: cbId }, cb, "responses"));
    const grid = H("div", { class: "s3-grid" });
    const out = H("p", { class: "readout", "aria-live": "polite" });
    el.append(ctl, grid, out);

    const panels = d.spaces.map((sp) => {
      const card = H("div", { class: "s3-card s3-" + sp.key });
      const head = H("div", { class: "s3-head" });
      head.innerHTML = `<b>${esc(sp.name)}</b><span>${sp.key === "R" ? "the experts’ rewards" : "the experts’ log-ratios"}</span>` +
        `<span class="s3-share">three directions hold <b>${Math.round(100 * sp.share3)}%</b> of the variation</span>`;
      const svg = S("svg", { class: "s3-svg", role: "img", tabindex: 0,
        "aria-label": `${sp.name}: the ${d.n_experts} experts as arrows along the three directions of most variation, which hold ${Math.round(100 * sp.share3)} percent of it. Arrow keys rotate the view.` });
      card.append(head, svg);
      grid.append(card);
      return { sp, svg, card, W: 0, H: 0, tips: [] };
    });

    function rot(p) {
      const [x, y, z] = p, cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
      const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
      const y2 = cp * y - sp * z1, z2 = sp * y + cp * z1;
      return [x1, y2, z2];
    }

    const P3 = (a) => [a[0], a[1], a[2]];

    function draw(pn) {
      const W = Math.max(240, Math.round(pn.card.clientWidth)), Hh = Math.round(W * 0.86);
      pn.W = W; pn.H = Hh;
      const svg = pn.svg, cx = W / 2, cyy = Hh * 0.53, s = Math.min(W, Hh) * 0.37;
      svg.setAttribute("viewBox", `0 0 ${W} ${Hh}`); svg.setAttribute("width", W); svg.setAttribute("height", Hh);
      svg.textContent = "";
      const scr = (p) => { const r = rot(p); return { x: cx + s * r[0], y: cyy - s * r[1], z: r[2] }; };
      const g = S("g", {});

      g.append(S("circle", { cx, cy: cyy, r: s, class: "s3-unit" }));

      const L = 1.25;
      ["1", "2", "3"].forEach((lab, i) => {
        const a = [0, 0, 0], b = [0, 0, 0]; a[i] = -L; b[i] = L;
        const A = scr(a), B = scr(b);
        g.append(S("line", { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: "s3-axis" }));
        const T = scr(b.map((v) => v * 1.09));
        g.append(S("text", { x: T.x, y: T.y + 4, class: "s3-axlbl", "text-anchor": "middle", text: lab }));
      });

      if (st.dots) {
        const gd = S("g", { class: "s3-dots" });
        for (const p of pn.sp.dots) {
          const q = scr(P3(p).map((v) => v * DOT_SCALE));
          gd.append(S("circle", { cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: 1.5 }));
        }
        g.append(gd);
      }

      const arr = pn.sp.arrows.map((a, i) => ({ i, o: scr([0, 0, 0]), t: scr(P3(a)), z: rot(P3(a))[2] }));
      arr.sort((p, q) => p.z - q.z);
      const zs = arr.map((a) => a.z), zmin = Math.min(...zs), zmax = Math.max(...zs);
      const ga = S("g", { class: "s3-arrows" });
      pn.tips = [];
      for (const a of arr) {
        const depth = zmax > zmin ? (a.z - zmin) / (zmax - zmin) : 1;
        const on = st.hover === a.i;
        const op = st.hover == null ? 0.45 + 0.55 * depth : on ? 1 : 0.18;
        const gi = S("g", { class: "s3-arrow" + (on ? " on" : ""), style: `opacity:${op.toFixed(2)}` });
        gi.append(S("line", { x1: a.o.x, y1: a.o.y, x2: a.t.x, y2: a.t.y }));
        gi.append(S("circle", { cx: a.t.x, cy: a.t.y, r: on ? 4.2 : 3 }));
        ga.append(gi);
        pn.tips.push({ i: a.i, x: a.t.x, y: a.t.y });
      }
      g.append(ga);
      if (st.hover != null) {
        const t = pn.tips.find((q) => q.i === st.hover);
        const lab = d.experts[st.hover].label;
        const right = t.x < W - 120;
        g.append(S("text", { x: t.x + (right ? 8 : -8), y: t.y - 7, class: "s3-name", "text-anchor": right ? "start" : "end", text: lab }));
      }
      g.append(S("circle", { cx, cy: cyy, r: 2.6, class: "s3-origin" }));
      svg.append(g);
    }
    const drawAll = () => panels.forEach(draw);

    function setHover(i) {
      if (st.hover === i) return;
      st.hover = i;
      drawAll();
      if (i == null) { out.textContent = ""; return; }
      const parts = panels.map((pn) => `${pn.sp.name}: ${Math.round(100 * pn.sp.in3[i])}% of its variation in these three directions`);
      out.textContent = `${d.experts[i].label}. ${parts.join("; ")}.`;
    }
    panels.forEach((pn) => {
      const svg = pn.svg;
      let drag = null;
      const local = (e) => { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left) * pn.W / r.width, y: (e.clientY - r.top) * pn.H / r.height }; };
      svg.addEventListener("pointerdown", (e) => {
        drag = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch, id: e.pointerId, moved: false };
        svg.setPointerCapture?.(e.pointerId);
      });
      svg.addEventListener("pointermove", (e) => {
        if (drag) {
          const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
          view.yaw = drag.yaw + dx * 0.01;
          if (e.pointerType === "mouse") view.pitch = Math.max(-1.45, Math.min(1.45, drag.pitch + dy * 0.01));
          drawAll();
          return;
        }
        if (e.pointerType !== "mouse") return;
        const p = local(e);
        let best = null, bd = 14;
        for (const t of pn.tips) { const dd = Math.hypot(t.x - p.x, t.y - p.y); if (dd < bd) { bd = dd; best = t.i; } }
        setHover(best);
        if (best != null) {
          const r = svg.getBoundingClientRect(), t = pn.tips.find((q) => q.i === best);
          ctx.tip.show(tipHTML(best), r.left + t.x * r.width / pn.W, r.top + t.y * r.height / pn.H);
        } else ctx.tip.hide();
      });
      const end = (e) => {
        if (drag && !drag.moved && e.pointerType !== "mouse") {
          const p = local(e);
          let best = null, bd = 22;
          for (const t of pn.tips) { const dd = Math.hypot(t.x - p.x, t.y - p.y); if (dd < bd) { bd = dd; best = t.i; } }
          setHover(best);
        }
        drag = null;
      };
      svg.addEventListener("pointerup", end);
      svg.addEventListener("pointercancel", () => { drag = null; });
      svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !drag) { setHover(null); ctx.tip.hide(); } });
      svg.addEventListener("keydown", (e) => {
        const k = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[e.key];
        if (!k) return;
        e.preventDefault();
        view.yaw += k[0]; view.pitch = Math.max(-1.45, Math.min(1.45, view.pitch + k[1]));
        drawAll();
      });
    });
    function tipHTML(i) {
      const rows = panels.map((pn) => `<tr><td>${esc(pn.sp.name)}</td><td><b>${Math.round(100 * pn.sp.in3[i])}%</b></td></tr>`).join("");
      return `<div class="c-space3d-tip"><b>${esc(d.experts[i].label)}</b> expert<div class="mut">share of its variation in the three directions shown</div><table>${rows}</table></div>`;
    }

    bReset.addEventListener("click", () => { Object.assign(view, VIEW0); setSpin(false); drawAll(); });
    cb.addEventListener("change", () => { st.dots = cb.checked; drawAll(); });
    function setSpin(on) {
      st.spin = on; bSpin.setAttribute("aria-pressed", on ? "true" : "false");
      cancelAnimationFrame(st.raf); st.last = 0;
      if (on) st.raf = requestAnimationFrame(tick);
    }
    function tick(ts) {
      if (!st.spin) return;
      if (st.last) view.yaw += Math.min(64, ts - st.last) * 0.00035;
      st.last = ts;
      drawAll();
      st.raf = requestAnimationFrame(tick);
    }
    bSpin.addEventListener("click", () => setSpin(!st.spin));

    drawAll();
    if (typeof ResizeObserver !== "undefined") {
      let raf = 0, w0 = 0;
      new ResizeObserver(() => {
        const w = grid.clientWidth; if (w === w0) return; w0 = w;
        cancelAnimationFrame(raf); raf = requestAnimationFrame(drawAll);
      }).observe(grid);
    }
  }

  POEM.register(NAME, async (el, ctx) => {
    const d = ctx.data;
    if (!d.bases) return mountOne(el, ctx);
    el.classList.add("c-" + NAME);
    el.textContent = "";
    const H = ctx.h;
    const seg = H("div", { class: "seg s3-basis", role: "group", "aria-label": "Basis" });
    const sub = H("div", {});
    el.append(H("div", { class: "s3-top" }, H("span", { class: "s3-lab" }, "Basis"), seg), sub);
    const btns = d.bases.map((b, i) => {
      const bt = H("button", { type: "button", "aria-pressed": i === 0 ? "true" : "false" }, b.name);
      bt.addEventListener("click", () => show(i));
      seg.append(bt);
      return bt;
    });
    let cur = -1;
    function show(i) {
      if (i === cur) return;
      cur = i;
      btns.forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));
      const box = H("div", {});
      sub.replaceChildren(box);
      mountOne(box, { ...ctx, data: d.bases[i] });
    }
    show(0);
  });
})();
