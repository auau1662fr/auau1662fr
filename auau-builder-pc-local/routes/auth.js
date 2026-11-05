const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../database/db");

const router = express.Router();

// Création d'un compte
router.post("/register", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({
      error: "Le nom d'utilisateur doit contenir entre 3 et 30 caractères."
    });
  }

  if (password.length < 8 || password.length > 200) {
    return res.status(400).json({
      error: "Le mot de passe doit contenir entre 8 et 200 caractères."
    });
  }

  bcrypt.hash(password, 12, (hashErr, passwordHash) => {
    if (hashErr) {
      console.error("Erreur de hachage :", hashErr);
      return res.status(500).json({ error: "Erreur interne." });
    }

    db.serialize(() => {
      db.run("BEGIN IMMEDIATE TRANSACTION", (beginErr) => {
        if (beginErr) {
          return res.status(500).json({ error: "Impossible de créer le compte." });
        }

        db.get("SELECT COUNT(*) AS count FROM users", (countErr, row) => {
          if (countErr) {
            return db.run("ROLLBACK", () =>
              res.status(500).json({ error: "Erreur de base de données." })
            );
          }

          db.run(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            [username, passwordHash],
            function (insertErr) {
              if (insertErr) {
                return db.run("ROLLBACK", () => {
                  const duplicate = insertErr.message.includes("UNIQUE");
                  res.status(duplicate ? 409 : 500).json({
                    error: duplicate
                      ? "Ce nom d'utilisateur est déjà utilisé."
                      : "Impossible de créer le compte."
                  });
                });
              }

              const userId = this.lastID;

              // Le premier compte récupère les configurations historiques
              // qui n'ont pas encore de propriétaire.
              const claimBuilds = row.count === 0
                ? db.run(
                    "UPDATE builds SET user_id = ? WHERE user_id IS NULL",
                    [userId],
                    function (claimErr) {
                      if (claimErr) {
                        return db.run("ROLLBACK", () =>
                          res.status(500).json({ error: "Erreur lors de la migration des configurations." })
                        );
                      }

                      commitRegistration(userId, username);
                    }
                  )
                : commitRegistration(userId, username);
            }
          );
        });
      });
    });

    function commitRegistration(userId, username) {
      db.run("COMMIT", (commitErr) => {
        if (commitErr) {
          return db.run("ROLLBACK", () =>
            res.status(500).json({ error: "Impossible de finaliser la création du compte." })
          );
        }

        req.session.userId = userId;
        req.session.username = username;

        req.session.save((sessionErr) => {
          if (sessionErr) {
            console.error("Erreur de session :", sessionErr);
            return res.status(500).json({ error: "Compte créé, mais connexion impossible. Connecte-toi." });
          }

          res.status(201).json({
            message: "Compte créé.",
            user: { id: userId, username }
          });
        });
      });
    }
  });
});

// Connexion
router.post("/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  db.get(
    "SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE",
    [username],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: "Erreur de base de données." });
      }

      if (!user) {
        return res.status(401).json({ error: "Nom d'utilisateur ou mot de passe incorrect." });
      }

      bcrypt.compare(password, user.password_hash, (compareErr, valid) => {
        if (compareErr || !valid) {
          return res.status(401).json({ error: "Nom d'utilisateur ou mot de passe incorrect." });
        }

        req.session.regenerate((sessionErr) => {
          if (sessionErr) {
            return res.status(500).json({ error: "Impossible d'ouvrir la session." });
          }

          req.session.userId = user.id;
          req.session.username = user.username;

          req.session.save((saveErr) => {
            if (saveErr) {
              return res.status(500).json({ error: "Impossible d'enregistrer la session." });
            }

            res.json({
              message: "Connexion réussie.",
              user: { id: user.id, username: user.username }
            });
          });
        });
      });
    }
  );
});

// Vérifier qui est connecté
router.get("/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Non connecté." });
  }

  res.json({
    user: {
      id: req.session.userId,
      username: req.session.username
    }
  });
});

// Déconnexion
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Impossible de fermer la session." });
    }

    res.clearCookie("connect.sid");
    res.json({ message: "Déconnexion réussie." });
  });
});

module.exports = router;
