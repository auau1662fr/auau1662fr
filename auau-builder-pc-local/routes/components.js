const express = require("express");
const router = express.Router();

const db = require("../database/db");


// ========================================
// GET ALL COMPONENTS
// ========================================

router.get("/", (req, res) => {

    const sql = `
        SELECT *
        FROM components
        ORDER BY category, name
    `;

    db.all(
        sql,
        [],
        (err, rows) => {

            if (err) {

                return res.status(500).json({
                    error: err.message
                });
            }

            res.json(rows);
        }
    );
});


// ========================================
// POST COMPONENT
// ========================================

router.post("/", (req, res) => {

    const {
        name,
        category,
        price,
        brand,
        specs
    } = req.body;


    if (
        !name ||
        !category ||
        price === undefined
    ) {

        return res.status(400).json({
            error:
                "Nom, catégorie et prix sont obligatoires."
        });
    }


    const parsedPrice =
        Number(price);


    if (
        !Number.isFinite(parsedPrice) ||
        parsedPrice < 0
    ) {

        return res.status(400).json({
            error:
                "Le prix doit être un nombre positif."
        });
    }


    // ========================================
    // VÉRIFICATION ANTI-DOUBLON
    // ========================================

    const checkSql = `
        SELECT id
        FROM components
        WHERE LOWER(name) = LOWER(?)
    `;


    db.get(
        checkSql,
        [name.trim()],
        (checkErr, existingComponent) => {

            if (checkErr) {

                return res.status(500).json({
                    error:
                        checkErr.message
                });
            }


            if (existingComponent) {

                return res.status(409).json({
                    error:
                        "Ce composant existe déjà dans la base de données."
                });
            }


            // ========================================
            // INSERTION
            // ========================================

            const sql = `
                INSERT INTO components
                (
                    name,
                    category,
                    price,
                    brand,
                    specs
                )
                VALUES (?, ?, ?, ?, ?)
            `;


            db.run(
                sql,
                [
                    name.trim(),
                    category,
                    parsedPrice,
                    brand
                        ? brand.trim()
                        : "",
                    specs
                        ? specs.trim()
                        : ""
                ],
                function(err) {

                    if (err) {

                        return res.status(500).json({
                            error:
                                err.message
                        });
                    }


                    res.status(201).json({

                        id:
                            this.lastID,

                        message:
                            "Composant ajouté avec succès."
                    });
                }
            );
        }
    );
});


// ========================================
// PUT - MODIFIER UN COMPOSANT
// Accepte les modifications partielles
// ========================================

router.put("/:id", (req, res) => {
    const componentId = Number(req.params.id);

    if (!Number.isInteger(componentId) || componentId <= 0) {
        return res.status(400).json({
            error: "ID du composant invalide."
        });
    }

    const { name, category, price, brand, specs } = req.body;

    console.log("[DEBUG PUT] Données reçues :", req.body);

    const findSql = `
        SELECT id, name, category, price, brand, specs
        FROM components
        WHERE id = ?
    `;

    db.get(findSql, [componentId], (findErr, component) => {
        if (findErr) {
            return res.status(500).json({ error: findErr.message });
        }

        if (!component) {
            return res.status(404).json({
                error: "Composant introuvable."
            });
        }

        // Conserver les valeurs existantes si elles ne sont pas envoyées.
        const updatedName =
            name !== undefined ? String(name).trim() : component.name;

        const updatedCategory =
            category !== undefined ? category : component.category;

        const updatedPrice =
            price !== undefined ? Number(price) : Number(component.price);

        const updatedBrand =
            brand !== undefined ? String(brand).trim() : (component.brand || "");

        const updatedSpecs =
            specs !== undefined ? String(specs).trim() : (component.specs || "");

        if (!updatedName || !updatedCategory) {
            return res.status(400).json({
                error: "Le nom et la catégorie sont obligatoires."
            });
        }

        if (
            price !== undefined &&
            (String(price).trim() === "" ||
             !Number.isFinite(updatedPrice) ||
             updatedPrice < 0)
        ) {
            return res.status(400).json({
                error: "Le prix doit être un nombre positif ou égal à zéro."
            });
        }

        if (!Number.isFinite(updatedPrice) || updatedPrice < 0) {
            return res.status(400).json({
                error: "Le prix enregistré est invalide."
            });
        }

        // Vérifier les doublons uniquement avec le nom final.
        const duplicateSql = `
            SELECT id
            FROM components
            WHERE LOWER(name) = LOWER(?)
              AND id != ?
        `;

        db.get(
            duplicateSql,
            [updatedName, componentId],
            (duplicateErr, duplicate) => {
                if (duplicateErr) {
                    return res.status(500).json({
                        error: duplicateErr.message
                    });
                }

                if (duplicate) {
                    return res.status(409).json({
                        error: "Un autre composant porte déjà ce nom."
                    });
                }

                const updateSql = `
                    UPDATE components
                    SET name = ?,
                        category = ?,
                        price = ?,
                          brand = ?,
                          specs = ?
                    WHERE id = ?
                `;

                db.run(
                    updateSql,
                    [
                        updatedName,
                        updatedCategory,
                        updatedPrice,
                        updatedBrand,
                        updatedSpecs,
                        componentId
                    ],
                    function (updateErr) {
                        if (updateErr) {
                            return res.status(500).json({
                                error: updateErr.message
                            });
                        }

                        return res.json({
                            message: "Composant modifié avec succès.",
                            id: componentId
                        });
                    }
                );
            }
        );
    });
});

// ========================================
// DELETE - SUPPRIMER UN COMPOSANT
// ========================================
router.delete("/:id", (req, res) => {
    const componentId = Number(req.params.id);

    if (!Number.isInteger(componentId) || componentId <= 0) {
        return res.status(400).json({
            error: "ID du composant invalide."
        });
    }

    db.run(
        "DELETE FROM components WHERE id = ?",
        [componentId],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    error: "Composant introuvable."
                });
            }

            return res.json({
                message: "Composant supprimé avec succès."
            });
        }
    );
});

module.exports = router;
