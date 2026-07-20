#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'Release preflight test failed: %s\n' "$1" >&2
  exit 1
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
preflight="$script_dir/release-preflight.sh"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/english-forge-preflight-test.XXXXXX")"
trap 'rm -rf "$test_root"' EXIT

stub_dir="$test_root/bin"
mkdir -p "$stub_dir"

printf '%s\n' \
  '#!/usr/bin/env bash' \
  "printf 'Darwin\\n'" >"$stub_dir/uname"

printf '%s\n' \
  '#!/usr/bin/env bash' \
  '[[ "$*" == "find-identity -v -p codesigning" ]] || exit 2' \
  "printf '  1) 0123456789ABCDEF0123456789ABCDEF01234567 \"%s\"\\n' \"\${TEST_SECURITY_IDENTITY:-}\"" \
  "printf '     1 valid identities found\\n'" >"$stub_dir/security"

for command_name in pnpm cargo codesign hdiutil xcrun plutil; do
  printf '%s\n' '#!/usr/bin/env bash' 'exit 0' >"$stub_dir/$command_name"
done
chmod +x "$stub_dir"/*

api_key_path="$test_root/AuthKey_TEST.p8"
printf '%s\n' 'test fixture; not a credential' >"$api_key_path"
secret_sentinel='PRETEND_API_SECRET_MUST_NOT_BE_PRINTED'

run_preflight() {
  local requested_identity="$1"
  local installed_identity="$2"
  env -i \
    PATH="$stub_dir:/usr/bin:/bin" \
    TEST_SECURITY_IDENTITY="$installed_identity" \
    APPLE_SIGNING_IDENTITY="$requested_identity" \
    APPLE_API_ISSUER='test-issuer' \
    APPLE_API_KEY="$secret_sentinel" \
    APPLE_API_KEY_PATH="$api_key_path" \
    /bin/bash "$preflight" 2>&1
}

expect_rejected() {
  local requested_identity="$1"
  local installed_identity="$2"
  local expected="$3"
  local output
  if output="$(run_preflight "$requested_identity" "$installed_identity")"; then
    fail "identity unexpectedly passed: $requested_identity"
  fi
  grep -F -- "$expected" <<<"$output" >/dev/null || fail "identity failed for the wrong reason: $output"
  [[ "$output" != *"$secret_sentinel"* ]] || fail "preflight failure leaked a notarization secret"
}

developer_identity='Developer ID Application: Acme Learning LLC (ABCDE12345)'
output="$(run_preflight "$developer_identity" "$developer_identity")" || fail "a valid installed Developer ID identity was rejected: $output"
grep -F 'Release preflight passed' <<<"$output" >/dev/null || fail "valid preflight did not report success"
[[ "$output" != *"$secret_sentinel"* ]] || fail "successful preflight leaked a notarization secret"

wrong_type='Apple Development: Acme Learning LLC (ABCDE12345)'
expect_rejected "$wrong_type" "$wrong_type" "must exactly match 'Developer ID Application: ORGANISATION (TEAMID)'"

wrong_team_id='Developer ID Application: Acme Learning LLC (ABC123)'
expect_rejected "$wrong_team_id" "$wrong_team_id" "with a 10-character Team ID"

other_identity='Developer ID Application: Other Company LLC (ZYXWV98765)'
expect_rejected "$developer_identity" "$other_identity" 'is not an active code-signing identity'

printf 'Release preflight tests passed.\n'
