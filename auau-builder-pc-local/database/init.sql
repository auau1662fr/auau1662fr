CREATE TABLE IF NOT EXISTS components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    brand TEXT,
    specs TEXT,
    custom INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS builds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    total_price REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS build_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    build_id INTEGER,
    component_id INTEGER,
    category TEXT NOT NULL,

    FOREIGN KEY(build_id) REFERENCES builds(id),
    FOREIGN KEY(component_id) REFERENCES components(id)
);
