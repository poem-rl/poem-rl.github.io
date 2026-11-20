(function () {
  "use strict";
  const nav = document.querySelector(".side-toc");
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const secs = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
  if (!secs.length) return;
  let raf = 0;
  function update() {
    raf = 0;
    let cur = secs[0];
    for (const s of secs) if (s.getBoundingClientRect().top <= 160) cur = s;
    const se = document.scrollingElement || document.documentElement;
    if (window.innerHeight + se.scrollTop >= se.scrollHeight - 2) cur = secs[secs.length - 1];
    for (const a of links) {
      if (a.hash === "#" + cur.id) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    }
  }
  const later = () => { if (!raf) raf = requestAnimationFrame(update); };
  window.addEventListener("scroll", later, { passive: true });
  window.addEventListener("resize", later);
  update();
})();

(function () {
  "use strict";
  function stack() {
    const notes = document.querySelectorAll(".sn");
    notes.forEach((n) => { n.style.transform = ""; });
    if (window.innerWidth < 1200) return;

    const groups = new Map();
    notes.forEach((n) => { const b = n.closest(".prose") || document.body; if (!groups.has(b)) groups.set(b, []); groups.get(b).push(n); });
    for (const [block, ns] of groups) {
      const br = block.getBoundingClientRect(), bTop = br.top + window.scrollY, bBot = br.bottom + window.scrollY;
      let prev = -Infinity; const pos = [];
      for (const n of ns) {
        const r = n.getBoundingClientRect(), top = r.top + window.scrollY;
        const y = Math.max(top, prev + 10); pos.push([n, top, y, r.height]); prev = y + r.height;
      }
      const up = Math.max(0, Math.min(prev - bBot, pos.length ? pos[0][2] - bTop : 0));
      for (const [n, top, y] of pos) { const dy = y - up - top; if (dy) n.style.transform = `translateY(${dy}px)`; }
    }
  }
  let raf = 0;
  const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(stack); };
  window.addEventListener("load", later);
  window.addEventListener("resize", later);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
  later();
})();
