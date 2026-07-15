import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const fileArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

if (!fileArg) {
  console.error("Usage: node tools/import-translation-batch.mjs <translated-json-file> [--dry-run]");
  process.exit(1);
}

const translatedPath = fileArg;
if (!/\.translated\.json$/i.test(translatedPath)) {
  console.error("Le fichier traduit doit se terminer par .translated.json.");
  console.error("Exemple: translation-work/batch-0073-0222.translated.json");
  process.exit(1);
}

const sourcePath = translatedPath.replace(/\.translated\.json$/i, ".source.json");
const translationsPath = "public/data/exercise-translations.fr.json";
const progressPath = "translation-progress.json";

if (!fs.existsSync(translatedPath)) {
  console.error(`Fichier traduit introuvable: ${translatedPath}`);
  process.exit(1);
}

if (!fs.existsSync(sourcePath)) {
  console.error(`Fichier source associe introuvable: ${sourcePath}`);
  console.error("Le fichier traduit doit suivre le format batch-XXXX-YYYY.translated.json.");
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const translatedRaw = JSON.parse(fs.readFileSync(translatedPath, "utf8"));
const translated = translatedRaw.translations && typeof translatedRaw.translations === "object"
  ? translatedRaw.translations
  : translatedRaw;

const currentTranslations = JSON.parse(fs.readFileSync(translationsPath, "utf8"));
const progress = JSON.parse(fs.readFileSync(progressPath, "utf8"));

if (!source.items || !Array.isArray(source.items) || !source.batch) {
  console.error(`Fichier source invalide: ${sourcePath}`);
  process.exit(1);
}

const expectedIds = source.items.map((item) => item.id);
const translatedIds = new Set(Object.keys(translated));
const missingIds = expectedIds.filter((id) => !translatedIds.has(id));
const extraIds = [...translatedIds].filter((id) => !expectedIds.includes(id));
const invalid = [];

for (const id of expectedIds) {
  const entry = translated[id];
  if (!entry || typeof entry !== "object") {
    invalid.push(`${id}: entree absente ou invalide`);
    continue;
  }

  if (typeof entry.name !== "string" || !entry.name.trim()) {
    invalid.push(`${id}: champ name manquant`);
  }

  if (typeof entry.description !== "string" || !entry.description.trim()) {
    invalid.push(`${id}: champ description manquant`);
  }

  if (!Array.isArray(entry.steps) || entry.steps.length === 0 || entry.steps.some((step) => typeof step !== "string" || !step.trim())) {
    invalid.push(`${id}: champ steps manquant ou invalide`);
  }
}

if (missingIds.length || extraIds.length || invalid.length) {
  console.error("Import refuse: le JSON traduit ne correspond pas au lot attendu.");
  if (missingIds.length) console.error(`IDs manquants (${missingIds.length}): ${missingIds.slice(0, 20).join(", ")}`);
  if (extraIds.length) console.error(`IDs inattendus (${extraIds.length}): ${extraIds.slice(0, 20).join(", ")}`);
  if (invalid.length) console.error(`Entrees invalides (${invalid.length}): ${invalid.slice(0, 20).join(" | ")}`);
  process.exit(1);
}

if (progress.nextIndex !== source.batch.startIndex) {
  console.error(`Progression incompatible: nextIndex=${progress.nextIndex}, lot=${source.batch.startIndex}.`);
  process.exit(1);
}

const merged = { ...currentTranslations };

for (const id of expectedIds) {
  merged[id] = {
    name: translated[id].name.trim(),
    description: translated[id].description.trim(),
    steps: translated[id].steps.map((step) => step.trim()),
  };
}

const mergedIds = new Set(Object.keys(merged));
const nextIndex = source.batch.endIndex + 1;
const updatedProgress = {
  ...progress,
  translatedCount: mergedIds.size,
  nextIndex,
  remainingInCurrentBatch: Math.max(0, source.batch.totalExercises - nextIndex),
  translatedIds: Array.from(new Set([...(progress.translatedIds || []), ...expectedIds])),
  lastImportedBatch: {
    file: path.basename(translatedPath),
    range: source.batch.humanRange,
    count: expectedIds.length,
    importedAt: new Date().toISOString(),
  },
};

console.log(JSON.stringify({
  dryRun,
  imported: expectedIds.length,
  range: source.batch.humanRange,
  nextIndex,
  translatedCount: mergedIds.size,
}, null, 2));

if (!dryRun) {
  fs.writeFileSync(translationsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  fs.writeFileSync(progressPath, `${JSON.stringify(updatedProgress, null, 2)}\n`, "utf8");
}
