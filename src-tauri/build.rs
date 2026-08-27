use std::path::Path;

fn main() {
    // Ensure the expected sidecar binary placeholder exists so tauri-build never fails in dev/test
    let target = std::env::var("TARGET").unwrap_or_else(|_| "x86_64-apple-darwin".to_string());
    let binaries_dir = Path::new("binaries");
    if !binaries_dir.exists() {
        let _ = std::fs::create_dir_all(binaries_dir);
    }

    let expected_bin = binaries_dir.join(format!("llama-server-{}", target));
    if !expected_bin.exists() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::write(
                &expected_bin,
                b"#!/bin/sh\necho 'llama-server placeholder. Please run ./scripts/fetch-sidecar.sh'\nexit 1\n",
            );
            if let Ok(meta) = std::fs::metadata(&expected_bin) {
                let mut perms = meta.permissions();
                perms.set_mode(0o755);
                let _ = std::fs::set_permissions(&expected_bin, perms);
            }
        }
        #[cfg(not(unix))]
        {
            let _ = std::fs::write(&expected_bin, b"placeholder");
        }
    }

    tauri_build::build();
}
