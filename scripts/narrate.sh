#!/bin/sh
# npm run narrate -- [temple-id ...] [--force]
# Picks a Python that has edge-tts: $NARRATE_PY, ./.venv, then python3.
cd "$(dirname "$0")/.." || exit 1
for py in "$NARRATE_PY" .venv/bin/python python3; do
  [ -n "$py" ] || continue
  if "$py" -c 'import edge_tts' 2>/dev/null; then exec "$py" scripts/narrate.py "$@"; fi
done
echo "edge-tts not found: python3 -m venv .venv && .venv/bin/pip install edge-tts (or set NARRATE_PY)" >&2
exit 1
