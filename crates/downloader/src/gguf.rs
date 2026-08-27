//! Lightweight binary parser for GGUF metadata headers and catalog cross-verification.

use domain::{AppError, CatalogEntry};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read, Seek};
use std::path::Path;
use tracing::{info, warn};

/// GGUF value types according to the GGUF binary specification.
#[derive(Debug, Clone, PartialEq)]
pub enum GgufValue {
    Uint8(u8),
    Int8(i8),
    Uint16(u16),
    Int16(i16),
    Uint32(u32),
    Int32(i32),
    Float32(f32),
    Bool(bool),
    String(String),
    Array(Vec<GgufValue>),
    Uint64(u64),
    Int64(i64),
    Float64(f64),
}

impl GgufValue {
    pub fn as_u32(&self) -> Option<u32> {
        match self {
            GgufValue::Uint32(v) => Some(*v),
            GgufValue::Uint64(v) => u32::try_from(*v).ok(),
            GgufValue::Int32(v) if *v >= 0 => Some(*v as u32),
            GgufValue::Int64(v) if *v >= 0 => u32::try_from(*v).ok(),
            GgufValue::Uint16(v) => Some(*v as u32),
            GgufValue::Uint8(v) => Some(*v as u32),
            _ => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            GgufValue::String(s) => Some(s.as_str()),
            _ => None,
        }
    }
}

/// Extracted architectural metadata from the GGUF header.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct GgufHeaderMetadata {
    pub architecture: Option<String>,
    pub n_layers: Option<u32>,
    pub n_kv_heads: Option<u32>,
    pub n_heads: Option<u32>,
    pub head_dim: Option<u32>,
    pub context_train: Option<u32>,
    pub embedding_length: Option<u32>,
    pub raw_metadata: HashMap<String, GgufValue>,
}

fn read_u8<R: Read>(r: &mut R) -> Result<u8, AppError> {
    let mut buf = [0u8; 1];
    r.read_exact(&mut buf)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(buf[0])
}

fn read_i8<R: Read>(r: &mut R) -> Result<i8, AppError> {
    let mut buf = [0u8; 1];
    r.read_exact(&mut buf)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(buf[0] as i8)
}

fn read_u16<R: Read>(r: &mut R) -> Result<u16, AppError> {
    let mut buf = [0u8; 2];
    r.read_exact(&mut buf)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(u16::from_le_bytes(buf))
}

fn read_i16<R: Read>(r: &mut R) -> Result<i16, AppError> {
    let mut buf = [0u8; 2];
    r.read_exact(&mut buf)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(i16::from_le_bytes(buf))
}

fn read_u32<R: Read>(r: &mut R) -> Result<u32, AppError> {
    let mut buf = [0u8; 4];
    r.read_exact(&mut buf)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(u32::from_le_bytes(buf))
}

fn read_i32<R: Read>(r: &mut R) -> Result<i32, AppError> {
    let mut buf = [0u8; 4];
    r.read_exact(&mut buf)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(i32::from_le_bytes(buf))
}

fn read_f32<R: Read>(r: &mut R) -> Result<f32, AppError> {
    let mut buf = [0u8; 4];
    r.read_exact(&mut buf)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(f32::from_le_bytes(buf))
}

fn read_u64<R: Read>(r: &mut R) -> Result<u64, AppError> {
    let mut buf = [0u8; 8];
    r.read_exact(&mut buf)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(u64::from_le_bytes(buf))
}

fn read_i64<R: Read>(r: &mut R) -> Result<i64, AppError> {
    let mut buf = [0u8; 8];
    r.read_exact(&mut buf)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(i64::from_le_bytes(buf))
}

fn read_f64<R: Read>(r: &mut R) -> Result<f64, AppError> {
    let mut buf = [0u8; 8];
    r.read_exact(&mut buf)
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(f64::from_le_bytes(buf))
}

fn read_string<R: Read>(r: &mut R) -> Result<String, AppError> {
    let len = read_u64(r)? as usize;
    if len > 10 * 1024 * 1024 {
        return Err(AppError::CatalogParse(format!(
            "GGUF string exceeds reasonable max length ({} bytes)",
            len
        )));
    }
    let mut buf = vec![0u8; len];
    r.read_exact(&mut buf)
        .map_err(|e| AppError::Io(e.to_string()))?;
    String::from_utf8(buf)
        .map_err(|e| AppError::CatalogParse(format!("Invalid GGUF UTF-8 string: {}", e)))
}

fn read_value<R: Read>(r: &mut R, value_type: u32) -> Result<GgufValue, AppError> {
    match value_type {
        0 => Ok(GgufValue::Uint8(read_u8(r)?)),
        1 => Ok(GgufValue::Int8(read_i8(r)?)),
        2 => Ok(GgufValue::Uint16(read_u16(r)?)),
        3 => Ok(GgufValue::Int16(read_i16(r)?)),
        4 => Ok(GgufValue::Uint32(read_u32(r)?)),
        5 => Ok(GgufValue::Int32(read_i32(r)?)),
        6 => Ok(GgufValue::Float32(read_f32(r)?)),
        7 => Ok(GgufValue::Bool(read_u8(r)? != 0)),
        8 => Ok(GgufValue::String(read_string(r)?)),
        9 => {
            let elem_type = read_u32(r)?;
            let array_len = read_u64(r)? as usize;
            if array_len > 100_000 {
                return Err(AppError::CatalogParse(format!(
                    "GGUF array length {} exceeds sanity threshold",
                    array_len
                )));
            }
            let mut elements = Vec::with_capacity(array_len);
            for _ in 0..array_len {
                elements.push(read_value(r, elem_type)?);
            }
            Ok(GgufValue::Array(elements))
        }
        10 => Ok(GgufValue::Uint64(read_u64(r)?)),
        11 => Ok(GgufValue::Int64(read_i64(r)?)),
        12 => Ok(GgufValue::Float64(read_f64(r)?)),
        other => Err(AppError::CatalogParse(format!(
            "Unsupported GGUF value type ID: {}",
            other
        ))),
    }
}

/// Parse GGUF header metadata from any `Read + Seek` stream.
pub fn parse_gguf_metadata<R: Read + Seek>(mut reader: R) -> Result<GgufHeaderMetadata, AppError> {
    let mut magic = [0u8; 4];
    reader
        .read_exact(&mut magic)
        .map_err(|e| AppError::Io(e.to_string()))?;

    if &magic != b"GGUF" {
        return Err(AppError::CatalogParse(format!(
            "Invalid GGUF magic bytes: {:?}",
            magic
        )));
    }

    let version = read_u32(&mut reader)?;
    if version != 2 && version != 3 {
        warn!("GGUF version is {}, expected 2 or 3", version);
    }

    let _tensor_count = read_u64(&mut reader)?;
    let metadata_kv_count = read_u64(&mut reader)?;

    let mut raw_metadata = HashMap::new();
    for _ in 0..metadata_kv_count {
        let key = read_string(&mut reader)?;
        let val_type = read_u32(&mut reader)?;
        let val = read_value(&mut reader, val_type)?;
        raw_metadata.insert(key, val);
    }

    let architecture = raw_metadata
        .get("general.architecture")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let arch = architecture.as_deref().unwrap_or("llama");

    let n_layers = raw_metadata
        .get(&format!("{}.block_count", arch))
        .or_else(|| raw_metadata.get(&format!("{}.layer_count", arch)))
        .and_then(|v| v.as_u32());

    let n_kv_heads = raw_metadata
        .get(&format!("{}.attention.head_count_kv", arch))
        .and_then(|v| v.as_u32());

    let n_heads = raw_metadata
        .get(&format!("{}.attention.head_count", arch))
        .and_then(|v| v.as_u32());

    let head_dim = raw_metadata
        .get(&format!("{}.attention.key_length", arch))
        .or_else(|| raw_metadata.get(&format!("{}.attention.value_length", arch)))
        .and_then(|v| v.as_u32());

    let context_train = raw_metadata
        .get(&format!("{}.context_length", arch))
        .and_then(|v| v.as_u32());

    let embedding_length = raw_metadata
        .get(&format!("{}.embedding_length", arch))
        .and_then(|v| v.as_u32());

    Ok(GgufHeaderMetadata {
        architecture,
        n_layers,
        n_kv_heads,
        n_heads,
        head_dim,
        context_train,
        embedding_length,
        raw_metadata,
    })
}

/// Read and parse GGUF header metadata directly from a file path.
pub fn parse_gguf_file(path: &Path) -> Result<GgufHeaderMetadata, AppError> {
    let file = File::open(path).map_err(|e| AppError::Io(e.to_string()))?;
    let reader = BufReader::new(file);
    parse_gguf_metadata(reader)
}

/// Cross-check parsed GGUF header metadata against catalog entry records.
pub fn verify_gguf_against_catalog(
    header: &GgufHeaderMetadata,
    entry: &CatalogEntry,
) -> Result<(), AppError> {
    if let Some(n_layers) = header.n_layers {
        if n_layers != entry.n_layers {
            return Err(AppError::CatalogParse(format!(
                "GGUF layer count mismatch: file has {} layers, catalog has {}",
                n_layers, entry.n_layers
            )));
        }
    }

    if let Some(n_kv_heads) = header.n_kv_heads {
        if n_kv_heads != entry.n_kv_heads {
            return Err(AppError::CatalogParse(format!(
                "GGUF KV heads (GQA) mismatch: file has {} KV heads, catalog has {}",
                n_kv_heads, entry.n_kv_heads
            )));
        }
    }

    if let Some(head_dim) = header.head_dim {
        if head_dim != entry.head_dim {
            return Err(AppError::CatalogParse(format!(
                "GGUF head_dim mismatch: file has {}, catalog has {}",
                head_dim, entry.head_dim
            )));
        }
    }

    info!(
        "GGUF header cross-check verified successfully for model '{}'",
        entry.id
    );
    Ok(())
}
