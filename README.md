# BeeAR

[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://www.python.org/downloads/)
[![Server](https://img.shields.io/badge/beear-0.3.0-0E8A16.svg)](packages/server/pyproject.toml)
[![Libs](https://img.shields.io/badge/libs-v0.3.0-0E8A16.svg)](https://github.com/mergeos-bounties/BeeAR/releases/tag/libs-v0.3.0)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![MergeOS](https://img.shields.io/badge/MergeOS-bounties-5319E7.svg)](https://github.com/mergeos-bounties)

**BeeAR** is a **virtual try-on** stack for **glasses and accessories** — frame catalog, pupil-distance (PD) fit estimates, multi-frame compare, plus web / desktop / Android clients built on shared libraries.

**Product:** [mergeos-bounties/BeeAR](https://github.com/mergeos-bounties/BeeAR)

---

## Table of contents

- [Monorepo packages](#monorepo-packages)
- [Libraries (web + Android)](#libraries-web--android)
- [Highlights](#highlights)
- [Screenshots](#screenshots)
- [Quick start (server)](#quick-start-server)
- [CLI reference](#cli-reference)
- [Catalog & fit](#catalog--fit)
- [Diagrams](#diagrams)
- [Repository layout](#repository-layout)
- [Privacy](#privacy)
- [Development](#development)
- [Android](#android)
- [MergeOS bounties](#mergeos-bounties)
- [License](#license)

---

## Monorepo packages

| Package | Path | Role |
| --- | --- | --- |
| **@beear/tryon** | `packages/tryon-js` | Shared JS try-on lib (fit, overlay) for web + Android WebView |
| **BeeAR Server** | `packages/server` | Catalog API, try-on helpers, FastAPI, CLI (`beear`) |
| **BeeAR Web** | `packages/web` | Thin browser host over `@beear/tryon` |
| **BeeAR Desktop** | `packages/desktop` | Electron shell wrapping the web app |
| **beear-webview** | `packages/android/beear-webview` | **Android library (AAR)** — reusable WebView try-on |
| **BeeAR Android app** | `packages/android/app` | Demo host embedding the AAR |

Primary offline path: **server** (`beear demo`).

---

## Libraries (web + Android)

BeeAR try-on ships as **reusable libraries** — download prebuilt artifacts from GitHub Releases:

**[libs-v0.3.0](https://github.com/mergeos-bounties/BeeAR/releases/tag/libs-v0.3.0)**

| Lib | Artifact | Consumers |
| --- | --- | --- |
| **`@beear/tryon`** | [`beear-tryon-0.3.0.js`](https://github.com/mergeos-bounties/BeeAR/releases/download/libs-v0.3.0/beear-tryon-0.3.0.js) · [npm tgz](https://github.com/mergeos-bounties/BeeAR/releases/download/libs-v0.3.0/beear-tryon-0.3.0.tgz) | Web host, Android WebView, desktop |
| **`com.beear:beear-webview`** | [`beear-webview-0.3.0.aar`](https://github.com/mergeos-bounties/BeeAR/releases/download/libs-v0.3.0/beear-webview-0.3.0.aar) | Any Android app embedding try-on |

### Web install

```html
<script src="https://github.com/mergeos-bounties/BeeAR/releases/download/libs-v0.3.0/beear-tryon-0.3.0.js"></script>
<script>
  console.log(BeeARTryOn.VERSION); // 0.3.0
</script>
```

```bash
npm install https://github.com/mergeos-bounties/BeeAR/releases/download/libs-v0.3.0/beear-tryon-0.3.0.tgz
```

### Android install

```kotlin
// app/libs/beear-webview-0.3.0.aar
implementation(files("libs/beear-webview-0.3.0.aar"))
// + androidx.activity / core / fragment / appcompat

val view = BeeARWebView(this)
view.attach(this, BeeARConfig.loopback()) // or BeeARConfig.offlineAssets()
view.loadTryOn()
```

### Build from source

```bash
# JS lib
cd packages/tryon-js && npm test && npm run build

# Android AAR (sync offline UI into assets first)
node packages/android/scripts/sync-web-assets.mjs
cd packages/android && ./gradlew :beear-webview:assembleRelease

# Full release package → dist/release/ (+ optional GitHub Release)
node scripts/release-libs.mjs
node scripts/release-libs.mjs --publish
```

Docs: [packages/tryon-js/README.md](packages/tryon-js/README.md) · [packages/android/README.md](packages/android/README.md)

---

## Highlights

| Capability | Description |
| --- | --- |
| **Frame catalog** | Aviator, wayfarer, cat-eye, sport, accessories… |
| **PD fit** | Estimate fit from pupil distance (mm) + landmarks box |
| **Compare** | Side-by-side frame metrics |
| **Offline demo** | Catalog + fit + compare without a camera |
| **Clients** | Web host, desktop, Android app over shared libs |
| **JS lib** | `@beear/tryon` for canvas fit/overlay |
| **Android lib** | `:beear-webview` AAR for any host app |

---

## Screenshots

| Try-on demos | |
| :---: | :---: |
| ![Aviator](docs/screenshots/demo-aviator.png) | ![Wayfarer](docs/screenshots/demo-wayfarer.png) |
| *Aviator Gold* | *Wayfarer Black* |
| ![Cat-eye](docs/screenshots/demo-cateye.png) | ![Sport PD](docs/screenshots/demo-sport-pd70.png) |
| *Cat-eye Rose* | *Sport · PD 70* |
| ![Compare](docs/screenshots/demo-compare.png) | ![Accessory](docs/screenshots/demo-accessory.png) |
| *Compare frames* | *Accessory* |

| Server / metrics | |
| :---: | :---: |
| ![Catalog](docs/screenshots/demo-catalog.png) | ![Fit](docs/screenshots/demo-fit.png) |
| *Live catalog list* | *PD fit + landmarks schematic* |
| ![Metrics](docs/screenshots/demo-compare-metrics.png) | ![VI UI](docs/screenshots/demo-vi-ui.png) |
| *Compare metrics* | *VI UI sample* |

---

## Quick start (server)

```powershell
cd packages\server
python -m venv .venv
.\.venv\Scripts\activate
pip install -e ".[dev]"

beear version
beear demo
beear catalog list
beear tryon fit <frame_id> --pd 64
beear serve --port 8860
```

---

## CLI reference

| Command | Purpose |
| --- | --- |
| `beear version` | Package version |
| `beear demo` | Catalog + PD fit + compare smoke |
| `beear catalog list [-c category]` | List frames |
| `beear catalog show <id>` | Frame detail |
| `beear tryon fit <id> --pd 64` | Fit estimate |
| `beear tryon compare <a> <b>` | Compare two frames |
| `beear serve` | FastAPI server |

---

## Catalog & fit

Frames include id, name, category, style, price, geometry hints.  
Fit uses pupil distance in mm and a landmark bounding box (demo uses synthetic landmarks when no camera).

```powershell
beear catalog list -c glasses
beear tryon compare aviator_gold wayfarer_black --pd 64
```

---

## Diagrams

System architecture and workflow — full width. Open the HTML files for **dark/light theme** and export (PNG/SVG).

### Architecture

[Open interactive diagram](docs/diagrams/architecture.html)

<p align="center">
  <img src="docs/diagrams/architecture.svg" alt="BeeAR architecture" width="100%" />
</p>

### Workflow

[Open interactive diagram](docs/diagrams/workflow.html)

<p align="center">
  <img src="docs/diagrams/workflow.svg" alt="BeeAR workflow" width="100%" />
</p>

*Generated with [archify](https://github.com/tt-a1i).*

---

## Repository layout

```text
  Web / Desktop / Android
            │
            ▼
     BeeAR Server (FastAPI)
       catalog · sessions · tryon
            │
     landmark / PD fit engine

packages/
  tryon-js/          # @beear/tryon
  server/src/beear/  # cli, catalog, tryon, api
  web/               # browser host
  desktop/           # Electron shell
  android/
    beear-webview/   # AAR library
    app/             # demo host
docs/screenshots/
docs/diagrams/
```

---

## Privacy

- Prefer synthetic / consented demo faces in docs and CI.
- Do not commit real user camera captures without consent.
- Redact PII in issue evidence.

---

## Development

```powershell
cd packages\server
pytest -q
ruff check src tests
beear demo
```

---

## Android

See [packages/android/README.md](packages/android/README.md) for the Kotlin WebView client. It loads `http://localhost:8860/` through `adb reverse` for emulator or USB-device testing, keeping camera capture available on a loopback origin.

```bash
cd packages/android
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleDebug
```

---

## MergeOS bounties

Frames, MediaPipe landmarks, PD calibration, Android UX.  
Star → claim → PR **master** → MRG **25–200**. Evidence: web/desktop screenshots or emulator shots.

---

## Tiếng Việt

**BeeAR** thử kính / phụ kiện ảo (catalog + fit PD). Offline: `cd packages/server && beear demo`.

---

## License

MIT · MergeOS / ThanhTrucSolutions
