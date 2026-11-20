(function () {
  const ROLE = { ref: "ref", poem: "poem", target: "tar" };
  const SUB = { ref: "before RL", poem: "the other experts", target: "RL on this reward" };
  const GRID_SIZES = "(max-width: 600px) 30vw, 8.5rem";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  POEM.register("diffusion", async (el, ctx) => {
    const { h, data: D, fmt, tip } = ctx;
    if (!D || !D.rewards) throw new Error("diffusion data missing");

    const src = el.dataset.src || "";
    const k = src.indexOf("static/");
    const base = k > 0 ? src.slice(0, k) : "";
    const u = (p) => base + p;
    const uset = (s) => s.split(",").map((x) => x.trim()).filter(Boolean)
      .map((x) => { const [p, w] = x.split(/\s+/); return u(p) + (w ? " " + w : ""); }).join(", ");
    let N = {};
    try { N = (await POEM.fetchJSON(src.slice(0, src.lastIndexOf("/") + 1) + "diffusion_notes.json")).rewards || {}; }
    catch (e) { console.warn("diffusion: notes not loaded", e); }

    const R = D.rewards.map((r) => ({ ...r, ...(N[r.id] || {}) }));
    const byId = Object.fromEntries(R.map((r) => [r.id, r]));
    const main = ((D.figure && D.figure.main_rewards) || []).filter((id) => byId[id]);
    const rest = R.filter((r) => !main.includes(r.id)).sort((a, b) => b.recovery - a.recovery).map((r) => r.id);
    const order = [...main, ...rest];
    const cols = D.columns, prompts = D.prompts;
    const colLabel = Object.fromEntries(cols.map((c) => [c.key, c.label]));
    const short = (p) => p.slug.replace(/-/g, " ");
    let cur = null;

    const root = h("div", { class: "c-diffusion" });

    const chips = [];
    const chip = (id) => {
      const r = byId[id];
      const b = h("button", { type: "button", id: `diffusion-reward-${id}`, "data-id": id, "aria-pressed": "false", tabindex: "-1",
        "aria-label": `${r.name}, recovery ${fmt(r.recovery, 2)}`, onclick: () => setReward(id) },
        r.name, h("span", { class: "cd-cv", "aria-hidden": "true" }, fmt(r.recovery, 2)));
      chips.push(b);
      return b;
    };
    const split = main.length && rest.length;
    const chipRow = h("div", { class: "seg cd-chips", role: "group", "aria-labelledby": "diffusion-reward-label" },
      main.map(chip), split ? h("span", { class: "cd-sep", "aria-hidden": "true" }) : null, rest.map(chip));

    chipRow.addEventListener("keydown", (e) => {
      const i = chips.indexOf(document.activeElement), n = chips.length;
      if (i < 0) return;
      const j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: n - 1 }[e.key];
      if (j == null) return;
      e.preventDefault();
      const b = chips[(j + n) % n];
      setReward(b.dataset.id);
      b.focus();
    });
    const opt = (id) => h("option", { value: id }, `${byId[id].name} (${fmt(byId[id].recovery, 2)})`);
    const sel = h("select", { id: "diffusion-reward-select", "aria-labelledby": "diffusion-reward-label",
      onchange: (e) => setReward(e.target.value) },
      main.length ? h("optgroup", { label: "In the paper's figure" }, main.map(opt)) : null,
      h("optgroup", { label: "Other held-out rewards, by recovery" }, rest.map(opt)));
    root.append(h("div", { class: "cd-pick" },
      h("p", { class: "cd-lblrow" },
        h("span", { class: "cd-lbl", id: "diffusion-reward-label" }, "Held-out reward"),
        split ? h("span", { class: "cd-lblnote" }, "the paper's figure first, then the others by recovery") : null),
      chipRow, h("div", { class: "cd-select" }, sel)));

    const T = D.table || {};
    const recDef = (T.columns && T.columns.recovery) || "";
    const recTip = `<b>Recovery</b> (from the paper's held-out table). ${esc(recDef)} The held-out expert is the ${esc(colLabel.target)} column.`;
    const def = h("p", { class: "hint cd-def", id: "diffusion-recdef", hidden: true, html: recTip });
    const terms = [];
    const info = h("div", { class: "cd-info", "aria-live": "polite" });
    const blocks = order.map((id) => {
      const r = byId[id];
      const term = h("button", { type: "button", class: "cd-term", "aria-expanded": "false", "aria-controls": "diffusion-recdef" }, "recovery");
      const mark = r.table_note && r.note_mark
        ? h("a", { class: "cd-dag", href: "#diffusion-note", title: "See the note under the images" }, r.note_mark) : null;
      const stat = h("div", { class: "cd-stat" },
        h("span", { class: "cd-val" }, fmt(r.recovery, 2), mark),
        term,
        T.mean_recovery != null ? h("span", { class: "cd-mean" }, `mean over the ${T.n_rewards} rewards: ${fmt(T.mean_recovery, 2)}`) : null);
      bindTerm(term, stat);
      return h("div", { class: "cd-ib", "data-id": id },
        h("div", { class: "cd-txt" },
          h("p", { class: "cd-name" }, h("b", {}, r.name), h("span", { class: "cd-kind" }, r.kind)),
          h("p", { class: "cd-desc" }, r.description),
          r.paper_visible_change ? h("p", { class: "cd-look" }, "What changes: ", h("i", {}, r.paper_visible_change)) : null),
        stat);
    });
    info.append(...blocks);
    root.append(info, def);

    function bindTerm(term, stat) {
      terms.push(term);
      term.addEventListener("pointerenter", (e) => {
        if (e.pointerType !== "mouse" || !def.hidden) return;
        const r = stat.getBoundingClientRect();
        tip.show(recTip, r.left, r.bottom);
      });
      term.addEventListener("pointerleave", () => tip.hide());
      term.addEventListener("click", () => {
        tip.hide();
        def.hidden = !def.hidden;
        terms.forEach((t) => t.setAttribute("aria-expanded", String(!def.hidden)));
      });
    }

    const setImg = (img, t) => {
      const s = u(t.src);
      if (img.dataset.k === s) return;
      img.dataset.k = s;
      img.classList.add("pending");
      img.srcset = uset(t.srcset || t.src);
      img.src = s;
    };

    const grid = h("div", { class: "cd-grid" });
    grid.append(h("div", { class: "cd-corner" }));
    for (const c of cols) {
      grid.append(h("div", { class: "cd-head" }, h("span", { class: "cd-hl" }, c.label), h("span", { class: "cd-sub" }, SUB[c.key] || ""),
        h("i", { class: `cd-rule ${ROLE[c.key] || "ref"}`, "aria-hidden": "true" })));
    }
    const gImgs = [];
    for (const p of prompts) {
      grid.append(h("div", { class: "cd-rowlab", title: p.text }, h("span", {}, short(p))));
      for (const c of cols) {
        const img = h("img", { class: "cd-tile", loading: "lazy", sizes: GRID_SIZES, decoding: "async", alt: "" });
        const done = () => img.classList.remove("pending");
        img.addEventListener("load", done);
        img.addEventListener("error", done);
        gImgs.push({ img, p, c });
        grid.append(img);
      }
    }
    const note = h("p", { class: "hint cd-note", id: "diffusion-note", hidden: true });
    root.append(grid, note);
    el.append(root);

    function setReward(id) {
      if (!byId[id] || id === cur) return;
      cur = id;
      const r = byId[id];
      chips.forEach((b) => { const on = b.dataset.id === id; b.setAttribute("aria-pressed", String(on)); b.tabIndex = on ? 0 : -1; });
      sel.value = id;
      blocks.forEach((b) => b.classList.toggle("on", b.dataset.id === id));
      for (const { img, p, c } of gImgs) {
        setImg(img, r.tiles[p.slug][c.key]);
        img.alt = `${c.label}, ${p.text} (held-out reward: ${r.name})`;
      }
      note.hidden = !r.table_note;
      note.textContent = r.table_note ? (r.note_mark ? r.note_mark + " " : "") + r.table_note : "";
    }

    setReward(order[0]);
  });
})();
