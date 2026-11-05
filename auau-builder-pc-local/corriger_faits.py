from pathlib import Path

p = Path("routes/ai.js")
s = p.read_text(encoding="utf-8")
original = s

# Retirer le bloc BUILD_FACTS
start = s.index("const BUILD_FACTS = {")
end = s.index("\n};", start) + 3
s = s[:start] + s[end:]

# Retirer getKnownFacts
start = s.index("function getKnownFacts(build) {")
end = s.index("\n}", start) + 2
s = s[:start] + s[end:]

# RAM : utiliser les composants enregistrés
start = s.index("function summarizeRAM(build) {")
end = s.index("\n/*", start)

s = s[:start] + '''function summarizeRAM(build) {
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
    const match = text.match(/\\\\bDDR[345]\\\\b/i);
    if (match) type = match[0].toUpperCase();
  }

  return {
    capaciteGo: found && totalGB > 0 ? totalGB : null,
    type,
    source: "Composants de la base locale",
  };
}
''' + s[end:]

# Faits vérifiés : partir des composants SQLite
start = s.index("function buildVerifiedFacts(build) {")
end = s.index("\n/*", start)

s = s[:start] + '''function buildVerifiedFacts(build) {
  const storage = calculateStorage(build);
  const find = (...categories) =>
    build.components.find((c) =>
      categories.includes(normalizeName(c.category))
    ) || null;
  const label = (c) =>
    c ? [c.brand, c.name].filter(Boolean).join(" ") : null;

  const cpu = find("cpu", "processor", "processeur");
  const psu = find("psu", "power supply", "alimentation");
  const box = find("case", "boitier", "chassis");
  const cooler = find("cooling", "cpu cooler", "refroidissement", "ventirad");
  const fans = build.components.filter((c) =>
    ["fan", "fans", "case fan", "ventilateur", "ventilateurs"]
      .includes(normalizeName(c.category))
  );

  const psuText = psu ? `${psu.name} ${psu.specs}` : "";
  const watts = psuText.match(/\\\\b(\\\\d{3,4})\\\\s*(?:w|watts?)\\\\b/i);

  let ventilation = "Ventilation non confirmée dans les données disponibles";
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
    processeur: label(cpu) || "Non confirmé dans les données disponibles",
    processeurCaracteristiques: cpu?.specs || null,
    alimentation: {
      modele: label(psu) || "Non confirmé dans les données disponibles",
      puissanceW: watts ? Number(watts[1]) : null,
    },
    ram: summarizeRAM(build),
    composants: summarizeComponents(build),
    cartesGraphiques: summarizeGPUs(build),
    stockage: {
      capacite: storage.display,
      capaciteGo: storage.totalGB,
    },
    refroidissement: {
      refroidissementCPU: label(cooler) ||
        "Non confirmé dans les données disponibles",
      ventilationBoitier: ventilation,
      boitier: label(box) ||
        "Non confirmé dans les données disponibles",
    },
  };
}
''' + s[end:]

if "BUILD_FACTS" in s or "getKnownFacts" in s:
    raise SystemExit("Anciennes références détectées : fichier non modifié.")

backup = Path("routes/ai.js.backup-20261023")
if not backup.exists():
    backup.write_text(original, encoding="utf-8")

p.write_text(s, encoding="utf-8")
print("Correction appliquée.")
