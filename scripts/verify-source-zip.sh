#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'Source ZIP verification failed: %s\n' "$1" >&2
  exit 1
}

[[ "$#" -eq 1 ]] || fail "usage: $0 path/to/source.zip"

source_zip="$1"
[[ -f "$source_zip" && -r "$source_zip" ]] || fail "source ZIP does not exist or is not readable: $source_zip"

for command_name in plutil zipinfo unzip; do
  command -v "$command_name" >/dev/null 2>&1 || fail "missing command: $command_name"
done

zipinfo -t "$source_zip" >/dev/null || fail "source ZIP integrity check failed."
zip_entries="$(zipinfo -1 "$source_zip")" || fail "source ZIP entries cannot be listed."
[[ -n "$zip_entries" ]] || fail "source ZIP is empty."

if grep -E '(^/|(^|/)\.\.(/|$)|\\)' <<<"$zip_entries" >/dev/null; then
  fail "source ZIP contains an absolute, parent-traversal, or backslash path."
fi
if grep -E '(^|/)(\.git|node_modules|dist|target|\.playwright-mcp)(/|$)' <<<"$zip_entries" >/dev/null; then
  fail "source ZIP contains a generated, dependency, or repository-internal directory."
fi
if grep -E '(^|/)(work|outputs)(/|$)' <<<"$zip_entries" >/dev/null; then
  fail "source ZIP contains a work or outputs directory."
fi
if grep -Ei '(^|/)(\.env($|\.)|AuthKey_[^/]*\.p8$|[^/]*\.(pem|key)$|([^/]*(credential|credentials|secret|secrets)[^/]*)\.json$)' <<<"$zip_entries" >/dev/null; then
  fail "source ZIP contains a credential or private-key filename."
fi
if zipinfo -l "$source_zip" | grep -E '^l[rwxStTs-]{9}[[:space:]]' >/dev/null; then
  fail "source ZIP contains a symbolic-link entry."
fi

top_prefix="$(awk -F/ 'NF >= 2 { print $1; exit }' <<<"$zip_entries")"
[[ "$top_prefix" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail "source ZIP must use one safe, non-empty top-level directory prefix."
if ! awk -v prefix="$top_prefix/" 'length($0) > 0 && index($0, prefix) != 1 { exit 1 }' <<<"$zip_entries"; then
  fail "all source ZIP entries must live under one top-level directory prefix."
fi

has_exact_entry() {
  grep -Fx -- "$1" <<<"$zip_entries" >/dev/null
}

has_entry_below() {
  awk -v prefix="$1" 'index($0, prefix) == 1 && length($0) > length(prefix) { found = 1 } END { exit found ? 0 : 1 }' <<<"$zip_entries"
}

has_exact_entry "$top_prefix/package.json" || fail "source ZIP is missing $top_prefix/package.json."
has_exact_entry "$top_prefix/pnpm-lock.yaml" || fail "source ZIP is missing $top_prefix/pnpm-lock.yaml."
has_entry_below "$top_prefix/src/" || fail "source ZIP is missing source files under $top_prefix/src/."
has_entry_below "$top_prefix/src-tauri/" || fail "source ZIP is missing source files under $top_prefix/src-tauri/."
has_exact_entry "$top_prefix/src-tauri/Cargo.toml" || fail "source ZIP is missing $top_prefix/src-tauri/Cargo.toml."
has_exact_entry "$top_prefix/src-tauri/Cargo.lock" || fail "source ZIP is missing $top_prefix/src-tauri/Cargo.lock."
has_exact_entry "$top_prefix/src-tauri/tauri.conf.json" || fail "source ZIP is missing $top_prefix/src-tauri/tauri.conf.json."

package_json="$(unzip -p "$source_zip" "$top_prefix/package.json")" || fail "package.json cannot be read from the source ZIP."
package_version="$(plutil -extract version raw -o - - <<<"$package_json" 2>/dev/null)" || fail "package.json is not valid versioned JSON."
[[ "$package_version" == "0.6.0" ]] || fail "package.json version must be 0.6.0 (found ${package_version:-missing})."

cargo_toml="$(unzip -p "$source_zip" "$top_prefix/src-tauri/Cargo.toml")" || fail "Cargo.toml cannot be read from the source ZIP."
cargo_version="$(awk '
  /^\[package\][[:space:]]*$/ { in_package = 1; next }
  /^\[/ { if (in_package) exit }
  in_package && /^[[:space:]]*version[[:space:]]*=/ {
    line = $0
    sub(/^[^=]*=[[:space:]]*"/, "", line)
    sub(/".*/, "", line)
    print line
    exit
  }
' <<<"$cargo_toml")"
[[ "$cargo_version" == "0.6.0" ]] || fail "Cargo package version must be 0.6.0 (found ${cargo_version:-missing})."

tauri_config="$(unzip -p "$source_zip" "$top_prefix/src-tauri/tauri.conf.json")" || fail "tauri.conf.json cannot be read from the source ZIP."
tauri_version="$(plutil -extract version raw -o - - <<<"$tauri_config" 2>/dev/null)" || fail "tauri.conf.json is not valid versioned JSON."
[[ "$tauri_version" == "0.6.0" ]] || fail "Tauri source version must be 0.6.0 (found ${tauri_version:-missing})."

printf 'Source ZIP verification passed: %s\n' "$top_prefix"
