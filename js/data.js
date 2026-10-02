// Données : dépôt communautaire PokemonTCG/pokemon-tcg-data (JSON statiques, CORS ouvert).
const BASE = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master";

const cache = new Map();

function cached(key, load) {
  if (!cache.has(key)) {
    // On ne garde pas un échec en cache : un nouvel essai doit refaire la requête.
    cache.set(key, load().catch((err) => (cache.delete(key), Promise.reject(err))));
  }
  return cache.get(key);
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return res.json();
}

/** Toutes les extensions, triées de la plus récente à la plus ancienne. */
export function loadSets() {
  return cached("sets", async () => {
    const sets = await getJson(`${BASE}/sets/en.json`);
    return sets.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  });
}

/** Toutes les cartes d'une extension (chargées à la demande). */
export function loadCards(setId) {
  return cached(`cards:${setId}`, () => getJson(`${BASE}/cards/en/${setId}.json`));
}

/**
 * Visuels officiels de boosters : data/packs.json (généré par scripts/update-packs.mjs) liste,
 * par extension, les fichiers du dépôt 1niceroli/ptcg-assets, figé sur un commit précis.
 * Facultatif : sans ce fichier, l'application dessine elle-même le booster.
 */
export function loadPackArt() {
  return cached("packart", async () => {
    try {
      return await getJson(new URL("../data/packs.json", import.meta.url));
    } catch {
      return { repo: "", sha: "", packs: {} };
    }
  });
}

export const packArtUrls = (art, setId) =>
  (art.packs[setId] ?? []).map(
    (file) => `https://raw.githubusercontent.com/${art.repo}/${art.sha}/${setId}/packshots/${encodeURIComponent(file)}`,
  );

/** Précharge des images ; ne rejette jamais (une image absente ne doit pas bloquer l'ouverture). */
export function preloadImages(urls, timeoutMs = 8000) {
  const load = (url) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = img.onerror = () => resolve();
      img.src = url;
    });
  return Promise.race([
    Promise.all(urls.map(load)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
