//! Resumable chunked downloader with on-the-fly SHA256 verification for HuggingFace GGUF models.

use domain::{AppError, CatalogEntry};
use reqwest::header::{AUTHORIZATION, RANGE};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_util::sync::CancellationToken;
use tracing::info;

pub mod gguf;

/// Progress update callback signature.
pub type ProgressCallback = std::sync::Arc<dyn Fn(u64, u64) + Send + Sync>;

/// Configuration for a download job.
#[derive(Clone)]
pub struct DownloadOptions {
    pub entry: CatalogEntry,
    pub destination_dir: PathBuf,
    pub hf_token: Option<String>,
    pub base_url_override: Option<String>,
    pub cancel_token: Option<CancellationToken>,
    pub on_progress: Option<ProgressCallback>,
}

/// Computes the Hugging Face resolve URL for a catalog entry.
pub fn get_resolve_url(entry: &CatalogEntry, base_url_override: Option<&str>) -> String {
    if let Some(base) = base_url_override {
        format!("{}/{}", base.trim_end_matches('/'), entry.filename)
    } else {
        format!(
            "https://huggingface.co/{}/resolve/main/{}",
            entry.repo_id, entry.filename
        )
    }
}

/// Clean up quotes from ETag header string.
pub fn clean_etag(etag: &str) -> String {
    etag.trim().trim_matches('"').to_string()
}

/// Compute SHA256 checksum of an existing file asynchronously.
pub async fn compute_file_sha256(path: &Path) -> Result<String, AppError> {
    let mut file = File::open(path)
        .await
        .map_err(|e| AppError::Io(e.to_string()))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1024 * 1024]; // 1MB buffer

    loop {
        let n = file
            .read(&mut buffer)
            .await
            .map_err(|e| AppError::Io(e.to_string()))?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }

    Ok(hex::encode(hasher.finalize()))
}

/// Execute resumable download with SHA256 integrity verification.
pub async fn download_model(options: DownloadOptions) -> Result<PathBuf, AppError> {
    let entry = &options.entry;
    tokio::fs::create_dir_all(&options.destination_dir)
        .await
        .map_err(|e| AppError::Io(e.to_string()))?;

    let final_path = options.destination_dir.join(format!("{}.gguf", entry.id));
    let part_path = options.destination_dir.join(format!("{}.part", entry.id));

    // If final file already exists and matches SHA256, return immediately
    if final_path.exists() {
        if let Ok(existing_sha) = compute_file_sha256(&final_path).await {
            if existing_sha.eq_ignore_ascii_case(&entry.sha256) {
                info!("Model {} already downloaded and verified", entry.id);
                if let Some(ref cb) = options.on_progress {
                    cb(entry.file_size_bytes, entry.file_size_bytes);
                }
                return Ok(final_path);
            }
        }
    }

    let url = get_resolve_url(entry, options.base_url_override.as_deref());
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| AppError::DownloadNetwork(e.to_string()))?;

    // 1. Pre-flight HEAD request
    let mut head_req = client.head(&url);
    if let Some(ref token) = options.hf_token {
        head_req = head_req.header(AUTHORIZATION, format!("Bearer {}", token));
    } else if entry.gated {
        return Err(AppError::DownloadGatedNoToken);
    }

    let head_resp = head_req
        .send()
        .await
        .map_err(|e| AppError::DownloadNetwork(format!("Preflight HEAD failed: {}", e)))?;

    if head_resp.status() == reqwest::StatusCode::UNAUTHORIZED
        || head_resp.status() == reqwest::StatusCode::FORBIDDEN
    {
        return Err(AppError::DownloadGatedNoToken);
    }

    let header_len = head_resp.content_length().unwrap_or(0);
    let total_bytes = if header_len > 0 {
        header_len
    } else {
        entry.file_size_bytes
    };

    // 2. Check existing .part length for Range request
    let mut downloaded_bytes: u64 = 0;
    if part_path.exists() {
        if let Ok(meta) = tokio::fs::metadata(&part_path).await {
            downloaded_bytes = meta.len();
        }
    }

    // 3. Initiate GET request (with Range if resuming)
    let mut get_req = client.get(&url);
    if let Some(ref token) = options.hf_token {
        get_req = get_req.header(AUTHORIZATION, format!("Bearer {}", token));
    }
    if downloaded_bytes > 0 && downloaded_bytes < total_bytes {
        get_req = get_req.header(RANGE, format!("bytes={}-", downloaded_bytes));
    }

    if downloaded_bytes < total_bytes {
        let mut response = get_req
            .send()
            .await
            .map_err(|e| AppError::DownloadNetwork(format!("GET stream request failed: {}", e)))?;

        let status = response.status();
        if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
            return Err(AppError::DownloadGatedNoToken);
        }

        let is_partial = status == reqwest::StatusCode::PARTIAL_CONTENT;
        let mut file = if is_partial && downloaded_bytes > 0 {
            OpenOptions::new()
                .write(true)
                .append(true)
                .open(&part_path)
                .await
                .map_err(|e| AppError::Io(e.to_string()))?
        } else {
            downloaded_bytes = 0;
            File::create(&part_path)
                .await
                .map_err(|e| AppError::Io(e.to_string()))?
        };

        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|e| AppError::DownloadNetwork(format!("Stream read error: {}", e)))?
        {
            if let Some(ref cancel) = options.cancel_token {
                if cancel.is_cancelled() {
                    return Err(AppError::DownloadNetwork(
                        "Download cancelled by user".to_string(),
                    ));
                }
            }

            file.write_all(&chunk)
                .await
                .map_err(|e| AppError::Io(e.to_string()))?;

            downloaded_bytes += chunk.len() as u64;
            if let Some(ref cb) = options.on_progress {
                cb(downloaded_bytes, total_bytes);
            }
        }
        file.flush()
            .await
            .map_err(|e| AppError::Io(e.to_string()))?;
    }

    // 4. SHA256 Verification
    let computed_sha256 = compute_file_sha256(&part_path).await?;
    if !computed_sha256.eq_ignore_ascii_case(&entry.sha256) {
        // Checksum mismatch -> delete corrupted part file and return typed error
        let _ = tokio::fs::remove_file(&part_path).await;
        return Err(AppError::DownloadChecksum {
            expected: entry.sha256.clone(),
            actual: computed_sha256,
        });
    }

    // 4b. GGUF header cross-check if file is a valid GGUF binary
    if let Ok(header) = gguf::parse_gguf_file(&part_path) {
        if let Err(e) = gguf::verify_gguf_against_catalog(&header, entry) {
            tracing::warn!(
                "GGUF header cross-check discrepancy for {}: {}",
                entry.id,
                e
            );
        }
    }

    // 5. Rename .part -> .gguf
    tokio::fs::rename(&part_path, &final_path)
        .await
        .map_err(|e| AppError::Io(e.to_string()))?;

    info!("Successfully downloaded and verified {}", entry.id);
    Ok(final_path)
}
