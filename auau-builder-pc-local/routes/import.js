const express = require("express");

const router = express.Router();

const VANTASPEC_API = "https://vantaspec.com/api/products/search";

// Correspondance entre les catégories de notre application
// et celles de VantaSpec.
const CATEGORY_MAP = {
    cpu: "cpus",
    cpus: "cpus",

    gpu: "gpus",
    gpus: "gpus",

    ram: "ram",

    motherboard: "motherboards",
    motherboards: "motherboards",

    storage: "storage",

    psu: "psus",
    psus: "psus",

    case: "cases",
    cases: "cases",

    cooling: "cooling",

    fans: "fans",

    "thermal paste": "thermal-paste",
    "thermal-paste": "thermal-paste"
};

// Détection automatique de la catégorie à partir
// des mots recherchés.
function detectCategory(query) {
    const q = query.toLowerCase();

    // Cartes graphiques
    if (
        /\brtx\b|\bgtx\b|\bgeforce\b|\bradeon\b|\brx\s?\d{4}\b/.test(q) ||
        q.includes("graphics card") ||
        q.includes("carte graphique")
    ) {
        return "gpus";
    }

    // Processeurs
    if (
        /\bryzen\b|\bthreadripper\b|\bprocessor\b|\bcpu\b/.test(q) ||
        /\bcore\s+i[3579]\b/.test(q) ||
        q.includes("core ultra") ||
        q.includes("processeur")
    ) {
        return "cpus";
    }

    // Alimentations
    if (
        /\brm(?:650|750|850|1000|1200)[a-z]?\b/.test(q) ||
        /\bpsu\b|\bpower supply\b/.test(q) ||
        q.includes("alimentation")
    ) {
        return "psus";
    }

    // Mémoire RAM
    if (
        /\bddr[345]\b|\bmemory\b|\bram\b/.test(q) ||
        q.includes("vengeance") ||
        q.includes("trident z")
    ) {
        return "ram";
    }

    // Cartes mères
    if (
        /\bmotherboard\b/.test(q) ||
        q.includes("carte mère") ||
        /\b(?:b650|b850|x670|x870|z790|z890)\b/.test(q)
    ) {
        return "motherboards";
    }

    // Stockage
    if (
        /\bssd\b|\bnvme\b|\bhdd\b/.test(q) ||
        q.includes("stockage")
    ) {
        return "storage";
    }

    // Pâte thermique
    if (
        q.includes("thermal paste") ||
        q.includes("pâte thermique")
    ) {
        return "thermal-paste";
    }

    // Ventilateurs
    if (
        q.includes("case fan") ||
        q.includes("ventilateur")
    ) {
        return "fans";
    }

    // Refroidissement
    if (
        /\baio\b/.test(q) ||
        q.includes("watercooling") ||
        q.includes("cpu cooler") ||
        q.includes("ventirad")
    ) {
        return "cooling";
    }

    // Boîtiers
    if (
        q.includes("pc case") ||
        q.includes("boîtier")
    ) {
        return "cases";
    }

    return "";
}

// Vérifie si le produit correspond à un PC complet.
function isCompletePC(product) {
    const categoryName = String(
        product.category?.name || ""
    ).toLowerCase();

    const categorySlug = String(
        product.category?.slug || ""
    ).toLowerCase();

    const name = String(
        product.name || ""
    ).toLowerCase();

    const excludedCategories = [
        "prebuilt",
        "gaming-pcs",
        "gaming pcs",
        "desktop-computers",
        "desktop computers",
        "complete-pcs"
    ];

    if (
        excludedCategories.some(
            (term) =>
                categoryName.includes(term) ||
                categorySlug.includes(term)
        )
    ) {
        return true;
    }

    const excludedNames = [
        "gaming pc",
        "desktop pc",
        "prebuilt pc",
        "gaming computer",
        "desktop computer",
        "ordinateur complet"
    ];

    return excludedNames.some((term) => name.includes(term));
}

// GET /api/import/search?q=RTX+5070
router.get("/search", async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();
        const requestedCategory = String(
            req.query.category || ""
        ).trim().toLowerCase();

        const brand = String(req.query.brand || "").trim();

        const page = Math.max(
            1,
            Number.parseInt(req.query.page, 10) || 1
        );

        const limit = Math.min(
            20,
            Math.max(
                1,
                Number.parseInt(req.query.limit, 10) || 10
            )
        );

        if (q.length < 2) {
            return res.status(400).json({
                error:
                    "La recherche doit contenir au moins 2 caractères."
            });
        }

        // Catégorie fournie par le frontend ou détectée
        // automatiquement à partir de la recherche.
        const category = requestedCategory
            ? CATEGORY_MAP[requestedCategory] || requestedCategory
            : detectCategory(q);

        // Préparation des paramètres VantaSpec
        const params = new URLSearchParams({
            q,
            page: String(page),
            limit: String(limit)
        });

        if (category) {
            params.set("category", category);
        }

        if (brand) {
            params.set("brand", brand);
        }

        // Recherche sur VantaSpec
        const response = await fetch(
            `${VANTASPEC_API}?${params.toString()}`,
            {
                signal: AbortSignal.timeout(10000)
            }
        );

        if (!response.ok) {
            return res.status(502).json({
                error: "VantaSpec a refusé la requête.",
                upstreamStatus: response.status
            });
        }

        const data = await response.json();

        // Supprimer les PC complets
        const filteredProducts = (
            Array.isArray(data.products) ? data.products : []
        ).filter((product) => {
            if (isCompletePC(product)) {
                return false;
            }

            // Si une catégorie est sélectionnée,
            // vérifier qu'elle correspond au produit.
            if (category) {
                const productCategory = String(
                    product.category?.slug || ""
                ).toLowerCase();

                return productCategory === category;
            }

            return true;
        });

        // Transformer les produits pour notre frontend.
        const products = filteredProducts.map((product) => {
            const offers = Array.isArray(product.prices)
                ? product.prices
                : [];

            // Privilégier une offre disponible.
            const offer =
                offers.find(
                    (item) =>
                        item.inStock === true &&
                        item.price != null &&
                        Number.isFinite(Number(item.price)) &&
                        item.currency
                ) ||
                offers.find(
                    (item) =>
                        item.price != null &&
                        Number.isFinite(Number(item.price)) &&
                        item.currency
                );

            return {
                source: "VantaSpec",

                externalId: product.id,

                name: product.name || "",

                brand: product.brand || "",

                category: product.category?.name || "",

                categorySlug: product.category?.slug || "",

                description: product.description || "",

                imageUrl:
                    product.imageUrl ||
                    product.officialImage ||
                    "",

                price: offer
                    ? Number(offer.price)
                    : null,

                currency: offer?.currency || null,

                retailer: offer?.retailer || null,

                productUrl: offer?.url || "",

                inStock: offer?.inStock ?? null
            };
        });

        // Envoyer les résultats au frontend.
        res.json({
            source: "VantaSpec",
            query: q,
            category: category || null,

            total: products.length,

            // Nombre total annoncé par VantaSpec
            upstreamTotal: data.total || 0,

            page: data.page || page,
            totalPages: data.totalPages || 0,

            products
        });

    } catch (error) {
        console.error(
            "Erreur VantaSpec :",
            error.message
        );

        res.status(502).json({
            error:
                "Impossible de contacter VantaSpec pour le moment."
        });
    }
});

module.exports = router;
