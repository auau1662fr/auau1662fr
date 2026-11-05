const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");

const db = require("./database/db");

// Routes
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const componentsRoutes = require("./routes/components");
const buildsRoutes = require("./routes/builds");
const importRoutes = require("./routes/import");
const aiRoutes = require("./routes/ai");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

app.use(
  session({
    name: "connect.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

// Frontend public
app.use(express.static(path.join(__dirname, "public")));

// Initialisation de la base de données
const initSql = fs.readFileSync(
  path.join(__dirname, "database", "init.sql"),
  "utf8"
);

db.exec(initSql, (err) => {
  if (err) {
    console.error("Erreur d'initialisation de la base :", err.message);
  } else {
    console.log("Base de données initialisée");
  }
});

// Routes API
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/components", componentsRoutes);
app.use("/api/builds", buildsRoutes);
app.use("/api/import", importRoutes);
app.use("/api/ai", aiRoutes);

// Route de test
app.get("/api/test", (req, res) => {
  res.json({ message: "API fonctionnelle" });
});

// Démarrage
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
