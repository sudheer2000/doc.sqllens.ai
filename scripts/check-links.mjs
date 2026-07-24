import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function walkHtml(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (name === "ref" || name === "scripts") continue;
      walkHtml(p, out);
    } else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

function checkFile(absPath) {
  const rel = path.relative(root, absPath).replace(/\\/g, "/");
  const html = fs.readFileSync(absPath, "utf8");
  const missing = [];
  const badAnchors = [];
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|javascript:|#)/.test(href)) continue;
    const [filePart, anchor] = href.split("#");
    const base = path.dirname(absPath);
    const target = path.normalize(path.join(base, filePart));
    if (!target.startsWith(root) || !fs.existsSync(target)) {
      missing.push({ from: rel, href });
      continue;
    }
    if (anchor && !fs.readFileSync(target, "utf8").includes(`id="${anchor}"`)) {
      badAnchors.push({ from: rel, href });
    }
  }
  return { rel, missing, badAnchors };
}

let any = false;
for (const file of walkHtml(root)) {
  const { rel, missing, badAnchors } = checkFile(file);
  if (missing.length || badAnchors.length) {
    any = true;
    console.log("\n" + rel);
    missing.forEach((x) => console.log("  MISSING", x.href));
    badAnchors.forEach((x) => console.log("  BAD ANCHOR", x.href));
  }
}
if (!any) console.log("All internal links OK.");
else process.exitCode = 1;
