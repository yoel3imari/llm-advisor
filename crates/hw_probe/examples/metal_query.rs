use hw_probe::{detect_profile, LiveSysProvider, RuntimeMetalProvider};

fn main() {
    let metal = RuntimeMetalProvider;
    let sys = LiveSysProvider;
    let profile = detect_profile(&metal, &sys).expect("detect profile");
    let ratio = profile.metal_working_set_bytes as f64 / profile.total_ram_bytes as f64;
    println!(
        "working_set={} bytes, total={} bytes, ratio={:.2}",
        profile.metal_working_set_bytes, profile.total_ram_bytes, ratio
    );
}
