//! Read only the fields used by library cards. Rich content and banks are never
//! instantiated or sanitized here; the normal workspace loader still owns that.
use serde::Deserialize;
use serde::de::IgnoredAny;
use std::{collections::HashMap, fs, path::{Path, PathBuf}, sync::{Mutex, OnceLock}, time::SystemTime};

#[derive(Deserialize)]
pub(crate) struct CardMetadata {
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(default, rename = "courseImageRef")]
    pub course_image_ref: Option<String>,
    #[serde(default, rename = "minimumPaideiaVersion", deserialize_with = "present_version")]
    minimum_version: Option<serde_json::Value>,
}
fn present_version<'de, D: serde::Deserializer<'de>>(reader: D) -> Result<Option<serde_json::Value>, D::Error> {
    serde_json::Value::deserialize(reader).map(Some)
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct CourseSummary {
    pub chapters: usize,
    pub activities: usize,
    pub imported: bool,
}
#[derive(Deserialize)]
struct Course { modules: Vec<Module> }
#[derive(Deserialize)]
struct Module { #[serde(default, alias = "lessons")] chapters: Vec<Chapter> }
#[derive(Deserialize)]
struct Chapter { pages: Vec<Page> }
#[derive(Deserialize)]
struct Page { blocks: Vec<Block> }
#[derive(Deserialize)]
struct Block {
    #[serde(default, rename = "sourceFormat")]
    source_format: Option<IgnoredAny>,
    #[serde(default, rename = "sourceBlockType")]
    source_type: Option<IgnoredAny>,
    #[serde(default, rename = "sourceRawHtml")]
    source_html: Option<IgnoredAny>,
}

type Stamp = (u64, SystemTime);
type Cache = HashMap<PathBuf, (Stamp, CourseSummary)>;
static SUMMARIES: OnceLock<Mutex<Cache>> = OnceLock::new();
fn stamp(path: &Path) -> Option<Stamp> {
    let meta = fs::metadata(path).ok()?;
    Some((meta.len(), meta.modified().ok()?))
}

pub(crate) fn read_card(root: &Path) -> Result<(CardMetadata, CourseSummary), String> {
    if root.join(".paideia-collaboration-revoked").is_file() {
        return Err("Accès au projet révoqué.".into());
    }
    let mut meta: CardMetadata = serde_json::from_slice(&fs::read(root.join("project.json")).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    if let Some(version) = &meta.minimum_version {
        crate::project_compatibility::check_metadata(&serde_json::json!({"minimumPaideiaVersion": version}))?;
    }
    for value in std::iter::once(&mut meta.title).chain(std::iter::once(&mut meta.description)).chain(meta.keywords.iter_mut()) {
        if let Some(repaired) = crate::repository::repair_mojibake_string(value) { *value = repaired; }
    }
    let path = root.join("content/course.json");
    let before = stamp(&path);
    let cache = SUMMARIES.get_or_init(|| Mutex::new(HashMap::new()));
    if let Some(stamp) = &before {
        if let Some(summary) = cache.lock().map_err(|e| e.to_string())?.get(&path)
            .filter(|(cached, _)| cached == stamp).map(|(_, value)| value.clone()) {
            return Ok((meta, summary));
        }
    }
    // Unknown fields (including large HTML/base64 strings) are skipped by serde.
    let course: Course = serde_json::from_slice(&fs::read(&path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let chapters = course.modules.iter().map(|m| m.chapters.len()).sum();
    let blocks = course.modules.iter().flat_map(|m| &m.chapters).flat_map(|c| &c.pages).flat_map(|p| &p.blocks);
    let (mut activities, mut imported) = (0, false);
    for block in blocks {
        activities += 1;
        imported |= block.source_format.is_some() || block.source_type.is_some() || block.source_html.is_some();
    }
    let summary = CourseSummary { chapters, activities, imported };
    if let Some(before) = before.filter(|before| Some(before.clone()) == stamp(&path)) {
        let mut cache = cache.lock().map_err(|e| e.to_string())?;
        // Bound memory even when many libraries are visited during a long session.
        if cache.len() >= 256 { cache.clear(); }
        cache.insert(path, (before, summary.clone()));
    }
    Ok((meta, summary))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn summaries_skip_banks_refresh_metadata_and_invalidate_counts() {
        let root = std::env::temp_dir().join(format!("paideia-card-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("content")).unwrap();
        fs::create_dir_all(root.join("resources/reference-banks")).unwrap();
        fs::write(root.join("resources/reference-banks/broken.json"), "not a bank").unwrap();
        let meta = serde_json::json!({"title":"Initial", "updatedAt":"2026-10-06", "questionBanks":[{"ignored":"large"}]});
        fs::write(root.join("project.json"), meta.to_string()).unwrap();
        let course = serde_json::json!({"modules":[{"chapters":[{"pages":[{"blocks":[{"contentHtml":"<script>ignored by card loader</script>","sourceFormat":null}, {"sourceRawHtml":""}]}]}]}]});
        fs::write(root.join("content/course.json"), course.to_string()).unwrap();
        let original = fs::read(root.join("content/course.json")).unwrap();
        assert_eq!(read_card(&root).unwrap().1, CourseSummary { chapters:1, activities:2, imported:true });
        fs::write(root.join("project.json"), serde_json::json!({"title":"Renamed", "updatedAt":"later", "keywords":["term"]}).to_string()).unwrap();
        let (meta, summary) = read_card(&root).unwrap();
        assert_eq!(meta.title, "Renamed");
        assert_eq!(meta.keywords, ["term"]);
        assert_eq!(summary.activities, 2);
        assert_eq!(fs::read(root.join("content/course.json")).unwrap(), original);
        fs::write(root.join("content/course.json"), r#"{"modules":[{"lessons":[{"pages":[{"blocks":[{}]}]}]}]}"#).unwrap();
        assert_eq!(read_card(&root).unwrap().1, CourseSummary {chapters:1, activities:1, imported:false});
        fs::write(root.join("content/course.json"), r#"{"modules":[{}]}"#).unwrap();
        assert_eq!(read_card(&root).unwrap().1, CourseSummary {chapters:0, activities:0, imported:false});
        fs::write(root.join(".paideia-collaboration-revoked"), "").unwrap();
        assert!(read_card(&root).is_err());
        fs::remove_file(root.join(".paideia-collaboration-revoked")).unwrap();
        fs::write(root.join("project.json"), serde_json::json!({"title":"future", "updatedAt":"later", "minimumPaideiaVersion":"999.0.0"}).to_string()).unwrap();
        assert!(read_card(&root).is_err());
        for invalid in [serde_json::Value::Null, serde_json::json!(false)] {
            fs::write(root.join("project.json"), serde_json::json!({"title":"invalid", "updatedAt":"later", "minimumPaideiaVersion":invalid}).to_string()).unwrap();
            assert!(read_card(&root).is_err());
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    #[ignore = "opt-in read-only measurement on a local library"]
    fn benchmark_library_readonly() {
        let root = PathBuf::from(std::env::var("PAIDEIA_LIBRARY_MEASUREMENT_ROOT").expect("library root required"));
        let paths = crate::library_discovery::personal_project_dirs(&root).unwrap();
        for run in 0..4 {
            let start = std::time::Instant::now();
            for path in &paths {
                let entry = crate::commands::build_library_project_entry(path).unwrap();
                let raw: crate::models::PaideiaCourse = serde_json::from_slice(&fs::read(path.join("content/course.json")).unwrap()).unwrap();
                let chapters: usize = raw.modules.iter().map(|m| m.chapters.len()).sum();
                let blocks: Vec<_> = raw.modules.iter().flat_map(|m| &m.chapters).flat_map(|c| &c.pages).flat_map(|p| &p.blocks).collect();
                assert_eq!(entry.chapters_count, chapters);
                assert_eq!(entry.activities_count, blocks.len());
                assert_eq!(entry.imported_from_scorm, blocks.iter().any(|b| b.source_format.is_some() || b.source_block_type.is_some() || b.source_raw_html.is_some()));
            }
            println!("catalogue run={} projects={} including_validation_ms={:.2}", run+1, paths.len(), start.elapsed().as_secs_f64()*1000.0);
        }
        for run in 0..5 {
            let start = std::time::Instant::now();
            for path in &paths { crate::commands::build_library_project_entry(path).unwrap(); }
            println!("catalogue_warm run={} projects={} ms={:.2}", run+1, paths.len(), start.elapsed().as_secs_f64()*1000.0);
        }
    }
}
