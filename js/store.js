// Collection du joueur, sauvegardée dans le navigateur (localStorage).
const KEY = "carte:collection:v1";

const empty = () => ({ packs: 0, cards: {}, bySet: {}, best: null });

let state = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === "object" && raw.cards) return { ...empty(), ...raw };
  } catch {
    /* stockage indisponible ou corrompu : on repart d'une collection vide */
  }
  return empty();
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota dépassé ou navigation privée : la session continue sans sauvegarde */
  }
}

export const getStats = () => ({
  packs: state.packs,
  unique: Object.keys(state.cards).length,
  total: Object.values(state.cards).reduce((sum, c) => sum + c.n, 0),
  best: state.best,
});

export const countOf = (cardId) => state.cards[cardId]?.n ?? 0;
export const ownedInSet = (setId) => state.bySet[setId]?.unique ?? 0;
export const packsOpenedInSet = (setId) => state.bySet[setId]?.packs ?? 0;
export const ownedSetIds = () => Object.keys(state.bySet).filter((id) => state.bySet[id].unique > 0);

/**
 * Enregistre un booster. `pulls` = [{ card, reverse }].
 * Retourne l'ensemble des ids de cartes qui n'étaient pas encore possédées.
 */
export function recordPack(set, pulls) {
  const fresh = new Set();
  const setStats = (state.bySet[set.id] ??= { packs: 0, unique: 0 });
  setStats.packs++;
  state.packs++;
  for (const { card } of pulls) {
    const entry = state.cards[card.id];
    if (entry) entry.n++;
    else {
      state.cards[card.id] = { n: 1, set: set.id };
      setStats.unique++;
      fresh.add(card.id);
    }
  }
  save();
  return fresh;
}

/** Retient la meilleure carte jamais sortie (palier le plus haut, puis la plus récente). */
export function recordBest(candidate) {
  if (!state.best || candidate.tier >= state.best.tier) {
    state.best = candidate;
    save();
  }
}

export function reset() {
  state = empty();
  save();
}
