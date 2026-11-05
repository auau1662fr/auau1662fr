/* =========================================================
   AUAU BUILDER - COMPARATEUR MULTI-BUILDS
   Analyse locale fondée sur les données disponibles
========================================================= */

"use strict";

const CATEGORY_ORDER = [
    "CPU",
    "GPU",
    "RAM",
    "Motherboard",
    "Storage",
    "PSU",
    "Case",
    "Cooling",
    "Fans",
    "Thermal Paste"
];

const CATEGORY_LABELS = {
    CPU: "Processeur",
    GPU: "Carte graphique",
    RAM: "Mémoire vive",
    Motherboard: "Carte mère",
    Storage: "Stockage",
    PSU: "Alimentation",
    Case: "Boîtier",
    Cooling: "Refroidissement",
    Fans: "Ventilateurs",
    "Thermal Paste": "Pâte thermique"
};

const selectorsContainer = document.getElementById("build-selectors");
const addBuildButton = document.getElementById("add-build");
const compareButton = document.getElementById("compare-button");
const compareMessage = document.getElementById("compare-message");
const compareResults = document.getElementById("compare-results");
const comparisonTable = document.getElementById("comparison-table");
const analysisCards = document.getElementById("analysis-cards");

let availableBuilds = [];
let selectorCounter = 0;


/* =========================================================
   UTILITAIRES
========================================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function formatPrice(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "Prix inconnu";
    }

    return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR"
    }).format(number);
}

function getValidPrice(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) && number > 0
        ? number
        : null;
}

function getComponents(build, category) {
    return (build.components || []).filter(
        component => component.category === category
    );
}

function getComponentNames(build, category) {
    const components = getComponents(build, category);

    if (!components.length) {
        return "Non renseigné";
    }

    return components
        .map(component => component.name || "Composant sans nom")
        .join(", ");
}

function parseSpecs(specs) {
    if (!specs) return "";

    if (typeof specs === "object") {
        return JSON.stringify(specs);
    }

    return String(specs);
}

function uniqueReasons(reasons) {
    return [...new Set(reasons)];
}

function invalidateResults() {
    compareResults.hidden = true;
    comparisonTable.innerHTML = "";
    analysisCards.innerHTML = "";
    compareMessage.textContent = "";
}


/* =========================================================
   CHARGEMENT DES BUILDS
========================================================= */

async function loadAvailableBuilds() {
    try {
        const response = await fetch("/api/builds");

        if (!response.ok) {
            throw new Error("Impossible de charger les builds.");
        }

        availableBuilds = await response.json();

        if (!Array.isArray(availableBuilds)) {
            throw new Error("Réponse invalide du serveur.");
        }

        addBuildSelector();
        addBuildSelector();

        if (availableBuilds.length < 2) {
            compareMessage.textContent =
                "Sauvegarde au moins deux builds pour pouvoir les comparer.";
        }

    } catch (error) {
        compareMessage.textContent = error.message;
    }
}

/* =========================================================
   SÉLECTEURS DYNAMIQUES
========================================================= */

function addBuildSelector() {
    selectorCounter++;

    const card = document.createElement("div");
    card.className = "build-selector-card";

    const header = document.createElement("div");
    header.className = "build-selector-header";

    const title = document.createElement("h3");
    title.textContent = `Build ${selectorCounter}`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-build";
    removeButton.textContent = "Retirer";

    removeButton.addEventListener("click", () => {
        if (selectorsContainer.children.length <= 2) {
            compareMessage.textContent =
                "Il faut conserver au moins deux emplacements.";
            return;
        }

        card.remove();
        invalidateResults();
    });

    header.append(title, removeButton);

    const select = document.createElement("select");
    select.className = "build-select";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choisir un build...";
    select.appendChild(placeholder);

    for (const build of availableBuilds) {
        const option = document.createElement("option");
        option.value = String(build.id);
        option.textContent =
            `${build.name} — ${formatPrice(build.total_price)}`;

        select.appendChild(option);
    }

    select.addEventListener("change", invalidateResults);

    card.append(header, select);
    selectorsContainer.appendChild(card);

    invalidateResults();
}


/* =========================================================
   TABLEAU COMPARATIF
========================================================= */

function renderComparisonTable(builds) {
    const headerCells = builds.map(build => {
        return `<th>${escapeHTML(build.name)}</th>`;
    }).join("");

    let rows = `
        <tr>
            <td>Prix total</td>
            ${builds.map(build => `
                <td>${escapeHTML(formatPrice(build.total_price))}</td>
            `).join("")}
        </tr>
    `;

    for (const category of CATEGORY_ORDER) {
        rows += `
            <tr>
                <td>${escapeHTML(CATEGORY_LABELS[category])}</td>

                ${builds.map(build => `
                    <td>
                        ${escapeHTML(getComponentNames(build, category))}
                    </td>
                `).join("")}
            </tr>
        `;
    }

    comparisonTable.innerHTML = `
        <table class="comparison-table">
            <thead>
                <tr>
                    <th>Critère</th>
                    ${headerCells}
                </tr>
            </thead>

            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}


/* =========================================================
   EXTRACTION PRUDENTE DES CARACTÉRISTIQUES
========================================================= */

function getRamCapacityGB(build) {
    const ramComponents = getComponents(build, "RAM");

    if (!ramComponents.length) {
        return null;
    }

    let total = 0;

    for (const component of ramComponents) {
        const text = [
            component.name || "",
            parseSpecs(component.specs)
        ].join(" ");

        // Exemples : 2x16GB, 2 x 16 Go, 4x8GB
        const kitMatch = text.match(
            /\b(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(?:GB|Go)\b/i
        );

        if (kitMatch) {
            const quantity = Number(kitMatch[1]);
            const capacity = Number(
                kitMatch[2].replace(",", ".")
            );

            total += quantity * capacity;
            continue;
        }

        // Exemples : 32GB, 16 Go, 64 GB
        const capacityMatch = text.match(
            /\b(\d+(?:[.,]\d+)?)\s*(?:GB|Go)\b/i
        );

        if (capacityMatch) {
            total += Number(
                capacityMatch[1].replace(",", ".")
            );
            continue;
        }

        return null;
    }

    return total > 0 ? total : null;
}

function getStorageCapacityGB(build) {
    const storageComponents = getComponents(build, "Storage");

    if (!storageComponents.length) return null;

    let total = 0;

    for (const component of storageComponents) {
        const text = `${component.name || ""} ${parseSpecs(component.specs)}`;

        const match = text.match(
            /(\d+(?:[.,]\d+)?)\s*(TB|To|GB|Go)\b/i
        );

        if (!match) {
            return null;
        }

        const value = Number(match[1].replace(",", "."));
        const unit = match[2].toLowerCase();

        total += unit === "tb" || unit === "to"
            ? value * 1000
            : value;
    }

    return total;
}

function getPsuWattage(build) {
    const psu = getComponents(build, "PSU")[0];

    if (!psu) return null;

    const text = `${psu.name || ""} ${parseSpecs(psu.specs)}`;
    const match = text.match(/\b(\d{3,4})\s*W\b/i);

    return match ? Number(match[1]) : null;
}


/* =========================================================
   ANALYSE DE CHAQUE BUILD
========================================================= */

function analyzeBuild(build, allBuilds) {
    const advantages = [];
    const disadvantages = [];
    const badges = [];

    const otherBuilds = allBuilds.filter(
        other => other.id !== build.id
    );

    const currentPrice = getValidPrice(build.total_price);

    const otherPrices = otherBuilds
        .map(other => getValidPrice(other.total_price))
        .filter(price => price !== null);

    const allPrices = allBuilds
        .map(other => getValidPrice(other.total_price))
        .filter(price => price !== null);

    /* -------------------------
       PRIX
    ------------------------- */

    if (currentPrice !== null && allPrices.length === allBuilds.length) {
        const minimumPrice = Math.min(...allPrices);
        const maximumPrice = Math.max(...allPrices);

        if (currentPrice === minimumPrice) {
            badges.push("💰 Prix le plus bas");

            advantages.push(
                `Ce build est l'un des moins chers de la sélection, avec un total de ${formatPrice(currentPrice)}.`
            );
        }

        if (currentPrice === maximumPrice && maximumPrice > minimumPrice) {
            disadvantages.push(
                `Ce build est l'un des plus chers de la sélection (${formatPrice(currentPrice)}).`
            );
        }

        if (otherPrices.length) {
            const cheapestOther = Math.min(...otherPrices);

            if (currentPrice < cheapestOther) {
                advantages.push(
                    `Il coûte ${formatPrice(cheapestOther - currentPrice)} de moins que le moins cher des autres builds.`
                );
            }
        }
    } else {
        disadvantages.push(
            "Les prix ne sont pas tous renseignés : la comparaison budgétaire reste limitée."
        );
    }

    /* -------------------------
       RAM
    ------------------------- */

    const ram = getRamCapacityGB(build);

    const otherRamValues = otherBuilds
        .map(getRamCapacityGB)
        .filter(value => value !== null);

    if (ram !== null) {
        advantages.push(
            `Il possède ${ram} Go de RAM, une caractéristique utile pour évaluer sa capacité mémoire.`
        );

        if (
            otherRamValues.length === otherBuilds.length &&
            otherRamValues.length > 0
        ) {
            const maximumOtherRam = Math.max(...otherRamValues);
            const minimumOtherRam = Math.min(...otherRamValues);

            if (ram > maximumOtherRam) {
                badges.push("🧠 Plus grande capacité RAM");

                advantages.push(
                    `Il dispose de davantage de RAM que tous les autres builds comparés (${ram} Go contre au maximum ${maximumOtherRam} Go).`
                );
            }

            if (ram < minimumOtherRam) {
                disadvantages.push(
                    `Il possède moins de RAM que les autres builds (${ram} Go contre au minimum ${minimumOtherRam} Go).`
                );
            }
        }
    } else {
        disadvantages.push(
            "La capacité exacte de RAM n'a pas pu être déterminée à partir des informations enregistrées."
        );
    }

    /* -------------------------
       STOCKAGE
    ------------------------- */

    const storage = getStorageCapacityGB(build);

    const otherStorageValues = otherBuilds
        .map(getStorageCapacityGB)
        .filter(value => value !== null);

    if (storage !== null) {
        advantages.push(
            `Sa capacité de stockage identifiable est d'environ ${storage} Go.`
        );

        if (
            otherStorageValues.length === otherBuilds.length &&
            otherStorageValues.length > 0
        ) {
            const maximumOtherStorage = Math.max(...otherStorageValues);
            const minimumOtherStorage = Math.min(...otherStorageValues);

            if (storage > maximumOtherStorage) {
                badges.push("💾 Plus grande capacité de stockage");

                advantages.push(
                    `Il offre plus d'espace de stockage que les autres configurations comparées.`
                );
            }

            if (storage < minimumOtherStorage) {
                disadvantages.push(
                    "Il possède moins d'espace de stockage que les autres configurations."
                );
            }
        }
    }

    /* -------------------------
       ALIMENTATION
    ------------------------- */

    const wattage = getPsuWattage(build);

    if (wattage !== null) {
        advantages.push(
            `Son alimentation est annoncée à ${wattage} W.`
        );
    }

    /* -------------------------
       PRÉSENCE DES COMPOSANTS
    ------------------------- */

    for (const category of ["CPU", "GPU", "RAM", "Motherboard", "Storage", "PSU"]) {
        if (!getComponents(build, category).length) {
            disadvantages.push(
                `${CATEGORY_LABELS[category]} : aucun composant renseigné.`
            );
        }
    }

    /* -------------------------
       GAMING
    ------------------------- */

    const hasGpu = getComponents(build, "GPU").length > 0;
    const hasCpu = getComponents(build, "CPU").length > 0;

    if (hasGpu && hasCpu) {
        advantages.push(
            "Ce build possède un processeur et une carte graphique dédiés dans sa configuration. Leurs performances exactes doivent être vérifiées pour juger son niveau en gaming."
        );
    }

    /* -------------------------
       BILAN
    ------------------------- */

    if (!advantages.length) {
        advantages.push(
            "Aucun avantage mesurable n'a été identifié avec les données disponibles."
        );
    }

    if (!disadvantages.length) {
        disadvantages.push(
            "Aucune limite particulière n'a été identifiée dans les critères analysés."
        );
    }

    return {
        advantages: uniqueReasons(advantages),
        disadvantages: uniqueReasons(disadvantages),
        badges: uniqueReasons(badges)
    };
}


/* =========================================================
   AFFICHAGE DES ANALYSES
========================================================= */

function renderAnalysis(builds) {
    analysisCards.innerHTML = "";

    for (const build of builds) {
        const analysis = analyzeBuild(build, builds);

        const card = document.createElement("article");
        card.className = "analysis-card";

        const badgesHTML = analysis.badges
            .map(badge => `
                <span class="analysis-badge">
                    ${escapeHTML(badge)}
                </span>
            `)
            .join("");

        const advantagesHTML = analysis.advantages
            .map(reason => `<li>${escapeHTML(reason)}</li>`)
            .join("");

        const disadvantagesHTML = analysis.disadvantages
            .map(reason => `<li>${escapeHTML(reason)}</li>`)
            .join("");

        card.innerHTML = `
            <h3>${escapeHTML(build.name)}</h3>

            <div>${badgesHTML}</div>

            <h4>✅ Pourquoi choisir ce build ?</h4>
            <ul>${advantagesHTML}</ul>

            <h4>⚠️ Ses limites</h4>
            <ul>${disadvantagesHTML}</ul>

            <p class="analysis-note">
                Analyse basée sur les prix, les composants et les
                caractéristiques identifiables dans la base locale.
                Aucun benchmark n'est supposé.
            </p>
        `;

        analysisCards.appendChild(card);
    }
}


/* =========================================================
   COMPARAISON
========================================================= */

async function compareBuilds() {
    const selects = [
        ...document.querySelectorAll(".build-select")
    ];

    const selectedIds = selects
        .map(select => select.value)
        .filter(Boolean);

    if (selectedIds.length < 2) {
        compareMessage.textContent =
            "Sélectionne au moins deux builds.";
        return;
    }

    if (new Set(selectedIds).size !== selectedIds.length) {
        compareMessage.textContent =
            "Tu ne peux pas comparer plusieurs fois le même build.";
        return;
    }

    compareButton.disabled = true;
    compareMessage.textContent = "Analyse des builds en cours...";
    compareResults.hidden = true;

    try {
        const builds = await Promise.all(
            selectedIds.map(async id => {
                const response = await fetch(
                    `/api/builds/${encodeURIComponent(id)}`
                );

                if (!response.ok) {
                    throw new Error(
                        `Impossible de récupérer le build ${id}.`
                    );
                }

                return response.json();
            })
        );

        renderComparisonTable(builds);
        renderAnalysis(builds);

        compareResults.hidden = false;

        compareMessage.textContent =
            `${builds.length} builds comparés avec succès.`;

        compareResults.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        compareMessage.textContent = error.message;
    } finally {
        compareButton.disabled = false;
    }
}


/* =========================================================
   ÉVÉNEMENTS
========================================================= */

addBuildButton.addEventListener("click", addBuildSelector);
compareButton.addEventListener("click", compareBuilds);

loadAvailableBuilds();

/* =========================================================
   ANALYSE IA LOCALE — QWEN / LM STUDIO
   Cette partie complète le comparateur existant.
========================================================= */

(() => {
    "use strict";

    const aiButton = document.getElementById("ai-analyze-button");
    const aiMessage = document.getElementById("ai-analysis-message");
    const aiResult = document.getElementById("ai-analysis-result");
    const aiContent = document.getElementById("ai-analysis-content");

// Indicateurs de progression Qwen
const aiProgress = document.getElementById("ai-progress");
const aiElapsed = document.getElementById("ai-elapsed");
const aiAverage = document.getElementById("ai-average");
const aiRemaining = document.getElementById("ai-remaining");
const aiPercent = document.getElementById("ai-percent");
const aiProgressBar = document.getElementById("ai-progress-bar");

// Convertit une durée en format MM:SS.
function formatDuration(seconds) {
    const totalSeconds = Math.max(0, Math.floor(seconds));

    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(remainingSeconds).padStart(2, "0")
    );
}

// Chronomètre de génération Qwen
let aiTimer = null;
let aiStartTime = 0;
let aiAverageSeconds = null;

// Actualise les indicateurs.
function updateAIProgress() {
    const elapsed = (Date.now() - aiStartTime) / 1000;

    aiElapsed.textContent = formatDuration(elapsed);

    if (aiAverageSeconds === null) {
        aiAverage.textContent = "--:--";
        aiRemaining.textContent = "--:--";
        aiPercent.textContent = "Estimation indisponible";
        aiProgressBar.value = 0;
        return;
    }

    const remaining = Math.max(0, aiAverageSeconds - elapsed);

    // Progression estimée, plafonnée à 99 %.
    const percent = Math.min(
        99,
        Math.floor((elapsed / aiAverageSeconds) * 100)
    );

    aiAverage.textContent = formatDuration(aiAverageSeconds);
    aiRemaining.textContent = formatDuration(remaining);
    aiPercent.textContent = `${percent} %`;
    aiProgressBar.value = percent;
}

// Démarre le chronomètre.
// Démarre le chronomètre Qwen.
async function startAITimer() {
    clearInterval(aiTimer);

    aiStartTime = Date.now();
    aiAverageSeconds = null;
    aiProgress.hidden = false;

    updateAIProgress();

    // Démarrer immédiatement le chronomètre.
    aiTimer = setInterval(updateAIProgress, 250);

    // Récupérer le temps moyen des analyses précédentes.
    try {
        const response = await fetch("/api/ai/stats");

        if (!response.ok) {
            throw new Error("Statistiques Qwen indisponibles.");
        }

        const data = await response.json();

        if (
            data.success &&
            Number.isFinite(data.averageSeconds) &&
            data.averageSeconds > 0
        ) {
            aiAverageSeconds = data.averageSeconds;
            updateAIProgress();
        }
    } catch (error) {
        console.warn("[AUAU IA] Temps moyen indisponible :", error);
    }
}

// Arrête le chronomètre.
function stopAITimer(success) {
    clearInterval(aiTimer);
    aiTimer = null;

    if (success) {
        aiElapsed.textContent = formatDuration(
            (Date.now() - aiStartTime) / 1000
        );

        aiPercent.textContent = "100 %";
        aiProgressBar.value = 100;
    } else {
        aiProgress.hidden = true;
    }
}


    /*
     * Tableau factuel provenant de l'API, jamais du texte de Qwen.
     * Compatible avec 2 à 6 configurations.
     */
    function renderVerifiedFacts(builds) {
        const section = document.createElement("section");
        section.className = "ai-verified-facts";

        const title = document.createElement("h3");
        title.textContent = "✅ Caractéristiques vérifiées";
        section.appendChild(title);

        const description = document.createElement("p");
        description.textContent =
            "Données enregistrées dans l'application, indépendantes de l'analyse IA.";
        section.appendChild(description);

        const container = document.createElement("div");
        container.style.overflowX = "auto";

        const table = document.createElement("table");
        table.className = "comparison-table";

        function componentsOf(build, category) {
            return (build.composants || []).filter(component =>
                String(component.categorie || "").toLowerCase() ===
                category.toLowerCase()
            );
        }

        function namesOf(build, category) {
            const components = componentsOf(build, category);

            return components.length
                ? components.map(component => component.nom).join(" ; ")
                : "Non renseigné";
        }

        function gpuSummary(build) {
    const cards = build.cartesGraphiques || [];

    if (!cards.length) {
        return namesOf(build, "GPU");
    }

    return cards.map(card => {
        const quantity = Number(card.quantite) || 1;
        const vram = Number(card.vramParCarteGo);

        const vramText = Number.isFinite(vram) && vram > 0
            ? `${vram} Go de VRAM par carte`
            : "VRAM non renseignée";

        const unitPrice = Number(card.prixUnitaire);
        const totalPrice = Number(card.prixTotal);

        const unitPriceText = Number.isFinite(unitPrice)
            ? ` — ${unitPrice.toLocaleString("fr-FR", {
                style: "currency",
                currency: "EUR"
            })} par carte`
            : "";

        const totalPriceText = Number.isFinite(totalPrice)
            ? ` — total GPU : ${totalPrice.toLocaleString("fr-FR", {
                style: "currency",
                currency: "EUR"
            })}`
            : "";

        return `${quantity} × ${card.nom} — ${vramText}${unitPriceText}${totalPriceText}`;
    }).join(" ; ");
}

function ramSummary(build) {
    const ram = build.ram || {};
    const capacity = Number(ram.capaciteGo);

    if (Number.isFinite(capacity) && capacity > 0) {
        return `${capacity} Go de RAM ${ram.type || "type non confirmé"}`;
    }

    return namesOf(build, "RAM");
}

        function storageSummary(build) {
            const storage = build.stockage || {};
            const total = Number(storage.capaciteGo);

            if (Number.isFinite(total) && total > 0) {
                return `${total.toLocaleString("fr-FR")} Go`;
            }

            return storage.capacite || "Non déterminé";
        }

        const rows = [
    ["Prix total du PC", build => build.prix || "Non renseigné"],

    ["Processeur", build => namesOf(build, "CPU")],

    ["Cartes graphiques et prix", gpuSummary],

    ["Mémoire vive RAM", ramSummary],

    ["Carte mère", build => namesOf(build, "Motherboard")],

    ["Stockage total", storageSummary],

    ["Alimentation", build => namesOf(build, "PSU")],

    [
        "Refroidissement CPU",
        build => build.refroidissement?.refroidissementCPU
            || namesOf(build, "Cooling")
    ],

    [
        "Ventilation du boîtier",
        build => build.refroidissement?.ventilationBoitier
            || namesOf(build, "Fans")
    ],

    [
        "Boîtier",
        build => build.refroidissement?.boitier
            || namesOf(build, "Case")
    ],

    ["Pâte thermique", build => namesOf(build, "Thermal Paste")]
];

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        const criterionHeader = document.createElement("th");
        criterionHeader.textContent = "Critère";
        headerRow.appendChild(criterionHeader);

        for (const build of builds) {
            const th = document.createElement("th");
            th.textContent = build.nom || `Configuration ${build.id}`;
            headerRow.appendChild(th);
        }

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        for (const [label, getValue] of rows) {
            const tr = document.createElement("tr");

            const labelCell = document.createElement("td");
            labelCell.textContent = label;
            tr.appendChild(labelCell);

            for (const build of builds) {
                const td = document.createElement("td");
                td.textContent = String(getValue(build) ?? "Non renseigné");
                tr.appendChild(td);
            }

            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        container.appendChild(table);
        section.appendChild(container);

        const gpuNote = document.createElement("p");
        gpuNote.textContent =
            "Note : la VRAM de plusieurs cartes graphiques ne s'additionne pas automatiquement.";
        section.appendChild(gpuNote);

        return section;
    }

function formatQwenMarkdown(text) {
    // Échapper les caractères HTML pour empêcher l'injection de code.
    function escapeHTML(value) {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    let html = escapeHTML(text);

    // Retirer les antislashs parasites devant la syntaxe Markdown.
    html = html.replace(/\\([#*`_~])/g, "$1");

    // Titres Markdown.
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h2>$1</h2>");

    // Gras et italique.
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Séparateurs.
    html = html.replace(/^---+$/gm, "<hr>");

    // Listes à puces.
    html = html.replace(/^\s*[-•]\s+(.+)$/gm, "<li>$1</li>");
    html = html.replace(/(?:<li>.*<\/li>\s*)+/gs, function (list) {
        return "<ul>" + list + "</ul>";
    });

    // Sauts de ligne.
    html = html.replace(/\n/g, "<br>");

    return html;
}

    aiButton.addEventListener("click", async () => {
        // Les sélecteurs créés par le comparateur utilisent
        // l'identifiant de build comme valeur.
        const selectors = document.querySelectorAll("#build-selectors select");
        const buildIds = [];

        selectors.forEach((select) => {
            if (select.value) {
                const id = Number(select.value);

                if (Number.isInteger(id) && id > 0) {
                    buildIds.push(id);
                }
            }
        });

        const uniqueIds = [...new Set(buildIds)];

        if (uniqueIds.length < 2) {
            aiMessage.textContent =
                "Sélectionne au moins deux builds différents avant de lancer Qwen.";
            aiResult.hidden = true;
            return;
        }

        if (uniqueIds.length > 6) {
            aiMessage.textContent =
                "Sélectionne au maximum six builds pour l'analyse IA.";
            aiResult.hidden = true;
            return;
        }

        aiButton.disabled = true;
        aiButton.textContent = "⏳ Analyse avec Qwen en cours…";
        aiMessage.textContent =
            "Analyse avec Qwen local en cours… L'analyse peut prendre quelques instants.";
        aiResult.hidden = true;
        aiContent.textContent = "";

// Démarrer le chronomètre Qwen
        startAITimer();

        try {
            const response = await fetch("/api/ai/compare", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    buildIds: uniqueIds
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || data.message ||
                    `Erreur du serveur (${response.status}).`
                );
            }

            if (!data.success || !data.analysis) {
                throw new Error(
                    data.error || "Qwen n'a pas renvoyé d'analyse."
                );
            }

            // Afficher d'abord les données vérifiées par le serveur.
            aiContent.replaceChildren();

            if (Array.isArray(data.builds) && data.builds.length >= 2) {
                aiContent.appendChild(renderVerifiedFacts(data.builds));
            }

            // L'analyse IA reste distincte des caractéristiques vérifiées.
            const aiTitle = document.createElement("h3");
            aiTitle.textContent = "🤖 Conseils et interprétation de Qwen";
            aiContent.appendChild(aiTitle);

            const aiWarning = document.createElement("p");
            aiWarning.textContent =
                "Cette analyse est générée par une IA locale et peut contenir " +
                "des erreurs. En cas de contradiction, consulte les " +
                "caractéristiques vérifiées ci-dessus.";
            aiContent.appendChild(aiWarning);

            const aiText = document.createElement("div");
            aiText.className = "ai-generated-commentary";
            aiText.innerHTML = formatQwenMarkdown(data.analysis);
            aiText.style.lineHeight = "1.7";
            aiContent.appendChild(aiText);

            aiResult.hidden = false;

            aiMessage.textContent =
                `✅ Analyse terminée avec ${data.model || "Qwen"}.`;
            // Analyse terminée avec succès
             stopAITimer(true);
            aiResult.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
       } catch (error) {
    console.error("Erreur Qwen :", error);

    // Arrêter le chronomètre si Qwen échoue
    stopAITimer(false);

    aiMessage.textContent =
        `❌ ${error.message} Vérifie que LM Studio et le serveur Node.js sont démarrés.`;
} finally {
    aiButton.disabled = false;
    aiButton.textContent = "🤖 Analyser avec Qwen";
}
    });

    console.log("Module d'analyse Qwen initialisé.");
})();
