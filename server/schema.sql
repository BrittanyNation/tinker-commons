-- =====================================================================
-- schema.sql — the database design for Tinker Commons.
-- COURSE NOTES (Full-Stack Bootcamp, step 3: Databases + REST APIs)
-- A SCHEMA is the blueprint of a database: which TABLES exist, what
-- COLUMNS each table has, and what TYPE each column holds.
-- SQLite types are simple: TEXT, INTEGER, REAL (decimal), and
-- PRIMARY KEY marks the one column that uniquely identifies a row.
--
-- Two tables are enough for this app, and they are RELATED:
-- reservations.tool_id points at tools.id — that link is called a
-- FOREIGN KEY, and it is what makes this a "relational" database.
-- =====================================================================

CREATE TABLE IF NOT EXISTS tools (
  id            TEXT PRIMARY KEY,        -- slug, e.g. 'cordless-drill'
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,           -- slug, e.g. 'power'
  fee_per_day   INTEGER NOT NULL,        -- whole dollars, keeps math simple
  deposit       INTEGER NOT NULL,
  copies_total  INTEGER NOT NULL,        -- how many the library owns
  rating        REAL NOT NULL,           -- e.g. 4.9
  loans         INTEGER NOT NULL DEFAULT 0, -- lifetime loan count (popularity)
  blurb         TEXT NOT NULL,
  includes      TEXT NOT NULL            -- what comes in the case
);

CREATE TABLE IF NOT EXISTS reservations (
  ref         TEXT PRIMARY KEY,          -- e.g. 'TC-AB12CD'
  tool_id     TEXT NOT NULL REFERENCES tools(id),
  tool_name   TEXT NOT NULL,             -- copied in, so history survives renames
  pickup_date TEXT NOT NULL,             -- 'YYYY-MM-DD'
  return_date TEXT NOT NULL,             -- 'YYYY-MM-DD'
  days        INTEGER NOT NULL,
  member      INTEGER NOT NULL DEFAULT 0, -- SQLite has no boolean: 1 = yes, 0 = no
  total       REAL NOT NULL,             -- loan fee after any member discount
  deposit     INTEGER NOT NULL,          -- due at pickup, not charged online
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active', -- 'active' or 'cancelled'
  created_at  TEXT NOT NULL              -- ISO timestamp
);

-- An INDEX speeds up the lookups the API does most: reservations by tool
-- (availability) and by email (a member finding their reservations).
CREATE INDEX IF NOT EXISTS idx_res_tool ON reservations(tool_id, status);
CREATE INDEX IF NOT EXISTS idx_res_email ON reservations(email);
