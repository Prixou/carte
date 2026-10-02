// Moteur de tirage d'un booster : pur, sans accès au DOM ni au réseau.

// Poids de tirage dans l'emplacement « rare » (plus c'est haut, plus c'est fréquent)
// et palier visuel (0 = commune … 4 = carte chase). Voir tierOf().
const RARITIES = {
  Common: { fr: "Commune", weight: 100, tier: 0 },
  Uncommon: { fr: "Peu commune", weight: 100, tier: 0 },
  Promo: { fr: "Promo", weight: 10, tier: 1 },
  "Classic Collection": { fr: "Classic Collection", weight: 10, tier: 1 },
  Rare: { fr: "Rare", weight: 100, tier: 1 },
  "Rare Holo": { fr: "Rare Holo", weight: 55, tier: 2 },
  "Rare Holo LV.X": { fr: "Rare Holo LV.X", weight: 14, tier: 2 },
  "Rare Prime": { fr: "Rare Prime", weight: 18, tier: 2 },
  "Rare Holo Star": { fr: "Gold Star ★", weight: 2, tier: 4 },
  LEGEND: { fr: "LÉGENDE", weight: 10, tier: 2 },
  "Rare ACE": { fr: "Rare ACE", weight: 12, tier: 2 },
  "ACE SPEC Rare": { fr: "Rare ACE SPEC", weight: 6, tier: 2 },
  "Pikachu Rare": { fr: "Rare Pikachu", weight: 10, tier: 2 },
  "Futuristic Rare": { fr: "Rare Futuriste", weight: 6, tier: 2 },
  "Double Rare": { fr: "Double Rare", weight: 30, tier: 3 },
  "Rare Holo EX": { fr: "Rare Holo EX", weight: 18, tier: 3 },
  "Rare Holo ex": { fr: "Rare Holo ex", weight: 18, tier: 3 },
  "Rare Holo GX": { fr: "Rare Holo GX", weight: 16, tier: 3 },
  "Rare Holo V": { fr: "Rare Holo V", weight: 16, tier: 3 },
  "Holo Rare V": { fr: "Rare Holo V", weight: 16, tier: 3 },
  "Rare Holo VMAX": { fr: "Rare Holo VMAX", weight: 6, tier: 3 },
  "Holo Rare VMAX": { fr: "Rare Holo VMAX", weight: 6, tier: 3 },
  "Rare Holo VSTAR": { fr: "Rare Holo VSTAR", weight: 6, tier: 3 },
  "Holo Rare VSTAR": { fr: "Rare Holo VSTAR", weight: 6, tier: 3 },
  "Rare Ultra": { fr: "Ultra Rare", weight: 14, tier: 3 },
  "Ultra Rare": { fr: "Ultra Rare", weight: 12, tier: 3 },
  "Rare BREAK": { fr: "Rare BREAK", weight: 10, tier: 3 },
  "Rare Prism Star": { fr: "Rare Prisme ◇", weight: 12, tier: 3 },
  "Radiant Rare": { fr: "Rare Radieuse", weight: 8, tier: 3 },
  "Amazing Rare": { fr: "Rare Extraordinaire", weight: 10, tier: 3 },
  "Rare Shining": { fr: "Rare Brillante", weight: 4, tier: 4 },
  "Rare Shiny": { fr: "Rare Shiny", weight: 8, tier: 3 },
  "Shiny Rare": { fr: "Shiny Rare", weight: 40, tier: 3 },
  "Trainer Gallery Rare Holo": { fr: "Galerie des Dresseurs", weight: 12, tier: 3 },
  "Illustration Rare": { fr: "Illustration Rare", weight: 100, tier: 4 },
  "Special Illustration Rare": { fr: "Illustration Spéciale Rare", weight: 18, tier: 4 },
  "Hyper Rare": { fr: "Hyper Rare", weight: 10, tier: 4 },
  "Mega Hyper Rare": { fr: "Méga Hyper Rare", weight: 8, tier: 4 },
  MEGA_ATTACK_RARE: { fr: "Méga Attaque Rare", weight: 12, tier: 4 },
  "Shiny Ultra Rare": { fr: "Shiny Ultra Rare", weight: 6, tier: 4 },
  "Rare Shiny GX": { fr: "Rare Shiny GX", weight: 4, tier: 4 },
  "Rare Rainbow": { fr: "Rare Arc-en-ciel", weight: 4, tier: 4 },
  "Rare Secret": { fr: "Rare Secrète", weight: 4, tier: 4 },
  "Black White Rare": { fr: "Rare Noir & Blanc", weight: 2, tier: 4 },
};

const UNKNOWN = { fr: "Inconnue", weight: 10, tier: 1 };

// Du plus commun au plus rare à sortir d'un booster. Sert à désigner la « meilleure carte » :
// à palier visuel égal, une Rare Holo VMAX bat une Rare Holo EX, et la Gold Star bat tout.
const RARITY_ORDER = [
  ["Common"], ["Uncommon"], ["Promo", "Classic Collection"], ["Rare"], ["Rare Holo"],
  ["Pikachu Rare"], ["Futuristic Rare"], ["Rare ACE", "ACE SPEC Rare"], ["Rare Holo LV.X"], ["Rare Prime"], ["LEGEND"],
  ["Rare Holo EX", "Rare Holo ex"], ["Double Rare"], ["Rare Holo GX"], ["Rare Holo V", "Holo Rare V"], ["Rare BREAK"],
  ["Rare Prism Star"], ["Radiant Rare"], ["Amazing Rare"], ["Rare Holo VSTAR", "Holo Rare VSTAR"],
  ["Rare Holo VMAX", "Holo Rare VMAX"], ["Trainer Gallery Rare Holo"], ["Rare Ultra", "Ultra Rare"], ["Rare Shiny", "Shiny Rare"],
  ["Illustration Rare"], ["Rare Shiny GX"], ["Rare Rainbow"], ["Rare Secret"], ["Special Illustration Rare"], ["Hyper Rare"],
  ["Shiny Ultra Rare"], ["Black White Rare"], ["Mega Hyper Rare", "MEGA_ATTACK_RARE"], ["Rare Shining"], ["Rare Holo Star"],
];
const RANKS = new Map(RARITY_ORDER.flatMap((names, rank) => names.map((name) => [name, rank])));
const GOLD_STAR_RANK = RARITY_ORDER.length; // au-dessus de tout

// Raretés qui, dans les blocs modernes, ne sortent que dans l'emplacement « chasse ».
const CHASE = new Set([
  "Illustration Rare",
  "Special Illustration Rare",
  "Hyper Rare",
  "Mega Hyper Rare",
  "MEGA_ATTACK_RARE",
  "Shiny Rare",
  "Shiny Ultra Rare",
]);

// Probabilité que l'emplacement « chasse » d'un booster Écarlate/Violet ou Méga soit une carte chase.
const HIT_CHANCE = 0.28;

export function rarityInfo(rarity) {
  return RARITIES[rarity] ?? (rarity ? { ...UNKNOWN, fr: rarity } : UNKNOWN);
}

// Les Gold Star (★ dans le nom) ne sont pas toujours étiquetées « Rare Holo Star » dans les données
// (Espeon ★, Umbreon ★ des séries POP, réimpressions…) : on les reconnaît aussi par leur nom.
export const isGoldStar = (card) => card.rarity === "Rare Holo Star" || /★/.test(card.name ?? "");

export function tierOf(card) {
  if (isGoldStar(card)) return 4;
  return card.supertype === "Energy" && !card.rarity ? 0 : rarityInfo(card.rarity).tier;
}

/** Rang de rareté (plus grand = plus rare). Fonctionne sur une carte ou sur { name, rarity }. */
export function rarityRank(card) {
  if (isGoldStar(card)) return GOLD_STAR_RANK;
  if (!card.rarity) return card.supertype === "Energy" ? -1 : RANKS.get("Rare") + 0.5;
  return RANKS.get(card.rarity) ?? RANKS.get("Rare") + 0.5;
}

/** Libellé français de la rareté d'une carte. */
export const rarityLabel = (card) => (isGoldStar(card) ? RARITIES["Rare Holo Star"].fr : rarityInfo(card.rarity).fr);

/** Raretés connues avec leur palier, pour les tests de cohérence. */
export const knownRarities = () => Object.entries(RARITIES).map(([name, { tier }]) => ({ name, tier }));

export function releaseYear(set) {
  return Number.parseInt(String(set.releaseDate).slice(0, 4), 10) || 0;
}

// Les promos, McDonald's, galeries, coffrets… n'ont pas de vrai booster : on y tire une pochette.
export function isSpecialSet(set) {
  return (
    set.total < 60 ||
    /Black Star Promos|McDonald|Trainer Kit|Shiny Vault|Gallery|Classic Collection/.test(set.name)
  );
}

const isBasicEnergy = (card) =>
  card.supertype === "Energy" && (card.subtypes ?? []).includes("Basic");

/** Composition d'un booster selon l'époque de l'extension. */
export function packFormat(set) {
  if (isSpecialSet(set)) return { kind: "special", size: Math.min(5, set.total) };
  const year = releaseYear(set);
  if (year <= 2002) return { kind: "classic", size: 11, energy: 1, common: 6, uncommon: 3, reverse: 0, rare: 1, hit: 0 };
  if (year < 2023) return { kind: "modern", size: 10, energy: 0, common: 5, uncommon: 3, reverse: 1, rare: 1, hit: 0 };
  return { kind: "scarlet", size: 10, energy: 0, common: 4, uncommon: 3, reverse: 1, rare: 1, hit: 1 };
}

function weightedIndex(weights, rng) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

const pickOne = (arr, rng) => arr[Math.floor(rng() * arr.length)];

/** Choisit une rareté (pondérée) puis une carte au hasard dans cette rareté. */
function pickByRarity(pool, rng) {
  const groups = new Map();
  for (const card of pool) {
    const key = isGoldStar(card) ? "Rare Holo Star" : card.rarity ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(card);
  }
  const keys = [...groups.keys()];
  const key = keys[weightedIndex(keys.map((k) => rarityInfo(k || undefined).weight), rng)];
  return pickOne(groups.get(key), rng);
}

/**
 * Ouvre un booster. `cards` = toutes les cartes de l'extension.
 * Retourne [{ card, reverse }] trié de la moins bonne à la meilleure carte.
 */
export function openPack(set, cards, rng = Math.random) {
  const format = packFormat(set);
  const used = new Set();
  const pulls = [];

  const add = (card, reverse = false) => {
    used.add(card.id);
    pulls.push({ card, reverse });
  };
  const unused = (pool) => pool.filter((c) => !used.has(c.id));

  if (format.kind === "special") {
    let pool = unused(cards);
    while (pulls.length < format.size && pool.length) {
      add(pickByRarity(pool, rng));
      pool = unused(pool);
    }
    return sortPulls(pulls);
  }

  const modernSet = format.kind !== "classic";
  const commons = cards.filter((c) => c.rarity === "Common" && !(modernSet && isBasicEnergy(c)));
  const uncommons = cards.filter((c) => c.rarity === "Uncommon");
  const energies = cards.filter((c) => isBasicEnergy(c));
  const chase = cards.filter((c) => CHASE.has(c.rarity));
  const rares = cards.filter(
    (c) => c.rarity && c.rarity !== "Common" && c.rarity !== "Uncommon" && !(format.hit && CHASE.has(c.rarity)) && !isBasicEnergy(c),
  );
  // Dernier recours si une extension n'a pas assez de cartes dans une catégorie.
  const anything = cards.filter((c) => !isBasicEnergy(c) || !modernSet);

  const draw = (pool, count, { reverse = false } = {}) => {
    for (let i = 0; i < count; i++) {
      let candidates = unused(pool);
      if (!candidates.length) candidates = unused(commons.length ? commons : anything);
      if (!candidates.length) candidates = unused(anything);
      if (!candidates.length) return;
      add(pickOne(candidates, rng), reverse);
    }
  };

  const drawRare = (pool) => {
    let candidates = unused(pool);
    if (!candidates.length) candidates = unused(anything);
    if (candidates.length) add(pickByRarity(candidates, rng));
  };

  draw(commons, format.common);
  draw(uncommons, format.uncommon);
  if (format.energy) draw(energies.length ? energies : commons, format.energy);
  draw([...commons, ...uncommons], format.reverse, { reverse: true });
  for (let i = 0; i < format.rare; i++) drawRare(rares.length ? rares : uncommons);
  if (format.hit) {
    if (chase.length && rng() < HIT_CHANCE) drawRare(chase);
    else draw([...commons, ...uncommons], 1, { reverse: true });
  }
  return sortPulls(pulls);
}

function sortPulls(pulls) {
  // Tri stable : on garde l'ordre de tirage à rareté égale, la meilleure carte sort en dernier.
  return pulls
    .map((p, i) => ({ p, i, r: rarityRank(p.card) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.p);
}
