const express = require("express");
const router = express.Router();

const db = require("../database/db");

// GET all components
router.get("/", (req, res) => {
  const sql = "SELECT * FROM components";

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        error: err.message
      });
    }

    res.json(rows);
  });
});

// POST component
router.post("/", (req, res) => {
  const { name, category, price, brand, specs } = req.body;

  const sql = `
    INSERT INTO components
    (name, category, price, brand, specs)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [name, category, price, brand, specs],
    function(err) {
      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }

      res.json({
        id: this.lastID,
        message: "Component created"
      });
    }
  );
});

module.exports = router;
