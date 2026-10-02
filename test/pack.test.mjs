import { test } from "node:test";
import assert from "node:assert/strict";
import { openPack, packFormat, isSpecialSet, tierOf, rarityInfo } from "../js/pack.js";

// Générateur pseudo-aléatoire déterministe pour des tests reproductibles.
function seeded(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function makeSet(id, year, total, extra = {}) {
  return { id, name: id, series: "Test", total, releaseDate: `${year}/01/01`, ...extra };
}

function makeCards(setId, spec) {
  const cards = [];
  let n = 1;
  for (const [rarity, count, extra] of spec) {
    for (let i = 0; i < count; i++) cards.push({ id: `${setId}-${n}`, name: `${rarity} ${i}`, number: String(n++), rarity, supertype: "Pokémon", ...extra });
  }
  return cards;
}

const modernSpec = [["Common", 40], ["Uncommon", 30], ["Rare", 15], ["Rare Holo", 10], ["Rare Holo V", 5]];
const scarletSpec = [["Common", 40], ["Uncommon", 30], ["Rare", 15], ["Double Rare", 10], ["Illustration Rare", 10], ["Special Illustration Rare", 4], ["Hyper Rare", 3]];

test("la taille et la composition dépendent de l'époque", () => {
  assert.deepEqual(
    [packFormat(makeSet("a", 1999, 102)).size, packFormat(makeSet("b", 2015, 100)).size, packFormat(makeSet("c", 2024, 200)).size],
    [11, 10, 10],
  );
  assert.equal(packFormat(makeSet("p", 2020, 300, { name: "SWSH Black Star Promos" })).kind, "special");
  assert.equal(isSpecialSet(makeSet("x", 2021, 25)), true);
  assert.equal(isSpecialSet(makeSet("y", 2021, 200)), false);
});

test("un booster n'a jamais de doublon et a la bonne taille", () => {
  const rng = seeded(1);
  for (const [year, spec] of [[2015, modernSpec], [2024, scarletSpec]]) {
    const set = makeSet("s", year, 100);
    const cards = makeCards("s", spec);
    for (let i = 0; i < 500; i++) {
      const pack = openPack(set, cards, rng);
      assert.equal(pack.length, 10);
      assert.equal(new Set(pack.map((p) => p.card.id)).size, 10);
    }
  }
});

test("booster moderne : 5 communes, 3 peu communes, 1 reverse, 1 rare ou mieux", () => {
  const set = makeSet("m", 2015, 100);
  const cards = makeCards("m", modernSpec);
  const pack = openPack(set, cards, seeded(7));
  const normal = pack.filter((p) => !p.reverse);
  assert.equal(pack.filter((p) => p.reverse).length, 1);
  assert.equal(normal.filter((p) => p.card.rarity === "Common").length, 5);
  assert.equal(normal.filter((p) => p.card.rarity === "Uncommon").length, 3);
  assert.equal(normal.filter((p) => tierOf(p.card) >= 1).length, 1);
});

test("la meilleure carte sort en dernier", () => {
  const set = makeSet("m", 2024, 100);
  const cards = makeCards("m", scarletSpec);
  const rng = seeded(3);
  for (let i = 0; i < 200; i++) {
    const tiers = openPack(set, cards, rng).map((p) => tierOf(p.card));
    assert.deepEqual(tiers, [...tiers].sort((a, b) => a - b));
  }
});

test("les cartes chase (Écarlate/Violet) sortent environ une fois sur quatre", () => {
  const set = makeSet("m", 2024, 100);
  const cards = makeCards("m", scarletSpec);
  const rng = seeded(11);
  const runs = 4000;
  let hits = 0;
  for (let i = 0; i < runs; i++) if (openPack(set, cards, rng).some((p) => tierOf(p.card) === 4)) hits++;
  const rate = hits / runs;
  assert.ok(rate > 0.2 && rate < 0.36, `taux de chase inattendu : ${rate}`);
});

test("les énergies de base ne sortent pas des boosters modernes", () => {
  const set = makeSet("e", 2020, 100);
  const cards = [...makeCards("e", modernSpec), ...makeCards("en", [["Common", 8, { supertype: "Energy", subtypes: ["Basic"] }]])];
  const rng = seeded(5);
  for (let i = 0; i < 300; i++) assert.ok(openPack(set, cards, rng).every((p) => p.card.supertype !== "Energy"));
});

test("un booster classique contient une énergie quand l'extension en a", () => {
  const set = makeSet("w", 1999, 100);
  const cards = [...makeCards("w", [["Common", 30], ["Uncommon", 20], ["Rare", 10], ["Rare Holo", 10]]), ...makeCards("we", [[undefined, 6, { supertype: "Energy", subtypes: ["Basic"] }]])];
  const pack = openPack(set, cards, seeded(2));
  assert.equal(pack.length, 11);
  assert.equal(pack.filter((p) => p.card.supertype === "Energy").length, 1);
});

test("une extension trop petite ne plante pas et ne produit pas de doublon", () => {
  const set = makeSet("t", 2020, 100);
  const cards = makeCards("t", [["Common", 4], ["Uncommon", 2], ["Rare", 1]]);
  const pack = openPack(set, cards, seeded(9));
  assert.equal(pack.length, cards.length);
  assert.equal(new Set(pack.map((p) => p.card.id)).size, pack.length);
});

test("une pochette spéciale tire jusqu'à 5 cartes distinctes", () => {
  const set = makeSet("sp", 2021, 25);
  const cards = makeCards("sp", [["Rare", 12], ["Rare Holo", 6], [undefined, 7]]);
  const pack = openPack(set, cards, seeded(4));
  assert.equal(pack.length, 5);
  assert.equal(new Set(pack.map((p) => p.card.id)).size, 5);
});

test("les raretés inconnues ont un libellé de repli", () => {
  assert.equal(rarityInfo("Rareté Future").fr, "Rareté Future");
  assert.equal(rarityInfo(undefined).fr, "Inconnue");
});
