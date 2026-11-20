(function () {
  "use strict";
  const pct = (v) => `${Math.round(100 * v)}%`;
  const LEG = (H) => {
    const p = H("p", { class: "rd-legend" });
    p.innerHTML = `<span class="rd-key R"></span>reward, predicted from the other nine rewards ` +
      `<span class="rd-key P"></span>policy (log-ratio), predicted from the other nine log-ratios`;
    return p;
  };
  function observe(el, fn) {
    let w0 = 0, raf = 0;
    if (window.ResizeObserver) new ResizeObserver(() => { const w = el.clientWidth; if (w === w0) return; w0 = w; cancelAnimationFrame(raf); raf = requestAnimationFrame(fn); }).observe(el);
  }

  POEM.register("rmdiv_dumbbell", async (el, ctx) => {
    const d = ctx.data, S = ctx.svg, H = ctx.h;
    el.classList.add("c-rmdiv"); el.textContent = "";
    const ex = d.experts.slice().sort((a, b) => (b.policy - b.reward) - (a.policy - a.reward));
    const list = H("div", { class: "rd-list" }), side = H("div", { class: "rd-side" });
    el.append(H("div", { class: "rd-split" }, list, side), LEG(H));
    let cur = 0;
    function drawList() {
      const W = Math.max(280, list.clientWidth || 420), lw = 112, rh = 20, mt = 24, Ht = mt + ex.length * rh + 8;
      const X = (v) => lw + v * (W - lw - 14);
      const svg = S("svg", { class: "chart", viewBox: `0 0 ${W} ${Ht}`, width: W, height: Ht, role: "img",
        "aria-label": "For each RM-Div expert, the share of its reward and of its policy that the other nine predict" });
      for (const v of [0, 0.25, 0.5, 0.75, 1]) {
        svg.append(S("line", { x1: X(v), x2: X(v), y1: mt - 6, y2: Ht - 6, class: "grid" }),
          S("text", { x: X(v), y: mt - 12, class: "tk", "text-anchor": "middle", text: v === 0 ? "0" : v === 1 ? "100%" : pct(v) }));
      }
      ex.forEach((e, i) => {
        const y = mt + i * rh + rh / 2, on = i === cur;
        const g = S("g", { class: "rd-row" + (on ? " on" : "") });
        g.append(S("rect", { x: 0, y: y - rh / 2, width: W, height: rh, class: "rd-rowbg" }),
          S("text", { x: lw - 10, y: y + 4, class: "rd-rl", "text-anchor": "end", text: e.label }),
          S("line", { x1: X(e.reward), x2: X(e.policy) - 6, y1: y, y2: y, class: "rd-arrow" }),
          S("path", { d: `M${X(e.policy) - 2},${y}l-7,-4v8z`, class: "rd-head" }),
          S("circle", { cx: X(e.reward), cy: y, r: 4, class: "rd-dot R" }), S("circle", { cx: X(e.policy), cy: y, r: 4, class: "rd-dot P" }));
        g.addEventListener("pointerenter", () => { cur = i; drawList(); drawSide(); });
        g.addEventListener("click", () => { cur = i; drawList(); drawSide(); });
        svg.append(g);
      });
      list.replaceChildren(svg);
    }
    function scatter(pts, r2, kind, w) {
      const m = 22, s = w - m - 6, lim = 2.6, X = (v) => m + ((Math.max(-lim, Math.min(lim, v)) + lim) / (2 * lim)) * s,
        Y = (v) => 6 + s - ((Math.max(-lim, Math.min(lim, v)) + lim) / (2 * lim)) * s;
      const svg = S("svg", { class: "chart rd-sc", viewBox: `0 0 ${w} ${w + 18}`, width: w, height: w + 18, role: "img",
        "aria-label": `${kind}: actual against predicted from the other nine experts, R squared ${r2.toFixed(2)}` });
      svg.append(S("rect", { x: m, y: 6, width: s, height: s, class: "rd-frame" }), S("line", { x1: X(-lim), y1: Y(-lim), x2: X(lim), y2: Y(lim), class: "rd-diag" }));
      const g = S("g", { class: "rd-pts " + (kind === "reward" ? "R" : "P") });
      for (const [f, a] of pts) g.append(S("circle", { cx: X(f).toFixed(1), cy: Y(a).toFixed(1), r: 1.6 }));
      svg.append(g, S("text", { x: m + 6, y: 20, class: "rd-r2", text: `R² = ${r2.toFixed(2)}` }),
        S("text", { x: m + s / 2, y: w + 14, class: "tk", "text-anchor": "middle", text: "predicted from the other nine" }));
      return svg;
    }
    function drawSide() {
      const e = ex[cur], w = Math.max(130, Math.min(190, (side.clientWidth || 360) / 2 - 8));
      const head = H("p", { class: "rd-sidehead" }); head.innerHTML = `<b>${e.label}</b> held out`;
      const a = H("div", { class: "rd-cell" }, H("span", { class: "rd-cap" }, "its reward"), scatter(e.points.reward, e.reward, "reward", w));
      const b = H("div", { class: "rd-cell" }, H("span", { class: "rd-cap" }, "its policy (log-ratio)"), scatter(e.points.policy, e.policy, "policy", w));
      side.replaceChildren(head, H("div", { class: "rd-pair" }, a, b));
    }
    drawList(); drawSide(); observe(list, () => { drawList(); drawSide(); });
  });

})();
