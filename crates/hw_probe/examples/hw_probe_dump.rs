use hw_probe::get_or_detect_profile;

fn main() {
    let profile = get_or_detect_profile().expect("detect profile");
    println!("Hardware Profile Dump:");
    println!("  CPU: {} ({})", profile.cpu_name, profile.arch);
    println!(
        "  Cores: {} physical / {} logical",
        profile.cpu_physical_cores, profile.cpu_logical_cores
    );
    println!(
        "  RAM: {:.2} GB",
        profile.total_ram_bytes as f64 / (1024.0 * 1024.0 * 1024.0)
    );
    println!(
        "  Metal Working Set: {:.2} GB",
        profile.metal_working_set_bytes as f64 / (1024.0 * 1024.0 * 1024.0)
    );
    println!(
        "  GPU: {:?} (VRAM: {:?})",
        profile.gpu_name, profile.gpu_vram_bytes
    );
    println!(
        "  Disk Free: {:.2} GB",
        profile.disk_free_bytes as f64 / (1024.0 * 1024.0 * 1024.0)
    );
}
