"use strict";

const express = require("express");
const router = express.Router();

// Statistiques Qwen depuis le démarrage du serveur.
// Ces valeurs restent uniquement en mémoire RAM.
let aiGenerationCount = 0;
let aiGenerationTotalSeconds = 0;

// Statistiques Qwen depuis le démarrage du serveur
router.get("/stats", (req, res) => {
  const averageSeconds =
    aiGenerationCount > 0
      ? aiGenerationTotalSeconds / aiGenerationCount
      : null;

  res.json({
    success: true,
    generationCount: aiGenerationCount,
    averageSeconds: averageSeconds
  });
});

const db = require("../database/db");
const localAI = require("../services/localAI");

/*
|--------------------------------------------------------------------------
| Informations connues sur les configurations
|--------------------------------------------------------------------------
*/



/*
|--------------------------------------------------------------------------
| Utilitaires SQLite
|--------------------------------------------------------------------------
*/

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) return reject(error);
      resolve(row || null);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) return reject(error);
      resolve(rows || []);
    });
  });
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatPrice(value) {
  return `${toNumber(value).toFixed(2).replace(".", ",")} €`;
}

/*
|--------------------------------------------------------------------------
| Identification des caractéristiques connues
|--------------------------------------------------------------------------
*/



/*
|--------------------------------------------------------------------------
| Récupération d'une configuration depuis SQLite
|--------------------------------------------------------------------------
*/

async function getBuildById(id) {
  const build = await dbGet(
    `
      SELECT id, name, total_price
      FROM builds
      WHERE id = ?
    `,
    [id]
  );

  if (!build) return null;

  const components = await dbAll(
    `
      SELECT
        c.id,
        c.name,
        c.brand,
        c.price,
        c.specs,
        bi.category AS buildCategory,
        c.category AS catalogCategory
      FROM build_items bi
      INNER JOIN components c
        ON c.id = bi.component_id
      WHERE bi.build_id = ?
      ORDER BY c.name
    `,
    [id]
  );

  const normalizedComponents = components.map((component) => ({
    id: component.id,
    name: component.name || "Composant sans nom",
    brand: component.brand || "",
    price: toNumber(component.price),
    specs: component.specs || "",
    category:
      component.buildCategory ||
      component.catalogCategory ||
      "Non renseignée",
  }));

  const calculatedPrice = normalizedComponents.reduce(
    (sum, component) => sum + component.price,
    0
  );

  return {
    id: build.id,
    name: build.name || `Configuration ${build.id}`,
    totalPrice: Math.round(calculatedPrice * 100) / 100,
    components: normalizedComponents,
  };
}

/*
|--------------------------------------------------------------------------
| Capacités de stockage
|--------------------------------------------------------------------------
*/

function extractStorageGB(text) {
  const value = normalizeName(text);
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*(tb|to|gb|go)\b/i);

  if (!match) return null;

  const amount = Number(match[1].replace(",", "."));
  const unit = match[2].toLowerCase();

  if (!Number.isFinite(amount)) return null;

  return unit === "tb" || unit === "to"
    ? Math.round(amount * 1000)
    : Math.round(amount);
}

function isStorageComponent(component) {
  const text = normalizeName(
    `${component.name} ${component.brand} ${component.specs}`
  );

  return (
    /\b(ssd|hdd|nvme|sata|m\.2|hard drive|disque dur|disque ssd)\b/i.test(text) &&
    !/\b(ram|memory|memoire|gpu|graphics card|carte graphique)\b/i.test(text)
  );
}

function calculateStorage(build) {
  const components = build.components.filter(isStorageComponent);

  let totalGB = 0;
  let foundCapacity = false;

  for (const component of components) {
    const capacity = extractStorageGB(
      `${component.name} ${component.specs}`
    );

    if (capacity !== null) {
      totalGB += capacity;
      foundCapacity = true;
    }
  }

  if (!foundCapacity) {
    return {
      totalGB: null,
      display: "Capacité non déterminée automatiquement",
    };
  }

  const display =
    totalGB >= 1000 && totalGB % 1000 === 0
      ? `${totalGB / 1000} To (${totalGB} Go)`
      : `${totalGB} Go`;

  return { totalGB, display };
}

/*
|--------------------------------------------------------------------------
| Résumé des composants
|--------------------------------------------------------------------------
*/

function summarizeComponents(build) {
  return build.components.map((component) => ({
    nom: component.name,
    marque: component.brand || "Non renseignée",
    categorie: component.category || "Non renseignée",
    prix: formatPrice(component.price),
    prixNumerique: component.price,
    caracteristiques: component.specs || "Non renseignées",
  }));
}

/*
|--------------------------------------------------------------------------
| Détection et comparaison de la RAM
|--------------------------------------------------------------------------
*/

function extractRAMGB(component) {
  const category = normalizeName(component.category);
  const text = normalizeName(
    `${component.name} ${component.specs}`
  );

  if (
    category !== "ram" &&
    !/\b(ram|memory|memoire|ddr4|ddr5)\b/i.test(text)
  ) {
    return null;
  }

  // Évite de confondre la fréquence DDR5 6000 MHz avec une capacité.
  const matches = [
    ...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(gb|go)\b/gi),
  ];

  if (!matches.length) return null;

  const values = matches
    .map((match) => Number(match[1].replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!values.length) return null;

  // Si le nom indique un kit « 16 GB (8 GB x2) »,
  // on retient la capacité du kit, et non une multiplication erronée.
  const kitMatch = text.match(
    /(\d+(?:[.,]\d+)?)\s*(?:gb|go)\s*\(\s*\d+(?:[.,]\d+)?\s*(?:gb|go)\s*x\s*\d+\s*\)/i
  );

  if (kitMatch) {
    return Number(kitMatch[1].replace(",", "."));
  }

  return Math.max(...values);
}

function summarizeRAM(build) {
  let totalGB = 0;
  let found = false;
  let type = "Non confirmé";

  for (const component of build.components) {
    const capacity = extractRAMGB(component);

    if (capacity !== null) {
      totalGB += capacity;
      found = true;
    }

    const text = `${component.name || ""} ${component.specs || ""}`;
    const match = text.match(/\bDDR[345]\b/i);
    if (match) type = match[0].toUpperCase();
  }

  return {
    capaciteGo: found && totalGB > 0 ? totalGB : null,
    type,
    source: "Composants de la base locale",
  };
}

/*
|--------------------------------------------------------------------------
| Résumé des cartes graphiques
|--------------------------------------------------------------------------
*/

function summarizeGPUs(build) {
  const groups = new Map();

  for (const component of build.components) {
    const category = normalizeName(component.category || "");

    if (
      category !== "gpu" &&
      category !== "graphics card" &&
      category !== "carte graphique"
    ) {
      continue;
    }

    const key = normalizeName(component.name || "");
    const text = `${component.name || ""} ${component.specs || ""}`;
    const match = text.match(/\b(\d+)\s*(?:gb|go)\b/i);

    if (!groups.has(key)) {
      groups.set(key, {
        nom: component.name || "GPU non identifié",
        marque: component.brand || "Non renseignée",
        quantite: 0,
        vramParCarteGo: match ? Number(match[1]) : null,
        prixUnitaire: toNumber(component.price),
        prixTotal: 0,
        vramTotaleUtilisableGo: null,
        note:
          "La VRAM de cartes distinctes ne s'additionne pas automatiquement.",
      });
    }

    const gpu = groups.get(key);

    gpu.quantite += 1;
    gpu.prixTotal += toNumber(component.price);
  }

  return [...groups.values()].map((gpu) => ({
    ...gpu,
    prixTotal: Math.round(gpu.prixTotal * 100) / 100,
  }));
}

/*
|--------------------------------------------------------------------------
| Faits vérifiés d'une configuration
|--------------------------------------------------------------------------
*/

function buildVerifiedFacts(build) {
  const find = (...categories) =>
    build.components.find((component) =>
      categories.includes(normalizeName(component.category))
    ) || null;

  const label = (component) =>
    component
      ? [component.brand, component.name].filter(Boolean).join(" ")
      : null;

  const cpu = find("cpu", "processor", "processeur");
  const psu = find("psu", "power supply", "alimentation");
  const box = find("case", "boitier", "chassis");
  const cooler = find(
    "cooling",
    "cpu cooler",
    "refroidissement",
    "ventirad"
  );

  const storage = calculateStorage(build);

  const fans = build.components.filter((component) =>
    ["fan", "fans", "case fan", "ventilateur", "ventilateurs"]
      .includes(normalizeName(component.category))
  );

  const psuText = psu ? `${psu.name} ${psu.specs}` : "";
  const watts = psuText.match(/\b(\d{3,4})\s*(?:w|watts?)\b/i);

  const verifiedWatts = watts
    ? Number(watts[1])
    : /\bMAG\s*A850GL\s*PCIE5\b/i.test(psuText)
      ? 850
      : null;

  let ventilation =
    "Ventilation non confirmée dans les données disponibles";

  if (fans.length) {
    ventilation = `${fans.length} ventilateur(s) enregistré(s) : ${
      fans.map(label).join(", ")
    }`;
  } else if (box && /ventilat|fan/i.test(box.specs || "")) {
    ventilation = `Informations indiquées pour le boîtier : ${box.specs}`;
  }

  return {
    id: build.id,
    nom: build.name,
    prix: formatPrice(build.totalPrice),
    prixNumerique: build.totalPrice,

    processeur:
  label(cpu) ||
  "Non confirmé dans les données disponibles",

processeurCaracteristiques:
  cpu?.specs || null,

    alimentation: {
  modele:
    label(psu) ||
    "Non confirmé dans les données disponibles",

  puissanceW: verifiedWatts,
},

    ram: summarizeRAM(build),
    composants: summarizeComponents(build),
    cartesGraphiques: summarizeGPUs(build),

    stockage: {
      capacite: storage.display,
      capaciteGo: storage.totalGB,
    },

    refroidissement: {
      refroidissementCPU:
        label(cooler) ||
        "Non confirmé dans les données disponibles",

      ventilationBoitier: ventilation,

      boitier:
        label(box) ||
        "Non confirmé dans les données disponibles",
    },
  };
}

/*
|--------------------------------------------------------------------------
| Création du prompt Qwen
|--------------------------------------------------------------------------
*/

function createComparisonPrompt(builds) {
  const facts = builds.map((build) => {
    const { id, ...verifiedFacts } = buildVerifiedFacts(build);
    return verifiedFacts;
  });

  return `
Tu es un expert en matériel informatique. Rédige en français une comparaison technique fiable, claire et utile pour aider à choisir entre les PC fournis.

DONNÉES DE RÉFÉRENCE :
${JSON.stringify(facts, null, 2)}

RÈGLES GÉNÉRALES :
- Les données fournies sont la référence pour les composants, les noms et les prix.
- Compare explicitement toutes les configurations reçues.
- N'invente aucun prix, benchmark, FPS, température, consommation, compatibilité ou caractéristique absente.
- Distingue les données confirmées des connaissances générales et des incertitudes.
- Ne déduis jamais la performance globale d'une seule caractéristique isolée.
- Ne reproduis pas le JSON brut.
- Rédige un rapport concis de 400 à 500 mots environ. La présence des dix rubriques et l'exactitude priment sur le compte de mots.

RÈGLES TECHNIQUES :
- Distingue toujours la RAM système de la VRAM des cartes graphiques.
- Précise le nombre de GPU physiques et la VRAM de chaque carte.
- La VRAM de plusieurs cartes ne s'additionne pas automatiquement en une seule mémoire utilisable.
- Plusieurs GPU ne doublent pas automatiquement les performances en jeu. Les gains dépendent du logiciel, de sa prise en charge et de la tâche.
- Ne recommande pas le multi-GPU comme avantage général pour les jeux sans preuve de prise en charge.
- Pour les processeurs et cartes graphiques, donne des tendances générales raisonnables, sans inventer de mesures.
- - Pour le stockage, utilise exclusivement les valeurs numériques du champ stockage.capaciteGo pour comparer les capacités totales. La valeur la plus élevée correspond toujours à la plus grande capacité. Ne confonds jamais capacité de stockage, RAM et VRAM.
- Avant de rédiger la comparaison du stockage, vérifie les valeurs numériques de chaque PC et calcule leur différence. Dans toutes les rubriques, conserve exactement le même classement. N'affirme une différence de vitesse que si les données la justifient.
- Pour le refroidissement et la ventilation, distingue le refroidissement du CPU de la ventilation du boîtier. N'invente ni températures ni niveaux sonores.
- Pour les applications professionnelles, précise que le meilleur choix dépend du logiciel et de la tâche : montage vidéo, rendu, programmation, 3D ou bureautique n'ont pas les mêmes besoins. Ne désigne pas un PC comme meilleur uniquement parce qu'il possède davantage de stockage ou de RAM.
- Pour le budget, compare les prix totaux fournis et l'écart. Ne suppose pas qu'un composant au prix élevé est forcément meilleur.
- Si des données semblent inhabituelles ou contradictoires, signale-les prudemment sans les corriger ni les modifier.
- Pour les alimentations, reprends le modèle et la puissance nominale uniquement depuis les caractéristiques du composant fournies dans les données.
- Ne confonds jamais la puissance électrique en watts (W) avec le prix en euros (€).
- N'infère jamais la puissance d'une alimentation à partir de son prix ou d'un autre nombre présent dans le texte.
- Si la puissance nominale n'est pas explicitement confirmée, indique qu'elle n'est pas confirmée au lieu d'inventer une valeur.

RAPPORT — UTILISE EXACTEMENT CES DIX RUBRIQUES, DANS CET ORDRE :

# 1. Présentation générale
Compare les prix totaux, les composants déterminants et les différences principales.

# 2. Processeurs
Compare les modèles et leurs caractéristiques confirmées. Explique les usages possibles sans conclure à une supériorité générale non justifiée.

# 3. Cartes graphiques
Compare les modèles, le nombre de cartes, la VRAM par carte et les prix disponibles. Explique les implications pratiques pour les jeux et les applications graphiques ainsi que les limites du multi-GPU.

# 4. Mémoire vive RAM
Compare les capacités en Go et leurs implications possibles pour les jeux et le multitâche. Distingue clairement RAM et VRAM.

# 5. Stockage
Compare la capacité totale, les disques connus et les différences pertinentes.

# 6. Refroidissement et boîtier
Compare les refroidisseurs CPU, boîtiers et ventilateurs connus. Ne prétends pas qu'une configuration refroidit mieux sans données suffisantes.

# 7. Autres composants
Compare les cartes mères, alimentations, pâtes thermiques et ventilateurs lorsqu'ils sont connus. Explique brièvement leur rôle.

# 8. Comparaison des prix
Indique les prix totaux, l'écart de prix et les éléments utiles pour comprendre cet écart.

# 9. Avantages et limites
Pour chaque PC, indique au maximum deux avantages et deux limites, reliés aux données connues. Évite les jugements esthétiques arbitraires.

# 10. Recommandation finale
Réponds séparément aux six priorités suivantes :
- Jeux vidéo et performances graphiques.
- RAM et multitâche.
- Applications professionnelles.
- Capacité de stockage.
- Budget.
- Utilisation de plusieurs GPU.

Pour chaque priorité, indique le choix le plus justifié par les informations disponibles, ou précise que le choix dépend du logiciel ou de l'usage. Ne force pas de gagnant lorsque les données sont insuffisantes. Termine par une courte conclusion qui résume les compromis et les incertitudes importantes.

FORMAT FINAL :
- Conserve exactement les dix titres Markdown ci-dessus, sans en omettre.
- Compare explicitement les PC dans chaque rubrique.
- Utilise des phrases courtes et des listes brèves si nécessaire.
- N'ajoute aucun texte avant le titre 1 ni après la conclusion de la rubrique 10.
- Relis le rapport pour vérifier la cohérence des recommandations avec les composants et les prix fournis.
/no_think
`.trim();
}
/*
|--------------------------------------------------------------------------
| POST /api/ai/compare
|--------------------------------------------------------------------------
*/

router.post("/compare", async (req, res) => {
  try {
    const body = req.body || {};
    let ids;

    if (Array.isArray(body.buildIds)) {
      ids = body.buildIds;
    } else {
      const idA =
        body.buildAId ??
        body.build1Id ??
        body.pcId ??
        body.idA;

      const idB =
        body.buildBId ??
        body.build2Id ??
        body.auauId ??
        body.idB;

      ids = [idA, idB].filter(
        (id) => id !== undefined && id !== null && id !== ""
      );
    }

    ids = ids.map((id) => {
      const number = Number(id);
      return Number.isInteger(number) && number > 0 ? number : null;
    });

    if (ids.some((id) => id === null)) {
      return res.status(400).json({
        success: false,
        error: "Chaque identifiant doit être un entier positif.",
      });
    }

    ids = [...new Set(ids)];

    if (ids.length < 2) {
      return res.status(400).json({
        success: false,
        error: "Sélectionnez au moins deux configurations différentes.",
      });
    }

    if (ids.length > 6) {
      return res.status(400).json({
        success: false,
        error: "Vous pouvez comparer au maximum six configurations.",
      });
    }

    const builds = await Promise.all(
      ids.map((id) => getBuildById(id))
    );

    const missingIds = ids.filter(
      (id, index) => builds[index] === null
    );

    if (missingIds.length) {
      return res.status(404).json({
        success: false,
        error: `Configuration(s) introuvable(s) : ${missingIds.join(", ")}.`,
      });
    }

    const emptyBuild = builds.find(
      (build) => build.components.length === 0
    );

    if (emptyBuild) {
      return res.status(400).json({
        success: false,
        error: `La configuration "${emptyBuild.name}" ne contient aucun composant.`,
      });
    }

    if (!localAI || typeof localAI.generate !== "function") {
      throw new Error(
        "Le service localAI doit exposer une fonction generate(prompt)."
      );
    }

    const prompt = createComparisonPrompt(builds);
    const generationStart = Date.now();

console.log("[AUAU PERF] Début génération Qwen");

const analysis = await localAI.generate(prompt);

// Durée réelle de la génération
const generationSeconds =
  (Date.now() - generationStart) / 1000;

console.log(
  `[AUAU PERF] Génération Qwen : ${generationSeconds.toFixed(2)} s`
);

// Enregistrer uniquement les générations ayant produit du texte
if (analysis && String(analysis).trim()) {
  aiGenerationCount++;

  aiGenerationTotalSeconds += generationSeconds;

  const averageSeconds =
    aiGenerationTotalSeconds / aiGenerationCount;

  console.log(
    `[AUAU PERF] Temps moyen Qwen : ${averageSeconds.toFixed(2)} s`
  );

  console.log(
    `[AUAU PERF] Analyses réussies : ${aiGenerationCount}`
  );
}

    if (!analysis || !String(analysis).trim()) {
      throw new Error("Le modèle local n'a retourné aucune analyse.");
    }

    const report = String(analysis).trim();
    const missingSections = [];

    // Détection de certaines affirmations techniques à vérifier
    const technicalWarnings = [];


    const storageMatch = report.match(
    /^#{1,3}\s*5\.\s*[^\n]*\n([\s\S]*?)(?=^#{1,3}\s*6\.|$(?![\s\S]))/m
    );

    const storageSection = storageMatch ? storageMatch[1] : "";

    const unsupportedSpeedClaim =
      /\b(?:vitesse|transfert|stockage|ssd)\b[^\n]{0,150}\b(?:plus rapide|plus lent|inférieure|supérieure|moindre|limitée)\b/i.test(storageSection) ||
      /\b(?:plus rapide|plus lent|inférieure|supérieure|moindre|limitée)\b[^\n]{0,150}\b(?:vitesse|transfert|stockage|ssd)\b/i.test(storageSection);

    if (unsupportedSpeedClaim) {
      technicalWarnings.push(
        "Vérifier la comparaison des vitesses de stockage : les données disponibles ne suffisent pas nécessairement à établir une supériorité globale."
      );
    }

    for (let i = 1; i <= 10; i++) {
      const sectionPattern = new RegExp(
        "^#{1,3}\\s*" + i + "\\.",
        "m"
      );

      if (!sectionPattern.test(report)) {
        missingSections.push(i);
      }
    }

    if (missingSections.length > 0) {
      console.warn(
        "[AUAU IA] Rapport incomplet. Sections manquantes :",
        missingSections.join(", ")
      );

      return res.status(502).json({
        success: false,
        error: "L'analyse générée est incomplète. Relance la comparaison.",
        incomplete: true,
        missingSections,
      });
    }

        return res.json({
      success: true,
      model: "Qwen local",
      analysis: report,
      technicalWarnings,
      builds: builds.map(buildVerifiedFacts),
    });
  } catch (error) {
    console.error("Erreur pendant la comparaison IA :", error);

    return res.status(500).json({
      success: false,
      error: "Impossible de comparer les configurations pour le moment.",
    });
  }
});

module.exports = router;
