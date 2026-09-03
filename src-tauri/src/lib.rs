use catalog::{load_active_catalog, SyncResult};
use domain::{
    CatalogEntry, DownloadState, DownloadTask, FitResult, HardwareProfile, ModelRecord,
    RunningInstanceInfo, ServeConfig,
};
use downloader::{download_model, DownloadOptions};
use fit_engine::rank_recommendations;
use gateway::start_gateway;
use hw_probe::{get_or_detect_profile, refresh_profile};
use library::{LibraryReconciliation, LibraryStore};
use serde::{Deserialize, Serialize};
use server_manager::{ServerManager, ServerState};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};
use tauri::{Emitter, Manager, State};
use tauri_plugin_updater::UpdaterExt;
use tokio_util::sync::CancellationToken;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppUpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub release_notes: Option<String>,
    pub pub_date: Option<String>,
}

fn default_true() -> bool {
    true
}

fn default_catalog_endpoint() -> String {
    catalog::DEFAULT_CATALOG_CDN_URL.to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub hf_token: String,
    pub gateway_port: u16,
    pub default_context_size: u32,
    pub default_kv_type: domain::KvType,
    pub models_dir: String,
    pub run_in_background: bool,
    #[serde(default = "default_true")]
    pub auto_update_catalog: bool,
    #[serde(default = "default_catalog_endpoint")]
    pub catalog_endpoint: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            hf_token: String::new(),
            gateway_port: 13370,
            default_context_size: 4096,
            default_kv_type: domain::KvType::F16,
            models_dir: String::new(),
            run_in_background: true,
            auto_update_catalog: true,
            catalog_endpoint: default_catalog_endpoint(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CleanUninstallOptions {
    pub delete_models: Option<bool>,
    pub clear_configs: Option<bool>,
    pub clear_cache: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UninstallResult {
    pub reclaimed_bytes: u64,
    pub models_deleted: usize,
    pub configs_cleared: bool,
    pub cache_purged: bool,
    pub app_data_dir: String,
    pub success: bool,
}


pub struct AppState {
    pub server_manager: Arc<ServerManager>,
    pub library_store: Arc<LibraryStore>,
    pub settings: Arc<RwLock<AppSettings>>,
    pub settings_path: PathBuf,
    pub app_data_dir: PathBuf,
    pub active_downloads: Arc<Mutex<HashMap<String, (DownloadTask, CancellationToken)>>>,
}

fn load_or_init_settings(
    app_data_dir: &std::path::Path,
    library_store: &LibraryStore,
) -> (AppSettings, PathBuf) {
    let settings_path = app_data_dir.join("settings.json");
    if settings_path.exists() {
        if let Ok(data) = std::fs::read_to_string(&settings_path) {
            if let Ok(mut s) = serde_json::from_str::<AppSettings>(&data) {
                if s.models_dir.is_empty() {
                    s.models_dir = library_store.models_dir().to_string_lossy().to_string();
                }
                return (s, settings_path);
            }
        }
    }

    let default_settings = AppSettings {
        models_dir: library_store.models_dir().to_string_lossy().to_string(),
        ..Default::default()
    };
    let _ = save_settings_to_file(&settings_path, &default_settings);
    (default_settings, settings_path)
}

fn save_settings_to_file(path: &std::path::Path, settings: &AppSettings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_hardware_profile() -> Result<HardwareProfile, String> {
    get_or_detect_profile().map_err(|e| e.to_string())
}

#[tauri::command]
async fn refresh_hardware_profile() -> Result<HardwareProfile, String> {
    refresh_profile().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_catalog(state: State<'_, AppState>) -> Result<Vec<CatalogEntry>, String> {
    load_active_catalog(Some(&state.app_data_dir)).map_err(|e| e.to_string())
}

#[tauri::command]
async fn recommend_models(
    state: State<'_, AppState>,
    cfg: ServeConfig,
) -> Result<Vec<FitResult>, String> {
    let profile = get_or_detect_profile().map_err(|e| e.to_string())?;
    let catalog = load_active_catalog(Some(&state.app_data_dir)).map_err(|e| e.to_string())?;
    Ok(rank_recommendations(&profile, &catalog, &cfg))
}

#[tauri::command]
async fn list_library_models(state: State<'_, AppState>) -> Result<Vec<ModelRecord>, String> {
    state.library_store.list().map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_library_model(
    state: State<'_, AppState>,
    entry_id: String,
) -> Result<bool, String> {
    // If the deleted model is currently running, stop the server first
    let current_state = state.server_manager.get_state();
    if let ServerState::Serving { ref model_id, .. } = current_state {
        if model_id == &entry_id {
            let _ = state.server_manager.stop_server().await;
        }
    }
    state
        .library_store
        .delete(&entry_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn purge_all_models(state: State<'_, AppState>) -> Result<u64, String> {
    // Stop server if running
    let _ = state.server_manager.stop_server().await;

    // Cancel all active downloads
    {
        let mut downloads = state.active_downloads.lock().unwrap();
        for (_, token) in downloads.values() {
            token.cancel();
        }
        downloads.clear();
    }

    // Purge all models from store
    state.library_store.purge_all().map_err(|e| e.to_string())
}

#[tauri::command]
async fn factory_reset(state: State<'_, AppState>) -> Result<bool, String> {
    // 1. Stop server
    let _ = state.server_manager.stop_server().await;

    // 2. Cancel downloads
    {
        let mut downloads = state.active_downloads.lock().unwrap();
        for (_, token) in downloads.values() {
            token.cancel();
        }
        downloads.clear();
    }

    // 3. Purge all models
    let _ = state.library_store.purge_all();

    // 4. Reset settings
    let default_settings = AppSettings {
        models_dir: state
            .library_store
            .models_dir()
            .to_string_lossy()
            .to_string(),
        ..Default::default()
    };
    let _ = save_settings_to_file(&state.settings_path, &default_settings);
    {
        let mut s = state.settings.write().unwrap();
        *s = default_settings;
    }

    Ok(true)
}

#[tauri::command]
async fn clean_uninstall(
    state: State<'_, AppState>,
    options: Option<CleanUninstallOptions>,
) -> Result<UninstallResult, String> {
    let opts = options.unwrap_or_default();
    let delete_models = opts.delete_models.unwrap_or(true);
    let clear_configs = opts.clear_configs.unwrap_or(true);
    let clear_cache = opts.clear_cache.unwrap_or(true);

    // 1. Stop all server instances
    let _ = state.server_manager.stop_all().await;

    // 2. Cancel all active downloads
    {
        let mut downloads = state.active_downloads.lock().unwrap();
        for (_, token) in downloads.values() {
            token.cancel();
        }
        downloads.clear();
    }

    // 3. Count models before purging
    let models_count = state.library_store.list().unwrap_or_default().len();
    let mut reclaimed_bytes = 0u64;

    // 4. Purge models if requested
    if delete_models {
        if let Ok(bytes) = state.library_store.purge_all() {
            reclaimed_bytes = bytes;
        }
    }

    // 5. Clear configurations if requested
    if clear_configs {
        let default_settings = AppSettings {
            models_dir: state
                .library_store
                .models_dir()
                .to_string_lossy()
                .to_string(),
            ..Default::default()
        };
        let _ = save_settings_to_file(&state.settings_path, &default_settings);
        {
            let mut s = state.settings.write().unwrap();
            *s = default_settings;
        }
    }

    // 6. Clear cache if requested
    if clear_cache {
        let cat_cache = state.app_data_dir.join("catalog");
        if cat_cache.exists() {
            let _ = std::fs::remove_dir_all(&cat_cache);
        }
    }

    let app_data_dir = state
        .library_store
        .base_dir()
        .to_string_lossy()
        .to_string();

    Ok(UninstallResult {
        reclaimed_bytes,
        models_deleted: models_count,
        configs_cleared: clear_configs,
        cache_purged: clear_cache,
        app_data_dir,
        success: true,
    })
}

#[tauri::command]
async fn prune_orphans(state: State<'_, AppState>, orphans: Vec<String>) -> Result<u64, String> {
    let paths: Vec<PathBuf> = orphans.into_iter().map(PathBuf::from).collect();
    state.library_store.prune_orphans(&paths).map_err(|e| e.to_string())
}

#[tauri::command]
async fn reconcile_library(state: State<'_, AppState>, ) -> Result<LibraryReconciliation, String> {
    state.library_store.reconcile().map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_download(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    entry_id: String,
) -> Result<String, String> {
    let catalog = load_active_catalog(Some(&state.app_data_dir)).map_err(|e| e.to_string())?;
    let entry = catalog
        .into_iter()
        .find(|e| e.id == entry_id)
        .ok_or_else(|| format!("Model '{}' not found in catalog", entry_id))?;

    let token = {
        let s = state.settings.read().unwrap();
        if s.hf_token.is_empty() {
            None
        } else {
            Some(s.hf_token.clone())
        }
    };

    let cancel_token = CancellationToken::new();
    let task = DownloadTask {
        entry_id: entry_id.clone(),
        state: DownloadState::Downloading {
            bytes_done: 0,
            total_bytes: entry.file_size_bytes,
        },
        bytes_done: 0,
        bytes_total: entry.file_size_bytes,
        etag: entry.sha256.clone(),
        error: None,
    };

    state
        .active_downloads
        .lock()
        .unwrap()
        .insert(entry_id.clone(), (task, cancel_token.clone()));

    let library = state.library_store.clone();
    let dest_dir = library.models_dir().to_path_buf();
    let downloads_map = state.active_downloads.clone();
    let eid = entry_id.clone();
    let progress_map = downloads_map.clone();
    let eid_progress = eid.clone();
    let on_progress: Option<downloader::ProgressCallback> =
        Some(std::sync::Arc::new(move |bytes_done, total_bytes| {
            if let Ok(mut map) = progress_map.lock() {
                if let Some((t, _)) = map.get_mut(&eid_progress) {
                    t.bytes_done = bytes_done;
                    t.bytes_total = total_bytes;
                    t.state = DownloadState::Downloading {
                        bytes_done,
                        total_bytes,
                    };
                }
            }
        }));

    let app_handle = app.clone();
    tokio::spawn(async move {
        let options = DownloadOptions {
            entry: entry.clone(),
            destination_dir: dest_dir,
            hf_token: token,
            base_url_override: None,
            cancel_token: Some(cancel_token),
            on_progress,
        };

        match download_model(options).await {
            Ok(file_path) => {
                let record = ModelRecord {
                    entry_id: eid.clone(),
                    file_path,
                    size_bytes: entry.file_size_bytes,
                    verified: true,
                    added_at: chrono::Utc::now(),
                };
                let _ = library.add_verified(record);
                downloads_map.lock().unwrap().remove(&eid);

                // 1. Emit completion event to frontend
                let _ = app_handle.emit(
                    "download-complete",
                    serde_json::json!({
                        "entry_id": eid,
                        "filename": entry.filename,
                        "size_bytes": entry.file_size_bytes,
                    }),
                );

                // 2. Fire OS desktop notification
                {
                    use tauri_plugin_notification::NotificationExt;
                    let _ = app_handle
                        .notification()
                        .builder()
                        .title("Model Download Complete")
                        .body(format!("'{}' is verified and ready to serve.", eid))
                        .show();
                }
            }
            Err(e) => {
                let err_msg = e.to_string();
                if let Some((t, _)) = downloads_map.lock().unwrap().get_mut(&eid) {
                    t.state = DownloadState::Failed {
                        reason: err_msg.clone(),
                    };
                }

                // 1. Emit failure event to frontend
                let _ = app_handle.emit(
                    "download-failed",
                    serde_json::json!({
                        "entry_id": eid,
                        "reason": err_msg.clone(),
                    }),
                );

                // 2. Fire OS desktop notification
                {
                    use tauri_plugin_notification::NotificationExt;
                    let _ = app_handle
                        .notification()
                        .builder()
                        .title("Model Download Failed")
                        .body(format!("Failed to download '{}': {}", eid, err_msg))
                        .show();
                }
            }
        }
    });

    Ok(entry_id)
}

#[tauri::command]
async fn cancel_download(state: State<'_, AppState>, entry_id: String) -> Result<bool, String> {
    let mut map = state.active_downloads.lock().unwrap();
    if let Some((_, token)) = map.remove(&entry_id) {
        token.cancel();
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn get_active_downloads(state: State<'_, AppState>) -> Result<Vec<DownloadTask>, String> {
    let map = state.active_downloads.lock().unwrap();
    Ok(map.values().map(|(t, _)| t.clone()).collect())
}

#[tauri::command]
async fn get_server_state(state: State<'_, AppState>) -> Result<ServerState, String> {
    Ok(state.server_manager.get_state())
}

#[tauri::command]
async fn start_server(
    state: State<'_, AppState>,
    model_id: String,
    cfg: ServeConfig,
) -> Result<u16, String> {
    let record = state
        .library_store
        .get(&model_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Model '{}' is not installed in library", model_id))?;

    let profile = get_or_detect_profile().map_err(|e| e.to_string())?;
    let catalog = load_active_catalog(Some(&state.app_data_dir)).map_err(|e| e.to_string())?;
    let entry = catalog.into_iter().find(|e| e.id == model_id);

    let fit = entry.map(|e| fit_engine::evaluate(&profile, &e, &cfg));

    state
        .server_manager
        .start_server(model_id, record.file_path, cfg, fit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn stop_server(state: State<'_, AppState>) -> Result<(), String> {
    state
        .server_manager
        .stop_all()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn stop_instance(state: State<'_, AppState>, model_id: String) -> Result<(), String> {
    state
        .server_manager
        .stop_instance(&model_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_running_instances(
    state: State<'_, AppState>,
) -> Result<Vec<RunningInstanceInfo>, String> {
    Ok(state.server_manager.list_instances())
}

#[tauri::command]
async fn get_server_logs(
    state: State<'_, AppState>,
    model_id: Option<String>,
) -> Result<Vec<String>, String> {
    if let Some(ref mid) = model_id {
        Ok(state.server_manager.get_logs_for_model(mid))
    } else {
        Ok(state.server_manager.get_logs())
    }
}

#[tauri::command]
async fn clear_server_logs(
    state: State<'_, AppState>,
    model_id: Option<String>,
) -> Result<(), String> {
    state.server_manager.clear_logs(model_id.as_deref());
    Ok(())
}

#[tauri::command]
async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    Ok(state.settings.read().unwrap().clone())
}

#[tauri::command]
async fn save_settings(state: State<'_, AppState>, settings: AppSettings) -> Result<(), String> {
    save_settings_to_file(&state.settings_path, &settings)?;
    *state.settings.write().unwrap() = settings;
    Ok(())
}

#[tauri::command]
async fn sync_catalog(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<SyncResult, String> {
    let endpoint = state.settings.read().unwrap().catalog_endpoint.clone();
    let res = catalog::sync_catalog_from_remote(&state.app_data_dir, &endpoint)
        .await
        .map_err(|e| e.to_string())?;

    if let SyncResult::Updated { count, ref etag } = res {
        let _ = app.emit(
            "catalog:updated",
            serde_json::json!({ "count": count, "etag": etag }),
        );
    }

    Ok(res)
}

fn is_valid_executable(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    if let Ok(meta) = std::fs::metadata(path) {
        if meta.len() < 512 {
            return false;
        }
        if let Ok(mut f) = std::fs::File::open(path) {
            use std::io::Read;
            let mut header = [0u8; 16];
            if let Ok(n) = f.read(&mut header) {
                if n >= 2 && &header[..2] == b"#!" {
                    return false;
                }
            }
        }
        true
    } else {
        false
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn resolve_sidecar_path(app: &tauri::App) -> PathBuf {
    let sidecar_name = if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            "llama-server-aarch64-apple-darwin"
        } else {
            "llama-server-x86_64-apple-darwin"
        }
    } else if cfg!(target_os = "windows") {
        if cfg!(target_arch = "aarch64") {
            "llama-server-aarch64-pc-windows-msvc.exe"
        } else {
            "llama-server-x86_64-pc-windows-msvc.exe"
        }
    } else if cfg!(target_arch = "aarch64") {
        "llama-server-aarch64-unknown-linux-gnu"
    } else {
        "llama-server-x86_64-unknown-linux-gnu"
    };

    let mut candidate_paths = Vec::new();

    // 1. Packaged Tauri resource directory
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidate_paths.push(resource_dir.join("binaries").join(sidecar_name));
        candidate_paths.push(resource_dir.join(sidecar_name));
        candidate_paths.push(resource_dir.join("llama-server"));
        candidate_paths.push(resource_dir.join("llama-server.exe"));
    }

    // 2. Next to executable and sibling lib directories
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            if let Some(root) = exe_dir.parent() {
                candidate_paths.push(root.join("lib").join("llm-advisor").join(sidecar_name));
                candidate_paths.push(root.join("lib").join("llm-advisor").join("llama-server"));
            }
            candidate_paths.push(exe_dir.join("binaries").join(sidecar_name));
            candidate_paths.push(exe_dir.join(sidecar_name));
            candidate_paths.push(exe_dir.join("llama-server"));
            candidate_paths.push(exe_dir.join("llama-server.exe"));
        }
    }

    // 3. System installed locations
    candidate_paths.push(PathBuf::from("/usr/lib/llm-advisor").join(sidecar_name));
    candidate_paths.push(PathBuf::from("/usr/lib/llm-advisor").join("llama-server"));
    candidate_paths.push(PathBuf::from("/usr/local/lib/llm-advisor").join(sidecar_name));

    // 4. Project dev directories
    if let Ok(cwd) = std::env::current_dir() {
        candidate_paths.push(cwd.join("src-tauri").join("binaries").join(sidecar_name));
        candidate_paths.push(cwd.join("sidecars").join("binaries").join("llama-server"));
        candidate_paths.push(
            cwd.join("sidecars")
                .join("binaries")
                .join("llama-server.exe"),
        );
        candidate_paths.push(cwd.join("binaries").join(sidecar_name));
    }

    // First pass: find verified real binary
    for path in &candidate_paths {
        if is_valid_executable(path) {
            server_manager::ensure_sidecar_dependencies(path);
            return path.clone();
        }
    }

    // Second pass: any existing path
    for path in &candidate_paths {
        if path.exists() {
            server_manager::ensure_sidecar_dependencies(path);
            return path.clone();
        }
    }

    // Default fallback
    let fallback = app
        .path()
        .resource_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("binaries")
        .join(sidecar_name);
    server_manager::ensure_sidecar_dependencies(&fallback);
    fallback
}

#[tauri::command]
async fn check_app_update(app: tauri::AppHandle) -> Result<AppUpdateInfo, String> {
    let current_version = app.package_info().version.to_string();
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            tracing::info!("Updater not active or running in development: {}", e);
            return Ok(AppUpdateInfo {
                latest_version: current_version.clone(),
                current_version,
                update_available: false,
                release_notes: None,
                pub_date: None,
            });
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            let latest = update.version.clone();
            let notes = update.body.clone();
            let date = update.date.map(|d| d.to_string());
            Ok(AppUpdateInfo {
                current_version,
                latest_version: latest,
                update_available: true,
                release_notes: notes,
                pub_date: date,
            })
        }
        Ok(None) => Ok(AppUpdateInfo {
            latest_version: current_version.clone(),
            current_version,
            update_available: false,
            release_notes: None,
            pub_date: None,
        }),
        Err(e) => {
            tracing::warn!("Failed to check for app updates: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn install_app_update(app: tauri::AppHandle) -> Result<bool, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update
            .download_and_install(|_chunk, _total| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            tracing::info!("Another instance was launched; bringing existing window to focus.");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("./data"));

            let library_store = Arc::new(
                LibraryStore::new(app_data_dir.clone())
                    .expect("Failed to initialize library store"),
            );

            // Locate sidecar binary
            let sidecar_path = resolve_sidecar_path(app);

            let server_manager = Arc::new(ServerManager::new(sidecar_path));
            let (settings_val, settings_path) =
                load_or_init_settings(&app_data_dir, &library_store);
            let settings = Arc::new(RwLock::new(settings_val.clone()));

            // Launch Axum gateway in background
            let sm_clone = server_manager.clone();
            let gateway_port = settings.read().unwrap().gateway_port;
            tauri::async_runtime::spawn(async move {
                if let Err(e) = start_gateway(sm_clone, gateway_port).await {
                    tracing::error!("Failed to launch Axum gateway on {}: {}", gateway_port, e);
                }
            });

            // Set up System Tray
            let show_item = MenuItemBuilder::with_id("show", "Show LLM Advisor").build(app)?;
            let stop_item =
                MenuItemBuilder::with_id("stop_server", "Stop Inference Server").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit LLM Advisor").build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .items(&[&show_item, &stop_item, &quit_item])
                .build()?;

            let tray_builder = TrayIconBuilder::with_id("main-tray")
                .tooltip("LLM Advisor (:13370)")
                .menu(&tray_menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "stop_server" => {
                        let state = app.state::<AppState>();
                        let sm = state.server_manager.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = sm.stop_server().await;
                        });
                    }
                    "quit" => {
                        let state = app.state::<AppState>();
                        let sm = state.server_manager.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = sm.stop_server().await;
                            std::process::exit(0);
                        });
                    }
                    _ => {}
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_icon(icon.clone());
                }
                let _ = tray_builder.icon(icon).build(app);
            } else {
                let _ = tray_builder.build(app);
            }

            let bg_app_handle = app.handle().clone();
            let bg_app_data = app_data_dir.clone();
            let auto_update_catalog = settings_val.auto_update_catalog;
            let catalog_endpoint = settings_val.catalog_endpoint.clone();

            if auto_update_catalog {
                tauri::async_runtime::spawn(async move {
                    // Non-blocking yield to allow UI to mount and render first
                    tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                    match catalog::sync_catalog_from_remote(&bg_app_data, &catalog_endpoint).await {
                        Ok(SyncResult::Updated { count, etag }) => {
                            tracing::info!("Background catalog sync updated: {} models", count);
                            let _ = bg_app_handle.emit(
                                "catalog:updated",
                                serde_json::json!({ "count": count, "etag": etag }),
                            );
                        }
                        Ok(SyncResult::NotModified) => {
                            tracing::debug!("Background catalog sync: up to date");
                        }
                        Err(e) => {
                            tracing::warn!("Background catalog sync notice: {}", e);
                        }
                    }
                });
            }

            app.manage(AppState {
                server_manager,
                library_store,
                settings,
                settings_path,
                app_data_dir,
                active_downloads: Arc::new(Mutex::new(HashMap::new())),
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let should_run_in_background = {
                    if let Some(state) = app.try_state::<AppState>() {
                        if let Ok(s) = state.settings.read() {
                            s.run_in_background
                        } else {
                            true
                        }
                    } else {
                        true
                    }
                };

                if should_run_in_background {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_hardware_profile,
            refresh_hardware_profile,
            get_catalog,
            recommend_models,
            list_library_models,
            delete_library_model,
            purge_all_models,
            factory_reset,
            reconcile_library,
            start_download,
            cancel_download,
            get_active_downloads,
            get_server_state,
            start_server,
            stop_server,
            stop_instance,
            list_running_instances,
            get_server_logs,
            clear_server_logs,
            get_settings,
            save_settings,
            clean_uninstall,
            prune_orphans,
            sync_catalog,
            check_app_update,
            install_app_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
