# Сборка English Forge под Windows (NSIS)

Windows-установщик собирается только на Windows-раннере — кросс-компиляция NSIS с macOS невозможна. Ниже минимальный, воспроизводимый путь.

## Требования на машине сборки

- Windows 10 (1803+) или Windows 11.
- Rust (stable) + target `x86_64-pc-windows-msvc`, MSVC Build Tools (VS 2022 C++ workload).
- Node 20+ и `pnpm`.
- WebView2 Evergreen (на Win11 предустановлен; на части Win10 — нет). Установщик собирается с `webviewInstallMode: offlineInstaller` (см. `src-tauri/tauri.conf.json`), поэтому первый запуск не требует интернета.

## Сборка

```powershell
pnpm install
pnpm check                 # oxlint + vitest + tsc/vite build
cargo test --locked --manifest-path src-tauri/Cargo.toml --all-targets
pnpm tauri build --bundles nsis
```

Артефакт: `src-tauri/target/release/bundle/nsis/English Forge_0.7.0_x64-setup.exe`.

## Подпись и SmartScreen

- Сборка **не подписана** (нет code-signing сертификата). Windows SmartScreen покажет «Windows защитила ваш компьютер». Обход для пользователя: **«Подробнее» → «Выполнить в любом случае»** (аналог Control-click → Open на macOS).
- Опционально позже: OV/EV code-signing сертификат + `signtool sign` — снимает предупреждение. Требует платного сертификата, вне текущего релиза.

## CI

`.github/workflows/release.yml` собирает оба артефакта в matrix: `macos-14` → DMG (ad-hoc), `windows-latest` → NSIS. Артефакты выкладываются в раздел Actions/Release.

## Известная security-дельта от macOS (не блокирует релиз)

Native-слой на Unix использует `openat`/`renameat`/`unlinkat` относительно `O_NOFOLLOW`-дескриптора каталога — защита от подмены путей симлинком/TOCTOU. На Windows (`#[cfg(not(unix))]`) применяются `symlink_metadata` + повторная проверка `is_file` по хэндлу; это **однопользовательская desktop-модель** без перехода границы привилегий (доступ к `%APPDATA%` уже есть у самого пользователя). Реализовано платформо-независимо: атомарная запись через temp-файл + rename с ретраями на sharing-violation (антивирус/индексатор). Полный паритет (отклонение reparse-point каталога/файла, `FILE_FLAG_BACKUP_SEMANTICS` для fsync каталога) — задача уровня «harden», при желании добавляется позже; требует Windows-раннера для проверки компиляции.
