use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// Shared protocol key across installed/portable builds. Opportunistic tampering
// deterrent only: a distributed application cannot keep this key secret.
const KEY: &[u8] = b"0oV+5715BkuOuIHLuW8eqIuAQWQJ1Fmd8KbG/CdGtZ4=";
const KEY_ID: &str = "paideia-v2";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Manifest {
    pub schema_version: u32,
    pub algorithm: String,
    key_id: String,
    pub mac: String,
}

#[derive(Debug, Clone)]
pub(super) struct Entry {
    pub path: String,
    pub size: u64,
    pub sha256: String,
}

fn mac(entries: &[Entry]) -> Hmac<Sha256> {
    let mut sorted: Vec<_> = entries.iter().collect();
    sorted.sort_by(|a, b| a.path.as_bytes().cmp(b.path.as_bytes()));
    let mut tree = Sha256::new();
    tree.update(b"PAIDEIA-FILE-TREE-V2\0");
    tree.update((sorted.len() as u64).to_be_bytes());
    for entry in sorted {
        tree.update(b"F");
        tree.update((entry.path.len() as u64).to_be_bytes());
        tree.update(entry.path.as_bytes());
        tree.update(entry.size.to_be_bytes());
        // Fixed-width lowercase hex generated internally, never from the manifest.
        tree.update(entry.sha256.as_bytes());
    }
    let mut result = <Hmac<Sha256> as Mac>::new_from_slice(KEY).expect("valid protocol key");
    result.update(b"PAIDEIA-ARCHIVE-INTEGRITY-V2\0");
    result.update(&tree.finalize());
    result
}

pub(super) fn create(entries: &[Entry]) -> Manifest {
    Manifest {
        schema_version: 2,
        algorithm: "HMAC-SHA-256".to_string(),
        key_id: KEY_ID.to_string(),
        mac: mac(entries)
            .finalize()
            .into_bytes()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect(),
    }
}

pub(super) fn parse(bytes: &[u8]) -> Result<Manifest, String> {
    let manifest: Manifest =
        serde_json::from_slice(bytes).map_err(|_| "Manifeste d’intégrité illisible".to_string())?;
    if manifest.schema_version != 2
        || manifest.algorithm != "HMAC-SHA-256"
        || manifest.key_id != KEY_ID
        || manifest.mac.len() != 64
        || !manifest.mac.bytes().all(|b| b.is_ascii_hexdigit())
    {
        return Err("Version ou manifeste d’intégrité non pris en charge".to_string());
    }
    Ok(manifest)
}

pub(super) fn verify(manifest: &Manifest, entries: &[Entry]) -> Result<(), String> {
    let expected: Vec<u8> = (0..64)
        .step_by(2)
        .map(|i| u8::from_str_radix(&manifest.mac[i..i + 2], 16).unwrap())
        .collect();
    mac(entries)
        .verify_slice(&expected)
        .map_err(|_| "Contrôle d’intégrité de l’archive en échec".to_string())
}
