#!/usr/bin/env bash
set -euo pipefail
export PATH="/mingw64/bin:/usr/bin:$PATH"
pwd
node --version
npm run check
