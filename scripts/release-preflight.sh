#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'Release preflight failed: %s\n' "$1" >&2
  exit 1
}

[[ "$(uname -s)" == "Darwin" ]] || fail "macOS is required."

for command_name in pnpm cargo security codesign hdiutil xcrun plutil; do
  command -v "$command_name" >/dev/null 2>&1 || fail "missing command: $command_name"
done

signing_identity="${APPLE_SIGNING_IDENTITY:-}"
developer_id_pattern='^Developer ID Application: [^[:space:]\"]([^[:cntrl:]\"]*[^[:space:]\"])? \([A-Z0-9]{10}\)$'
[[ "$signing_identity" =~ $developer_id_pattern ]] || fail \
  "APPLE_SIGNING_IDENTITY must exactly match 'Developer ID Application: ORGANISATION (TEAMID)' with a 10-character Team ID."

identity_listing="$(security find-identity -v -p codesigning 2>/dev/null)" || fail \
  "unable to inspect code-signing identities in the active keychains."
grep -F -- "\"$signing_identity\"" <<<"$identity_listing" >/dev/null || fail \
  "APPLE_SIGNING_IDENTITY is not an active code-signing identity in the current keychains."

api_fields=0
for variable_name in APPLE_API_ISSUER APPLE_API_KEY APPLE_API_KEY_PATH; do
  [[ -n "${!variable_name:-}" ]] && api_fields=$((api_fields + 1))
done

apple_id_fields=0
for variable_name in APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID; do
  [[ -n "${!variable_name:-}" ]] && apple_id_fields=$((apple_id_fields + 1))
done

if [[ "$api_fields" -ne 3 && "$apple_id_fields" -ne 3 ]]; then
  fail "provide either all APPLE_API_ISSUER/APPLE_API_KEY/APPLE_API_KEY_PATH values or all APPLE_ID/APPLE_PASSWORD/APPLE_TEAM_ID values."
fi

if [[ "$api_fields" -gt 0 && "$api_fields" -lt 3 ]]; then
  fail "the App Store Connect API credential set is incomplete."
fi

if [[ "$apple_id_fields" -gt 0 && "$apple_id_fields" -lt 3 ]]; then
  fail "the Apple ID notarization credential set is incomplete."
fi

if [[ "$api_fields" -eq 3 && ( ! -f "${APPLE_API_KEY_PATH}" || ! -r "${APPLE_API_KEY_PATH}" ) ]]; then
  fail "APPLE_API_KEY_PATH does not point to a readable private key."
fi

plutil -lint src-tauri/Info.plist >/dev/null
plutil -lint src-tauri/Entitlements.plist >/dev/null

printf 'Release preflight passed: Developer ID identity and notarization credentials are present.\n'
