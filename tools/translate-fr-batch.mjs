import fs from "node:fs";
const sourcePath = "public/data/exercises.json";
const targetPath = "public/data/exercise-translations.fr.json";
const progressPath = "translation-progress.json";
const cachePath = "translation-cache.fr.json";
const batchSize = Number(process.argv.find((arg) => arg.startsWith("--batch-size="))?.split("=")[1] ?? 150);
const maxItems = Number(process.argv.find((arg) => arg.startsWith("--max-items="))?.split("=")[1] ?? batchSize);
const delayMs = Number(process.argv.find((arg) => arg.startsWith("--delay-ms="))?.split("=")[1] ?? 900);
const provider = process.argv.find((arg) => arg.startsWith("--provider="))?.split("=")[1] ?? "mymemory";
const maxQueryLength = 450;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let myMemoryDisabled = provider === "gtx";

function readJson(path, fallback) {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeStep(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function splitLongText(text, maxLength = maxQueryLength) {
  const normalized = normalizeStep(text);
  if (!normalized) return [];
  if (normalized.length <= maxLength) return [normalized];

  const chunks = [];
  let current = "";
  const parts = normalized.split(/(?<=[,;:])\s+|\s+(?=(?:and|then|while|keeping|with|until|before|after)\b)/i);

  for (const part of parts) {
    const next = current ? `${current} ${part}` : part;
    if (next.length <= maxLength) {
      current = next;
      continue;
    }

    if (current) chunks.push(current);

    if (part.length <= maxLength) {
      current = part;
      continue;
    }

    for (let index = 0; index < part.length; index += maxLength) {
      chunks.push(part.slice(index, index + maxLength));
    }
    current = "";
  }

  if (current) chunks.push(current);
  return chunks;
}

async function translateWithMyMemory(normalized, cache) {
  if (myMemoryDisabled) {
    throw new Error("MyMemory quota exhausted");
  }

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(normalized)}&langpair=en|fr`;
  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok || result.responseStatus >= 400) {
    const message = result.responseDetails || `HTTP ${response.status}`;
    if (message.includes("USED ALL AVAILABLE FREE TRANSLATIONS")) {
      myMemoryDisabled = true;
    }
    throw new Error(message);
  }
  const translated = normalizeStep(decodeEntities(result.responseData?.translatedText || ""));
  if (translated.includes("MYMEMORY WARNING") || translated.includes("USED ALL AVAILABLE FREE TRANSLATIONS")) {
    myMemoryDisabled = true;
    throw new Error(translated);
  }
  cache[normalized] = translated;
  writeJson(cachePath, cache);
  return translated;
}

async function translateWithGoogleGtx(normalized, cache) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fr&dt=t&q=${encodeURIComponent(normalized)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google GTX HTTP ${response.status}`);
  }
  const result = await response.json();
  const translated = normalizeStep(decodeEntities((result?.[0] || []).map((part) => part?.[0] || "").join("")));
  cache[normalized] = translated;
  writeJson(cachePath, cache);
  return translated;
}

async function translateShortText(text, cache) {
  const normalized = normalizeStep(text);
  if (!normalized) return "";
  if (cache[normalized]) return cache[normalized];

  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      if (!myMemoryDisabled) {
        return await translateWithMyMemory(normalized, cache);
      }
      return await translateWithGoogleGtx(normalized, cache);
    } catch (error) {
      lastError = error;
      const message = String(error?.message || error);
      if (!myMemoryDisabled && message.includes("USED ALL AVAILABLE FREE TRANSLATIONS")) {
        myMemoryDisabled = true;
        console.warn("MyMemory quota exhausted. Switching to Google Translate.");
        continue;
      }

      if (!myMemoryDisabled && message.includes("MYMEMORY WARNING")) {
        myMemoryDisabled = true;
        console.warn(`MyMemory unavailable: ${message}. Switching to Google Translate.`);
        continue;
      }

      const waitTime = message.includes("TooManyRequests") || message.includes("Too Many Requests")
        ? 60000 * attempt
        : 3000 * attempt;
      console.warn(`Translation retry ${attempt}/8 after ${waitTime}ms: ${message}`);
      await wait(waitTime);
    }
  }
  throw lastError;
}

async function translateText(text, cache) {
  const chunks = splitLongText(text);
  const translatedChunks = [];

  for (const chunk of chunks) {
    translatedChunks.push(await translateShortText(chunk, cache));
    await wait(delayMs);
  }

  return normalizeStep(translatedChunks.join(" "));
}

function decodeEntities(value) {
  return String(value)
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

async function translateSteps(steps, cache) {
  const source = steps.map(normalizeStep).filter(Boolean);
  const translated = [];
  for (const step of source) {
    translated.push(await translateText(step, cache));
    await wait(delayMs);
  }
  return translated;
}

function rebuildProgress(exercises, translations) {
  const translatedIds = exercises.filter((exercise) => translations[exercise.id]).map((exercise) => exercise.id);
  const nextIndex = translatedIds.length;
  const currentBatch = Math.floor(nextIndex / batchSize) + 1;
  const currentBatchStartIndex = (currentBatch - 1) * batchSize;
  const currentBatchEndIndexInclusive = Math.min(currentBatchStartIndex + batchSize - 1, exercises.length - 1);

  return {
    source: sourcePath,
    target: targetPath,
    totalExercises: exercises.length,
    batchSize,
    translatedCount: translatedIds.length,
    lastCompletedBatch: Math.floor(translatedIds.length / batchSize),
    lastCompletedIndexInclusive: nextIndex - 1,
    nextIndex,
    currentBatch,
    currentBatchStartIndex,
    currentBatchEndIndexInclusive,
    remainingInCurrentBatch: Math.max(0, currentBatchEndIndexInclusive - nextIndex + 1),
    translatedIds,
    updatedAt: new Date().toISOString(),
    notes: [
      "Les traductions sont stockees separement pour eviter de reecrire le gros JSON source.",
      "Reprise: lire nextIndex. Le lot courant est exercises[currentBatchStartIndex ... currentBatchEndIndexInclusive]. Continuer jusqu'a currentBatchEndIndexInclusive, puis incrementer currentBatch.",
      "Les traitements se font par lots de 150 exercices.",
      "L'application charge le fichier target et affiche uniquement le francais.",
    ],
  };
}

const exercises = readJson(sourcePath, []);
const translations = readJson(targetPath, {});
const cache = readJson(cachePath, {});
let progress = rebuildProgress(exercises, translations);
writeJson(progressPath, progress);

let translatedThisRun = 0;
while (progress.nextIndex < exercises.length && translatedThisRun < maxItems) {
  const exercise = exercises[progress.nextIndex];
  const sourceSteps = exercise.instruction_steps?.en?.length
    ? exercise.instruction_steps.en
    : String(exercise.instructions?.en || "")
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean);

  const translatedSteps = await translateSteps(sourceSteps, cache);

  translations[exercise.id] = {
    name: exercise.name,
    description: translatedSteps.join(" "),
    steps: translatedSteps,
  };

  writeJson(targetPath, translations);
  progress = rebuildProgress(exercises, translations);
  writeJson(progressPath, progress);

  translatedThisRun += 1;
  console.log(`${progress.translatedCount}/${exercises.length} translated - nextIndex=${progress.nextIndex}`);
  await wait(delayMs);
}

console.log(
  JSON.stringify(
    {
      translatedThisRun,
      translatedCount: progress.translatedCount,
      nextIndex: progress.nextIndex,
      done: progress.nextIndex >= exercises.length,
    },
    null,
    2,
  ),
);
