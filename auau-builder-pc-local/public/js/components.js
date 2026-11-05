// ========================================
// COMPONENTS DB
// ========================================

let allComponents = [];

// ========================================
// ÉCHAPPER LE HTML
// ========================================

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

// ========================================
// RÉCUPÉRER UN COMPOSANT PAR ID
// ========================================

function getComponentById(componentId) {
    return allComponents.find(
        component => component.id === Number(componentId)
    );
}

// ========================================
// CHARGER LES COMPOSANTS
// ========================================

async function loadComponents() {
    try {
        const response = await fetch("/api/components");

        if (!response.ok) {
            throw new Error("Erreur lors du chargement des composants");
        }

        allComponents = await response.json();

        populateBrandFilter();
        filterComponents();

    } catch (error) {
        console.error(error);

        const container = document.getElementById("components-container");

        if (container) {
            container.innerHTML = `
                <div class="empty">
                    Impossible de charger les composants.
                </div>
            `;
        }
    }
}

// ========================================
// REMPLIR LE MENU DES MARQUES
// ========================================

function populateBrandFilter() {
    const brandFilter = document.getElementById("brand");

    if (!brandFilter) return;

    const currentBrand = brandFilter.value;
    const brands = new Set();

    allComponents.forEach(component => {
        if (!component.brand) return;

        const componentBrands = component.brand
            .split(/[\/,]/)
            .map(brand => brand.trim())
            .filter(Boolean);

        componentBrands.forEach(brand => brands.add(brand));
    });

    const sortedBrands = [...brands].sort((a, b) =>
        a.localeCompare(b, "fr")
    );

    brandFilter.innerHTML = `
        <option value="">Choisir une marque</option>
    `;

    sortedBrands.forEach(brand => {
        const option = document.createElement("option");
        option.value = brand;
        option.textContent = brand;
        brandFilter.appendChild(option);
    });

    if (sortedBrands.includes(currentBrand)) {
        brandFilter.value = currentBrand;
    }
}

// ========================================
// AFFICHER LES COMPOSANTS
// ========================================

function displayComponents(components) {
    const container = document.getElementById("components-container");
    const count = document.getElementById("components-count");

    if (!container) return;

    container.innerHTML = "";

    if (count) {
        count.textContent =
            `${components.length} composant${components.length > 1 ? "s" : ""}`;
    }

    if (components.length === 0) {
        container.innerHTML = `
            <div class="empty">
                Aucun composant trouvé.
            </div>
        `;
        return;
    }

    components.forEach(component => {
        const card = document.createElement("div");
        card.className = "db-component-card";

        card.innerHTML = `
            <div class="component-info">
                <div class="component-card-header">
                    <h3>${escapeHtml(component.name)}</h3>

                    <div class="component-card-actions">
                        <button
                            type="button"
                            class="edit-component-button"
                            title="Modifier le composant"
                            aria-label="Modifier le composant"
                        >
                            ✏️
                        </button>

                        <button
                            type="button"
                            class="delete-component-button"
                            title="Supprimer le composant"
                            aria-label="Supprimer le composant"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <p>
                    <strong>Catégorie :</strong>
                    ${escapeHtml(component.category)}
                </p>

                <p>
                    <strong>Marque :</strong>
                    ${component.brand
                        ? escapeHtml(component.brand)
                        : "Non renseignée"}
                </p>

                <p>
                    <strong>Specs :</strong>
                    ${component.specs
                        ? escapeHtml(component.specs)
                        : "Aucune spécification"}
                </p>
            </div>

            <div class="component-price">
                <label for="price-${component.id}">Prix</label>

                <div class="price-edit">
                    <input
                        type="number"
                        id="price-${component.id}"
                        value="${Number.parseFloat(component.price || 0).toFixed(2)}"
                        min="0"
                        step="0.01"
                    >

                    <span>€</span>
                </div>

                <button
                    type="button"
                    class="quick-price-button"
                >
                    Modifier le prix
                </button>
            </div>
        `;

        card.querySelector(".edit-component-button")
            .addEventListener("click", () => {
                openEditComponent(component.id);
            });

        card.querySelector(".delete-component-button")
            .addEventListener("click", () => {
                openDeleteComponent(component.id);
            });

        card.querySelector(".quick-price-button")
            .addEventListener("click", () => {
                updatePrice(component.id);
            });

        container.appendChild(card);
    });
}

// ========================================
// MODIFIER LE PRIX RAPIDEMENT
// ========================================

async function updatePrice(componentId) {
    const component = getComponentById(componentId);

    console.log("[DEBUG updatePrice] Composant :", component);

    if (!component) return;

    const input = document.getElementById(`price-${componentId}`);

    if (!input) return;

    const newPrice = Number(input.value);

    if (!Number.isFinite(newPrice) || newPrice < 0) {
        showTemporaryMessage(
            "Le prix doit être un nombre positif.",
            "error"
        );
        return;
    }

    try {
        const response = await fetch(`/api/components/${componentId}`, {
            method: "PUT",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name: component.name,
                category: component.category,
                price: newPrice,
                brand: component.brand || "",
                specs: component.specs || ""
            })
        });

        const data = await response.json();

        if (!response.ok) {
           console.error("[DEBUG updatePrice] Erreur serveur :", data);

            showTemporaryMessage(
                data.error || "Impossible de modifier le prix.",
                "error"
            );
            return;
        }

        await loadComponents();

        showTemporaryMessage(
            "Prix modifié avec succès.",
            "success"
        );

    } catch (error) {
        console.error(error);

        showTemporaryMessage(
            "Erreur de connexion avec le serveur.",
            "error"
        );
    }
}

// ========================================
// MODIFIER UN COMPOSANT
// ========================================

function openEditComponent(componentId) {
    const component = getComponentById(componentId);

    if (!component) return;

    const modal = document.createElement("div");
    modal.className = "component-modal";

    const categories = [
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

    const categoryOptions = categories.map(category => `
        <option
            value="${escapeHtml(category)}"
            ${component.category === category ? "selected" : ""}
        >
            ${escapeHtml(category)}
        </option>
    `).join("");

    modal.innerHTML = `
        <div class="component-modal-content">

            <div class="component-modal-header">
                <div>
                    <h2>Modifier le composant</h2>
                    <p>Modifie toutes les informations du composant.</p>
                </div>

                <button
                    type="button"
                    class="component-modal-close"
                    aria-label="Fermer"
                >
                    ×
                </button>
            </div>

            <form class="edit-component-form">

                <div class="edit-form-group">
                    <label>Nom</label>

                    <input
                        id="edit-component-name"
                        type="text"
                        value="${escapeHtml(component.name)}"
                        required
                    >
                </div>

                <div class="edit-form-group">
                    <label>Catégorie</label>

                    <select
                        id="edit-component-category"
                        required
                    >
                        ${categoryOptions}
                    </select>
                </div>

                <div class="edit-form-group">
                    <label>Prix</label>

                    <input
                        id="edit-component-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value="${Number.parseFloat(component.price || 0).toFixed(2)}"
                        required
                    >
                </div>

                <div class="edit-form-group">
                    <label>Marque</label>

                    <input
                        id="edit-component-brand"
                        type="text"
                        value="${escapeHtml(component.brand || "")}"
                    >
                </div>

                <div class="edit-form-group edit-form-group-full">
                    <label>Spécifications</label>

                    <textarea
                        id="edit-component-specs"
                        rows="5"
                    >${escapeHtml(component.specs || "")}</textarea>
                </div>

                <div class="edit-form-actions">
                    <button
                        type="button"
                        class="component-modal-cancel"
                    >
                        Annuler
                    </button>

                    <button
                        type="submit"
                        class="component-modal-save"
                    >
                        Enregistrer
                    </button>
                </div>

            </form>
        </div>
    `;

    document.body.appendChild(modal);

    const closeButton = modal.querySelector(".component-modal-close");
    const cancelButton = modal.querySelector(".component-modal-cancel");
    const form = modal.querySelector(".edit-component-form");

    function closeModal() {
        modal.remove();
    }

    closeButton.addEventListener("click", closeModal);
    cancelButton.addEventListener("click", closeModal);

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeModal();
        }
    });

    form.addEventListener("submit", event => {
        event.preventDefault();

        const name = document
            .getElementById("edit-component-name")
            .value.trim();

        const category = document
            .getElementById("edit-component-category")
            .value;

        const price = Number(
            document.getElementById("edit-component-price").value
        );

        const brand = document
            .getElementById("edit-component-brand")
            .value.trim();

        const specs = document
            .getElementById("edit-component-specs")
            .value.trim();

        if (
            !name ||
            !category ||
            !Number.isFinite(price) ||
            price < 0
        ) {
            showTemporaryMessage(
                "Vérifie les champs obligatoires.",
                "error"
            );
            return;
        }

        openSaveComponentConfirmation(
            componentId,
            {
                name,
                category,
                price,
                brand,
                specs
            },
            closeModal
        );
    });
}

// ========================================
// CONFIRMATION DE MODIFICATION
// ========================================

function openSaveComponentConfirmation(
    componentId,
    values,
    closeEditModal
) {
    const existing = document.querySelector(
        ".component-save-confirmation"
    );

    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.className = "component-save-confirmation";

    modal.innerHTML = `
        <div class="component-save-confirmation-content">

            <div class="component-save-confirmation-icon">
                ?
            </div>

            <h2>Enregistrer les modifications ?</h2>

            <p>
                Voulez-vous vraiment enregistrer
                les modifications du composant

                <strong>
                    « ${escapeHtml(values.name)} »
                </strong>
                ?
            </p>

            <div class="component-save-confirmation-actions">

                <button
                    type="button"
                    class="component-save-cancel"
                >
                    Annuler
                </button>

                <button
                    type="button"
                    class="component-save-confirm"
                >
                    Enregistrer
                </button>

            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const cancelButton = modal.querySelector(
        ".component-save-cancel"
    );

    const confirmButton = modal.querySelector(
        ".component-save-confirm"
    );

    cancelButton.addEventListener("click", () => {
        modal.remove();
    });

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            modal.remove();
        }
    });

    confirmButton.addEventListener("click", async () => {
        confirmButton.disabled = true;
        confirmButton.textContent = "Enregistrement...";

        try {
            const response = await fetch(
                `/api/components/${componentId}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(values)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                modal.remove();

                showTemporaryMessage(
                    data.error ||
                    "Impossible de modifier le composant.",
                    "error"
                );

                return;
            }

            modal.remove();
            closeEditModal();

            await loadComponents();

            showTemporaryMessage(
                "Composant modifié avec succès.",
                "success"
            );

        } catch (error) {
            console.error(error);
            modal.remove();

            showTemporaryMessage(
                "Erreur de connexion avec le serveur.",
                "error"
            );
        }
    });
}

// ========================================
// SUPPRIMER UN COMPOSANT
// ========================================

function openDeleteComponent(componentId) {
    const component = getComponentById(componentId);

    if (!component) return;

    const modal = document.createElement("div");
    modal.className = "component-delete-modal";

    modal.innerHTML = `
        <div class="component-delete-content">

            <div class="component-delete-icon">
                !
            </div>

            <h2>Supprimer le composant ?</h2>

            <p>
                Voulez-vous vraiment supprimer

                <strong>
                    « ${escapeHtml(component.name)} »
                </strong>

                de la base de données ?
            </p>

            <div class="component-delete-actions">

                <button
                    type="button"
                    class="component-delete-cancel"
                >
                    Annuler
                </button>

                <button
                    type="button"
                    class="component-delete-confirm"
                >
                    Supprimer
                </button>

            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const cancelButton = modal.querySelector(
        ".component-delete-cancel"
    );

    const confirmButton = modal.querySelector(
        ".component-delete-confirm"
    );

    cancelButton.addEventListener("click", () => {
        modal.remove();
    });

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            modal.remove();
        }
    });

    confirmButton.addEventListener("click", async () => {
        confirmButton.disabled = true;
        confirmButton.textContent = "Suppression...";

        try {
            const response = await fetch(
                `/api/components/${componentId}`,
                {
                    method: "DELETE"
                }
            );

            const data = await response.json();

            if (!response.ok) {
                modal.remove();

                showTemporaryMessage(
                    data.error ||
                    "Impossible de supprimer le composant.",
                    "error"
                );

                return;
            }

            modal.remove();

            await loadComponents();

            showTemporaryMessage(
                "Composant supprimé avec succès.",
                "success"
            );

        } catch (error) {
            console.error(error);
            modal.remove();

            showTemporaryMessage(
                "Erreur de connexion avec le serveur.",
                "error"
            );
        }
    });
}

// ========================================
// VIGNETTE TEMPORAIRE
// ========================================

function showTemporaryMessage(message, type = "success") {
    const existing = document.querySelector(
        ".temporary-component-message"
    );

    if (existing) existing.remove();

    const messageElement = document.createElement("div");

    messageElement.className =
        `temporary-component-message ${type}`;

    messageElement.innerHTML = `
        <div class="temporary-message-icon">
            ${type === "success" ? "✓" : "!"}
        </div>

        <span>${escapeHtml(message)}</span>
    `;

    document.body.appendChild(messageElement);

    setTimeout(() => {
        messageElement.classList.add("hide");

        setTimeout(() => {
            messageElement.remove();
        }, 250);

    }, 2200);
}

// ========================================
// RECHERCHE LOCALE
// ========================================

const searchInput = document.getElementById("search-input");

if (searchInput) {
    searchInput.addEventListener("input", filterComponents);
}

// ========================================
// FILTRE MARQUE
// ========================================

const brandFilter = document.getElementById("brand");

if (brandFilter) {
    brandFilter.addEventListener("change", filterComponents);
}

// ========================================
// FILTRE CATÉGORIE
// ========================================

const categoryFilter = document.getElementById("category");

if (categoryFilter) {
    categoryFilter.addEventListener("change", filterComponents);
}

// ========================================
// FILTRER LES COMPOSANTS
// ========================================

function filterComponents() {
    const search = searchInput
        ? searchInput.value.toLowerCase().trim()
        : "";

    const brand = brandFilter
        ? brandFilter.value
        : "";

    const category = categoryFilter
        ? categoryFilter.value
        : "";

    const filtered = allComponents.filter(component => {
        const componentName = component.name
            ? component.name.toLowerCase()
            : "";

        const matchesSearch = componentName.includes(search);

        let componentBrands = [];

        if (component.brand) {
            componentBrands = component.brand
                .split(/[\/,]/)
                .map(brand => brand.trim())
                .filter(Boolean);
        }

        const matchesBrand =
            brand === "" ||
            componentBrands.some(componentBrand =>
                componentBrand.toLowerCase() === brand.toLowerCase()
            );

        const matchesCategory =
            category === "" ||
            component.category === category;

        return (
            matchesSearch &&
            matchesBrand &&
            matchesCategory
        );
    });

    displayComponents(filtered);
}

// ========================================
// AJOUTER UN COMPOSANT MANUELLEMENT
// ========================================

const addForm = document.getElementById("add-component-form");

if (addForm) {
    addForm.addEventListener("submit", async event => {
        event.preventDefault();

        const name = document
            .getElementById("component-name")
            .value.trim();

        const category = document
            .getElementById("component-category")
            .value;

        const price = Number(
            document.getElementById("component-price").value
        );

        const brand = document
            .getElementById("component-brand")
            .value.trim();

        const specs = document
            .getElementById("component-specs")
            .value.trim();

        const message = document.getElementById("component-message");

        if (
            !name ||
            !category ||
            !Number.isFinite(price) ||
            price < 0
        ) {
            if (message) {
                message.textContent =
                    "Veuillez remplir correctement les champs obligatoires.";
            }

            return;
        }

        try {
            const response = await fetch("/api/components", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    name,
                    category,
                    price,
                    brand,
                    specs
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (message) {
                    message.textContent =
                        data.error ||
                        "Impossible d'ajouter le composant.";
                }

                return;
            }

            addForm.reset();

            if (message) {
                message.textContent = "";
            }

            await loadComponents();

            showTemporaryMessage(
                "Composant ajouté avec succès.",
                "success"
            );

        } catch (error) {
            console.error(error);

            if (message) {
                message.textContent =
                    "Erreur de connexion avec le serveur.";
            }
        }
    });
}

// ========================================
// CATÉGORIES VANTASPEC → AUAU BUILDER
// ========================================

const VANTASPEC_CATEGORY_MAP = {
    // CPU
    cpu: "CPU",
    cpus: "CPU",
    processors: "CPU",

    // GPU
    gpu: "GPU",
    gpus: "GPU",
    "graphics-cards": "GPU",

    // RAM
    ram: "RAM",
    memory: "RAM",
    "memory-ram": "RAM",
    "memory-kits": "RAM",

    // Carte mère
    motherboard: "Motherboard",
    motherboards: "Motherboard",

    // Stockage
    storage: "Storage",
    ssd: "Storage",
    ssds: "Storage",
    hdd: "Storage",
    hdds: "Storage",
    "hard-drives": "Storage",

    // Alimentations
    psu: "PSU",
    psus: "PSU",
    "power-supplies": "PSU",

    // Boîtiers
    case: "Case",
    cases: "Case",
    "pc-cases": "Case",

    // Refroidissement
    cooling: "Cooling",
    cooler: "Cooling",
    coolers: "Cooling",
    "cpu-coolers": "Cooling",
    "liquid-coolers": "Cooling",
    "water-cooling": "Cooling",
    watercooling: "Cooling",

    // Ventilateurs
    fan: "Fans",
    fans: "Fans",
    "case-fans": "Fans",

    // Pâte thermique
    "thermal-paste": "Thermal Paste",
    "thermal-pastes": "Thermal Paste",
    "thermal-compound": "Thermal Paste"
};

// ========================================
// CONVERTIR UNE CATÉGORIE
// ========================================

function getLocalCategory(product) {
    const slug = String(
        product.categorySlug || ""
    ).toLowerCase().trim();

    const name = String(
        product.category || ""
    ).toLowerCase().trim();

    const normalize = value =>
        value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[\s_]+/g, "-");

    return (
        VANTASPEC_CATEGORY_MAP[normalize(slug)] ||
        VANTASPEC_CATEGORY_MAP[normalize(name)] ||
        null
    );
}

// ========================================
// VÉRIFIER SI LE COMPOSANT EST DÉJÀ IMPORTÉ
// ========================================

function isAlreadyImported(product) {
    const name = String(product.name || "").trim().toLowerCase();

    return allComponents.some(component =>
        String(component.name || "").trim().toLowerCase() === name
    );
}

// ========================================
// IMPORTER DEPUIS INTERNET — VANTASPEC
// ========================================

const internetSearchInput =
    document.getElementById("internet-search-input");

const internetSearchButton =
    document.getElementById("internet-search-button");

const internetSearchStatus =
    document.getElementById("internet-search-status");

const internetResults =
    document.getElementById("internet-results");

// ========================================
// RECHERCHER SUR INTERNET
// ========================================

async function searchInternetComponents() {
    if (
        !internetSearchInput ||
        !internetSearchStatus ||
        !internetResults
    ) {
        return;
    }

    const query = internetSearchInput.value.trim();

    if (!query) {
        internetSearchStatus.textContent =
            "Saisis le nom d'un composant à rechercher.";

        internetResults.innerHTML = "";
        return;
    }

    internetSearchStatus.textContent =
        "Recherche en cours sur Internet...";

    internetResults.innerHTML = "";

    if (internetSearchButton) {
        internetSearchButton.disabled = true;
        internetSearchButton.textContent = "Recherche...";
    }

    try {
        const response = await fetch(
            `/api/import/search?q=${encodeURIComponent(query)}&limit=10`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "La recherche Internet a échoué."
            );
        }

        const products = Array.isArray(data)
            ? data
            : Array.isArray(data.products)
                ? data.products
                : Array.isArray(data.results)
                    ? data.results
                    : [];

        // Garder uniquement les catégories reconnues
        const filteredProducts = products.filter(product =>
            getLocalCategory(product) !== null
        );

        if (filteredProducts.length === 0) {
            internetSearchStatus.textContent =
                "Aucun composant compatible avec les catégories de la DB.";

            return;
        }

        internetSearchStatus.textContent =
            `${filteredProducts.length} résultat(s) trouvé(s).`;

        filteredProducts.forEach(product => {
            const card = document.createElement("article");
            card.className = "internet-product-card";

            const name = product.name || "Produit sans nom";
            const brand = product.brand || "Marque inconnue";

            const localCategory = getLocalCategory(product);

            const price = Number(product.price);

            const hasPrice =
                product.price !== null &&
                product.price !== undefined &&
                product.price !== "" &&
                Number.isFinite(price);

            const priceText = hasPrice
                ? `${price.toFixed(2)} ${product.currency || ""}`.trim()
                : "Prix indisponible";

            const imageUrl = isSafeInternetUrl(product.imageUrl)
                ? product.imageUrl
                : "";

            const productUrl = isSafeInternetUrl(product.productUrl)
                ? product.productUrl
                : "";

            card.innerHTML = `
                ${
                    imageUrl
                        ? `<img
                            src="${escapeHtml(imageUrl)}"
                            alt="${escapeHtml(name)}"
                            loading="lazy"
                        >`
                        : ""
                }

                <div class="internet-product-info">
                    <h3>${escapeHtml(name)}</h3>

                    <p>
                        <strong>Marque :</strong>
                        ${escapeHtml(brand)}
                    </p>

                    <p>
                        <strong>Catégorie :</strong>
                        ${escapeHtml(localCategory)}
                    </p>

                    <p>
                        <strong>Prix source :</strong>
                        ${escapeHtml(priceText)}
                    </p>

                    <p>
                        <strong>Vendeur :</strong>
                        ${escapeHtml(product.retailer || "Non renseigné")}
                    </p>

                    ${
                        product.description
                            ? `<p>${escapeHtml(product.description)}</p>`
                            : ""
                    }

                    ${
                        productUrl
                            ? `<a
                                href="${escapeHtml(productUrl)}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Voir le produit
                            </a>`
                            : ""
                    }
                </div>
            `;

            // ========================================
            // BOUTON IMPORTER DANS SQLITE
            // ========================================

            const importButton = document.createElement("button");

            importButton.type = "button";
            importButton.className = "internet-import-button";

            const alreadyImported = isAlreadyImported(product);

            importButton.textContent = alreadyImported
                ? "✅ Déjà dans la DB"
                : "📥 Importer dans la DB";

            importButton.disabled = alreadyImported;

            card.querySelector(".internet-product-info")
                .appendChild(importButton);

            importButton.addEventListener("click", async () => {
                const category = getLocalCategory(product);

                if (!category) {
                    showTemporaryMessage(
                        "Catégorie non reconnue.",
                        "error"
                    );
                    return;
                }

                if (isAlreadyImported(product)) {
                    importButton.disabled = true;
                    importButton.textContent = "✅ Déjà dans la DB";
                    return;
                }

                // La DB utilise des euros.
                // Le prix GBP reste dans les spécifications.
                const localPrice = 0;

                const specs = [
                    product.description || "",

                    product.externalId
                        ? `Source : VantaSpec (${product.externalId})`
                        : "",

                    hasPrice
                        ? `Prix source : ${price.toFixed(2)} ${product.currency || ""}`
                        : "Prix source indisponible",

                    product.productUrl
                        ? `Lien vendeur : ${product.productUrl}`
                        : "",

                    product.imageUrl
                        ? `Image : ${product.imageUrl}`
                        : ""
                ].filter(Boolean).join("\n");

                importButton.disabled = true;
                importButton.textContent = "Importation...";

                try {
                    const response = await fetch("/api/components", {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json"
                        },

                        body: JSON.stringify({
                            name: product.name,
                            category,
                            price: localPrice,
                            brand: product.brand || "",
                            specs
                        })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        if (response.status === 409) {
                            importButton.textContent = "✅ Déjà dans la DB";

                            showTemporaryMessage(
                                "Ce composant existe déjà dans la base.",
                                "error"
                            );

                            return;
                        }

                        throw new Error(
                            data.error ||
                            "Impossible d'importer le composant."
                        );
                    }

                    importButton.textContent = "✅ Importé";
                    importButton.disabled = true;

                    await loadComponents();

                    showTemporaryMessage(
                        "Composant importé dans SQLite avec succès !",
                        "success"
                    );

                } catch (error) {
                    console.error("Erreur importation :", error);

                    importButton.disabled = false;
                    importButton.textContent = "📥 Importer dans la DB";

                    showTemporaryMessage(
                        error.message || "Erreur pendant l'importation.",
                        "error"
                    );
                }
            });

            internetResults.appendChild(card);
        });

    } catch (error) {
        console.error("Erreur recherche Internet :", error);

        internetSearchStatus.textContent =
            error.message ||
            "Impossible de rechercher les produits. Vérifie le serveur.";

    } finally {
        if (internetSearchButton) {
            internetSearchButton.disabled = false;
            internetSearchButton.textContent =
                "Rechercher sur Internet";
        }
    }
}

// ========================================
// VÉRIFIER LES URL
// ========================================

function isSafeInternetUrl(value) {
    if (!value) return false;

    try {
        const url = new URL(value);

        return (
            url.protocol === "https:" ||
            url.protocol === "http:"
        );

    } catch {
        return false;
    }
}

// ========================================
// BOUTON RECHERCHE INTERNET
// ========================================

if (internetSearchButton) {
    internetSearchButton.addEventListener(
        "click",
        searchInternetComponents
    );
}

// ========================================
// RECHERCHE AVEC ENTRÉE
// ========================================

if (internetSearchInput) {
    internetSearchInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            searchInternetComponents();
        }
    });
}

// ========================================
// INITIALISATION
// ========================================

loadComponents();
