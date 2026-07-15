import fs from "node:fs";
import path from "node:path";

const exercisesPath = "public/data/exercises.json";
const progressPath = "translation-progress.json";
const outputDir = "translation-work";
const batchSize = Number(process.argv.find((arg) => arg.startsWith("--batch-size="))?.split("=")[1] ?? 150);
const requestedStartIndex = process.argv.find((arg) => arg.startsWith("--start-index="))?.split("=")[1];

const exercises = JSON.parse(fs.readFileSync(exercisesPath, "utf8"));
const progress = JSON.parse(fs.readFileSync(progressPath, "utf8"));
const startIndex = requestedStartIndex === undefined ? progress.nextIndex : Number(requestedStartIndex);

if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex >= exercises.length) {
  console.error(`Index de depart invalide: ${requestedStartIndex ?? startIndex}`);
  process.exit(1);
}

const items = exercises.slice(startIndex, startIndex + batchSize).map((exercise, offset) => ({
  index: startIndex + offset,
  id: exercise.id,
  name: exercise.name,
  category: exercise.category,
  body_part: exercise.body_part,
  equipment: exercise.equipment,
  target: exercise.target || exercise.target_muscle || "",
  description_en: exercise.instructions?.en || exercise.description?.en || exercise.description || "",
}));

if (!items.length) {
  console.log("Aucun exercice restant a exporter.");
  process.exit(0);
}

fs.mkdirSync(outputDir, { recursive: true });

const first = String(startIndex + 1).padStart(4, "0");
const last = String(startIndex + items.length).padStart(4, "0");
const baseName = `batch-${first}-${last}`;

const source = {
  app: "KoulooFit",
  language: "fr",
  batch: {
    startIndex,
    endIndex: startIndex + items.length - 1,
    humanRange: `${startIndex + 1}-${startIndex + items.length}`,
    count: items.length,
    totalExercises: exercises.length,
  },
  outputShape: {
    [items[0].id]: {
      name: "nom original en anglais",
      description: "description complete traduite en francais",
      steps: ["phrase 1 traduite", "phrase 2 traduite"],
    },
  },
  items,
};

const prompt = `Tu es traducteur professionnel specialise fitness/musculation.

Je vais te fournir un fichier JSON contenant ${items.length} exercices de l'application KoulooFit.

Objectif : traduire en francais uniquement les champs description_en, en conservant strictement les IDs.

Regles obligatoires :
- Reponds uniquement avec du JSON valide, sans Markdown, sans bloc de code, sans commentaire.
- Ne supprime aucun exercice.
- Ne change aucun id.
- Garde les noms d'exercices dans le champ "name" tels quels, en anglais.
- Traduis la description en francais naturel, clair et adapte au fitness.
- Ne fais apparaitre aucune autre langue que le francais dans "description" et "steps".
- Decoupe "steps" en phrases ou consignes courtes, dans l'ordre logique de la description.
- Evite les anglicismes si un terme francais naturel existe.
- Pour les repetitions, utilise "repetitions".
- Pour "core", traduis selon le contexte par "centre du corps", "sangle abdominale" ou "gainage".
- Pour "engage", utilise "contractez", "activez" ou "engagez" selon le contexte.
- Pour "band", utilise "bande elastique" ou "bande de resistance".
- Pour "dumbbell", utilise "haltere".
- Pour "barbell", utilise "barre".
- Pour "cable", utilise "poulie" quand il s'agit d'une machine.

Structure exacte attendue en sortie :
{
  "ID_EXERCICE": {
    "name": "nom original",
    "description": "description complete traduite en francais",
    "steps": ["etape 1", "etape 2"]
  }
}

Traduis maintenant tous les items du JSON fourni.`;

const sourcePath = path.join(outputDir, `${baseName}.source.json`);
const promptPath = path.join(outputDir, `${baseName}.prompt.md`);

fs.writeFileSync(sourcePath, `${JSON.stringify(source, null, 2)}\n`, "utf8");
fs.writeFileSync(promptPath, `${prompt}\n`, "utf8");

console.log(JSON.stringify({ sourcePath, promptPath, batch: source.batch }, null, 2));
