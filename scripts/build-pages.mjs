/**
 * Build a static GitHub Pages demo from packages/web + packages/catalog.
 *
 * Output → site/  (served at https://mergeos-bounties.github.io/BeeAR/)
 *
 * Usage (repo root):
 *   node scripts/build-pages.mjs
 *   node scripts/build-pages.mjs --no-minify
 */
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const webDir = path.join(root, "packages", "web");
const catalogDir = path.join(root, "packages", "catalog");
const outDir = path.join(root, "site");
const noMinify = process.argv.includes("--no-minify");

function log(...args) {
  console.log(...args);
}

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  ensureDir(dest);
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    const st = fs.statSync(s);
    if (st.isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}

function walkFiles(dir, pred = () => true) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walkFiles(p, pred));
    else if (pred(p)) out.push(p);
  }
  return out;
}

/** Rewrite absolute demo paths so project-page base /BeeAR/ works. */
function rewriteStaticText(text) {
  return text
    .replace(/href="\/assets\//g, 'href="./assets/')
    .replace(/src="\/assets\//g, 'src="./assets/')
    .replace(/href="\/studio3d\.html"/g, 'href="./studio3d.html"')
    .replace(/href="\/"/g, 'href="./"')
    .replace(/src: "\/assets\//g, 'src: "./assets/')
    .replace(/src: '\/assets\//g, "src: './assets/")
    .replace(/`\/catalog\//g, "`./catalog/")
    .replace(/"\/catalog\//g, '"./catalog/')
    .replace(/'\/catalog\//g, "'./catalog/")
    .replace(/url\(\/assets\//g, "url(./assets/")
    .replace(/url\("\/assets\//g, 'url("./assets/')
    .replace(/url\('\/assets\//g, "url('./assets/");
}

function injectStaticBoot(html) {
  let out = html;
  // Mark document as static for BeeARStatic.detectStatic()
  if (!/data-static=/.test(out)) {
    out = out.replace(/<html([^>]*)>/i, '<html$1 data-static="1">');
  }
  const boot = `<script>window.__BEEAR_STATIC__=true;</script>\n`;
  if (!out.includes("__BEEAR_STATIC__")) {
    if (out.includes("</head>")) {
      out = out.replace("</head>", `  ${boot}</head>`);
    } else {
      out = boot + out;
    }
  }
  // Ensure static-api.js is loaded (before app / module scripts)
  if (!out.includes("static-api.js")) {
    out = out.replace(
      /(<script[^>]+src="[^"]*app\.js"[^>]*>\s*<\/script>)/i,
      '<script src="./assets/static-api.js"></script>\n  $1',
    );
    out = out.replace(
      /(<script[^>]+src="[^"]*studio3d\.js"[^>]*>\s*<\/script>)/i,
      '<script src="./assets/static-api.js"></script>\n  $1',
    );
  }
  // Studio is type=module — still needs classic static-api first
  if (out.includes("studio3d") && !out.includes("static-api.js")) {
    out = out.replace(
      "</body>",
      '  <script src="./assets/static-api.js"></script>\n</body>',
    );
  }
  return out;
}

function enrichCatalog() {
  const rawPath = path.join(catalogDir, "frames.json");
  const data = JSON.parse(fs.readFileSync(rawPath, "utf8"));
  const svgDir = path.join(catalogDir, "svg");
  const glbDir = path.join(catalogDir, "glb");

  const frames = (data.frames || []).map((f) => {
    const svgName = f.svg || "";
    const glbName = f.glb || "";
    const hasSvg = Boolean(svgName && fs.existsSync(path.join(svgDir, svgName)));
    const hasGlb = Boolean(glbName && fs.existsSync(path.join(glbDir, glbName)));
    return {
      ...f,
      has_svg: hasSvg,
      has_glb: hasGlb,
      // relative to site root (works with project pages base /BeeAR/)
      svg_url: svgName ? `./catalog/svg/${svgName}` : null,
      glb_url: glbName ? `./catalog/glb/${glbName}` : null,
    };
  });

  const people = (data.person_models || []).map((person) => {
    const glbName = person.glb || "";
    const hasGlb = Boolean(glbName && fs.existsSync(path.join(glbDir, glbName)));
    return {
      ...person,
      has_glb: hasGlb,
      glb_url: glbName ? `./catalog/glb/${glbName}` : null,
    };
  });

  return {
    ...data,
    frames,
    person_models: people,
    glb_count: frames.filter((f) => f.has_glb).length,
    person_count: people.filter((p) => p.has_glb).length,
    static: true,
    generated_at: new Date().toISOString(),
  };
}

function tryEsbuildMinify(infile, outfile) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  try {
    // Write next to source with a real extension so esbuild picks the loader.
    execFileSync(
      npx,
      [
        "--yes",
        "esbuild@0.25.0",
        path.resolve(infile),
        "--minify",
        `--outfile=${path.resolve(outfile)}`,
        "--target=es2018",
        "--legal-comments=none",
      ],
      {
        cwd: root,
        stdio: "pipe",
        shell: process.platform === "win32",
        env: process.env,
      },
    );
    return fs.existsSync(outfile);
  } catch (err) {
    const msg = err.stderr?.toString?.() || err.message || String(err);
    log("  esbuild minify failed for", path.relative(root, infile), "—", msg.slice(0, 200));
    return false;
  }
}

/** Minimal fallback: strip block/line comments and collapse whitespace (non-string-safe-ish for our own sources). */
function crudeMinifyJs(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n /g, "\n")
    .trim();
}

function crudeMinifyCss(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

function minifyAssets() {
  if (noMinify) {
    log("skip minify (--no-minify)");
    return;
  }
  const assets = path.join(outDir, "assets");
  // Skip already-minified vendor copies (*.min.js)
  const jsFiles = walkFiles(assets, (p) => p.endsWith(".js") && !p.endsWith(".min.js"));
  const cssFiles = walkFiles(assets, (p) => p.endsWith(".css"));

  for (const fp of jsFiles) {
    const before = fs.statSync(fp).size;
    const tmp = fp.replace(/\.js$/i, ".__min.js");
    if (tryEsbuildMinify(fp, tmp) && fs.existsSync(tmp)) {
      fs.renameSync(tmp, fp);
    } else {
      try {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
      const src = fs.readFileSync(fp, "utf8");
      fs.writeFileSync(fp, crudeMinifyJs(src));
    }
    const after = fs.statSync(fp).size;
    log(`  minify js  ${path.relative(outDir, fp)}  ${before} → ${after}`);
  }

  for (const fp of cssFiles) {
    const before = fs.statSync(fp).size;
    const tmp = fp.replace(/\.css$/i, ".__min.css");
    if (tryEsbuildMinify(fp, tmp) && fs.existsSync(tmp)) {
      fs.renameSync(tmp, fp);
    } else {
      try {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
      const src = fs.readFileSync(fp, "utf8");
      fs.writeFileSync(fp, crudeMinifyCss(src));
    }
    const after = fs.statSync(fp).size;
    log(`  minify css ${path.relative(outDir, fp)}  ${before} → ${after}`);
  }
}

function write404Redirect() {
  // GitHub Pages SPA-ish: send unknown paths back to index for demo deep-links
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>BeeAR</title>
  <meta http-equiv="refresh" content="0; url=./" />
  <script>location.replace("./" + (location.hash || ""));</script>
</head>
<body>
  <p><a href="./">BeeAR demo</a></p>
</body>
</html>
`;
  fs.writeFileSync(path.join(outDir, "404.html"), html);
}

function writeNoJekyll() {
  fs.writeFileSync(path.join(outDir, ".nojekyll"), "");
}

// --- main ---
log("=== BeeAR GitHub Pages build ===");
rmrf(outDir);
ensureDir(outDir);

// 1) web host
log("copy packages/web → site/");
copyDir(webDir, outDir);

// 2) catalog assets
log("copy catalog svg + glb");
copyDir(path.join(catalogDir, "svg"), path.join(outDir, "catalog", "svg"));
copyDir(path.join(catalogDir, "glb"), path.join(outDir, "catalog", "glb"));
// raw frames for debugging
copyFile(path.join(catalogDir, "frames.json"), path.join(outDir, "catalog", "frames.json"));

// 3) enriched catalog for static-api.js
const enriched = enrichCatalog();
const enrichedPath = path.join(outDir, "catalog", "frames.enriched.json");
fs.writeFileSync(enrichedPath, JSON.stringify(enriched));
log(
  `  frames.enriched.json  frames=${enriched.frames.length} glb=${enriched.glb_count} people=${enriched.person_count}`,
);

// 4) ensure tryon IIFE is present (build if missing)
const tryonSrc = path.join(root, "packages", "tryon-js", "dist", "beear-tryon.js");
const tryonDest = path.join(outDir, "assets", "beear-tryon.js");
if (!fs.existsSync(tryonDest) || !fs.existsSync(path.join(webDir, "assets", "beear-tryon.js"))) {
  log("build @beear/tryon IIFE…");
  try {
    execSync("npm run build", {
      cwd: path.join(root, "packages", "tryon-js"),
      stdio: "inherit",
    });
  } catch (e) {
    log("warn: tryon-js build failed", e.message || e);
  }
}
if (fs.existsSync(tryonSrc)) {
  copyFile(tryonSrc, tryonDest);
} else if (fs.existsSync(path.join(webDir, "assets", "beear-tryon.js"))) {
  copyFile(path.join(webDir, "assets", "beear-tryon.js"), tryonDest);
}

// 5) rewrite HTML/JS/CSS for relative paths + static boot
for (const fp of walkFiles(outDir, (p) => /\.(html|js|css)$/.test(p))) {
  // do not rewrite binary-ish or huge generated json
  let text = fs.readFileSync(fp, "utf8");
  text = rewriteStaticText(text);
  if (fp.endsWith(".html")) text = injectStaticBoot(text);
  fs.writeFileSync(fp, text);
}

write404Redirect();
writeNoJekyll();

// 6) minify JS/CSS in site/assets
log("minify assets…");
minifyAssets();

// 7) summary
let total = 0;
const byExt = {};
for (const fp of walkFiles(outDir)) {
  const sz = fs.statSync(fp).size;
  total += sz;
  const ext = path.extname(fp) || "(none)";
  byExt[ext] = (byExt[ext] || 0) + sz;
}
log("\n=== site/ ready ===");
log("  path:", outDir);
log("  size:", (total / (1024 * 1024)).toFixed(1), "MB");
for (const [ext, sz] of Object.entries(byExt).sort((a, b) => b[1] - a[1])) {
  log(`  ${ext.padEnd(8)} ${(sz / (1024 * 1024)).toFixed(2)} MB`);
}
log("\nLocal preview:");
log("  npx --yes serve site -p 4173");
log("  → http://127.0.0.1:4173/");
log("GitHub Pages (after deploy):");
log("  https://mergeos-bounties.github.io/BeeAR/");
