const express = require("express");
const path = require("path");
const fs = require("fs");

const db = require("./database/db");

// Routes
const componentsRoutes = require("./routes/components");

const app = express();
const PORT = 3000;

// ======================
// Middleware
// ======================

app.use(express.json());

// Frontend public
app.use(express.static(path.join(__dirname, "public")));

// ======================
// Database init
// ======================

const initSql = fs.readFileSync(
  path.join(__dirname, "database", "init.sql"),
  "utf8"
);

db.exec(initSql, (err) => {
  if (err) {
    console.error("Error initializing database:", err.message);
  } else {
    console.log("Database initialized");
  }
});

// ======================
// Routes API
// ======================

app.use("/api/components", componentsRoutes);

// Route test
app.get("/api/test", (req, res) => {
  res.json({
    message: "API working"
  });
});

// ======================
// Start server
// ======================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
