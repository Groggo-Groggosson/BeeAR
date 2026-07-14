/**
 * Bundle ESM sources into a single IIFE for <script> tags and Android WebView.
 * Also emits a minified build (esbuild when available, crude fallback otherwise).
 * Version is read from package.json.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "src");
const dist = path.join(root, "dist");
fs.mkdirSync(dist, { recursive: true });

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version || "0.0.0";
const noMinify = process.argv.includes("--no-minify");

// Keep VERSION in ESM source in sync
const indexPath = path.join(src, "index.js");
let indexSrc = fs.readFileSync(indexPath, "utf8");
indexSrc = indexSrc.replace(
  /export const VERSION = ["'][^"']*["'];/,
  `export const VERSION = "${version}";`,
);
fs.writeFileSync(indexPath, indexSrc);

// Simple concat order for zero-dep IIFE (no circular imports).
const files = ["fit.js", "paint.js", "overlay.js"];
let body = "";
for (const f of files) {
  let code = fs.readFileSync(path.join(src, f), "utf8");
  // strip ESM import/export for IIFE body
  code = code.replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];?\s*/gm, "");
  code = code.replace(/^export\s+/gm, "");
  body += `\n/* --- ${f} --- */\n` + code + "\n";
}

const out = `/* @beear/tryon v${version} — IIFE for web + Android WebView
 * https://github.com/mergeos-bounties/BeeAR
 * License: MIT
 */
(function (global) {
  "use strict";
${body}
  var api = {
    VERSION: ${JSON.stringify(version)},
    DEFAULT_PD_MM: DEFAULT_PD_MM,
    estimateFit: estimateFit,
    overlaySize: overlaySize,
    landmarkBox: landmarkBox,
    compareFrames: compareFrames,
    faceMetricsFromLandmarks: faceMetricsFromLandmarks,
    paintFrameShape: paintFrameShape,
    roundRect: roundRect,
    drawFrameAt: drawFrameAt,
    drawGlassesOverlay: drawGlassesOverlay,
    WebViewHints: {
      defaultLoopbackUrl: "http://localhost:8860/",
      queryDesktop: "desktop=1",
      assetPath: "file:///android_asset/beear/index.html",
    },
  };
  global.BeeARTryOn = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
`;

const outPath = path.join(dist, "beear-tryon.js");
fs.writeFileSync(outPath, out);

// versioned full build
const versioned = path.join(dist, `beear-tryon-${version}.js`);
fs.writeFileSync(versioned, out);

function crudeMinifyJs(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n /g, "\n")
    .trim();
}

function minifyWithEsbuild(infile, outfile) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  try {
    execFileSync(
      npx,
      [
        "--yes",
        "esbuild@0.25.0",
        infile,
        "--minify",
        `--outfile=${outfile}`,
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
  } catch {
    return false;
  }
}

// minified artifacts
const minPath = path.join(dist, "beear-tryon.min.js");
const minVersioned = path.join(dist, `beear-tryon-${version}.min.js`);
if (!noMinify) {
  if (minifyWithEsbuild(outPath, minPath)) {
    console.log("minified via esbuild →", minPath, fs.statSync(minPath).size, "bytes");
  } else {
    const min = crudeMinifyJs(out);
    fs.writeFileSync(minPath, min);
    console.log("minified via fallback →", minPath, min.length, "bytes");
  }
  fs.copyFileSync(minPath, minVersioned);
} else {
  fs.copyFileSync(outPath, minPath);
  fs.copyFileSync(outPath, minVersioned);
}

// also copy into web assets for the demo host (prefer min for size, keep full name)
const webAssets = path.join(root, "..", "web", "assets");
if (fs.existsSync(webAssets)) {
  // Keep unminified name for server/debug; also drop .min next to it
  fs.writeFileSync(path.join(webAssets, "beear-tryon.js"), out);
  if (fs.existsSync(minPath)) {
    fs.copyFileSync(minPath, path.join(webAssets, "beear-tryon.min.js"));
  }
  console.log("copied → packages/web/assets/beear-tryon.js");
}
console.log("wrote", outPath, out.length, "bytes");
console.log("wrote", versioned);
console.log("wrote", minPath);
console.log("wrote", minVersioned);
