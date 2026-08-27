//! Local model library store and disk reconciliation for Local LLM Advisor.

use domain::{AppError, ModelRecord};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Reconciliation report from scanning the models directory against library records.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LibraryReconciliation {
    pub valid_records: Vec<ModelRecord>,
    pub missing_records: Vec<ModelRecord>,
    pub orphan_files: Vec<PathBuf>,
}

/// Thread-safe local model library store.
pub struct LibraryStore {
    base_dir: PathBuf,
    models_dir: PathBuf,
    records_file: PathBuf,
    lock: Mutex<()>,
}

impl LibraryStore {
    /// Initialize a new library store rooted at the given base directory.
    pub fn new(base_dir: PathBuf) -> Result<Self, AppError> {
        let models_dir = base_dir.join("models");
        let records_file = base_dir.join("library.json");

        fs::create_dir_all(&models_dir).map_err(|e| AppError::Io(e.to_string()))?;

        Ok(Self {
            base_dir,
            models_dir,
            records_file,
            lock: Mutex::new(()),
        })
    }

    pub fn models_dir(&self) -> &Path {
        &self.models_dir
    }

    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }

    /// Read all records from the library.json file.
    fn read_records_unlocked(&self) -> Result<Vec<ModelRecord>, AppError> {
        if !self.records_file.exists() {
            return Ok(Vec::new());
        }

        let content =
            fs::read_to_string(&self.records_file).map_err(|e| AppError::Io(e.to_string()))?;

        if content.trim().is_empty() {
            return Ok(Vec::new());
        }

        let records: Vec<ModelRecord> =
            serde_json::from_str(&content).map_err(|e| AppError::Json(e.to_string()))?;

        Ok(records)
    }

    /// Write all records atomically to the library.json file.
    fn write_records_unlocked(&self, records: &[ModelRecord]) -> Result<(), AppError> {
        let tmp_file = self.base_dir.join("library.json.tmp");
        let json_str =
            serde_json::to_string_pretty(records).map_err(|e| AppError::Json(e.to_string()))?;

        {
            let mut file = File::create(&tmp_file).map_err(|e| AppError::Io(e.to_string()))?;
            file.write_all(json_str.as_bytes())
                .map_err(|e| AppError::Io(e.to_string()))?;
            file.flush().map_err(|e| AppError::Io(e.to_string()))?;
        }

        fs::rename(&tmp_file, &self.records_file).map_err(|e| AppError::Io(e.to_string()))?;
        Ok(())
    }

    /// Add or update a verified model record in the store.
    pub fn add_verified(&self, record: ModelRecord) -> Result<(), AppError> {
        let _guard = self.lock.lock().unwrap();
        let mut records = self.read_records_unlocked()?;

        // Replace existing record with same entry_id if present
        if let Some(pos) = records.iter().position(|r| r.entry_id == record.entry_id) {
            records[pos] = record;
        } else {
            records.push(record);
        }

        self.write_records_unlocked(&records)?;
        Ok(())
    }

    /// List all model records.
    pub fn list(&self) -> Result<Vec<ModelRecord>, AppError> {
        let _guard = self.lock.lock().unwrap();
        self.read_records_unlocked()
    }

    /// Get a specific model record by entry_id.
    pub fn get(&self, entry_id: &str) -> Result<Option<ModelRecord>, AppError> {
        let _guard = self.lock.lock().unwrap();
        let records = self.read_records_unlocked()?;
        Ok(records.into_iter().find(|r| r.entry_id == entry_id))
    }

    /// Delete a model by entry_id, removing its file from disk and its metadata record.
    pub fn delete(&self, entry_id: &str) -> Result<bool, AppError> {
        let _guard = self.lock.lock().unwrap();
        let mut records = self.read_records_unlocked()?;

        let mut deleted = false;
        if let Some(pos) = records.iter().position(|r| r.entry_id == entry_id) {
            let record = records.remove(pos);
            if record.file_path.exists() {
                let _ = fs::remove_file(&record.file_path);
            }
            // Also check for standard file location
            let standard_path = self.models_dir.join(format!("{}.gguf", entry_id));
            if standard_path.exists() {
                let _ = fs::remove_file(&standard_path);
            }
            let part_path = self.models_dir.join(format!("{}.part", entry_id));
            if part_path.exists() {
                let _ = fs::remove_file(&part_path);
            }
            deleted = true;
        } else {
            // Check if file exists anyway and clean it up
            let standard_path = self.models_dir.join(format!("{}.gguf", entry_id));
            if standard_path.exists() {
                let _ = fs::remove_file(&standard_path);
                deleted = true;
            }
        }

        if deleted {
            self.write_records_unlocked(&records)?;
        }

        Ok(deleted)
    }

    /// Reconcile records with actual files in the models directory.
    pub fn reconcile(&self) -> Result<LibraryReconciliation, AppError> {
        let _guard = self.lock.lock().unwrap();
        let records = self.read_records_unlocked()?;

        let mut valid_records = Vec::new();
        let mut missing_records = Vec::new();
        let mut known_paths = Vec::new();

        for record in records {
            if record.file_path.exists() {
                known_paths
                    .push(fs::canonicalize(&record.file_path).unwrap_or(record.file_path.clone()));
                valid_records.push(record);
            } else {
                missing_records.push(record);
            }
        }

        // Find orphan files in models_dir
        let mut orphan_files = Vec::new();
        if let Ok(entries) = fs::read_dir(&self.models_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let canonical = fs::canonicalize(&path).unwrap_or(path.clone());
                    if !known_paths.contains(&canonical) {
                        orphan_files.push(path);
                    }
                }
            }
        }

        Ok(LibraryReconciliation {
            valid_records,
            missing_records,
            orphan_files,
        })
    }

    /// Prune orphan files from the models directory.
    pub fn prune_orphans(&self, orphans: &[PathBuf]) -> Result<u64, AppError> {
        let mut reclaimed_bytes: u64 = 0;
        for path in orphans {
            if path.exists() {
                if let Ok(meta) = fs::metadata(path) {
                    reclaimed_bytes += meta.len();
                }
                let _ = fs::remove_file(path);
            }
        }
        Ok(reclaimed_bytes)
    }
}
