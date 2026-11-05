const express = require("express");
const db = require("../database/db");

const router = express.Router();

// ======================
// SÉCURITÉ DES CONFIGURATIONS
// ======================

// Vérifier que l'utilisateur est connecté
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: "Tu dois être connecté pour accéder à tes configurations."
    });
  }

  next();
}

// Protéger toutes les routes de ce fichier
router.use(requireAuth);
// ======================
// GET /api/builds
// Liste tous les builds
// ======================

router.get("/", (req, res) => {
    const sql = `
    SELECT
      b.id,
      b.name,
      COALESCE(SUM(c.price), 0) AS total_price,
      b.created_at
    FROM builds b
    LEFT JOIN build_items bi
      ON bi.build_id = b.id
    LEFT JOIN components c
      ON c.id = bi.component_id
    WHERE b.user_id = ?
    GROUP BY b.id, b.name, b.created_at
    ORDER BY b.id DESC
  `;

  db.all(sql, [req.session.userId], (err, rows) => {
    if (err) {
      console.error("Error loading builds:", err.message);
      return res.status(500).json({
        error: "Erreur lors du chargement des builds"
      });
    }

    res.json(rows);
  });
});

// ======================
// GET /api/builds/:id
// Récupère un build + ses composants
// ======================

router.get("/:id", (req, res) => {
  const buildId = req.params.id;

  const sql = `
    SELECT
      b.id,
      b.name,
      b.total_price,
      b.created_at,
      bi.id AS build_item_id,
      bi.category,
      c.id AS component_id,
      c.name AS component_name,
      c.price,
      c.brand,
      c.specs
    FROM builds b
    LEFT JOIN build_items bi
      ON b.id = bi.build_id
    LEFT JOIN components c
      ON bi.component_id = c.id
    WHERE b.id = ?
      AND b.user_id = ?
    ORDER BY bi.id ASC
  `;

  db.all(sql, [buildId, req.session.userId], (err, rows) => {
    if (err) {
      console.error("Error loading build:", err.message);
      return res.status(500).json({
        error: "Erreur lors du chargement du build"
      });
    }

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Build introuvable"
      });
    }

    const build = {
      id: rows[0].id,
      name: rows[0].name,
      total_price: Math.round(
  rows.reduce((total, row) => total + (Number(row.price) || 0), 0) * 100
) / 100,
      created_at: rows[0].created_at,
      components: rows
        .filter(row => row.component_id !== null)
        .map(row => ({
          id: row.component_id,
          name: row.component_name,
          category: row.category,
          price: row.price,
          brand: row.brand,
          specs: row.specs
        }))
    };

    res.json(build);
  });
});

// ======================
// POST /api/builds
// Crée un nouveau build
// ======================

router.post("/", (req, res) => {
  const { name, total_price, components } = req.body;

  if (!name || !Array.isArray(components)) {
    return res.status(400).json({
      error: "Nom du build et composants requis"
    });
  }

  const price = Number(total_price) || 0;

    db.run(
    `
      INSERT INTO builds (name, total_price, user_id)
      VALUES (?, ?, ?)
    `,
    [name, price, req.session.userId],
    function (err) {

      if (err) {
        console.error("Error creating build:", err.message);
        return res.status(500).json({
          error: "Erreur lors de la création du build"
        });
      }

      const buildId = this.lastID;

      if (components.length === 0) {
        return res.status(201).json({
          id: buildId,
          message: "Build créé"
        });
      }

      const stmt = db.prepare(`
        INSERT INTO build_items (build_id, component_id, category)
        VALUES (?, ?, ?)
      `);

      let completed = 0;
      let failed = false;

      components.forEach(component => {
        stmt.run(
          buildId,
          component.id,
          component.category,
          err => {
            if (failed) return;

            if (err) {
              failed = true;
              console.error("Error adding build component:", err.message);

              stmt.finalize(() => {
                res.status(500).json({
                  error: "Erreur lors de l'ajout des composants"
                });
              });

              return;
            }

            completed++;

            if (completed === components.length) {
              stmt.finalize(finalizeErr => {
                if (finalizeErr) {
                  console.error(
                    "Error finalizing statement:",
                    finalizeErr.message
                  );

                  return res.status(500).json({
                    error: "Erreur lors de la sauvegarde"
                  });
                }

                res.status(201).json({
                  id: buildId,
                  message: "Build créé"
                });
              });
            }
          }
        );
      });
    }
  );
});

// ======================
// DELETE /api/builds/:id
// Supprime un build et ses composants associés
// ======================

// DELETE /api/builds/:id
router.delete("/:id", (req, res) => {
  const buildId = req.params.id;
  const userId = req.session.userId;

  // Vérifier que la configuration appartient au compte connecté
  db.get(
    "SELECT id FROM builds WHERE id = ? AND user_id = ?",
    [buildId, userId],
    (err, build) => {
      if (err) {
        return res.status(500).json({
          error: "Erreur lors de la vérification du build"
        });
      }

      if (!build) {
        return res.status(404).json({
          error: "Build introuvable"
        });
      }

      // Supprimer uniquement les composants d'un build appartenant au compte
      db.run(
        `DELETE FROM build_items
         WHERE build_id = ?
         AND build_id IN (
           SELECT id FROM builds WHERE user_id = ?
         )`,
        [buildId, userId],
        (err) => {
          if (err) {
            return res.status(500).json({
              error: "Erreur lors de la suppression des composants"
            });
          }

          // Supprimer la configuration uniquement si elle appartient au compte
          db.run(
            "DELETE FROM builds WHERE id = ? AND user_id = ?",
            [buildId, userId],
            function (err) {
              if (err) {
                return res.status(500).json({
                  error: "Erreur lors de la suppression du build"
                });
              }

              if (this.changes === 0) {
                return res.status(404).json({
                  error: "Build introuvable"
                });
              }

              res.json({
                message: "Build supprimé"
              });
            }
          );
        }
      );
    }
  );
});

// PUT /api/builds/:id
router.put("/:id", (req, res) => {
  const buildId = req.params.id;
  const { name, total_price, components } = req.body;

  if (!name || !Array.isArray(components)) {
    return res.status(400).json({
      error: "Nom du build et composants requis"
    });
  }

    const price = Number(total_price) || 0;

  db.run(
    `
      UPDATE builds
      SET name = ?, total_price = ?
      WHERE id = ? AND user_id = ?
    `,
    [name, price, buildId, req.session.userId],
    function (err) {

      if (err) {
        console.error(
          "Error updating build:",
          err.message
        );

        return res.status(500).json({
          error: "Erreur lors de la modification du build"
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          error: "Build introuvable"
        });
      }

  // Supprimer uniquement les composants du compte connecté
      db.run(
        `
          DELETE FROM build_items
          WHERE build_id = ?
          AND build_id IN (
            SELECT id
            FROM builds
            WHERE user_id = ?
          )
        `,
        [buildId, req.session.userId],
        err => {

          if (err) {
            console.error(
              "Error deleting old build items:",
              err.message
            );

            return res.status(500).json({
              error: "Erreur lors de la mise à jour des composants"
            });
          }

          // Aucun composant
          if (components.length === 0) {
            return res.json({
              id: Number(buildId),
              message: "Build modifié"
            });
          }

          const stmt = db.prepare(`
            INSERT INTO build_items
            (build_id, component_id, category)
            VALUES (?, ?, ?)
          `);

          let completed = 0;
          let failed = false;

          components.forEach(component => {

            stmt.run(
              buildId,
              component.id,
              component.category,
              err => {

                if (failed) return;

                if (err) {
                  failed = true;

                  console.error(
                    "Error updating build component:",
                    err.message
                  );

                  stmt.finalize(() => {
                    res.status(500).json({
                      error:
                        "Erreur lors de l'ajout des composants"
                    });
                  });

                  return;
                }

                completed++;

                if (
                  completed ===
                  components.length
                ) {

                  stmt.finalize(finalizeErr => {

                    if (finalizeErr) {
                      console.error(
                        "Error finalizing statement:",
                        finalizeErr.message
                      );

                      return res.status(500).json({
                        error:
                          "Erreur lors de la sauvegarde"
                      });
                    }

                    res.json({
                      id: Number(buildId),
                      message: "Build modifié"
                    });
                  });
                }
              }
            );
          });
        }
      );
    }
  );
});

module.exports = router;
