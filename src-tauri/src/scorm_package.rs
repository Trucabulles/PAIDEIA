use crate::importer::extract_rise_course_payload_from_content_root;
use base64::engine::general_purpose::{STANDARD, STANDARD_NO_PAD, URL_SAFE, URL_SAFE_NO_PAD};
use base64::Engine;
#[cfg(test)]
use chrono::Utc;
use regex::Regex;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::ZipArchive;

const MAX_DISCOVERY_TEXT_BYTES: u64 = 64 * 1024 * 1024;
const MAX_DISCOVERY_FILES: usize = 20_000;
const MAX_SCORM_ARCHIVE_BYTES: u64 = 4 * 1024 * 1024 * 1024;
const MAX_SCORM_EXPANDED_BYTES: u64 = 4 * 1024 * 1024 * 1024;
const MAX_SCORM_ARCHIVE_ENTRIES: usize = 5_000;

const FORBIDDEN_EXTENSIONS: &[&str] = &[
    "bat", "cmd", "com", "cpl", "dll", "drv", "exe", "hta", "lnk", "msi", "msp", "ocx", "ps1",
    "psm1", "reg", "scr", "sys", "vbe", "vbs", "wsf", "wsh",
];

fn rejected_scorm_archive(reason: impl AsRef<str>) -> String {
    format!("PAIDEIA_SECURITY_ARCHIVE_REJECTED\n{}", reason.as_ref())
}

#[derive(Debug, Clone)]
pub(crate) struct ScormPayloadCandidate {
    pub(crate) payload: Value,
    pub(crate) source_path: PathBuf,
    pub(crate) content_root: PathBuf,
    pub(crate) detector: String,
    pub(crate) confidence: u16,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScormImportDiagnostic {
    pub(crate) engine: &'static str,
    pub(crate) manifest_path: String,
    pub(crate) launch_path: Option<String>,
    pub(crate) payload_path: String,
    pub(crate) detector: String,
    pub(crate) confidence: u16,
}

/// Security gate shared by both SCORM import engines. A rejected package must
/// never be retried through the historical engine.
pub(crate) fn preflight_scorm_archive(source: &Path) -> Result<(), String> {
    let is_zip_extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("zip"))
        .unwrap_or(false);
    if !is_zip_extension {
        return Err(rejected_scorm_archive(
            "Le paquet SCORM doit être fourni sous la forme d’un fichier ZIP",
        ));
    }
    let archive_size = fs::metadata(source).map_err(|err| err.to_string())?.len();
    if archive_size > MAX_SCORM_ARCHIVE_BYTES {
        return Err(rejected_scorm_archive(
            "Le paquet SCORM dépasse la taille maximale autorisée de 4 Go",
        ));
    }
    let mut file = fs::File::open(source).map_err(|err| err.to_string())?;
    let mut signature = [0_u8; 4];
    let signature_length = file.read(&mut signature).map_err(|err| err.to_string())?;
    let regular_zip =
        signature_length == 4 && (signature == *b"PK\x03\x04" || signature == *b"PK\x05\x06");
    if !regular_zip {
        return Err(rejected_scorm_archive(
            "Le paquet SCORM doit être un ZIP simple, non exécutable et non fractionné",
        ));
    }
    drop(file);
    let file = fs::File::open(source).map_err(|err| err.to_string())?;
    let mut archive = ZipArchive::new(file)
        .map_err(|_| rejected_scorm_archive("Le paquet SCORM n’est pas une archive ZIP valide"))?;
    if archive.offset() != 0 {
        return Err(rejected_scorm_archive(
            "Le paquet SCORM contient des données préfixées ou plusieurs archives ZIP concaténées",
        ));
    }
    if archive.len() > MAX_SCORM_ARCHIVE_ENTRIES {
        return Err(rejected_scorm_archive(format!(
            "Le paquet SCORM contient trop d’éléments (maximum {})",
            MAX_SCORM_ARCHIVE_ENTRIES
        )));
    }
    let mut forbidden = Vec::new();
    let mut paths = HashSet::new();
    let mut expanded_bytes = 0_u64;

    for index in 0..archive.len() {
        let entry = archive.by_index(index).map_err(|err| err.to_string())?;
        let entry_name = normalize_archive_name(entry.name());
        let Some(enclosed) = entry.enclosed_name() else {
            forbidden.push(entry_name);
            continue;
        };
        if enclosed.as_os_str().is_empty() {
            continue;
        }
        let normalized_path = enclosed
            .to_string_lossy()
            .replace('\\', "/")
            .to_ascii_lowercase();
        if !paths.insert(normalized_path) {
            return Err(rejected_scorm_archive(format!(
                "Chemin dupliqué dans le paquet SCORM : {entry_name}"
            )));
        }
        let forbidden_special_type = entry
            .unix_mode()
            .map(|mode| {
                let kind = mode & 0o170000;
                kind != 0 && kind != 0o100000 && kind != 0o040000
            })
            .unwrap_or(false);
        if forbidden_special_type {
            forbidden.push(entry_name);
            continue;
        }
        if entry.is_dir() {
            continue;
        }

        expanded_bytes = expanded_bytes.checked_add(entry.size()).ok_or_else(|| {
            rejected_scorm_archive("Taille décompressée du paquet SCORM invalide")
        })?;
        if expanded_bytes > MAX_SCORM_EXPANDED_BYTES {
            return Err(rejected_scorm_archive(
                "Le paquet SCORM décompressé dépasse 4 Go",
            ));
        }

        let forbidden_extension = Path::new(&entry_name)
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| FORBIDDEN_EXTENSIONS.contains(&value.to_ascii_lowercase().as_str()))
            .unwrap_or(false);
        if forbidden_extension {
            forbidden.push(entry_name);
        }
    }

    forbidden.sort();
    forbidden.dedup();
    if forbidden.is_empty() {
        return Ok(());
    }

    Err(format!(
        "PAIDEIA_SECURITY_FORBIDDEN_FILES\n{}",
        forbidden
            .iter()
            .map(|path| format!("- {path}"))
            .collect::<Vec<_>>()
            .join("\n")
    ))
}

pub(crate) fn extract_scorm_archive(source: &Path, destination: &Path) -> Result<(), String> {
    let file = fs::File::open(source).map_err(|err| err.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|err| err.to_string())?;

    let mut actual_total = 0_u64;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|err| err.to_string())?;
        let enclosed = entry.enclosed_name().ok_or_else(|| {
            format!(
                "PAIDEIA_SECURITY_FORBIDDEN_PATH\n{}",
                normalize_archive_name(entry.name())
            )
        })?;
        let output_path = destination.join(&enclosed);
        if entry.is_dir() {
            fs::create_dir_all(&output_path).map_err(|err| err.to_string())?;
            continue;
        }
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        }
        let expected_size = entry.size();
        let mut signature = [0_u8; 4];
        let signature_length = entry.read(&mut signature).map_err(|err| err.to_string())?;
        let executable = signature_length >= 2 && signature[..2] == *b"MZ";
        let nested_zip = signature_length == 4
            && (signature == *b"PK\x03\x04"
                || signature == *b"PK\x05\x06"
                || signature == *b"PK\x07\x08");
        if executable || nested_zip {
            return Err(format!(
                "PAIDEIA_SECURITY_FORBIDDEN_FILES\n- {}",
                normalize_archive_name(entry.name())
            ));
        }
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&output_path)
            .map_err(|err| err.to_string())?;
        output
            .write_all(&signature[..signature_length])
            .map_err(|err| err.to_string())?;
        let remaining_limit = expected_size
            .saturating_sub(signature_length as u64)
            .saturating_add(1);
        let copied = std::io::copy(&mut entry.take(remaining_limit), &mut output)
            .map_err(|err| err.to_string())?;
        let actual_size = (signature_length as u64)
            .checked_add(copied)
            .ok_or_else(|| {
                rejected_scorm_archive("Taille décompressée du paquet SCORM invalide")
            })?;
        if actual_size != expected_size {
            return Err(rejected_scorm_archive(format!(
                "Taille incohérente dans le paquet SCORM : {}",
                enclosed.display()
            )));
        }
        actual_total = actual_total.checked_add(actual_size).ok_or_else(|| {
            rejected_scorm_archive("Taille décompressée du paquet SCORM invalide")
        })?;
        if actual_total > MAX_SCORM_EXPANDED_BYTES {
            return Err(rejected_scorm_archive(
                "Le paquet SCORM décompressé dépasse 4 Go",
            ));
        }
        output.sync_all().map_err(|err| err.to_string())?;
    }
    Ok(())
}

pub(crate) fn find_manifest(extracted_root: &Path) -> Option<PathBuf> {
    walk_files(extracted_root).into_iter().find(|path| {
        path.file_name()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("imsmanifest.xml"))
            .unwrap_or(false)
    })
}

pub(crate) fn resolve_manifest_launch_path(
    manifest_path: &Path,
    extracted_root: &Path,
) -> Result<Option<PathBuf>, String> {
    let raw = fs::read_to_string(manifest_path).map_err(|err| err.to_string())?;
    let resource_matcher = Regex::new(r#"(?is)<(?:[A-Za-z0-9_-]+:)?resource\b([^>]*)>"#)
        .map_err(|err| err.to_string())?;
    let href_matcher =
        Regex::new(r#"(?i)\bhref\s*=\s*[\"']([^\"']+)[\"']"#).map_err(|err| err.to_string())?;
    let scorm_type_matcher = Regex::new(r#"(?i)(?:[A-Za-z0-9_-]+:)?scormtype\s*=\s*[\"']sco[\"']"#)
        .map_err(|err| err.to_string())?;

    let mut resources = resource_matcher
        .captures_iter(&raw)
        .filter_map(|captures| {
            let attributes = captures.get(1)?.as_str();
            let href = href_matcher.captures(attributes)?.get(1)?.as_str();
            Some((scorm_type_matcher.is_match(attributes), href.to_string()))
        })
        .collect::<Vec<_>>();
    resources.sort_by_key(|(is_sco, _)| !*is_sco);

    let manifest_root = manifest_path.parent().unwrap_or(extracted_root);
    for (_, href) in resources {
        let href = decode_xml_path(&href);
        let href = href.split(['?', '#']).next().unwrap_or("");
        if href.trim().is_empty() {
            continue;
        }
        let candidate = manifest_root.join(href.replace('/', std::path::MAIN_SEPARATOR_STR));
        if candidate.is_file() && path_stays_inside(extracted_root, &candidate) {
            return Ok(Some(candidate));
        }
    }
    Ok(None)
}

pub(crate) fn discover_course_payload(
    extracted_root: &Path,
    launch_path: Option<&Path>,
) -> Result<ScormPayloadCandidate, String> {
    let mut files = walk_files(extracted_root)
        .into_iter()
        .filter(|path| is_discovery_text_file(path))
        .filter(|path| {
            fs::metadata(path)
                .map(|metadata| metadata.len() <= MAX_DISCOVERY_TEXT_BYTES)
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();
    files.sort_by_key(|path| discovery_priority(path, launch_path));
    files.truncate(MAX_DISCOVERY_FILES);

    let known_roots = files
        .iter()
        .filter(|path| {
            path.file_name()
                .and_then(|value| value.to_str())
                .map(|value| value.eq_ignore_ascii_case("index.html"))
                .unwrap_or(false)
        })
        .filter_map(|path| path.parent().map(Path::to_path_buf))
        .collect::<Vec<_>>();
    for root in known_roots {
        if let Ok(payload) = extract_rise_course_payload_from_content_root(&root) {
            if let Some((payload, confidence)) = normalize_payload(payload) {
                let source_path = if root.join("runtime-data.js").is_file() {
                    root.join("runtime-data.js")
                } else {
                    root.join("index.html")
                };
                return Ok(ScormPayloadCandidate {
                    payload,
                    source_path,
                    content_root: resolve_content_root(&root, extracted_root),
                    detector: "signature-compatible-connue".to_string(),
                    confidence: confidence.max(95),
                });
            }
        }
    }

    let mut best: Option<ScormPayloadCandidate> = None;
    for path in files {
        let raw = match fs::read(&path) {
            Ok(raw) => raw,
            Err(_) => continue,
        };
        let text = String::from_utf8_lossy(&raw);
        for (payload, detector) in payloads_from_text(&text) {
            let Some((payload, confidence)) = normalize_payload(payload) else {
                continue;
            };
            let parent = path.parent().unwrap_or(extracted_root);
            let candidate = ScormPayloadCandidate {
                payload,
                source_path: path.clone(),
                content_root: resolve_content_root(parent, extracted_root),
                detector,
                confidence,
            };
            if best
                .as_ref()
                .map(|current| candidate.confidence > current.confidence)
                .unwrap_or(true)
            {
                best = Some(candidate);
            }
        }
    }

    best.ok_or_else(|| {
        "Importation impossible : aucune structure de cours compatible n’a été détectée dans le package SCORM."
            .to_string()
    })
}

fn payloads_from_text(text: &str) -> Vec<(Value, String)> {
    let mut results = Vec::new();
    if let Ok(value) = serde_json::from_str::<Value>(text.trim()) {
        results.push((value, "json-direct".to_string()));
    }

    let patterns = [
        (
            r#"(?s)deserialize\s*\(\s*[\"']([^\"']+)[\"']"#,
            "appel-de-serialisation",
        ),
        (
            r#"(?s)(?:window\.)?[A-Za-z_$][A-Za-z0-9_$]*\s*=\s*[\"']([A-Za-z0-9+/_=-]{64,})[\"']"#,
            "affectation-javascript",
        ),
        (
            r#"(?s)__jsonp\s*\([^,]+,\s*[\"']([^\"']+)[\"']"#,
            "chargeur-jsonp",
        ),
        (
            r#"[\"']([A-Za-z0-9+/_=-]{64,})[\"']"#,
            "candidat-base64-borne",
        ),
    ];
    let mut seen = HashSet::new();
    for (pattern, detector) in patterns {
        let Ok(matcher) = Regex::new(pattern) else {
            continue;
        };
        for captures in matcher.captures_iter(text) {
            let Some(encoded) = captures.get(1).map(|value| value.as_str()) else {
                continue;
            };
            if !seen.insert(encoded.to_string()) {
                continue;
            }
            if let Some(value) = decode_json_candidate(encoded) {
                results.push((value, detector.to_string()));
            }
        }
    }
    results
}

fn decode_json_candidate(encoded: &str) -> Option<Value> {
    for decoded in [
        STANDARD.decode(encoded),
        STANDARD_NO_PAD.decode(encoded),
        URL_SAFE.decode(encoded),
        URL_SAFE_NO_PAD.decode(encoded),
    ] {
        let Ok(decoded) = decoded else {
            continue;
        };
        if let Ok(value) = serde_json::from_slice::<Value>(&decoded) {
            return Some(value);
        }
    }
    None
}

fn normalize_payload(value: Value) -> Option<(Value, u16)> {
    fn visit(value: &Value, depth: usize) -> Option<(Value, u16)> {
        if depth > 8 {
            return None;
        }
        if let Some(course) = value.get("course") {
            if let Some(lessons) = course.get("lessons").and_then(Value::as_array) {
                let confidence = 90
                    + lessons
                        .iter()
                        .take(10)
                        .filter(|lesson| lesson.is_object())
                        .count() as u16;
                return Some((value.clone(), confidence.min(100)));
            }
        }
        if let Some(lessons) = value.get("lessons").and_then(Value::as_array) {
            if value.get("title").and_then(Value::as_str).is_some() {
                return Some((
                    serde_json::json!({ "course": value.clone() }),
                    82 + lessons.len().min(8) as u16,
                ));
            }
        }
        match value {
            Value::Object(object) => object.values().find_map(|child| visit(child, depth + 1)),
            Value::Array(values) => values.iter().find_map(|child| visit(child, depth + 1)),
            _ => None,
        }
    }
    visit(&value, 0)
}

fn resolve_content_root(candidate_root: &Path, extracted_root: &Path) -> PathBuf {
    for ancestor in candidate_root.ancestors() {
        if ancestor.join("assets").is_dir() {
            return ancestor.to_path_buf();
        }
        if ancestor == extracted_root {
            break;
        }
    }
    let conventional = extracted_root.join("scormcontent");
    if conventional.is_dir() {
        return conventional;
    }
    candidate_root.to_path_buf()
}

fn walk_files(root: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let mut directories = vec![root.to_path_buf()];
    while let Some(directory) = directories.pop() {
        let Ok(entries) = fs::read_dir(directory) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                directories.push(path);
            } else if path.is_file() {
                files.push(path);
                if files.len() >= MAX_DISCOVERY_FILES {
                    return files;
                }
            }
        }
    }
    files
}

fn is_discovery_text_file(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "html" | "htm" | "js" | "json"
            )
        })
        .unwrap_or(false)
}

fn discovery_priority(path: &Path, launch_path: Option<&Path>) -> u8 {
    if launch_path.map(|launch| launch == path).unwrap_or(false) {
        return 0;
    }
    match path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "runtime-data.js" => 1,
        "index.html" => 2,
        _ => 3,
    }
}

fn path_stays_inside(root: &Path, candidate: &Path) -> bool {
    let Ok(root) = fs::canonicalize(root) else {
        return false;
    };
    fs::canonicalize(candidate)
        .map(|candidate| candidate.starts_with(root))
        .unwrap_or(false)
}

pub(crate) fn write_scorm_import_diagnostic(
    project_root: &Path,
    diagnostic: &ScormImportDiagnostic,
) -> Result<(), String> {
    let imports_root = project_root.join("imports");
    fs::create_dir_all(&imports_root).map_err(|err| err.to_string())?;
    let raw = serde_json::to_string_pretty(diagnostic).map_err(|err| err.to_string())?;
    fs::write(imports_root.join("scorm-import-diagnostic.json"), raw).map_err(|err| err.to_string())
}

pub(crate) fn relative_display(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn decode_xml_path(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn normalize_archive_name(value: &str) -> String {
    value.replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    #[test]
    fn rejects_forbidden_executable_and_lists_it() {
        let archive_path = std::env::temp_dir().join(format!(
            "paideia-scorm-forbidden-{}.zip",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let file = fs::File::create(&archive_path).expect("create test archive");
        let mut archive = zip::ZipWriter::new(file);
        archive
            .start_file("assets/outil.exe", SimpleFileOptions::default())
            .expect("start executable");
        archive.write_all(b"MZpayload").expect("write executable");
        archive.finish().expect("finish archive");

        let error = preflight_scorm_archive(&archive_path).expect_err("archive must be rejected");
        assert!(error.starts_with("PAIDEIA_SECURITY_FORBIDDEN_FILES\n"));
        assert!(error.contains("assets/outil.exe"));
        fs::remove_file(archive_path).expect("remove test archive");
    }

    #[test]
    fn rejects_a_portable_executable_hidden_behind_an_image_extension() {
        let archive_path = std::env::temp_dir().join(format!(
            "paideia-scorm-disguised-{}.zip",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let file = fs::File::create(&archive_path).expect("create disguised archive");
        let mut archive = zip::ZipWriter::new(file);
        archive
            .start_file("assets/illustration.png", SimpleFileOptions::default())
            .expect("start disguised executable");
        archive
            .write_all(b"MZdisguised-payload")
            .expect("write disguised executable");
        archive.finish().expect("finish archive");

        preflight_scorm_archive(&archive_path).expect("metadata preflight should pass");
        let destination = archive_path.with_extension("extracted");
        fs::create_dir_all(&destination).expect("create extraction root");
        let error = extract_scorm_archive(&archive_path, &destination)
            .expect_err("archive must be rejected during its single extraction");
        assert!(error.contains("assets/illustration.png"));
        fs::remove_dir_all(destination).expect("remove extraction root");
        fs::remove_file(archive_path).expect("remove disguised archive");
    }

    #[test]
    fn rejects_a_nested_zip_during_the_single_extraction() {
        let archive_path = std::env::temp_dir().join(format!(
            "paideia-scorm-nested-{}.zip",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let file = fs::File::create(&archive_path).expect("create nested archive");
        let mut archive = zip::ZipWriter::new(file);
        archive
            .start_file("assets/archive.zip", SimpleFileOptions::default())
            .expect("start nested zip");
        archive
            .write_all(b"PK\x03\x04nested-payload")
            .expect("write nested zip");
        archive.finish().expect("finish archive");

        preflight_scorm_archive(&archive_path).expect("metadata preflight should pass");
        let destination = archive_path.with_extension("extracted");
        fs::create_dir_all(&destination).expect("create extraction root");
        let error = extract_scorm_archive(&archive_path, &destination)
            .expect_err("nested zip must be rejected");
        assert!(error.contains("assets/archive.zip"));
        fs::remove_dir_all(destination).expect("remove extraction root");
        fs::remove_file(archive_path).expect("remove nested archive");
    }

    #[test]
    fn rejects_duplicate_paths_before_extraction() {
        let archive_path = std::env::temp_dir().join(format!(
            "paideia-scorm-duplicate-{}.zip",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let file = fs::File::create(&archive_path).expect("create duplicate archive");
        let mut archive = zip::ZipWriter::new(file);
        archive
            .start_file("index.html", SimpleFileOptions::default())
            .expect("start first path");
        archive.write_all(b"first").expect("write first path");
        archive
            .start_file("INDEX.HTML", SimpleFileOptions::default())
            .expect("start duplicate path");
        archive.write_all(b"second").expect("write duplicate path");
        archive.finish().expect("finish archive");

        let error = preflight_scorm_archive(&archive_path).expect_err("duplicate must be rejected");
        assert!(error.contains("Chemin dupliqué"));
        fs::remove_file(archive_path).expect("remove duplicate archive");
    }

    #[test]
    fn rejects_concatenated_zip_archives() {
        fn single_file_zip(path: &str, content: &[u8]) -> Vec<u8> {
            let cursor = std::io::Cursor::new(Vec::<u8>::new());
            let mut archive = zip::ZipWriter::new(cursor);
            archive
                .start_file(path, SimpleFileOptions::default())
                .expect("start ZIP entry");
            archive.write_all(content).expect("write ZIP entry");
            archive.finish().expect("finish ZIP").into_inner()
        }

        let archive_path = std::env::temp_dir().join(format!(
            "paideia-scorm-concatenated-{}.zip",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let mut bytes = single_file_zip("first.txt", b"first");
        bytes.extend(single_file_zip("imsmanifest.xml", b"<manifest></manifest>"));
        fs::write(&archive_path, bytes).expect("write concatenated archive");

        let error = preflight_scorm_archive(&archive_path)
            .expect_err("concatenated ZIP archives must be rejected");
        assert!(error.contains("plusieurs archives ZIP concaténées"));
        fs::remove_file(archive_path).expect("remove concatenated archive");
    }

    #[test]
    fn accepts_a_regular_scorm_archive_without_forbidden_files() {
        let archive_path = std::env::temp_dir().join(format!(
            "paideia-scorm-safe-{}.zip",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let file = fs::File::create(&archive_path).expect("create safe archive");
        let mut archive = zip::ZipWriter::new(file);
        archive
            .start_file("imsmanifest.xml", SimpleFileOptions::default())
            .expect("start manifest");
        archive
            .write_all(b"<manifest></manifest>")
            .expect("write manifest");
        archive
            .start_file("index.html", SimpleFileOptions::default())
            .expect("start html");
        archive.write_all(b"<html></html>").expect("write html");
        archive.finish().expect("finish archive");

        preflight_scorm_archive(&archive_path).expect("safe archive should pass");
        fs::remove_file(archive_path).expect("remove safe archive");
    }

    #[test]
    fn detects_payload_without_relying_on_a_known_variable_name() {
        let payload = r#"{"course":{"title":"Cours test","lessons":[{"id":"lesson-1"}]}}"#;
        let encoded = STANDARD.encode(payload);
        let source = format!("window.futureUnknownName = \"{encoded}\";");
        let candidates = payloads_from_text(&source);
        let normalized = candidates
            .into_iter()
            .find_map(|(value, _)| normalize_payload(value))
            .expect("payload should be discovered semantically");
        assert_eq!(
            normalized
                .0
                .get("course")
                .and_then(|course| course.get("title"))
                .and_then(Value::as_str),
            Some("Cours test")
        );
    }

    #[test]
    fn reads_launch_resource_from_manifest() {
        let root = std::env::temp_dir().join(format!(
            "paideia-scorm-manifest-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        fs::create_dir_all(root.join("course")).expect("create course root");
        fs::write(root.join("course/index.html"), "<html></html>").expect("write launch file");
        fs::write(
            root.join("imsmanifest.xml"),
            r#"<manifest><resources><resource identifier="r1" adlcp:scormtype="sco" href="course/index.html" /></resources></manifest>"#,
        )
        .expect("write manifest");

        let launch = resolve_manifest_launch_path(&root.join("imsmanifest.xml"), &root)
            .expect("manifest should parse")
            .expect("launch should resolve");
        assert!(launch.ends_with(Path::new("course/index.html")));
        fs::remove_dir_all(root).expect("remove manifest fixture");
    }

    #[test]
    fn imports_a_package_whose_launch_page_and_course_payload_are_separated() {
        let fixture_root = std::env::temp_dir().join(format!(
            "paideia-scorm-end-to-end-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        fs::create_dir_all(&fixture_root).expect("create end-to-end fixture root");
        let archive_path = fixture_root.join("source.zip");
        let file = fs::File::create(&archive_path).expect("create end-to-end archive");
        let mut archive = zip::ZipWriter::new(file);
        let options = SimpleFileOptions::default();
        archive
            .start_file("imsmanifest.xml", options)
            .expect("start manifest");
        archive
            .write_all(
                br#"<manifest><resources><resource identifier="r1" adlcp:scormtype="sco" href="scormdriver/indexAPI.html" /></resources></manifest>"#,
            )
            .expect("write manifest");
        archive
            .start_file("scormdriver/indexAPI.html", options)
            .expect("start technical launch page");
        archive
            .write_all(b"<html><body>Technical launch page</body></html>")
            .expect("write technical launch page");
        let payload = serde_json::json!({
            "course": {
                "title": "Fixture import résilient",
                "lessons": [{
                    "id": "lesson-1",
                    "title": "Chapitre test",
                    "type": "blocks",
                    "items": [{
                        "type": "text",
                        "family": "text",
                        "variant": "paragraph",
                        "items": [{ "paragraph": "<p>Contenu visible.</p>" }]
                    }]
                }]
            }
        });
        archive
            .start_file("scormcontent/index.html", options)
            .expect("start content page");
        archive
            .write_all(
                format!(
                    "<script>window.unknownFutureVariable = \"{}\";</script>",
                    STANDARD.encode(serde_json::to_vec(&payload).expect("serialize payload"))
                )
                .as_bytes(),
            )
            .expect("write content page");
        archive.finish().expect("finish end-to-end archive");

        let result = crate::importer::import_scorm_zip_with_details(
            archive_path.to_string_lossy().as_ref(),
            fixture_root.to_string_lossy().as_ref(),
        )
        .expect("resilient package should import");
        assert!(result.project_root.join("project.json").is_file());
        assert!(result
            .project_root
            .join("imports/scorm-import-diagnostic.json")
            .is_file());

        fs::remove_dir_all(fixture_root).expect("remove end-to-end fixture");
    }
}
