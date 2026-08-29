#!/usr/bin/env bash
set -euo pipefail

script_dir="${BASH_SOURCE[0]%/*}"
repo_root="$(cd "$script_dir/.." && pwd)"
if [[ "$#" -ne 2 ]]; then
  printf 'Usage: %s <life-state-script-v5.35.json> <life-state-regex-v5.35.json>\n' "$0" >&2
  exit 2
fi
source_json="$1"
source_regex="$2"

node "$repo_root/scripts/vendor-life-state-v5.35.mjs" "$source_json" "$source_regex"
node "$repo_root/scripts/verify-life-state-v5.35.mjs" "$source_json" "$source_regex"
node --test "$repo_root/tests/vendor-life-state-v5.35.test.mjs"
