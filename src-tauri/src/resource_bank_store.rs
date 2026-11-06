//! Individual personal banks. Legacy conversion intentionally remains available
//! across releases; removing it requires a separate compatibility decision.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, HashSet},
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};

pub static LOCK: Mutex<()> = Mutex::new(());
/// Listing metadata only: no bank content or image decoding.
pub fn file_modified_at(path: &Path) -> Option<i64> {
    fs::metadata(path).ok()?.modified().ok()?.duration_since(std::time::UNIX_EPOCH).ok()
        .and_then(|elapsed| i64::try_from(elapsed.as_millis()).ok())
}
pub fn bank_modified_at(root: &Path, bank_id: &str) -> Option<i64> {
    file_modified_at(&directory(root, bank_id).join("bank.json"))
}
#[derive(Clone, Copy)]
pub enum Family {
    Questions,
    References,
    Assistants,
}
impl Family {
    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "questions" => Ok(Self::Questions),
            "references" => Ok(Self::References),
            "assistants" => Ok(Self::Assistants),
            _ => Err("Famille de banques inconnue".into()),
        }
    }
    fn legacy(self) -> &'static str {
        match self {
            Self::Questions => "question-bank.json",
            Self::References => "reference-bank.json",
            Self::Assistants => "assistant-bank.json",
        }
    }
    fn key(self) -> &'static str {
        match self {
            Self::Questions => "questionBanks",
            Self::References => "referenceBanks",
            Self::Assistants => "assistants",
        }
    }
    fn content(self) -> &'static str {
        match self {
            Self::Questions => "questions",
            _ => "entries",
        }
    }
}
#[derive(Serialize, Deserialize, Default)]
struct Receipt {
    sources: BTreeMap<String, String>,
}
fn hash(value: &Value) -> String {
    format!("{:x}", Sha256::digest(serde_json::to_vec(value).unwrap()))
}

fn id(value: &Value) -> Result<&str, String> {
    let id = value
        .get("id")
        .and_then(Value::as_str)
        .ok_or("Identifiant de banque absent")?;
    if id.is_empty() {
        return Err("Identifiant de banque vide".into());
    }
    Ok(id)
}
// IDs are preserved inside the document. Their digest prevents path traversal
// and filename collisions introduced by normalizing user-controlled IDs.
fn directory(root: &Path, bank_id: &str) -> PathBuf {
    root.join("banks")
        .join(format!("{:x}", Sha256::digest(bank_id.as_bytes())))
}
fn confined(root: &Path, path: &Path) -> Result<(), String> {
    let root = root.canonicalize().map_err(|e| e.to_string())?;
    let mut current = Some(path);
    while let Some(candidate) = current {
        if candidate.exists() {
            let resolved = candidate.canonicalize().map_err(|e| e.to_string())?;
            if !resolved.starts_with(&root) {
                return Err("Chemin de banque hors du catalogue".into());
            }
            let metadata = fs::symlink_metadata(candidate).map_err(|e| e.to_string())?;
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if metadata.file_attributes() & 0x400 != 0 && resolved != root {
                    return Err("Jonction interdite dans les banques".into());
                }
            }
            if metadata.file_type().is_symlink() && resolved != root {
                return Err("Lien interdit dans les banques".into());
            }
            if resolved == root {
                break;
            }
        }
        current = candidate.parent();
    }
    Ok(())
}
fn read(path: &Path) -> Result<Value, String> {
    serde_json::from_slice(&fs::read(path).map_err(|e| format!("{} : {e}", path.display()))?)
        .map_err(|e| format!("{} : {e}", path.display()))
}
pub fn atomic(path: &Path, value: &Value) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
    let parent = path.parent().ok_or("Chemin invalide")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let temporary = parent.join(format!(".{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|e| e.to_string())?;
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(|e| e.to_string())?;
        if read(&temporary)? != *value {
            return Err("Contrôle d’écriture de banque échoué".into());
        }
        fs::rename(&temporary, path).map_err(|e| e.to_string())
    })();
    if temporary.exists() {
        let _ = fs::remove_file(temporary);
    }
    result
}
fn summary(family: Family, bank: &Value) -> Value {
    let mut result = bank.clone();
    let count = bank
        .get(family.content())
        .and_then(Value::as_array)
        .map_or(0, Vec::len);
    result[family.content()] = json!([]);
    result["contentLoaded"] = json!(false);
    result["contentCount"] = json!(count);
    // Detailed assistant settings belong to the bank, not to the tile index.
    if matches!(family, Family::Assistants) {
        if let Some(object) = result.as_object_mut() {
            object.remove("fallbackResponses");
        }
    }
    result
}
fn write_bank(root: &Path, family: Family, bank: &Value) -> Result<(), String> {
    let directory = directory(root, id(bank)?);
    let path = directory.join("bank.json");
    confined(root, &path)?;
    if path.exists() {
        let previous = read(&path)?;
        if previous == *bank {
            return atomic(&directory.join("descriptor.json"), &summary(family, bank));
        }
        atomic(&directory.join("bank.previous.json"), &previous)?;
    }
    atomic(&path, bank)?;
    atomic(&directory.join("descriptor.json"), &summary(family, bank))
}
fn migrate_image(root: &Path, bank: &Value) -> Result<Value, String> {
    let mut converted = bank.clone();
    for field in ["tileImageRef", "avatarRef"] {
        if let Some(reference) = bank[field].as_str().filter(|value| !value.is_empty()) {
            let source = root.join(reference.replace('\\', "/"));
            let canonical_root = root.canonicalize().map_err(|e| e.to_string())?;
            let source = source
                .canonicalize()
                .map_err(|e| format!("Image de banque absente : {reference} ({e})"))?;
            if !source.starts_with(&canonical_root) {
                return Err("Image de banque hors du catalogue".into());
            }
            let bytes = fs::read(&source).map_err(|e| e.to_string())?;
            let extension = source
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or("png");
            let name = format!("{field}-{:x}.{extension}", Sha256::digest(&bytes));
            let directory = directory(root, id(bank)?);
            confined(root, &directory)?;
            fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
            let destination = directory.join(&name);
            if !destination.exists() {
                fs::write(&destination, &bytes).map_err(|e| e.to_string())?;
            }
            if fs::read(&destination).map_err(|e| e.to_string())? != bytes {
                return Err("Migration : image différente de la source".into());
            }
            converted[field] = json!(format!(
                "banks/{}/{}",
                directory.file_name().unwrap().to_string_lossy(),
                name
            ));
        }
    }
    Ok(converted)
}
pub fn ensure(root: &Path, family: Family) -> Result<(), String> {
    fs::create_dir_all(root).map_err(|e| e.to_string())?;
    for child in [
        "banks",
        "migration-staging",
        "index.json",
        "migration-v1.json",
    ] {
        confined(root, &root.join(child))?;
    }
    let source = root.join(family.legacy());
    confined(root, &source)?;
    if source.exists() {
        let legacy = read(&source)?;
        if legacy.get("version").and_then(Value::as_u64).unwrap_or(1) != 1 {
            return Err("Version de catalogue ancien non prise en charge".into());
        }
        let sources = legacy
            .get(family.key())
            .and_then(Value::as_array)
            .ok_or("Catalogue ancien invalide")?;
        let banks = sources
            .iter()
            .map(|bank| migrate_image(root, bank))
            .collect::<Result<Vec<_>, _>>()?;
        let receipt_path = root.join("migration-v1.json");
        let receipt: Receipt = if receipt_path.exists() {
            serde_json::from_value(read(&receipt_path)?).map_err(|e| e.to_string())?
        } else {
            Receipt::default()
        };
        let mut seen = HashSet::new();
        for bank in &banks {
            let bank_id = id(bank)?;
            if !seen.insert(bank_id) {
                return Err(format!("Identifiant de banque dupliqué : {bank_id}"));
            }
            if !bank.get(family.content()).is_some_and(Value::is_array) {
                return Err(format!("Contenu de banque invalide : {bank_id}"));
            }
            let path = directory(root, bank_id).join("bank.json");
            if path.exists() {
                let current = read(&path)?;
                if current != *bank && receipt.sources.get(bank_id) != Some(&hash(&current)) {
                    return Err(format!("Ancien catalogue restauré : conflit avec la banque {bank_id}. Les deux versions sont conservées ; aucune bascule effectuée."));
                }
            }
        }
        // Validate every staged document before touching the live store.
        let staging = root.join("migration-staging");
        for bank in &banks {
            let target = directory(&staging, id(bank)?).join("bank.json");
            confined(root, &target)?;
            atomic(&target, bank)?;
        }
        for bank in &banks {
            let staged = read(&directory(&staging, id(bank)?).join("bank.json"))?;
            if staged != *bank {
                return Err("Migration : contenu différent de la source".into());
            }
        }
        for bank in &banks {
            write_bank(root, family, bank)?;
        }
        let mut sources = receipt.sources;
        for bank in &banks {
            sources.insert(id(bank)?.to_owned(), hash(bank));
        }
        atomic(
            &receipt_path,
            &serde_json::to_value(Receipt { sources }).map_err(|e| e.to_string())?,
        )?;
        rebuild(root, family)?;
        // Keep the original, byte for byte. Do not erase an older backup.
        let backup = root.join(format!(
            "{}.{}.legacy",
            family.legacy(),
            uuid::Uuid::new_v4()
        ));
        fs::rename(&source, backup).map_err(|e| e.to_string())?;
        if staging.exists() {
            fs::remove_dir_all(staging).map_err(|e| e.to_string())?;
        }
    }
    if !root.join("index.json").exists() {
        rebuild(root, family)?;
    }
    Ok(())
}
pub fn rebuild(root: &Path, family: Family) -> Result<Value, String> {
    let mut banks = Vec::new();
    let mut errors = Vec::new();
    let directory_root = root.join("banks");
    if directory_root.exists() {
        for entry in fs::read_dir(&directory_root).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            if !entry.file_type().map_err(|e| e.to_string())?.is_dir() {
                continue;
            }
            let path = entry.path().join("bank.json");
            if let Err(message) = confined(root, &path) {
                errors.push(json!({"path":path.to_string_lossy(),"message":message}));
                continue;
            }
            match read(&path) {
                Ok(bank)
                    if id(&bank).is_ok()
                        && bank[family.content()].is_array()
                        && directory(root, id(&bank)?) == entry.path() =>
                {
                    let descriptor = summary(family, &bank);
                    atomic(&entry.path().join("descriptor.json"), &descriptor)?;
                    banks.push(descriptor);
                }
                result => {
                    let descriptor = entry.path().join("descriptor.json");
                    if descriptor.exists() {
                        fs::remove_file(descriptor).map_err(|e| e.to_string())?;
                    }
                    errors.push(json!({ "path": path.to_string_lossy(), "message": result.err().unwrap_or_else(|| "Identifiant ou dossier invalide".into()) }));
                }
            }
        }
    }
    for bank in &mut banks {
        bank["resourceModifiedAt"] = json!(bank_modified_at(root, id(bank)?));
    }
    banks.sort_by_key(|bank| bank["name"].as_str().unwrap_or("").to_lowercase());
    let value = json!({ "version": 2, "banks": banks, "errors": errors });
    atomic(&root.join("index.json"), &value)?;
    Ok(value)
}
pub fn catalog(root: &Path, family: Family) -> Result<Value, String> {
    ensure(root, family)?;
    let index = read(&root.join("index.json")).or_else(|_| rebuild(root, family))?;
    if index["version"] != 2 || !index["banks"].is_array() {
        rebuild(root, family)?;
    }
    // Descriptor scan recovers saves interrupted between bank and index writes,
    // without reading all detailed HTML/images during ordinary listing.
    let mut banks = Vec::new();
    let mut errors = Vec::new();
    let directory_root = root.join("banks");
    if directory_root.exists() {
        for entry in fs::read_dir(directory_root).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            if !entry.file_type().map_err(|e| e.to_string())?.is_dir() {
                continue;
            }
            let descriptor = entry.path().join("descriptor.json");
            let content = entry.path().join("bank.json");
            if let Err(message) = confined(root, &descriptor).and_then(|_| confined(root, &content))
            {
                errors.push(json!({"path":entry.path().to_string_lossy(),"message":message}));
                continue;
            }
            let newer_content = fs::metadata(&content).and_then(|meta| meta.modified()).ok()
                > fs::metadata(&descriptor)
                    .and_then(|meta| meta.modified())
                    .ok();
            let value = if newer_content {
                Err("Descripteur à reconstruire".into())
            } else {
                read(&descriptor)
            };
            match value {
                Ok(value) if id(&value).is_ok() && directory(root, id(&value)?) == entry.path() => banks.push(value),
                Ok(_) => errors.push(json!({ "path": descriptor.to_string_lossy(), "message": "Descripteur invalide" })),
                Err(_) => match read(&entry.path().join("bank.json")) {
                    Ok(bank) if id(&bank).is_ok() && bank[family.content()].is_array() && directory(root, id(&bank)?) == entry.path() => {
                        let descriptor = summary(family, &bank);
                        atomic(&entry.path().join("descriptor.json"), &descriptor)?;
                        banks.push(descriptor);
                    },
                    result => errors.push(json!({ "path": entry.path().to_string_lossy(), "message": result.err().unwrap_or_else(|| "Banque invalide".into()) }))
                }
            }
        }
    }
    banks.sort_by_key(|bank| bank["name"].as_str().unwrap_or("").to_lowercase());
    for bank in &mut banks {
        bank["resourceModifiedAt"] = json!(bank_modified_at(root, id(bank)?));
    }
    Ok(json!({"version":2,"banks":banks,"errors":errors}))
}
pub fn load(root: &Path, family: Family, bank_id: &str) -> Result<Value, String> {
    ensure(root, family)?;
    let path = directory(root, bank_id).join("bank.json");
    confined(root, &path)?;
    let bank = read(&path)?;
    if id(&bank)? != bank_id || !bank.get(family.content()).is_some_and(Value::is_array) {
        return Err("Identifiant ou contenu de banque incohérent".into());
    }
    Ok(bank)
}
pub fn all(root: &Path, family: Family) -> Result<Vec<Value>, String> {
    let catalog = catalog(root, family)?;
    catalog["banks"]
        .as_array()
        .ok_or("Annuaire invalide")?
        .iter()
        .map(|entry| load(root, family, id(entry)?))
        .collect()
}
pub fn upsert(root: &Path, family: Family, banks: &[Value]) -> Result<(), String> {
    ensure(root, family)?;
    let mut seen = HashSet::new();
    for bank in banks {
        if !seen.insert(id(bank)?) {
            return Err("Banque dupliquée dans l’enregistrement".into());
        }
        if !bank.get(family.content()).is_some_and(Value::is_array) {
            return Err("Contenu de banque absent : enregistrement refusé".into());
        }
    }
    for bank in banks {
        write_bank(root, family, bank)?;
    }
    let catalog = catalog(root, family)?;
    atomic(&root.join("index.json"), &catalog)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root = std::env::temp_dir()
                .join(format!("paideia-individual-banks-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&root).unwrap();
            Self(root)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let temp = std::env::temp_dir().canonicalize().unwrap();
            let root = self.0.canonicalize().unwrap();
            assert!(root.starts_with(&temp) && root != temp);
            fs::remove_dir_all(root).unwrap();
        }
    }
    fn bank(family: Family, id: &str) -> Value {
        let mut bank = json!({"id":id,"name":id,"revision":7,"projectPaths":["lesson"],"collectionIds":["SSI"]});
        bank[family.content()] = json!([{ "id":"entry-id", "term":"Term", "definitionHtml":"<p><img src=\"data:image/png;base64,AAAA\"></p>" }]);
        bank
    }
    #[test]
    #[ignore = "Explicit read-only source directory required; conversion uses temporary copies only"]
    fn migration_from_readonly_catalog_copies() {
        let source_root = PathBuf::from(std::env::var_os("PAIDEIA_BANK_TEST_SOURCE_ROOT").expect("read-only source root"));
        for (family, directory_name) in [(Family::Questions,"question-banks"),(Family::References,"reference-banks"),(Family::Assistants,"assistants")] {
            let source = source_root.join(directory_name);
            let legacy_path = source.join(family.legacy());
            if !legacy_path.is_file() { continue; }
            let original_bytes = fs::read(&legacy_path).unwrap();
            let legacy: Value = serde_json::from_slice(&original_bytes).unwrap();
            let banks = legacy[family.key()].as_array().unwrap();
            let fixture = Fixture::new();
            fs::write(fixture.0.join(family.legacy()), &original_bytes).unwrap();
            for bank in banks {
                for field in ["tileImageRef", "avatarRef"] {
                    if let Some(reference) = bank[field].as_str().filter(|value| !value.is_empty()) {
                        let source_file = source.join(reference).canonicalize().unwrap();
                        assert!(source_file.starts_with(source.canonicalize().unwrap()));
                        let target = fixture.0.join(reference);
                        confined(&fixture.0, &target).unwrap();
                        fs::create_dir_all(target.parent().unwrap()).unwrap();
                        fs::copy(source_file, target).unwrap();
                    }
                }
            }
            ensure(&fixture.0, family).unwrap();
            assert_eq!(catalog(&fixture.0,family).unwrap()["banks"].as_array().unwrap().len(),banks.len());
            for original in banks {
                let migrated = load(&fixture.0, family, id(original).unwrap()).unwrap();
                assert_eq!(migrated, migrate_image(&fixture.0,original).unwrap());
                match family {
                    Family::Questions => { serde_json::from_value::<crate::models::QuestionBankResource>(migrated).unwrap(); },
                    Family::References => { serde_json::from_value::<crate::models::ReferenceBankResource>(migrated).unwrap(); },
                    Family::Assistants => { serde_json::from_value::<crate::models::GlossaryAssistantResource>(migrated).unwrap(); }
                }
            }
            assert_eq!(fs::read(&legacy_path).unwrap(),original_bytes,"real source catalog must remain unchanged");
            eprintln!("Validated {directory_name}: {} real banks on temporary copies",banks.len());
        }
    }
    #[test]
    fn migrates_all_families_without_losing_ids_html_settings_or_images() {
        for family in [Family::Questions, Family::References, Family::Assistants] {
            let fixture = Fixture::new();
            let root = &fixture.0;
            let mut a = bank(family, "a");
            fs::write(root.join("tile.png"), b"image bytes").unwrap();
            a["tileImageRef"] = json!("tile.png");
            let legacy = json!({"version":1, family.key():[a.clone(),bank(family,"b")]});
            let original = serde_json::to_vec(&legacy).unwrap();
            fs::write(root.join(family.legacy()), &original).unwrap();
            let catalog = catalog(root, family).unwrap();
            assert_eq!(catalog["banks"].as_array().unwrap().len(), 2);
            assert!(!serde_json::to_string(&catalog).unwrap().contains("base64"));
            let loaded = load(root, family, "a").unwrap();
            assert_eq!(loaded[family.content()], a[family.content()]);
            assert_eq!(loaded["id"], a["id"]);
            assert_eq!(loaded["revision"], a["revision"]);
            assert_eq!(loaded["projectPaths"], a["projectPaths"]);
            assert_eq!(
                fs::read(root.join(loaded["tileImageRef"].as_str().unwrap())).unwrap(),
                b"image bytes"
            );
            assert!(fs::read_dir(root).unwrap().any(|entry| entry
                .unwrap()
                .path()
                .extension()
                .is_some_and(|extension| extension == "legacy")));
            assert!(!fs::read_to_string(root.join("migration-v1.json"))
                .unwrap()
                .contains("definitionHtml"));
            // Restoring the same old catalog is idempotent, even after a restart.
            fs::write(root.join(family.legacy()), original).unwrap();
            assert_eq!(
                super::catalog(root, family).unwrap()["banks"]
                    .as_array()
                    .unwrap()
                    .len(),
                2
            );
        }
    }
    #[test]
    fn saves_only_target_bank_and_retains_recoverable_previous_version() {
        let fixture = Fixture::new();
        let root = &fixture.0;
        let family = Family::References;
        upsert(root, family, &[bank(family, "a"), bank(family, "b")]).unwrap();
        let path_b = directory(root, "b").join("bank.json");
        let modified = fs::metadata(&path_b).unwrap().modified().unwrap();
        let mut a = load(root, family, "a").unwrap();
        a["name"] = json!("Changed");
        upsert(root, family, &[a.clone()]).unwrap();
        assert_eq!(fs::metadata(path_b).unwrap().modified().unwrap(), modified);
        assert_eq!(
            read(&directory(root, "a").join("bank.previous.json")).unwrap()["name"],
            "a"
        );
        assert_eq!(load(root, family, "a").unwrap(), a);
        assert_eq!(
            catalog(root, family).unwrap()["banks"][1]["name"],
            "Changed"
        );
    }
    #[test]
    fn resource_sort_dates_follow_content_not_descriptor_rewrites() {
        let fixture = Fixture::new();
        for family in [Family::Questions, Family::References, Family::Assistants] {
            let root = fixture.0.join(family.legacy());
            upsert(&root, family, &[bank(family, "a")]).unwrap();
            let path = directory(&root, "a").join("bank.json");
            let date = std::time::UNIX_EPOCH + std::time::Duration::from_secs(1_600_000_000);
            fs::OpenOptions::new().write(true).open(&path).unwrap().set_times(fs::FileTimes::new().set_modified(date)).unwrap();
            let before = catalog(&root, family).unwrap();
            assert_eq!(before["banks"][0]["resourceModifiedAt"], json!(1_600_000_000_000_i64));
            assert_eq!(before["banks"][0]["contentLoaded"], false);
            upsert(&root, family, &[bank(family, "a")]).unwrap();
            assert_eq!(catalog(&root, family).unwrap()["banks"][0]["resourceModifiedAt"], before["banks"][0]["resourceModifiedAt"]);
            assert!(load(&root, family, "a").unwrap().get("resourceModifiedAt").is_none(), "display date must not pollute bank content");
        }
    }
    #[test]
    fn index_reconstruction_isolates_corruption_and_never_overwrites_bad_bank() {
        let fixture = Fixture::new();
        let root = &fixture.0;
        let family = Family::Questions;
        upsert(root, family, &[bank(family, "a"), bank(family, "b")]).unwrap();
        let bad = directory(root, "a").join("bank.json");
        fs::write(&bad, b"broken").unwrap();
        fs::remove_file(root.join("index.json")).unwrap();
        let index = catalog(root, family).unwrap();
        assert_eq!(index["banks"].as_array().unwrap().len(), 1);
        assert!(!index["errors"].as_array().unwrap().is_empty());
        assert!(load(root, family, "a").is_err());
        assert_eq!(fs::read(bad).unwrap(), b"broken");
        assert_eq!(load(root, family, "b").unwrap()["id"], "b");
    }
    #[test]
    fn restored_legacy_conflict_preserves_both_versions() {
        let fixture = Fixture::new();
        let root = &fixture.0;
        let family = Family::Assistants;
        let legacy = json!({"version":1,"assistants":[bank(family,"a")]});
        fs::write(
            root.join(family.legacy()),
            serde_json::to_vec(&legacy).unwrap(),
        )
        .unwrap();
        ensure(root, family).unwrap();
        let mut edited = load(root, family, "a").unwrap();
        edited["name"] = json!("Newer edit");
        upsert(root, family, &[edited.clone()]).unwrap();
        fs::write(
            root.join(family.legacy()),
            serde_json::to_vec(&legacy).unwrap(),
        )
        .unwrap();
        assert!(ensure(root, family).is_err());
        assert_eq!(
            read(&directory(root, "a").join("bank.json")).unwrap(),
            edited
        );
        assert_eq!(read(&root.join(family.legacy())).unwrap(), legacy);
    }
    #[test]
    fn interrupted_conversion_resumes_without_duplicates_and_deletion_is_local() {
        let fixture = Fixture::new();
        let root = &fixture.0;
        let family = Family::References;
        let a = bank(family, "../../a");
        let b = bank(family, "b");
        fs::write(
            root.join(family.legacy()),
            serde_json::to_vec(&json!({"version":1,"referenceBanks":[a.clone(),b.clone()]}))
                .unwrap(),
        )
        .unwrap();
        write_bank(root, family, &a).unwrap(); // first bank committed before interruption
        ensure(root, family).unwrap();
        assert_eq!(
            catalog(root, family).unwrap()["banks"]
                .as_array()
                .unwrap()
                .len(),
            2
        );
        remove(root, family, "../../a").unwrap();
        assert_eq!(
            catalog(root, family).unwrap()["banks"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
        assert_eq!(load(root, family, "b").unwrap(), b);
        assert!(root.join("deleted").is_dir());
    }
    #[test]
    fn interruption_between_content_and_descriptor_recovers_the_index() {
        let fixture = Fixture::new();
        let root = &fixture.0;
        let family = Family::Questions;
        upsert(root, family, &[bank(family, "a")]).unwrap();
        let mut a = load(root, family, "a").unwrap();
        a["name"] = json!("Committed content");
        atomic(&directory(root, "a").join("bank.json"), &a).unwrap();
        fs::remove_file(directory(root, "a").join("descriptor.json")).unwrap();
        assert_eq!(
            catalog(root, family).unwrap()["banks"][0]["name"],
            "Committed content"
        );
    }
    #[cfg(windows)]
    #[test]
    fn junction_cannot_read_write_or_delete_a_bank_outside_the_catalog() {
        let fixture = Fixture::new();
        let external = Fixture::new();
        let root = &fixture.0;
        let family = Family::References;
        ensure(root, family).unwrap();
        fs::create_dir_all(root.join("banks")).unwrap();
        let source = external.0.join("bank.json");
        fs::write(&source, b"outside data").unwrap();
        let link = directory(root, "a");
        let output = std::process::Command::new("cmd")
            .args(["/C", "mklink", "/J"])
            .arg(&link)
            .arg(&external.0)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(load(root, family, "a").is_err());
        assert!(upsert(root, family, &[bank(family, "a")]).is_err());
        assert!(remove(root, family, "a").is_err());
        assert_eq!(fs::read(source).unwrap(), b"outside data");
        fs::remove_dir(link).unwrap();
    }
}
pub fn remove(root: &Path, family: Family, bank_id: &str) -> Result<(), String> {
    ensure(root, family)?;
    let directory = directory(root, bank_id);
    confined(root, &directory)?;
    confined(root, &root.join("deleted"))?;
    if directory.exists() {
        let trash = root.join("deleted");
        fs::create_dir_all(&trash).map_err(|e| e.to_string())?;
        fs::rename(directory, trash.join(uuid::Uuid::new_v4().to_string()))
            .map_err(|e| e.to_string())?;
    }
    let catalog = catalog(root, family)?;
    atomic(&root.join("index.json"), &catalog)?;
    Ok(())
}
