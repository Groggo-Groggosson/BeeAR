/**
 * Bundle ESM sources into a single IIFE for <script> tags and Android WebView.
 * No external bundler required. Version is read from package.json.
 */
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

// min-friendly copy name with version (for release artifacts)
const versioned = path.join(dist, `beear-tryon-${version}.js`);
fs.writeFileSync(versioned, out);

// also copy into web assets for the demo host
const webAssets = path.join(root, "..", "web", "assets");
if (fs.existsSync(webAssets)) {
  fs.writeFileSync(path.join(webAssets, "beear-tryon.js"), out);
  console.log("copied → packages/web/assets/beear-tryon.js");
}
console.log("wrote", outPath, out.length, "bytes");
console.log("wrote", versioned);
