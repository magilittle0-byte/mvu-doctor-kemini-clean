#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
vendor_dir="$repo_dir/vendor/world-engine-v3.0.2"

cd "$vendor_dir"
runtime_entry_count="$(/usr/bin/grep -Ec '^[0-9a-f]{64}  \./' SOURCE_SHA256SUMS.txt)"
upstream_entry_count="$(/usr/bin/grep -Ec '^[0-9a-f]{64}  \./' UPSTREAM_SHA256SUMS.txt)"
if [[ "$runtime_entry_count" != "45" ]]; then
  echo "World Engine runtime manifest must contain exactly 45 files; found $runtime_entry_count." >&2
  exit 1
fi
if [[ "$upstream_entry_count" != "45" ]]; then
  echo "World Engine immutable upstream manifest must contain exactly 45 files; found $upstream_entry_count." >&2
  exit 1
fi

/usr/bin/sha256sum --strict -c SOURCE_SHA256SUMS.txt
/usr/bin/grep -v '  \./world-engine-evolution\.js$' UPSTREAM_SHA256SUMS.txt | /usr/bin/sha256sum --strict -c -
upstream_evolution_hash="$(/usr/bin/grep '  \./world-engine-evolution\.js$' UPSTREAM_SHA256SUMS.txt | /usr/bin/cut -d' ' -f1)"
if [[ "$upstream_evolution_hash" != "412c369b5d8ae5d16fb3a89cfad37a8e1333837ebb9b7f2a5e7e84cf37956ec3" ]]; then
  echo "World Engine immutable upstream evolution hash does not match pinned commit evidence." >&2
  exit 1
fi
adapter_hits="$(/usr/bin/grep -Fc "window.MVUDoctorProfileEngine?.buildWorldActorInstruction?.(state)" world-engine-evolution.js)"
if [[ "$adapter_hits" != "1" ]]; then
  echo "World Engine Doctor task-slot adaptation must occur exactly once; found $adapter_hits." >&2
  exit 1
fi
echo "World Engine v3.0.2 runtime verified: 44 files match the immutable upstream manifest; world-engine-evolution.js matches the pinned adapted runtime hash and contains the documented provider call exactly once."
