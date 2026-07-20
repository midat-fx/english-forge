use std::{
  borrow::Cow,
  fs::{self, File, OpenOptions},
  io::{Read, Write},
  path::{Path, PathBuf},
  sync::atomic::{AtomicU64, Ordering},
};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

// Nine MiB of portable ForgeData plus the exact compact Zustand {state,version} envelope.
const MAX_PROFILE_BYTES: usize = 9 * 1024 * 1024 + 22;
const MAX_IMPORT_BYTES: usize = 9 * 1024 * 1024;
// Recordings live outside the portable JSON profile. Keep the bound low enough for
// predictable local storage and IPC memory use while allowing several minutes of audio.
const MAX_RECORDING_BYTES: usize = 25 * 1024 * 1024;
static NEXT_TEMPORARY_FILE: AtomicU64 = AtomicU64::new(0);

fn create_temporary_file(path: &Path) -> Result<(PathBuf, File), String> {
  let parent = path.parent().ok_or("The local data path has no parent directory.")?;
  let name = path.file_name().and_then(|value| value.to_str()).ok_or("The local data filename is not valid text.")?;
  for _ in 0..16 {
    let sequence = NEXT_TEMPORARY_FILE.fetch_add(1, Ordering::Relaxed);
    let temporary = parent.join(format!(".{name}.tmp-{}-{sequence}", std::process::id()));
    match OpenOptions::new().write(true).create_new(true).open(&temporary) {
      Ok(file) => return Ok((temporary, file)),
      Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
      Err(error) => return Err(format!("Cannot create a temporary local data file: {error}")),
    }
  }
  Err("Cannot reserve a unique temporary local data file.".into())
}

fn profile_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  app.path()
    .app_data_dir()
    .map(|directory| directory.join("profile-v1.json"))
    .map_err(|error| format!("Cannot locate the app data directory: {error}"))
}

fn rename_with_retry(from: &Path, to: &Path) -> std::io::Result<()> {
  // On Windows an antivirus scanner or the search indexer can briefly hold the
  // destination file, yielding a transient sharing violation on rename; a few short
  // retries recover it. On Unix rename does not fail this way, so this returns on
  // the first attempt.
  let mut attempt: u32 = 0;
  loop {
    match fs::rename(from, to) {
      Ok(()) => return Ok(()),
      Err(error) => {
        attempt += 1;
        if attempt >= 5 {
          return Err(error);
        }
        std::thread::sleep(std::time::Duration::from_millis(30 * attempt as u64));
      }
    }
  }
}

fn write_bytes_atomic(path: &Path, contents: &[u8], max_bytes: usize, size_error: &str) -> Result<(), String> {
  if contents.len() > max_bytes {
    return Err(size_error.into());
  }
  let parent = path.parent().ok_or("The local data path has no parent directory.")?;
  fs::create_dir_all(parent).map_err(|error| format!("Cannot create the local data directory: {error}"))?;
  let (temporary, mut file) = create_temporary_file(path)?;
  let write_result = (|| {
    file.write_all(contents).map_err(|error| format!("Cannot write the temporary local data file: {error}"))?;
    file.sync_all().map_err(|error| format!("Cannot sync the temporary local data file: {error}"))?;
    drop(file);
    rename_with_retry(&temporary, path).map_err(|error| format!("Cannot commit the local data file atomically: {error}"))?;
    if let Ok(directory) = File::open(parent) {
      let _ = directory.sync_all();
    }
    Ok(())
  })();
  if write_result.is_err() {
    let _ = fs::remove_file(&temporary);
  }
  write_result
}

fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
  if contents.len() > MAX_PROFILE_BYTES {
    return Err("The local profile is larger than the 9 MB portable-data limit plus its storage envelope.".into());
  }
  write_bytes_atomic(
    path,
    contents.as_bytes(),
    MAX_PROFILE_BYTES,
    "The local profile is larger than the 9 MB portable-data limit plus its storage envelope.",
  )
}

fn validate_recording_id(recording_id: &str) -> Result<(), String> {
  let valid_length = !recording_id.is_empty() && recording_id.len() <= 96;
  let safe_characters = recording_id
    .bytes()
    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_');
  if valid_length && safe_characters {
    Ok(())
  } else {
    Err("Recording IDs must contain 1-96 ASCII letters, numbers, hyphens, or underscores.".into())
  }
}

#[cfg(any(not(unix), test))]
fn recording_path(app_data_dir: &Path, recording_id: &str) -> Result<PathBuf, String> {
  validate_recording_id(recording_id)?;
  Ok(app_data_dir.join("recordings").join(format!("{recording_id}.audio")))
}

#[cfg(unix)]
fn recording_filename(recording_id: &str) -> Result<std::ffi::CString, String> {
  validate_recording_id(recording_id)?;
  std::ffi::CString::new(format!("{recording_id}.audio"))
    .map_err(|_| "The local recording filename contains an invalid byte.".to_string())
}

#[cfg(unix)]
fn open_recordings_directory(app_data_dir: &Path, create: bool) -> Result<Option<File>, String> {
  use std::os::unix::fs::OpenOptionsExt;

  let path = app_data_dir.join("recordings");
  if create {
    fs::create_dir_all(app_data_dir).map_err(|error| format!("Cannot create the local data directory: {error}"))?;
    match fs::create_dir(&path) {
      Ok(()) => {}
      Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
      Err(error) => return Err(format!("Cannot create the local recordings directory: {error}")),
    }
  }
  match OpenOptions::new()
    .read(true)
    .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC)
    .open(&path)
  {
    Ok(directory) => Ok(Some(directory)),
    Err(error) if !create && error.kind() == std::io::ErrorKind::NotFound => Ok(None),
    Err(error) => Err(format!("The local recordings directory cannot be opened safely: {error}")),
  }
}

#[cfg(unix)]
fn write_recording_at(app_data_dir: &Path, recording_id: &str, bytes: &[u8]) -> Result<(), String> {
  use std::os::fd::{AsRawFd, FromRawFd};

  if bytes.is_empty() {
    return Err("An empty recording cannot be saved.".into());
  }
  if bytes.len() > MAX_RECORDING_BYTES {
    return Err("A single recording cannot exceed the 25 MiB local-audio limit.".into());
  }
  let target = recording_filename(recording_id)?;
  let directory = open_recordings_directory(app_data_dir, true)?
    .ok_or("The local recordings directory is unavailable.")?;
  for _ in 0..16 {
    let sequence = NEXT_TEMPORARY_FILE.fetch_add(1, Ordering::Relaxed);
    let temporary = std::ffi::CString::new(format!(".{recording_id}.audio.tmp-{}-{sequence}", std::process::id()))
      .map_err(|_| "The temporary recording filename contains an invalid byte.".to_string())?;
    // SAFETY: both names are validated single path components and the returned
    // descriptor is immediately owned by `File` on success.
    let descriptor = unsafe {
      libc::openat(
        directory.as_raw_fd(),
        temporary.as_ptr(),
        libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL | libc::O_CLOEXEC | libc::O_NOFOLLOW,
        0o600,
      )
    };
    if descriptor < 0 {
      let error = std::io::Error::last_os_error();
      if error.kind() == std::io::ErrorKind::AlreadyExists {
        continue;
      }
      return Err(format!("Cannot create a temporary local recording: {error}"));
    }
    let mut file = unsafe { File::from_raw_fd(descriptor) };
    let result = (|| {
      file.write_all(bytes).map_err(|error| format!("Cannot write the temporary local recording: {error}"))?;
      file.sync_all().map_err(|error| format!("Cannot sync the temporary local recording: {error}"))?;
      drop(file);
      let renamed = unsafe {
        libc::renameat(directory.as_raw_fd(), temporary.as_ptr(), directory.as_raw_fd(), target.as_ptr())
      };
      if renamed != 0 {
        return Err(format!("Cannot commit the local recording atomically: {}", std::io::Error::last_os_error()));
      }
      directory.sync_all().map_err(|error| format!("Cannot sync the local recordings directory: {error}"))?;
      Ok(())
    })();
    if result.is_err() {
      unsafe { libc::unlinkat(directory.as_raw_fd(), temporary.as_ptr(), 0) };
    }
    return result;
  }
  Err("Cannot reserve a unique temporary local recording file.".into())
}

#[cfg(not(unix))]
fn write_recording_at(app_data_dir: &Path, recording_id: &str, bytes: &[u8]) -> Result<(), String> {
  if bytes.is_empty() {
    return Err("An empty recording cannot be saved.".into());
  }
  let path = recording_path(app_data_dir, recording_id)?;
  write_bytes_atomic(&path, bytes, MAX_RECORDING_BYTES, "A single recording cannot exceed the 25 MiB local-audio limit.")
}

#[cfg(unix)]
fn open_recording_for_read(app_data_dir: &Path, recording_id: &str) -> Result<File, String> {
  use std::os::fd::{AsRawFd, FromRawFd};

  let filename = recording_filename(recording_id)?;
  let directory = open_recordings_directory(app_data_dir, false)?
    .ok_or("The requested recording does not exist on this device.")?;
  // SAFETY: `directory` is an open, no-follow directory descriptor; filename
  // is a validated single component; and every successful descriptor is moved
  // immediately into `File`, which owns and closes it.
  let descriptor = unsafe {
    libc::openat(
      directory.as_raw_fd(),
      filename.as_ptr(),
      libc::O_RDONLY | libc::O_NONBLOCK | libc::O_NOFOLLOW | libc::O_CLOEXEC,
    )
  };
  if descriptor < 0 {
    let error = std::io::Error::last_os_error();
    return if error.kind() == std::io::ErrorKind::NotFound {
      Err("The requested recording does not exist on this device.".into())
    } else if error.raw_os_error() == Some(libc::ELOOP) {
      Err("The local recording path is not a regular file.".into())
    } else {
      Err(format!("Cannot safely open the local recording: {error}"))
    };
  }
  Ok(unsafe { File::from_raw_fd(descriptor) })
}

#[cfg(not(unix))]
fn open_recording_for_read(app_data_dir: &Path, recording_id: &str) -> Result<File, String> {
  let path = recording_path(app_data_dir, recording_id)?;
  let metadata = fs::symlink_metadata(&path).map_err(|error| {
    if error.kind() == std::io::ErrorKind::NotFound {
      "The requested recording does not exist on this device.".to_string()
    } else {
      format!("Cannot inspect the local recording: {error}")
    }
  })?;
  if metadata.file_type().is_symlink() || !metadata.is_file() {
    return Err("The local recording path is not a regular file.".into());
  }
  File::open(path).map_err(|error| format!("Cannot safely open the local recording: {error}"))
}

fn read_recording_at(app_data_dir: &Path, recording_id: &str) -> Result<Vec<u8>, String> {
  let mut file = open_recording_for_read(app_data_dir, recording_id)?;

  // Check the opened descriptor itself before a bounded read. On Unix the file
  // was opened relative to a no-follow directory descriptor, closing both the
  // parent-directory and leaf path-swap windows.
  let opened_metadata = file.metadata().map_err(|error| format!("Cannot inspect the opened local recording: {error}"))?;
  if !opened_metadata.is_file() {
    return Err("The local recording path is not a regular file.".into());
  }
  if opened_metadata.len() > MAX_RECORDING_BYTES as u64 {
    return Err("The local recording exceeds the 25 MiB safety limit.".into());
  }
  let mut bytes = Vec::with_capacity(opened_metadata.len() as usize);
  Read::by_ref(&mut file)
    .take((MAX_RECORDING_BYTES + 1) as u64)
    .read_to_end(&mut bytes)
    .map_err(|error| format!("Cannot read the local recording: {error}"))?;
  if bytes.len() > MAX_RECORDING_BYTES {
    return Err("The local recording exceeds the 25 MiB safety limit.".into());
  }
  Ok(bytes)
}

#[cfg(unix)]
fn delete_recording_at(app_data_dir: &Path, recording_id: &str) -> Result<(), String> {
  use std::os::fd::AsRawFd;

  let filename = recording_filename(recording_id)?;
  let Some(directory) = open_recordings_directory(app_data_dir, false)? else { return Ok(()) };
  let removed = unsafe { libc::unlinkat(directory.as_raw_fd(), filename.as_ptr(), 0) };
  if removed == 0 {
    directory.sync_all().map_err(|error| format!("Cannot sync the local recordings directory: {error}"))?;
    return Ok(());
  }
  let error = std::io::Error::last_os_error();
  if error.kind() == std::io::ErrorKind::NotFound {
    Ok(())
  } else {
    Err(format!("Cannot remove the local recording: {error}"))
  }
}

#[cfg(not(unix))]
fn delete_recording_at(app_data_dir: &Path, recording_id: &str) -> Result<(), String> {
  let path = recording_path(app_data_dir, recording_id)?;
  match fs::remove_file(path) {
    Ok(()) => Ok(()),
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
    Err(error) => Err(format!("Cannot remove the local recording: {error}")),
  }
}

#[cfg(unix)]
struct DirectoryStream(*mut libc::DIR);

#[cfg(unix)]
impl Drop for DirectoryStream {
  fn drop(&mut self) {
    unsafe { libc::closedir(self.0) };
  }
}

#[cfg(any(target_os = "macos", target_os = "ios", target_os = "freebsd", target_os = "openbsd", target_os = "netbsd", target_os = "dragonfly"))]
unsafe fn errno_location() -> *mut libc::c_int {
  libc::__error()
}

#[cfg(any(target_os = "linux", target_os = "android"))]
unsafe fn errno_location() -> *mut libc::c_int {
  libc::__errno_location()
}

#[cfg(unix)]
fn list_recording_ids_at(app_data_dir: &Path) -> Result<Vec<String>, String> {
  use std::{ffi::CStr, os::fd::{AsRawFd, FromRawFd}};

  let Some(directory) = open_recordings_directory(app_data_dir, false)? else { return Ok(Vec::new()) };
  let duplicate = unsafe { libc::dup(directory.as_raw_fd()) };
  if duplicate < 0 {
    return Err(format!("Cannot duplicate the local recordings directory handle: {}", std::io::Error::last_os_error()));
  }
  let raw_stream = unsafe { libc::fdopendir(duplicate) };
  if raw_stream.is_null() {
    unsafe { libc::close(duplicate) };
    return Err(format!("Cannot inspect the local recordings directory: {}", std::io::Error::last_os_error()));
  }
  let stream = DirectoryStream(raw_stream);
  let mut ids = Vec::new();
  loop {
    unsafe { *errno_location() = 0 };
    let entry = unsafe { libc::readdir(stream.0) };
    if entry.is_null() {
      let error = std::io::Error::last_os_error();
      if error.raw_os_error().unwrap_or(0) != 0 {
        return Err(format!("Cannot read the local recordings directory: {error}"));
      }
      break;
    }
    let name = unsafe { CStr::from_ptr((*entry).d_name.as_ptr()) };
    let Ok(name_text) = name.to_str() else { continue };
    let Some(recording_id) = name_text.strip_suffix(".audio") else { continue };
    if validate_recording_id(recording_id).is_err() {
      continue;
    }
    let descriptor = unsafe {
      libc::openat(
        directory.as_raw_fd(),
        name.as_ptr(),
        libc::O_RDONLY | libc::O_NONBLOCK | libc::O_NOFOLLOW | libc::O_CLOEXEC,
      )
    };
    if descriptor < 0 {
      continue;
    }
    let file = unsafe { File::from_raw_fd(descriptor) };
    if file.metadata().map(|metadata| metadata.is_file()).unwrap_or(false) {
      ids.push(recording_id.to_string());
    }
  }
  ids.sort();
  Ok(ids)
}

#[cfg(not(unix))]
fn list_recording_ids_at(app_data_dir: &Path) -> Result<Vec<String>, String> {
  let directory = app_data_dir.join("recordings");
  let entries = match fs::read_dir(directory) {
    Ok(entries) => entries,
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
    Err(error) => return Err(format!("Cannot inspect the local recordings directory: {error}")),
  };
  let mut ids = Vec::new();
  for entry in entries {
    let entry = entry.map_err(|error| format!("Cannot inspect a local recording entry: {error}"))?;
    let path = entry.path();
    if !entry.file_type().map_err(|error| format!("Cannot inspect a local recording type: {error}"))?.is_file()
      || path.extension().and_then(|value| value.to_str()) != Some("audio") {
      continue;
    }
    let Some(id) = path.file_stem().and_then(|value| value.to_str()) else { continue };
    if validate_recording_id(id).is_ok() {
      ids.push(id.to_string());
    }
  }
  ids.sort();
  Ok(ids)
}

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  app.path()
    .app_data_dir()
    .map_err(|error| format!("Cannot locate the app data directory: {error}"))
}

#[cfg(unix)]
fn open_profile_for_read(path: &Path) -> Result<Option<File>, String> {
  use std::os::unix::fs::OpenOptionsExt;

  match OpenOptions::new()
    .read(true)
    .custom_flags(libc::O_NONBLOCK | libc::O_NOFOLLOW | libc::O_CLOEXEC)
    .open(path)
  {
    Ok(file) => Ok(Some(file)),
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
    Err(error) if error.raw_os_error() == Some(libc::ELOOP) => {
      Err("The local profile path is not a regular file.".into())
    }
    Err(error) => Err(format!("Cannot safely open the local profile: {error}")),
  }
}

#[cfg(not(unix))]
fn open_profile_for_read(path: &Path) -> Result<Option<File>, String> {
  let metadata = match fs::symlink_metadata(path) {
    Ok(metadata) => metadata,
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
    Err(error) => return Err(format!("Cannot inspect the local profile: {error}")),
  };
  if metadata.file_type().is_symlink() || !metadata.is_file() {
    return Err("The local profile path is not a regular file.".into());
  }
  File::open(path)
    .map(Some)
    .map_err(|error| format!("Cannot safely open the local profile: {error}"))
}

fn read_profile_at(path: &Path) -> Result<Option<String>, String> {
  let Some(mut file) = open_profile_for_read(path)? else { return Ok(None) };
  let metadata = file.metadata().map_err(|error| format!("Cannot inspect the opened local profile: {error}"))?;
  if !metadata.is_file() {
    return Err("The local profile path is not a regular file.".into());
  }
  if metadata.len() > MAX_PROFILE_BYTES as u64 {
    return Err("The local profile exceeds the 9 MB portable-data safety limit plus its storage envelope.".into());
  }
  let mut bytes = Vec::with_capacity(metadata.len() as usize);
  Read::by_ref(&mut file)
    .take((MAX_PROFILE_BYTES + 1) as u64)
    .read_to_end(&mut bytes)
    .map_err(|error| format!("Cannot read the local profile: {error}"))?;
  if bytes.len() > MAX_PROFILE_BYTES {
    return Err("The local profile exceeds the 9 MB portable-data safety limit plus its storage envelope.".into());
  }
  String::from_utf8(bytes)
    .map(Some)
    .map_err(|_| "The local profile is not valid UTF-8 text.".into())
}

fn read_import_text_at(path: &Path) -> Result<String, String> {
  let Some(mut file) = open_profile_for_read(path)? else {
    return Err("The selected import file is no longer available.".into());
  };
  let metadata = file.metadata().map_err(|error| format!("Cannot inspect the opened import file: {error}"))?;
  if !metadata.is_file() {
    return Err("The selected import path is not a regular file.".into());
  }
  if metadata.len() > MAX_IMPORT_BYTES as u64 {
    return Err("The selected import exceeds the 9 MiB safety limit.".into());
  }
  let mut bytes = Vec::with_capacity(metadata.len() as usize);
  Read::by_ref(&mut file)
    .take((MAX_IMPORT_BYTES + 1) as u64)
    .read_to_end(&mut bytes)
    .map_err(|error| format!("Cannot read the selected import file: {error}"))?;
  if bytes.len() > MAX_IMPORT_BYTES {
    return Err("The selected import exceeds the 9 MiB safety limit.".into());
  }
  String::from_utf8(bytes).map_err(|_| "The selected import is not valid UTF-8 text.".into())
}

#[tauri::command]
fn read_profile(app: tauri::AppHandle) -> Result<Option<String>, String> {
  read_profile_at(&profile_path(&app)?)
}

#[tauri::command]
fn choose_import_text(app: tauri::AppHandle) -> Result<Option<String>, String> {
  let Some(selected) = app
    .dialog()
    .file()
    .add_filter("English Forge JSON", &["json"])
    .blocking_pick_file()
  else {
    return Ok(None);
  };
  let path = selected
    .into_path()
    .map_err(|_| "The selected import path is not a local file.".to_string())?;
  read_import_text_at(&path).map(Some)
}

#[tauri::command]
fn write_profile(app: tauri::AppHandle, contents: String) -> Result<(), String> {
  write_atomic(&profile_path(&app)?, &contents)
}

#[tauri::command]
fn delete_profile(app: tauri::AppHandle) -> Result<(), String> {
  let path = profile_path(&app)?;
  match fs::remove_file(path) {
    Ok(()) => Ok(()),
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
    Err(error) => Err(format!("Cannot remove the local profile: {error}")),
  }
}

#[tauri::command]
fn write_recording(app: tauri::AppHandle, request: tauri::ipc::Request<'_>) -> Result<(), String> {
  let recording_id = request
    .headers()
    .get("recording-id")
    .ok_or("The recording-id header is required.")?
    .to_str()
    .map_err(|_| "The recording-id header is not valid text.")?;
  let bytes: Cow<'_, [u8]> = match request.body() {
    tauri::ipc::InvokeBody::Raw(bytes) => Cow::Borrowed(bytes),
    tauri::ipc::InvokeBody::Json(serde_json::Value::Array(values)) => {
      if values.len() > MAX_RECORDING_BYTES {
        return Err("A single recording cannot exceed the 25 MiB local-audio limit.".into());
      }
      Cow::Owned(
        values
          .iter()
          .map(|value| value.as_u64().filter(|value| *value <= u8::MAX as u64).map(|value| value as u8))
          .collect::<Option<Vec<_>>>()
          .ok_or("The recording body must be a byte array.")?,
      )
    }
    _ => return Err("The recording body must contain raw audio bytes.".into()),
  };
  write_recording_at(&app_data_dir(&app)?, recording_id, &bytes)
}

#[tauri::command]
fn read_recording(app: tauri::AppHandle, recording_id: String) -> Result<tauri::ipc::Response, String> {
  read_recording_at(&app_data_dir(&app)?, &recording_id).map(tauri::ipc::Response::new)
}

#[tauri::command]
fn delete_recording(app: tauri::AppHandle, recording_id: String) -> Result<(), String> {
  delete_recording_at(&app_data_dir(&app)?, &recording_id)
}

#[tauri::command]
fn list_recording_ids(app: tauri::AppHandle) -> Result<Vec<String>, String> {
  list_recording_ids_at(&app_data_dir(&app)?)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      read_profile,
      choose_import_text,
      write_profile,
      delete_profile,
      write_recording,
      read_recording,
      delete_recording,
      list_recording_ids
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
  use super::{delete_recording_at, list_recording_ids_at, read_import_text_at, read_profile_at, read_recording_at, recording_path, write_atomic, write_recording_at, MAX_IMPORT_BYTES, MAX_PROFILE_BYTES, MAX_RECORDING_BYTES};
  use std::{fs, fs::OpenOptions, time::{SystemTime, UNIX_EPOCH}};
  #[cfg(unix)]
  use std::time::{Duration, Instant};

  fn temporary_directory(label: &str) -> std::path::PathBuf {
    let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    std::env::temp_dir().join(format!("english-forge-{label}-{unique}"))
  }

  #[cfg(unix)]
  fn create_fifo(path: &std::path::Path) {
    use std::os::unix::ffi::OsStrExt;

    let path = std::ffi::CString::new(path.as_os_str().as_bytes()).unwrap();
    let result = unsafe { libc::mkfifo(path.as_ptr(), 0o600) };
    assert_eq!(result, 0, "mkfifo failed: {}", std::io::Error::last_os_error());
  }

  #[test]
  fn atomic_profile_write_replaces_complete_document() {
    let directory = temporary_directory("profile");
    let path = directory.join("profile-v1.json");
    write_atomic(&path, "{\"version\":1}").unwrap();
    write_atomic(&path, "{\"version\":2,\"complete\":true}").unwrap();
    assert_eq!(fs::read_to_string(&path).unwrap(), "{\"version\":2,\"complete\":true}");
    assert!(fs::read_dir(&directory).unwrap().all(|entry| !entry.unwrap().file_name().to_string_lossy().contains(".tmp-")));
    fs::remove_dir_all(directory).unwrap();
  }

  #[test]
  fn recording_round_trip_is_atomic_and_deletion_is_idempotent() {
    let directory = temporary_directory("recording");
    let recording_id = "attempt_2026-07-16_A1";
    let audio = [0_u8, 1, 2, 127, 255];
    write_recording_at(&directory, recording_id, &audio).unwrap();
    assert_eq!(read_recording_at(&directory, recording_id).unwrap(), audio);
    let path = recording_path(&directory, recording_id).unwrap();
    assert!(path.exists());
    assert!(fs::read_dir(directory.join("recordings")).unwrap().all(|entry| !entry.unwrap().file_name().to_string_lossy().contains(".tmp-")));
    assert_eq!(list_recording_ids_at(&directory).unwrap(), vec![recording_id]);
    delete_recording_at(&directory, recording_id).unwrap();
    delete_recording_at(&directory, recording_id).unwrap();
    fs::remove_dir_all(directory).unwrap();
  }

  #[test]
  fn recording_ids_cannot_escape_the_recordings_directory() {
    let directory = temporary_directory("unsafe-id");
    for invalid in ["", "../profile-v1", "nested/clip", "clip.webm", "café"] {
      assert!(recording_path(&directory, invalid).is_err(), "{invalid} should be rejected");
    }
    assert!(recording_path(&directory, &"a".repeat(97)).is_err());
  }

  #[test]
  fn oversized_recordings_are_rejected_before_a_file_is_created() {
    let directory = temporary_directory("oversized");
    assert!(write_recording_at(&directory, "empty", &[]).is_err());
    let bytes = vec![0_u8; MAX_RECORDING_BYTES + 1];
    assert!(write_recording_at(&directory, "too-large", &bytes).is_err());
    assert!(!recording_path(&directory, "too-large").unwrap().exists());
  }

  #[test]
  fn recording_reads_reject_non_regular_and_oversized_entries_before_reading() {
    let directory = temporary_directory("unsafe-recording-entry");
    let recordings = directory.join("recordings");
    fs::create_dir_all(&recordings).unwrap();

    let directory_entry = recording_path(&directory, "directory_entry").unwrap();
    fs::create_dir(&directory_entry).unwrap();
    assert!(read_recording_at(&directory, "directory_entry").unwrap_err().contains("regular file"));

    let oversized_entry = recording_path(&directory, "oversized_entry").unwrap();
    let file = OpenOptions::new().create_new(true).write(true).open(&oversized_entry).unwrap();
    file.set_len((MAX_RECORDING_BYTES + 1) as u64).unwrap();
    assert!(read_recording_at(&directory, "oversized_entry").unwrap_err().contains("safety limit"));

    fs::remove_dir_all(directory).unwrap();
  }

  #[cfg(unix)]
  #[test]
  fn recording_reads_never_follow_symbolic_links() {
    use std::os::unix::fs::symlink;

    let directory = temporary_directory("recording-symlink");
    let recordings = directory.join("recordings");
    fs::create_dir_all(&recordings).unwrap();
    let outside = directory.join("private.txt");
    fs::write(&outside, b"must not be returned").unwrap();
    symlink(&outside, recording_path(&directory, "linked_recording").unwrap()).unwrap();

    assert!(read_recording_at(&directory, "linked_recording").unwrap_err().contains("regular file"));
    assert!(list_recording_ids_at(&directory).unwrap().is_empty());
    delete_recording_at(&directory, "linked_recording").unwrap();
    assert_eq!(fs::read(&outside).unwrap(), b"must not be returned");
    assert!(fs::symlink_metadata(recording_path(&directory, "linked_recording").unwrap()).is_err());
    fs::remove_dir_all(directory).unwrap();
  }

  #[cfg(unix)]
  #[test]
  fn profile_and_recording_reads_reject_fifos_without_blocking() {
    let directory = temporary_directory("fifo-reads");
    let recordings = directory.join("recordings");
    fs::create_dir_all(&recordings).unwrap();

    let profile = directory.join("profile-v1.json");
    create_fifo(&profile);
    let started = Instant::now();
    assert!(read_profile_at(&profile).unwrap_err().contains("regular file"));
    assert!(started.elapsed() < Duration::from_secs(1));

    let recording = recording_path(&directory, "fifo_recording").unwrap();
    create_fifo(&recording);
    let started = Instant::now();
    assert!(read_recording_at(&directory, "fifo_recording").unwrap_err().contains("regular file"));
    assert!(started.elapsed() < Duration::from_secs(1));

    let started = Instant::now();
    assert!(list_recording_ids_at(&directory).unwrap().is_empty());
    assert!(started.elapsed() < Duration::from_secs(1));

    fs::remove_dir_all(directory).unwrap();
  }

  #[cfg(unix)]
  #[test]
  fn every_recording_operation_rejects_a_symbolic_linked_recordings_directory() {
    use std::os::unix::fs::symlink;

    let directory = temporary_directory("recordings-directory-symlink");
    let outside = directory.join("outside");
    fs::create_dir_all(&outside).unwrap();
    let private_recording = outside.join("private_recording.audio");
    fs::write(&private_recording, b"must not be returned").unwrap();
    symlink(&outside, directory.join("recordings")).unwrap();

    assert!(write_recording_at(&directory, "new_recording", b"must stay local").unwrap_err().contains("cannot be opened safely"));
    assert!(read_recording_at(&directory, "private_recording").unwrap_err().contains("cannot be opened safely"));
    assert!(delete_recording_at(&directory, "private_recording").unwrap_err().contains("cannot be opened safely"));
    assert!(list_recording_ids_at(&directory).unwrap_err().contains("cannot be opened safely"));
    assert_eq!(fs::read(private_recording).unwrap(), b"must not be returned");
    assert!(!outside.join("new_recording.audio").exists());
    fs::remove_dir_all(directory).unwrap();
  }

  #[cfg(unix)]
  #[test]
  fn every_recording_operation_rejects_a_non_directory_recordings_entry() {
    let directory = temporary_directory("recordings-not-directory");
    fs::create_dir_all(&directory).unwrap();
    let invalid_entry = directory.join("recordings");
    fs::write(&invalid_entry, b"must remain unchanged").unwrap();

    assert!(write_recording_at(&directory, "new_recording", b"audio").is_err());
    assert!(read_recording_at(&directory, "new_recording").is_err());
    assert!(delete_recording_at(&directory, "new_recording").is_err());
    assert!(list_recording_ids_at(&directory).is_err());
    assert_eq!(fs::read(&invalid_entry).unwrap(), b"must remain unchanged");
    fs::remove_dir_all(directory).unwrap();
  }

  #[test]
  fn oversized_profiles_are_rejected_before_reading_contents() {
    let directory = temporary_directory("oversized-profile");
    fs::create_dir_all(&directory).unwrap();
    let path = directory.join("profile-v1.json");
    let file = OpenOptions::new().create_new(true).write(true).open(&path).unwrap();
    file.set_len((MAX_PROFILE_BYTES + 1) as u64).unwrap();
    assert!(read_profile_at(&path).unwrap_err().contains("safety limit"));
    fs::remove_dir_all(directory).unwrap();
  }

  #[test]
  fn selected_imports_are_utf8_decoded_through_a_bounded_descriptor_read() {
    let directory = temporary_directory("bounded-import");
    fs::create_dir_all(&directory).unwrap();
    let valid = directory.join("valid.json");
    fs::write(&valid, b"{\"schemaVersion\":6}").unwrap();
    assert_eq!(read_import_text_at(&valid).unwrap(), "{\"schemaVersion\":6}");

    let oversized = directory.join("oversized.json");
    let file = OpenOptions::new().create_new(true).write(true).open(&oversized).unwrap();
    file.set_len((MAX_IMPORT_BYTES + 1) as u64).unwrap();
    assert!(read_import_text_at(&oversized).unwrap_err().contains("safety limit"));
    fs::remove_dir_all(directory).unwrap();
  }

  #[cfg(unix)]
  #[test]
  fn profile_reads_never_follow_symbolic_links() {
    use std::os::unix::fs::symlink;

    let directory = temporary_directory("profile-symlink");
    fs::create_dir_all(&directory).unwrap();
    let outside = directory.join("private.json");
    let path = directory.join("profile-v1.json");
    fs::write(&outside, b"{\"private\":true}").unwrap();
    symlink(&outside, &path).unwrap();

    assert!(read_profile_at(&path).unwrap_err().contains("regular file"));
    assert_eq!(fs::read(&outside).unwrap(), b"{\"private\":true}");
    fs::remove_dir_all(directory).unwrap();
  }
}
