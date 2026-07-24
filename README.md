# SQLLens Docs — doc.sqllens.ai

Standalone static documentation site for **SQLLens** (VS Code / Cursor extension). This folder is intended to live in its **own Git repository** and deploy to **doc.sqllens.ai**.

The main extension repo keeps `productDoc/` for in-repo authoring; `docs-site/` is the publishable site with database-engine filtering and technical overview pages.

## Run locally

From this folder:

```bash
npm start
```

Then open [http://localhost:4173](http://localhost:4173).

Alternatives (no `package.json` required):

```bash
npx --yes serve . -p 4173
python -m http.server 4173
```

Double-clicking `index.html` works for quick previews, but use a local HTTP server for search, engine filter, and asset paths.

## Check internal links

```bash
npm run check-links
```

## Database engine selector

The header **engine bar** filters navigation, hub cards, and tagged sections:

| Selection | Behavior |
|-----------|----------|
| **All** (default) | Everything visible |
| **MySQL** / **PostgreSQL** / **MariaDB** / **SQLite** | Hides nav items, cards, and sections not tagged for that engine |

Selection is stored in `localStorage` under `docs-engine`.

Tag content with `data-engines="mysql postgres"` (space-separated). Omit the attribute for engine-agnostic content.

## Deploy to doc.sqllens.ai

1. Create a new GitHub repo (suggested name: `doc-sqllens-ai`).
2. Copy **only** the contents of this `docs-site/` folder into that repo root (not the parent sqllens monorepo).
3. Push to `main`.
4. Connect static hosting:
   - **Cloudflare Pages** — build command: *(none)*, output directory: `/`
   - **GitHub Pages** — Settings → Pages → deploy from `main` / root
   - **Netlify** — publish directory: `.`
5. Add DNS: `doc.sqllens.ai` → CNAME to your Pages host (or A/AAAA per provider docs).

No build step is required — plain HTML, CSS, and JS.

## Contents

| Path | Purpose |
|------|---------|
| `index.html` | Hub — getting started, latest features, module cards |
| `modules/technical-overview.html` | Technical docs — MCP, QO AI, exports, imports, engine matrix |
| `modules/mcp-ai-database.html` | MCP & AI database access |
| `modules/*.html` | Feature guides |
| `css/docs.css` | Skyline-style dark/light theme |
| `js/docs.js` | Sidebar, search, engine filter, TOC, SQL blocks |
| `images/` | Screenshots, GIFs, diagrams |

## Sync from extension repo

When updating docs from the main `sqllens` repo:

1. Refresh module HTML/images from `productDoc/` as needed.
2. Re-apply `docs-site`-specific changes: engine tags, `technical-overview.html`, branding in `index.html`, and `js/docs.js` engine filter.
3. Run `npm run check-links` before publishing.
