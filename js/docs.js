/* SQLLens.AI Product Docs — shared chrome
   - Sidebar (nested, collapsible, filter)
   - Search across pages (built from window.DOCS_INDEX)
   - Dark mode toggle (persisted)
   - Prev / Next from sidebar order
   - PDF export (window.print)
   - Page feedback (localStorage)
   - TOC scroll-spy from current page's h2/h3
*/
(function(){
  'use strict';

  // ---------- Theme ----------
  var root = document.documentElement;
  var saved = localStorage.getItem('docs-theme');
  if (saved) root.setAttribute('data-theme', saved);
  else if (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) root.setAttribute('data-theme','dark');

  function toggleTheme(){
    var cur = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    var next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('docs-theme', next);
    var btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = next === 'dark' ? '☀' : '☾';
  }

  // ---------- Database engine filter (doc.sqllens.ai) ----------
  var ENGINE_STORAGE_KEY = 'docs-engine';
  var ENGINE_ALL = 'all';
  var ENGINE_OPTIONS = [
    { id: ENGINE_ALL, label: 'All' },
    { id: 'mysql', label: 'MySQL' },
    { id: 'postgres', label: 'PostgreSQL' },
    { id: 'mariadb', label: 'MariaDB' },
    { id: 'sqlite', label: 'SQLite' }
  ];
  /** Pages limited to specific engines; omit = all engines */
  var PAGE_ENGINES = {
    'modules/slow-query-analyzer.html': ['mysql', 'mariadb', 'postgres'],
    'modules/performance-monitor.html': ['mysql', 'mariadb', 'postgres'],
    'modules/query-profiler.html': ['mysql', 'mariadb']
  };

  function getSelectedEngine() {
    try {
      var saved = localStorage.getItem(ENGINE_STORAGE_KEY);
      if (saved && ENGINE_OPTIONS.some(function (o) { return o.id === saved; })) return saved;
    } catch (e) {}
    return ENGINE_ALL;
  }

  function setSelectedEngine(id) {
    try { localStorage.setItem(ENGINE_STORAGE_KEY, id); } catch (e) {}
  }

  function enginesForPagePath(pagePath) {
    return PAGE_ENGINES[pagePath] || null;
  }

  function enginesForNavPath(navPath) {
    return enginesForPagePath(pageOf(navPath));
  }

  function elementEngines(el) {
    var raw = el && el.getAttribute && el.getAttribute('data-engines');
    if (!raw) return null;
    return raw.toLowerCase().split(/\s+/).filter(Boolean);
  }

  function matchesEngine(allowed, selected) {
    if (!allowed || !allowed.length || selected === ENGINE_ALL) return true;
    return allowed.indexOf(selected) !== -1;
  }

  function injectEngineBar() {
    var header = document.querySelector('.doc-header');
    if (!header || document.getElementById('engineBar')) return;
    var brand = header.querySelector('.brand');
    if (brand) {
      brand.innerHTML = '<span class="dot"></span>SQLLens Docs<span class="brand-sub">· doc.sqllens.ai</span>';
    }
    var bar = document.createElement('div');
    bar.className = 'doc-engine-bar';
    bar.id = 'engineBar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Database engine filter');
    var label = document.createElement('span');
    label.className = 'engine-label';
    label.textContent = 'Engine';
    bar.appendChild(label);
    var selected = getSelectedEngine();
    ENGINE_OPTIONS.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.engine = opt.id;
      btn.textContent = opt.label;
      btn.setAttribute('aria-pressed', opt.id === selected ? 'true' : 'false');
      if (opt.id === selected) btn.classList.add('active');
      btn.addEventListener('click', function () {
        setSelectedEngine(opt.id);
        bar.querySelectorAll('button').forEach(function (b) {
          var on = b.dataset.engine === opt.id;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        applyEngineFilter(opt.id);
      });
      bar.appendChild(btn);
    });
    if (brand && brand.nextSibling) {
      header.insertBefore(bar, brand.nextSibling);
    } else {
      header.appendChild(bar);
    }
  }

  function applyEngineFilter(selected) {
    if (!selected) selected = getSelectedEngine();

    document.querySelectorAll('#docNav > .group > ul > li').forEach(function (li) {
      var a = li.querySelector(':scope > a');
      if (!a) return;
      var path = a.getAttribute('data-path') || '';
      var allowed = enginesForNavPath(path);
      li.classList.toggle('hidden', !matchesEngine(allowed, selected));
    });

    document.querySelectorAll('#docNav > .group').forEach(function (grp) {
      var anyVisible = Array.from(grp.querySelectorAll(':scope > ul > li')).some(function (li) {
        return !li.classList.contains('hidden');
      });
      grp.classList.toggle('engine-hidden', !anyVisible);
    });

    document.querySelectorAll('.cards .card[data-engines], .doc-main [data-engines]').forEach(function (el) {
      var allowed = elementEngines(el);
      el.classList.toggle('engine-hidden', !matchesEngine(allowed, selected));
    });

    var curPage = currentPagePath();
    var pageAllowed = enginesForPagePath(curPage);
    var main = document.querySelector('.doc-main');
    var mismatchId = 'engineMismatchBanner';
    var existing = document.getElementById(mismatchId);
    if (main && pageAllowed && !matchesEngine(pageAllowed, selected)) {
      if (!existing) {
        existing = document.createElement('div');
        existing.id = mismatchId;
        existing.className = 'callout warn doc-engine-mismatch';
        existing.innerHTML = '<div class="label">Engine filter</div><p>This page is not available for the selected engine. Switch the engine bar to <strong>All</strong> or choose a supported engine.</p>';
        var hero = main.querySelector('.doc-hero');
        if (hero && hero.nextSibling) {
          main.insertBefore(existing, hero.nextSibling);
        } else {
          main.insertBefore(existing, main.firstChild);
        }
      }
      existing.style.display = '';
    } else if (existing) {
      existing.style.display = 'none';
    }
  }

  // ---------- Site map (single source of truth for sidebar + search + prev/next) ----------
  // path is relative to the productDoc root
  var GROUPS = [
    { label:'Guides', items:[
      { t:'Home', p:'index.html' },
      { t:'Get started', p:'get-started.html' },
      { t:'Connect database', p:'connect-db.html', children:[
        { t:'Open dialog', p:'connect-db.html#connect-open' },
        { t:'Saved connections', p:'connect-db.html#connect-saved' },
        { t:'MySQL tab', p:'connect-db.html#connect-mysql' },
        { t:'SSH tab', p:'connect-db.html#connect-ssh' },
        { t:'SSL tab', p:'connect-db.html#connect-ssl' },
        { t:'Advanced tab', p:'connect-db.html#connect-advanced' },
        { t:'Connect / Test', p:'connect-db.html#connect-actions' },
      ]},
      { t:'Cloud & sqllens.ai', p:'modules/cloud-account.html', children:[
        { t:'Overview', p:'modules/cloud-account.html#cca-overview' },
        { t:'Sign in', p:'modules/cloud-account.html#cca-sign-in-out' },
        { t:'Web login', p:'modules/cloud-account.html#cca-web-login' },
        { t:'Usage & credits', p:'modules/cloud-account.html#cca-usage' },
        { t:'Offline mode', p:'modules/cloud-account.html#cca-offline' },
        { t:'Diagnose', p:'modules/cloud-account.html#cca-tree-gate' },
      ]},
    ]},
    { label:'Technical', items:[
      { t:'Technical overview', p:'modules/technical-overview.html', children:[
        { t:'Latest features', p:'modules/technical-overview.html#tech-latest' },
        { t:'Engine matrix', p:'modules/technical-overview.html#tech-engine-matrix' },
        { t:'MCP & AI database', p:'modules/technical-overview.html#tech-mcp' },
        { t:'Query Optimizer AI', p:'modules/technical-overview.html#tech-qo-ai' },
        { t:'Excel exports', p:'modules/technical-overview.html#tech-exports' },
        { t:'Import connections', p:'modules/technical-overview.html#tech-import-connections' },
        { t:'Workspace credentials', p:'modules/technical-overview.html#tech-workspace-credentials' },
        { t:'Architecture notes', p:'modules/technical-overview.html#tech-architecture' },
      ]},
      { t:'MCP & AI database (guide)', p:'modules/mcp-ai-database.html' },
    ]},
    { label:'SQL editor & workspace', items:[
      { t:'Overview', p:'modules/sql-workspace.html#ws-overview' },
      { t:'Action priority', p:'modules/sql-workspace.html#ws-favorites-panel' },
      { t:'Priority 1 — Write & run script', p:'modules/sql-workspace.html#ws-priority-1' },
      { t:'Priority 2 — Run one query', p:'modules/sql-workspace.html#ws-priority-2' },
      { t:'Priority 3 — PL/SQL blocks', p:'modules/sql-workspace.html#ws-priority-3' },
      { t:'Open SQL files', p:'modules/sql-workspace.html#ws-open-files' },
      { t:'Syntax highlighting', p:'modules/sql-workspace.html#ws-syntax' },
      { t:'Explorer & active database', p:'modules/sql-workspace.html#ws-explorer' },
      { t:'Per-file database context', p:'modules/sql-workspace.html#ws-db-context' },
      { t:'Saved queries vs Favorites', p:'modules/sql-workspace.html#ws-saved-vs-favorites' },
      { t:'CodeLens overview', p:'modules/sql-workspace.html#ws-codelens-overview' },
      { t:'CodeLens — statement row', p:'modules/sql-workspace.html#ws-codelens-statement' },
      { t:'CodeLens — database chip', p:'modules/sql-workspace.html#ws-codelens-database' },
      { t:'CodeLens — AI', p:'modules/sql-workspace.html#ws-codelens-ai' },
      { t:'DELIMITER & routine blocks', p:'modules/sql-workspace.html#ws-codelens-delimiter' },
      { t:'Examples — DELIMITER blocks', p:'modules/sql-workspace.html#ws-examples-delimiter' },
      { t:'Format & Beautify', p:'modules/sql-workspace.html#ws-format' },
      { t:'Editor right‑click', p:'modules/sql-workspace.html#ws-editor-context' },
      { t:'Editor menu (full list)', p:'modules/sql-workspace.html#ws-editor-context-full' },
      { t:'Query Results right‑click', p:'modules/sql-workspace.html#ws-results-context' },
      { t:'SQL Status right‑click', p:'modules/sql-workspace.html#ws-status-context' },
      { t:'Autocomplete (summary)', p:'modules/sql-workspace.html#ws-autocomplete' },
      { t:'Autocomplete (full guide)', p:'modules/sql-autocomplete.html#ac-overview' },
      { t:'SQL Favorites', p:'modules/sql-workspace.html#ws-favorites' },
      { t:'Favorites panel actions', p:'modules/sql-workspace.html#ws-favorites-panel-actions' },
      { t:'Run, EXPLAIN & Optimize', p:'modules/sql-workspace.html#ws-run-explain' },
      { t:'Result panels & status', p:'modules/sql-workspace.html#ws-panels' },
      { t:'Tree search', p:'modules/sql-workspace.html#ws-tree-search' },
      { t:'Sample queries', p:'modules/sql-workspace.html#ws-sql-examples' },
      { t:'Examples — SELECT & joins', p:'modules/sql-workspace.html#ws-examples-joins' },
      { t:'Examples — CTE & DML', p:'modules/sql-workspace.html#ws-examples-cte' },
      { t:'Examples — procedure / trigger', p:'modules/sql-workspace.html#ws-examples-delimiter-proc' },
    ]},
    { label:'Query builder', items:[
      { t:'Overview', p:'modules/query-builder.html#qb-overview' },
      { t:'Demo (GIF)', p:'modules/query-builder.html#qb-demo-storyboard' },
      { t:'Drag tables & columns', p:'modules/query-builder.html#qb-drag-basics' },
      { t:'Smart SQL on drop', p:'modules/query-builder.html#qb-smart-sql' },
      { t:'JOINs & dialogs', p:'modules/query-builder.html#qb-joins' },
      { t:'Shortcuts before a drop', p:'modules/query-builder.html#qb-shortcuts' },
      { t:'Clause-letter shortcuts', p:'modules/query-builder.html#qb-clause-letters' },
      { t:'Drag & drop into SQL', p:'modules/query-builder.html#qb-drag-ux' },
      { t:'employees sample DB', p:'modules/query-builder.html#qb-sample-db' },
      { t:'Scenario SQL targets', p:'modules/query-builder.html#qb-demo-scenarios' },
      { t:'Matching settings', p:'modules/query-builder.html#qb-settings' },
      { t:'Connection mismatch', p:'modules/query-builder.html#qb-connection-match' },
      { t:'Tips & limits', p:'modules/query-builder.html#qb-tips' },
    ]},
    { label:'SQL autocomplete', items:[
      { t:'Overview', p:'modules/sql-autocomplete.html#ac-overview' },
      { t:'Screenshots', p:'modules/sql-autocomplete.html#ac-demo-gallery' },
      { t:'@com command channel', p:'modules/sql-autocomplete.html#ac-demo-at-com' },
      { t:'@dba & search', p:'modules/sql-autocomplete.html#ac-demo-at-dba-search' },
      { t:'Open & navigate list', p:'modules/sql-autocomplete.html#ac-invoke' },
      { t:'@ mention channels', p:'modules/sql-autocomplete.html#ac-at-mentions' },
      { t:'Slash shortcuts', p:'modules/sql-autocomplete.html#ac-slash-mentions' },
      { t:'vs Query Builder', p:'modules/sql-autocomplete.html#ac-vs-builder' },
      { t:'Completion sources', p:'modules/sql-autocomplete.html#ac-sources' },
      { t:'JOIN ON suggestions', p:'modules/sql-autocomplete.html#ac-join-on' },
      { t:'Favorites & recent', p:'modules/sql-autocomplete.html#ac-favorites' },
      { t:'Builder tokens in list', p:'modules/sql-autocomplete.html#ac-qb-tokens' },
      { t:'Settings', p:'modules/sql-autocomplete.html#ac-settings' },
      { t:'Troubleshooting', p:'modules/sql-autocomplete.html#ac-troubleshoot' },
    ]},
    { label:'Schema & database objects', items:[
      { t:'Overview', p:'modules/schema-and-objects.html#sch-overview' },
      { t:'Databases', p:'modules/schema-and-objects.html#sch-databases' },
      { t:'Tables & designer', p:'modules/schema-and-objects.html#sch-tables' },
      { t:'Views, routines, triggers', p:'modules/schema-and-objects.html#sch-views-routines' },
      { t:'Users & privileges', p:'modules/schema-and-objects.html#sch-users-privileges' },
    ]},
    { label:'Data import, export & schema tools', items:[
      { t:'Overview', p:'modules/data-and-schema-tools.html#data-overview' },
      { t:'Import & export', p:'modules/data-and-schema-tools.html#data-import-export' },
      { t:'Schema sync / compare', p:'modules/data-and-schema-tools.html#data-schema-sync' },
      { t:'Generate documentation', p:'modules/data-and-schema-tools.html#data-documentation' },
      { t:'Copy structure & execute script', p:'modules/data-and-schema-tools.html#data-copy-execute' },
    ]},
    { label:'Query Optimizer (QO)', items:[
      { t:'Overview', p:'modules/query-optimizer.html#qo-overview' },
      { t:'Open the workbench', p:'modules/query-optimizer.html#qo-open' },
      { t:'Layout & header', p:'modules/query-optimizer.html#qo-workbench-layout' },
      { t:'Toolbar actions', p:'modules/query-optimizer.html#qo-toolbar' },
      { t:'Analyze panel', p:'modules/query-optimizer.html#qo-analyze-panel' },
      { t:'Recommended indexes', p:'modules/query-optimizer.html#qo-analyze-indexes' },
      { t:'Index Strategy Studio', p:'modules/query-optimizer.html#qo-index-strategy-studio' },
      { t:'AI Advisor', p:'modules/query-optimizer.html#qo-ai-advisor' },
      { t:'3 AI compare (LLMs)', p:'modules/query-optimizer.html#qo-ai-compare' },
      { t:'Explain panel', p:'modules/query-optimizer.html#qo-explain-panel' },
      { t:'Visual Explain', p:'modules/query-optimizer.html#qo-visual-explain' },
      { t:'Algorithm trace', p:'modules/query-optimizer.html#qo-trace' },
      { t:'Create Index flow', p:'modules/query-optimizer.html#qo-indexes' },
      { t:'Query rewrites (MySQL)', p:'modules/query-optimizer.html#qo-rewrites-mysql' },
      { t:'Index-linked rewrites', p:'modules/query-optimizer.html#qo-rewrites-index-linked' },
      { t:'PostgreSQL issues', p:'modules/query-optimizer.html#qo-rewrites-pg' },
      { t:'SQLite plan view', p:'modules/query-optimizer.html#qo-rewrites-sqlite' },
      { t:'Engine comparison', p:'modules/query-optimizer.html#qo-engine-compare' },
      { t:'When to optimize', p:'modules/query-optimizer.html#qo-when-to-use' },
      { t:'Batch optimize', p:'modules/query-optimizer.html#qo-index-batch' },
      { t:'Optimizer settings', p:'modules/query-optimizer.html#qo-settings' },
      { t:'Tips & limits', p:'modules/query-optimizer.html#qo-tips' },
    ]},
    { label:'Slow Query Log Analyzer (QLA)', items:[
      { t:'Overview', p:'modules/slow-query-analyzer.html#qla-overview' },
      { t:'How to open', p:'modules/slow-query-analyzer.html#qla-open' },
      { t:'Home — data sources', p:'modules/slow-query-analyzer.html#qla-home' },
      { t:'Toolbar after load', p:'modules/slow-query-analyzer.html#qla-toolbar-loaded' },
      { t:'Summary stat cards', p:'modules/slow-query-analyzer.html#qla-summary' },
      { t:'Main tabs', p:'modules/slow-query-analyzer.html#qla-tabs' },
      { t:'Fingerprints grid', p:'modules/slow-query-analyzer.html#qla-fingerprints-grid' },
      { t:'Row actions', p:'modules/slow-query-analyzer.html#qla-row-actions' },
      { t:'Action bar', p:'modules/slow-query-analyzer.html#qla-action-bar' },
      { t:'Bubble timeline', p:'modules/slow-query-analyzer.html#qla-bubble-chart' },
      { t:'Progress banner', p:'modules/slow-query-analyzer.html#qla-operation-banner' },
      { t:'Create Indexes overlay', p:'modules/slow-query-analyzer.html#qla-create-indexes' },
      { t:'Optimizer settings', p:'modules/slow-query-analyzer.html#qla-settings' },
      { t:'Auto-detect & logging', p:'modules/slow-query-analyzer.html#qla-find-logs' },
      { t:'Tuning workflow', p:'modules/slow-query-analyzer.html#qla-workflow' },
      { t:'Privileges & troubleshooting', p:'modules/slow-query-analyzer.html#qla-privileges' },
      { t:'Tips', p:'modules/slow-query-analyzer.html#qla-tips' },
    ]},
    { label:'Performance Monitor (PM)', items:[
      { t:'Overview', p:'modules/performance-monitor.html#pm-overview' },
      { t:'How to open', p:'modules/performance-monitor.html#pm-open' },
      { t:'Header controls', p:'modules/performance-monitor.html#pm-header' },
      { t:'Tab bar', p:'modules/performance-monitor.html#pm-tabs' },
      { t:'Dashboard', p:'modules/performance-monitor.html#pm-dashboard' },
      { t:'DB health signals', p:'modules/performance-monitor.html#pm-db-health' },
      { t:'Profiler (Live)', p:'modules/performance-monitor.html#pm-profiler' },
      { t:'Running Queries', p:'modules/performance-monitor.html#pm-running-queries' },
      { t:'Long Transactions', p:'modules/performance-monitor.html#pm-long-transactions' },
      { t:'DB Locks', p:'modules/performance-monitor.html#pm-locks' },
      { t:'Connections', p:'modules/performance-monitor.html#pm-connections' },
      { t:'DB workload', p:'modules/performance-monitor.html#pm-db-workload' },
      { t:'MySQL config', p:'modules/performance-monitor.html#pm-mysql-config' },
      { t:'Replication', p:'modules/performance-monitor.html#pm-replication' },
      { t:'Slow Queries', p:'modules/performance-monitor.html#pm-slow-queries' },
      { t:'Unused indexes', p:'modules/performance-monitor.html#pm-unused-indexes' },
      { t:'Table insights', p:'modules/performance-monitor.html#pm-table-insights' },
      { t:'Alerts', p:'modules/performance-monitor.html#pm-alerts' },
      { t:'Diagnostic palette', p:'modules/performance-monitor.html#pm-diagnostics' },
      { t:'Data retention', p:'modules/performance-monitor.html#pm-storage' },
      { t:'Tips', p:'modules/performance-monitor.html#pm-tips' },
    ]},
    { label:'Query Profiler', items:[
      { t:'Overview', p:'modules/query-profiler.html#prof-overview' },
      { t:'When to profile', p:'modules/query-profiler.html#prof-when' },
      { t:'Start a session', p:'modules/query-profiler.html#prof-start' },
      { t:'Read results', p:'modules/query-profiler.html#prof-results' },
      { t:'Demo: Profiler session', p:'modules/query-profiler.html#prof-demo' },
      { t:'Tips', p:'modules/query-profiler.html#prof-tips' },
    ]},
    { label:'LLMs & AI', items:[
      { t:'Overview', p:'modules/ai-llm-integration.html#ailm-overview' },
      { t:'Enable / disable AI', p:'modules/ai-llm-integration.html#ailm-enable' },
      { t:'Providers & models', p:'modules/ai-llm-integration.html#ailm-providers' },
      { t:'API keys & accounts', p:'modules/ai-llm-integration.html#ailm-keys' },
      { t:'Schema context & privacy', p:'modules/ai-llm-integration.html#ailm-privacy' },
      { t:'From the editor (CodeLens)', p:'modules/ai-llm-integration.html#ailm-codelens' },
      { t:'Command Palette & panel', p:'modules/ai-llm-integration.html#ailm-palette-panel' },
      { t:'Create DB objects with AI', p:'modules/ai-llm-integration.html#ailm-create-objects' },
      { t:'Troubleshooting', p:'modules/ai-llm-integration.html#ailm-troubleshoot' },
    ]},
    { label:'MCP & AI database', items:[
      { t:'Overview', p:'modules/mcp-ai-database.html#mcp-overview' },
      { t:'VS Code & Cursor', p:'modules/mcp-ai-database.html#mcp-vscode-cursor' },
      { t:'@sql & @sqllens chat', p:'modules/mcp-ai-database.html#mcp-chat-participants' },
      { t:'Agent mode', p:'modules/mcp-ai-database.html#mcp-agent-mode' },
      { t:'Connection scope', p:'modules/mcp-ai-database.html#mcp-connections' },
      { t:'SQLite profiles', p:'modules/mcp-ai-database.html#mcp-sqlite' },
      { t:'Safety & privacy', p:'modules/mcp-ai-database.html#mcp-safety' },
      { t:'Tool summary', p:'modules/mcp-ai-database.html#mcp-tools' },
      { t:'External listener', p:'modules/mcp-ai-database.html#mcp-external-listener' },
      { t:'Getting started', p:'modules/mcp-ai-database.html#mcp-getting-started' },
      { t:'Tips & limits', p:'modules/mcp-ai-database.html#mcp-tips' },
    ]},
    { label:'Settings', items:[
      { t:'How to open', p:'settings.html#settings-how' },
      { t:'AI / LLM', p:'settings.html#settings-ai' },
      { t:'Exec & results', p:'settings.html#settings-exec' },
      { t:'Editor & drag-and-drop', p:'settings.html#settings-editor' },
      { t:'Optimizer', p:'settings.html#settings-optimizer' },
      { t:'Performance & monitoring', p:'settings.html#settings-performance' },
      { t:'sqllens.ai / cloud', p:'settings.html#settings-cloud' },
      { t:'Themes & grammars', p:'settings.html#settings-themes' },
    ]},
    { label:'Keyboard shortcuts', items:[
      { t:'Overview', p:'modules/keyboard-shortcuts.html#kbd-overview' },
      { t:'@ mention shortcuts', p:'modules/keyboard-shortcuts.html#kbd-at-mentions' },
      { t:'Default keybindings', p:'modules/keyboard-shortcuts.html#kbd-defaults' },
      { t:'Customizing', p:'modules/keyboard-shortcuts.html#kbd-customize' },
    ]},
    { label:'Advanced: mock & diagnostics', items:[
      { t:'Overview', p:'modules/advanced-testing.html#adv-overview' },
      { t:'Mock JSON runner', p:'modules/advanced-testing.html#adv-mock-json' },
      { t:'Mock table generator', p:'modules/advanced-testing.html#adv-mock-table' },
      { t:'Diagnostic queries', p:'modules/advanced-testing.html#adv-diagnostics' },
    ]},
  ];

  // detect doc root relative prefix (normalized for Windows file:// URLs)
  function normalizePath() {
    return (location.pathname || "").replace(/\\/g, "/");
  }

  /** When docs are served under /mysql/ or /productDoc/ (not repo root), return that prefix. */
  function docMountPrefix() {
    var path = normalizePath();
    var markers = ["/mysql/", "/productDoc/", "/docs-site/"];
    var i;
    for (i = 0; i < markers.length; i++) {
      var m = markers[i];
      var idx = path.indexOf(m);
      if (idx !== -1) {
        return path.slice(0, idx) + m;
      }
    }
    if (/\/mysql$/i.test(path)) {
      return path + "/";
    }
    return "";
  }

  function relPrefix() {
    var mp = docMountPrefix();
    if (mp) {
      return mp;
    }
    var p = normalizePath();
    return /\/modules\//.test(p) ? "../" : "";
  }

  /** Resolve productDoc-relative asset or page URLs when mounted under /mysql/ etc. */
  function resolveDocUrl(relative) {
    if (!relative) {
      return relative;
    }
    if (/^(https?:|\/\/|#|data:|mailto:)/i.test(relative)) {
      return relative;
    }
    var mp = docMountPrefix();
    if (mp) {
      if (relative.indexOf("../") === 0) {
        return mp + relative.slice(3);
      }
      if (relative.indexOf("./") === 0) {
        return mp + relative.slice(2);
      }
      if (relative.charAt(0) === "/") {
        return relative;
      }
      return mp + relative;
    }
    return relPrefix() + relative;
  }

  function fixDocAssetUrls() {
    var mp = docMountPrefix();
    if (!mp) {
      return;
    }
    document.querySelectorAll('link[rel="stylesheet"][href]').forEach(function (el) {
      var href = el.getAttribute("href");
      if (href) {
        el.setAttribute("href", resolveDocUrl(href));
      }
    });
    document.querySelectorAll("script[src]").forEach(function (el) {
      var src = el.getAttribute("src");
      if (src) {
        el.setAttribute("src", resolveDocUrl(src));
      }
    });
    document.querySelectorAll("img[src]").forEach(function (el) {
      var src = el.getAttribute("src");
      if (src) {
        el.setAttribute("src", resolveDocUrl(src));
      }
    });
    document.querySelectorAll(".doc-header .brand[href]").forEach(function (el) {
      var href = el.getAttribute("href");
      if (href) {
        el.setAttribute("href", resolveDocUrl(href));
      }
    });
    document.querySelectorAll(".doc-main a[href], .cards a[href], .doc-site-footer a[href]").forEach(function (el) {
      var href = el.getAttribute("href");
      if (href && !/^(https?:|\/\/|#|mailto:)/i.test(href)) {
        el.setAttribute("href", resolveDocUrl(href));
      }
    });
  }

  function pageOf(href) {
    // strip hash
    return href.split("#")[0];
  }
  function currentPagePath() {
    var path = normalizePath();
    var markers = ["/mysql/", "/productDoc/", "/docs-site/"];
    var i;
    for (i = 0; i < markers.length; i++) {
      var m = markers[i];
      var idx = path.indexOf(m);
      if (idx !== -1) {
        var rel = path.slice(idx + m.length);
        return rel || "index.html";
      }
    }
    if (/\/mysql$/i.test(path)) {
      return "index.html";
    }
    var m = path.match(/\/modules\/([^/]+\.html)$/i);
    if (m) return "modules/" + m[1];
    var file = path.replace(/^.*\//, "");
    return file || "index.html";
  }

  // ---------- Sidebar render ----------
  function renderSidebar(){
    var nav = document.getElementById('docNav');
    if (!nav) return;
    var curPage = currentPagePath();
    var curHash = location.hash;
    var html = '';
    GROUPS.forEach(function(g, gi){
      html += '<li class="group" data-group="'+gi+'">';
      html += '<div class="group-label"><span class="chev">▾</span><span>'+g.label+'</span></div><ul>';
      g.items.forEach(function(it){
        var href = resolveDocUrl(it.p);
        var isCur = pageOf(it.p) === curPage && (!it.p.includes('#') || it.p.endsWith(curHash));
        html += '<li><a href="'+href+'" data-path="'+it.p+'" class="'+(isCur?'active':'')+'">'+it.t+'</a>';
        if (it.children){
          html += '<ul>';
          it.children.forEach(function(c){
            html += '<li class="sub"><a href="'+resolveDocUrl(c.p)+'" data-path="'+c.p+'">'+c.t+'</a></li>';
          });
          html += '</ul>';
        }
        html += '</li>';
      });
      html += '</ul></li>';
    });
    nav.innerHTML = html;

    applyEngineFilter(getSelectedEngine());

    // collapse groups that don't contain current page (keep current open)
    var groups = nav.querySelectorAll('.group');
    groups.forEach(function(grp){
      var hasCur = grp.querySelector('a.active');
      if (!hasCur) grp.classList.add('collapsed');
      grp.querySelector('.group-label').addEventListener('click', function(){
        grp.classList.toggle('collapsed');
      });
    });
  }

  // ---------- Sidebar filter ----------
  function wireFilter(){
    var f = document.getElementById('navFilter');
    if (!f) return;
    f.addEventListener('input', function(){
      var q = f.value.trim().toLowerCase();
      document.querySelectorAll('#docNav li').forEach(function(li){
        if (li.classList.contains('group')) return;
        var a = li.querySelector(':scope > a');
        if (!a) return;
        var match = !q || a.textContent.toLowerCase().includes(q);
        li.classList.toggle('hidden', !match);
      });
      document.querySelectorAll('#docNav .group').forEach(function(g){
        var anyVisible = Array.from(g.querySelectorAll('li')).some(function(l){return !l.classList.contains('hidden') && !l.classList.contains('group')});
        g.style.display = anyVisible || !q ? '' : 'none';
        if (q) g.classList.remove('collapsed');
      });
    });
  }

  // ---------- Search ----------
  function wireSearch(){
    var wrap = document.getElementById('docSearch');
    if (!wrap) return;
    var input = wrap.querySelector('input');
    var results = wrap.querySelector('.results');
    var all = [];
    GROUPS.forEach(function(g){ g.items.forEach(function(it){
      all.push({t:it.t, p:it.p, g:g.label});
      if (it.children) it.children.forEach(function(c){ all.push({t:c.t, p:c.p, g:g.label}); });
    });});

    function render(q){
      if (!q){ wrap.classList.remove('open'); results.innerHTML=''; return; }
      var ql = q.toLowerCase();
      var hits = all.filter(function(x){ return x.t.toLowerCase().includes(ql) || x.g.toLowerCase().includes(ql); }).slice(0, 30);
      if (!hits.length){ results.innerHTML='<div class="empty">No matches for "'+escapeHtml(q)+'"</div>'; }
      else {
        var byGroup = {};
        hits.forEach(function(h){ (byGroup[h.g]=byGroup[h.g]||[]).push(h); });
        var html='';
        Object.keys(byGroup).forEach(function(gn){
          html += '<a class="group" tabindex="-1" style="cursor:default">'+escapeHtml(gn)+'</a>';
          byGroup[gn].forEach(function(h){
            html += '<a href="'+resolveDocUrl(h.p)+'">'+highlight(h.t, q)+'</a>';
          });
        });
        results.innerHTML = html;
      }
      wrap.classList.add('open');
    }
    input.addEventListener('input', function(){ render(input.value.trim()); });
    input.addEventListener('focus', function(){ if (input.value.trim()) render(input.value.trim()); });
    document.addEventListener('click', function(e){ if (!wrap.contains(e.target)) wrap.classList.remove('open'); });
    document.addEventListener('keydown', function(e){
      if ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); input.focus(); input.select(); }
      if (e.key==='Escape'){ wrap.classList.remove('open'); input.blur(); }
    });
  }
  function escapeHtml(s){ return s.replace(/[&<>"']/g, function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function highlight(text, q){
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i<0) return escapeHtml(text);
    return escapeHtml(text.slice(0,i))+'<mark style="background:var(--accent-soft);color:var(--accent-fg);padding:0 2px;border-radius:2px">'+escapeHtml(text.slice(i,i+q.length))+'</mark>'+escapeHtml(text.slice(i+q.length));
  }

  // ---------- Prev / Next ----------
  function renderPrevNext(){
    var host = document.getElementById('prevNext');
    if (!host) return;
    var flat = [];
    GROUPS.forEach(function(g){ g.items.forEach(function(it){
      // use top-level items only for prev/next stepping
      flat.push({t:g.label+' · '+it.t, p:it.p});
    });});
    var cur = currentPagePath();
    var idx = flat.findIndex(function(x){ return pageOf(x.p) === cur; });
    if (idx < 0) return;
    var prev = idx > 0 ? flat[idx-1] : null;
    var next = idx < flat.length-1 ? flat[idx+1] : null;
    var html='';
    if (prev) html += '<a href="'+resolveDocUrl(prev.p)+'" class="prev"><div class="dir">← Previous</div><div class="ttl">'+escapeHtml(prev.t)+'</div></a>'; else html+='<span></span>';
    if (next) html += '<a href="'+resolveDocUrl(next.p)+'" class="next"><div class="dir">Next →</div><div class="ttl">'+escapeHtml(next.t)+'</div></a>'; else html+='<span></span>';
    host.innerHTML = html;
  }

  // ---------- TOC ----------
  function renderToc(){
    var toc = document.getElementById('docToc');
    if (!toc) return;
    var main = document.querySelector('.doc-main');
    if (!main) return;
    var heads = main.querySelectorAll('h2[id], h3[id]');
    if (!heads.length){ toc.style.display='none'; return; }
    var html = '<div class="toc-label">On this page</div><ul>';
    heads.forEach(function(h){
      html += '<li><a href="#'+h.id+'" class="'+(h.tagName==='H3'?'h3':'')+'">'+escapeHtml(h.textContent)+'</a></li>';
    });
    html += '</ul>';
    toc.innerHTML = html;
    // scroll spy
    var links = toc.querySelectorAll('a');
    function spy(){
      var y = window.scrollY + 90;
      var current = null;
      heads.forEach(function(h){ if (h.offsetTop <= y) current = h; });
      // If we've reached the bottom of the page, force the last heading active
      // so sections near the bottom that can't be scrolled past still highlight.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = heads[heads.length - 1];
      }
      links.forEach(function(a){ a.classList.toggle('active', current && a.getAttribute('href') === '#'+current.id); });
    }
    window.addEventListener('scroll', spy, {passive:true});
    spy();
  }

  // ---------- Feedback ----------
  function wireFeedback(){
    var fb = document.getElementById('feedback');
    if (!fb) return;
    var key = 'docs-feedback:'+location.pathname;
    fb.querySelectorAll('[data-vote]').forEach(function(b){
      b.addEventListener('click', function(){
        var vote = b.dataset.vote;
        fb.querySelector('.prompt').style.display='none';
        fb.querySelector('.detail').style.display='block';
        fb.dataset.vote = vote;
      });
    });
    var submit = fb.querySelector('[data-submit]');
    if (submit) submit.addEventListener('click', function(){
      var text = fb.querySelector('textarea').value.trim();
      var data = { page:location.pathname, vote:fb.dataset.vote || 'n/a', text:text, at:new Date().toISOString() };
      try { var all = JSON.parse(localStorage.getItem('docs-feedback-log')||'[]'); all.push(data); localStorage.setItem('docs-feedback-log', JSON.stringify(all)); } catch(e){}
      fb.querySelector('.detail').style.display='none';
      fb.querySelector('.thanks').style.display='block';
    });
  }

  // ---------- Mobile sidebar ----------
  function wireMobile(){
    var btn = document.getElementById('menuToggle');
    var sb = document.querySelector('.doc-sidebar');
    var scrim = document.getElementById('scrim');
    if (!btn || !sb) return;
    function close(){ sb.classList.remove('open'); if(scrim) scrim.classList.remove('show'); }
    btn.addEventListener('click', function(){ sb.classList.toggle('open'); if(scrim) scrim.classList.toggle('show'); });
    if (scrim) scrim.addEventListener('click', close);
    sb.addEventListener('click', function(e){ if (e.target.tagName==='A') close(); });
  }

  // ---------- PDF / Print ----------
  function wirePdf(){
    var btn = document.getElementById('pdfBtn');
    if (btn) btn.addEventListener('click', function(){ window.print(); });
  }

  // ---------- SQL code blocks (chrome + highlight.js — same behavior as productDoc/ref) ----------
  var COPY_ICON_SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.75"/>' +
    '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
  var CHECK_ICON_SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  function loadScript(src){
    return new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function formatSqlForDisplay(sql, pre){
    var raw = String(sql || '').replace(/\r/g, '');
    var t = raw.trim();
    if (!t) return raw;
    if (pre && pre.hasAttribute('data-sql-no-format')) return raw;
    if (/\bDELIMITER\b/i.test(t)) return raw;
    if (!/(^|\s)(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REPLACE|TRUNCATE|WITH|CALL|EXPLAIN|SHOW|DESCRIBE|DESC|USE|GRANT|REVOKE|BEGIN|END)\b/im.test(t)) {
      return raw;
    }
    try {
      if (typeof sqlFormatter !== 'undefined' && sqlFormatter.format) {
        return sqlFormatter.format(t, {
          language: 'mysql',
          tabWidth: 4,
          keywordCase: 'upper',
          linesBetweenQueries: 2
        });
      }
    } catch (e) {
      console.log('[docs] SQL format skipped', e);
    }
    return raw;
  }

  function formatAllSqlInMain(){
    var main = document.querySelector('.doc-main');
    if (!main) return;
    main.querySelectorAll('pre').forEach(function(pre){
      if (pre.classList.contains('no-sql-copy')) return;
      if (pre.closest('.sql-pre-wrap')) return;
      var code = pre.querySelector('code');
      if (!code) return;
      var raw = code.textContent || '';
      var formatted = formatSqlForDisplay(raw, pre);
      if (formatted !== raw) code.textContent = formatted;
    });
  }

  function enhanceSqlCodeBlocks(){
    var main = document.querySelector('.doc-main');
    if (!main) return;
    main.querySelectorAll('pre').forEach(function(pre){
      if (pre.classList.contains('no-sql-copy')) return;
      if (pre.closest('.sql-pre-wrap')) return;
      var code = pre.querySelector('code');
      if (!code) return;

      pre.setAttribute('data-sql-line-numbers', '');

      var wrap = document.createElement('div');
      wrap.className = 'sql-pre-wrap';
      pre.parentNode.insertBefore(wrap, pre);

      var chrome = document.createElement('div');
      chrome.className = 'sql-block-chrome';

      var header = document.createElement('div');
      header.className = 'sql-block-header';
      var label = document.createElement('span');
      label.className = 'sql-block-label';
      label.innerHTML = '<span class="sql-block-icon" aria-hidden="true">&lt;/&gt;</span> SQL';
      header.appendChild(label);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sql-copy-btn';
      btn.setAttribute('aria-label', 'Copy SQL to clipboard');
      btn.innerHTML = COPY_ICON_SVG;
      header.appendChild(btn);

      var body = document.createElement('div');
      body.className = 'sql-block-body';

      if (pre.hasAttribute('data-sql-line-numbers')){
        body.classList.add('sql-pre--numbered');
        var rawLines = (code.textContent || '').replace(/\r/g, '').split('\n');
        var lc = rawLines.length;
        if (lc > 0 && rawLines[lc - 1] === '') lc--;
        var gutter = document.createElement('pre');
        gutter.className = 'sql-linenos-col';
        gutter.setAttribute('aria-hidden', 'true');
        var nums = [];
        for (var li = 1; li <= lc; li++) nums.push(String(li));
        gutter.textContent = nums.join('\n');
        body.appendChild(gutter);
      }

      body.appendChild(pre);
      chrome.appendChild(header);
      chrome.appendChild(body);
      wrap.appendChild(chrome);

      function getText(){
        return (code.innerText || code.textContent || '').replace(/\u00a0/g, ' ');
      }
      btn.addEventListener('click', function(){
        var text = getText();
        function ok(){
          btn.innerHTML = CHECK_ICON_SVG;
          btn.classList.add('is-done');
          btn.setAttribute('aria-label', 'SQL copied');
          setTimeout(function(){
            btn.innerHTML = COPY_ICON_SVG;
            btn.classList.remove('is-done');
            btn.setAttribute('aria-label', 'Copy SQL to clipboard');
          }, 2000);
        }
        function fail(){
          btn.setAttribute('aria-label', 'Copy failed — select SQL and use keyboard copy');
          setTimeout(function(){ btn.setAttribute('aria-label', 'Copy SQL to clipboard'); }, 2500);
        }
        if (navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(text).then(ok).catch(fail);
        } else {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          try { if (document.execCommand('copy')) ok(); else fail(); }
          catch (e) { fail(); }
          document.body.removeChild(ta);
        }
      });
    });
  }

  function highlightSqlBlocks(){
    if (typeof hljs === 'undefined') return;
    document.querySelectorAll('.doc-main .sql-block-body pre code').forEach(function(code){
      try {
        code.classList.add('language-sql');
        hljs.highlightElement(code);
      } catch (e) {
        console.log('[docs] SQL highlight failed', e);
      }
    });
  }

  function initSqlBlocks(){
    var hlBase = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/';
    var fmtUrl = 'https://cdn.jsdelivr.net/npm/sql-formatter@15.4.6/dist/sql-formatter.min.js';
    loadScript(fmtUrl)
      .then(function(){
        formatAllSqlInMain();
        enhanceSqlCodeBlocks();
        return loadScript(hlBase + 'highlight.min.js');
      })
      .then(function(){ return loadScript(hlBase + 'languages/sql.min.js'); })
      .then(highlightSqlBlocks)
      .catch(function(e){ console.log('[docs] SQL blocks init failed', e); });
  }

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', function(){
    fixDocAssetUrls();
    injectEngineBar();
    renderSidebar();
    wireFilter();
    wireSearch();
    renderPrevNext();
    renderToc();
    wireFeedback();
    wireMobile();
    wirePdf();
    initSqlBlocks();
    var themeBtn = document.getElementById('themeBtn');
    if (themeBtn){
      themeBtn.textContent = root.getAttribute('data-theme')==='dark' ? '☀' : '☾';
      themeBtn.addEventListener('click', toggleTheme);
    }
  });
})();
