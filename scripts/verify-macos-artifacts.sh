#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'Artifact verification failed: %s\n' "$1" >&2
  exit 1
}

[[ "$(uname -s)" == "Darwin" ]] || fail "macOS is required."
[[ "$#" -ge 1 && "$#" -le 2 ]] || fail "usage: $0 path/to/image.dmg [path/to/source.zip]"

dmg_path="$1"
source_zip="${2:-}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$dmg_path" && -r "$dmg_path" ]] || fail "DMG does not exist or is not readable: $dmg_path"
[[ -z "$source_zip" || ( -f "$source_zip" && -r "$source_zip" ) ]] || fail "source ZIP does not exist or is not readable: $source_zip"

hdiutil verify "$dmg_path"

mount_dir="$(mktemp -d "${TMPDIR:-/tmp}/english-forge-verify.XXXXXX")"
attached=0
cleanup() {
  if [[ "$attached" -eq 1 ]]; then
    hdiutil detach "$mount_dir" -quiet || true
  fi
  rmdir "$mount_dir" 2>/dev/null || true
}
trap cleanup EXIT

hdiutil attach "$dmg_path" -readonly -nobrowse -mountpoint "$mount_dir" -quiet
attached=1

app_path="$mount_dir/English Forge.app"
[[ -d "$app_path" ]] || fail "English Forge.app is missing from the DMG."
[[ -L "$mount_dir/Applications" && "$(readlink "$mount_dir/Applications")" == "/Applications" ]] || fail \
  "the DMG must contain only the expected /Applications link beside the app and Finder metadata."

unexpected_payload="$(find "$mount_dir" -mindepth 1 -maxdepth 1 \
  ! -name 'English Forge.app' ! -name 'Applications' ! -name '.DS_Store' ! -name '.VolumeIcon.icns' -print)"
[[ -z "$unexpected_payload" ]] || fail "unexpected top-level DMG payload: $unexpected_payload"

codesign --verify --deep --strict --verbose=2 "$app_path"
codesign_details="$(codesign -d --verbose=4 "$app_path" 2>&1)"
grep -Eq 'flags=.*runtime' <<<"$codesign_details" || fail "the app signature is missing hardened runtime."

executable_name="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$app_path/Contents/Info.plist")"
executable_path="$app_path/Contents/MacOS/$executable_name"
[[ -f "$executable_path" ]] || fail "bundle executable is missing."
[[ "$(lipo -archs "$executable_path")" == "arm64" ]] || fail "bundle executable is not thin arm64."

bundle_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app_path/Contents/Info.plist")"
short_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app_path/Contents/Info.plist")"
bundle_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$app_path/Contents/Info.plist")"
[[ "$bundle_id" == "app.englishforge.desktop" ]] || fail "unexpected bundle identifier: $bundle_id"
[[ "$short_version" == "0.6.0" && "$bundle_version" == "0.6.0" ]] || fail \
  "bundle versions must both be 0.6.0 (found $short_version/$bundle_version)."

minimum_system="$(/usr/libexec/PlistBuddy -c 'Print :LSMinimumSystemVersion' "$app_path/Contents/Info.plist")"
[[ "$minimum_system" == "11.0" ]] || fail "LSMinimumSystemVersion must be 11.0."
binary_minimum="$(otool -l "$executable_path" | awk '/LC_BUILD_VERSION/{in_build=1; next} in_build && /minos/{print $2; exit}')"
[[ "$binary_minimum" == "11.0" ]] || fail "Mach-O minimum system version must be 11.0."

for usage_key in NSMicrophoneUsageDescription NSScreenCaptureUsageDescription NSAudioCaptureUsageDescription; do
  usage_value="$(/usr/libexec/PlistBuddy -c "Print :$usage_key" "$app_path/Contents/Info.plist")"
  [[ -n "$usage_value" ]] || fail "$usage_key must be present and non-empty."
done

entitlements_dump="$(mktemp "${TMPDIR:-/tmp}/english-forge-entitlements.XXXXXX")"
codesign -d --entitlements :- "$app_path" >"$entitlements_dump" 2>/dev/null
plutil -extract 'com\.apple\.security\.device\.audio-input' raw "$entitlements_dump" 2>/dev/null | grep -Fx true >/dev/null || fail \
  "the signed app is missing the audio-input entitlement."
rm -f "$entitlements_dump"

if [[ "${EXPECT_NOTARIZED:-0}" == "1" ]]; then
  xcrun stapler validate "$dmg_path"
  spctl --assess --type open --context context:primary-signature -v "$dmg_path"
fi

if [[ -n "$source_zip" ]]; then
  "$script_dir/verify-source-zip.sh" "$source_zip"
fi

shasum -a 256 "$dmg_path"
[[ -z "$source_zip" ]] || shasum -a 256 "$source_zip"
printf 'Artifact verification passed.\n'
