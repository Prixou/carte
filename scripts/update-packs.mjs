// Régénère data/packs.json : la liste des visuels de boosters de chaque extension.
// Source : https://github.com/1niceroli/ptcg-assets (dossier <extension>/packshots/).
// Usage : node scripts/update-packs.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "https://github.com/1niceroli/ptcg-assets";
const out = fileURLToPath(new URL("../data/packs.json", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "ptcg-assets-"));
const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", maxBuffer: 1 << 28 });

try {
  // Clone sans les blobs : seule l'arborescence nous intéresse.
  execFileSync("git", ["clone", "-q", "--depth", "1", "--filter=blob:none", "--no-checkout", REPO, dir]);
  const sha = git("rev-parse", "HEAD").trim();
  const files = git("ls-tree", "-r", "-z", "--name-only", "HEAD").split("\0");

  const packs = {};
  for (const path of files) {
    const [setId, folder, file, ...rest] = path.split("/");
    // Dossiers de langue (de_, ja_…) ignorés ; emballages localisés (_DE.png…) ignorés.
    if (folder !== "packshots" || rest.length || /^[a-z]{2}_/.test(setId)) continue;
    if (!/\.(webp|png|jpe?g)$/i.test(file) || /_(DE|FR|JA|ES|IT|KO|PT)\.\w+$/i.test(file)) continue;
    (packs[setId] ??= []).push(file);
  }
  for (const list of Object.values(packs)) list.sort();

  writeFileSync(out, JSON.stringify({ repo: "1niceroli/ptcg-assets", sha, packs }, null, 1) + "\n");
  console.log(`${Object.keys(packs).length} extensions, ${Object.values(packs).flat().length} visuels (commit ${sha.slice(0, 7)})`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
