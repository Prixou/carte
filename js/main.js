import { loadSets, loadCards, loadPackArt, packArtUrls, preloadImages } from "./data.js";
import { openPack, packFormat, isSpecialSet, rarityInfo, tierOf, releaseYear } from "./pack.js";
import * as store from "./store.js";

const app = document.querySelector("#app");

let onKey = null; // action déclenchée par Espace / Entrée / → quand aucun élément n'a le focus
let renderToken = 0; // invalide les rendus asynchrones devenus obsolètes
let viewAbort = new AbortController(); // détache les écouteurs de la vue précédente

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const hueOf = (id) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Une image qui échoue se masque : le texte de secours placé derrière devient visible.
document.addEventListener("error", (e) => e.target.tagName === "IMG" && e.target.classList.add("broken"), true);

/* ------------------------------------------------------------------ routeur */

const routes = {
  "": homeView,
  open: openView,
  collection: collectionView,
};

async function render() {
  const token = ++renderToken;
  viewAbort.abort();
  viewAbort = new AbortController();
  onKey = null;
  closeZoom();

  const [route = "", arg] = location.hash.replace(/^#\/?/, "").split("/");
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === (route === "collection" ? "collection" : route === "" ? "home" : ""));
  });
  refreshNav();
  window.scrollTo(0, 0);

  app.innerHTML = `<div class="spinner" role="status" aria-label="Chargement"></div>`;
  try {
    await (routes[route] ?? homeView)(arg ? decodeURIComponent(arg) : undefined, token, viewAbort.signal);
  } catch (err) {
    if (token !== renderToken) return;
    console.error(err);
    app.innerHTML = `<div class="error"><h2>Impossible de charger les données</h2>
      <p>Vérifie ta connexion puis réessaie.</p><button class="btn primary" id="retry">Réessayer</button></div>`;
    app.querySelector("#retry").onclick = render;
  }
}

function refreshNav() {
  document.querySelector("#nav-count").textContent = store.getStats().unique || "";
}

/* ------------------------------------------------------------ composants */

function logoImg(set, cls = "") {
  return set.images?.logo ? `<img class="${cls}" loading="lazy" src="${esc(set.images.logo)}" alt="" />` : "";
}

function setTile(set, href) {
  const owned = store.ownedInSet(set.id);
  const special = isSpecialSet(set);
  return `<a class="set" href="${href}">
    <div class="set-logo">${logoImg(set)}</div>
    <div class="set-name">${esc(set.name)}</div>
    <div class="set-meta">${plural(set.total, "carte", "cartes")} · ${releaseYear(set) || "?"}${special ? ` · <span class="tag">Pochette</span>` : ""}</div>
    ${owned ? `<div class="bar" title="${owned}/${set.total}"><i style="width:${Math.min(100, (owned / set.total) * 100)}%"></i></div>
    <div class="set-meta">${owned}/${set.total} possédées</div>` : ""}
  </a>`;
}

/** Carte 3D. `flippable` = commence face cachée ; `reverse` = effet holo « reverse ». */
function cardEl(card, { reverse = false, flippable = false, large = false, isNew = false, count = 0 } = {}) {
  const src = large ? card.images?.large ?? card.images?.small : card.images?.small;
  const el = document.createElement("div");
  el.className = `card3d ${flippable ? "flippable" : "noflip"}`;
  el.dataset.tier = tierOf(card);
  el.dataset.reverse = reverse ? "1" : "0";
  el.innerHTML = `<div class="flip">
      <div class="face back"></div>
      <div class="face front">
        ${src ? `<img src="${esc(src)}" alt="${esc(card.name)}" ${large ? "" : 'loading="lazy"'} draggable="false" />` : ""}
        <span class="fallback">${esc(card.name)}<br>${esc(rarityInfo(card.rarity).fr)}</span>
        <div class="holo"></div>
        ${isNew ? `<span class="new-badge">NOUVELLE</span>` : ""}
        ${count > 1 ? `<span class="count-badge">×${count}</span>` : ""}
      </div>
    </div>`;
  return el;
}

/** Inclinaison 3D + reflet holo qui suivent le pointeur. */
function attachTilt(el, signal) {
  const move = (e) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    el.style.setProperty("--mx", x);
    el.style.setProperty("--my", y);
    el.style.setProperty("--ry", `${(x - 0.5) * 24}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 24}deg`);
    el.classList.add("tilting");
  };
  const leave = () => {
    el.classList.remove("tilting");
    ["--ry", "--rx"].forEach((p) => el.style.setProperty(p, "0deg"));
  };
  el.addEventListener("pointermove", move, { signal });
  el.addEventListener("pointerleave", leave, { signal });
}

/* --------------------------------------------------------------- zoom carte */

let zoomEl = null;
function closeZoom() {
  zoomEl?.remove();
  zoomEl = null;
}

function openZoom(card, set, { reverse = false } = {}) {
  closeZoom();
  const info = rarityInfo(card.rarity);
  zoomEl = document.createElement("div");
  zoomEl.className = "modal";
  zoomEl.setAttribute("role", "dialog");
  zoomEl.setAttribute("aria-label", card.name);
  zoomEl.innerHTML = `<button class="modal-close" aria-label="Fermer">×</button>
    <div><div class="modal-body"></div>
    <div class="modal-info"><b>${esc(card.name)}</b>
      <div>${esc(set?.name ?? "")} · n°${esc(card.number)}${set?.printedTotal ? `/${set.printedTotal}` : ""}</div>
      <div>${esc(info.fr)}${reverse ? " · Reverse" : ""} · possédée ×${store.countOf(card.id)}</div></div></div>`;
  const holder = zoomEl.querySelector(".modal-body");
  const el = cardEl(card, { reverse, large: true });
  holder.append(el);
  attachTilt(el, viewAbort.signal);
  // Si la version haute définition manque, on retombe sur la petite.
  el.querySelector("img")?.addEventListener("error", (e) => {
    if (card.images?.small && e.target.src !== card.images.small) {
      e.target.classList.remove("broken");
      e.target.src = card.images.small;
    }
  });
  zoomEl.addEventListener("click", (e) => {
    if (!e.target.closest(".card3d, .modal-info")) closeZoom();
  });
  document.body.append(zoomEl);
  zoomEl.querySelector(".modal-close").focus();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeZoom();
  else if (onKey && !zoomEl && e.target === document.body && [" ", "Enter", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
    onKey();
  }
});

/* ------------------------------------------------------------------ accueil */

const filters = { q: "", series: "", kind: "all", order: "desc" };

async function homeView(_, token, signal) {
  const sets = await loadSets();
  if (token !== renderToken) return;
  const stats = store.getStats();
  const seriesNames = [...new Set(sets.map((s) => s.series))];

  app.innerHTML = `
    <h1>Ouvre des boosters Pokémon</h1>
    <p class="lead">${sets.length} extensions disponibles, des premiers boosters de 1999 aux dernières sorties. Choisis-en une et ouvre un booster.</p>
    <div class="stats">
      <div class="stat"><b>${stats.packs}</b><span>boosters ouverts</span></div>
      <div class="stat"><b>${stats.unique}</b><span>cartes différentes</span></div>
      <div class="stat"><b>${stats.total}</b><span>cartes au total</span></div>
    </div>
    <div class="filters">
      <input id="q" type="search" placeholder="Rechercher une extension…" aria-label="Rechercher une extension" value="${esc(filters.q)}" />
      <select id="series" aria-label="Série">
        <option value="">Toutes les séries</option>
        ${seriesNames.map((n) => `<option ${n === filters.series ? "selected" : ""}>${esc(n)}</option>`).join("")}
      </select>
      <select id="kind" aria-label="Type">
        <option value="all">Boosters et pochettes</option>
        <option value="booster" ${filters.kind === "booster" ? "selected" : ""}>Boosters uniquement</option>
        <option value="special" ${filters.kind === "special" ? "selected" : ""}>Pochettes (promos, coffrets…)</option>
      </select>
      <select id="order" aria-label="Tri">
        <option value="desc">Plus récentes d'abord</option>
        <option value="asc" ${filters.order === "asc" ? "selected" : ""}>Plus anciennes d'abord</option>
      </select>
    </div>
    <div id="list"></div>`;

  const list = app.querySelector("#list");
  const draw = () => {
    const q = filters.q.trim().toLowerCase();
    let shown = sets.filter(
      (s) =>
        (!q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)) &&
        (!filters.series || s.series === filters.series) &&
        (filters.kind === "all" || (filters.kind === "special") === isSpecialSet(s)),
    );
    if (filters.order === "asc") shown = [...shown].reverse();
    if (!shown.length) {
      list.innerHTML = `<p class="empty">Aucune extension ne correspond.</p>`;
      return;
    }
    const groups = new Map();
    for (const s of shown) groups.set(s.series, [...(groups.get(s.series) ?? []), s]);
    list.innerHTML = [...groups]
      .map(
        ([series, items]) => `<h2 class="series-title">${esc(series)} <small>${plural(items.length, "extension", "extensions")}</small></h2>
        <div class="grid">${items.map((s) => setTile(s, `#/open/${encodeURIComponent(s.id)}`)).join("")}</div>`,
      )
      .join("");
  };
  draw();

  const bind = (sel, key, ev) =>
    app.querySelector(sel).addEventListener(ev, (e) => ((filters[key] = e.target.value), draw()), { signal });
  bind("#q", "q", "input");
  bind("#series", "series", "change");
  bind("#kind", "kind", "change");
  bind("#order", "order", "change");
}

/* --------------------------------------------------------------- ouverture */

async function openView(setId, token, signal) {
  const [sets, packArt] = await Promise.all([loadSets(), loadPackArt()]);
  if (token !== renderToken) return;
  const set = sets.find((s) => s.id === setId);
  if (!set) {
    app.innerHTML = `<div class="error"><h2>Extension introuvable</h2><a class="btn primary" href="#/">Retour aux extensions</a></div>`;
    return;
  }
  const format = packFormat(set);
  const special = format.kind === "special";

  app.innerHTML = `<a class="back" href="#/">← Toutes les extensions</a>
    <div class="open-head">${logoImg(set)}<div><h1>${esc(set.name)}</h1>
      <div class="meta">${esc(set.series)} · ${releaseYear(set) || "?"} · ${plural(set.total, "carte", "cartes")} ·
      ${special ? `pochette de ${format.size} cartes` : `booster de ${format.size} cartes`} · ${plural(store.packsOpenedInSet(set.id), "ouvert", "ouverts")}</div></div></div>
    <div class="stage" id="stage"></div>`;
  const stage = app.querySelector("#stage");

  // Visuels officiels : comme dans les vrais boosters, plusieurs designs existent, un seul est affiché.
  let arts = packArtUrls(packArt, set.id);
  let artIndex = Math.floor(Math.random() * arts.length);

  // Booster dessiné par l'application, utilisé quand aucun visuel officiel n'existe ou ne se charge.
  const drawnPack = () => `${set.images?.logo ? `<img class="p-logo" src="${esc(set.images.logo)}" alt="" />` : ""}
        <span class="p-name">${esc(set.name)}</span>
        <span class="p-sub">${special ? "Pochette" : "Booster"}</span>`;

  const showPack = () => {
    const art = arts[artIndex];
    stage.innerHTML = `<button class="pack ${art ? "art" : ""}" id="pack" style="--hue:${hueOf(set.id)}" aria-label="Ouvrir ${special ? "la pochette" : "le booster"}" disabled>
        ${art ? `<img class="p-art" src="${esc(art)}" alt="Booster ${esc(set.name)}" draggable="false" />` : drawnPack()}
      </button>
      <p class="hint" id="hint">Chargement des cartes…</p>
      ${arts.length > 1 ? `<button class="btn" id="other-art">Autre visuel</button>` : ""}`;
    const btn = stage.querySelector("#pack");
    stage.querySelector(".p-art")?.addEventListener("error", () => {
      // Image indisponible : on retombe sur le booster dessiné pour ne jamais bloquer l'ouverture.
      arts = [];
      btn.classList.remove("art");
      btn.innerHTML = drawnPack();
      stage.querySelector("#other-art")?.remove();
    }, { signal });
    stage.querySelector("#other-art")?.addEventListener("click", () => {
      if (btn.disabled && btn.classList.contains("tearing")) return;
      artIndex = (artIndex + 1) % arts.length;
      btn.querySelector(".p-art").src = arts[artIndex];
    }, { signal });
    return btn;
  };

  const packBtn = showPack();
  const cards = await loadCards(set.id);
  if (token !== renderToken) return;
  stage.querySelector("#hint").textContent = `Clique sur ${special ? "la pochette" : "le booster"} pour l'ouvrir`;
  packBtn.disabled = false;

  const start = async () => {
    const btn = stage.querySelector("#pack");
    if (btn.disabled) return;
    btn.disabled = true;
    btn.classList.add("tearing");
    stage.querySelector("#hint").textContent = "";

    const pulls = openPack(set, cards);
    const fresh = store.recordPack(set, pulls);
    const best = pulls[pulls.length - 1].card;
    store.recordBest({ id: best.id, name: best.name, image: best.images?.small, rarity: best.rarity, tier: tierOf(best), set: set.name });
    refreshNav();

    await Promise.all([wait(750), preloadImages(pulls.map((p) => p.card.images?.large ?? p.card.images?.small).filter(Boolean), 10000)]);
    if (token !== renderToken) return;
    reveal(pulls, fresh);
  };
  packBtn.addEventListener("click", start, { signal });
  onKey = start;

  let phase = "pack"; // "pack" | "reveal" | "summary"

  function reveal(pulls, fresh) {
    phase = "reveal";
    let i = 0;
    let flipped = false;
    let leaving = false;
    stage.innerHTML = `<div class="reveal">
        <div class="reveal-bar"><span class="counter" id="counter"></span>
          <button class="btn" id="skip">Tout révéler</button></div>
        <button class="stack" id="stack" aria-label="Retourner la carte"></button>
        <div class="rlabel" id="rlabel"></div>
        <div class="tray" id="tray"></div>
      </div>`;
    const stack = stage.querySelector("#stack");
    const label = stage.querySelector("#rlabel");
    const tray = stage.querySelector("#tray");
    const counter = stage.querySelector("#counter");

    const mount = () => {
      const { card, reverse } = pulls[i];
      stack.replaceChildren();
      const el = cardEl(card, { reverse, flippable: true, large: true, isNew: fresh.has(card.id) });
      stack.append(el);
      attachTilt(el, signal);
      stack.classList.remove("leaving");
      stack.classList.add("entering");
      flipped = false;
      label.innerHTML = "";
      counter.textContent = `Carte ${i + 1} / ${pulls.length}`;
      stack.setAttribute("aria-label", "Retourner la carte");
    };

    const flip = () => {
      const { card, reverse } = pulls[i];
      const el = stack.querySelector(".card3d");
      el.classList.add("flipped");
      flipped = true;
      const info = rarityInfo(card.rarity);
      label.innerHTML = `<div data-tier="${tierOf(card)}"><b>${esc(card.name)}</b><span>${esc(info.fr)}${reverse ? " · Reverse" : ""}${fresh.has(card.id) ? " · nouvelle !" : ""}</span></div>`;
      stack.setAttribute("aria-label", i + 1 < pulls.length ? "Carte suivante" : "Terminer");
      if (tierOf(card) >= 3) {
        stage.classList.remove("flash");
        void stage.offsetWidth; // relance l'animation
        stage.classList.add("flash");
      }
    };

    const next = async () => {
      if (leaving) return;
      leaving = true;
      const { card } = pulls[i];
      tray.insertAdjacentHTML("beforeend", `<img src="${esc(card.images?.small ?? "")}" alt="${esc(card.name)}" />`);
      stack.classList.remove("entering");
      stack.classList.add("leaving");
      await wait(320);
      if (token !== renderToken || phase !== "reveal") return;
      leaving = false;
      i++;
      i < pulls.length ? mount() : summary(pulls, fresh);
    };

    const advance = () => (flipped ? next() : flip());
    onKey = advance;
    stack.addEventListener("click", advance, { signal });
    stage.querySelector("#skip").addEventListener("click", () => summary(pulls, fresh), { signal });
    mount();
  }

  function summary(pulls, fresh) {
    phase = "summary";
    onKey = null;
    stage.classList.remove("flash");
    const bestPull = pulls[pulls.length - 1];
    stage.innerHTML = `<div class="summary">
        <div class="summary-head"><h2>Ton ${special ? "tirage" : "booster"}</h2>
          <span class="counter">${plural(fresh.size, "nouvelle carte", "nouvelles cartes")} sur ${pulls.length} · meilleure carte : ${esc(bestPull.card.name)} (${esc(rarityInfo(bestPull.card.rarity).fr)})</span></div>
        <div class="cards-grid" id="results"></div>
        <div class="actions"><button class="btn primary" id="again">Ouvrir ${special ? "une autre pochette" : "un autre booster"}</button>
          <a class="btn" href="#/collection/${encodeURIComponent(set.id)}">Voir ma collection de cette extension</a>
          <a class="btn" href="#/">Autres extensions</a></div>
      </div>`;
    const grid = stage.querySelector("#results");
    // Meilleures cartes en premier dans le récapitulatif.
    for (const pull of [...pulls].reverse()) {
      const btn = document.createElement("button");
      btn.className = "mini";
      btn.setAttribute("aria-label", pull.card.name);
      const el = cardEl(pull.card, { reverse: pull.reverse, isNew: fresh.has(pull.card.id) });
      btn.append(el, Object.assign(document.createElement("span"), { className: "lbl", textContent: pull.card.name }));
      attachTilt(el, signal);
      btn.addEventListener("click", () => openZoom(pull.card, set, { reverse: pull.reverse }), { signal });
      grid.append(btn);
    }
    stage.querySelector("#again").addEventListener("click", () => {
      if (arts.length) artIndex = Math.floor(Math.random() * arts.length);
      const btn = showPack();
      btn.disabled = false;
      stage.querySelector("#hint").textContent = `Clique sur ${special ? "la pochette" : "le booster"} pour l'ouvrir`;
      btn.addEventListener("click", start, { signal });
      onKey = start;
    }, { signal });
  }
}

/* --------------------------------------------------------------- collection */

async function collectionView(setId, token, signal) {
  const sets = await loadSets();
  if (token !== renderToken) return;
  return setId ? binderView(sets, setId, token, signal) : collectionHome(sets, signal);
}

function collectionHome(sets, signal) {
  const stats = store.getStats();
  const owned = sets.filter((s) => store.ownedInSet(s.id) > 0);
  if (!stats.packs) {
    app.innerHTML = `<h1>Ma collection</h1><div class="empty"><p>Ta collection est vide pour l'instant.</p><a class="btn primary" href="#/">Ouvrir un premier booster</a></div>`;
    return;
  }
  app.innerHTML = `<h1>Ma collection</h1>
    <div class="stats">
      <div class="stat"><b>${stats.packs}</b><span>boosters ouverts</span></div>
      <div class="stat"><b>${stats.unique}</b><span>cartes différentes</span></div>
      <div class="stat"><b>${stats.total}</b><span>cartes au total</span></div>
      <div class="stat"><b>${owned.length}</b><span>extensions entamées</span></div>
    </div>
    ${stats.best ? `<h2>Ta meilleure carte</h2><div class="cards-grid" style="grid-template-columns:150px"><div class="mini">
      <div class="card3d noflip" data-tier="${stats.best.tier}" data-reverse="0"><div class="flip"><div class="face front">
        ${stats.best.image ? `<img src="${esc(stats.best.image)}" alt="${esc(stats.best.name)}" />` : ""}<span class="fallback">${esc(stats.best.name)}</span><div class="holo"></div></div></div></div>
      <span class="lbl">${esc(stats.best.name)} · ${esc(stats.best.set)}</span></div></div>` : ""}
    <h2>Extensions</h2>
    <div class="grid">${owned.map((s) => setTile(s, `#/collection/${encodeURIComponent(s.id)}`)).join("")}</div>
    <div class="actions"><button class="btn danger" id="reset">Effacer ma collection</button></div>`;
  app.querySelector("#reset").addEventListener("click", () => {
    if (confirm("Effacer toute ta collection ? Cette action est définitive.")) {
      store.reset();
      render();
    }
  }, { signal });
}

async function binderView(sets, setId, token, signal) {
  const set = sets.find((s) => s.id === setId);
  if (!set) {
    app.innerHTML = `<div class="error"><h2>Extension introuvable</h2><a class="btn primary" href="#/collection">Retour</a></div>`;
    return;
  }
  const cards = [...(await loadCards(set.id))].sort((a, b) => a.number.localeCompare(b.number, "en", { numeric: true }));
  if (token !== renderToken) return;
  const have = cards.filter((c) => store.countOf(c.id) > 0).length;
  let mode = "all";

  app.innerHTML = `<a class="back" href="#/collection">← Ma collection</a>
    <div class="open-head">${logoImg(set)}<div><h1>${esc(set.name)}</h1>
      <div class="meta">${have} / ${cards.length} cartes possédées</div></div>
      <a class="btn primary" href="#/open/${encodeURIComponent(set.id)}">Ouvrir un booster</a></div>
    <div class="filters"><div class="seg" role="group" aria-label="Filtre">
      <button data-m="all" aria-pressed="true">Toutes</button>
      <button data-m="have" aria-pressed="false">Possédées</button>
      <button data-m="missing" aria-pressed="false">Manquantes</button></div></div>
    <div class="cards-grid big" id="binder"></div>`;
  const grid = app.querySelector("#binder");

  const draw = () => {
    grid.replaceChildren();
    for (const card of cards) {
      const n = store.countOf(card.id);
      if ((mode === "have" && !n) || (mode === "missing" && n)) continue;
      const btn = document.createElement("button");
      btn.className = `mini ${n ? "" : "missing"}`;
      btn.setAttribute("aria-label", `${card.name}${n ? "" : " (manquante)"}`);
      const el = cardEl(card, { count: n });
      btn.append(el, Object.assign(document.createElement("span"), { className: "lbl", textContent: `${card.number} · ${card.name}` }));
      if (n) {
        attachTilt(el, signal);
        btn.addEventListener("click", () => openZoom(card, set), { signal });
      }
      grid.append(btn);
    }
    if (!grid.children.length) grid.innerHTML = `<p class="empty">Rien à afficher ici.</p>`;
  };
  draw();

  app.querySelector(".seg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    mode = b.dataset.m;
    app.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    draw();
  }, { signal });
}

/* ------------------------------------------------------------------ démarrage */

window.addEventListener("hashchange", render);
render();
