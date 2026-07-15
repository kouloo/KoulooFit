import fs from "node:fs";
import { spawnSync } from "node:child_process";

const progressPath = "translation-progress.json";
const batchSize = Number(process.argv.find((arg) => arg.startsWith("--batch-size="))?.split("=")[1] ?? 150);
const progress = JSON.parse(fs.readFileSync(progressPath, "utf8"));

if (!Number.isInteger(batchSize) || batchSize <= 0) {
  console.error(`Taille de lot invalide: ${batchSize}`);
  process.exit(1);
}

let exported = 0;

for (let startIndex = progress.nextIndex; startIndex < progress.totalExercises; startIndex += batchSize) {
  const result = spawnSync(process.execPath, [
    "tools/export-translation-batch.mjs",
    `--batch-size=${batchSize}`,
    `--start-index=${startIndex}`,
  ], {
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  exported += 1;
}

console.log(`Lots exportes: ${exported}`);
