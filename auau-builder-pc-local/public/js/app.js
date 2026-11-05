// ========================================
// AUAU BUILDER - APP.JS
// ========================================

let components = [];
let selectedComponents = {};
let currentCategory = null;


// ========================================
// CHARGER LES COMPOSANTS
// ========================================

async function loadComponents() {

    try {

        const response =
            await fetch("/api/components");

        if (!response.ok) {
            throw new Error(
                "Impossible de charger les composants"
            );
        }

        components =
            await response.json();

        console.log(
            "Composants chargés :",
            components
        );

    } catch (error) {

        console.error(error);

        const list =
            document.getElementById(
                "component-list"
            );

        if (list) {

            list.innerHTML = `
                <div class="component-error">
                    Impossible de charger les composants.
                </div>
            `;
        }
    }
}


// ========================================
// NOM DES CATÉGORIES
// ========================================

function getCategoryName(category) {

    const names = {

        CPU: "Processeur",

        GPU: "Carte graphique",

        RAM: "Mémoire vive",

        Motherboard: "Carte mère",

        Storage: "Stockage",

        PSU: "Alimentation",

        Case: "Boîtier",

        Fans: "Ventilateurs",

        Cooling: "Ventirad / Watercooling",

        "Thermal Paste": "Pâte thermique"
    };

    return names[category] || category;
}


// ========================================
// OUVRIR UNE CATÉGORIE
// ========================================

function openCategory(category) {

    currentCategory =
        category;

    const layout =
        document.getElementById(
            "builder-layout"
        );

    const panel =
        document.getElementById(
            "component-panel"
        );

    const title =
        document.getElementById(
            "panel-title"
        );

    const subtitle =
        document.getElementById(
            "panel-subtitle"
        );

    if (!layout || !panel) {
        return;
    }

    layout.classList.add(
        "panel-open"
    );

    panel.classList.add(
        "open"
    );

    if (title) {

        title.textContent =
            getCategoryName(
                category
            );
    }

    if (subtitle) {

        subtitle.textContent =
            "Choisis un composant";
    }

    displayComponents(
        category
    );
}


// ========================================
// AFFICHER LES COMPOSANTS
// ========================================

function displayComponents(category) {

    const list =
        document.getElementById(
            "component-list"
        );

    if (!list) {
        return;
    }

    list.innerHTML = "";

    const filtered =
        components.filter(
            component =>
                component.category ===
                category
        );

    if (filtered.length === 0) {

        list.innerHTML = `
            <div class="component-empty">
                Aucun composant disponible dans cette catégorie.
            </div>
        `;

        return;
    }

    filtered.forEach(
        component => {

            const card =
                document.createElement(
                    "article"
                );

            card.className =
                "builder-component-card";

            card.innerHTML = `

                <div class="component-card-category">
                    ${getCategoryName(
                        component.category
                    )}
                </div>

                <h3>
                    ${escapeHtml(
                        component.name
                    )}
                </h3>

                <p class="component-brand">
                    ${escapeHtml(
                        component.brand ||
                        "Marque non renseignée"
                    )}
                </p>

                <p class="component-specs">
                    ${escapeHtml(
                        component.specs ||
                        "Aucune spécification"
                    )}
                </p>

                <div class="component-card-bottom">

                    <div class="component-price-editor">

                        <label>
                            Prix
                        </label>

                        <div class="price-row">

                            <input
                                class="component-price-input"
                                type="number"
                                min="0"
                                step="0.01"
                                value="${Number.parseFloat(
                                    component.price || 0
                                ).toFixed(2)}"
                                data-component-id="${component.id}"
                            >

                            <span>€</span>

                        </div>

                        <button
                            type="button"
                            class="update-price-button"
                            data-id="${component.id}"
                        >
                            Modifier le prix
                        </button>

                    </div>

                    <button
                        type="button"
                        class="select-component-button"
                        data-id="${component.id}"
                    >
                        Sélectionner
                    </button>

                </div>
            `;

            list.appendChild(
                card
            );
        }
    );


    // ========================================
    // BOUTONS MODIFIER LE PRIX
    // ========================================

    list
        .querySelectorAll(
            ".update-price-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async event => {

                        event.stopPropagation();

                        const id =
                            Number(
                                button.dataset.id
                            );

                        await updateComponentPrice(
                            id
                        );
                    }
                );
            }
        );


    // ========================================
    // BOUTONS SÉLECTIONNER
    // ========================================

    list
        .querySelectorAll(
            ".select-component-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        const id =
                            Number(
                                button.dataset.id
                            );

                        selectComponent(
                            id
                        );
                    }
                );
            }
        );
}


// ========================================
// MODIFIER LE PRIX
// ========================================

async function updateComponentPrice(
    componentId
) {

    const input =
        document.querySelector(
            `.component-price-input[data-component-id="${componentId}"]`
        );

    if (!input) {
        return;
    }

    const newPrice =
        Number(
            input.value
        );

    if (
        !Number.isFinite(newPrice) ||
        newPrice < 0
    ) {

        alert(
            "Le prix doit être un nombre positif."
        );

        return;
    }

    try {

        const response =
            await fetch(
                `/api/components/${componentId}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            price: newPrice
                        })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            alert(
                data.error ||
                "Impossible de modifier le prix."
            );

            return;
        }


        // Mise à jour locale

        const component =
            components.find(
                item =>
                    item.id ===
                    componentId
            );

        if (component) {

            component.price =
                newPrice;
        }


        // Mise à jour des sélections

        Object.values(
            selectedComponents
        ).forEach(
            categoryComponents => {

                categoryComponents.forEach(
                    selectedComponent => {

                        if (
                            selectedComponent.id ===
                            componentId
                        ) {

                            selectedComponent.price =
                                newPrice;
                        }
                    }
                );
            }
        );


        updateSelectedComponent(
            currentCategory
        );

        updateTotal();

        displayComponents(
            currentCategory
        );

        alert(
            "Prix modifié avec succès."
        );

    } catch (error) {

        console.error(error);

        alert(
            "Erreur de connexion avec le serveur."
        );
    }
}


// ========================================
// SÉLECTIONNER UN COMPOSANT
// ========================================

function selectComponent(
    componentId
) {

    const component =
        components.find(
            item =>
                item.id ===
                componentId
        );

    if (!component) {
        return;
    }

    if (
        !selectedComponents[
            component.category
        ]
    ) {

        selectedComponents[
            component.category
        ] = [];
    }

    selectedComponents[
        component.category
    ].push({

        id:
            component.id,

        name:
            component.name,

        price:
            Number.parseFloat(
                component.price
            ) || 0,

        brand:
            component.brand || "",

        specs:
            component.specs || ""
    });

    updateSelectedComponent(
        component.category
    );

    updateTotal();
}


// ========================================
// AFFICHER LES COMPOSANTS SÉLECTIONNÉS
// ========================================

function updateSelectedComponent(
    category
) {

    const container =
        document.querySelector(
            `.selected-component[data-selected-for="${category}"]`
        );

    if (!container) {
        return;
    }

    const selected =
        selectedComponents[
            category
        ] || [];

    if (
        selected.length === 0
    ) {

        container.innerHTML = "";

        container.classList.remove(
            "has-selection"
        );

        return;
    }

    container.classList.add(
        "has-selection"
    );

    container.innerHTML =
        selected
            .map(
                (
                    component,
                    index
                ) => `

                    <div class="selected-component-content">

                        <span class="selected-label">
                            SÉLECTIONNÉ
                        </span>

                        <strong>
                            ${escapeHtml(
                                component.name
                            )}
                        </strong>

                        <span class="selected-price">
                            ${Number.parseFloat(
                                component.price || 0
                            ).toFixed(2)} €
                        </span>

                    </div>

                    <button
                        type="button"
                        class="remove-selected"
                        data-index="${index}"
                        aria-label="Retirer le composant"
                    >
                        ×
                    </button>
                `
            )
            .join("");


    container
        .querySelectorAll(
            ".remove-selected"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        event.stopPropagation();

                        const index =
                            Number(
                                button.dataset.index
                            );

                        removeSelectedComponent(
                            category,
                            index
                        );
                    }
                );
            }
        );
}


// ========================================
// RETIRER UN COMPOSANT
// ========================================

function removeSelectedComponent(
    category,
    index
) {

    if (
        !selectedComponents[
            category
        ]
    ) {
        return;
    }

    selectedComponents[
        category
    ].splice(
        index,
        1
    );

    if (
        selectedComponents[
            category
        ].length === 0
    ) {

        delete selectedComponents[
            category
        ];
    }

    updateSelectedComponent(
        category
    );

    updateTotal();
}


// ========================================
// CALCUL DU TOTAL
// ========================================

function updateTotal() {

    let total = 0;

    Object.values(
        selectedComponents
    ).forEach(
        categoryComponents => {

            categoryComponents.forEach(
                component => {

                    total +=
                        Number.parseFloat(
                            component.price
                        ) || 0;
                }
            );
        }
    );

    const totalElement =
        document.getElementById(
            "total-price"
        );

    if (totalElement) {

        totalElement.textContent =
            `${total.toFixed(2)} €`;
    }
}


// ========================================
// FERMER LE PANNEAU
// ========================================

function closePanel() {

    const layout =
        document.getElementById(
            "builder-layout"
        );

    const panel =
        document.getElementById(
            "component-panel"
        );

    if (layout) {

        layout.classList.remove(
            "panel-open"
        );
    }

    if (panel) {

        panel.classList.remove(
            "open"
        );
    }

    currentCategory =
        null;
}


// ========================================
// ÉCHAPPER LE HTML
// ========================================

function escapeHtml(
    value
) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value ?? "";

    return div.innerHTML;
}


// ========================================
// TROUVER LA CATÉGORIE
// ========================================

function getComponentCategory(
    componentId
) {

    const component =
        components.find(
            item =>
                item.id ===
                componentId
        );

    return component
        ? component.category
        : "";
}


// ========================================
// TROUVER LE CHAMP DU NOM
// ========================================

function getBuildNameInput() {

    return document.querySelector(
        ".build-name, #build-name, #configuration-name"
    );
}


// ========================================
// SAUVEGARDER / MODIFIER LE BUILD
// ========================================

async function saveBuild() {

    // Empêcher plusieurs fenêtres de confirmation

    const existingModal =
        document.querySelector(
            ".save-confirmation-modal"
        );

    if (existingModal) {
        return;
    }


    // ========================================
    // RÉCUPÉRER L'ID
    // ========================================

    const params =
        new URLSearchParams(
            window.location.search
        );

    const buildId =
        params.get("id");


    // ========================================
    // RÉCUPÉRER LE NOM
    // ========================================

    const nameInput =
        getBuildNameInput();

    if (!nameInput) {

        alert(
            "Le champ « Nom de la configuration » est introuvable."
        );

        return;
    }

    const buildName =
        nameInput.value.trim();


    if (!buildName) {

        alert(
            "Entre un nom pour la configuration."
        );

        nameInput.focus();

        return;
    }


    // ========================================
    // RÉCUPÉRER LES COMPOSANTS
    // ========================================

    const selected =
        Object.values(
            selectedComponents
        ).flat();

    if (
        selected.length === 0
    ) {

        alert(
            "Sélectionne au moins un composant avant de sauvegarder."
        );

        return;
    }


    // ========================================
    // CALCULER LE TOTAL
    // ========================================

    const totalPrice =
        selected.reduce(
            (
                total,
                component
            ) => {

                return total +
                    (
                        Number.parseFloat(
                            component.price
                        ) || 0
                    );

            },
            0
        );


    // ========================================
    // PRÉPARER LES COMPOSANTS
    // ========================================

    const buildComponents =
        selected.map(
            component => ({

                id:
                    component.id,

                category:
                    getComponentCategory(
                        component.id
                    )
            })
        );


    // ========================================
    // OUVRIR UNE SEULE VIGNETTE
    // ========================================

    openSaveConfirmation(
        buildId,
        buildName,
        totalPrice,
        buildComponents
    );
}


// ========================================
// VIGNETTE DE CONFIRMATION
// ========================================

function openSaveConfirmation(
    buildId,
    buildName,
    totalPrice,
    buildComponents
) {

    // Sécurité : une seule vignette

    if (
        document.querySelector(
            ".save-confirmation-modal"
        )
    ) {
        return;
    }


    const modal =
        document.createElement(
            "div"
        );

    modal.className =
        "save-confirmation-modal";

    modal.innerHTML = `

        <div class="save-confirmation-content">

            <div class="save-confirmation-icon">
                ✓
            </div>

            <h2>
                Confirmer la sauvegarde
            </h2>

            <p>
                Voulez-vous vraiment sauvegarder
                le build
                <strong>
                    « ${escapeHtml(
                        buildName
                    )} »
                </strong>
                ?
            </p>

            <div class="save-confirmation-actions">

                <button
                    type="button"
                    class="cancel-save"
                >
                    Annuler
                </button>

                <button
                    type="button"
                    class="confirm-save"
                >
                    Confirmer
                </button>

            </div>

        </div>
    `;


    document.body.appendChild(
        modal
    );


    const cancelButton =
        modal.querySelector(
            ".cancel-save"
        );

    const confirmButton =
        modal.querySelector(
            ".confirm-save"
        );


    // ========================================
    // ANNULER
    // ========================================

    cancelButton.addEventListener(
        "click",
        () => {

            modal.remove();
        }
    );


    // ========================================
    // CONFIRMER
    // ========================================

    confirmButton.addEventListener(
        "click",
        async () => {

            // Empêcher plusieurs clics

            if (
                confirmButton.disabled
            ) {
                return;
            }

            confirmButton.disabled =
                true;

            confirmButton.textContent =
                "Sauvegarde...";


            const isEditing =
                Boolean(
                    buildId
                );

            const url =
                isEditing
                    ? `/api/builds/${buildId}`
                    : "/api/builds";

            const method =
                isEditing
                    ? "PUT"
                    : "POST";


            try {

                const response =
                    await fetch(
                        url,
                        {
                            method,

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({

                                    name:
                                        buildName,

                                    total_price:
                                        totalPrice,

                                    components:
                                        buildComponents
                                })
                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    console.error(
                        "Erreur sauvegarde :",
                        data
                    );

                    alert(
                        data.error ||
                        "Impossible de sauvegarder le build."
                    );

                    confirmButton.disabled =
                        false;

                    confirmButton.textContent =
                        "Confirmer";

                    return;
                }


                // Fermer la vignette

                modal.remove();


                // Retour à l'accueil

                window.location.href =
                    "/index.html";

            } catch (error) {

                console.error(
                    "Erreur sauvegarde :",
                    error
                );

                alert(
                    "Erreur de connexion avec le serveur."
                );

                confirmButton.disabled =
                    false;

                confirmButton.textContent =
                    "Confirmer";
            }
        }
    );


    // ========================================
    // CLIQUER EN DEHORS
    // ========================================

    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal
            ) {

                modal.remove();
            }
        }
    );


    // ========================================
    // TOUCHE ESC
    // ========================================

    const handleEscape =
        event => {

            if (
                event.key === "Escape"
            ) {

                modal.remove();

                document.removeEventListener(
                    "keydown",
                    handleEscape
                );
            }
        };

    document.addEventListener(
        "keydown",
        handleEscape
    );
}


// ========================================
// CHARGER UN BUILD EXISTANT
// ========================================

async function loadExistingBuild() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const buildId =
        params.get("id");


    // Nouveau build

    if (!buildId) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/builds/${buildId}`
            );

        if (!response.ok) {

            throw new Error(
                "Impossible de charger le build"
            );
        }

        const build =
            await response.json();

        console.log(
            "Build chargé :",
            build
        );


        // ========================================
        // REMETTRE LE NOM DANS LE CHAMP
        // ========================================

        const nameInput =
            getBuildNameInput();

        if (nameInput) {

            nameInput.value =
                build.name || "";
        }


        // ========================================
        // RÉINITIALISER
        // ========================================

        selectedComponents =
            {};


        // ========================================
        // CHARGER LES COMPOSANTS
        // ========================================

        if (
            Array.isArray(
                build.components
            )
        ) {

            build.components.forEach(
                component => {

                    if (
                        !selectedComponents[
                            component.category
                        ]
                    ) {

                        selectedComponents[
                            component.category
                        ] = [];
                    }

                    selectedComponents[
                        component.category
                    ].push({

                        id:
                            component.id,

                        name:
                            component.name,

                        price:
                            Number.parseFloat(
                                component.price
                            ) || 0,

                        brand:
                            component.brand || "",

                        specs:
                            component.specs || ""
                    });
                }
            );
        }


        // ========================================
        // AFFICHER LES SÉLECTIONS
        // ========================================

        Object.keys(
            selectedComponents
        ).forEach(
            category => {

                updateSelectedComponent(
                    category
                );
            }
        );


        // ========================================
        // TOTAL
        // ========================================

        updateTotal();


        console.log(
            `Build "${build.name}" chargé avec succès`
        );

    } catch (error) {

        console.error(
            error
        );

        alert(
            "Impossible de charger ce build."
        );
    }
}


// ========================================
// INITIALISATION
// ========================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        // Charger les composants

        await loadComponents();


        // ========================================
        // CATÉGORIES
        // ========================================

        document
            .querySelectorAll(
                ".category-card"
            )
            .forEach(
                card => {

                    card.addEventListener(
                        "click",
                        () => {

                            const category =
                                card.dataset.category;

                            openCategory(
                                category
                            );
                        }
                    );
                }
            );


        // ========================================
        // FERMER LE PANNEAU
        // ========================================

        const closeButton =
            document.getElementById(
                "close-panel"
            );

        if (closeButton) {

            closeButton.addEventListener(
                "click",
                closePanel
            );
        }


        // ========================================
        // BOUTON SAUVEGARDER
        // ========================================

        const saveButton =
            document.getElementById(
                "save-build"
            );

        if (saveButton) {

            saveButton.addEventListener(
                "click",
                saveBuild
            );
        }


        // ========================================
        // CHARGER LE BUILD EXISTANT
        // ========================================

        await loadExistingBuild();


        // ========================================
        // TOTAL
        // ========================================

        updateTotal();
    }
);
