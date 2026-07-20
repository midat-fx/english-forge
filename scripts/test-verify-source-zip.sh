#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'Source ZIP verifier test failed: %s\n' "$1" >&2
  exit 1
}

for command_name in plutil zip unzip zipinfo; do
  command -v "$command_name" >/dev/null 2>&1 || fail "missing command: $command_name"
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
verifier="$script_dir/verify-source-zip.sh"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/english-forge-source-zip-test.XXXXXX")"
trap 'rm -rf "$test_root"' EXIT

fixture_parent="$test_root/fixture"
fixture="$fixture_parent/english-forge-0.6.0"
mkdir -p "$fixture/src" "$fixture/src-tauri"
printf '{"name":"english-forge","version":"0.6.0"}\n' >"$fixture/package.json"
printf 'lockfileVersion: 9.0\n' >"$fixture/pnpm-lock.yaml"
printf 'export const ready = true\n' >"$fixture/src/main.ts"
printf '[package]\nname = "english-forge"\nversion = "0.6.0"\n' >"$fixture/src-tauri/Cargo.toml"
printf '# locked Rust dependencies\nversion = 4\n' >"$fixture/src-tauri/Cargo.lock"
printf '{"productName":"English Forge","version":"0.6.0"}\n' >"$fixture/src-tauri/tauri.conf.json"

make_zip() {
  local parent="$1"
  local destination="$2"
  local preserve_links="${3:-0}"
  if [[ "$preserve_links" == "1" ]]; then
    (cd "$parent" && zip -qry -y "$destination" .)
  else
    (cd "$parent" && zip -qry "$destination" .)
  fi
}

copy_fixture() {
  local label="$1"
  local parent="$test_root/$label"
  mkdir -p "$parent"
  cp -R "$fixture" "$parent/english-forge-0.6.0"
  printf '%s\n' "$parent"
}

expect_rejected() {
  local archive="$1"
  local expected="$2"
  local output
  if output="$("$verifier" "$archive" 2>&1)"; then
    fail "$(basename "$archive") unexpectedly passed"
  fi
  grep -F -- "$expected" <<<"$output" >/dev/null || fail "$(basename "$archive") failed for the wrong reason: $output"
}

valid_zip="$test_root/valid.zip"
make_zip "$fixture_parent" "$valid_zip"
"$verifier" "$valid_zip" >/dev/null

missing_parent="$(copy_fixture missing-lock)"
rm -f "$missing_parent/english-forge-0.6.0/pnpm-lock.yaml"
missing_zip="$test_root/missing-lock.zip"
make_zip "$missing_parent" "$missing_zip"
expect_rejected "$missing_zip" "pnpm-lock.yaml"

missing_cargo_lock_parent="$(copy_fixture missing-cargo-lock)"
rm -f "$missing_cargo_lock_parent/english-forge-0.6.0/src-tauri/Cargo.lock"
missing_cargo_lock_zip="$test_root/missing-cargo-lock.zip"
make_zip "$missing_cargo_lock_parent" "$missing_cargo_lock_zip"
expect_rejected "$missing_cargo_lock_zip" "Cargo.lock"

missing_src_parent="$(copy_fixture missing-src)"
rm -rf "$missing_src_parent/english-forge-0.6.0/src"
missing_src_zip="$test_root/missing-src.zip"
make_zip "$missing_src_parent" "$missing_src_zip"
expect_rejected "$missing_src_zip" "/src/"

multi_parent="$(copy_fixture multiple-roots)"
mkdir -p "$multi_parent/unexpected-root"
printf 'unexpected\n' >"$multi_parent/unexpected-root/file.txt"
multi_zip="$test_root/multiple-roots.zip"
make_zip "$multi_parent" "$multi_zip"
expect_rejected "$multi_zip" "one top-level directory prefix"

for forbidden in work outputs; do
  forbidden_parent="$(copy_fixture "$forbidden")"
  mkdir -p "$forbidden_parent/english-forge-0.6.0/$forbidden"
  printf 'must not ship\n' >"$forbidden_parent/english-forge-0.6.0/$forbidden/leak.txt"
  forbidden_zip="$test_root/$forbidden.zip"
  make_zip "$forbidden_parent" "$forbidden_zip"
  expect_rejected "$forbidden_zip" "work or outputs directory"
done

symlink_parent="$(copy_fixture symlink)"
ln -s ../package.json "$symlink_parent/english-forge-0.6.0/src/package-link.json"
symlink_zip="$test_root/symlink.zip"
make_zip "$symlink_parent" "$symlink_zip" 1
expect_rejected "$symlink_zip" "symbolic-link entry"

wrong_package_parent="$(copy_fixture wrong-package-version)"
printf '{"name":"english-forge","version":"9.9.9"}\n' >"$wrong_package_parent/english-forge-0.6.0/package.json"
wrong_package_zip="$test_root/wrong-package-version.zip"
make_zip "$wrong_package_parent" "$wrong_package_zip"
expect_rejected "$wrong_package_zip" "package.json version must be 0.6.0"

wrong_cargo_parent="$(copy_fixture wrong-cargo-version)"
printf '[package]\nname = "english-forge"\nversion = "9.9.9"\n' >"$wrong_cargo_parent/english-forge-0.6.0/src-tauri/Cargo.toml"
wrong_cargo_zip="$test_root/wrong-cargo-version.zip"
make_zip "$wrong_cargo_parent" "$wrong_cargo_zip"
expect_rejected "$wrong_cargo_zip" "Cargo package version must be 0.6.0"

wrong_tauri_parent="$(copy_fixture wrong-tauri-version)"
printf '{"productName":"English Forge","version":"9.9.9"}\n' >"$wrong_tauri_parent/english-forge-0.6.0/src-tauri/tauri.conf.json"
wrong_tauri_zip="$test_root/wrong-tauri-version.zip"
make_zip "$wrong_tauri_parent" "$wrong_tauri_zip"
expect_rejected "$wrong_tauri_zip" "Tauri source version must be 0.6.0"

printf 'Source ZIP verifier tests passed.\n'
