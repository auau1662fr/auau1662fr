const express = require("express");
const multer = require("multer");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const db = require("../database/db");

const router = express.Router();

const avatarDirectory = path.join(
  __dirname,
  "../public/uploads/avatars"
);

// Stockage temporaire en mémoire
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

// Vérifier la connexion
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: "Tu dois être connecté."
    });
  }

  next();
}

// Déterminer le véritable format de l'image
function detectImageType(buffer) {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) {
    return "png";
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpg";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

// Récupérer la photo du compte connecté
router.get("/me", requireAuth, (req, res) => {
  db.get(
    "SELECT id, username, avatar FROM users WHERE id = ?",
    [req.session.userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({
          error: "Erreur de base de données."
        });
      }

      if (!user) {
        return res.status(404).json({
          error: "Compte introuvable."
        });
      }

      res.json({
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar
            ? `/uploads/avatars/${encodeURIComponent(user.avatar)}`
            : null
        }
      });
    }
  );
});

// Enregistrer une nouvelle photo
router.post(
  "/avatar",
  requireAuth,
  (req, res, next) => {
    upload.single("avatar")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          error: err.code === "LIMIT_FILE_SIZE"
            ? "L'image ne doit pas dépasser 2 Mo."
            : "Impossible de recevoir l'image."
        });
      }

      next();
    });
  },
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: "Aucune image sélectionnée."
      });
    }

    const extension = detectImageType(req.file.buffer);

    if (!extension) {
      return res.status(400).json({
        error: "Format non accepté. Utilise PNG, JPEG ou WebP."
      });
    }

    const userId = req.session.userId;

    // Nom aléatoire pour éviter les collisions
    const filename = `${userId}-${crypto.randomUUID()}.${extension}`;
    const filepath = path.join(avatarDirectory, filename);

    try {
      await fs.mkdir(avatarDirectory, { recursive: true });
      await fs.writeFile(filepath, req.file.buffer, { flag: "wx" });

      db.get(
        "SELECT avatar FROM users WHERE id = ?",
        [userId],
        (selectErr, user) => {
          if (selectErr || !user) {
            fs.unlink(filepath).catch(console.error);

            return res.status(selectErr ? 500 : 404).json({
              error: "Impossible de retrouver le compte."
            });
          }

          db.run(
            "UPDATE users SET avatar = ? WHERE id = ?",
            [filename, userId],
            function (updateErr) {
              if (updateErr || this.changes !== 1) {
                fs.unlink(filepath).catch(console.error);

                return res.status(500).json({
                  error: "Impossible d'enregistrer la photo."
                });
              }

              // Supprimer l'ancienne photo du dossier
              if (
                user.avatar &&
                new RegExp(`^${userId}-[a-f0-9-]+\\.(png|jpg|webp)$`).test(user.avatar)
              ) {
                fs.unlink(
                  path.join(avatarDirectory, user.avatar)
                ).catch(() => {});
              }

              res.json({
                message: "Photo de profil enregistrée.",
                avatar: `/uploads/avatars/${encodeURIComponent(filename)}`
              });
            }
          );
        }
      );
    } catch (error) {
      console.error("Erreur avatar :", error);

      res.status(500).json({
        error: "Impossible d'enregistrer l'image."
      });
    }
  }
);

module.exports = router;
