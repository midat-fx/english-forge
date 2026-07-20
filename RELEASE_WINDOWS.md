# Building English Forge for Windows (NSIS)

The Windows installer can only be built on a Windows machine or runner — NSIS cannot be cross-compiled from macOS. Below is the minimal reproducible path.

## Build-machine requirements

- Windows 10 (1803+) or Windows 11.
- Rust (stable) with the `x86_64-pc-windows-msvc` target and MSVC Build Tools (the VS 2022 C++ workload).
- Node 20.19+ (or 22.12+) and `pnpm` 11.
- WebView2 Evergreen (preinstalled on Windows 11; missing on some Windows 10 machines). The installer is built with `webviewInstallMode: offlineInstaller` (see `src-tauri/tauri.conf.json`), so the first launch does not require internet access.

## Build

```powershell
pnpm install
pnpm check                 # oxlint + vitest + tsc/vite build
cargo test --locked --manifest-path src-tauri/Cargo.toml --all-targets
pnpm tauri build --bundles nsis
```

Artifact: `src-tauri/target/release/bundle/nsis/English Forge_<version>_x64-setup.exe`.

## Signing and SmartScreen

- The build is **unsigned** (no code-signing certificate). Windows SmartScreen will show "Windows protected your PC". The user bypass: **"More info" → "Run anyway"** (the Windows analogue of macOS's Open Anyway flow).
- Optional later: an OV/EV code-signing certificate plus `signtool sign` removes the warning. It requires a paid certificate and is out of scope for the current release.

## CI

`.github/workflows/release.yml` builds both artifacts in a matrix — `macos-14` → universal DMG (ad-hoc signed), `windows-latest` → NSIS — and publishes them to the GitHub Releases page on every `v*` tag, so they can be downloaded without a GitHub account.

## Known security delta versus macOS (does not block a release)

On Unix the native layer uses `openat`/`renameat`/`unlinkat` relative to an `O_NOFOLLOW` directory descriptor — protection against symlink/TOCTOU path swaps. On Windows (`#[cfg(not(unix))]`) it uses `symlink_metadata` plus an `is_file` re-check on the handle; this matches the **single-user desktop model** with no privilege boundary being crossed (the user already has access to `%APPDATA%`). The platform-independent parts are shared: atomic writes via a temp file plus rename with retries on sharing violations (antivirus/indexer interference). Full parity (rejecting reparse-point directories/files, `FILE_FLAG_BACKUP_SEMANTICS` for directory fsync) is hardening-level work that can be added later; it requires a Windows runner to verify compilation.
