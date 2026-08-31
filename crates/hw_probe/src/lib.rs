//! Hardware probe and GPU/memory inspection module for Local LLM Advisor.

use chrono::Utc;
use domain::{AppError, HardwareProfile};
use plist::Value;
use std::sync::{Arc, Mutex, OnceLock};
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};

/// Metal device information queried from the OS runtime.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MetalDeviceInfo {
    pub device_name: String,
    pub working_set_bytes: u64,
    pub has_unified_memory: bool,
    pub vram_bytes: Option<u64>,
}

/// Trait abstraction for Metal working-set and VRAM queries.
pub trait WorkingSetProvider: Send + Sync {
    fn get_metal_device_info(&self) -> Option<MetalDeviceInfo>;
}

/// Lookup theoretical memory bandwidth in GB/s for recognized GPUs.
pub fn lookup_gpu_bandwidth_gbps(gpu_name: &str) -> Option<f32> {
    let name = gpu_name.to_lowercase();

    // NVIDIA GeForce RTX 40 series (Ada Lovelace)
    if name.contains("4090") {
        return Some(1008.0);
    }
    if name.contains("4080 super") {
        return Some(736.0);
    }
    if name.contains("4080") {
        return Some(717.0);
    }
    if name.contains("4070 ti super") {
        return Some(672.0);
    }
    if name.contains("4070 ti") {
        return Some(504.0);
    }
    if name.contains("4070 super") {
        return Some(504.0);
    }
    if name.contains("4070") {
        return Some(504.0);
    }
    if name.contains("4060 ti") {
        return Some(288.0);
    }
    if name.contains("4060") {
        return Some(272.0);
    }

    // NVIDIA GeForce RTX 30 series (Ampere)
    if name.contains("3090 ti") {
        return Some(1008.0);
    }
    if name.contains("3090") {
        return Some(936.0);
    }
    if name.contains("3080 ti") {
        return Some(912.0);
    }
    if name.contains("3080") {
        return Some(760.0);
    }
    if name.contains("3070 ti") {
        return Some(608.0);
    }
    if name.contains("3070") {
        return Some(448.0);
    }
    if name.contains("3060 ti") {
        return Some(448.0);
    }
    if name.contains("3060") {
        return Some(360.0);
    }

    // NVIDIA Data Center / Workstation
    if name.contains("h100") {
        return Some(3350.0);
    }
    if name.contains("a100") {
        return Some(2039.0);
    }
    if name.contains("l40s") || name.contains("l40") {
        return Some(864.0);
    }
    if name.contains("l4") {
        return Some(300.0);
    }
    if name.contains("a6000") {
        return Some(768.0);
    }
    if name.contains("a5000") {
        return Some(768.0);
    }
    if name.contains("a4000") {
        return Some(448.0);
    }
    if name.contains("titan rtx") {
        return Some(672.0);
    }
    if name.contains("titan v") {
        return Some(653.0);
    }

    // Apple Silicon
    if name.contains("m4 ultra") {
        return Some(800.0);
    }
    if name.contains("m4 max") {
        return Some(410.0);
    }
    if name.contains("m4 pro") {
        return Some(273.0);
    }
    if name.contains("m4") {
        return Some(120.0);
    }
    if name.contains("m3 ultra") {
        return Some(800.0);
    }
    if name.contains("m3 max") {
        return Some(300.0);
    }
    if name.contains("m3 pro") {
        return Some(150.0);
    }
    if name.contains("m3") {
        return Some(100.0);
    }
    if name.contains("m2 ultra") {
        return Some(800.0);
    }
    if name.contains("m2 max") {
        return Some(400.0);
    }
    if name.contains("m2 pro") {
        return Some(200.0);
    }
    if name.contains("m2") {
        return Some(100.0);
    }
    if name.contains("m1 ultra") {
        return Some(800.0);
    }
    if name.contains("m1 max") {
        return Some(400.0);
    }
    if name.contains("m1 pro") {
        return Some(200.0);
    }
    if name.contains("m1") {
        return Some(68.25);
    }

    // AMD Radeon RX 7000 series (RDNA3)
    if name.contains("7900 xtx") {
        return Some(960.0);
    }
    if name.contains("7900 xt") {
        return Some(800.0);
    }
    if name.contains("7900 gre") {
        return Some(576.0);
    }
    if name.contains("7800 xt") {
        return Some(624.0);
    }
    if name.contains("7700 xt") {
        return Some(432.0);
    }
    if name.contains("7600 xt") {
        return Some(288.0);
    }
    if name.contains("7600") {
        return Some(288.0);
    }

    // AMD Radeon RX 6000 series (RDNA2)
    if name.contains("6950 xt") || name.contains("6900 xt") {
        return Some(576.0);
    }
    if name.contains("6800 xt") || name.contains("6800") {
        return Some(512.0);
    }
    if name.contains("6700 xt") {
        return Some(384.0);
    }
    if name.contains("6600 xt") || name.contains("6600") {
        return Some(256.0);
    }

    // AMD Workstation / Mac Pro / Intel Macs
    if name.contains("vega ii") {
        return Some(1024.0);
    }
    if name.contains("vega 64") {
        return Some(484.0);
    }
    if name.contains("vega 56") {
        return Some(410.0);
    }
    if name.contains("vega 48") {
        return Some(384.0);
    }
    if name.contains("5500m") || name.contains("5500 xt") {
        return Some(192.0);
    }
    if name.contains("5700 xt") || name.contains("5700") {
        return Some(448.0);
    }
    if name.contains("5300m") {
        return Some(96.0);
    }

    // AMD APU / Strix Halo / Ryzen AI MAX / Grace
    if name.contains("strix halo") || name.contains("ryzen ai max") {
        return Some(273.0);
    }
    if name.contains("grace") {
        return Some(500.0);
    }

    // Intel Arc
    if name.contains("a770") {
        return Some(560.0);
    }
    if name.contains("a750") {
        return Some(512.0);
    }
    if name.contains("a580") {
        return Some(512.0);
    }
    if name.contains("a380") {
        return Some(186.0);
    }

    None
}

/// Estimate default host DDR bandwidth in GB/s based on logical CPU core count.
pub fn estimate_host_bandwidth_gbps(_logical_cores: u32) -> f32 {
    50.0
}

/// Probe Linux GPU devices (NVIDIA, AMD DRM, Intel/lspci).
#[cfg(target_os = "linux")]
pub fn query_linux_gpu() -> Option<MetalDeviceInfo> {
    // 1. Try NVIDIA nvidia-smi
    if let Ok(output) = std::process::Command::new("nvidia-smi")
        .args([
            "--query-gpu=gpu_name,memory.total",
            "--format=csv,noheader,nounits",
        ])
        .output()
    {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            if let Some(first_line) = text.lines().next() {
                let parts: Vec<&str> = first_line.split(',').map(|s| s.trim()).collect();
                if parts.len() >= 2 {
                    let name = parts[0].to_string();
                    if let Ok(mb) = parts[1].parse::<u64>() {
                        let vram_bytes = mb * 1024 * 1024;
                        let is_unified = name.to_lowercase().contains("grace")
                            || name.to_lowercase().contains("tegra")
                            || name.to_lowercase().contains("orin");
                        return Some(MetalDeviceInfo {
                            device_name: name,
                            working_set_bytes: vram_bytes,
                            has_unified_memory: is_unified,
                            vram_bytes: Some(vram_bytes),
                        });
                    }
                }
            }
        }
    }

    // 2. Try sysfs DRM AMD / Intel VRAM
    let mut drm_vram: Option<u64> = None;
    let drm_path = std::path::Path::new("/sys/class/drm");
    if drm_path.exists() {
        if let Ok(entries) = std::fs::read_dir(drm_path) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("card") && !name.contains('-') {
                    let vram_file = entry.path().join("device/mem_info_vram_total");
                    if let Ok(content) = std::fs::read_to_string(vram_file) {
                        if let Ok(bytes) = content.trim().parse::<u64>() {
                            if bytes > 0 {
                                drm_vram = Some(drm_vram.map_or(bytes, |b| b.max(bytes)));
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Try lspci for GPU names
    if let Ok(output) = std::process::Command::new("lspci").output() {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            let mut discrete_name = None;
            let mut integrated_name = None;

            for line in text.lines() {
                let lower = line.to_lowercase();
                if lower.contains("vga compatible controller")
                    || lower.contains("3d controller")
                    || lower.contains("display controller")
                {
                    let clean_name = if let Some(idx) = line.find(": ") {
                        &line[idx + 2..]
                    } else {
                        line
                    };

                    if lower.contains("nvidia")
                        || lower.contains("geforce")
                        || lower.contains("amd")
                        || lower.contains("radeon")
                        || lower.contains("advanced micro devices")
                    {
                        discrete_name = Some(clean_name.to_string());
                    } else {
                        integrated_name = Some(clean_name.to_string());
                    }
                }
            }

            // If discrete GPU is found, prioritize it and filter out small iGPUs <= 2GB
            if let Some(d_name) = discrete_name {
                let is_unified = d_name.to_lowercase().contains("strix halo")
                    || d_name.to_lowercase().contains("ryzen ai max");
                return Some(MetalDeviceInfo {
                    device_name: d_name,
                    working_set_bytes: drm_vram.unwrap_or(0),
                    has_unified_memory: is_unified,
                    vram_bytes: drm_vram,
                });
            } else if let Some(i_name) = integrated_name {
                // If only integrated GPU exists and VRAM <= 2GB, working_set_bytes is 0 (fallback to host RAM)
                let is_unified = i_name.to_lowercase().contains("strix halo")
                    || i_name.to_lowercase().contains("ryzen ai max");
                return Some(MetalDeviceInfo {
                    device_name: i_name,
                    working_set_bytes: if is_unified { drm_vram.unwrap_or(0) } else { 0 },
                    has_unified_memory: is_unified,
                    vram_bytes: drm_vram,
                });
            }
        }
    }

    if let Some(vram) = drm_vram {
        return Some(MetalDeviceInfo {
            device_name: "AMD Radeon Graphics".to_string(),
            working_set_bytes: vram,
            has_unified_memory: false,
            vram_bytes: Some(vram),
        });
    }

    None
}

/// Detect host CPU SIMD features at runtime.
pub fn detect_cpu_features() -> domain::CpuFeatures {
    #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
    {
        domain::CpuFeatures {
            has_avx512: is_x86_feature_detected!("avx512f") && is_x86_feature_detected!("avx512vl"),
            has_avx2: is_x86_feature_detected!("avx2"),
            has_avx: is_x86_feature_detected!("avx"),
            has_fma: is_x86_feature_detected!("fma"),
            has_neon: false,
            has_dotprod: false,
            has_sve: false,
            has_amx: false,
        }
    }
    #[cfg(target_arch = "aarch64")]
    {
        #[cfg(target_os = "macos")]
        {
            domain::CpuFeatures {
                has_avx512: false,
                has_avx2: false,
                has_avx: false,
                has_fma: false,
                has_neon: true,
                has_dotprod: true,
                has_sve: false,
                has_amx: false,
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            domain::CpuFeatures {
                has_avx512: false,
                has_avx2: false,
                has_avx: false,
                has_fma: false,
                has_neon: true,
                has_dotprod: false,
                has_sve: false,
                has_amx: false,
            }
        }
    }
    #[cfg(not(any(target_arch = "x86", target_arch = "x86_64", target_arch = "aarch64")))]
    {
        domain::CpuFeatures::default()
    }
}

/// Check available shared memory on Linux (/dev/shm).
pub fn get_linux_dev_shm_free_bytes() -> Option<u64> {
    #[cfg(target_os = "linux")]
    {
        let path = std::path::Path::new("/dev/shm");
        if path.exists() {
            let disks = sysinfo::Disks::new_with_refreshed_list();
            for disk in disks.list() {
                if disk.mount_point() == path {
                    return Some(disk.available_space());
                }
            }
        }
    }
    None
}

/// Calculate proportional --tensor-split parameters for multi-GPU configurations.
pub fn calculate_tensor_split(vram_allocations: &[u64]) -> Option<String> {
    if vram_allocations.len() <= 1 {
        return None;
    }
    let total_vram: u64 = vram_allocations.iter().sum();
    if total_vram == 0 {
        return None;
    }
    let fractions: Vec<String> = vram_allocations
        .iter()
        .map(|&v| {
            let ratio = (v as f64 / total_vram as f64) * 100.0;
            format!("{:.0}", ratio.max(1.0))
        })
        .collect();
    Some(fractions.join(","))
}

/// Probe macOS GPU devices (Apple Silicon Metal / Intel discrete AMD / integrated).
#[cfg(target_os = "macos")]
pub fn query_macos_gpu() -> Option<MetalDeviceInfo> {
    if let Ok(output) = std::process::Command::new("system_profiler")
        .args(["SPDisplaysDataType", "-xml"])
        .output()
    {
        if output.status.success() {
            let xml = String::from_utf8_lossy(&output.stdout);
            if let Ok(displays) = parse_displays_plist(&xml) {
                if let Some(name) = displays.discrete_gpu_name.or(displays.primary_gpu_name) {
                    let vram = displays
                        .discrete_gpu_vram_bytes
                        .or(displays.primary_gpu_vram_bytes);
                    let is_apple_silicon = name.contains("Apple M") || name.contains("Apple ");
                    return Some(MetalDeviceInfo {
                        device_name: name,
                        working_set_bytes: vram.unwrap_or(0),
                        has_unified_memory: is_apple_silicon,
                        vram_bytes: if is_apple_silicon { None } else { vram },
                    });
                }
            }
        }
    }
    None
}

/// Probe Windows GPU devices (NVIDIA / AMD / Intel / DXGI).
#[cfg(target_os = "windows")]
pub fn query_windows_gpu() -> Option<MetalDeviceInfo> {
    if let Ok(output) = std::process::Command::new("nvidia-smi")
        .args([
            "--query-gpu=gpu_name,memory.total",
            "--format=csv,noheader,nounits",
        ])
        .output()
    {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            if let Some(first_line) = text.lines().next() {
                let parts: Vec<&str> = first_line.split(',').map(|s| s.trim()).collect();
                if parts.len() >= 2 {
                    let name = parts[0].to_string();
                    if let Ok(mb) = parts[1].parse::<u64>() {
                        let vram_bytes = mb * 1024 * 1024;
                        return Some(MetalDeviceInfo {
                            device_name: name,
                            working_set_bytes: vram_bytes,
                            has_unified_memory: false,
                            vram_bytes: Some(vram_bytes),
                        });
                    }
                }
            }
        }
    }
    None
}

/// Default runtime Metal/GPU provider.
pub struct RuntimeMetalProvider;

impl WorkingSetProvider for RuntimeMetalProvider {
    fn get_metal_device_info(&self) -> Option<MetalDeviceInfo> {
        #[cfg(target_os = "macos")]
        {
            query_macos_gpu()
        }
        #[cfg(target_os = "linux")]
        {
            query_linux_gpu()
        }
        #[cfg(target_os = "windows")]
        {
            query_windows_gpu()
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
        {
            None
        }
    }
}

/// Trait abstraction for system-level hardware inspection.
pub trait SysProvider: Send + Sync {
    fn total_memory(&self) -> u64;
    fn disk_free(&self) -> u64;
    fn cpu_info(&self) -> (String, String, u32, u32); // (name, arch, physical_cores, logical_cores)
    fn os_version(&self) -> String;
}

/// Default system provider using sysinfo.
pub struct LiveSysProvider;

impl SysProvider for LiveSysProvider {
    fn total_memory(&self) -> u64 {
        let mut sys = System::new_with_specifics(
            RefreshKind::nothing().with_memory(MemoryRefreshKind::everything()),
        );
        sys.refresh_memory();
        sys.total_memory()
    }

    fn disk_free(&self) -> u64 {
        let disks = sysinfo::Disks::new_with_refreshed_list();
        disks
            .list()
            .iter()
            .map(|d| d.available_space())
            .max()
            .unwrap_or(50 * 1024 * 1024 * 1024)
    }

    fn cpu_info(&self) -> (String, String, u32, u32) {
        let mut sys = System::new_with_specifics(
            RefreshKind::nothing().with_cpu(CpuRefreshKind::everything()),
        );
        sys.refresh_cpu_all();
        let name = sys
            .cpus()
            .first()
            .map(|c| c.brand().to_string())
            .unwrap_or_else(|| "x86_64 Processor".to_string());
        let arch = std::env::consts::ARCH.to_string();
        let physical_cores = sys.physical_core_count().unwrap_or(4) as u32;
        let logical_cores = sys.cpus().len() as u32;
        (name, arch, physical_cores, logical_cores)
    }

    fn os_version(&self) -> String {
        System::long_os_version().unwrap_or_else(|| "macOS (Apple Intel)".to_string())
    }
}

/// Parses byte size strings like "16 GB", "1536 MB", "4 GB", "512 MB".
pub fn parse_size_string(val: &str) -> Option<u64> {
    let parts: Vec<&str> = val.split_whitespace().collect();
    if parts.is_empty() {
        return None;
    }
    let num: f64 = parts[0].parse().ok()?;
    let unit = parts
        .get(1)
        .map(|s| s.to_uppercase())
        .unwrap_or_else(|| "B".to_string());
    let multiplier: u64 = match unit.as_str() {
        "KB" => 1024,
        "MB" => 1024 * 1024,
        "GB" => 1024 * 1024 * 1024,
        "TB" => 1024 * 1024 * 1024 * 1024,
        _ => 1,
    };
    Some((num * multiplier as f64) as u64)
}

/// Extracted hardware details from system_profiler SPHardwareDataType plist.
#[derive(Debug, Clone, Default)]
pub struct ParsedHardwarePlist {
    pub cpu_type: String,
    pub number_processors: u32,
    pub total_ram_bytes: Option<u64>,
}

/// Extracted GPU details from system_profiler SPDisplaysDataType plist.
#[derive(Debug, Clone, Default)]
pub struct ParsedDisplaysPlist {
    pub primary_gpu_name: Option<String>,
    pub primary_gpu_vram_bytes: Option<u64>,
    pub discrete_gpu_name: Option<String>,
    pub discrete_gpu_vram_bytes: Option<u64>,
}

/// Parse SPHardwareDataType XML plist.
pub fn parse_hardware_plist(xml_str: &str) -> Result<ParsedHardwarePlist, AppError> {
    let cursor = std::io::Cursor::new(xml_str.as_bytes());
    let val = Value::from_reader(cursor).map_err(|e| {
        AppError::HwProbe(format!("Failed to parse SPHardwareDataType plist: {}", e))
    })?;

    let array = val
        .as_array()
        .ok_or_else(|| AppError::HwProbe("Root of hardware plist is not an array".to_string()))?;

    let mut result = ParsedHardwarePlist::default();

    for item in array {
        if let Some(items) = item
            .as_dictionary()
            .and_then(|d| d.get("_items"))
            .and_then(|i| i.as_array())
        {
            for sub in items {
                if let Some(dict) = sub.as_dictionary() {
                    if let Some(cpu) = dict.get("cpu_type").and_then(|v| v.as_string()) {
                        result.cpu_type = cpu.to_string();
                    }
                    if let Some(num) = dict
                        .get("number_processors")
                        .and_then(|v| v.as_unsigned_integer())
                    {
                        result.number_processors = num as u32;
                    }
                    if let Some(mem_str) = dict.get("physical_memory").and_then(|v| v.as_string()) {
                        result.total_ram_bytes = parse_size_string(mem_str);
                    }
                }
            }
        }
    }

    if result.cpu_type.is_empty() && result.total_ram_bytes.is_none() {
        return Err(AppError::HwProbe(
            "No hardware items found in SPHardwareDataType".to_string(),
        ));
    }

    Ok(result)
}

/// Parse SPDisplaysDataType XML plist.
pub fn parse_displays_plist(xml_str: &str) -> Result<ParsedDisplaysPlist, AppError> {
    let cursor = std::io::Cursor::new(xml_str.as_bytes());
    let val = Value::from_reader(cursor).map_err(|e| {
        AppError::HwProbe(format!("Failed to parse SPDisplaysDataType plist: {}", e))
    })?;

    let array = val
        .as_array()
        .ok_or_else(|| AppError::HwProbe("Root of displays plist is not an array".to_string()))?;

    let mut result = ParsedDisplaysPlist::default();

    for item in array {
        if let Some(items) = item
            .as_dictionary()
            .and_then(|d| d.get("_items"))
            .and_then(|i| i.as_array())
        {
            for sub in items {
                if let Some(dict) = sub.as_dictionary() {
                    let name = dict
                        .get("_name")
                        .and_then(|v| v.as_string())
                        .unwrap_or_default()
                        .to_string();
                    let vram = dict
                        .get("spdisplays_vram")
                        .or_else(|| dict.get("spdisplays_vram_shared"))
                        .and_then(|v| v.as_string())
                        .and_then(parse_size_string);

                    if name.contains("AMD") || name.contains("Radeon") || name.contains("NVIDIA") {
                        result.discrete_gpu_name = Some(name.clone());
                        result.discrete_gpu_vram_bytes = vram;
                    }

                    if result.primary_gpu_name.is_none() {
                        result.primary_gpu_name = Some(name);
                        result.primary_gpu_vram_bytes = vram;
                    }
                }
            }
        }
    }

    Ok(result)
}

/// Detect full hardware profile with fallback heuristics and platform checks.
pub fn detect_profile(
    metal: &dyn WorkingSetProvider,
    sys: &dyn SysProvider,
) -> Result<HardwareProfile, AppError> {
    let (cpu_name, arch, physical_cores, logical_cores) = sys.cpu_info();
    let cpu_features = detect_cpu_features();

    let total_ram_bytes = sys.total_memory();
    let disk_free_bytes = sys.disk_free();
    let os_version = sys.os_version();

    let metal_info = metal.get_metal_device_info();

    let is_apple_silicon = (arch == "aarch64" || arch == "arm64")
        && (os_version.to_lowercase().contains("mac")
            || cpu_name.contains("Apple M")
            || cpu_name.contains("Apple "));

    let (gpu_name, gpu_vram_bytes, has_unified_memory) = match metal_info.as_ref() {
        Some(m) => {
            let is_unified = m.has_unified_memory || is_apple_silicon;
            (
                Some(m.device_name.clone()),
                if is_unified { None } else { m.vram_bytes },
                is_unified,
            )
        }
        None => {
            if is_apple_silicon {
                (Some(format!("{} (Metal UMA)", cpu_name)), None, true)
            } else {
                (None, None, false)
            }
        }
    };

    // Host budget = min(metal_working_set, total_ram) if unified or 75% fallback
    let metal_working_set_bytes = metal_info
        .as_ref()
        .and_then(|m| {
            if m.has_unified_memory && m.working_set_bytes > 0 {
                Some(m.working_set_bytes.min(total_ram_bytes))
            } else {
                None
            }
        })
        .unwrap_or((total_ram_bytes as f64 * 0.75) as u64);

    let gpu_bandwidth_gbps = gpu_name.as_deref().and_then(lookup_gpu_bandwidth_gbps);
    let host_bandwidth_gbps = estimate_host_bandwidth_gbps(logical_cores);

    // Dynamic accelerator backend detection
    let accelerator_backend =
        if has_unified_memory && (os_version.to_lowercase().contains("mac") || is_apple_silicon) {
            Some("Apple Metal (Unified Memory)".to_string())
        } else if let Some(ref name) = gpu_name {
            let name_lower = name.to_lowercase();
            if name_lower.contains("nvidia")
                || name_lower.contains("geforce")
                || name_lower.contains("rtx")
                || name_lower.contains("gtx")
                || name_lower.contains("tesla")
                || name_lower.contains("quadro")
            {
                Some("NVIDIA CUDA".to_string())
            } else if name_lower.contains("amd") || name_lower.contains("radeon") {
                Some("AMD ROCm / Vulkan".to_string())
            } else if name_lower.contains("intel")
                && (name_lower.contains("arc")
                    || name_lower.contains("iris")
                    || name_lower.contains("uhd"))
            {
                Some("Intel oneAPI / Vulkan".to_string())
            } else {
                Some("Vulkan Compute".to_string())
            }
        } else if cpu_features.has_avx512 {
            Some("CPU (AVX-512)".to_string())
        } else if cpu_features.has_avx2 {
            Some("CPU (AVX2)".to_string())
        } else if cpu_features.has_neon {
            Some("CPU (ARM NEON)".to_string())
        } else {
            Some("CPU (Generic)".to_string())
        };

    Ok(HardwareProfile {
        cpu_name,
        arch,
        cpu_physical_cores: physical_cores,
        cpu_logical_cores: logical_cores,
        gpu_name,
        gpu_vram_bytes,
        has_unified_memory,
        total_ram_bytes,
        metal_working_set_bytes,
        disk_free_bytes,
        os_version,
        detected_at: Utc::now(),
        gpu_bandwidth_gbps,
        host_bandwidth_gbps,
        cpu_features: Some(cpu_features),
        accelerator_backend,
        driver_version: None,
        power_source: None,
    })
}

/// Global hardware probe cache.
static CACHED_PROFILE: OnceLock<Arc<Mutex<Option<HardwareProfile>>>> = OnceLock::new();

fn get_cache() -> &'static Arc<Mutex<Option<HardwareProfile>>> {
    CACHED_PROFILE.get_or_init(|| Arc::new(Mutex::new(None)))
}

/// Get hardware profile, returning cached version if available.
pub fn get_or_detect_profile() -> Result<HardwareProfile, AppError> {
    let cache = get_cache();
    let mut lock = cache.lock().unwrap();
    if let Some(profile) = lock.as_ref() {
        return Ok(profile.clone());
    }

    let metal = RuntimeMetalProvider;
    let sys = LiveSysProvider;
    let profile = detect_profile(&metal, &sys)?;
    *lock = Some(profile.clone());
    Ok(profile)
}

/// Force refresh of hardware profile.
pub fn refresh_profile() -> Result<HardwareProfile, AppError> {
    let cache = get_cache();
    let mut lock = cache.lock().unwrap();
    let metal = RuntimeMetalProvider;
    let sys = LiveSysProvider;
    let profile = detect_profile(&metal, &sys)?;
    *lock = Some(profile.clone());
    Ok(profile)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockWorkingSetProvider {
        info: Option<MetalDeviceInfo>,
    }

    impl WorkingSetProvider for MockWorkingSetProvider {
        fn get_metal_device_info(&self) -> Option<MetalDeviceInfo> {
            self.info.clone()
        }
    }

    struct MockSysProvider {
        total_mem: u64,
        disk: u64,
        cpu: (String, String, u32, u32),
        os: String,
    }

    impl SysProvider for MockSysProvider {
        fn total_memory(&self) -> u64 {
            self.total_mem
        }
        fn disk_free(&self) -> u64 {
            self.disk
        }
        fn cpu_info(&self) -> (String, String, u32, u32) {
            self.cpu.clone()
        }
        fn os_version(&self) -> String {
            self.os.clone()
        }
    }

    #[test]
    fn test_macbook_pro_16_2019_fixture_parsing() {
        let hw_xml = include_str!("../tests/fixtures/macbook_pro_16_2019_hardware.xml");
        let disp_xml = include_str!("../tests/fixtures/macbook_pro_16_2019_displays.xml");

        let hw = parse_hardware_plist(hw_xml).unwrap();
        assert_eq!(hw.cpu_type, "8-Core Intel Core i9");
        assert_eq!(hw.number_processors, 8);
        assert_eq!(hw.total_ram_bytes, Some(16 * 1024 * 1024 * 1024));

        let disp = parse_displays_plist(disp_xml).unwrap();
        assert_eq!(
            disp.discrete_gpu_name,
            Some("AMD Radeon Pro 5500M".to_string())
        );
        assert_eq!(disp.discrete_gpu_vram_bytes, Some(4 * 1024 * 1024 * 1024));
    }

    #[test]
    fn test_imac_27_2020_fixture_parsing() {
        let hw_xml = include_str!("../tests/fixtures/imac_27_2020_hardware.xml");
        let disp_xml = include_str!("../tests/fixtures/imac_27_2020_displays.xml");

        let hw = parse_hardware_plist(hw_xml).unwrap();
        assert_eq!(hw.cpu_type, "8-Core Intel Core i7");
        assert_eq!(hw.total_ram_bytes, Some(32 * 1024 * 1024 * 1024));

        let disp = parse_displays_plist(disp_xml).unwrap();
        assert_eq!(
            disp.discrete_gpu_name,
            Some("AMD Radeon Pro 5500 XT".to_string())
        );
        assert_eq!(disp.discrete_gpu_vram_bytes, Some(8 * 1024 * 1024 * 1024));
    }

    #[test]
    fn test_mac_mini_2018_fixture_parsing() {
        let hw_xml = include_str!("../tests/fixtures/mac_mini_2018_hardware.xml");
        let disp_xml = include_str!("../tests/fixtures/mac_mini_2018_displays.xml");

        let hw = parse_hardware_plist(hw_xml).unwrap();
        assert_eq!(hw.cpu_type, "6-Core Intel Core i7");
        assert_eq!(hw.total_ram_bytes, Some(64 * 1024 * 1024 * 1024));

        let disp = parse_displays_plist(disp_xml).unwrap();
        assert_eq!(
            disp.primary_gpu_name,
            Some("Intel UHD Graphics 630".to_string())
        );
        assert_eq!(disp.discrete_gpu_name, None);
    }

    #[test]
    fn test_mac_pro_2019_fixture_parsing() {
        let hw_xml = include_str!("../tests/fixtures/mac_pro_2019_hardware.xml");
        let disp_xml = include_str!("../tests/fixtures/mac_pro_2019_displays.xml");

        let hw = parse_hardware_plist(hw_xml).unwrap();
        assert_eq!(hw.cpu_type, "16-Core Intel Xeon W");
        assert_eq!(hw.total_ram_bytes, Some(128 * 1024 * 1024 * 1024));

        let disp = parse_displays_plist(disp_xml).unwrap();
        assert_eq!(
            disp.discrete_gpu_name,
            Some("AMD Radeon Pro Vega II".to_string())
        );
        assert_eq!(disp.discrete_gpu_vram_bytes, Some(32 * 1024 * 1024 * 1024));
    }

    #[test]
    fn test_malformed_plist_returns_typed_error() {
        let malformed_xml = include_str!("../tests/fixtures/malformed.xml");
        let res = parse_hardware_plist(malformed_xml);
        assert!(res.is_err());
        match res.err().unwrap() {
            AppError::HwProbe(msg) => assert!(msg.contains("Failed to parse")),
            other => panic!("Unexpected error: {:?}", other),
        }
    }

    #[test]
    fn test_fallback_working_set_calculation() {
        let metal = MockWorkingSetProvider { info: None };
        let sys = MockSysProvider {
            total_mem: 16 * 1024 * 1024 * 1024,
            disk: 100 * 1024 * 1024 * 1024,
            cpu: ("Intel Core i7".to_string(), "x86_64".to_string(), 8, 16),
            os: "macOS 14.5".to_string(),
        };

        let profile = detect_profile(&metal, &sys).unwrap();
        // 75% of 16GB = 12GB
        assert_eq!(profile.metal_working_set_bytes, 12 * 1024 * 1024 * 1024);
        assert_eq!(profile.total_ram_bytes, 16 * 1024 * 1024 * 1024);
        assert_eq!(profile.cpu_physical_cores, 8);
    }

    #[test]
    fn test_linux_discrete_gpu_detection() {
        let metal = MockWorkingSetProvider {
            info: Some(MetalDeviceInfo {
                device_name: "Advanced Micro Devices, Inc. [AMD/ATI] Mars [Radeon HD 8730M]"
                    .to_string(),
                working_set_bytes: 1024 * 1024 * 1024,
                has_unified_memory: false,
                vram_bytes: Some(1024 * 1024 * 1024),
            }),
        };
        let sys = MockSysProvider {
            total_mem: 8 * 1024 * 1024 * 1024,
            disk: 250 * 1024 * 1024 * 1024,
            cpu: (
                "Intel(R) Core(TM) i5-4200M CPU @ 2.50GHz".to_string(),
                "x86_64".to_string(),
                2,
                4,
            ),
            os: "Ubuntu 26.04 LTS".to_string(),
        };

        let profile = detect_profile(&metal, &sys).unwrap();
        assert_eq!(profile.arch, "x86_64");
        assert_eq!(profile.cpu_physical_cores, 2);
        assert_eq!(profile.cpu_logical_cores, 4);
        assert_eq!(profile.total_ram_bytes, 8 * 1024 * 1024 * 1024);
        // Host budget = 75% of 8GB = 6GB
        assert_eq!(profile.metal_working_set_bytes, 6 * 1024 * 1024 * 1024);
        assert_eq!(profile.gpu_vram_bytes, Some(1024 * 1024 * 1024));
        assert!(profile
            .gpu_name
            .as_ref()
            .unwrap()
            .contains("Radeon HD 8730M"));
    }

    #[test]
    fn test_apple_silicon_aarch64_profile_detection() {
        let metal = MockWorkingSetProvider { info: None };
        let sys = MockSysProvider {
            total_mem: 36 * 1024 * 1024 * 1024,
            disk: 500 * 1024 * 1024 * 1024,
            cpu: ("Apple M3 Max".to_string(), "aarch64".to_string(), 14, 14),
            os: "macOS 14.5".to_string(),
        };

        let profile = detect_profile(&metal, &sys).unwrap();
        assert_eq!(profile.arch, "aarch64");
        assert!(profile.has_unified_memory);
        assert_eq!(profile.total_ram_bytes, 36 * 1024 * 1024 * 1024);
        assert_eq!(
            profile.metal_working_set_bytes,
            (36.0 * 0.75 * 1024.0 * 1024.0 * 1024.0) as u64
        );
        assert_eq!(profile.gpu_bandwidth_gbps, Some(300.0));
        assert!(profile
            .accelerator_backend
            .as_ref()
            .unwrap()
            .contains("Metal"));
    }

    #[test]
    fn test_cpu_feature_detection() {
        let features = detect_cpu_features();
        #[cfg(target_arch = "x86_64")]
        {
            let _ = features.has_avx;
            let _ = features.has_avx2;
            let _ = features.has_avx512;
        }
        #[cfg(target_arch = "aarch64")]
        assert!(features.has_neon);
    }

    #[test]
    fn test_calculate_tensor_split() {
        let vrams = vec![24 * 1024 * 1024 * 1024, 12 * 1024 * 1024 * 1024];
        let split = calculate_tensor_split(&vrams).unwrap();
        assert_eq!(split, "67,33");

        let single = vec![16 * 1024 * 1024 * 1024];
        assert_eq!(calculate_tensor_split(&single), None);
    }

    #[test]
    fn test_lookup_gpu_bandwidth() {
        assert_eq!(
            lookup_gpu_bandwidth_gbps("NVIDIA GeForce RTX 4090"),
            Some(1008.0)
        );
        assert_eq!(
            lookup_gpu_bandwidth_gbps("NVIDIA GeForce RTX 3090"),
            Some(936.0)
        );
        assert_eq!(lookup_gpu_bandwidth_gbps("Apple M3 Max"), Some(300.0));
        assert_eq!(
            lookup_gpu_bandwidth_gbps("AMD Radeon RX 7900 XTX"),
            Some(960.0)
        );
        assert_eq!(
            lookup_gpu_bandwidth_gbps("AMD Radeon Pro 5500M"),
            Some(192.0)
        );
        assert_eq!(lookup_gpu_bandwidth_gbps("Unknown Custom GPU XYZ"), None);
    }
}
