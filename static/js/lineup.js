(function () {
  "use strict";
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
  const typeset = (s) => esc(s).replace(/([πγ])_(tar|ref|geom)\b/g, "$1<sub>$2</sub>");
  const OPEN = 460;

  function render(text, marks, from, to, inline) {
    const cuts = [...new Set(marks.flatMap((m) => [m[0], m[1]]))].filter((c) => c > from && c < to).sort((a, b) => a - b);
    let out = "", open = null, sp = true, pos = 0;
    const close = () => { if (open) { out += "</mark>"; open = null; } };
    const emit = (a, b, bold) => {
      a = Math.max(a, from); b = Math.min(b, to);
      if (a >= b) return;
      const pts = [a, ...cuts.filter((c) => c > a && c < b), b];
      for (let k = 0; k + 1 < pts.length; k++) {
        const s = text.slice(pts[k], pts[k + 1]);
        if (/^\s+$/.test(s)) { close(); if (inline) { if (!sp) out += " "; sp = true; } else out += s; continue; }
        const mk = marks.find((m) => pts[k] >= m[0] && pts[k + 1] <= m[1]);
        if (mk !== open) { close(); if (mk) { out += `<mark class="ln-${mk[2]}">`; open = mk; } }
        out += bold ? `<b>${esc(s)}</b>` : esc(s);
        sp = /\s$/.test(s);
      }
    };
    const md = (h, at) => { if (at >= from && at < to) { close(); out += `<span class="ln-md">${h}</span>`; sp = false; } };
    const lines = text.split("\n");
    lines.forEach((line, li) => {
      let i = 0, bold = false, head = false;
      const m = /^(\s*)(#{1,6}\s+|[-*•+]\s+|\d+[.)]\s+|-{3,}\s*$)?/.exec(line);
      if (m[1]) { if (!inline) emit(pos, pos + m[1].length, false); i = m[1].length; }
      if (m[2]) {
        if (m[2][0] === "#") head = true;
        else if (/^-{3,}/.test(m[2])) { if (!inline) md("———", pos + i); }
        else if (/^[-*•+]/.test(m[2])) md("• ", pos + i);
        else md(esc(m[2].trim()) + " ", pos + i);
        i += m[2].length;
      }
      const re = /\*\*/g;
      re.lastIndex = i;
      let mm;
      while ((mm = re.exec(line))) {
        if (mm.index > i) emit(pos + i, pos + mm.index, bold || head);
        bold = !bold; i = mm.index + 2;
      }
      if (i < line.length) emit(pos + i, pos + line.length, bold || head);
      if (li < lines.length - 1 && pos + line.length >= from && pos + line.length < to) {
        close();
        if (inline) { if (!sp) out += " "; sp = true; } else out += "\n";
      }
      pos += line.length + 1;
    });
    close();
    return out;
  }
  function cutAt(text, a) {
    const n = a + OPEN;
    if (text.length <= n) return text.length;
    const c = Math.max(text.lastIndexOf(" ", n), text.lastIndexOf("\n", n));
    return c > a + OPEN * 0.6 ? c : n;
  }
  const signed = (v) => (v < 0 ? "−" : "+") + Math.abs(v).toFixed(2);

  POEM.register("lineup", async (el, ctx) => {
    const cases = ctx.data.sets[el.dataset.set];
    if (!cases) throw new Error("lineup: unknown set " + el.dataset.set);
    el.classList.add("c-lineup");
    let ci = 0;
    const openRows = new Set();

    function draw() {
      const c = cases[ci], rows = c.rows;
      const max = Math.max(1.1, ...rows.map((r) => r.relkl));
      const pick = cases.length > 1
        ? `<div class="ln-pick"><button type="button" class="ln-cur" aria-haspopup="listbox" aria-expanded="false">` +
          `<span class="ln-q">${esc(c.prompt)}</span><span class="ln-chev" aria-hidden="true">▾</span></button>` +
          `<ul class="ln-menu" role="listbox" hidden>${cases.map((k, i) =>
            `<li role="option" tabindex="-1" data-tab="${i}" aria-selected="${i === ci}">${esc(k.prompt)}</li>`).join("")}</ul></div>`
        : `<p class="ln-prompt">${esc(c.prompt)}</p>`;
      const row = (r, i) => {
        const marks = r.marks.map((m) => [m[0], m[1], "m"]).concat((r.bold || []).map((m) => [m[0], m[1], "b"]));
        const full = openRows.has(i), a = r.open_at || 0;
        const txt = full ? render(r.text, marks, 0, r.text.length, false) + (r.eos ? "" : '\n<span class="ln-md">[stopped at the token limit]</span>')
          : (a ? '<span class="ln-md">… </span>' : "") + render(r.text, marks, a, cutAt(r.text, a), true);
        const bar = r.role === "tar" ? "" : `<span class="ln-track"><i style="width:${(100 * r.relkl / max).toFixed(1)}%"></i>` +
          `<u style="left:${(100 / max).toFixed(1)}%"></u></span>`;
        return `<button type="button" class="ln-row r-${r.role}${full ? " is-open" : ""}" data-i="${i}" aria-expanded="${full}">` +
          `<span class="ln-who"><b>${typeset(r.name)}</b>${r.reward != null ? `<small>reward ${signed(r.reward)}</small>` : ""}</span>` +
          `<span class="ln-txt">${txt}</span>` +
          `<span class="ln-kl" title="relative KL to π_tar on this prompt">${bar}<em>${r.role === "tar" ? "0" : r.relkl.toFixed(2)}</em></span></button>`;
      };
      el.innerHTML = pick + `<div class="ln-rows">${rows.map(row).join("")}</div>`;
      const cur = el.querySelector(".ln-cur"), menu = el.querySelector(".ln-menu");
      if (cur) {
        const items = [...menu.children];
        const setOpen = (o) => { menu.hidden = !o; cur.setAttribute("aria-expanded", String(o)); if (o) items[ci].focus(); };
        const choose = (i) => { ci = i; openRows.clear(); draw(); el.querySelector(".ln-cur").focus(); };
        cur.addEventListener("click", () => setOpen(menu.hidden));
        items.forEach((li, i) => {
          li.addEventListener("click", () => choose(i));
          li.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(i); }
            else if (e.key === "ArrowDown") { e.preventDefault(); items[Math.min(items.length - 1, i + 1)].focus(); }
            else if (e.key === "ArrowUp") { e.preventDefault(); items[Math.max(0, i - 1)].focus(); }
            else if (e.key === "Escape") { setOpen(false); cur.focus(); }
          });
        });
        el.addEventListener("focusout", (e) => { if (!el.querySelector(".ln-pick").contains(e.relatedTarget)) setOpen(false); });
      }
      el.querySelectorAll(".ln-row").forEach((b) => b.addEventListener("click", () => {
        const i = +b.dataset.i;
        if (getSelection && String(getSelection()).length) return;
        openRows.has(i) ? openRows.delete(i) : openRows.add(i);
        draw();
      }));
      const pr = el.querySelector(".ln-prompt");
      if (pr) pr.addEventListener("click", () => pr.classList.toggle("open"));
    }
    draw();
  });
})();
