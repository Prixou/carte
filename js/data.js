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
