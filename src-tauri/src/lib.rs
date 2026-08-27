//! Main application library and Tauri IPC command handlers for Local LLM Advisor.

use catalog::load_bundled_catalog;
use domain::{
    CatalogEntry, DownloadState, DownloadTask, FitResult, HardwareProfile, ModelRecord, ServeConfig,
};
use downloader::{download_model, DownloadOptions};
use fit_engine::rank_recommendations;
use gateway::start_gateway;
use hw_probe::{get_or_detect_profile, refresh_profile};
use library::{LibraryReconciliation, LibraryStore};
use serde::{Deserialize, Serialize};
use server_manager::{ServerManager, ServerState};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock};
use tauri::{Manager, State};
use tokio_util::sync::CancellationToken;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub hf_token: String,
    pub gateway_port: u16,
    pub default_context_size: u32,
    pub default_kv_type: domain::KvType,
    pub models_dir: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            hf_token: String::new(),
            gateway_port: 13370,
            default_context_size: 4096,
            default_kv_type: domain::KvType::F16,
            models_dir: String::new(),
        }
    }
}

pub struct AppState {
    pub server_manager: Arc<ServerManager>,
    pub library_store: Arc<LibraryStore>,
    pub settings: Arc<RwLock<AppSettings>>,
    pub active_downloads: Arc<Mutex<HashMap<String, (DownloadTask, CancellationToken)>>>,
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
async fn get_catalog() -> Result<Vec<CatalogEntry>, String> {
    load_bundled_catalog().map_err(|e| e.to_string())
}

#[tauri::command]
async fn recommend_models(cfg: ServeConfig) -> Result<Vec<FitResult>, String> {
    let profile = get_or_detect_profile().map_err(|e| e.to_string())?;
    let catalog = load_bundled_catalog().map_err(|e| e.to_string())?;
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
    state
        .library_store
        .delete(&entry_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn reconcile_library(state: State<'_, AppState>) -> Result<LibraryReconciliation, String> {
    state.library_store.reconcile().map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_download(state: State<'_, AppState>, entry_id: String) -> Result<String, String> {
    let catalog = load_bundled_catalog().map_err(|e| e.to_string())?;
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

    tokio::spawn(async move {
        let options = DownloadOptions {
            entry: entry.clone(),
            destination_dir: dest_dir,
            hf_token: token,
            base_url_override: None,
            cancel_token: Some(cancel_token),
            on_progress: None,
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
            }
            Err(e) => {
                if let Some((t, _)) = downloads_map.lock().unwrap().get_mut(&eid) {
                    t.state = DownloadState::Failed {
                        reason: e.to_string(),
                    };
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
    let catalog = load_bundled_catalog().map_err(|e| e.to_string())?;
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
        .stop_server()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_server_logs(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    Ok(state.server_manager.get_logs())
}

#[tauri::command]
async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    Ok(state.settings.read().unwrap().clone())
}

#[tauri::command]
async fn save_settings(state: State<'_, AppState>, settings: AppSettings) -> Result<(), String> {
    *state.settings.write().unwrap() = settings;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
            let sidecar_name = if cfg!(target_os = "macos") {
                "llama-server-x86_64-apple-darwin"
            } else {
                "llama-server-x86_64-unknown-linux-gnu"
            };

            let sidecar_path = app
                .path()
                .resource_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join("binaries")
                .join(sidecar_name);

            let server_manager = Arc::new(ServerManager::new(sidecar_path));
            let settings = Arc::new(RwLock::new(AppSettings {
                models_dir: library_store.models_dir().to_string_lossy().to_string(),
                ..Default::default()
            }));

            // Launch Axum gateway in background
            let sm_clone = server_manager.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = start_gateway(sm_clone, 13370).await {
                    tracing::error!("Failed to launch Axum gateway on 13370: {}", e);
                }
            });

            app.manage(AppState {
                server_manager,
                library_store,
                settings,
                active_downloads: Arc::new(Mutex::new(HashMap::new())),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_hardware_profile,
            refresh_hardware_profile,
            get_catalog,
            recommend_models,
            list_library_models,
            delete_library_model,
            reconcile_library,
            start_download,
            cancel_download,
            get_active_downloads,
            get_server_state,
            start_server,
            stop_server,
            get_server_logs,
            get_settings,
            save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
