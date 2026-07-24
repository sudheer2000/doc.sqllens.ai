# SkyLineMySQL — Query Builder (Product Features & Demo Guide)

**Audience:** Sales, solutions engineering, customer demos, onboarding.  
**Scope:** The **Query Builder** experience in SkyLineMySQL is **schema-driven query assembly in the SQL editor** — drag tables and columns from the connection tree, use **inline shortcuts** before a drop, and get **foreign-key-aware JOIN** suggestions. (This is distinct from a standalone “visual canvas” diagram tool; the builder lives **in the editor** next to your code.)

**Premium flag (when sqllens.ai Cloud entitlements apply):** `qb` — Query Builder.

---

## 1. Value proposition (talk track)

- **Speed:** Assemble `SELECT` / `UPDATE` / `DELETE` / `INSERT` without retyping object names; the tree is the source of truth for spelling and qualification.
- **Correctness:** JOIN conditions can be derived from **cached foreign-key metadata**, including **bridge tables** and multiple relationship paths (with disambiguation when needed).
- **Context-aware columns:** Dropping a column respects **cursor clause** — e.g. append to `WHERE`, `SELECT`, `JOIN … ON`, `ORDER BY`, `GROUP BY`, `HAVING`, `SET`.
- **Keyboard rhythm:** Short tokens typed **immediately before** dragging (e.g. `s`, `LJ`, `W`) expand into full statement patterns, then the drag **fills in** the table or column.

---

## 2. Feature list (checklist for demos)

| # | Feature | User action (summary) | Notes |
|---|---------|------------------------|--------|
| 1 | **New query from table** | Drag a **table** onto an empty / valid line | Starts a statement; may offer JOIN path when query already exists |
| 2 | **JOIN expansion** | Drag a second table when an existing `SELECT` is in scope | Uses FK graph; may prompt when multiple joins are possible |
| 3 | **JOIN types via shortcuts** | Type `IJ`, `LJ`, `RJ`, `FJ`, `CJ` (or full words) before drag | Mapped in `sqlContextAnalyzer` patterns |
| 4 | **Column drop — clause aware** | Drag **column** with cursor in `SELECT` / `WHERE` / `ON` / etc. | Inserts `AND col = '?'`, plain identifiers in `SELECT`, etc. |
| 5 | **DML shortcuts** | `s` / `se` / `sel` → SELECT; `u` / `up` → UPDATE; `d` / `del` → DELETE; `i` / `ins` → INSERT | Full skeleton + placeholders |
| 5b | **Clause-letter stub** | After `;` or line start: `S`/`U`/`D` + one or more of `W` `G` `H` `O` (any order), then drag table/column | e.g. `SWG` → SELECT with WHERE + GROUP BY in SQL order; table uses `id`/PK/first column; column uses dragged column |
| 6 | **WHERE helpers** | `W`, `WL` / `WLIKE`, `WIN`, `WB` / `WBET`, `WN` / `WNULL`, … | Builds predicate templates around dragged column |
| 7 | **ORDER BY / GROUP BY / HAVING** | `OA` / `ORDER`, `GROUP`, `HAVING` context + column drag | Aligns with reporting demos |
| 8 | **Aggregates** | Shortcut patterns for `COUNT`, `SUM`, `AVG`, … + column | Useful for dashboard-style demos |
| 9 | **DDL / ops (optional demo)** | `CREATE TABLE`, `ALTER`, `SHOW INDEX`, `EXPLAIN`, maintenance verbs | Broader “builder” story for DBAs |
|10 | **Connection / DB alignment** | Active connection + database match editor | Wrong-DB guardrails and switch flows (see extension rules) |

Use this table as a **demo script outline**: enable 5–7 rows per customer segment (developers: 1–5; DBAs: 9–10).

---

## 3. Recommended sample database: MySQL `employees`

For **complex joins**, **history** (`salaries`, `titles`), **departments**, and **many-to-many** (`dept_emp`), the official **`employees`** sample database is the industry-standard demo schema.

**Included tables (high level):** `employees`, `departments`, `dept_emp`, `dept_manager`, `titles`, `salaries` — rich for multi-JOIN and aggregate demos.

If `employees` is **not** already installed on your machine, use the restore script in this repository (see section 5) or the upstream project: [https://github.com/datacharmer/test_db](https://github.com/datacharmer/test_db).

---

## 4. Demo scenarios (employees DB) — what to build on screen

Each scenario below is a **target SQL** you should end with (adjust quoting / limits for your MySQL mode). Narrate: *shortcut → drag table → drag second table → refine with column drops*.

### 4.1 Headcount by department (JOIN + GROUP BY)

```sql
SELECT d.dept_name, COUNT(*) AS headcount
FROM employees e
JOIN dept_emp de ON de.emp_no = e.emp_no AND de.to_date = '9999-01-01'
JOIN departments d ON d.dept_no = de.dept_no
GROUP BY d.dept_name
ORDER BY headcount DESC;
```

**Demo beats:** Drag `employees` → add `dept_emp` via JOIN suggestion → add `departments` → use `GROUP BY` / `ORDER BY` column drops for `dept_name` and aggregate.

### 4.2 Current average salary by department

```sql
SELECT d.dept_name, ROUND(AVG(s.salary), 2) AS avg_salary
FROM salaries s
JOIN employees e ON e.emp_no = s.emp_no
JOIN dept_emp de ON de.emp_no = e.emp_no AND de.to_date = '9999-01-01'
JOIN departments d ON d.dept_no = de.dept_no
WHERE s.to_date = '9999-01-01'
GROUP BY d.dept_name
ORDER BY avg_salary DESC;
```

**Demo beats:** Shows **fact table** `salaries`, **current row** filter on `to_date`, and **multi-hop** join path.

### 4.3 “Who reports to whom” (self-join on employee hierarchy)

The public `employees` table does not always model a `manager_id`; for **self-join** narratives use `dept_manager` (manager per department) or join `employees` twice on a role/title pattern. Example — **department managers and their names**:

```sql
SELECT d.dept_name, e.first_name, e.last_name
FROM dept_manager dm
JOIN departments d ON d.dept_no = dm.dept_no
JOIN employees e ON e.emp_no = dm.emp_no
WHERE dm.to_date = '9999-01-01'
ORDER BY d.dept_name;
```

**Demo beats:** Bridge **manager** fact table to **employees** for readable names.

### 4.4 Tenure — hire cohort with title filter

```sql
SELECT YEAR(e.hire_date) AS hire_year, COUNT(*) AS hires
FROM employees e
JOIN titles t ON t.emp_no = e.emp_no AND t.to_date = '9999-01-01'
WHERE t.title = 'Senior Engineer'
GROUP BY hire_year
ORDER BY hire_year;
```

**Demo beats:** **Predicate on title**, **GROUP BY** expression, good for showing WHERE + GROUP column drags.

### 4.5 “Find duplicates / hot keys” pattern (IN subquery style)

```sql
SELECT e.first_name, e.last_name, s.salary
FROM employees e
JOIN salaries s ON s.emp_no = e.emp_no AND s.to_date = '9999-01-01'
WHERE s.salary > (
  SELECT AVG(salary) FROM salaries WHERE to_date = '9999-01-01'
)
ORDER BY s.salary DESC
LIMIT 20;
```

**Demo beats:** Optional advanced story — compare to average; can be built with partial drag + manual subquery polish.

---

## 5. Restoring `employees` locally (all tables + data)

### Option A — Script in this repo

The script runs `mysql` **from the cloned `test_db` directory** (so `SOURCE load_*.dump` resolves). **MySQL client 9.5+** disables local commands by default; the script passes **`--commands`** automatically when supported (required for `employees.sql` on Homebrew MySQL 9.6, etc.).

From the repository root:

```bash
chmod +x scripts/restore_mysql_employees_sample.sh
# One server (default port 3306):
MYSQL_USER=root MYSQL_PASSWORD=yourpass ./scripts/restore_mysql_employees_sample.sh
# Two servers (same dump loaded on each port):
MYSQL_USER=root MYSQL_PASSWORD=yourpass MYSQL_PORTS=3306,3366 ./scripts/restore_mysql_employees_sample.sh
```

Environment variables (all optional except you must be able to connect):

| Variable | Default | Purpose |
|----------|---------|---------|
| `MYSQL_USER` | `root` | MySQL user |
| `MYSQL_PASSWORD` | *(empty)* | Password |
| `MYSQL_HOST` | `127.0.0.1` | Host |
| `MYSQL_PORT` | `3306` | Port (used when `MYSQL_PORTS` is not set) |
| `MYSQL_PORTS` | *(unset)* | Comma-separated list, e.g. `3306,3366` — loads `employees.sql` into **each** instance |
| `TEST_DB_CLONE_DIR` | `${TMPDIR:-/tmp}/skyline_mysql_test_db` | Where to clone `test_db` |

### Option B — Manual (official upstream)

```bash
git clone https://github.com/datacharmer/test_db.git
cd test_db
mysql -h 127.0.0.1 -u root -p < employees.sql
```

Load can take **several minutes** depending on disk and `innodb_flush_log_at_trx_commit` settings.

---

## 6. Demo checklist (day-of)

1. **Connection** — Test `SELECT COUNT(*) FROM employees.employees;`.
2. **Tree** — Expand `employees` schema; confirm large tables visible (signals “real” workload).
3. **Editor** — Open a new `.sql` file bound to the same connection / DB (per-file `@ DB` if you use it).
4. **Story** — Pick **two** scenarios from §4 (recommend **4.1** + **4.2**).
5. **Fallback** — If JOIN disambiguation appears, treat it as a **positive**: “multiple FK paths — the tool forces an explicit choice instead of guessing wrong.”

---

## 7. Related positioning doc

Internal GTM copy that includes drag-and-drop query building as a headline differentiator: `docs/WEBSITE_KEY_SELLING_FEATURES.md` (section “Drag-and-drop query building”).

---

*Document version: 1.1 — adds clause-letter stubs (`S`/`U`/`D` + `W`/`G`/`H`/`O`), tree-only MIME for SQL drops (no “Show drop options” chip), and richer EXISTS / comparison subquery generation. See also `prod-document/query-builder-product-guide.html`.*
