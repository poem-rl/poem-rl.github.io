(function () {
  "use strict";
  const NAME = "figure1";
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  POEM.register(NAME, async (el, ctx) => {
    const d = ctx.data, H = ctx.h, S = ctx.svg;
    if (!d || !d.svg || !d.steps || !d.view) throw new Error("figure1 data missing");
    el.classList.add("c-" + NAME);
    el.textContent = "";
    const desc = { full: NAME + "-desc", a: NAME + "-desc-a", b: NAME + "-desc-b" };
    const stage = H("div", { class: "f1-stage" });
    const hint = H("p", { class: "f1-hint", id: NAME + "-hint" },
      "Hover or tap the numbered steps.");
    const list = H("ol", { class: "f1-steps", "aria-label": "The three steps of panel (b)" });
    el.append(H("p", { class: "f1-sr", id: desc.full }, d.alt), H("p", { class: "f1-sr", id: desc.a }, d.alt_a),
      H("p", { class: "f1-sr", id: desc.b }, d.alt_b), stage, hint, list);
    const minScale = d.min_text_px / d.min_text_units;
    const fullFits = (W) => (W * d.min_text_units) / d.view.full[2] >= d.min_text_px;

    if (fullFits(el.clientWidth)) stage.style.aspectRatio = `${d.view.full[2]} / ${d.view.full[3]}`;

    const src = el.dataset.src || "";
    const k = src.indexOf("static/");
    const base = k > 0 ? src.slice(0, k) : "";
    const res = await fetch(POEM.url(base + d.svg));
    if (!res.ok) throw new Error(`${d.svg}: HTTP ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), "image/svg+xml");
    const tpl = doc.documentElement;
    if (tpl.nodeName !== "svg" || doc.getElementsByTagName("parsererror").length) throw new Error("figure1.svg did not parse");

    const state = { active: null, mode: null, inst: [] };
    const steps = new Map(d.steps.map((s) => [s.n, { ...s, set: new Set(s.members) }]));
    const onBadge = new Set(d.steps.flatMap((s) => [s.badge, s.label]));
    const dimmable = d.panel_b.filter((id) => !onBadge.has(id));

    const A_TEXT = "Policies post-trained with RL on different rewards have nearly orthogonal parameter updates, yet their policy log-ratios span a low dimensional space.";
    const liA = H("li", { id: `${NAME}-step-a`, "data-step": "a" }, H("span", { class: "f1-n", "aria-hidden": "true" }, "a"),
      H("span", { class: "f1-txt" }, A_TEXT));
    list.append(liA);
    const items = d.steps.map((s) => {
      const pick = H("button", { type: "button", class: "f1-pick", id: `${NAME}-step-${s.n}-pick`, "aria-pressed": "false" },
        cap(s.name) + ".");
      const txt = H("span", { class: "f1-txt" }, pick, " ", H("span", { html: s.sentence }));
      const li = H("li", { id: `${NAME}-step-${s.n}`, "data-step": s.n },
        H("span", { class: "f1-n", "aria-hidden": "true" }, String(s.n)), txt);
      li.addEventListener("click", () => { stopPlay(); toggle(s.n); });
      list.append(li);
      return { li, pick };
    });

    function instance(key, vb) {
      const svg = document.importNode(tpl, true);
      const suf = "--" + key;
      svg.querySelectorAll("title, desc").forEach((n) => n.remove());
      svg.querySelectorAll("[id]").forEach((n) => { n.id = n.id + suf; });
      svg.querySelectorAll("[fill], [stroke], [style]").forEach((n) => {
        for (const a of ["fill", "stroke", "style"]) {
          const v = n.getAttribute(a);
          if (v && v.includes("url(#")) n.setAttribute(a, v.replace(/url\(#([^)]+)\)/g, `url(#$1${suf})`));
        }
      });
      svg.setAttribute("viewBox", vb.join(" "));
      for (const c of svg.children) if (c.tagName !== "defs") c.setAttribute("aria-hidden", "true");
      const byId = (id) => svg.querySelector("#" + CSS.escape(id + suf));
      return { key, svg, vb, byId, btns: [], hasB: key !== "a" };
    }

    function addButtons(inst) {
      for (const s of d.steps) {
        const marker = inst.byId(s.badge), label = inst.byId(s.label);
        const disc = marker && marker.querySelector("circle");
        if (!disc) continue;
        const cx = +disc.getAttribute("cx"), cy = +disc.getAttribute("cy"), r = +disc.getAttribute("r");
        const g = S("g", {
          id: `${NAME}-badge-${s.n}`, class: "f1-btn", tabindex: "0", role: "button", "aria-pressed": "false", "data-step": s.n,
          "aria-label": `Step ${s.n}, ${s.name}`, "aria-describedby": `${NAME}-step-${s.n}`,
        });
        marker.parentNode.insertBefore(g, marker);
        g.append(S("circle", { class: "f1-ring-on", cx, cy, r: r + 6 }), S("circle", { class: "f1-ring-focus", cx, cy, r: r + 10 }));
        if (label) g.append(label);
        g.append(marker);
        for (const n of [label, marker]) if (n) { n.removeAttribute("aria-hidden"); n.classList.add("f1-face"); }
        const bb = g.getBBox(), pad = 12;
        g.insertBefore(S("rect", { class: "f1-hit", x: bb.x - pad, y: bb.y - pad, width: bb.width + 2 * pad,
          height: bb.height + 2 * pad, rx: 10 }), g.firstChild);
        g.addEventListener("click", (e) => { e.stopPropagation(); stopPlay(); state.active = s.n; apply(); });
        g.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { state.active = s.n; apply(); } });
        g.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { state.active = null; apply(); } });
        g.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); stopPlay(); toggle(s.n); }
        });
        inst.btns.push(g);
      }
    }

    function apply() {
      const isA = state.active === "a";
      const a = state.active && !isA ? steps.get(state.active) : null;
      el.classList.toggle("f1-has-active", !!state.active);
      liA.classList.toggle("on", isA);
      for (const inst of state.inst) {
        if (!inst.hasB) continue;
        for (const id of dimmable) {
          const n = inst.byId(id);
          if (n) n.classList.toggle("f1-dim", isA || (!!a && !a.set.has(id)));
        }
        for (const g of inst.btns) {
          g.classList.toggle("f1-dim", isA);
          const on = !!a && +g.dataset.step === a.n;
          g.setAttribute("aria-pressed", String(on));
          g.classList.toggle("f1-dim-soft", !!a && !on);
        }
      }
      for (const { li, pick } of items) {
        const on = !!a && +li.dataset.step === a.n;
        li.classList.toggle("on", on);
        li.classList.toggle("off", !!a && !on);
        pick.setAttribute("aria-pressed", String(on));
      }
    }

    function toggle(n) {
      state.active = state.active === n ? null : n;
      apply();
      if (state.active && state.mode === "split") reveal(state.active);
    }

    function reveal(n) {
      const inst = state.inst.find((i) => i.hasB && i.sc);
      if (!inst) return;
      const st = steps.get(n), sc = inst.sc, box = sc.getBoundingClientRect(), pad = 8;
      let lo = Infinity, hi = -Infinity;
      for (const id of [...st.members, st.badge]) {
        const m = inst.byId(id);
        if (!m) continue;
        const r = m.getBoundingClientRect();
        if (!r.width) continue;
        lo = Math.min(lo, r.left); hi = Math.max(hi, r.right);
      }
      if (!isFinite(lo) || (lo >= box.left && hi <= box.right)) return;
      let shift;
      if (hi - lo <= box.width) shift = (lo + hi) / 2 - (box.left + box.right) / 2;
      else {
        const m = st.reveal && inst.byId(st.reveal);
        if (!m) return;
        const r = m.getBoundingClientRect();
        if (r.left >= box.left && r.right <= box.right) return;
        shift = r.width > box.width - 2 * pad || r.left < box.left ? r.left - box.left - pad : r.right - box.right + pad;
      }
      sc.scrollTo({ left: sc.scrollLeft + shift, behavior: POEM.reducedMotion() ? "auto" : "smooth" });
    }

    function edges(inst) {
      const sc = inst.sc, over = sc.scrollWidth > sc.clientWidth + 1;
      inst.hintEl.hidden = !over;
      sc.classList.toggle("more", over && sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 2);
      sc.classList.toggle("less", over && sc.scrollLeft > 2);
      if (over) sc.setAttribute("tabindex", "0"); else sc.removeAttribute("tabindex");
    }

    function size(W) {
      const s = Math.max(minScale, Math.min(W / Math.max(d.view.a[2], d.view.b[2]), d.max_split_scale || 1));
      for (const inst of state.inst) {
        inst.svg.setAttribute("width", (inst.vb[2] * s).toFixed(1));
        inst.svg.setAttribute("height", (inst.vb[3] * s).toFixed(1));
        edges(inst);
      }
    }

    function build(mode) {
      state.mode = mode;
      stage.style.aspectRatio = "";
      stage.textContent = "";
      state.inst = [];
      if (mode === "full") {
        const inst = instance("full", d.view.full);
        inst.svg.setAttribute("role", "group");
        inst.svg.setAttribute("aria-label", d.title);
        inst.svg.setAttribute("aria-describedby", desc.full);
        stage.append(H("div", { class: "f1-full" }, inst.svg));
        state.inst.push(inst);
      } else {
        for (const key of ["a", "b"]) {
          const inst = instance(key, d.view[key]);
          const which = key === "a" ? "panel (a)" : "panel (b)";
          inst.svg.setAttribute("role", key === "a" ? "img" : "group");
          inst.svg.setAttribute("aria-label", `${d.title}, ${which}`);
          inst.svg.setAttribute("aria-describedby", desc[key]);
          inst.sc = H("div", { class: "scroll-x f1-scroller", role: "group", "aria-label": cap(which) }, inst.svg);
          inst.hintEl = H("p", { class: "f1-scroll-hint", "aria-hidden": "true" }, "scroll →");
          inst.sc.addEventListener("scroll", () => edges(inst), { passive: true });
          stage.append(H("div", { class: "f1-panel" }, inst.sc, inst.hintEl));
          state.inst.push(inst);
        }
        size(el.clientWidth);
      }
      state.inst.forEach((i) => i.hasB && addButtons(i));
      apply();
    }

    function layout() {
      const W = el.clientWidth;
      if (!W) return;
      const mode = fullFits(W) ? "full" : "split";
      if (mode !== state.mode) build(mode);
      else if (mode === "split") size(W);
    }

    stage.addEventListener("click", (e) => {
      if (state.active && !e.target.closest(".f1-btn")) { stopPlay(); state.active = null; apply(); }
    });
    function stopPlay() {}
    el.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.active) { state.active = null; apply(); }
    });
    layout();
    if (window.ResizeObserver) new ResizeObserver(() => layout()).observe(el);
    else addEventListener("resize", layout);
  });
})();
