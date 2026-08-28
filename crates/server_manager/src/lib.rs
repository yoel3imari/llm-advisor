//! Supervised single-instance llama-server sidecar process manager for Local LLM Advisor.

use chrono::{DateTime, Utc};
use domain::{AppError, FitResult, KvType, ServeConfig};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::io::{BufRead, BufReader};
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};
use tracing::{info, warn};

/// Maximum number of log lines retained in memory.
pub const MAX_LOG_LINES: usize = 300;

/// State of the inference sidecar.
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
    },
    Error {
        reason: String,
        stderr_tail: Vec<String>,
    },
}

/// Server manager configuration and state controller.
pub struct ServerManager {
    sidecar_path: PathBuf,
    state: Arc<RwLock<ServerState>>,
    child: Arc<Mutex<Option<Child>>>,
    logs: Arc<RwLock<VecDeque<String>>>,
}

impl ServerManager {
    /// Initialize a new server manager pointing to the sidecar executable path.
    pub fn new(sidecar_path: PathBuf) -> Self {
        Self {
            sidecar_path,
            state: Arc::new(RwLock::new(ServerState::Stopped)),
            child: Arc::new(Mutex::new(None)),
            logs: Arc::new(RwLock::new(VecDeque::with_capacity(MAX_LOG_LINES))),
        }
    }

    /// Get current server state.
    pub fn get_state(&self) -> ServerState {
        self.state.read().unwrap().clone()
    }

    /// Check if currently serving and return active internal port.
    pub fn get_active_port(&self) -> Option<u16> {
        match *self.state.read().unwrap() {
            ServerState::Serving { port, .. } => Some(port),
            _ => None,
        }
    }

    /// Get currently loaded model id if serving or starting.
    pub fn get_active_model_id(&self) -> Option<String> {
        match &*self.state.read().unwrap() {
            ServerState::Serving { model_id, .. } => Some(model_id.clone()),
            ServerState::Starting { model_id, .. } => Some(model_id.clone()),
            _ => None,
        }
    }

    /// Get recent log lines.
    pub fn get_logs(&self) -> Vec<String> {
        self.logs.read().unwrap().iter().cloned().collect()
    }

    /// Find an available localhost port.
    pub fn find_free_port() -> u16 {
        TcpListener::bind("127.0.0.1:0")
            .and_then(|l| l.local_addr())
            .map(|a| a.port())
            .unwrap_or(18080)
    }

    /// Start serving a model with given configuration and fit parameters.
    pub async fn start_server(
        &self,
        model_id: String,
        model_path: PathBuf,
        cfg: ServeConfig,
        fit: Option<FitResult>,
    ) -> Result<u16, AppError> {
        self.stop_server().await?;

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

        info!("Spawning llama-server on 127.0.0.1:{}", port);
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
        let logs_clone = self.logs.clone();

        if let Some(out) = stdout {
            let logs_out = logs_clone.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(out);
                for line in reader.lines().map_while(Result::ok) {
                    let mut l = logs_out.write().unwrap();
                    if l.len() >= MAX_LOG_LINES {
                        l.pop_front();
                    }
                    l.push_back(line);
                }
            });
        }

        if let Some(err) = stderr {
            let logs_err = logs_clone.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(err);
                for line in reader.lines().map_while(Result::ok) {
                    let mut l = logs_err.write().unwrap();
                    if l.len() >= MAX_LOG_LINES {
                        l.pop_front();
                    }
                    l.push_back(line);
                }
            });
        }

        *self.child.lock().unwrap() = Some(child);

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
            {
                let mut child_lock = self.child.lock().unwrap();
                if let Some(ref mut c) = *child_lock {
                    if let Ok(Some(status)) = c.try_wait() {
                        let stderr_tail: Vec<String> =
                            self.get_logs().into_iter().rev().take(15).collect();
                        let reason = format!(
                            "llama-server process exited unexpectedly with status {}",
                            status
                        );
                        *self.state.write().unwrap() = ServerState::Error {
                            reason: reason.clone(),
                            stderr_tail,
                        };
                        return Err(AppError::ServerCrash(reason));
                    }
                }
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
            self.stop_server().await?;
            let stderr_tail: Vec<String> = self.get_logs().into_iter().rev().take(15).collect();
            *self.state.write().unwrap() = ServerState::Error {
                reason: format!("Health check timed out after {}s", timeout_secs),
                stderr_tail,
            };
            return Err(AppError::ServerHealthTimeout);
        }

        info!("llama-server reached Serving state on 127.0.0.1:{}", port);
        *self.state.write().unwrap() = ServerState::Serving {
            model_id,
            model_path,
            port,
            context_size: ctx,
            started_at: Utc::now(),
        };

        Ok(port)
    }

    /// Stop the currently running inference sidecar process gracefully.
    pub async fn stop_server(&self) -> Result<(), AppError> {
        let mut child_opt = self.child.lock().unwrap().take();
        if let Some(mut child) = child_opt.take() {
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
        }

        *self.state.write().unwrap() = ServerState::Stopped;
        Ok(())
    }
}

impl Drop for ServerManager {
    fn drop(&mut self) {
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
