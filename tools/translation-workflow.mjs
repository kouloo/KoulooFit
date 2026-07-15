import fs from "node:fs";
import { spawnSync } from "node:child_process";

const batchSize = Number(process.argv.find((arg) => arg.startsWith("--batch-size="))?.split("=")[1] ?? 150);
const progressPath = "translation-progress.json";
const workDir = "translation-work";

function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function expectedTranslatedPath(progress) {
  const start = progress.nextIndex + 1;
  const end = Math.min(progress.nextIndex + batchSize, progress.totalExercises);
  return `${workDir}/batch-${String(start).padStart(4, "0")}-${String(end).padStart(4, "0")}.translated.json`;
}

if (!fs.existsSync(workDir)) {
  fs.mkdirSync(workDir, { recursive: true });
}

const progress = JSON.parse(fs.readFileSync(progressPath, "utf8"));

if (progress.nextIndex >= progress.totalExercises) {
  console.log("Toutes les traductions sont deja terminees.");
  process.exit(0);
}

const translatedPath = expectedTranslatedPath(progress);

if (!fs.existsSync(translatedPath)) {
  console.log(`Aucun lot traduit trouve pour la progression actuelle.`);
  console.log(`Fichier attendu: ${translatedPath}`);
  console.log("Je prepare ou rafraichis le fichier source et le prompt correspondants.");
  runNode(["tools/export-translation-batch.mjs", `--batch-size=${batchSize}`]);
  process.exit(0);
}

console.log(`Import du lot traduit: ${translatedPath}`);
runNode(["tools/import-translation-batch.mjs", translatedPath]);

const updatedProgress = JSON.parse(fs.readFileSync(progressPath, "utf8"));

if (updatedProgress.nextIndex >= updatedProgress.totalExercises) {
  console.log("Toutes les traductions sont terminees.");
  process.exit(0);
}

console.log("Preparation du lot suivant.");
runNode(["tools/export-translation-batch.mjs", `--batch-size=${batchSize}`]);
