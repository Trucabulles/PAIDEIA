use crate::block_ids::new_block_id_candidate;
use crate::models::{
    EventRecord, LessonReferenceBank, PaideiaCourse, PaideiaProject, PaideiaWorkspaceState,
    ProjectMeta, SnapshotRecord,
};
use crate::rich_text_sanitizer::{
    is_heading_only_rich_text_fragment, normalize_sanitized_header_fragment,
    sanitize_project_rich_text,
};
use encoding_rs::WINDOWS_1252;
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

const RECENT_AUDIT_EVENT_LIMIT: usize = 200;
const AUDIT_READ_CHUNK_BYTES: usize = 64 * 1024;
const AUDIT_SEGMENT_MAX_BYTES: u64 = 5 * 1024 * 1024;
const AUDIT_ARCHIVE_FILE_NAME: &str = "events.1.ndjson";

pub fn load_workspace_state_from_path(project_path: &str) -> Result<PaideiaWorkspaceState, String> {
    let (project, repaired_text_encoding, migrated_chapters) =
        load_project_from_path_internal(project_path)?;
    workspace_state_from_project(project_path, project, repaired_text_encoding || migrated_chapters)
}

pub(crate) fn workspace_state_from_saved_project(
    project_path: &str,
    project: PaideiaProject,
) -> Result<PaideiaWorkspaceState, String> {
    if resolve_project_path(project_path).join(".paideia-collaboration-revoked").is_file() {
        return Err("L’accès à ce projet partagé a été révoqué. Les changements locaux non publiés sont conservés pour récupération.".into());
    }
    // The caller supplies the sanitized project that was just persisted. Retain
    // the normal integrity checks without rereading/resanitizing all rich fields.
    workspace_state_from_project(project_path, project, false)
}

fn workspace_state_from_project(
    project_path: &str,
    mut project: PaideiaProject,
    migrated: bool,
) -> Result<PaideiaWorkspaceState, String> {
    let repaired_ids = repair_duplicate_block_ids(&mut project);
    let repaired_media = crate::asset_integrity::clear_confirmed_missing_media(
        &resolve_project_path(project_path), &mut project,
    ).unwrap_or_default();
    let changed = repaired_ids || migrated || !repaired_media.is_empty();
    if changed
        && !resolve_project_path(project_path)
            .join(".paideia-collaboration-readonly")
            .is_file()
    {
        if !repaired_media.is_empty() {
            project.updated_at = chrono::Utc::now().to_rfc3339();
        }
        save_project_to_path(project_path, &project)?;
    }
    let audit_events = load_audit_events(project_path)?;
    let snapshots = load_snapshots(project_path)?;

    Ok(PaideiaWorkspaceState {
        read_only: resolve_project_path(project_path)
            .join(".paideia-collaboration-readonly")
            .is_file(),
        project,
        audit_events,
        snapshots,
    })
}

fn repair_duplicate_block_ids(project: &mut PaideiaProject) -> bool {
    let mut seen = HashSet::new();
    let mut repaired = false;

    for block in project
        .course
        .modules
        .iter_mut()
        .flat_map(|module| module.chapters.iter_mut())
        .flat_map(|chapter| chapter.pages.iter_mut())
        .flat_map(|page| page.blocks.iter_mut())
    {
        if seen.insert(block.id.clone()) {
            continue;
        }

        let next_id = loop {
            let candidate = new_block_id_candidate();
            if seen.insert(candidate.clone()) {
                break candidate;
            }
        };
        block.id = next_id.clone();
        block.tracking_key = format!("{}-{}", block.block_type, next_id);
        repaired = true;
    }

    repaired
}

fn replace_removed_navigation_blocks(course: &mut PaideiaCourse) -> bool {
    let mut migrated = false;
    for block in course
        .modules
        .iter_mut()
        .flat_map(|module| module.chapters.iter_mut())
        .flat_map(|chapter| chapter.pages.iter_mut())
        .flat_map(|page| page.blocks.iter_mut())
    {
        if matches!(block.block_type.as_str(), "lesson-next" | "chapter-next") {
            block.block_type = "continue".to_string();
            block.tracking_key = format!("continue-{}", block.id);
            block.summary.clear();
            migrated = true;
        }
    }
    migrated
}

fn normalize_project_question_points(project: &mut PaideiaProject) -> bool {
    let mut migrated = false;

    for bank in &mut project.question_banks {
        for bank_question in &mut bank.questions {
            if !bank_question.question.points.is_finite() || bank_question.question.points < 1.0 {
                bank_question.question.points = 1.0;
                migrated = true;
            }
        }
    }

    for block in project
        .course
        .modules
        .iter_mut()
        .flat_map(|module| module.chapters.iter_mut())
        .flat_map(|chapter| chapter.pages.iter_mut())
        .flat_map(|page| page.blocks.iter_mut())
    {
        if let Some(quiz) = block.quiz.as_mut() {
            for question in &mut quiz.questions {
                if !question.points.is_finite() || question.points < 1.0 {
                    question.points = 1.0;
                    migrated = true;
                }
            }
        }
    }

    migrated
}

fn normalize_course_poi_fields(course: &mut PaideiaCourse) -> bool {
    let mut changed = false;
    for block in course.modules.iter_mut()
        .flat_map(|module| module.chapters.iter_mut())
        .flat_map(|chapter| chapter.pages.iter_mut())
        .flat_map(|page| page.blocks.iter_mut())
    {
        if block.block_type != "point-of-interest" {
            changed |= !block.point_of_interest_markers.is_empty()
                || block.marker_popup_width.is_some() || block.marker_popup_height.is_some();
            block.point_of_interest_markers.clear();
            block.marker_popup_width = None;
            block.marker_popup_height = None;
        }
    }
    changed
}

fn migrate_legacy_rise_heading_blocks(course: &mut PaideiaCourse) -> bool {
    let mut migrated = false;
    for block in course
        .modules
        .iter_mut()
        .flat_map(|module| module.chapters.iter_mut())
        .flat_map(|chapter| chapter.pages.iter_mut())
        .flat_map(|page| page.blocks.iter_mut())
    {
        let is_legacy_rise_heading = block.source_format.as_deref() == Some("rise-scorm")
            && block.block_type == "rich-text"
            && block.family.as_deref() == Some("text")
            && block.variant.as_deref() == Some("paragraph")
            && block
                .content_html
                .as_deref()
                .is_some_and(is_heading_only_rich_text_fragment);
        if !is_legacy_rise_heading {
            continue;
        }

        block.block_type = "header".to_string();
        block.title = "En-tête".to_string();
        block.summary.clear();
        block.tracking_key = format!("header-{}", block.id);
        if let Some(html) = block.content_html.as_mut() {
            *html = normalize_sanitized_header_fragment(html);
        }
        if let Some(html) = block.source_raw_html.as_mut() {
            if is_heading_only_rich_text_fragment(html) {
                *html = normalize_sanitized_header_fragment(html);
            }
        }
        if block.asset_refs.iter().any(|asset_ref| {
            matches!(
                Path::new(asset_ref)
                    .extension()
                    .and_then(|extension| extension.to_str())
                    .map(|extension| extension.to_ascii_lowercase())
                    .as_deref(),
                Some("png" | "jpg" | "jpeg" | "webp" | "gif" | "avif" | "bmp" | "svg")
            )
        }) {
            block.header_background_color = Some("transparent".to_string());
            block.header_height.get_or_insert_with(|| "240px".to_string());
        }
        block.section_background_image_ref = None;
        block.section_background_color = None;
        block.section_background_wide = None;
        block.section_background_height = None;
        block.section_background_rounded = None;
        block.section_background_position_y = None;
        migrated = true;
    }
    migrated
}

// Preserve the original authoritative files before any automatic cleanup.
// They remain outside snapshot pruning and are sufficient to restore the course.
fn backup_before_poi_cleanup(root: &Path) -> Result<(), String> {
    let backup = root.join("audit").join("before-poi-cleanup")
        .join(format!("{}-{}", chrono::Utc::now().timestamp_micros(), std::process::id()));
    fs::create_dir_all(&backup).map_err(|err| err.to_string())?;
    for (source, name) in [(root.join("content/course.json"), "course.json"), (root.join("project.json"), "project.json"),
    ] {
        let bytes = fs::read(&source).map_err(|err| err.to_string())?;
        let destination = backup.join(name);
        let mut file = OpenOptions::new().write(true).create_new(true).open(&destination).map_err(|err| err.to_string())?;
        file.write_all(&bytes).map_err(|err| err.to_string())?;
        file.sync_all().map_err(|err| err.to_string())?;
        if fs::read(destination).map_err(|err| err.to_string())? != bytes {
            return Err("Échec de vérification de la sauvegarde avant nettoyage POI.".to_string());
        }
    }
    Ok(())
}

pub fn load_project_from_path(project_path: &str) -> Result<PaideiaProject, String> {
    load_project_from_path_internal(project_path).map(|(project, _, _)| project)
}

fn load_project_from_path_internal(
    project_path: &str,
) -> Result<(PaideiaProject, bool, bool), String> {
    let root = resolve_project_path(project_path);
    if root.join(".paideia-collaboration-revoked").is_file() {
        return Err(
            "L’accès à ce projet partagé a été révoqué. Les changements locaux non publiés sont conservés pour récupération.".into(),
        );
    }
    let meta: ProjectMeta = read_json(root.join("project.json"))?;
    crate::project_compatibility::check_path(&root)?;
    let (course, migrated_chapters) =
        read_course(root.join("content").join("course.json"))?;

    let mut project = PaideiaProject {
        id: meta.id,
        slug: meta.slug,
        title: meta.title,
        description: meta.description,
        keywords: meta.keywords,
        course_intro_html: meta.course_intro_html,
        course_cover_title_html: meta.course_cover_title_html,
        title_style: meta.title_style,
        custom_font: meta.custom_font,
        imported_fonts: meta.imported_fonts,
        course_image_ref: meta.course_image_ref,
        course_cover_style: meta.course_cover_style,
        activity_spacing_px: meta.activity_spacing_px,
        hide_chapter_title_banner: meta.hide_chapter_title_banner,
        course_appearance: meta.course_appearance,
        glossary_assistants: meta.glossary_assistants,
        question_banks: meta.question_banks,
        reference_banks: load_reference_banks(&root)?,
        created_at: meta.created_at,
        updated_at: meta.updated_at,
        created_by: meta.created_by,
        default_locale: meta.default_locale,
        locales: meta.locales,
        status: meta.status,
        current_version: meta.current_version,
        root_course_id: meta.root_course_id,
        course,
    };
    let repaired = repair_mojibake_in_project(&mut project)?;
    let migrated_navigation = replace_removed_navigation_blocks(&mut project.course);
    let migrated_question_points = normalize_project_question_points(&mut project);
    let migrated_poi = normalize_course_poi_fields(&mut project.course);
    let migrated_rise_headings = migrate_legacy_rise_heading_blocks(&mut project.course);
    if migrated_poi && !root.join(".paideia-collaboration-readonly").is_file() {
        backup_before_poi_cleanup(&root)?;
    }
    sanitize_project_rich_text(&mut project)?;
    Ok((
        project,
        repaired,
        migrated_chapters
            || migrated_navigation
            || migrated_question_points
            || migrated_poi
            || migrated_rise_headings,
    ))
}

fn read_course(path: PathBuf) -> Result<(PaideiaCourse, bool), String> {
    let value: Value = read_json(path)?;
    let migrated_chapters = contains_legacy_chapter_key(&value);
    let course = serde_json::from_value(value).map_err(|err| err.to_string())?;
    Ok((course, migrated_chapters))
}

fn contains_legacy_chapter_key(value: &Value) -> bool {
    match value {
        Value::Object(object) => {
            object.contains_key("lessons")
                || object.contains_key("gateLessonUntilPassed")
                || object.values().any(contains_legacy_chapter_key)
        }
        Value::Array(values) => values.iter().any(contains_legacy_chapter_key),
        _ => false,
    }
}

pub fn save_project_to_path(project_path: &str, project: &PaideiaProject) -> Result<(), String> {
    save_project_for_workspace(project_path, project).map(|_| ())
}

pub(crate) fn save_project_for_workspace(project_path: &str, project: &PaideiaProject) -> Result<PaideiaProject, String> {
    if resolve_project_path(project_path).join(".paideia-collaboration-readonly").is_file() {
        return Err("Ce projet collaboratif est ouvert en lecture seule.".into());
    }
    let mut sanitized_project = project.clone();
    normalize_project_question_points(&mut sanitized_project);
    normalize_course_poi_fields(&mut sanitized_project.course);
    sanitize_project_rich_text(&mut sanitized_project)?;
    save_loaded_project_to_path(project_path, &sanitized_project)?;
    Ok(sanitized_project)
}

// For a project already sanitized by load_project_from_path, followed solely by
// a plain chapter-title/tracking change. Never use this for incoming rich HTML.
pub(crate) fn save_loaded_project_to_path(project_path: &str, project: &PaideiaProject) -> Result<(), String> {
    let root = resolve_project_path(project_path);
    if root.join(".paideia-collaboration-readonly").is_file() {
        return Err("Ce projet collaboratif est ouvert en lecture seule.".into());
    }
    crate::project_compatibility::check_path(&root)?;
    let course_path = root.join("content").join("course.json");
    write_sanitized_project_meta(project_path, project)?;
    write_json(course_path, &project.course)?;
    write_reference_banks(&root, &project.reference_banks)?;
    write_granular_content(&root, &project.course)
}

pub fn save_project_meta_to_path(project_path: &str, project: &PaideiaProject,
) -> Result<(), String> {
    let root = resolve_project_path(project_path);
    if root.join(".paideia-collaboration-readonly").is_file() {
        return Err("Ce projet collaboratif est ouvert en lecture seule.".into());
    }
    let mut sanitized_project = project.clone();
    sanitize_project_rich_text(&mut sanitized_project)?;
    write_sanitized_project_meta(project_path, &sanitized_project)
}

fn write_sanitized_project_meta(project_path: &str, project: &PaideiaProject) -> Result<(), String> {
    let root = resolve_project_path(project_path);
    let mut metadata = serde_json::to_value(project_to_meta(project))
        .map_err(|error| error.to_string())?;
    crate::project_compatibility::stamp(&root, &mut metadata)?;
    write_json(root.join("project.json"), &metadata)
}

pub fn append_event_record(project_path: &str, event: &EventRecord) -> Result<(), String> {
    let root = resolve_project_path(project_path);
    let audit_dir = root.join("audit");
    let audit_path = audit_dir.join("events.ndjson");
    fs::create_dir_all(&audit_dir).map_err(|err| err.to_string())?;

    let line = serde_json::to_string(event).map_err(|err| err.to_string())?;
    rotate_audit_if_needed(&audit_path, line.len() as u64 + 1, AUDIT_SEGMENT_MAX_BYTES)?;
    let mut file = OpenOptions::new()
        .create(true)
        .read(true)
        .append(true)
        .open(audit_path)
        .map_err(|err| err.to_string())?;
    let file_len = file.metadata().map_err(|err| err.to_string())?.len();
    if file_len > 0 {
        file.seek(SeekFrom::End(-1)).map_err(|err| err.to_string())?;
        let mut last_byte = [0u8; 1];
        file.read_exact(&mut last_byte).map_err(|err| err.to_string())?;
        if last_byte[0] != b'\n' {
            file.write_all(b"\n").map_err(|err| err.to_string())?;
        }
    }
    file.write_all(line.as_bytes()).map_err(|err| err.to_string())?;
    file.write_all(b"\n").map_err(|err| err.to_string())
}

fn rotate_audit_if_needed(
    audit_path: &Path,
    incoming_bytes: u64,
    segment_max_bytes: u64,
) -> Result<(), String> {
    if !audit_path.exists() {
        return Ok(());
    }
    let current_bytes = audit_path.metadata().map_err(|err| err.to_string())?.len();
    if current_bytes.saturating_add(incoming_bytes) <= segment_max_bytes {
        return Ok(());
    }

    let archive_path = audit_path.with_file_name(AUDIT_ARCHIVE_FILE_NAME);
    if archive_path.exists() {
        fs::remove_file(&archive_path).map_err(|err| err.to_string())?;
    }
    if current_bytes <= segment_max_bytes {
        fs::rename(audit_path, archive_path).map_err(|err| err.to_string())?;
    } else {
        fs::remove_file(audit_path).map_err(|err| err.to_string())?;
    }
    Ok(())
}

pub fn save_snapshot(
    project_path: &str,
    snapshot: &SnapshotRecord,
    project: &PaideiaProject,
) -> Result<(), String> {
    let root = resolve_project_path(project_path);
    let snapshot_dir = root.join("snapshots").join(&snapshot.id);
    fs::create_dir_all(&snapshot_dir).map_err(|err| err.to_string())?;

    write_json(snapshot_dir.join("manifest.json"), snapshot)?;
    write_json(snapshot_dir.join("project.json"), &project_to_meta(project))?;
    write_json(snapshot_dir.join("course.json"), &project.course)?;
    write_reference_banks(&snapshot_dir, &project.reference_banks)
}

pub fn load_snapshot_reference_banks(snapshot_dir: &Path) -> Result<Vec<LessonReferenceBank>, String> {
    load_reference_banks(snapshot_dir)
}

pub fn prune_snapshots(project_path: &str, max_snapshots: usize) -> Result<(), String> {
    let root = resolve_project_path(project_path);
    let snapshots_dir = root.join("snapshots");
    if !snapshots_dir.exists() {
        return Ok(());
    }

    let mut entries = fs::read_dir(&snapshots_dir)
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            if !path.is_dir() {
                return None;
            }
            let manifest = read_json::<SnapshotRecord>(path.join("manifest.json")).ok()?;
            Some((manifest.created_at, path))
        })
        .collect::<Vec<_>>();

    entries.sort_by(|left, right| right.0.cmp(&left.0));
    for (_, path) in entries.into_iter().skip(max_snapshots) {
        fs::remove_dir_all(path).map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn load_audit_events(project_path: &str) -> Result<Vec<EventRecord>, String> {
    let root = resolve_project_path(project_path);
    let audit_path = root.join("audit").join("events.ndjson");
    let archive_path = root.join("audit").join(AUDIT_ARCHIVE_FILE_NAME);
    if !audit_path.exists() && !archive_path.exists() {
        return Ok(vec![]);
    }

    let current_raw = if audit_path.exists() {
        read_last_lines(&audit_path, RECENT_AUDIT_EVENT_LIMIT)?
    } else {
        String::new()
    };
    let current_count = current_raw.lines().filter(|line| !line.trim().is_empty()).count();
    let archived_raw = if current_count < RECENT_AUDIT_EVENT_LIMIT && archive_path.exists() {
        read_last_lines(&archive_path, RECENT_AUDIT_EVENT_LIMIT - current_count)?
    } else {
        String::new()
    };
    let raw = format!("{}{}", archived_raw, current_raw);
    let mut events = raw
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).map_err(|err| err.to_string()))
        .collect::<Result<Vec<EventRecord>, String>>()?;
    events.reverse();
    Ok(events)
}

fn read_last_lines(path: &Path, limit: usize) -> Result<String, String> {
    if limit == 0 {
        return Ok(String::new());
    }

    let mut file = fs::File::open(path).map_err(|err| err.to_string())?;
    let mut position = file.metadata().map_err(|err| err.to_string())?.len();
    let mut chunks: Vec<Vec<u8>> = Vec::new();
    let mut newline_count = 0usize;

    while position > 0 && newline_count <= limit {
        let chunk_len = position.min(AUDIT_READ_CHUNK_BYTES as u64) as usize;
        position -= chunk_len as u64;
        file.seek(SeekFrom::Start(position)).map_err(|err| err.to_string())?;
        let mut chunk = vec![0u8; chunk_len];
        file.read_exact(&mut chunk).map_err(|err| err.to_string())?;
        newline_count += chunk.iter().filter(|byte| **byte == b'\n').count();
        chunks.push(chunk);
    }

    chunks.reverse();
    let bytes: Vec<u8> = chunks.into_iter().flatten().collect();
    let mut line_starts = bytes
        .iter()
        .enumerate()
        .filter_map(|(index, byte)| (*byte == b'\n').then_some(index + 1))
        .collect::<Vec<_>>();
    if bytes.last() == Some(&b'\n') {
        line_starts.pop();
    }
    let start = if line_starts.len() >= limit {
        line_starts[line_starts.len() - limit]
    } else {
        0
    };
    String::from_utf8(bytes[start..].to_vec()).map_err(|err| err.to_string())
}

pub(crate) fn load_snapshots(project_path: &str) -> Result<Vec<SnapshotRecord>, String> {
    let root = resolve_project_path(project_path);
    let snapshots_dir = root.join("snapshots");
    if !snapshots_dir.exists() {
        return Ok(vec![]);
    }

    let mut entries: Vec<SnapshotRecord> = fs::read_dir(snapshots_dir)
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.path().join("manifest.json"))
        .filter(|manifest| manifest.exists())
        .map(read_json)
        .collect::<Result<Vec<SnapshotRecord>, String>>()?;

    entries.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(entries)
}

fn write_granular_content(root: &Path, course: &PaideiaCourse) -> Result<(), String> {
    let content_dir = root.join("content");
    let modules_dir = content_dir.join("modules");
    let chapters_dir = content_dir.join("chapters");
    let legacy_lessons_dir = content_dir.join("lessons");
    let pages_dir = content_dir.join("pages");
    let blocks_dir = content_dir.join("blocks");

    for directory in [&modules_dir, &chapters_dir, &pages_dir, &blocks_dir] {
        fs::create_dir_all(directory).map_err(|err| err.to_string())?;
    }
    let mut module_ids = HashSet::new();
    let mut chapter_ids = HashSet::new();
    let mut page_ids = HashSet::new();
    let mut block_ids = HashSet::new();

    for module_item in &course.modules {
        module_ids.insert(format!("{}.json", module_item.id));
        write_json(
            modules_dir.join(format!("{}.json", module_item.id)),
            module_item,
        )?;

        for chapter_item in &module_item.chapters {
            chapter_ids.insert(format!("{}.json", chapter_item.id));
            write_json(
                chapters_dir.join(format!("{}.json", chapter_item.id)),
                chapter_item,
            )?;

            for page_item in &chapter_item.pages {
                page_ids.insert(format!("{}.json", page_item.id));
                write_json(pages_dir.join(format!("{}.json", page_item.id)), page_item)?;

                for block_item in &page_item.blocks {
                    block_ids.insert(format!("{}.json", block_item.id));
                    write_json(
                        blocks_dir.join(format!("{}.json", block_item.id)),
                        block_item,
                    )?;
                }
            }
        }
    }

    // Delete obsolete generated JSON only after the current files are written.
    // Unchanged block/page files survive a plain chapter-title update.
    for (directory, expected) in [(&modules_dir, &module_ids), (&chapters_dir, &chapter_ids), (&pages_dir, &page_ids), (&blocks_dir, &block_ids)] {
        for entry in fs::read_dir(directory).map_err(|err| err.to_string())? {
            let entry = entry.map_err(|err| err.to_string())?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if entry.file_type().map_err(|err| err.to_string())?.is_file()
                && entry.path().extension().is_some_and(|extension| extension == "json")
                && !expected.contains(&name)
            {
                fs::remove_file(entry.path()).map_err(|err| err.to_string())?;
            }
        }
    }
    if legacy_lessons_dir.exists() {
        fs::remove_dir_all(legacy_lessons_dir).map_err(|err| err.to_string())?;
    }

    Ok(())
}

fn valid_reference_bank_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn load_reference_banks(root: &Path) -> Result<Vec<LessonReferenceBank>, String> {
    let directory = root.join("resources").join("reference-banks");
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let mut paths = fs::read_dir(&directory).map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())?
        .into_iter().filter_map(|entry| {
            let path = entry.path();
            (path.is_file() && path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("json"))).then_some(path)
        }).collect::<Vec<_>>();
    paths.sort();
    let mut banks = Vec::with_capacity(paths.len());
    let mut ids = HashSet::new();
    for path in paths {
        let bank: LessonReferenceBank = read_json(path.clone())?;
        if !valid_reference_bank_id(&bank.id) {
            return Err(format!("Identifiant de banque de balises invalide dans {}.", path.display()));
        }
        if !ids.insert(bank.id.clone()) {
            return Err(format!("Banque de balises dupliquée : {}.", bank.id));
        }
        banks.push(bank);
    }
    banks.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(banks)
}

fn write_reference_banks(root: &Path, banks: &[LessonReferenceBank]) -> Result<(), String> {
    let resources_dir = root.join("resources");
    let destination = resources_dir.join("reference-banks");
    if banks.is_empty() && !destination.exists() {
        return Ok(());
    }
    let mut expected = HashSet::new();
    let mut unchanged = destination.is_dir();
    for bank in banks {
        if !valid_reference_bank_id(&bank.id) || !expected.insert(format!("{}.json", bank.id)) {
            return Err(format!("Identifiant de banque de balises invalide ou dupliqué : {}.", bank.id));
        }
        let bytes = serde_json::to_vec_pretty(bank).map_err(|error| error.to_string())?;
        unchanged &= fs::read(destination.join(format!("{}.json", bank.id))).is_ok_and(|existing| existing == bytes);
    }
    if unchanged && fs::read_dir(&destination).map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())?.len() == expected.len()
    {
        return Ok(());
    }
    fs::create_dir_all(&resources_dir).map_err(|error| error.to_string())?;
    let temporary = resources_dir.join(format!(".reference-banks-tmp-{}", uuid::Uuid::new_v4()));
    let backup = resources_dir.join(format!(".reference-banks-backup-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temporary).map_err(|error| error.to_string())?;
    let write_result = (|| {
        let mut ids = HashSet::new();
        for bank in banks {
            if !valid_reference_bank_id(&bank.id) {
                return Err(format!("Identifiant de banque de balises invalide : {}.", bank.id));
            }
            if !ids.insert(bank.id.clone()) {
                return Err(format!("Banque de balises dupliquée : {}.", bank.id));
            }
            write_json(temporary.join(format!("{}.json", bank.id)), bank)?;
        }
        if destination.exists() {
            fs::rename(&destination, &backup).map_err(|error| error.to_string())?;
        }
        if let Err(error) = fs::rename(&temporary, &destination) {
            if backup.exists() && !destination.exists() {
                let _ = fs::rename(&backup, &destination);
            }
            return Err(error.to_string());
        }
        if backup.exists() {
            fs::remove_dir_all(&backup).map_err(|error| error.to_string())?;
        }
        Ok(())
    })();
    if temporary.exists() {
        let _ = fs::remove_dir_all(&temporary);
    }
    write_result
}

fn project_to_meta(project: &PaideiaProject) -> ProjectMeta {
    ProjectMeta {
        id: project.id.clone(),
        slug: project.slug.clone(),
        title: project.title.clone(),
        description: project.description.clone(),
        keywords: project.keywords.clone(),
        course_intro_html: project.course_intro_html.clone(),
        course_cover_title_html: project.course_cover_title_html.clone(),
        title_style: project.title_style.clone(),
        custom_font: project.custom_font.clone(),
        imported_fonts: project.imported_fonts.clone(),
        course_image_ref: project.course_image_ref.clone(),
        course_cover_style: project.course_cover_style.clone(),
        activity_spacing_px: project.activity_spacing_px,
        hide_chapter_title_banner: project.hide_chapter_title_banner,
        course_appearance: project.course_appearance.clone(),
        glossary_assistants: project.glossary_assistants.clone(),
        question_banks: project.question_banks.clone(),
        created_at: project.created_at.clone(),
        updated_at: project.updated_at.clone(),
        created_by: project.created_by.clone(),
        default_locale: project.default_locale.clone(),
        locales: project.locales.clone(),
        status: project.status.clone(),
        current_version: project.current_version.clone(),
        root_course_id: project.root_course_id.clone(),
    }
}

fn read_json<T: serde::de::DeserializeOwned>(path: PathBuf) -> Result<T, String> {
    let raw = fs::read_to_string(path).map_err(|err| err.to_string())?;
    serde_json::from_str(&raw).map_err(|err| err.to_string())
}

fn write_json<T: serde::Serialize>(path: PathBuf, value: &T) -> Result<(), String> {
    let payload = serde_json::to_string_pretty(value).map_err(|err| err.to_string())?;
    if fs::read(&path).is_ok_and(|existing| existing == payload.as_bytes()) {
        return Ok(());
    }
    let parent = path
        .parent()
        .ok_or_else(|| "Invalid write path".to_string())?;
    fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    fs::write(path, payload).map_err(|err| err.to_string())
}

fn resolve_project_path(project_path: &str) -> PathBuf {
    let candidate = Path::new(project_path);
    if candidate.is_absolute() {
        return candidate.to_path_buf();
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir.join("..").join(project_path)
}

pub(crate) fn repair_mojibake_in_project(project: &mut PaideiaProject) -> Result<bool, String> {
    repair_mojibake_in_serialized(project)
}

pub(crate) fn repair_mojibake_string(value: &str) -> Option<String> {
    if suspicious_mojibake_score(value) == 0 {
        return None;
    }

    let (bytes, _, had_errors) = WINDOWS_1252.encode(value);
    if had_errors {
        return None;
    }

    let repaired = String::from_utf8(bytes.into_owned()).ok()?;
    if repaired == value {
        return None;
    }

    let before = suspicious_mojibake_score(value);
    let after = suspicious_mojibake_score(&repaired);
    if after >= before {
        return None;
    }

    Some(repaired)
}

fn repair_mojibake_in_serialized<T>(value: &mut T) -> Result<bool, String>
where
    T: Serialize + DeserializeOwned,
{
    let mut json = serde_json::to_value(&*value).map_err(|err| err.to_string())?;
    let repaired = repair_mojibake_in_value(&mut json);
    if repaired {
        *value = serde_json::from_value(json).map_err(|err| err.to_string())?;
    }
    Ok(repaired)
}

fn repair_mojibake_in_value(value: &mut Value) -> bool {
    match value {
        Value::String(text) => {
            if let Some(repaired) = repair_mojibake_string(text) {
                *text = repaired;
                true
            } else {
                false
            }
        }
        Value::Array(items) => {
            let mut repaired = false;
            for item in items {
                repaired |= repair_mojibake_in_value(item);
            }
            repaired
        }
        Value::Object(entries) => {
            let mut repaired = false;
            for item in entries.values_mut() {
                repaired |= repair_mojibake_in_value(item);
            }
            repaired
        }
        _ => false,
    }
}

fn suspicious_mojibake_score(value: &str) -> usize {
    [
        "Ã",
        "Â",
        "â€™",
        "â€œ",
        "â€\u{9d}",
        "â€“",
        "â€”",
        "â€¢",
        "â€¦",
        "â‚¬",
        "ï¿½",
        "\u{fffd}",
    ]
    .into_iter()
    .map(|pattern| value.matches(pattern).count())
    .sum()
}

#[cfg(test)]
mod tests {
    #[test]
    fn title_save_preserves_unchanged_files_and_workspace_integrity() {
        let root = std::env::temp_dir().join(format!("paideia-title-save-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("content")).unwrap();
        let meta = serde_json::json!({"id":"test", "slug":"test", "title":"Lesson", "description":"",
            "createdAt":"2026-10-06", "updatedAt":"2026-10-06", "createdBy":"test", "defaultLocale":"fr", "locales":["fr"],
            "status":"draft", "currentVersion":"v1", "rootCourseId":"course"});
        let course = serde_json::json!({"id":"course", "title":"Lesson", "modules":[{"id":"module", "title":"Module",
            "chapters":[{"id":"chapter", "title":"Before", "pages":[{"id":"page", "title":"Page", "blocks":[]}]}]}]});
        std::fs::write(root.join("project.json"), serde_json::to_vec(&meta).unwrap()).unwrap();
        std::fs::write(root.join("content/course.json"), serde_json::to_vec(&course).unwrap()).unwrap();
        let path = root.to_str().unwrap();
        let initial = super::load_project_from_path(path).unwrap();
        super::save_project_to_path(path, &initial).unwrap();
        let page_path = root.join("content/pages/page.json");
        let page_bytes = std::fs::read(&page_path).unwrap();
        let page_modified = std::fs::metadata(&page_path).unwrap().modified().unwrap();
        let mut project = super::load_project_from_path(path).unwrap();
        project.course.modules[0].chapters[0].title = "After".into();
        super::save_loaded_project_to_path(path, &project).unwrap();
        let state = super::workspace_state_from_saved_project(path, project).unwrap();
        assert_eq!(state.project.course.modules[0].chapters[0].title, "After");
        assert_eq!(super::load_workspace_state_from_path(path).unwrap().project.course.modules[0].chapters[0].title, "After");
        assert_eq!(std::fs::read(&page_path).unwrap(), page_bytes);
        assert_eq!(std::fs::metadata(&page_path).unwrap().modified().unwrap(), page_modified);
        let command_state = crate::commands::update_chapter(path.into(), "module".into(), "chapter".into(), "Confirmed".into(), None).unwrap();
        assert_eq!(command_state.project.course.modules[0].chapters[0].title, "Confirmed");
        assert_eq!(command_state.audit_events.last().unwrap().event_type, "chapter.updated");
        assert_eq!(std::fs::metadata(&page_path).unwrap().modified().unwrap(), page_modified);
        // Genuine structural deletion still removes the obsolete granular file.
        let mut project = command_state.project;
        project.course.modules[0].chapters[0].pages.clear();
        super::save_project_to_path(path, &project).unwrap();
        assert!(!page_path.exists());
        std::fs::write(root.join(".paideia-collaboration-readonly"), b"readonly").unwrap();
        assert!(super::save_loaded_project_to_path(path, &project).is_err());
        assert!(super::save_project_for_workspace(path, &project).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn read_only_workspace_normalizes_in_memory_without_writing() {
        let root = std::env::temp_dir().join(format!("paideia-readonly-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("content")).unwrap();
        let metadata = serde_json::json!({
            "id":"test", "slug":"test", "title":"LeÃ§on", "description":"", "keywords":["réglementation", "temps de travail"],
            "createdAt":"2026-09-10", "updatedAt":"2026-09-10", "createdBy":"test",
            "defaultLocale":"fr", "locales":["fr"], "status":"draft",
            "currentVersion":"v1", "rootCourseId":"course"
        });
        let original = serde_json::to_vec(&metadata).unwrap();
        std::fs::write(root.join("project.json"), &original).unwrap();
        std::fs::write(
            root.join("content/course.json"),
            br#"{"id":"course","title":"Test","modules":[]}"#,
        )
        .unwrap();
        std::fs::write(root.join(".paideia-collaboration-readonly"), b"readonly").unwrap();
        let path = root.to_str().unwrap();
        let state = super::load_workspace_state_from_path(path).unwrap();
        assert!(state.read_only);
        assert_eq!(state.project.title, "Leçon");
        assert_eq!(state.project.keywords, ["réglementation", "temps de travail"]);
        let entries = crate::commands::list_library_projects(vec![path.into()], vec![]).unwrap();
        assert_eq!(
            entries.len(),
            1,
            "A shared course with no activities must remain visible"
        );
        assert_eq!(entries[0].activities_count, 0);
        assert_eq!(entries[0].keywords, state.project.keywords);
        assert_eq!(std::fs::read(root.join("project.json")).unwrap(), original);
        assert!(super::save_project_to_path(path, &state.project).is_err());
        assert!(super::save_project_meta_to_path(path, &state.project).is_err());
        assert!(!root.join("audit").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    use super::{
        contains_legacy_chapter_key, prune_snapshots, read_course, read_last_lines,
        load_reference_banks,
        migrate_legacy_rise_heading_blocks, repair_mojibake_in_serialized,
        repair_mojibake_string, replace_removed_navigation_blocks, rotate_audit_if_needed,
        write_granular_content, write_json, write_reference_banks,
        AUDIT_ARCHIVE_FILE_NAME,
    };
    use crate::models::{LessonReferenceBank, PaideiaCourse, ReferenceBankEntry, SnapshotRecord};
    use serde::{Deserialize, Serialize};
    use std::collections::HashMap;
    use std::fs;

    #[derive(Debug, Serialize, Deserialize)]
    struct SamplePayload {
        title: String,
        items: Vec<String>,
        nested: HashMap<String, String>,
    }

    #[test]
    fn reference_banks_are_additive_and_stored_as_independent_files() {
        let root = std::env::temp_dir().join(format!("paideia-reference-banks-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).expect("create reference bank fixture");
        assert!(load_reference_banks(&root).unwrap().is_empty());
        assert!(!root.join("resources/reference-banks").exists());
        let first = LessonReferenceBank {
            id: "bank_dns".to_string(), name: "Réseau".to_string(),
            tile_image_ref: Some("reference-banks/bank_dns/tile.png".to_string()),
            source_resource_id: Some("user_bank_dns".to_string()), source_revision: Some(2),
            source_content_hash: Some("abc123".to_string()),
            entries: vec![ReferenceBankEntry { id: "entry_dns".to_string(), term: "DNS".to_string(), definition_html: "<p>Système de noms de domaine.</p>".to_string() }],
        };
        write_reference_banks(&root, std::slice::from_ref(&first)).unwrap();
        assert!(root.join("resources/reference-banks/bank_dns.json").is_file());
        assert_eq!(load_reference_banks(&root).unwrap(), vec![first]);
        write_reference_banks(&root, &[]).unwrap();
        assert!(load_reference_banks(&root).unwrap().is_empty());
        assert_eq!(fs::read_dir(root.join("resources/reference-banks")).unwrap().count(), 0);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reference_bank_ids_cannot_escape_their_resource_directory() {
        let root = std::env::temp_dir().join(format!("paideia-reference-bank-confinement-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let invalid = LessonReferenceBank { id: "../outside".to_string(), name: "Invalide".to_string(), tile_image_ref: None, source_resource_id: None, source_revision: None, source_content_hash: None, entries: Vec::new() };
        assert!(write_reference_banks(&root, &[invalid]).is_err());
        assert!(!root.join("outside.json").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn repairs_common_french_mojibake_sequences() {
        assert_eq!(
            repair_mojibake_string("LeÃ§on PAIDEIA").as_deref(),
            Some("Leçon PAIDEIA")
        );
        assert_eq!(
            repair_mojibake_string("Câ€™est dÃ©jÃ  fait.").as_deref(),
            Some("C’est déjà fait.")
        );
    }

    #[test]
    fn leaves_clean_french_strings_untouched() {
        assert_eq!(repair_mojibake_string("Leçon PAIDEIA"), None);
        assert_eq!(repair_mojibake_string("À retenir"), None);
    }

    #[test]
    fn repairs_nested_serialized_project_payloads() {
        let mut payload = SamplePayload {
            title: "LeÃ§on PAIDEIA".to_string(),
            items: vec!["ActivitÃ©".to_string(), "Câ€™est dÃ©jÃ  fait.".to_string()],
            nested: HashMap::from([("note".to_string(), "RÃ©ponse incorrecte.".to_string())]),
        };

        let repaired = repair_mojibake_in_serialized(&mut payload).expect("repair should work");

        assert!(repaired);
        assert_eq!(payload.title, "Leçon PAIDEIA");
        assert_eq!(payload.items[0], "Activité");
        assert_eq!(payload.items[1], "C’est déjà fait.");
        assert_eq!(payload.nested["note"], "Réponse incorrecte.");
    }

    #[test]
    fn reads_only_requested_trailing_lines() {
        let path = std::env::temp_dir().join(format!(
            "paideia-audit-tail-{}.ndjson",
            std::process::id()
        ));
        fs::write(&path, "one\ntwo\nthree\nfour\n").expect("fixture should be written");

        let result = read_last_lines(&path, 2).expect("audit tail should be readable");

        let _ = fs::remove_file(path);
        assert_eq!(result, "three\nfour\n");
    }

    #[test]
    fn audit_rotation_keeps_one_bounded_previous_segment() {
        let root = std::env::temp_dir().join(format!(
            "paideia-audit-rotation-{}",
            std::process::id()
        ));
        let audit_path = root.join("events.ndjson");
        let archive_path = root.join(AUDIT_ARCHIVE_FILE_NAME);
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("audit fixture root should be created");
        fs::write(&audit_path, "1234").expect("active audit fixture should be written");

        rotate_audit_if_needed(&audit_path, 1, 4).expect("audit rotation should succeed");

        assert!(!audit_path.exists());
        assert_eq!(fs::read_to_string(&archive_path).expect("archive should exist"), "1234");

        fs::write(&audit_path, "oversized").expect("legacy audit fixture should be written");
        rotate_audit_if_needed(&audit_path, 1, 4).expect("legacy audit cleanup should succeed");
        assert!(!audit_path.exists());
        assert!(!archive_path.exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn snapshot_retention_keeps_only_the_most_recent_entries() {
        let root = std::env::temp_dir().join(format!(
            "paideia-snapshot-retention-{}",
            std::process::id()
        ));
        let snapshots_dir = root.join("snapshots");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&snapshots_dir).expect("snapshot fixture root should be created");

        for (id, created_at) in [
            ("old", "2026-01-01T00:00:00Z"),
            ("middle", "2026-02-01T00:00:00Z"),
            ("new", "2026-03-01T00:00:00Z"),
        ] {
            let directory = snapshots_dir.join(id);
            fs::create_dir_all(&directory).expect("snapshot fixture should be created");
            let manifest = SnapshotRecord {
                id: id.to_string(),
                label: id.to_string(),
                version_tag: "test".to_string(),
                created_at: created_at.to_string(),
                created_by: "test".to_string(),
                manifest_path: format!("snapshots/{id}/manifest.json"),
            };
            fs::write(
                directory.join("manifest.json"),
                serde_json::to_string(&manifest).expect("manifest should serialize"),
            )
            .expect("manifest fixture should be written");
        }

        prune_snapshots(root.to_string_lossy().as_ref(), 2).expect("retention should succeed");

        assert!(!snapshots_dir.join("old").exists());
        assert!(snapshots_dir.join("middle").exists());
        assert!(snapshots_dir.join("new").exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn migrates_legacy_lessons_and_navigation_to_chapters() {
        let root = std::env::temp_dir().join(format!(
            "paideia-chapter-migration-{}",
            std::process::id()
        ));
        let content_dir = root.join("content");
        let course_path = content_dir.join("course.json");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(content_dir.join("lessons"))
            .expect("legacy content directory should be created");
        fs::write(
            &course_path,
            r#"{
              "id":"course_01",
              "title":"Test",
              "modules":[{
                "id":"module_01",
                "title":"Module",
                "lessons":[{
                  "id":"lesson_01",
                  "title":"Chapitre",
                  "pages":[{
                    "id":"page_01",
                    "title":"Page",
                    "blocks":[{
                      "id":"block_01",
                      "type":"lesson-next",
                      "title":"",
                      "summary":"",
                      "trackingKey":"lesson-next-block_01"
                    }]
                  }]
                }]
              }]
            }"#,
        )
        .expect("legacy course should be written");

        let (mut course, migrated_shape) =
            read_course(course_path.clone()).expect("legacy course should load");
        assert!(migrated_shape);
        assert_eq!(course.modules[0].chapters.len(), 1);
        assert!(replace_removed_navigation_blocks(&mut course));
        let block = &course.modules[0].chapters[0].pages[0].blocks[0];
        assert_eq!(block.block_type, "continue");
        assert_eq!(block.tracking_key, "continue-block_01");
        assert!(block.summary.is_empty());

        write_json(course_path.clone(), &course).expect("migrated course should be written");
        write_granular_content(&root, &course).expect("granular content should be migrated");

        let serialized = fs::read_to_string(course_path).expect("course should be readable");
        assert!(serialized.contains("\"chapters\""));
        assert!(!serialized.contains("\"lessons\""));
        assert!(content_dir.join("chapters").join("lesson_01.json").exists());
        assert!(!content_dir.join("lessons").exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn poi_cleanup_is_type_scoped_and_idempotent() {
        use super::{normalize_course_poi_fields, PaideiaCourse};
        use serde_json::Value;
        let block = serde_json::json!({
            "id":"b", "type":"point-of-interest", "title":"Image", "summary":"Résumé",
            "trackingKey":"b", "assetRefs":["images/a.png"], "subtitleRefs":[],
            "contentHtml":"<p>Texte conservé</p>", "markerPopupWidth":"270px", "markerPopupHeight":"auto",
            "pointOfInterestMarkers":[{"id":"m","x":20,"y":30,"order":1,"label":"A","title":"Point","contentHtml":"<p>Détail</p>"}]
        });
        let mut other = block.clone();
        other["id"] = serde_json::json!("image");
        other["type"] = serde_json::json!("image");
        let mut course: PaideiaCourse = serde_json::from_value(serde_json::json!({
            "id":"c","title":"Cours","modules":[{"id":"m","title":"Module","chapters":[{
                "id":"ch","title":"Chapitre","pages":[{"id":"p","title":"Page","blocks":[block,other]}]
            }]}]
        })).unwrap();
        let before = serde_json::to_value(&course).unwrap();
        assert!(normalize_course_poi_fields(&mut course));
        let mut expected = before;
        let image = &mut expected["modules"][0]["chapters"][0]["pages"][0]["blocks"][1];
        image["pointOfInterestMarkers"] = serde_json::json!([]);
        image["markerPopupWidth"] = Value::Null;
        image["markerPopupHeight"] = Value::Null;
        assert_eq!(serde_json::to_value(&course).unwrap(), expected);
        assert!(!normalize_course_poi_fields(&mut course));
    }

    #[test]
    fn migrates_only_legacy_rise_heading_only_text_blocks_to_headers() {
        let mut course: PaideiaCourse = serde_json::from_value(serde_json::json!({
            "id":"c","title":"Cours","modules":[{"id":"m","title":"Module","chapters":[{
                "id":"ch","title":"Chapitre","pages":[{"id":"p","title":"Page","blocks":[
                    {
                        "id":"heading","type":"rich-text","family":"text","variant":"paragraph",
                        "title":"Texte","summary":"Titre résiduel","trackingKey":"rich-text-heading",
                        "sourceFormat":"rise-scorm","contentHtml":"<div><h2>Un titre Rise</h2></div>",
                        "sourceRawHtml":"<h2>Un titre Rise</h2>",
                        "assetRefs":["images/banner.jpg"],
                        "sectionBackgroundImageRef":"images/banner.jpg","sectionBackgroundWide":true,
                        "sectionBackgroundHeight":"minimum"
                    },
                    {
                        "id":"text","type":"rich-text","family":"text","variant":"paragraph",
                        "title":"Texte","summary":"","trackingKey":"rich-text-text",
                        "sourceFormat":"rise-scorm","contentHtml":"<p>Un vrai paragraphe Rise</p>",
                        "assetRefs":["images/background.jpg"]
                    },
                    {
                        "id":"media","type":"image","family":"image","variant":"image",
                        "title":"Image","summary":"","trackingKey":"image-media",
                        "sourceFormat":"rise-scorm","assetRefs":["images/content.jpg"]
                    }
                ]}]
            }]}]
        }))
        .expect("course fixture should deserialize");

        assert!(migrate_legacy_rise_heading_blocks(&mut course));
        let blocks = &course.modules[0].chapters[0].pages[0].blocks;
        let heading = &blocks[0];
        assert_eq!(heading.block_type, "header");
        assert_eq!(heading.title, "En-tête");
        assert_eq!(heading.content_html.as_deref(), Some("<h2>Un titre Rise</h2>"));
        assert_eq!(heading.asset_refs, ["images/banner.jpg"]);
        assert_eq!(heading.header_height.as_deref(), Some("240px"));
        assert_eq!(heading.section_background_image_ref, None);
        assert_eq!(blocks[1].block_type, "rich-text");
        assert_eq!(blocks[2].block_type, "image");
        assert!(!migrate_legacy_rise_heading_blocks(&mut course));
    }

    #[test]
    fn detects_legacy_chapter_settings_recursively() {
        let value = serde_json::json!({
            "modules": [{
                "chapters": [{
                    "pages": [{
                        "blocks": [{
                            "quiz": { "settings": { "gateLessonUntilPassed": true } }
                        }]
                    }]
                }]
            }]
        });

        assert!(contains_legacy_chapter_key(&value));
    }
}
