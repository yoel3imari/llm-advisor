use std::path::{Path, PathBuf};

fn sync_libraries(src_dir: &Path, target_dirs: &[PathBuf]) {
    let lib_extensions = ["dylib", "so", "dll", "metal", "metallib"];

    if !src_dir.exists() {
        return;
    }

    if let Ok(entries) = std::fs::read_dir(src_dir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            let file_name = entry.file_name();
            let name_str = file_name.to_string_lossy();

            let is_lib = lib_extensions.iter().any(|ext| name_str.contains(ext));
            if is_lib {
                for target_dir in target_dirs {
                    if !target_dir.exists() {
                        let _ = std::fs::create_dir_all(target_dir);
                    }
                    let dest = target_dir.join(&file_name);
                    if !dest.exists() {
                        if let Ok(symlink_target) = std::fs::read_link(&path) {
                            #[cfg(unix)]
                            {
                                let _ = std::os::unix::fs::symlink(&symlink_target, &dest);
                            }
                            #[cfg(not(unix))]
                            {
                                let _ = std::fs::copy(&path, &dest);
                            }
                        } else {
                            let _ = std::fs::copy(&path, &dest);
                        }
                    }
                }
            }
        }
    }
}

fn main() {
    println!("cargo:rerun-if-changed=binaries");

    // Ensure the expected sidecar binary placeholder exists so tauri-build never fails in dev/test
    let target = std::env::var("TARGET").unwrap_or_else(|_| "x86_64-apple-darwin".to_string());
    let binaries_dir = Path::new("binaries");
    if !binaries_dir.exists() {
        let _ = std::fs::create_dir_all(binaries_dir);
    }

    let bin_name = if target.contains("windows") {
        format!("llama-server-{}.exe", target)
    } else {
        format!("llama-server-{}", target)
    };
    let expected_bin = binaries_dir.join(&bin_name);
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

    // Determine target output directory to synchronize shared libraries for dev & test runs
    if let Ok(out_dir) = std::env::var("OUT_DIR") {
        let out_path = PathBuf::from(out_dir);
        // OUT_DIR is target/{debug|release}/build/llm-advisor-<hash>/out
        if let Some(target_dir) = out_path.ancestors().nth(3) {
            let target_dirs = vec![
                target_dir.to_path_buf(),
                target_dir.join("deps"),
                target_dir.join("binaries"),
            ];
            sync_libraries(binaries_dir, &target_dirs);
            sync_libraries(Path::new("../sidecars/binaries"), &target_dirs);
        }
    }

    tauri_build::build();
}
