/* =====================================================================
   server/db.js — the database layer. This file is course step 3's
   whole point: data now PERSISTS in a real database file on disk
   (server/data/tinker.db) instead of living in a JavaScript array
   that forgets everything when the server restarts (that was step 2).

   COURSE NOTES — read top to bottom:
   1. node:sqlite is built into Node 24, so there is no extra database
      package to install. DatabaseSync opens (or creates) the file.
   2. db.exec(schema) runs the CREATE TABLE statements in schema.sql.
      "IF NOT EXISTS" makes this safe to run on every start.
   3. SEEDING: if the tools table is empty, we INSERT the catalogue
      once. After that, the database keeps its own rows — restart the
      server and your reservations are still there. That persistence
      is the difference between step 2 and step 3.
   4. Every query below uses a PREPARED STATEMENT with ? placeholders.
      Values are passed separately and can never break out of the SQL
      and become code — that is how you prevent SQL injection.
   ===================================================================== */

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = path.join(__dirname, "data", "tinker.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);

/* Run the schema (safe on every start thanks to IF NOT EXISTS). */
db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));

/* ---- Seed data — must match the FALLBACK_TOOLS copy in ../app.js ----
   Same API-contract idea as step 2: identical shape, so the front end
   behaves the same on GitHub Pages (no server) and locally (SQLite). */
const SEED_TOOLS = [
  { id: "cordless-drill", name: "Cordless Drill & Driver Set", category: "power", fee: 6, deposit: 40, copies: 4, rating: 4.9, loans: 312, blurb: "Two batteries, a full bit set, and enough torque for flat-pack furniture and real framing alike.", includes: "Drill, 2 batteries, charger, 32-piece bit set, case" },
  { id: "extension-ladder", name: "Extension Ladder, 24 ft", category: "access", fee: 9, deposit: 60, copies: 2, rating: 4.8, loans: 148, blurb: "Reaches most two-storey eaves. Light enough for one person to carry, rated for 300 lb.", includes: "Ladder, stabiliser bar, rope & pulley" },
  { id: "pressure-washer", name: "Pressure Washer, 2700 PSI", category: "garden", fee: 14, deposit: 80, copies: 2, rating: 4.7, loans: 203, blurb: "Makes driveways, decks, and siding look freshly poured. Four nozzles from fan to pinpoint.", includes: "Washer, 25 ft hose, 4 nozzles, detergent tank" },
  { id: "carpet-cleaner", name: "Carpet & Upholstery Cleaner", category: "cleaning", fee: 12, deposit: 50, copies: 3, rating: 4.8, loans: 267, blurb: "The pet-accident and red-wine rescue machine. Heated clean, strong suction, easy tanks.", includes: "Cleaner, upholstery tool, trial cleaning solution" },
  { id: "circular-saw", name: "Circular Saw with Guide Rail", category: "power", fee: 8, deposit: 50, copies: 3, rating: 4.7, loans: 176, blurb: "Straight, clean cuts in sheet goods with the guide rail — no wobble, no splintered edge.", includes: "Saw, guide rail, 2 blades, safety guard" },
  { id: "hedge-trimmer", name: "Cordless Hedge Trimmer", category: "garden", fee: 6, deposit: 30, copies: 4, rating: 4.6, loans: 129, blurb: "22-inch dual-action blade, about an hour per battery. Hedges behave again in one pass.", includes: "Trimmer, 2 batteries, charger, blade cover" },
  { id: "tile-saw", name: "Wet Tile Saw & Cutter Kit", category: "renovation", fee: 11, deposit: 60, copies: 1, rating: 4.9, loans: 94, blurb: "Clean tile cuts without the rental-shop queue. Our single copy books out fast on weekends.", includes: "Wet saw, manual cutter, nippers, sponge, guide" },
  { id: "nail-gun-kit", name: "Air Compressor & Nail Gun Kit", category: "power", fee: 13, deposit: 75, copies: 2, rating: 4.8, loans: 158, blurb: "Trim, panelling, and fence boards at production speed. Brad and finish nailers included.", includes: "Compressor, 2 nail guns, 25 ft hose, starter nails" },
  { id: "drain-snake", name: "Drain Auger, 50 ft", category: "plumbing", fee: 10, deposit: 40, copies: 2, rating: 4.7, loans: 141, blurb: "Clears the clog the plunger gave up on, out to 50 feet. Manual or drill-driven.", includes: "Auger, 4 cutting heads, gloves, guide tube" },
  { id: "party-pack", name: "Party Pack: Tables & 20 Chairs", category: "events", fee: 15, deposit: 50, copies: 3, rating: 4.9, loans: 221, blurb: "Two 6 ft folding tables and 20 folding chairs — the whole backyard party in one checkout.", includes: "2 tables, 20 chairs, dolly for moving them" },
  { id: "wallpaper-kit", name: "Wallpaper Steamer & Prep Kit", category: "renovation", fee: 7, deposit: 35, copies: 2, rating: 4.5, loans: 67, blurb: "Steam off the 1998 floral print in an afternoon instead of a week of scraping.", includes: "Steamer, scorer, scrapers, spray bottle" },
  { id: "sewing-machine", name: "Heavy-Duty Sewing Machine", category: "craft", fee: 6, deposit: 45, copies: 2, rating: 4.8, loans: 183, blurb: "Sews denim and canvas without complaining. Curtains, repairs, and first quilts welcome.", includes: "Machine, pedal, 6 presser feet, bobbins, case" }
];

const toolCount = db.prepare("SELECT COUNT(*) AS n FROM tools").get().n;
if (toolCount === 0) {
  /* One prepared statement, run once per row inside a transaction so
     seeding is all-or-nothing. */
  const insert = db.prepare(
    "INSERT INTO tools (id, name, category, fee_per_day, deposit, copies_total, rating, loans, blurb, includes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  db.exec("BEGIN");
  try {
    for (const t of SEED_TOOLS) {
      insert.run(t.id, t.name, t.category, t.fee, t.deposit, t.copies, t.rating, t.loans, t.blurb, t.includes);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  console.log(`Seeded ${SEED_TOOLS.length} tools into ${DB_PATH}`);
}

module.exports = { db, DB_PATH };
