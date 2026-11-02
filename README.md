# Tinker Commons — Tool Lending Library

**Live site (front end):** https://brittanynation.github.io/tinker-commons/

A fully functional website for **Tinker Commons**, a fictional neighborhood tool lending library: browse 12 tools and kits, search / filter / sort the shelf, see real availability, reserve with validated dates and a live price summary, look reservations back up, and cancel them. Every interactive element works end to end — no dead buttons, no placeholder links.

This is an original portfolio concept by Brittany Nation. No affiliation with any real business is claimed. Design workflow: Sketch / Webflow for layout thinking, built by hand in HTML, CSS, and JavaScript.

## Course-track step 3: Databases + REST API design

This is the **third course-track project** in the portfolio, built alongside Dr. Angela Yu's *Full-Stack Web Development Bootcamp* (Udemy). Step 1 was live APIs + async JavaScript ([Solstice Skies](https://github.com/BrittanyNation/solstice-skies)); step 2 was Node.js + Express ([Willow Bend Paddle Co.](https://github.com/BrittanyNation/willow-bend-paddle)). This step adds a **real database** and designs the API the REST way:

- **SQLite database** (`server/db.js`, schema in `server/schema.sql`) — two related tables, `tools` and `reservations` (a foreign key links them), seeded once and then persistent: reservations survive server restarts, which step 2's in-memory list could not do. Uses Node 24's built-in `node:sqlite`, prepared statements throughout (no SQL injection), and computed availability from overlapping active reservations.
- **REST API** (`server/server.js`, every route commented as study code):

  | Route | What it does |
  |---|---|
  | `GET /api/tools?category=&q=&available=` | Catalogue with filters |
  | `GET /api/tools/:id` | One tool |
  | `POST /api/reservations` | Create a reservation → `201`, validated server-side too |
  | `GET /api/reservations/:ref` | Look one up |
  | `GET /api/reservations?email=` | A member's reservations |
  | `DELETE /api/reservations/:ref` | Cancel (soft-delete; the copy returns to the pool) |
  | `GET /api/stats` | Counts for the home page |

### Run the full-stack version locally

```bash
cd server
npm install   # downloads Express, once
npm start     # or: node server.js
```

Open http://localhost:3000 — the banner on the site will say **Live mode**, reservations save into `server/data/tinker.db`, and deleting that file resets the library to its seed catalogue.

### What is live vs local — honestly

GitHub Pages hosts static files only: it cannot run Node or SQLite. The published demo therefore uses the front end's built-in fallback catalogue (identical to the database seed) and saves reservations in your browser's localStorage, applying the same rules and math — and the banner on every page says which mode you are in. The database version is the code in `/server`, runnable locally as above.

## What works on the site

- **The Shelf** — 12 tools rendered from data; category chips, live search, four sort orders, an available-only toggle, and a live result count; availability reflects real reservations.
- **Details modal** — full specs, deposit, what's in the case, rating and loan count for every tool.
- **Reservations** — date-driven pricing (inclusive days × day fee), 20% member saving applied live in the summary, refundable deposit shown separately, full validation (email, phone, past dates, return before pickup, 7-day max, Sunday-closed pickup), a confirmation with a generated `TC-XXXXXX` reference, and persistence (SQLite in live mode, localStorage on Pages).
- **Lookup & cancel** — find a reservation by reference or email and cancel it; the copy returns to the available pool.
- **Visit page** — membership plans, hours table, working FAQ accordions, and a validated newsletter signup that recognises repeat signups.

## Palette

Workshop brick `#A63D2A`, copper `#C97B3D`, muted sage `#7A8B6F`, warm parchment `#F7F1E6`, charcoal ink `#26221F`, cream paper `#FFFCF5`.

## Pages

- `index.html` — home: how borrowing works, most-borrowed tools, library stats
- `catalog.html` — the shelf, reservation flow, my reservations + lookup
- `visit.html` — membership plans, hours, FAQs, newsletter
