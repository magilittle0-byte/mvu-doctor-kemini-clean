#!/usr/bin/env bash
set -euo pipefail

vendor_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source_dir="${1:-}"

expected_commit="661f9f89446de473ace70a590897ca5065bc2efe"
files=(index.js manifest.json style.css README.md)

declare -A expected_sha256=(
  [index.js]="54f21b08413247f9d643a7210e4800723299280e59c3a298aad0fc661a9c8b83"
  [manifest.json]="c435d60087799299e68a3cb137dddf0f5d06b7b35e0d0c10c720e956514256ac"
  [style.css]="fd38097d908c5412a3138be750c94db005202f8848b6a3c10b9e7f83ba774ddb"
  [README.md]="ee2b7f7d986fcd0c6833646a2fe55d0025e78c8f2829d9eca05cf054ecaaa010"
)

if [[ -n "${source_dir}" ]]; then
  if [[ ! -d "${source_dir}/.git" ]]; then
    printf 'ERROR: explicitly supplied upstream Git checkout not found: %s\n' "${source_dir}" >&2
    exit 1
  fi
  source_commit="$(git -C "${source_dir}" rev-parse HEAD)"
  if [[ "${source_commit}" != "${expected_commit}" ]]; then
    printf 'ERROR: upstream commit mismatch: expected %s, got %s\n' "${expected_commit}" "${source_commit}" >&2
    exit 1
  fi
fi

for file in "${files[@]}"; do
  vendor_file="${vendor_dir}/${file}"

  if [[ ! -f "${vendor_file}" ]]; then
    printf 'ERROR: missing vendored file: %s\n' "${file}" >&2
    exit 1
  fi

  if [[ -n "${source_dir}" ]]; then
    source_file="${source_dir}/${file}"
    if [[ ! -f "${source_file}" ]]; then
      printf 'ERROR: missing upstream file: %s\n' "${file}" >&2
      exit 1
    fi
    if ! cmp -s -- "${source_file}" "${vendor_file}"; then
      printf 'ERROR: byte comparison failed: %s\n' "${file}" >&2
      exit 1
    fi
    source_sha256="$(sha256sum -- "${source_file}" | awk '{print $1}')"
    if [[ "${source_sha256}" != "${expected_sha256[${file}]}" ]]; then
      printf 'ERROR: upstream SHA-256 mismatch for %s\n' "${file}" >&2
      exit 1
    fi
  fi

  vendor_sha256="$(sha256sum -- "${vendor_file}" | awk '{print $1}')"
  if [[ "${vendor_sha256}" != "${expected_sha256[${file}]}" ]]; then
    printf 'ERROR: SHA-256 mismatch for %s\n' "${file}" >&2
    printf '  expected: %s\n  vendor:   %s\n' "${expected_sha256[${file}]}" "${vendor_sha256}" >&2
    exit 1
  fi

  printf 'OK  %s  %s\n' "${expected_sha256[${file}]}" "${file}"
done

if [[ -n "${source_dir}" ]]; then
  printf 'Story Oracle v1.35.4 vendor snapshot is byte-identical to supplied upstream commit %s.\n' "${expected_commit}"
else
  printf 'Story Oracle v1.35.4 vendor snapshot matches the fixed SHA-256 manifest for upstream commit %s.\n' "${expected_commit}"
fi
