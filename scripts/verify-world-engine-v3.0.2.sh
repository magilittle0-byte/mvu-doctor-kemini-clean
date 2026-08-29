#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
vendor_dir="$repo_dir/vendor/world-engine-v3.0.2"

cd "$vendor_dir"
entry_count="$(/usr/bin/grep -Ec '^[0-9a-f]{64}  \./' SOURCE_SHA256SUMS.txt)"
if [[ "$entry_count" != "45" ]]; then
  echo "World Engine vendor manifest must contain exactly 45 upstream files; found $entry_count." >&2
  exit 1
fi

/usr/bin/sha256sum --strict -c SOURCE_SHA256SUMS.txt
echo "World Engine v3.0.2 vendor snapshot is byte-identical to upstream commit 154de4b590378cd0bd851cfffcefd3d96741cf3f."
