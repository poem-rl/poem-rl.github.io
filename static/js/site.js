(function () {
  document.documentElement.setAttribute("data-theme", "light");
  const POEM = (window.POEM = window.POEM || {});
  const registry = {};

  POEM.url = (p) => p;

  const cache = {};
  POEM.fetchJSON = (p) => (cache[p] = cache[p] || fetch(POEM.url(p)).then((r) => {
    if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
    return r.json();
  }));

  const katexHtml = (id) => {
    const t = (window.POEM_TEX || {})[id];
    if (!t || !window.katex) return "";
    try {
      return window.katex.renderToString(t.tex, { displayMode: t.display, throwOnError: true, output: "htmlAndMathml",
        strict: "ignore", trust: (c) => c.command === "\\htmlClass" });
    } catch (e) { console.warn("KaTeX", id, e); return ""; }
  };
  POEM.math = (id) => {
    const s = katexHtml(id) || (window.POEM_MATH || {})[id];
    if (!s) console.warn("missing equation", id);
    return s || "";
  };

  function placeInlineTex(root) {
    if (!window.katex) return;
    root.querySelectorAll("span.tex[data-tex]").forEach((el) => {
      if (el.dataset.done) return;
      try {
        window.katex.render(el.dataset.tex, el, { displayMode: false, throwOnError: true, output: "htmlAndMathml", strict: "ignore",
          trust: (c) => c.command === "\\htmlClass" });
        el.dataset.done = "1";
      } catch (e) { console.warn("KaTeX inline", el.dataset.tex, e); el.textContent = el.dataset.tex; }
    });
  }
  function placeMath(root) {
    placeInlineTex(root);
    root.querySelectorAll("[data-eq]").forEach((el) => {
      if (el.dataset.done) return;
      const s = POEM.math(el.dataset.eq);
      const n = el.dataset.eqNarrow && POEM.math(el.dataset.eqNarrow);
      if (s) {
        el.innerHTML = n ? `<span class="eq-wide">${s}</span><span class="eq-narrow">${n}</span>` : s;
        el.dataset.done = "1";
      }
    });
  }
  POEM.placeMath = placeMath;

  POEM.h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  };
  const SVGNS = "http://www.w3.org/2000/svg";
  POEM.svg = (tag, attrs = {}, ...kids) => {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c) el.append(c);
    return el;
  };

  POEM.fmt = (v, d = 2) => (v == null || Number.isNaN(v) ? "–" : Number(v).toFixed(d).replace("-", "−"));
  POEM.pct = (v, d = 0) => (v == null ? "–" : (100 * v).toFixed(d) + "%");

  let tipEl = null;
  POEM.tip = {
    show(html, x, y) {
      if (!tipEl) { tipEl = POEM.h("div", { class: "tip", role: "tooltip" }); document.body.append(tipEl); }
      tipEl.innerHTML = html; tipEl.hidden = false;
      const r = tipEl.getBoundingClientRect(), pad = 12;
      let left = x + pad, top = y + pad;
      if (left + r.width > innerWidth - 8) left = x - r.width - pad;
      if (top + r.height > innerHeight - 8) top = y - r.height - pad;
      tipEl.style.left = Math.max(8, left) + "px"; tipEl.style.top = Math.max(8, top) + "px";
    },
    hide() { if (tipEl) tipEl.hidden = true; },
  };
  addEventListener("scroll", () => POEM.tip.hide(), { passive: true });

  const themeCbs = [];
  POEM.onTheme = (cb) => themeCbs.push(cb);
  const fire = () => themeCbs.forEach((cb) => { try { cb(); } catch (e) { console.error(e); } });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", fire);
  new MutationObserver(fire).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  POEM.cssVar = (name, el = document.documentElement) => getComputedStyle(el).getPropertyValue(name).trim();

  POEM.reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  POEM.register = (name, mount) => {
    registry[name] = mount;
    if (document.readyState !== "loading") mountAll(name);
  };
  function mountAll(only) {
    document.querySelectorAll("[data-component]").forEach(async (el) => {
      const name = el.dataset.component;
      if ((only && name !== only) || el.dataset.mounted || !registry[name]) return;

      const closed = el.closest("details:not([open])");
      if (closed) {
        if (!closed.dataset.lazy) {
          closed.dataset.lazy = "1";
          closed.addEventListener("toggle", () => { if (closed.open) mountAll(); });
        }
        return;
      }
      el.dataset.mounted = "1";
      try {
        const data = el.dataset.src ? await POEM.fetchJSON(el.dataset.src) : null;
        await registry[name](el, { data, math: POEM.math, tip: POEM.tip, fmt: POEM.fmt, svg: POEM.svg, h: POEM.h });
        placeMath(el);
      } catch (err) {
        console.error(name, err);
        el.append(POEM.h("p", { class: "hint" }, `This figure could not load (${err.message}). Reload the page to try again.`));
      }
    });
  }

  function copyBib(btn) {
    const pre = document.getElementById("bibtex-code");
    const done = (msg) => { const s = btn.querySelector(".lbl"); const orig = s.dataset.orig || (s.dataset.orig = s.textContent); s.textContent = msg; setTimeout(() => (s.textContent = orig), 1800); };
    try {
      navigator.clipboard.writeText(pre.innerText).then(() => done("Copied"), () => { selectText(pre); done("Selected: press Ctrl/⌘ C"); });
    } catch (e) { selectText(pre); done("Selected: press Ctrl/⌘ C"); }
  }
  function selectText(el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }

  function init() {
    placeMath(document);
    mountAll();
    const b = document.getElementById("copy-bib");
    if (b) b.addEventListener("click", () => copyBib(b));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
