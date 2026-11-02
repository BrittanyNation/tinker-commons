/* =====================================================================
   app.js — Tinker Commons front end.
   COURSE NOTES (Full-Stack Bootcamp, step 3: Databases + REST APIs)

   This file is a REST CLIENT. It does not know or care whether the
   data comes from SQLite — it only knows the API contract:
     GET    api/tools                 -> { tools: [...] }
     POST   api/reservations          -> 201 + the saved reservation
     GET    api/reservations/:ref     -> one reservation
     GET    api/reservations?email=   -> a member's reservations
     DELETE api/reservations/:ref     -> { ref, status: 'cancelled' }
     GET    api/stats                 -> { tools, loans, ... }

   THE FALLBACK PATTERN (from step 2, kept): GitHub Pages cannot run
   the server, so every API call is wrapped in try/catch. If the API
   answers, we are in LIVE mode and the SQLite database is the source
   of truth. If it does not, we fall back to FALLBACK_TOOLS below
   (identical to the server seed) and to localStorage for reservations,
   and the banner on the page says honestly which mode you are in.

   In fallback mode the front end re-implements the server's rules
   (availability = copies - overlapping active reservations, member
   discount, 7-day max) against localStorage — same contract, same
   math, different storage. Compare reserveOnServer() and
   reserveLocally(): they build the exact same reservation object.
   ===================================================================== */

"use strict";

/* ---- Fallback catalogue: identical to server/db.js SEED_TOOLS ------ */
const FALLBACK_TOOLS = [
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
const CATEGORY_LABELS = { power: "Power Tools", access: "Ladders & Access", garden: "Outdoor & Garden", cleaning: "Cleaning", renovation: "Renovation", plumbing: "Plumbing", events: "Events", craft: "Craft & Textile" };
const ICONS = { power: "🔌", access: "🪜", garden: "🌿", cleaning: "🧽", renovation: "🧱", plumbing: "🔧", events: "🎉", craft: "🧵" };
const money = n => "$" + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "");

/* ---- Mode + data loading ------------------------------------------- */
let apiMode = "fallback";
let TOOLS = [];

async function loadTools() {
  try {
    const res = await fetch("api/tools");
    if (!res.ok) throw new Error("API " + res.status);
    const data = await res.json();
    if (!Array.isArray(data.tools)) throw new Error("Unexpected API shape");
    TOOLS = data.tools;
    apiMode = "live";
  } catch (err) {
    TOOLS = FALLBACK_TOOLS.map(t => ({ ...t, available: localAvailable(t) }));
    apiMode = "fallback";
  }
  const el = document.getElementById("data-mode");
  if (el) {
    el.textContent = apiMode === "live"
      ? "🟢 Live mode: this page is reading the catalogue from the SQLite database through the REST API (GET /api/tools)."
      : "📦 Demo mode (GitHub Pages): showing the built-in catalogue copy and saving reservations in your browser. Run the server in /server locally for the live database version.";
    el.classList.add(apiMode);
  }
}

/* ---- localStorage reservations (fallback storage) ------------------- */
const LS_KEY = "tinker_reservations";
function localReservations() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch (e) { return []; }
}
function saveLocalReservations(list) { localStorage.setItem(LS_KEY, JSON.stringify(list)); }
/* Same overlap rule as the server: NOT (aEnd < bStart OR aStart > bEnd). */
function overlaps(aStart, aEnd, bStart, bEnd) { return !(aEnd < bStart || aStart > bEnd); }
function localAvailable(tool, from, to) {
  const mine = localReservations().filter(r => r.tool_id === tool.id && r.status === "active");
  const used = (from && to)
    ? mine.filter(r => overlaps(r.pickup_date, r.return_date, from, to)).length
    : mine.length;
  return Math.max(0, tool.copies - used);
}

/* ---- Catalogue rendering + filters ---------------------------------- */
let activeCategory = "all", searchTerm = "", sortBy = "popular", onlyAvailable = false;

function visibleTools() {
  let list = TOOLS.slice();
  if (activeCategory !== "all") list = list.filter(t => t.category === activeCategory);
  if (searchTerm) {
    const n = searchTerm.toLowerCase();
    list = list.filter(t => (t.name + " " + t.blurb + " " + CATEGORY_LABELS[t.category]).toLowerCase().includes(n));
  }
  if (onlyAvailable) list = list.filter(t => (t.available ?? t.copies) > 0);
  if (sortBy === "fee-low") list.sort((a, b) => a.fee - b.fee);
  else if (sortBy === "fee-high") list.sort((a, b) => b.fee - a.fee);
  else if (sortBy === "name") list.sort((a, b) => a.name.localeCompare(b.name));
  else list.sort((a, b) => b.loans - a.loans); // popular
  return list;
}

function toolCard(t) {
  const avail = t.available ?? t.copies;
  return `<article class="card">
    <div class="icon" aria-hidden="true">${ICONS[t.category] || "🧰"}</div>
    <h3>${t.name}</h3>
    <p>${t.blurb}</p>
    <div class="meta"><span>${CATEGORY_LABELS[t.category]}</span><span>★ ${t.rating}</span><span>${t.loans} loans</span></div>
    <div class="meta"><span><strong>${money(t.fee)}</strong>/day</span><span>Deposit ${money(t.deposit)}</span></div>
    <p class="avail ${avail ? "" : "out"}">${avail ? avail + " of " + t.copies + " available" : "All copies out — try other dates"}</p>
    <div class="row">
      <button class="btn btn-small" data-reserve="${t.id}" ${avail ? "" : "disabled style='opacity:.5'"}>Reserve</button>
      <button class="btn btn-small btn-outline" data-details="${t.id}">Details</button>
    </div>
  </article>`;
}

function renderCatalog() {
  const grid = document.getElementById("tool-grid");
  if (!grid) return;
  const list = visibleTools();
  grid.innerHTML = list.length ? list.map(toolCard).join("") :
    `<div class="empty"><h3>No tools match that search</h3><p>Try a different word or category — or clear the filters to see the whole shelf.</p></div>`;
  const count = document.getElementById("result-count");
  if (count) count.textContent = `Showing ${list.length} of ${TOOLS.length} tools`;
  grid.querySelectorAll("[data-reserve]").forEach(b => b.addEventListener("click", () => openReserve(b.dataset.reserve)));
  grid.querySelectorAll("[data-details]").forEach(b => b.addEventListener("click", () => openDetails(b.dataset.details)));
}

function renderFeatured() {
  const grid = document.getElementById("featured-grid");
  if (!grid) return;
  grid.innerHTML = TOOLS.slice().sort((a, b) => b.loans - a.loans).slice(0, 4).map(toolCard).join("");
  grid.querySelectorAll("[data-reserve]").forEach(b => b.addEventListener("click", () => {
    location.href = "catalog.html?reserve=" + encodeURIComponent(b.dataset.reserve);
  }));
  grid.querySelectorAll("[data-details]").forEach(b => b.addEventListener("click", () => openDetails(b.dataset.details)));
}

/* ---- Details modal ---------------------------------------------------- */
function openDetails(id) {
  const t = TOOLS.find(x => x.id === id);
  if (!t) return;
  const back = document.getElementById("detail-modal");
  document.getElementById("detail-body").innerHTML = `
    <div class="icon" style="font-size:2.4rem">${ICONS[t.category] || "🧰"}</div>
    <h2>${t.name}</h2>
    <p>${t.blurb}</p>
    <div class="summary">
      <p><span>Category</span><span>${CATEGORY_LABELS[t.category]}</span></p>
      <p><span>Loan fee</span><span>${money(t.fee)} / day</span></p>
      <p><span>Refundable deposit (at pickup)</span><span>${money(t.deposit)}</span></p>
      <p><span>Copies owned</span><span>${t.copies}</span></p>
      <p><span>Member rating</span><span>★ ${t.rating} · ${t.loans} loans</span></p>
      <p><span>Comes with</span><span style="text-align:right;max-width:55%">${t.includes}</span></p>
    </div>
    <p class="note">Loans run up to 7 days. Members save 20% on loan fees. Late returns are ${money(3)} per day — a quick call extends most loans free.</p>
    <div class="row" style="display:flex;gap:.5rem;margin-top:1rem">
      <button class="btn" id="detail-reserve">Reserve this tool</button>
      <button class="btn btn-ghost" data-close>Close</button>
    </div>`;
  back.classList.add("open");
  document.getElementById("detail-reserve").addEventListener("click", () => {
    back.classList.remove("open");
    if (document.getElementById("reserve-form")) openReserve(id);
    else location.href = "catalog.html?reserve=" + encodeURIComponent(id);
  });
  back.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => back.classList.remove("open")));
}

/* ---- Reservation flow ------------------------------------------------- */
let currentTool = null;
function loanDays(pickup, ret) {
  return Math.round((new Date(ret + "T12:00:00") - new Date(pickup + "T12:00:00")) / 86400000) + 1;
}
function updateSummary() {
  const box = document.getElementById("res-summary");
  if (!box || !currentTool) return;
  const pickup = document.getElementById("f-pickup").value;
  const ret = document.getElementById("f-return").value;
  const member = document.getElementById("f-member").checked;
  if (!pickup || !ret || loanDays(pickup, ret) < 1) {
    box.innerHTML = `<p><span>Pick dates to see the full price — no surprises, ever.</span></p>`;
    return;
  }
  const days = loanDays(pickup, ret);
  const gross = days * currentTool.fee;
  const total = member ? gross * 0.8 : gross;
  box.innerHTML = `
    <p><span>${currentTool.name} × ${days} day${days > 1 ? "s" : ""}</span><span>${money(gross)}</span></p>
    ${member ? `<p><span>Member saving (20%)</span><span>−${money(gross - total)}</span></p>` : ""}
    <p class="total"><span>Due today</span><span>${money(total)}</span></p>
    <p><span>Refundable deposit at pickup</span><span>${money(currentTool.deposit)}</span></p>`;
}
function openReserve(id) {
  const form = document.getElementById("reserve-form");
  if (!form) { location.href = "catalog.html?reserve=" + encodeURIComponent(id); return; }
  currentTool = TOOLS.find(x => x.id === id);
  if (!currentTool) return;
  document.getElementById("res-tool-name").textContent = currentTool.name;
  document.getElementById("reserve-wrap").scrollIntoView({ behavior: "smooth" });
  form.reset();
  const today = new Date(); today.setDate(today.getDate() + 1);
  document.getElementById("f-pickup").value = today.toISOString().slice(0, 10);
  const ret = new Date(today); ret.setDate(ret.getDate() + 2);
  document.getElementById("f-return").value = ret.toISOString().slice(0, 10);
  document.getElementById("res-errors").classList.remove("show");
  document.getElementById("res-success").classList.remove("show");
  form.style.display = "";
  updateSummary();
}

function validateReservation(v) {
  const errors = [];
  if (!v.name.trim()) errors.push("Please add your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.push("That email does not look complete.");
  if (!/^[\d\s()+.-]{7,}$/.test(v.phone)) errors.push("Please add a phone number we can reach at pickup.");
  if (!v.pickupDate || !v.returnDate) errors.push("Pick a pickup and a return date.");
  if (v.pickupDate && v.returnDate) {
    const days = loanDays(v.pickupDate, v.returnDate);
    if (days < 1) errors.push("The return date must be on or after the pickup date.");
    if (days > 7) errors.push("Loans run up to 7 days — split longer projects into two loans.");
    const pickup = new Date(v.pickupDate + "T12:00:00");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (pickup < today) errors.push("The pickup date is in the past.");
    if (pickup.getDay() === 0) errors.push("We are closed on Sundays — choose another pickup day.");
    if (currentTool && localAvailable(currentTool, v.pickupDate, v.returnDate) < 1 && apiMode === "fallback") {
      errors.push("All copies are reserved for those dates in this demo — try different dates.");
    }
  }
  return errors;
}

/* POST to the REST API in live mode; same-shaped local object otherwise. */
async function submitReservation(v) {
  if (apiMode === "live") {
    const res = await fetch("api/reservations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolId: currentTool.id, ...v })
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data.errors || [data.error || "Reservation failed"]).join(" "));
    return { ...data, savedBy: "server" };
  }
  const days = loanDays(v.pickupDate, v.returnDate);
  const gross = days * currentTool.fee;
  const reservation = {
    ref: "TC-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    tool_id: currentTool.id, tool_name: currentTool.name,
    pickup_date: v.pickupDate, return_date: v.returnDate, days,
    member: v.member ? 1 : 0,
    total: Math.round(gross * (v.member ? 0.8 : 1) * 100) / 100,
    deposit: currentTool.deposit,
    name: v.name.trim(), email: v.email.trim(), phone: v.phone.trim(),
    status: "active", created_at: new Date().toISOString(), savedBy: "browser"
  };
  const list = localReservations(); list.push(reservation); saveLocalReservations(list);
  /* Refresh availability counts so the shelf stays honest. */
  TOOLS = TOOLS.map(t => ({ ...t, available: localAvailable(t) }));
  return reservation;
}

async function handleReserveSubmit(e) {
  e.preventDefault();
  const v = {
    name: document.getElementById("f-name").value,
    email: document.getElementById("f-email").value,
    phone: document.getElementById("f-phone").value,
    pickupDate: document.getElementById("f-pickup").value,
    returnDate: document.getElementById("f-return").value,
    member: document.getElementById("f-member").checked
  };
  const errBox = document.getElementById("res-errors");
  const errors = validateReservation(v);
  if (errors.length) {
    errBox.innerHTML = errors.map(x => `<div>• ${x}</div>`).join("");
    errBox.classList.add("show");
    return;
  }
  try {
    const r = await submitReservation(v);
    errBox.classList.remove("show");
    document.getElementById("reserve-form").style.display = "none";
    const s = document.getElementById("res-success");
    s.innerHTML = `<h3>Reserved — see you at the shelf 🎉</h3>
      <p><strong>Reference:</strong> ${r.ref}<br>
      <strong>Tool:</strong> ${r.tool_name}<br>
      <strong>Pickup:</strong> ${r.pickup_date} · <strong>Return:</strong> ${r.return_date} (${r.days} day${r.days > 1 ? "s" : ""})<br>
      <strong>Due today:</strong> ${money(r.total)} · <strong>Deposit at pickup:</strong> ${money(r.deposit)}</p>
      <p class="note">${r.savedBy === "server"
        ? "Saved in the SQLite database through POST /api/reservations — restart the server and it is still there."
        : "Saved in your browser (demo mode on GitHub Pages). Run the server in /server locally and reservations save into the SQLite database instead."}</p>`;
    s.classList.add("show");
    renderCatalog(); renderMyReservations();
  } catch (err) {
    errBox.innerHTML = `<div>• ${err.message}</div>`;
    errBox.classList.add("show");
  }
}

/* ---- My reservations + lookup + cancel (DELETE) ---------------------- */
function reservationCard(r, cancellable) {
  return `<div class="res-card">
    <div><strong>${r.tool_name}</strong><br>
    <span class="note">Ref ${r.ref} · ${r.pickup_date} → ${r.return_date} · ${money(r.total)} · Status: ${r.status}</span></div>
    ${cancellable && r.status === "active" ? `<button class="btn btn-small btn-outline" data-cancel="${r.ref}">Cancel reservation</button>` : ""}
  </div>`;
}
function renderMyReservations() {
  const box = document.getElementById("my-reservations");
  if (!box) return;
  const mine = localReservations().slice().reverse();
  box.innerHTML = apiMode === "live" && !mine.length
    ? `<p class="note">In live mode reservations live in the database — use the lookup below with your reference or email to see and cancel them. Reservations you make on this device in demo mode will also appear here.</p>`
    : (mine.length ? mine.map(r => reservationCard(r, true)).join("") : `<p class="note">No reservations on this device yet. Reserve a tool above and it will show up here.</p>`);
  box.querySelectorAll("[data-cancel]").forEach(b => b.addEventListener("click", () => cancelReservation(b.dataset.cancel)));
}
async function cancelReservation(ref) {
  if (apiMode === "live") {
    try { await fetch("api/reservations/" + encodeURIComponent(ref), { method: "DELETE" }); } catch (e) { /* still update local copy */ }
  }
  const list = localReservations().map(r => r.ref === ref ? { ...r, status: "cancelled" } : r);
  saveLocalReservations(list);
  if (apiMode === "fallback") TOOLS = TOOLS.map(t => ({ ...t, available: localAvailable(t) }));
  else await loadTools();
  renderCatalog(); renderMyReservations();
  const out = document.getElementById("lookup-results");
  if (out) out.innerHTML = `<p class="note">Reservation ${ref} cancelled. The copy is back on the shelf.</p>`;
}
async function handleLookup(e) {
  e.preventDefault();
  const q = document.getElementById("lookup-input").value.trim();
  const out = document.getElementById("lookup-results");
  if (!q) { out.innerHTML = `<p class="note">Type a reference (TC-…) or the email used for the reservation.</p>`; return; }
  let found = [];
  if (apiMode === "live") {
    try {
      if (q.toUpperCase().startsWith("TC-")) {
        const res = await fetch("api/reservations/" + encodeURIComponent(q.toUpperCase()));
        if (res.ok) found = [await res.json()];
      } else {
        const res = await fetch("api/reservations?email=" + encodeURIComponent(q));
        if (res.ok) found = (await res.json()).reservations;
      }
    } catch (err) { /* fall through to local */ }
  }
  if (!found.length) {
    found = localReservations().filter(r =>
      r.ref.toUpperCase() === q.toUpperCase() || r.email.toLowerCase() === q.toLowerCase());
  }
  out.innerHTML = found.length ? found.map(r => reservationCard(r, true)).join("")
    : `<p class="note">Nothing found for “${q}”. Check the reference or email and try again.</p>`;
  out.querySelectorAll("[data-cancel]").forEach(b => b.addEventListener("click", () => cancelReservation(b.dataset.cancel)));
}

/* ---- Stats, FAQ, newsletter ------------------------------------------- */
async function renderStats() {
  const box = document.getElementById("stats-band");
  if (!box) return;
  let tools = TOOLS.length, loans = TOOLS.reduce((s, t) => s + t.loans, 0);
  if (apiMode === "live") {
    try { const s = await (await fetch("api/stats")).json(); tools = s.tools; loans = s.loans; } catch (e) {}
  }
  box.innerHTML = `
    <div class="stat"><strong>${tools}</strong>tools on the shelf</div>
    <div class="stat"><strong>${loans.toLocaleString()}</strong>loans and counting</div>
    <div class="stat"><strong>$6</strong>average day of borrowing</div>
    <div class="stat"><strong>7 days</strong>max loan, renewable</div>`;
}
function initFaqAndNewsletter() {
  document.querySelectorAll(".faq button").forEach(btn => btn.addEventListener("click", () => {
    btn.closest(".faq").classList.toggle("open");
  }));
  const form = document.getElementById("newsletter-form");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const email = document.getElementById("nl-email").value.trim();
    const msg = document.getElementById("nl-msg");
    const saved = JSON.parse(localStorage.getItem("tinker_newsletter") || "[]");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "That email does not look complete — check it and try again."; return; }
    if (saved.includes(email)) { msg.textContent = "You are already on the Shelf Notes list — welcome back."; return; }
    saved.push(email); localStorage.setItem("tinker_newsletter", JSON.stringify(saved));
    msg.textContent = "You are in 🎉 Shelf Notes arrives the first Friday of the month.";
    form.reset();
  });
}

/* ---- Page wiring ------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await loadTools();
  renderFeatured(); renderCatalog(); renderStats(); renderMyReservations(); initFaqAndNewsletter();

  document.querySelectorAll(".chip").forEach(chip => chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeCategory = chip.dataset.filter; renderCatalog();
  }));
  const params = new URLSearchParams(location.search);
  if (params.get("cat")) {
    const chip = document.querySelector(`.chip[data-filter="${params.get("cat")}"]`);
    if (chip) chip.click();
  }
  const search = document.getElementById("search");
  if (search) search.addEventListener("input", () => { searchTerm = search.value; renderCatalog(); });
  const sort = document.getElementById("sort");
  if (sort) sort.addEventListener("change", () => { sortBy = sort.value; renderCatalog(); });
  const availBox = document.getElementById("only-available");
  if (availBox) availBox.addEventListener("change", () => { onlyAvailable = availBox.checked; renderCatalog(); });

  const form = document.getElementById("reserve-form");
  if (form) {
    form.addEventListener("submit", handleReserveSubmit);
    ["f-pickup", "f-return", "f-member"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", updateSummary);
    });
    if (params.get("reserve")) openReserve(params.get("reserve"));
    else if (TOOLS.length) { currentTool = TOOLS[0]; document.getElementById("res-tool-name").textContent = currentTool.name + " (pick any tool from the shelf above)"; updateSummary(); }
  }
  const lookup = document.getElementById("lookup-form");
  if (lookup) lookup.addEventListener("submit", handleLookup);
  const back = document.getElementById("detail-modal");
  if (back) back.addEventListener("click", e => { if (e.target === back) back.classList.remove("open"); });
});
