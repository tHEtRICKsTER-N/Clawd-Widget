#!/usr/bin/env bash
# One-command project setup for macOS / Linux: installs dependencies and builds everything.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install the LTS version from https://nodejs.org and run this again."
  exit 1
fi

echo "=== Installing dependencies (first run downloads Electron, ~100 MB) ==="
npm install
echo "=== Building the browser extension ==="
npm run build:ext
echo "=== Building the desktop widget pages ==="
npm run build:desktop

cat <<'MSG'

Done! Next steps:
  npm run dev            web playground at http://localhost:5178
  npm run desktop        run the desktop widget
  Extension: chrome://extensions > Developer mode > Load unpacked > dist-extension
MSG
