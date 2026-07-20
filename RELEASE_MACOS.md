# macOS release procedure

English Forge ships a thin Apple Silicon (`arm64`) bundle with a minimum system version of macOS 11.0. Hardened Runtime is enabled for every build. The only additional runtime permission is audio input; macOS still asks the learner for explicit microphone permission at first use.

English Forge now also targets Windows; the Windows NSIS installer is covered briefly at the end of this document. Everything else here — Hardened Runtime, entitlements, Developer ID, and Apple notarization — is macOS-only.

## Local verification build

The repository defaults to the ad-hoc identity `-`, so a maintainer without Apple credentials can still build and inspect the Apple Silicon app. Build the `.app` first, then package the same verified bundle into the release-named DMG:

```bash
pnpm check
pnpm test:release-scripts
cargo test --locked --manifest-path src-tauri/Cargo.toml
cargo check --locked --manifest-path src-tauri/Cargo.toml
pnpm tauri build --bundles app

release_stage="$(mktemp -d "${TMPDIR:-/tmp}/english-forge-dmg.XXXXXX")"
mkdir -p "$release_stage/dmg-root" src-tauri/target/release/bundle/dmg
ditto "src-tauri/target/release/bundle/macos/English Forge.app" \
  "$release_stage/dmg-root/English Forge.app"
ln -s /Applications "$release_stage/dmg-root/Applications"
hdiutil create \
  -volname "English Forge 0.7.0" \
  -srcfolder "$release_stage/dmg-root" \
  -ov -format UDZO \
  "src-tauri/target/release/bundle/dmg/English-Forge-0.7.0-arm64.dmg"

pnpm release:verify \
  "src-tauri/target/release/bundle/dmg/English-Forge-0.7.0-arm64.dmg"
```

The temporary staging directory contains only a copy of the app and the `/Applications` link; it may be removed after verification. An ad-hoc signature proves bundle integrity after the build, but it does **not** establish a developer identity and cannot be notarized. Do not describe this artifact as Gatekeeper-ready.

## Developer ID and notarization

Install a `Developer ID Application` certificate in the active keychain, then provide its exact name without committing credentials:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: ORGANISATION (ABCDE12345)"
```

The value must have that exact certificate type and 10-character Team ID, and the full identity must appear in `security find-identity -v -p codesigning`.

Provide one complete notarization credential set supported by Tauri:

```bash
# Preferred: App Store Connect API key
export APPLE_API_ISSUER="..."
export APPLE_API_KEY="..."
export APPLE_API_KEY_PATH="/absolute/path/to/AuthKey_....p8"
```

or:

```bash
# Alternative: Apple ID plus app-specific password
export APPLE_ID="..."
export APPLE_PASSWORD="..."
export APPLE_TEAM_ID="..."
```

Build, upload to Apple, wait for the result, and staple the ticket through Tauri:

```bash
pnpm release:macos

# Tauri names the architecture `aarch64`; normalize only the filename for delivery.
ditto \
  "src-tauri/target/release/bundle/dmg/English Forge_0.7.0_aarch64.dmg" \
  "src-tauri/target/release/bundle/dmg/English-Forge-0.7.0-arm64.dmg"

EXPECT_NOTARIZED=1 pnpm release:verify \
  "src-tauri/target/release/bundle/dmg/English-Forge-0.7.0-arm64.dmg"
```

Renaming the completed DMG does not change its bytes, signature, or stapled ticket. `release:preflight` fails before compilation when the identity has the wrong certificate type or shape, is absent from the active keychains, a credential field or API-key file is missing, or an Apple command-line tool is unavailable. `release:verify` checks the DMG checksum structure and payload, strict code signature, audio entitlement, thin `arm64` executable, version `0.7.0`, macOS 11.0 metadata, and—when `EXPECT_NOTARIZED=1`—the stapled ticket and Gatekeeper assessment. It can also inspect the source ZIP when supplied as the second argument:

```bash
pnpm release:verify \
  "src-tauri/target/release/bundle/dmg/English-Forge-0.7.0-arm64.dmg" \
  "/absolute/path/to/English-Forge-0.7.0-source.zip"
```

Never print or store notarization secrets in logs, `.env` files, the source archive, or the repository.

## Windows build (NSIS)

English Forge also targets Windows, distributed as an NSIS installer produced by Tauri:

```bash
pnpm tauri build --bundles nsis
```

The installer is written under `src-tauri/target/release/bundle/nsis/`. The macOS-specific steps above — Hardened Runtime, entitlements, Developer ID, and Apple notarization — do not apply to Windows. Optional Authenticode signing requires a separate Windows code-signing certificate and is out of scope for the local verification build.

Authoritative references:

- [Tauri 2 macOS code signing and notarization](https://v2.tauri.app/distribute/sign/macos/)
- [Tauri 2 macOS entitlements](https://v2.tauri.app/distribute/macos-application-bundle/)
- [Apple: Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- [Apple: Audio Input entitlement](https://developer.apple.com/documentation/BundleResources/Entitlements/com.apple.security.device.audio-input)
