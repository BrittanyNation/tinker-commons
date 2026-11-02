/* =====================================================================
   server/server.js — a REST API backed by a real SQLite database.
   ---------------------------------------------------------------------
   COURSE NOTES (Full-Stack Bootcamp, step 3: Databases + REST design)

   REST in one paragraph: the API is organised around NOUNS (resources)
   — /api/tools, /api/reservations — and the HTTP VERB says the action:
     GET    /api/tools              read the collection (supports
                                    ?category= &q= &available= filters)
     GET    /api/tools/:id          read one item
     POST   /api/reservations       create a new reservation  -> 201
     GET    /api/reservations/:ref  read one reservation
     GET    /api/reservations?email=  read a member's reservations
     DELETE /api/reservations/:ref  cancel a reservation      -> 200
     GET    /api/stats              counts for the home page band
   Status codes carry meaning: 200 OK, 201 Created, 400 the client sent
   something invalid, 404 no such resource. Errors are always JSON.

   Availability is COMPUTED from the database, not stored: a tool's
   copies available = copies_total minus active reservations whose
   dates overlap the requested window. Overlap test for two ranges
   [aStart,aEnd] and [bStart,bEnd]: NOT (aEnd < bStart OR aStart > bEnd).

   Run it:
     cd server
     npm install     (downloads Express, once)
     npm start       (or: node server.js)
   Then open http://localhost:3000 — the banner will say "Live mode".
   GitHub Pages cannot run Node or SQLite, so the published demo uses
   the front end's built-in fallback copy (see ../app.js) and says so.
   ===================================================================== */

const express = require("express");
const path = require("path");
const { db } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

/* ---- Helpers ------------------------------------------------------- */
function toolRowToApi(row, available) {
  return {
    id: row.id, name: row.name, category: row.category,
    fee: row.fee_per_day, deposit: row.deposit, copies: row.copies_total,
    available, rating: row.rating, loans: row.loans,
    blurb: row.blurb, includes: row.includes
  };
}

/* How many copies of a tool are tied up in active reservations that
   overlap [from, to]? With no dates given, count all active ones. */
const overlapStmt = db.prepare(
  `SELECT COUNT(*) AS n FROM reservations
   WHERE tool_id = ? AND status = 'active'
     AND NOT (return_date < ? OR pickup_date > ?)`
);
const activeStmt = db.prepare(
  "SELECT COUNT(*) AS n FROM reservations WHERE tool_id = ? AND status = 'active'"
);
function copiesAvailable(row, from, to) {
  const used = from && to
    ? overlapStmt.get(row.id, from, to).n
    : activeStmt.get(row.id).n;
  return Math.max(0, row.copies_total - used);
}

/* ---- Tools --------------------------------------------------------- */
app.get("/api/tools", (req, res) => {
  const { category, q, available, from, to } = req.query;
  let rows = db.prepare("SELECT * FROM tools ORDER BY loans DESC").all();
  if (category && category !== "all") rows = rows.filter(r => r.category === category);
  if (q) {
    const needle = String(q).toLowerCase();
    rows = rows.filter(r => (r.name + " " + r.blurb + " " + r.category).toLowerCase().includes(needle));
  }
  let tools = rows.map(r => toolRowToApi(r, copiesAvailable(r, from, to)));
  if (available === "1") tools = tools.filter(t => t.available > 0);
  res.json({ tools });
});

app.get("/api/tools/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM tools WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "No tool with that id." });
  res.json(toolRowToApi(row, copiesAvailable(row, req.query.from, req.query.to)));
});

/* ---- Reservations -------------------------------------------------- */
app.post("/api/reservations", (req, res) => {
  const b = req.body || {};
  const errors = [];
  const tool = db.prepare("SELECT * FROM tools WHERE id = ?").get(b.toolId || "");
  if (!tool) errors.push("Unknown toolId.");
  if (!b.name || !String(b.name).trim()) errors.push("Name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || "")) errors.push("A valid email is required.");
  if (!/^[\d\s()+.-]{7,}$/.test(b.phone || "")) errors.push("A valid phone number is required.");
  const dateOk = s => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
  if (!dateOk(b.pickupDate) || !dateOk(b.returnDate)) errors.push("Pickup and return dates must be YYYY-MM-DD.");
  let days = 0;
  if (dateOk(b.pickupDate) && dateOk(b.returnDate)) {
    const pickup = new Date(b.pickupDate + "T12:00:00");
    const ret = new Date(b.returnDate + "T12:00:00");
    days = Math.round((ret - pickup) / 86400000) + 1; // inclusive loan days
    if (days < 1) errors.push("Return date must be on or after the pickup date.");
    if (days > 7) errors.push("Loans are up to 7 days.");
    if (pickup.getDay() === 0) errors.push("Closed on Sundays — pick another pickup day.");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (pickup < today) errors.push("Pickup date cannot be in the past.");
    if (tool && copiesAvailable(tool, b.pickupDate, b.returnDate) < 1) {
      errors.push("No copies of that tool are available for those dates.");
    }
  }
  if (errors.length) return res.status(400).json({ errors });

  const member = b.member ? 1 : 0;
  const gross = days * tool.fee_per_day;
  const total = Math.round(gross * (member ? 0.8 : 1) * 100) / 100;
  const reservation = {
    ref: "TC-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    tool_id: tool.id, tool_name: tool.name,
    pickup_date: b.pickupDate, return_date: b.returnDate, days,
    member, total, deposit: tool.deposit,
    name: String(b.name).trim(), email: String(b.email).trim(), phone: String(b.phone).trim(),
    status: "active", created_at: new Date().toISOString()
  };
  db.prepare(
    `INSERT INTO reservations
     (ref, tool_id, tool_name, pickup_date, return_date, days, member, total, deposit, name, email, phone, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(reservation.ref, reservation.tool_id, reservation.tool_name, reservation.pickup_date,
        reservation.return_date, reservation.days, reservation.member, reservation.total,
        reservation.deposit, reservation.name, reservation.email, reservation.phone,
        reservation.status, reservation.created_at);
  /* Keep the tool's popularity count honest in the database too. */
  db.prepare("UPDATE tools SET loans = loans + 1 WHERE id = ?").run(tool.id);
  res.status(201).json(reservation);
});

app.get("/api/reservations/:ref", (req, res) => {
  const row = db.prepare("SELECT * FROM reservations WHERE ref = ?").get(req.params.ref.toUpperCase());
  if (!row) return res.status(404).json({ error: "No reservation with that reference." });
  res.json(row);
});

app.get("/api/reservations", (req, res) => {
  if (!req.query.email) return res.status(400).json({ error: "Give me ?email=<address>." });
  const rows = db.prepare(
    "SELECT * FROM reservations WHERE lower(email) = lower(?) ORDER BY created_at DESC"
  ).all(String(req.query.email));
  res.json({ reservations: rows });
});

/* DELETE is the REST way to remove/cancel: we soft-delete by flipping
   status to 'cancelled', so the record (and the audit trail) survives
   while the copy goes back into the available pool. */
app.delete("/api/reservations/:ref", (req, res) => {
  const row = db.prepare("SELECT * FROM reservations WHERE ref = ?").get(req.params.ref.toUpperCase());
  if (!row) return res.status(404).json({ error: "No reservation with that reference." });
  if (row.status === "cancelled") return res.status(400).json({ error: "That reservation is already cancelled." });
  db.prepare("UPDATE reservations SET status = 'cancelled' WHERE ref = ?").run(row.ref);
  res.json({ ref: row.ref, status: "cancelled" });
});

/* ---- Stats --------------------------------------------------------- */
app.get("/api/stats", (req, res) => {
  const tools = db.prepare("SELECT COUNT(*) AS n FROM tools").get().n;
  const loans = db.prepare("SELECT COALESCE(SUM(loans),0) AS n FROM tools").get().n;
  const active = db.prepare("SELECT COUNT(*) AS n FROM reservations WHERE status = 'active'").get().n;
  res.json({ tools, loans, activeReservations: active });
});

app.use("/api", (req, res) => res.status(404).json({ error: "Unknown API route." }));

app.listen(PORT, () => {
  console.log(`Tinker Commons server running at http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}/api/tools`);
});
