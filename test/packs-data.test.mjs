import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { packArtUrls } from "../js/data.js";

const art = JSON.parse(readFileSync(new URL("../data/packs.json", import.meta.url), "utf8"));

test("le manifeste des visuels est figé sur un commit et sans emballage localisé", () => {
  assert.match(art.sha, /^[0-9a-f]{40}$/);
  assert.ok(Object.keys(art.packs).length > 100);
  for (const [id, files] of Object.entries(art.packs)) {
    assert.ok(!/^[a-z]{2}_/.test(id), `dossier de langue inattendu : ${id}`);
    assert.ok(files.length > 0);
    for (const f of files) assert.ok(/\.(webp|png|jpe?g)$/i.test(f) && !/_(DE|FR|JA|ES|IT|KO|PT)\.\w+$/i.test(f), f);
  }
});

test("les URL de visuels sont épinglées sur le commit et correctement encodées", () => {
  const urls = packArtUrls(art, "sv8");
  assert.ok(urls.length > 0);
  for (const u of urls) {
    assert.ok(u.startsWith(`https://raw.githubusercontent.com/${art.repo}/${art.sha}/sv8/packshots/`));
    assert.doesNotMatch(u.split("/packshots/")[1], /[—\s"]/);
  }
  assert.deepEqual(packArtUrls(art, "swshp"), []);
});
