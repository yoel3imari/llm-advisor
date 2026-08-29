//! Supervised multi-instance llama-server sidecar process manager for Local LLM Advisor.

use chrono::{DateTime, Utc};
use domain::{AppError, FitResult, KvType, RunningInstanceInfo, ServeConfig};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::io::{BufRead, BufReader};
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};
use tracing::{info, warn};

/// Maximum number of log lines retained per instance.
pub const MAX_LOG_LINES: usize = 300;

/// State of the inference sidecar pool.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum ServerState {
    Stopped,
    Starting {
        model_id: String,
        port: u16,
        started_at: DateTime<Utc>,
    },
    Serving {
        model_id: String,
        model_path: PathBuf,
        port: u16,
        context_size: u32,
        started_at: DateTime<Utc>,
        #[serde(default)]
        instances: Vec<RunningInstanceInfo>,
    },
    Error {
        reason: String,
        stderr_tail: Vec<String>,
    },
}

/// A running sidecar process record.
struct RunningProcess {
    model_id: String,
    model_path: PathBuf,
    port: u16,
    context_size: u32,
    started_at: DateTime<Utc>,
    child: Child,
    logs: Arc<RwLock<VecDeque<String>>>,
}

/// Multi-instance Server Manager configuration and process pool controller.
pub struct ServerManager {
    sidecar_path: PathBuf,
    state: Arc<RwLock<ServerState>>,
    instances: Arc<Mutex<HashMap<String, RunningProcess>>>,
    primary_model_id: Arc<RwLock<Option<String>>>,
    global_logs: Arc<RwLock<VecDeque<String>>>,
}

impl ServerManager {
    /// Initialize a new server manager pointing to the sidecar executable path.
    pub fn new(sidecar_path: PathBuf) -> Self {
        Self {
            sidecar_path,
            state: Arc::new(RwLock::new(ServerState::Stopped)),
            instances: Arc::new(Mutex::new(HashMap::new())),
            primary_model_id: Arc::new(RwLock::new(None)),
            global_logs: Arc::new(RwLock::new(VecDeque::with_capacity(MAX_LOG_LINES))),
        }
    }

    /// Helper to synchronize and compute the current ServerState.
    fn refresh_state(&self) -> ServerState {
        let instances = self.instances.lock().unwrap();
        if instances.is_empty() {
            let current = self.state.read().unwrap().clone();
            match current {
                ServerState::Starting { .. } | ServerState::Error { .. } => current,
                _ => ServerState::Stopped,
            }
        } else {
            let primary_id = self.primary_model_id.read().unwrap().clone();
            let primary_proc = primary_id
                .as_ref()
                .and_then(|id| instances.get(id))
                .or_else(|| instances.values().next());

            let running_infos: Vec<RunningInstanceInfo> = instances
                .values()
                .map(|p| RunningInstanceInfo {
                    model_id: p.model_id.clone(),
                    model_path: p.model_path.clone(),
                    port: p.port,
                    context_size: p.context_size,
                    started_at: p.started_at,
                })
                .collect();

            if let Some(p) = primary_proc {
                ServerState::Serving {
                    model_id: p.model_id.clone(),
                    model_path: p.model_path.clone(),
                    port: p.port,
                    context_size: p.context_size,
                    started_at: p.started_at,
                    instances: running_infos,
                }
            } else {
                ServerState::Stopped
            }
        }
    }

    /// Get current server pool state.
    pub fn get_state(&self) -> ServerState {
        let computed = self.refresh_state();
        let mut st = self.state.write().unwrap();
        *st = computed.clone();
        computed
    }

    /// Check if currently serving and return active/primary internal port.
    pub fn get_active_port(&self) -> Option<u16> {
        let instances = self.instances.lock().unwrap();
        let primary_id = self.primary_model_id.read().unwrap().clone();
        primary_id
            .as_ref()
            .and_then(|id| instances.get(id))
            .or_else(|| instances.values().next())
            .map(|p| p.port)
    }

    /// Intelligently look up the internal port for a requested model name.
    /// Handles exact match, case-insensitive match, partial substring match, and fallback.
    pub fn get_port_for_model(&self, requested_model: Option<&str>) -> Option<u16> {
        let instances = self.instances.lock().unwrap();
        if instances.is_empty() {
            return None;
        }

        let model_name = requested_model.map(|s| s.trim()).filter(|s| !s.is_empty());
        match model_name {
            None | Some("default") | Some("active") => {
                // Return primary model
                let primary_id = self.primary_model_id.read().unwrap().clone();
                primary_id
                    .as_ref()
                    .and_then(|id| instances.get(id))
                    .or_else(|| instances.values().next())
                    .map(|p| p.port)
            }
            Some(req) => {
                // 1. Exact match
                if let Some(p) = instances.get(req) {
                    return Some(p.port);
                }

                // 2. Case-insensitive exact match
                if let Some(p) = instances
                    .values()
                    .find(|p| p.model_id.eq_ignore_ascii_case(req))
                {
                    return Some(p.port);
                }

                // 3. Substring match (e.g. "smollm2" matches "smollm2-135m-instruct-q8_0")
                let req_lower = req.to_lowercase();
                if let Some(p) = instances
                    .values()
                    .find(|p| p.model_id.to_lowercase().contains(&req_lower) || req_lower.contains(&p.model_id.to_lowercase()))
                {
                    return Some(p.port);
                }

                // 4. If exactly ONE instance is running, route generic client requests (like "gpt-4" or "qwen") to it
                if instances.len() == 1 {
                    return instances.values().next().map(|p| p.port);
                }

                None
            }
        }
    }

    /// Get currently loaded primary model id if serving or starting.
    pub fn get_active_model_id(&self) -> Option<String> {
        let instances = self.instances.lock().unwrap();
        let primary_id = self.primary_model_id.read().unwrap().clone();
        primary_id
            .or_else(|| instances.values().next().map(|p| p.model_id.clone()))
    }

    /// Get a list of all currently running model IDs.
    pub fn get_running_model_ids(&self) -> Vec<String> {
        let instances = self.instances.lock().unwrap();
        instances.keys().cloned().collect()
    }

    /// List all running instances with runtime metadata.
    pub fn list_instances(&self) -> Vec<RunningInstanceInfo> {
        let instances = self.instances.lock().unwrap();
        instances
            .values()
            .map(|p| RunningInstanceInfo {
                model_id: p.model_id.clone(),
                model_path: p.model_path.clone(),
                port: p.port,
                context_size: p.context_size,
                started_at: p.started_at,
            })
            .collect()
    }

    /// Get recent log lines (global or primary instance).
    pub fn get_logs(&self) -> Vec<String> {
        self.global_logs.read().unwrap().iter().cloned().collect()
    }

    /// Get recent log lines for a specific model instance.
    pub fn get_logs_for_model(&self, model_id: &str) -> Vec<String> {
        let instances = self.instances.lock().unwrap();
        if let Some(p) = instances.get(model_id) {
            p.logs.read().unwrap().iter().cloned().collect()
        } else {
            self.get_logs()
        }
    }

    /// Find an available localhost port.
    pub fn find_free_port() -> u16 {
        TcpListener::bind("127.0.0.1:0")
            .and_then(|l| l.local_addr())
            .map(|a| a.port())
            .unwrap_or(18080)
    }

    /// Start serving a model instance with given configuration and fit parameters.
    pub async fn start_server(
        &self,
        model_id: String,
        model_path: PathBuf,
        cfg: ServeConfig,
        fit: Option<FitResult>,
    ) -> Result<u16, AppError> {
        // If this model is already running, set it as primary and return its existing port
        {
            let instances = self.instances.lock().unwrap();
            if let Some(existing) = instances.get(&model_id) {
                *self.primary_model_id.write().unwrap() = Some(model_id.clone());
                info!(
                    "Model {} is already running on port {}, selected as primary",
                    model_id, existing.port
                );
                return Ok(existing.port);
            }
        }

        if !model_path.exists() {
            return Err(AppError::ServerSpawn(format!(
                "Model file not found: {:?}",
                model_path
            )));
        }

        if !self.sidecar_path.exists() {
            return Err(AppError::ServerSpawn(format!(
                "llama-server sidecar binary not found at {:?}",
                self.sidecar_path
            )));
        }

        let port = Self::find_free_port();
        let ctx = cfg.context_size;
        let slots = cfg.n_parallel.max(1);

        let mut cmd = Command::new(&self.sidecar_path);
        cmd.arg("-m")
            .arg(&model_path)
            .arg("--port")
            .arg(port.to_string())
            .arg("--host")
            .arg("127.0.0.1")
            .arg("-c")
            .arg(ctx.to_string())
            .arg("-np")
            .arg(slots.to_string());

        match cfg.kv_type {
            KvType::Q4_0 => {
                cmd.arg("-ctk").arg("q4_0").arg("-ctv").arg("q4_0");
            }
            KvType::Q8_0 => {
                cmd.arg("-ctk").arg("q8_0").arg("-ctv").arg("q8_0");
            }
            KvType::F16 => {
                cmd.arg("-ctk").arg("f16").arg("-ctv").arg("f16");
            }
        }

        let recommended_layers = fit.as_ref().map(|f| f.recommended_gpu_layers).unwrap_or(0);
        let layers = cfg.n_gpu_layers.unwrap_or(recommended_layers);
        if layers > 0 {
            cmd.arg("-ngl").arg(layers.to_string());
        }

        if let Some(parent) = self.sidecar_path.parent() {
            let current_ld = std::env::var("LD_LIBRARY_PATH").unwrap_or_default();
            let new_ld = format!("{}:{}", parent.display(), current_ld);
            cmd.env("LD_LIBRARY_PATH", new_ld);

            let current_dyld = std::env::var("DYLD_LIBRARY_PATH").unwrap_or_default();
            let new_dyld = format!("{}:{}", parent.display(), current_dyld);
            cmd.env("DYLD_LIBRARY_PATH", new_dyld);
        }

        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        info!("Spawning llama-server for {} on 127.0.0.1:{}", model_id, port);
        let mut child = cmd.spawn().map_err(|e| {
            AppError::ServerSpawn(format!("Failed to execute sidecar process: {}", e))
        })?;

        let started_at = Utc::now();
        *self.state.write().unwrap() = ServerState::Starting {
            model_id: model_id.clone(),
            port,
            started_at,
        };

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let instance_logs = Arc::new(RwLock::new(VecDeque::with_capacity(MAX_LOG_LINES)));
        let global_logs_clone = self.global_logs.clone();
        let inst_logs_clone = instance_logs.clone();

        if let Some(out) = stdout {
            let g_logs = global_logs_clone.clone();
            let i_logs = inst_logs_clone.clone();
            let prefix = format!("[{}] ", model_id);
            std::thread::spawn(move || {
                let reader = BufReader::new(out);
                for line in reader.lines().map_while(Result::ok) {
                    let formatted = format!("{}{}", prefix, line);
                    {
                        let mut gl = g_logs.write().unwrap();
                        if gl.len() >= MAX_LOG_LINES {
                            gl.pop_front();
                        }
                        gl.push_back(formatted.clone());
                    }
                    {
                        let mut il = i_logs.write().unwrap();
                        if il.len() >= MAX_LOG_LINES {
                            il.pop_front();
                        }
                        il.push_back(line);
                    }
                }
            });
        }

        if let Some(err) = stderr {
            let g_logs = global_logs_clone.clone();
            let i_logs = inst_logs_clone.clone();
            let prefix = format!("[{}] ", model_id);
            std::thread::spawn(move || {
                let reader = BufReader::new(err);
                for line in reader.lines().map_while(Result::ok) {
                    let formatted = format!("{}{}", prefix, line);
                    {
                        let mut gl = g_logs.write().unwrap();
                        if gl.len() >= MAX_LOG_LINES {
                            gl.pop_front();
                        }
                        gl.push_back(formatted);
                    }
                    {
                        let mut il = i_logs.write().unwrap();
                        if il.len() >= MAX_LOG_LINES {
                            il.pop_front();
                        }
                        il.push_back(line);
                    }
                }
            });
        }

        let health_url = format!("http://127.0.0.1:{}/health", port);
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(1500))
            .build()
            .map_err(|e| AppError::ServerSpawn(e.to_string()))?;

        let model_size_gb = std::fs::metadata(&model_path)
            .map(|m| m.len() / (1024 * 1024 * 1024))
            .unwrap_or(4);
        let timeout_secs = match model_size_gb {
            0..=4 => 60,
            5..=20 => 120,
            21..=50 => 240,
            _ => 300,
        };

        let start_time = Instant::now();
        let timeout = Duration::from_secs(timeout_secs);
        let mut ready = false;

        while start_time.elapsed() < timeout {
            if let Ok(Some(status)) = child.try_wait() {
                let stderr_tail: Vec<String> =
                    self.get_logs().into_iter().rev().take(15).collect();
                let reason = format!(
                    "llama-server for {} exited unexpectedly with status {}",
                    model_id, status
                );
                *self.state.write().unwrap() = ServerState::Error {
                    reason: reason.clone(),
                    stderr_tail,
                };
                return Err(AppError::ServerCrash(reason));
            }

            match client.get(&health_url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    ready = true;
                    break;
                }
                _ => {
                    tokio::time::sleep(Duration::from_millis(300)).await;
                }
            }
        }

        if !ready {
            let _ = Self::terminate_child(&mut child).await;
            let stderr_tail: Vec<String> = self.get_logs().into_iter().rev().take(15).collect();
            *self.state.write().unwrap() = ServerState::Error {
                reason: format!("Health check for {} timed out after {}s", model_id, timeout_secs),
                stderr_tail,
            };
            return Err(AppError::ServerHealthTimeout);
        }

        info!(
            "llama-server instance for {} reached Serving state on 127.0.0.1:{}",
            model_id, port
        );

        let process = RunningProcess {
            model_id: model_id.clone(),
            model_path: model_path.clone(),
            port,
            context_size: ctx,
            started_at: Utc::now(),
            child,
            logs: instance_logs,
        };

        {
            let mut instances = self.instances.lock().unwrap();
            instances.insert(model_id.clone(), process);
        }
        *self.primary_model_id.write().unwrap() = Some(model_id);

        let _ = self.get_state();
        Ok(port)
    }

    /// Terminate a child process gracefully.
    async fn terminate_child(child: &mut Child) -> Result<(), AppError> {
        info!("Terminating llama-server process (PID: {})...", child.id());

        #[cfg(unix)]
        {
            unsafe {
                libc::kill(child.id() as i32, libc::SIGTERM);
            }
        }
        #[cfg(not(unix))]
        {
            let _ = child.kill();
        }

        let start = Instant::now();
        let mut exited = false;
        while start.elapsed() < Duration::from_secs(5) {
            if let Ok(Some(_)) = child.try_wait() {
                exited = true;
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        if !exited {
            warn!("Process did not exit after SIGTERM, sending SIGKILL...");
            let _ = child.kill();
            let _ = child.wait();
        }

        Ok(())
    }

    /// Stop a specific running model instance.
    pub async fn stop_instance(&self, model_id: &str) -> Result<(), AppError> {
        let mut proc_opt = {
            let mut instances = self.instances.lock().unwrap();
            instances.remove(model_id)
        };

        if let Some(mut proc) = proc_opt.take() {
            Self::terminate_child(&mut proc.child).await?;
        }

        {
            let mut primary = self.primary_model_id.write().unwrap();
            if primary.as_deref() == Some(model_id) {
                let instances = self.instances.lock().unwrap();
                *primary = instances.keys().next().cloned();
            }
        }

        let _ = self.get_state();
        Ok(())
    }

    /// Stop all running inference sidecar processes gracefully.
    pub async fn stop_all(&self) -> Result<(), AppError> {
        let mut procs: Vec<RunningProcess> = {
            let mut instances = self.instances.lock().unwrap();
            instances.drain().map(|(_, v)| v).collect()
        };

        for mut proc in procs.drain(..) {
            let _ = Self::terminate_child(&mut proc.child).await;
        }

        *self.primary_model_id.write().unwrap() = None;
        *self.state.write().unwrap() = ServerState::Stopped;
        Ok(())
    }

    /// Legacy alias for stop_all().
    pub async fn stop_server(&self) -> Result<(), AppError> {
        self.stop_all().await
    }
}

impl Drop for ServerManager {
    fn drop(&mut self) {
        if let Ok(mut instances) = self.instances.lock() {
            for (_, mut proc) in instances.drain() {
                let _ = proc.child.kill();
                let _ = proc.child.wait();
            }
        }
    }
}
