# Piepi 🐍
### Python Package Manager — 755,000+ PyPI packages

A sleek, minimalist Electron app for browsing and installing Python packages.

---

## Setup

### Requirements
- [Node.js](https://nodejs.org/) v18+
- npm
- Python + pip installed on your system

### Install & Run

```bash
# 1. Extract this folder
cd piepi

# 2. Install dependencies
npm install

# 3. Run
npm start
```

### Build a distributable
```bash
npm run dist
```

---

## Features

| Feature | Description |
|---|---|
| 📦 Package Index | Fetches all 755k+ packages from PyPI Simple Index (cached for 24h) |
| 🔍 Search | Instant search across all package names + descriptions |
| ⭐ Favorites | Star packages for quick access |
| 🕐 Recents | Auto-tracks recently viewed packages |
| 🏷️ Tagging | Add custom tags to packages |
| 🐍 Interpreter | Select any Python interpreter / virtualenv |
| ↓ Multi-install | Shift-click or Ctrl+click to select multiple, install all at once |
| 📋 Copy Command | Copy the `pip install` command for selected packages |
| 📜 Install Log | History of everything you've installed |
| 🔄 Refresh Index | Re-download the full PyPI package list |

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Ctrl/⌘ + F` | Focus search |
| `Esc` | Close panels / deselect |
| `Ctrl/⌘ + A` | Select all visible packages |
| `Shift+click` | Range-select packages |
| `Ctrl/⌘+click` | Multi-select packages |

---

## Add Your Logo

Drop a `logo.jpg` file in the `piepi/` root directory — it will appear in the splash screen and titlebar automatically.

---

## Notes

- First launch fetches the PyPI package index (~8–15 MB). Subsequent launches use a 24-hour cache.
- Package descriptions load on-demand from the PyPI JSON API.
- All data (favorites, tags, history) is stored locally in your app data folder.
