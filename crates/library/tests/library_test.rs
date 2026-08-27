use chrono::Utc;
use domain::ModelRecord;
use library::*;
use std::fs::File;
use std::io::Write;
use tempfile::tempdir;

#[test]
fn test_library_crud_and_reconciliation() {
    let dir = tempdir().unwrap();
    let store = LibraryStore::new(dir.path().to_path_buf()).expect("create store");

    let model_file = store.models_dir().join("test-model.gguf");
    {
        let mut f = File::create(&model_file).unwrap();
        f.write_all(b"GGUF_TEST_BYTES").unwrap();
    }

    let record = ModelRecord {
        entry_id: "test-model".to_string(),
        file_path: model_file.clone(),
        size_bytes: 15,
        verified: true,
        added_at: Utc::now(),
    };

    // 1. Add verified
    store.add_verified(record.clone()).expect("add verified");

    // 2. Get and List
    let fetched = store.get("test-model").unwrap().expect("should find model");
    assert_eq!(fetched.entry_id, "test-model");
    assert_eq!(fetched.size_bytes, 15);

    let list = store.list().unwrap();
    assert_eq!(list.len(), 1);

    // 3. Create an orphan file in models_dir
    let orphan_file = store.models_dir().join("orphan-manual.gguf");
    {
        let mut f = File::create(&orphan_file).unwrap();
        f.write_all(b"ORPHAN_DATA").unwrap();
    }

    // 4. Reconcile
    let report = store.reconcile().unwrap();
    assert_eq!(report.valid_records.len(), 1);
    assert_eq!(report.missing_records.len(), 0);
    assert_eq!(report.orphan_files.len(), 1);
    assert_eq!(report.orphan_files[0], orphan_file);

    // 5. Prune orphan
    let reclaimed = store.prune_orphans(&report.orphan_files).unwrap();
    assert_eq!(reclaimed, 11);
    assert!(!orphan_file.exists());

    // 6. Delete model file manually -> Reconcile detects Missing
    std::fs::remove_file(&model_file).unwrap();
    let report2 = store.reconcile().unwrap();
    assert_eq!(report2.valid_records.len(), 0);
    assert_eq!(report2.missing_records.len(), 1);
    assert_eq!(report2.missing_records[0].entry_id, "test-model");

    // 7. Delete record via store.delete
    let deleted = store.delete("test-model").unwrap();
    assert!(deleted);
    assert_eq!(store.list().unwrap().len(), 0);
}
