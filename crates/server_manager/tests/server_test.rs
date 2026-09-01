use domain::ServeConfig;
use server_manager::*;
use std::fs::File;
use std::io::Write;
use tempfile::tempdir;

#[tokio::test]
async fn test_server_manager_lifecycle_with_fake_child() {
    let dir = tempdir().unwrap();

    // Create a fake-child python script acting as llama-server
    let fake_server_path = dir.path().join("fake-llama-server.py");
    let script_content = r#"#!/usr/bin/env python3
import sys, http.server, socketserver, argparse

parser = argparse.ArgumentParser()
parser.add_argument("-m", type=str)
parser.add_argument("--port", type=int, default=18080)
parser.add_argument("--host", type=str, default="127.0.0.1")
parser.add_argument("-c", type=int)
parser.add_argument("-np", type=int)
parser.add_argument("-ctk", type=str)
parser.add_argument("-ctv", type=str)
parser.add_argument("-ngl", type=int)

args, _ = parser.parse_known_args()

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

with socketserver.TCPServer((args.host, args.port), Handler) as httpd:
    httpd.serve_forever()
"#;

    {
        let mut f = File::create(&fake_server_path).unwrap();
        f.write_all(script_content.as_bytes()).unwrap();
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&fake_server_path).unwrap().permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&fake_server_path, perms).unwrap();
    }

    let fake_model_path = dir.path().join("test.gguf");
    {
        let mut f = File::create(&fake_model_path).unwrap();
        f.write_all(b"DUMMY_MODEL_WEIGHTS").unwrap();
    }

    let manager = ServerManager::new(fake_server_path);
    assert_eq!(manager.get_state(), ServerState::Stopped);

    // 1. Start server
    let cfg = ServeConfig::default();
    let port = manager
        .start_server("test-model".to_string(), fake_model_path.clone(), cfg, None)
        .await
        .expect("start_server should succeed");

    assert!(port > 0);
    match manager.get_state() {
        ServerState::Serving {
            model_id, port: p, ..
        } => {
            assert_eq!(model_id, "test-model");
            assert_eq!(p, port);
        }
        other => panic!("Expected Serving state, got {:?}", other),
    }

    // 2. Stop server
    manager.stop_server().await.expect("stop should succeed");
    assert_eq!(manager.get_state(), ServerState::Stopped);
    assert_eq!(manager.get_active_port(), None);
}

#[tokio::test]
async fn test_multi_instance_sidecar_pool() {
    let dir = tempdir().unwrap();

    let fake_server_path = dir.path().join("fake-multi-server.py");
    let script_content = r#"#!/usr/bin/env python3
import sys, http.server, socketserver, argparse

parser = argparse.ArgumentParser()
parser.add_argument("-m", type=str)
parser.add_argument("--port", type=int, default=18080)
parser.add_argument("--host", type=str, default="127.0.0.1")
parser.add_argument("-c", type=int)
parser.add_argument("-np", type=int)
parser.add_argument("-ctk", type=str)
parser.add_argument("-ctv", type=str)
parser.add_argument("-ngl", type=int)

args, _ = parser.parse_known_args()

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

with socketserver.TCPServer((args.host, args.port), Handler) as httpd:
    httpd.serve_forever()
"#;

    {
        let mut f = File::create(&fake_server_path).unwrap();
        f.write_all(script_content.as_bytes()).unwrap();
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&fake_server_path).unwrap().permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&fake_server_path, perms).unwrap();
    }

    let model1_path = dir.path().join("model1.gguf");
    let model2_path = dir.path().join("model2.gguf");
    {
        let mut f = File::create(&model1_path).unwrap();
        f.write_all(b"M1").unwrap();
        let mut f2 = File::create(&model2_path).unwrap();
        f2.write_all(b"M2").unwrap();
    }

    let manager = ServerManager::new(fake_server_path);

    // Start model 1
    let port1 = manager
        .start_server(
            "model-1".to_string(),
            model1_path,
            ServeConfig::default(),
            None,
        )
        .await
        .expect("start model 1");

    // Start model 2 concurrently
    let port2 = manager
        .start_server(
            "model-2".to_string(),
            model2_path,
            ServeConfig::default(),
            None,
        )
        .await
        .expect("start model 2");

    assert_ne!(port1, port2);
    assert_eq!(manager.list_instances().len(), 2);
    assert_eq!(manager.get_port_for_model(Some("model-1")), Some(port1));
    assert_eq!(manager.get_port_for_model(Some("model-2")), Some(port2));

    // Stop only model 1
    manager
        .stop_instance("model-1")
        .await
        .expect("stop model 1");
    assert_eq!(manager.list_instances().len(), 1);
    assert_eq!(manager.get_port_for_model(Some("model-1")), Some(port2)); // fallback to the only running model
    assert_eq!(manager.get_port_for_model(Some("model-2")), Some(port2));

    // Stop all
    manager.stop_all().await.expect("stop all");
    assert_eq!(manager.list_instances().len(), 0);
    assert_eq!(manager.get_state(), ServerState::Stopped);
}

#[test]
fn test_ensure_sidecar_dependencies_syncs_libs() {
    let dir = tempdir().unwrap();
    let sidecar_bin_dir = dir.path().join("target").join("debug");
    std::fs::create_dir_all(&sidecar_bin_dir).unwrap();
    let sidecar_bin = sidecar_bin_dir.join("llama-server");
    std::fs::write(&sidecar_bin, b"fake binary").unwrap();

    // Call ensure_sidecar_dependencies on the sidecar path
    ensure_sidecar_dependencies(&sidecar_bin);

    // If source binaries dir exists in workspace, check that it doesn't crash and copies available libs
    let src_binaries = std::path::PathBuf::from("src-tauri/binaries");
    if src_binaries.exists() {
        if let Ok(entries) = std::fs::read_dir(&src_binaries) {
            for entry in entries.filter_map(Result::ok) {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.contains(".dylib") || name.contains(".so") || name.contains(".metallib") {
                    assert!(sidecar_bin_dir.join(&name).exists());
                }
            }
        }
    }
}
