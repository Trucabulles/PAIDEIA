use crate::models::{
    ActivityItem, AttachmentFile, CardSortActivityData, CardSortAppearance, CardSortCategory,
    CompleteActivityData, CompleteBlank, CompleteCover, CompleteEnding, CompleteExercise,
    CourseAppearance, ImageAccessibility, ImageCrop, ImportIssue, ImportRematchingEntry,
    ImportReport, ImportSummary, LessonCustomFont, LessonFontFace, MatchingActivityData, MatchingAppearance, MatchingPair, PaideiaBlock, PaideiaChapter, PaideiaCourse, PaideiaModule, PaideiaPage, PaideiaProject,
    PointOfInterestMarker, PointOfInterestMarkerMedia, QuestionBankQuestion, QuestionBankResource, QuizActivityData, QuizAnswer, QuizQuestion, QuizSettings,
    SituationalDialogueCharacter, SituationalDialogueCharacterPose, SituationalDialogueResponse,
};
use crate::repository::{repair_mojibake_in_project, repair_mojibake_string, save_project_to_path};
use crate::asset_integrity::clear_confirmed_missing_media;
use crate::scorm_package::{
    discover_course_payload, extract_scorm_archive, find_manifest, preflight_scorm_archive,
    relative_display, resolve_manifest_launch_path, write_scorm_import_diagnostic,
    ScormImportDiagnostic,
};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use chrono::Utc;
use regex::Regex;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};

struct RiseQuizExtraction {
    quiz: QuizActivityData,
    quality: &'static str,
    issue_message: Option<String>,
    missing_properties: Vec<String>,
}

struct RiseCompleteExtraction {
    complete: CompleteActivityData,
    quality: &'static str,
    issue_message: Option<String>,
    missing_properties: Vec<String>,
    item_missing_properties: Vec<Vec<String>>,
}

struct RiseMatchingExtraction {
    matching: Option<MatchingActivityData>,
    title: String,
    quality: &'static str,
    issue_message: Option<String>,
    missing_properties: Vec<String>,
}

struct RiseCardSortExtraction {
    card_sort: Option<CardSortActivityData>,
    activity_items: Vec<ActivityItem>,
    quality: &'static str,
    issue_message: Option<String>,
    missing_properties: Vec<String>,
}

#[derive(Debug)]
pub struct ScormImportResult {
    pub project_root: PathBuf,
    pub is_paideia_roundtrip: bool,
}

fn install_rise_default_inter_font(
    project_root: &Path,
    project: &mut PaideiaProject,
) -> Result<(), String> {
    macro_rules! inter_font {
        ($path:literal) => {
            include_bytes!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../public/fonts/Inter/",
                $path
            ))
            .as_slice()
        };
    }

    let entries: [(&str, u16, &str, &[u8]); 6] = [
        ("Inter-Regular.woff2", 400, "normal", inter_font!("Inter-Regular.woff2"),
        ),
        ("Inter-Italic.woff2", 400, "italic", inter_font!("Inter-Italic.woff2"),
        ),
        ("Inter-Medium.woff2", 500, "normal", inter_font!("Inter-Medium.woff2"),
        ),
        ("Inter-MediumItalic.woff2", 500, "italic", inter_font!("Inter-MediumItalic.woff2"),
        ),
        ("Inter-Bold.woff2", 700, "normal", inter_font!("Inter-Bold.woff2"),
        ),
        ("Inter-BoldItalic.woff2", 700, "italic", inter_font!("Inter-BoldItalic.woff2"),
        ),
    ];
    let family_dir = project_root.join("assets").join("fonts").join("inter");
    fs::create_dir_all(&family_dir).map_err(|err| err.to_string())?;
    let mut faces = Vec::with_capacity(entries.len());
    for (file_name, weight, style, bytes) in entries {
        fs::write(family_dir.join(file_name), bytes).map_err(|err| err.to_string())?;
        faces.push(LessonFontFace {
            file_name: file_name.to_string(),
            asset_ref: format!("fonts/inter/{file_name}"),
            weight,
            style: style.to_string(),
        });
    }
    fs::write(
        family_dir.join("OFL.txt"),
        include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/../public/fonts/Inter/OFL.txt")),
    )
    .map_err(|err| err.to_string())?;
    project.custom_font = Some(LessonCustomFont {
        id: "inter".to_string(),
        font_family: "Inter".to_string(),
        file_name: "Inter-Regular.woff2".to_string(),
        asset_ref: "fonts/inter/Inter-Regular.woff2".to_string(),
        license_ref: Some("fonts/inter/OFL.txt".to_string()),
        source: "bundled".to_string(),
        faces,
    });
    Ok(())
}

pub fn import_scorm_zip_with_details(
    scorm_zip_path: &str,
    destination_root: &str,
) -> Result<ScormImportResult, String> {
    let source = PathBuf::from(scorm_zip_path);
    preflight_scorm_archive(&source)?;
    let extracted_root = std::env::temp_dir().join(format!(
        "paideia_scorm_extract_{}_{}",
        std::process::id(),
        Utc::now().timestamp_nanos_opt().unwrap_or_default()
    ));
    fs::create_dir_all(&extracted_root).map_err(|err| err.to_string())?;
    let result = (|| {
        extract_scorm_archive(&source, &extracted_root)?;
        let import_root = PathBuf::from(destination_root).join("projects");
        fs::create_dir_all(&import_root).map_err(|err| err.to_string())?;

        // A native PAIDEIA snapshot is always restored before any external
        // discovery. An invalid signed package must fail and never be rematched.
        if let Some(project_root) =
            try_import_paideia_scorm_roundtrip(&extracted_root, &import_root)?
        {
            return Ok(ScormImportResult {
                project_root,
                is_paideia_roundtrip: true,
            });
        }

        let manifest_path = find_manifest(&extracted_root).ok_or_else(|| {
            "Importation impossible : le fichier imsmanifest.xml est introuvable.".to_string()
        })?;
        let launch_path = resolve_manifest_launch_path(&manifest_path, &extracted_root)?;
        let candidate = discover_course_payload(&extracted_root, launch_path.as_deref())?;
        let project_result = import_external_scorm_payload(
            &candidate.content_root,
            candidate.payload,
            destination_root,
        )?;
        write_scorm_import_diagnostic(
            &project_result.project_root,
            &ScormImportDiagnostic {
                engine: "scorm-resilient",
                manifest_path: relative_display(&extracted_root, &manifest_path),
                launch_path: launch_path
                    .as_deref()
                    .map(|path| relative_display(&extracted_root, path)),
                payload_path: relative_display(&extracted_root, &candidate.source_path),
                detector: candidate.detector,
                confidence: candidate.confidence,
            },
        )?;
        Ok(project_result)
    })();
    let _ = fs::remove_dir_all(&extracted_root);
    result
}

pub(crate) fn import_external_scorm_payload(
    scorm_content_root: &Path,
    rise_json: Value,
    destination_root: &str,
) -> Result<ScormImportResult, String> {
    let destination_root = PathBuf::from(destination_root);
    let import_root = destination_root.join("projects");
    fs::create_dir_all(&import_root).map_err(|err| err.to_string())?;
    let project_title = rise_json
        .get("course")
        .and_then(|course| course.get("title"))
        .and_then(Value::as_str)
        .unwrap_or("Cours SCORM importé");
    let project_title =
        repair_mojibake_string(project_title).unwrap_or_else(|| project_title.to_string());
    let existing_titles = collect_existing_project_titles(&import_root)?;
    let resolved_title = next_project_title(&project_title, &existing_titles);
    let project_slug = slugify(&resolved_title);
    let project_root = unique_project_folder(&import_root, &project_slug)?;
    fs::create_dir_all(&project_root).map_err(|err| err.to_string())?;

    let available_assets = list_asset_filenames(&scorm_content_root.join("assets"))?;
    let mut excluded_situational_dialogue_character_assets =
        rise_situational_dialogue_character_asset_refs(&rise_json, &available_assets);
    let duplicate_asset_refs = find_identical_rise_asset_refs(
        &scorm_content_root.join("assets"),
        &excluded_situational_dialogue_character_assets,
    )?;
    let (mut project, mut report, html_artifacts) = map_rise_json_to_project(
        &rise_json,
        &project_slug,
        &resolved_title,
        &available_assets,
    )?;
    report.issues.extend(missing_source_media_issues(&rise_json, &available_assets));
    remap_project_asset_refs(&mut project, &duplicate_asset_refs)?;
    excluded_situational_dialogue_character_assets.extend(duplicate_asset_refs.keys().cloned());
    repair_mojibake_in_project(&mut project)?;
    install_rise_default_inter_font(&project_root, &mut project)?;
    copy_assets(
        &scorm_content_root.join("assets"),
        &project_root.join("assets"),
        &report,
        &excluded_situational_dialogue_character_assets,
    )?;
    write_html_import_artifacts(&project_root, &html_artifacts)?;
    for missing in clear_confirmed_missing_media(&project_root, &mut project)? {
        report.issues.push(ImportIssue {
            severity: "error".to_string(),
            location: missing.location,
            source_block_type: missing.media_type.clone(),
            mapped_to: "empty".to_string(),
            message: format!("Média manquant ({}) : {}. Le champ a été laissé vide.", missing.media_type, missing.asset_ref),
        });
    }
    save_project_to_path(project_root.to_string_lossy().as_ref(), &project)?;
    write_import_report(&project_root, &report)?;
    Ok(ScormImportResult {
        project_root,
        is_paideia_roundtrip: false,
    })
}

fn rise_situational_dialogue_character_asset_refs(
    rise_json: &Value,
    available_assets: &[String],
) -> HashSet<String> {
    fn visit(value: &Value, available_assets: &[String], asset_refs: &mut HashSet<String>) {
        match value {
            Value::Object(object) => {
                if object.contains_key("slides") {
                    if let Some(character) = object.get("character") {
                        asset_refs.extend(collect_asset_refs(character, available_assets));
                    }
                }
                for child in object.values() {
                    visit(child, available_assets, asset_refs);
                }
            }
            Value::Array(values) => {
                for child in values {
                    visit(child, available_assets, asset_refs);
                }
            }
            _ => {}
        }
    }

    let mut asset_refs = HashSet::new();
    visit(rise_json, available_assets, &mut asset_refs);
    asset_refs
}

pub(crate) fn try_import_paideia_scorm_roundtrip(
    extracted_root: &Path,
    import_root: &Path,
) -> Result<Option<PathBuf>, String> {
    let Some(scorm_content_root) = resolve_paideia_scorm_content_root(extracted_root) else {
        return Ok(None);
    };

    let metadata_path = scorm_content_root
        .join("metadata")
        .join("paideia-export.json");
    let project_snapshot_path = scorm_content_root
        .join("metadata")
        .join("paideia-project.json");
    let metadata_raw = fs::read_to_string(&metadata_path).map_err(|err| err.to_string())?;
    let metadata: Value = serde_json::from_str(&metadata_raw).map_err(|err| err.to_string())?;
    let is_paideia_export = metadata
        .get("generator")
        .and_then(Value::as_str)
        .map(|value| value.eq_ignore_ascii_case("PAIDEIA"))
        .unwrap_or(false);
    if !is_paideia_export {
        return Ok(None);
    }

    if !project_snapshot_path.exists() {
        return Err(
            "SCORM PAIDEIA detecte, mais metadata/paideia-project.json est introuvable. Aucun fallback Rise n'est autorise pour un paquet PAIDEIA."
                .to_string(),
        );
    }

    let project_raw = fs::read_to_string(&project_snapshot_path).map_err(|err| {
        format!(
            "SCORM PAIDEIA detecte, mais metadata/paideia-project.json est illisible: {}. Aucun fallback Rise n'est autorise.",
            err
        )
    })?;
    let mut project = parse_paideia_project_snapshot(&project_raw).map_err(|err| {
        format!(
            "SCORM PAIDEIA detecte, mais le snapshot natif est invalide: {}. Aucun fallback Rise n'est autorise.",
            err
        )
    })?;
    let existing_titles = collect_existing_project_titles(import_root)?;
    let resolved_title = next_project_title(&project.title, &existing_titles);
    let project_slug = slugify(&resolved_title);
    let project_root = unique_project_folder(import_root, &project_slug)?;
    fs::create_dir_all(&project_root).map_err(|err| err.to_string())?;

    project.slug = project_slug;
    project.title = resolved_title.clone();
    project.status = "imported".to_string();
    project.updated_at = Utc::now().to_rfc3339();
    project.root_course_id = project.course.id.clone();
    project.course.title = resolved_title;

    save_project_to_path(project_root.to_string_lossy().as_ref(), &project)?;
    copy_paideia_roundtrip_assets(
        &scorm_content_root.join("assets"),
        &project_root.join("assets"),
    )?;
    Ok(Some(project_root))
}

fn parse_paideia_project_snapshot(raw: &str) -> Result<PaideiaProject, String> {
    let value: Value = serde_json::from_str(raw).map_err(|err| err.to_string())?;
    if let Some(schema_version) = value.get("schemaVersion").and_then(Value::as_u64) {
        match schema_version {
            2 => {
                let payload = value
                    .get("payload")
                    .ok_or_else(|| "Snapshot PAIDEIA schemaVersion 2 sans payload".to_string())?;
                let mut project: PaideiaProject =
                    serde_json::from_value(payload.clone()).map_err(|err| err.to_string())?;
                repair_mojibake_in_project(&mut project)?;
                Ok(project)
            }
            other => Err(format!(
                "Version de schema PAIDEIA non supportee: {}",
                other
            )),
        }
    } else {
        Err("Snapshot PAIDEIA sans schemaVersion supporte".to_string())
    }
}

fn resolve_paideia_scorm_content_root(extracted_root: &Path) -> Option<PathBuf> {
    [
        extracted_root.join("scormcontent"),
        extracted_root.to_path_buf(),
    ]
    .into_iter()
    .find(|candidate| {
        candidate
            .join("metadata")
            .join("paideia-export.json")
            .exists()
    })
}

fn copy_paideia_roundtrip_assets(
    source_assets_dir: &Path,
    destination_assets_dir: &Path,
) -> Result<(), String> {
    if !source_assets_dir.exists() {
        return Ok(());
    }
    fs::create_dir_all(destination_assets_dir).map_err(|err| err.to_string())?;
    copy_assets_recursive(
        source_assets_dir,
        source_assets_dir,
        destination_assets_dir,
        &HashSet::new(),
        true,
    )
}

fn extract_rise_course_payload(index_html_path: &Path) -> Result<Value, String> {
    let raw = fs::read_to_string(index_html_path).map_err(|err| err.to_string())?;
    let deserialize_matcher =
        Regex::new(r#"deserialize\("([^"]+)"\)"#).map_err(|err| err.to_string())?;
    let legacy_course_data_matcher =
        Regex::new(r#"(?:window\.)?courseData\s*=\s*["']([^"']+)["']"#)
            .map_err(|err| err.to_string())?;
    let encoded = deserialize_matcher
        .captures(&raw)
        .and_then(|captures| captures.get(1).map(|value| value.as_str()))
        .or_else(|| {
            legacy_course_data_matcher
                .captures(&raw)
                .and_then(|captures| captures.get(1).map(|value| value.as_str()))
        })
        .ok_or_else(|| {
            "Payload Rise introuvable dans index.html (deserialize ou window.courseData)"
                .to_string()
        })?;
    let decoded = STANDARD.decode(encoded).map_err(|err| err.to_string())?;
    serde_json::from_slice(&decoded).map_err(|err| err.to_string())
}

/// Rise exports before the 2026 runtime change serialize the course directly in
/// `index.html`, either through `deserialize(...)` or, for an intermediate
/// generation, through `window.courseData`. Newer exports leave `index.html` as
/// a shell and place the same payload in `runtime-data.js` through the local
/// `__jsonp` loader. Keep the inline parsers first so existing packages preserve
/// their exact path.
pub(crate) fn extract_rise_course_payload_from_content_root(
    scorm_content_root: &Path,
) -> Result<Value, String> {
    let index_html_path = scorm_content_root.join("index.html");
    match extract_rise_course_payload(&index_html_path) {
        Ok(payload) => Ok(payload),
        Err(index_error) => {
            let runtime_data_path = scorm_content_root.join("runtime-data.js");
            if !runtime_data_path.exists() {
                return Err(index_error);
            }
            extract_rise_runtime_data_payload(&runtime_data_path).map_err(|runtime_error| {
                format!(
                    "Payload Rise introuvable dans index.html ({}) ni dans runtime-data.js ({})",
                    index_error, runtime_error
                )
            })
        }
    }
}

fn extract_rise_runtime_data_payload(runtime_data_path: &Path) -> Result<Value, String> {
    let raw = fs::read_to_string(runtime_data_path).map_err(|err| err.to_string())?;
    let matcher = Regex::new(
        r#"__jsonp\(\s*[\"']runtime-data\.js[\"']\s*,\s*[\"']([^\"']+)[\"']\s*\)"#)
    .map_err(|err| err.to_string())?;
    let captures = matcher
        .captures(&raw)
        .ok_or_else(|| "Wrapper __jsonp runtime-data.js introuvable".to_string())?;
    let encoded = captures
        .get(1)
        .ok_or_else(|| "Payload runtime-data.js absent".to_string())?
        .as_str();
    let decoded = STANDARD.decode(encoded).map_err(|err| err.to_string())?;
    serde_json::from_slice(&decoded).map_err(|err| err.to_string())
}

fn map_rise_json_to_project(
    rise_payload: &Value,
    slug: &str,
    resolved_title: &str,
    available_assets: &[String],
) -> Result<(PaideiaProject, ImportReport, Vec<HtmlImportArtifact>), String> {
    let course = rise_payload
        .get("course")
        .ok_or_else(|| "Noeud de cours introuvable dans le payload".to_string())?;
    let title = resolved_title;
    let source_lessons = course
        .get("lessons")
        .and_then(Value::as_array)
        .ok_or_else(|| "Liste des leçons introuvable dans le payload".to_string())?;

    let course_image_ref = detect_course_image_asset_ref(course, available_assets);
    let course_intro_html = detect_course_intro_html(course);
    let imported_course_background = detect_rise_course_background_color(course);
    let now = Utc::now().to_rfc3339();
    let course_id = format!("course_{}", slug);
    let module_id = "mod_01".to_string();
    let mut mapped_chapters = Vec::new();
    let mut mapped_exact = 0usize;
    let mut mapped_approx = 0usize;
    let mut unsupported = 0usize;
    let mut issues = Vec::new();
    let mut asset_refs_count = 0usize;
    let mut rematching = Vec::new();
    let mut html_artifacts = Vec::new();
    let mut next_block_ordinal = 1usize;

    for (lesson_index, lesson_value) in source_lessons.iter().enumerate() {
        let chapter_title = lesson_value
            .get("title")
            .and_then(Value::as_str)
            .unwrap_or("Chapitre");
        let chapter_id = format!("chapter_{:02}", lesson_index + 1);
        let source_lesson_type = lesson_value
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("blocks");
        let page_blocks = if source_lesson_type == "quiz" {
            let block_id = imported_block_id(next_block_ordinal);
            next_block_ordinal += 1;
            let mapped = map_rise_quiz_lesson_to_block_with_id(
                lesson_value,
                lesson_index + 1,
                block_id);
            asset_refs_count += mapped.asset_refs.len();
            match mapped.mapping_quality.as_str() {
                "exact" => mapped_exact += 1,
                "approximate" => mapped_approx += 1,
                _ => unsupported += 1,
            }
            if let Some(issue) = mapped.issue {
                issues.push(issue);
            }
            rematching.push(mapped.rematching);
            if let Some(artifact) = mapped.html_artifact {
                html_artifacts.push(artifact);
            }
            vec![mapped.block]
        } else {
            let items = lesson_value
                .get("items")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let mut page_blocks = Vec::new();

            let mut block_index = 0usize;
            while block_index < items.len() {
                let item = &items[block_index];
                let next_item = items.get(block_index + 1);
                // Rise builds its terminal screen from an explanatory text block
                // followed by an `exit-course` button. This pair is not learning
                // content and is replaced by PAIDEIA's own navigation activity.
                if is_rise_exit_course_button(item)
                    || (is_rise_terminal_exit_message(item)
                        && next_item.is_some_and(is_rise_exit_course_button))
                {
                    block_index += 1;
                    continue;
                }

                if is_rise_fill_in(item) {
                    let group_end = items[block_index + 1..]
                        .iter()
                        .position(|candidate| !is_rise_fill_in(candidate))
                        .map(|offset| block_index + 1 + offset)
                        .unwrap_or(items.len());
                    let group = &items[block_index..group_end];
                    let block_id = imported_block_id(next_block_ordinal);
                    next_block_ordinal += 1;
                    let mapped_group = map_rise_fill_in_group_to_block_with_id(
                        group,
                        lesson_index + 1,
                        block_index + 1,
                        available_assets,
                        block_id,
                    );
                    match mapped_group.mapping_quality.as_str() {
                        "exact" => mapped_exact += group.len(),
                        "approximate" => mapped_approx += group.len(),
                        _ => unsupported += group.len(),
                    }
                    issues.extend(mapped_group.issues);
                    rematching.extend(mapped_group.rematching_entries);
                    page_blocks.push(mapped_group.block);
                    block_index = group_end;
                    continue;
                }

                let block_id = imported_block_id(next_block_ordinal);
                next_block_ordinal += 1;
                let mapped = map_rise_item_to_block_with_id(
                    item,
                    lesson_index + 1,
                    block_index + 1,
                    available_assets,
                    block_id,
                );
                asset_refs_count += mapped.asset_refs.len();
                match mapped.mapping_quality.as_str() {
                    "exact" => mapped_exact += 1,
                    "approximate" => mapped_approx += 1,
                    _ => unsupported += 1,
                }
                if let Some(issue) = mapped.issue {
                    issues.push(issue);
                }
                rematching.push(mapped.rematching);
                if let Some(artifact) = mapped.html_artifact {
                    html_artifacts.push(artifact);
                }
                page_blocks.push(mapped.block);
                block_index += 1;
            }

            page_blocks
        };

        mapped_chapters.push(PaideiaChapter {
            id: chapter_id,
            title: chapter_title.to_string(),
            pages: vec![PaideiaPage {
                id: format!("page_{:02}", lesson_index + 1),
                title: chapter_title.to_string(),
                blocks: page_blocks,
            }],
            scorm_tracking: None,
        });
    }

    ensure_imported_chapter_continue_markers(&mut mapped_chapters, &mut rematching);
    normalize_imported_final_continue(&mut mapped_chapters, &mut rematching);
    if let Some(background_color) = imported_course_background.as_deref() {
        clear_imported_course_background_from_blocks(&mut mapped_chapters, background_color);
    }
    if let Some(image_ref) = course_image_ref.as_ref() {
        asset_refs_count += 1;
        rematching.push(ImportRematchingEntry {
            location: "course/cover-image".to_string(),
            source_label: "Image bandeau module Rise".to_string(),
            source_family: "course".to_string(),
            source_variant: "coverImage".to_string(),
            source_type: "course-cover-image".to_string(),
            mapped_to: "project.courseImageRef".to_string(),
            status: "exact".to_string(),
            missing_properties: Vec::new(),
            artifact_path: Some(format!("assets/{}", image_ref)),
        });
    }
    if !course_intro_html.trim().is_empty() {
        rematching.push(ImportRematchingEntry {
            location: "course/intro".to_string(),
            source_label: "Texte d'introduction du menu Rise".to_string(),
            source_family: "course".to_string(),
            source_variant: "introText".to_string(),
            source_type: "course-intro-text".to_string(),
            mapped_to: "project.courseIntroHtml".to_string(),
            status: "exact".to_string(),
            missing_properties: Vec::new(),
            artifact_path: None,
        });
    }

    let project = PaideiaProject {
        id: format!("proj_{}", slug),
        slug: slug.to_string(),
        title: title.to_string(),
        description: String::new(),
        keywords: Vec::new(),
        course_intro_html,
        course_cover_title_html: String::new(),
        title_style: None,
        custom_font: None,
        imported_fonts: Vec::new(),
        course_image_ref,
        course_cover_style: None,
        activity_spacing_px: Some(30),
        hide_chapter_title_banner: false,
        course_appearance: Some(CourseAppearance {
            rounded_corners: true,
            shadows: true,
            text_color_mode: "default".to_string(),
            text_color: "#222222".to_string(),
            background_color: imported_course_background.unwrap_or_else(|| "#FFFFFF".to_string()),
        }),
        glossary_assistants: Vec::new(),
        question_banks: extract_rise_question_banks(source_lessons),
        reference_banks: Vec::new(),
        created_at: now.clone(),
        updated_at: now.clone(),
        created_by: String::new(),
        default_locale: "fr-FR".to_string(),
        locales: vec!["fr-FR".to_string()],
        status: "imported".to_string(),
        current_version: "v1-import".to_string(),
        root_course_id: course_id.clone(),
        course: PaideiaCourse {
            id: course_id,
            title: title.to_string(),
            modules: vec![PaideiaModule {
                id: module_id,
                title: title.to_string(),
                chapters: mapped_chapters,
            }],
        },
    };

    let report = ImportReport {
        source_type: "rise-scorm".to_string(),
        confidence: "confirmed-rise".to_string(),
        summary: ImportSummary {
            chapters_detected: source_lessons.len(),
            blocks_detected: mapped_exact + mapped_approx + unsupported,
            blocks_mapped_exactly: mapped_exact,
            blocks_mapped_approximately: mapped_approx,
            blocks_unsupported: unsupported,
            assets_copied: asset_refs_count,
        },
        issues,
        rematching,
    };

    Ok((project, report, html_artifacts))
}

fn imported_block_id(ordinal: usize) -> String {
    format!("blk_{:02}", ordinal)
}

/// Rise exports do not always include their navigation blocks. PAIDEIA chapters
/// are navigated explicitly, so preserve an existing Rise Continue when present
/// and otherwise inject one between two chapters. The last chapter always ends
/// with a course-exit: the synthetic final Continue is normalized just below.
fn ensure_imported_chapter_continue_markers(
    chapters: &mut [PaideiaChapter],
    rematching: &mut Vec<ImportRematchingEntry>,
) {
    let chapter_count = chapters.len();
    let mut next_block_ordinal = chapters
        .iter()
        .flat_map(|chapter| chapter.pages.iter())
        .map(|page| page.blocks.len())
        .sum::<usize>()
        + 1;
    for chapter_index in 0..chapter_count {
        let Some(page) = chapters[chapter_index].pages.last_mut() else {
            continue;
        };

        let is_final_chapter = chapter_index + 1 == chapter_count;

        let has_navigation_terminal = page
            .blocks
            .last()
            .map(|block| matches!(block.block_type.as_str(), "continue" | "course-exit"))
            .unwrap_or(false);
        let final_navigation_is_present = page
            .blocks
            .last()
            .map(|block| matches!(block.block_type.as_str(), "continue" | "course-exit"))
            .unwrap_or(false);
        if (!is_final_chapter && has_navigation_terminal)
            || (is_final_chapter && final_navigation_is_present)
        {
            continue;
        }

        let block_number = page.blocks.len() + 1;
        let synthetic_continue = serde_json::json!({
            "family": "continue",
            "variant": "continue",
            "type": "continue",
            "items": []
        });
        let block_id = imported_block_id(next_block_ordinal);
        next_block_ordinal += 1;
        let mapped = map_rise_item_to_block_with_id(
            &synthetic_continue,
            chapter_index + 1,
            block_number,
            &[],
            block_id,
        );
        page.blocks.push(mapped.block);
        rematching.push(ImportRematchingEntry {
            location: format!("lesson_{:02}/chapter-transition", chapter_index + 1),
            source_label: if is_final_chapter {
                "Sortie de leçon ajoutée par PAIDEIA"
            } else {
                "Transition entre chapitres ajoutée par PAIDEIA"
            }
            .to_string(),
            source_family: "paideia".to_string(),
            source_variant: if is_final_chapter {
                "injected-course-exit"
            } else {
                "injected-continue"
            }
            .to_string(),
            source_type: if is_final_chapter {
                "course-exit"
            } else {
                "chapter-transition"
            }
            .to_string(),
            mapped_to: "continue".to_string(),
            status: "injected".to_string(),
            missing_properties: vec![
                if is_final_chapter {
                    "Le SCORM Rise ne comportait pas de sortie de leçon explicite."
                } else {
                    "Le SCORM Rise ne comportait pas de bouton Continuer entre ces chapitres."
                }
                .to_string()],
            artifact_path: None,
        });
    }
}

fn normalize_imported_final_continue(
    chapters: &mut [PaideiaChapter],
    rematching: &mut [ImportRematchingEntry],
) {
    let Some(last_block) = chapters
        .iter_mut()
        .rev()
        .flat_map(|chapter| chapter.pages.iter_mut().rev())
        .flat_map(|page| page.blocks.iter_mut().rev())
        .find(|block| !block.block_type.trim().is_empty())
    else {
        return;
    };

    if last_block.block_type != "continue" {
        return;
    }

    last_block.block_type = "course-exit".to_string();
    last_block.title = "Sortir de la leçon".to_string();
    last_block.summary = "Sortir de la leçon".to_string();
    last_block.content_html = Some("Sortir de la leçon".to_string());
    last_block.family = None;
    last_block.variant = None;
    last_block.media_layout = None;
    last_block.image_size = None;
    last_block.content_width = None;
    last_block.content_align = None;
    last_block.media_gap = None;
    last_block.vertical_align = None;
    last_block.image_rounded = None;
    last_block.media_file_name = None;
    last_block.image_crop = None;
    last_block.panel_background_color = None;
    last_block.panel_border_color = None;
    last_block.panel_border_width = None;
    last_block.panel_border_style = None;
    last_block.panel_padding = None;
    last_block.panel_rounded = None;
    last_block.panel_shadow = None;
    last_block.section_background_color = None;
    last_block.section_background_image_ref = None;
    last_block.section_background_opacity = None;
    last_block.point_of_interest_markers.clear();
    last_block.activity_items.clear();
    last_block.asset_refs.clear();
    last_block.subtitle_refs.clear();
    last_block.video_subtitle_original_ref = None;
    last_block.source_raw_html = None;
    last_block.tracking_key = format!("course-exit-{}", last_block.id);

    if let Some(entry) = rematching
        .iter_mut()
        .rev()
        .find(|entry| entry.mapped_to == "continue")
    {
        entry.mapped_to = "course-exit".to_string();
        if !entry
            .missing_properties
            .iter()
            .any(|property| property == "Bouton final converti en sortie de leçon")
        {
            entry
                .missing_properties
                .push("Bouton final converti en sortie de leçon".to_string());
        }
    }
}

struct MappedBlock {
    block: PaideiaBlock,
    mapping_quality: String,
    issue: Option<ImportIssue>,
    asset_refs: Vec<String>,
    rematching: ImportRematchingEntry,
    html_artifact: Option<HtmlImportArtifact>,
}

struct MappedKnowledgeCheckGroup {
    block: PaideiaBlock,
    mapping_quality: String,
    issues: Vec<ImportIssue>,
    rematching_entries: Vec<ImportRematchingEntry>,
}

fn map_rise_fill_in_group_to_block_with_id(
    items: &[Value],
    lesson_number: usize,
    first_block_number: usize,
    available_assets: &[String],
    block_id: String,
) -> MappedKnowledgeCheckGroup {
    let extracted = extract_rise_fill_in_complete(items, &block_id);
    let mut mapped = map_rise_item_to_block_with_id(
        &items[0],
        lesson_number,
        first_block_number,
        available_assets,
        block_id.clone(),
    );
    mapped.block.block_type = "complete".to_string();
    mapped.block.family = Some("knowledgeCheck".to_string());
    mapped.block.variant = Some("fillin".to_string());
    mapped.block.title = "Texte à compléter".to_string();
    mapped.block.summary.clear();
    mapped.block.content_html = None;
    mapped.block.html_asset_root = None;
    mapped.block.html_entry_file = None;
    mapped.block.html_package_name = None;
    mapped.block.quiz = None;
    mapped.block.complete = Some(extracted.complete);
    mapped.block.source_block_type = Some("knowledgeCheck/fillin-group".to_string());
    mapped.block.source_raw_html = None;
    mapped.block.asset_refs.clear();
    mapped.block.rich_inline_asset_refs.clear();
    mapped.block.tracking_key = format!("complete-{}", block_id);

    let mut issues = Vec::new();
    if let Some(message) = extracted.issue_message.clone() {
        issues.push(ImportIssue {
            severity: "info".to_string(),
            location: format!(
                "lesson_{:02}/blocks_{:02}_{:02}",
                lesson_number,
                first_block_number,
                first_block_number + items.len() - 1
            ),
            source_block_type: "knowledgeCheck/fillin".to_string(),
            mapped_to: "complete".to_string(),
            message,
        });
    }

    let rematching_entries = items
        .iter()
        .enumerate()
        .map(|(offset, item)| {
            let missing_properties = extracted
                .item_missing_properties
                .get(offset)
                .cloned()
                .unwrap_or_default();
            ImportRematchingEntry {
                location: format!(
                    "lesson_{:02}/block_{:02}",
                    lesson_number,
                    first_block_number + offset
                ),
                source_label: extract_source_label(item, "knowledgeCheck", "fillin"),
                source_family: "knowledgeCheck".to_string(),
                source_variant: "fillin".to_string(),
                source_type: item
                    .get("type")
                    .and_then(Value::as_str)
                    .unwrap_or("knowledgeCheck")
                    .to_string(),
                mapped_to: "complete".to_string(),
                status: if missing_properties.is_empty() {
                    "grouped".to_string()
                } else {
                    "partial".to_string()
                },
                missing_properties,
                artifact_path: Some(format!(
                    "content/blocks/blk_{:02}_{:02}.json",
                    lesson_number, first_block_number
                )),
            }
        })
        .collect::<Vec<_>>();

    issues.push(ImportIssue {
        severity: "info".to_string(),
        location: format!(
            "lesson_{:02}/blocks_{:02}_{:02}",
            lesson_number,
            first_block_number,
            first_block_number + items.len() - 1
        ),
        source_block_type: "knowledgeCheck/fillin-group".to_string(),
        mapped_to: "complete".to_string(),
        message: format!(
            "{} bloc(s) Fill in the blanks Rise regroupé(s) dans un document Texte à compléter.",
            items.len()
        ),
    });

    MappedKnowledgeCheckGroup {
        block: mapped.block,
        mapping_quality: extracted.quality.to_string(),
        issues,
        rematching_entries,
    }
}

fn rise_bank_id(entry: &Value) -> String {
    let source_id = entry.get("questionBankId").and_then(Value::as_str)
        .or_else(|| entry.get("id").and_then(Value::as_str))
        .unwrap_or("unknown");
    let revision = entry.get("questionBankUpdatedAt").and_then(Value::as_str).unwrap_or("");
    format!("rise-bank-{}-{}", source_id, revision.chars().filter(char::is_ascii_alphanumeric).collect::<String>())
}

fn rise_bank_entries<'a>(lessons: &'a [Value]) -> Vec<&'a Value> {
    let mut entries = Vec::new();
    for lesson in lessons {
        let Some(items) = lesson.get("items").and_then(Value::as_array) else { continue; };
        for item in items {
            if item.get("type").and_then(Value::as_str) == Some("DRAW_FROM_QUESTION_BANK") {
                entries.push(item);
            }
            if normalize_rise_source_key(item.get("variant").and_then(Value::as_str).unwrap_or_default()) == "draw from question bank" {
                if let Some(nested) = item.get("items").and_then(Value::as_array) {
                    entries.extend(nested.iter().filter(|entry| entry.get("type").and_then(Value::as_str) == Some("DRAW_FROM_QUESTION_BANK")));
                }
            }
        }
    }
    entries
}

fn is_rise_true_false_question(question: &Value) -> bool {
    if question.get("type").and_then(Value::as_str) != Some("MULTIPLE_CHOICE") { return false; }
    let Some(answers) = question.get("answers").and_then(Value::as_array) else { return false; };
    if answers.len() != 2 { return false; }
    let labels = answers.iter().map(|answer| {
        let raw = extract_html_field(answer, &["title", "label", "text", "answer"]).unwrap_or_default();
        strip_html(&raw).trim().to_lowercase()
    }).collect::<HashSet<_>>();
    labels == HashSet::from(["vrai".to_string(), "faux".to_string()])
        || labels == HashSet::from(["true".to_string(), "false".to_string()])
}

fn set_rise_true_false_mode(question: &mut QuizQuestion) {
    question.mode = "true-false".to_string();
    question.answers.sort_by_key(|answer| {
        let label = strip_html(&answer.text_html).trim().to_lowercase();
        if label == "vrai" || label == "true" { 0 } else { 1 }
    });
}

fn extract_rise_question_banks(lessons: &[Value]) -> Vec<QuestionBankResource> {
    let mut banks = Vec::new();
    let mut seen = HashSet::new();
    for entry in rise_bank_entries(lessons) {
        let Some(source_questions) = entry.get("questions").and_then(Value::as_array) else { continue; };
        if source_questions.is_empty() { continue; }
        let id = rise_bank_id(entry);
        if !seen.insert(id.clone()) { continue; }
        let questions = source_questions.iter().filter_map(|source| {
            if !matches!(source.get("type").and_then(Value::as_str), Some("MULTIPLE_CHOICE" | "MULTIPLE_RESPONSE")) { return None; }
            let (mut question, _) = build_rise_quiz_question(source, Some(&id));
            if is_rise_true_false_question(source) { set_rise_true_false_mode(&mut question); }
            Some(QuestionBankQuestion { question, title: None, category: None, tags: Vec::new() })
        }).collect();
        banks.push(QuestionBankResource {
            id,
            name: entry.get("questionBankTitle").and_then(Value::as_str).unwrap_or("Banque Rise").to_string(),
            tile_image_ref: None,
            questions,
        });
    }
    banks
}

fn is_rise_fill_in(item: &Value) -> bool {
    item.get("family")
        .and_then(Value::as_str)
        .is_some_and(|family| family == "knowledgeCheck")
        && matches!(
            normalize_rise_source_key(
                item.get("variant")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
            )
            .as_str(),
            "fillin" | "fill in" | "fill in the blank" | "fill in the blanks"
        )
}

fn rise_knowledge_check_requires_correct(item: &Value) -> bool {
    item.get("settings")
        .and_then(|settings| settings.get("requireCorrectAnswer"))
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

struct HtmlImportArtifact {
    folder: String,
    html: String,
    descriptor: Value,
}

#[cfg(test)]
fn map_rise_item_to_block(
    item: &Value,
    lesson_number: usize,
    block_number: usize,
    available_assets: &[String],
) -> MappedBlock {
    map_rise_item_to_block_with_id(
        item,
        lesson_number,
        block_number,
        available_assets,
        imported_block_id(block_number),
    )
}

fn map_rise_item_to_block_with_id(
    item: &Value,
    lesson_number: usize,
    block_number: usize,
    available_assets: &[String],
    block_id: String,
) -> MappedBlock {
    let source_family = item
        .get("family")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let source_variant = item
        .get("variant")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let normalized_variant = normalize_rise_source_key(source_variant);
    // Rise family identifiers are stable keys such as `interactive-fullscreen`.
    // Keep their original separator: several native rematchings rely on it.
    let family = source_family.trim();
    let variant = normalized_variant.as_str();
    let item_type = item
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let location = format!("lesson_{:02}/block_{:02}", lesson_number, block_number);
    let item_entries = item
        .get("items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let collected_asset_refs = collect_asset_refs(item, available_assets);
    let asset_refs = preferred_native_asset_refs(
        item,
        family,
        variant,
        available_assets,
        &collected_asset_refs,
    );
    let mut media_layout = detect_media_layout(family, variant, item);
    let image_size = detect_image_size(family, variant, item);
    let mut content_width = detect_content_width(family, item);
    let content_align = detect_content_align(family, item);
    let media_gap = detect_media_gap(family, variant, item);
    let vertical_align = detect_vertical_align(family, variant, item);
    let image_rounded = detect_image_rounded(item);
    let panel_background_color = detect_panel_background_color(family, item);
    let panel_padding = detect_panel_padding(family, item);
    let section_background_color = detect_section_background_color(family, item);
    let section_background_image_ref = detect_section_background_asset_ref(item, available_assets);
    let has_section_background_image = section_background_image_ref.is_some();
    let section_background_opacity = detect_section_background_opacity(item);
    let quote_author_html = extract_quote_author_html(family, item);
    let mut quiz_data = None;
    let mut complete_data = None;
    let mut card_sort_data = None;
    let mut matching_data = None;
    let mut rise_card_sort_items = Vec::new();
    let mut extra_missing_properties = Vec::new();
    let resource_actions = if family == "buttons" && matches!(variant, "button" | "button stack") {
        extract_rise_resource_actions(&item_entries, item.get("settings"))
    } else {
        Vec::new()
    };
    let has_invalid_resource = resource_actions
        .iter()
        .any(|action| action.resource_valid == Some(false));
    let rise_symmetric_padding = imported_rise_padding(item);

    let (native_type, title, mut summary, quality, issue_message) = match (family, variant) {
        ("image", "text overlay") => (
            "header",
            "En-tête".to_string(),
            String::new(),
            "approximate",
            Some("Hauteur visuelle Rise indisponible : repli à 240 px à vérifier.".to_string()),
        ),
        ("text", "heading") => (
            "header",
            "En-tête".to_string(),
            String::new(),
            "exact",
            None),
        ("text", "paragraph") if rise_plain_paragraph_contains_only_a_heading(&item_entries) => (
            "header",
            "En-tête".to_string(),
            String::new(),
            "exact",
            None,
        ),
        ("text", "paragraph") => (
            "rich-text",
            "Texte".to_string(),
            extract_rise_heading_paragraph_or_default(&item_entries, ""),
            "exact",
            None,
        ),
        ("text", "paragraph with heading")
        | ("text", "paragraph with subheading")
        | ("text", "subheading paragraph")
        | ("text", "subheading")
        | ("text", "heading paragraph") => (
            "rich-text",
            extract_rise_text_variant_title_or_default(
                &item_entries,
                variant,
                "Texte"),
            extract_rise_heading_paragraph_or_default(&item_entries, ""),
            "exact",
            None,
        ),
        ("text", "two column")
        | ("text", "three column")
        | ("text", "four column")
        | ("text", "columns") => {
            (
            "rich-text",
            "Texte".to_string(),
            String::new(),
            "exact",
            None)
        }
        ("image", "text aside") => (
            "image-text",
            extract_heading_or_default(&item_entries, "Image et texte"),
            extract_paragraph_or_default(&item_entries, "Activité image/texte importée."),
            "exact",
            None,
        ),
        ("image", "hero") => (
            "image",
            "Image".to_string(),
            String::new(),
            "exact",
            None),
        (_, "two column") | (_, "three column") | (_, "four column") => {
            (
            "image-grid",
            "Grille d’images".to_string(),
            String::new(),
            "exact",
            None)
        }
        ("image", _) if !asset_refs.is_empty() => (
            "image",
            "Image".to_string(),
            String::new(),
            "exact",
            None),
        ("impact", "note") => (
            "note",
            "Note".to_string(),
            extract_paragraph_or_default(&item_entries, "Note importée."),
            "exact",
            None,
        ),
        ("quote", _) => (
            "quote",
            "Citation".to_string(),
            extract_paragraph_or_default(&item_entries, "Citation importÃ©e."),
            "exact",
            None,
        ),
        (statement_family, statement_variant)
            if is_rise_statement_variant(statement_family, statement_variant) => (
            "rich-text",
            extract_heading_or_default(&item_entries, "Texte"),
            extract_rise_heading_paragraph_or_default(&item_entries, ""),
            "exact",
            None,
        ),
        ("list", _) => (
            "rich-text",
            "Texte".to_string(),
            String::new(),
            "exact",
            None),
        ("multimedia", "video") => (
            "media",
            "".to_string(),
            extract_paragraph_or_default(&item_entries, ""),
            "exact",
            None,
        ),
        ("attachment", _) | ("multimedia", "attachment") => (
            "attachment",
            "Fichier".to_string(),
            String::new(),
            "exact",
            None),
        ("buttons", "button") | ("buttons", "button stack") => (
            "links-resources",
            String::new(),
            String::new(),
            if has_invalid_resource { "approximate" } else { "exact" },
            if has_invalid_resource {
                Some("Une destination de lien n’a pas pu être déterminée sans ambiguïté. La valeur source est conservée, mais le lien reste inactif jusqu’à sa correction.".to_string())
            } else {
                None
            },
        ),
        ("html", "inline") => (
            "html-custom",
            extract_source_label(item, family, variant),
            String::new(),
            "exact",
            None,
        ),
        ("continue", _) => (
            "continue",
            "Continuer".to_string(),
            {
                let label = strip_html(&extract_title_or_default(&item_entries, "Continuer"));
                if label.is_empty() { "Continuer".to_string() } else { label }
            },
            "approximate",
            Some("Séparateur de progression converti en activité Continuer PAIDEIA.".to_string()),
        ),
        ("divider", "numbered divider") => (
            "section-marker",
            "Séparateur repéré".to_string(),
            String::new(),
            "exact",
            None),
        ("divider", "spacing divider") => (
            "divider",
            "Separateur".to_string(),
            "Espacement Rise importé comme séparateur sans ligne.".to_string(),
            "exact",
            None,
        ),
        ("divider", "divider") => (
            "divider",
            "Separateur".to_string(),
            "Séparateur importé.".to_string(),
            "exact",
            None,
        ),
        ("interactive-fullscreen", "labeledgraphic") => (
            "point-of-interest",
            String::new(),
            String::new(),
            "approximate",
            Some("Les contenus et médias des points d’intérêt ont été importés ; l’apparence exacte des panneaux Rise peut différer.".to_string(),
        ),
        ),
        ("interactive-fullscreen", "timeline") => (
            "timeline",
            "Frise chronologique".to_string(),
            String::new(),
            "exact",
            None),
        ("interactive-fullscreen", "process") => (
            "slides",
            "Présentation".to_string(),
            String::new(),
            "exact",
            None),
        ("interactive-fullscreen", "scenario") => (
            "situational-dialogue",
            "Mise en situation".to_string(),
            String::new(),
            "exact",
            None,
        ),
        ("interactive", "tabs") | ("interactive-fullscreen", "tabs") => (
            "tabs",
            "Onglets".to_string(),
            String::new(),
            "exact",
            None),
        (accordion_family, accordion_variant)
            if is_rise_accordion_variant(accordion_family, accordion_variant) => {
            (
            "accordion",
            "Accordéon".to_string(),
            String::new(),
            "exact",
            None)
        }
        ("interactive-fullscreen", "sorting") => {
            let extracted = extract_rise_card_sort_activity(item, &block_id, available_assets);
            extra_missing_properties = extracted.missing_properties.clone();
            if let Some(card_sort) = extracted.card_sort {
                card_sort_data = Some(card_sort);
                rise_card_sort_items = extracted.activity_items;
                (
                    "card-sort",
                    "Tri de cartes".to_string(),
                    String::new(),
                    extracted.quality,
                    extracted.issue_message,
                )
            } else {
                (
                    "html-custom",
                    "Tri de cartes".to_string(),
                    "Activité de tri Rise conservée en contenu de secours.".to_string(),
                    extracted.quality,
                    extracted.issue_message,
                )
            }
        }
        ("knowledgeCheck", "multiple choice")
        | ("knowledgeCheck", "multiple response")
        | ("knowledgeCheck", "draw from question bank") => {
            let mut extracted = extract_rise_knowledge_check_quiz(item);
            let bank_draw = variant == "draw from question bank";
            let question_source = item_entries.first().unwrap_or(&Value::Null);
            let native_question_type = if bank_draw {
                let count = question_source.get("drawCount").and_then(Value::as_u64).unwrap_or(1);
                extracted.quiz.settings.limit_questions = true;
                extracted.quiz.settings.question_limit = count.max(1).min(extracted.quiz.questions.len().max(1) as u64) as u32;
                extracted.quiz.settings.shuffle_questions = true;
                for (question, source) in extracted.quiz.questions.iter_mut().zip(question_source.get("questions").and_then(Value::as_array).into_iter().flatten()) {
                    question.source_bank_id = Some(rise_bank_id(question_source));
                    if is_rise_true_false_question(source) { set_rise_true_false_mode(question); }
                }
                if !extracted.quiz.questions.is_empty() {
                    extracted.missing_properties.retain(|property| property != "Tirage aleatoire Rise");
                    if extracted.missing_properties.is_empty() {
                        extracted.quality = "exact";
                        extracted.issue_message = None;
                    } else if extracted.missing_properties.iter().any(|property| property.contains("Feedback par choix")) {
                        extracted.issue_message = Some("Le feedback par choix Rise doit être vérifié.".to_string());
                    }
                }
                "question-random"
            } else if is_rise_true_false_question(question_source) {
                if let Some(question) = extracted.quiz.questions.first_mut() {
                    set_rise_true_false_mode(question);
                }
                "question-true-false"
            } else if question_source.get("type").and_then(Value::as_str) == Some("MULTIPLE_RESPONSE") {
                "question-multiple"
            } else {
                "question-unique"
            };
            extracted.quiz.settings.passing_score = 0.0;
            extracted.quiz.settings.gate_chapter_until_passed = false;
            extracted.quiz.settings.send_score_to_lms = false;
            extracted.quiz.settings.max_attempts = if rise_knowledge_check_requires_correct(item) { 0 } else { 1 };
            extracted.quiz.settings.allow_retry = extracted.quiz.settings.max_attempts != 1;
            extracted.quiz.settings.show_feedback = extracted.quiz.questions.iter().any(|question| {
                question.general_feedback_html.as_deref().is_some_and(has_meaningful_html)
                    || question.feedback_correct_html.as_deref().is_some_and(has_meaningful_html)
                    || question.feedback_incorrect_html.as_deref().is_some_and(has_meaningful_html)
            });
            extra_missing_properties = extracted.missing_properties.clone();
            quiz_data = Some(extracted.quiz);
            (
                native_question_type,
                match native_question_type {
                    "question-random" => "Questions aléatoires",
                    "question-true-false" => "Vrai ou faux",
                    "question-multiple" => "Question à choix multiple",
                    _ => "Question à choix unique",
                }.to_string(),
                String::new(),
                extracted.quality,
                extracted.issue_message,
            )
        }
        ("knowledgeCheck", "fillin")
        | ("knowledgeCheck", "fill in")
        | ("knowledgeCheck", "fill in the blank")
        | ("knowledgeCheck", "fill in the blanks") => {
            let extracted = extract_rise_fill_in_complete(
                std::slice::from_ref(item),
                &block_id);
            extra_missing_properties = extracted.missing_properties.clone();
            complete_data = Some(extracted.complete);
            (
                "complete",
                "Texte à compléter".to_string(),
                String::new(),
                extracted.quality,
                extracted.issue_message,
            )
        }
        ("knowledgeCheck", "matching") => {
            let extracted = extract_rise_matching_activity(item, &block_id, available_assets);
            extra_missing_properties = extracted.missing_properties.clone();
            if let Some(matching) = extracted.matching {
                matching_data = Some(matching);
                (
                    "matching",
                    extracted.title,
                    String::new(),
                    extracted.quality,
                    extracted.issue_message,
                )
            } else {
                (
                    "html-custom",
                    extracted.title,
                    "Activité Relier Rise conservée en contenu de secours.".to_string(),
                    extracted.quality,
                    extracted.issue_message,
                )
            }
        }
        ("chart", "line") => {
            extra_missing_properties = vec![
                "Rendu graphique Rise exact".to_string(),
                "Animation d'entrée Rise".to_string()];
            (
                "html-custom",
                extract_title_or_default(&item_entries, "Graphique en courbe"),
                String::new(),
                "approximate",
                Some(
                    "Le graphique en courbe Rise a été reconstruit en HTML/SVG accessible. Son contenu et ses valeurs sont conservés, mais son apparence et son animation doivent être vérifiées."
                        .to_string(),
                ),
            )
        }
        _ if is_flashcard_family(family, variant, item_type) => (
            "flip-cards",
            extract_title_or_default(&item_entries, "Cartes à retourner"),
            String::new(),
            "exact",
            None,
        ),
        _ => (
            "html-custom",
            format!("Activité {}", family),
            extract_paragraph_or_default(&item_entries, "Activité non mappée automatiquement."),
            "unsupported",
            Some("Cette activité n'est pas encore mappée nativement et a été conservée en contenu de secours.".to_string()),
        ),
    };

    let header_background_color = if native_type == "header" && !collected_asset_refs.is_empty() {
        Some("transparent".to_string())
    } else if native_type == "header" {
        item.get("settings")
            .and_then(|settings| settings.get("backgroundColor"))
            .and_then(Value::as_str)
            .filter(|color| !color.trim().is_empty())
            .map(str::to_string)
            .or_else(|| Some("transparent".to_string()))
    } else {
        None
    };

    // Rise stock characters are deliberately substituted with PAIDEIA's default
    // character. Their source media must not remain referenced by the project.
    let mut asset_refs = if native_type == "situational-dialogue" {
        Vec::new()
    } else {
        asset_refs
    };
    if native_type == "rich-text" {
        // Rise has no inline-image contract inside a text block. Images found
        // while walking that source block belong to its canvas/background and
        // must never be exposed as Rich Text content media.
        asset_refs.retain(|asset_ref| !is_image_asset_ref(asset_ref));
    } else if supports_native_activity_background(native_type)
        && !matches!(native_type, "header" | "image")
    {
        if let Some(background_asset_ref) = section_background_image_ref.as_deref() {
            asset_refs.retain(|asset_ref| asset_ref != background_asset_ref);
        }
    }
    let media_file_name = if native_type == "media" {
        asset_refs
            .iter()
            .find(|asset_ref| is_video_asset_ref(asset_ref))
            .and_then(|asset_ref| Path::new(asset_ref).file_name())
            .and_then(|file_name| file_name.to_str())
            .map(str::to_string)
    } else {
        None
    };

    if native_type == "html-custom" {
        media_layout = Some(detect_rise_html_layout(item));
    }
    if native_type == "image" {
        media_layout = Some("image-center".to_string());
    }
    if native_type == "image-grid" {
        content_width = Some(match variant {
            "three column" => "3".to_string(),
            "four column" => "4".to_string(),
            _ => "2".to_string(),
        });
    }

    let paideia_minimum_padding = imported_activity_minimum_padding(native_type);
    let issue = issue_message.map(|message| ImportIssue {
        severity: if quality == "unsupported" {
            "warning".to_string()
        } else {
            "info".to_string()
        },
        location: location.clone(),
        source_block_type: format!("{}/{}", family, variant),
        mapped_to: native_type.to_string(),
        message,
    });

    let mut source_raw_html = if family == "html" && variant == "inline" {
        extract_rise_inline_html(&item_entries)
    } else if family == "chart" && variant == "line" {
        build_rise_line_chart_html(item).or_else(|| {
            Some(build_structured_html_fallback(
                item,
                "Les données du graphique Rise n'ont pas pu être reconstruites.",
                &collected_asset_refs,
            ))
        })
    } else if family == "image" && variant == "text overlay" {
        extract_rise_text_overlay_html(&item_entries)
            .or_else(|| extract_source_raw_html(&item_entries))
            .map(|html| normalize_imported_header_html(&html))
    } else if native_type == "header" && family == "text" {
        extract_rise_text_variant_html(&item_entries, variant)
            .map(|html| normalize_imported_header_html(&html))
    } else if native_type == "header" {
        extract_rise_heading_html_without_placeholder(&item_entries)
            .or_else(|| extract_source_raw_html(&item_entries))
            .map(|html| normalize_imported_header_html(&html))
    } else if native_type == "continue" {
        // Native navigation carries a plain label only, never source button HTML.
        None
    } else if native_type == "links-resources" {
        // Rise stores button descriptions both in the generic block HTML and on
        // each item. PAIDEIA keeps one optional global introduction plus one
        // description per link, so the generic duplicate must not be imported.
        None
    } else if native_type == "point-of-interest" {
        // Labeled Graphic panel contents belong exclusively to the native POI
        // markers. The generic extractor would concatenate them once again into
        // a Rich Text block displayed below the image.
        None
    } else if native_type == "card-sort" {
        // Categories and cards are carried by the native Card Sort model.
        // Keeping the generic concatenated HTML would duplicate their content.
        None
    } else if native_type == "rich-text" && family == "list" {
        extract_list_source_html(&item_entries, variant)
            .or_else(|| extract_source_raw_html(&item_entries))
            .map(|html| normalize_rise_html_units(&html))
    } else if native_type == "rich-text" && is_rise_text_columns_variant(family, variant) {
        extract_rise_text_columns_html(&item_entries)
    } else if native_type == "rich-text" && family == "text" {
        extract_rise_text_variant_html(&item_entries, variant)
    } else if native_type == "rich-text" {
        extract_rise_heading_html_without_placeholder(&item_entries)
    } else if quality == "unsupported" {
        let has_source_content = extract_all_source_html(&item_entries)
            .as_deref()
            .is_some_and(has_meaningful_html)
            || !collected_asset_refs.is_empty();
        has_source_content.then(|| build_structured_html_fallback(item, &summary, &collected_asset_refs))
    } else {
        extract_source_raw_html(&item_entries).map(|html| {
            if native_type == "header" {
                normalize_imported_header_html(&html)
            } else if matches!(native_type, "rich-text" | "note") {
                normalize_rise_html_units(&html)
            } else {
                html
            }
        })
    };
        // Text variants are extracted through dedicated fields and therefore do not
        // necessarily pass through the generic wrapper above. Their background is
        // now carried by the PAIDEIA activity panel, never by an inner Rich Text
        // wrapper: preserve inline formatting while removing that nested canvas.
        if matches!(native_type, "rich-text" | "note") {
            if let Some(html) = source_raw_html.take() {
                source_raw_html = Some(normalize_rise_html_units(&html));
            }
        }

        // A native Note has one editable Rich Text source. Rise also exposes a
        // plain-text summary for the same paragraph; persisting both creates a
        // second, non-editable copy when the activity appearance is refreshed.
        if native_type == "note" {
            if source_raw_html.is_none() && !summary.trim().is_empty() {
                source_raw_html = Some(format!("<p>{}</p>", escape_html(&summary)));
            }
            if source_raw_html
                .as_deref()
                .map(has_meaningful_html)
                .unwrap_or(false)
            {
                summary.clear();
            }
        }

    // Rise uses `items` for many activity families, not only labeled graphics.
    let point_of_interest_markers = if native_type == "point-of-interest" {
        extract_point_of_interest_markers(item, available_assets)
    } else {
        Vec::new()
    };
    let attachment_files = if native_type == "attachment" {
        extract_attachment_files(item, &asset_refs, &block_id)
    } else {
        Vec::new()
    };
    let activity_items = if native_type == "flip-cards" {
        extract_flashcard_activity_items(&item_entries, available_assets)
    } else if native_type == "slides" {
        let force_center_layout =
            matches!((family, variant), ("interactive-fullscreen", "process"));
        extract_slides_activity_items(&item_entries, available_assets, force_center_layout)
    } else if native_type == "timeline" {
        extract_timeline_activity_items(&item_entries)
    } else if native_type == "situational-dialogue" {
        extract_situational_dialogue_activity_items(&item_entries, available_assets, &block_id)
    } else if native_type == "tabs" {
        extract_tabs_activity_items(item, family, &item_entries, available_assets)
    } else if native_type == "accordion" {
        extract_rise_accordion_activity_items(&item_entries, available_assets)
    } else if native_type == "image-grid" {
        extract_rise_image_grid_activity_items(&item_entries, available_assets)
    } else if native_type == "card-sort" {
        rise_card_sort_items
    } else if native_type == "links-resources" {
        resource_actions
    } else {
        Vec::new()
    };
    let has_imported_section_background =
        section_background_color.is_some() || has_section_background_image;
    // Keep the importer aligned with the appearance contract used by the
    // editor and SCORM renderer. The former shorter list left recent native
    // rematchings with a non-wide backdrop that could not be edited reliably.
    let supports_activity_background = supports_native_activity_background(native_type);
    let supports_imported_section_background =
        supports_activity_background && native_type != "image";
    let paideia_intrinsic_padding = if native_type == "header" {
        32
    } else if supports_imported_section_background && has_imported_section_background {
        if native_type == "rich-text" { 0 } else { 75 }
    } else {
        0
    };
    let paideia_base_padding = 30 + paideia_intrinsic_padding;
    let rise_padding_offset = rise_symmetric_padding
        .map(|padding| {
            (padding.max(paideia_minimum_padding) - paideia_base_padding)
                .clamp(paideia_minimum_padding - paideia_base_padding, 90)
        });
    let situational_dialogue_characters = if native_type == "situational-dialogue" {
        vec![default_situational_dialogue_character()]
    } else {
        Vec::new()
    };

    let status = match quality {
        "exact" => "exact",
        "approximate" => "partial",
        _ if source_raw_html.as_deref().is_some_and(has_meaningful_html) => "fallback-html",
        _ => "unsupported",
    };
    let source_label = extract_source_label(item, family, variant);
    let mut missing_properties = rematching_missing_properties(family, variant, quality);
    for missing_property in extra_missing_properties {
        if !missing_properties.contains(&missing_property) {
            missing_properties.push(missing_property);
        }
    }
    let artifact_folder = if native_type == "html-custom"
        && !(family == "chart" && variant == "line")
        && source_raw_html.as_deref().is_some_and(has_meaningful_html)
    {
        Some(format!(
            "{}/{}",
            if quality == "unsupported" {
                "html-fallback"
            } else {
                "html"
            },
            block_id
        ))
    } else {
        None
    };
    let artifact_path = artifact_folder
        .as_ref()
        .map(|folder| format!("assets/{}/descriptor.json", folder));
    let html_artifact = artifact_folder.as_ref().and_then(|folder| {
        source_raw_html.as_ref().map(|html| HtmlImportArtifact {
            folder: folder.clone(),
            html: html.clone(),
            descriptor: serde_json::json!({
                "blockId": block_id,
                "location": location.clone(),
                "sourceLabel": source_label.clone(),
                "sourceFamily": family,
                "sourceVariant": variant,
                "sourceType": item_type,
                "mappedTo": native_type,
                "status": status,
                "missingProperties": missing_properties.clone(),
                "sourceSettings": item.get("settings").cloned().unwrap_or(Value::Null),
                "assetRefs": asset_refs.clone(),
            }),
        })
    });

    MappedBlock {
        block: PaideiaBlock {
            id: block_id.clone(),
            block_type: native_type.to_string(),
            family: Some(family.to_string()),
            variant: Some(variant.to_string()),
            title,
            summary,
            content_html: source_raw_html.clone(),
            quote_show_author: Some(
                quote_author_html
                    .as_deref()
                    .map(has_meaningful_html)
                    .unwrap_or(false),
            ),
            quote_author_html,
            html_asset_root: None,
            html_entry_file: None,
            html_package_name: None,
            media_layout,
            image_size,
            content_width,
            content_align,
            media_gap,
            vertical_align,
            image_rounded: if native_type == "image" || native_type == "image-grid" {
                Some(false)
            } else if native_type == "tabs" {
                Some(true)
            } else {
                image_rounded
            },
            media_file_name,
            image_crop: None,
            image_accessibility: if matches!(
                native_type,
                "image"
                    | "image-text"
                    | "point-of-interest"
                    | "image-360"
                    | "quote"
                    | "header"
            ) {
                extract_image_accessibility(item)
            } else {
                None
            },
            image_annotation_state_ref: None,
            image_annotation_source_asset_ref: None,
            video_caption_color: None,
            video_caption_background_enabled: None,
            video_caption_outline: None,
            video_subtitle_original_ref: None,
            video_original_asset_ref: None,
            video_optimized_asset_ref: None,
            video_optimization_profile: None,
            video_allow_fullscreen: None,
            audio_autoplay_next: None,
            audio_allow_download: None,
            image360_initial_yaw: None,
            image360_initial_pitch: None,
            image360_zoom_enabled: None,
            image360_full_width: None,
            image360_allow_fullscreen: None,
            header_background_color,
            header_text_color: None,
            header_text_outline: None,
            header_text_outline_color: None,
            header_height: if family == "image" && variant == "text overlay" {
                Some("240px".to_string())
            } else {
                None
            },
            header_image_position_y: None,
            button_background_color: if native_type == "links-resources" {
                Some("#123a7a".to_string())
            } else {
                None
            },
            button_text_color: if native_type == "links-resources" {
                Some("#ffffff".to_string())
            } else {
                None
            },
            panel_background_color: if matches!(native_type, "rich-text" | "list") {
                None
            } else if native_type == "links-resources" {
                Some("#edf4ff".to_string())
            } else if native_type == "timeline" {
                Some("#ffffff".to_string())
            } else if native_type == "tabs" {
                Some("transparent".to_string())
            } else {
                panel_background_color
            },
            panel_border_color: if native_type == "links-resources" {
                Some("#123a7a".to_string())
            } else if native_type == "note" {
                Some("#123a7a".to_string())
            } else if native_type == "timeline" || native_type == "tabs" {
                Some("#123a7a".to_string())
            } else {
                None
            },
            section_background_blur: if supports_imported_section_background
                && has_section_background_image
            {
                Some(0.0)
            } else {
                None
            },
            section_background_position_y: if native_type == "situational-dialogue"
                && has_section_background_image
            {
                Some(50.0)
            } else {
                None
            },
            section_background_rounded: None,
            section_background_wide: supports_activity_background.then_some(true),
            section_background_height: if native_type == "rich-text"
                && (section_background_color.is_some() || has_section_background_image)
            {
                Some("minimum".to_string())
            } else if supports_imported_section_background && has_imported_section_background
            {
                Some("medium".to_string())
            } else {
                None
            },
            panel_border_width: if native_type == "links-resources" {
                Some("2px".to_string())
            } else if native_type == "quote" {
                Some("0px".to_string())
            } else if native_type == "note" {
                Some("2px".to_string())
            } else if native_type == "timeline" {
                Some("0px".to_string())
            } else if native_type == "tabs" {
                Some("1px".to_string())
            } else {
                None
            },
            panel_border_style: if matches!(native_type, "note" | "timeline" | "tabs" | "links-resources") {
                Some("solid".to_string())
            } else {
                None
            },
            panel_padding,
            panel_rounded: if native_type == "links-resources" {
                Some(true)
            } else if native_type == "timeline" {
                Some(false)
            } else if native_type == "tabs" {
                Some(true)
            } else {
                None
            },
            panel_shadow: if native_type == "links-resources" {
                Some(false)
            } else if native_type == "timeline" || native_type == "tabs" {
                Some(true)
            } else {
                None
            },
            note_icon: (native_type == "note").then(|| "info-circle".to_string()),
            note_show_icon: (native_type == "note").then_some(true),
            note_icon_color: None,
            note_icon_matches_border: (native_type == "note").then_some(true),
            flip_card_front_background_color: None,
            flip_card_back_background_color: None,
            flip_card_front_border_color: None,
            flip_card_back_border_color: None,
            slides_activity_background_color: if native_type == "slides" {
                Some("transparent".to_string())
            } else {
                None
            },
            slides_activity_border_color: None,
            slides_activity_border_width: None,
            slides_activity_border_style: None,
            slides_activity_rounded: None,
            slides_activity_shadow: None,
            // Rise scenarios commonly carry a generic GRAY/TINT section background.
            // Once rematched to the native PAIDEIA activity, that color must not
            // override the activity's own default visual treatment.
            section_background_color: if native_type == "situational-dialogue"
                || !supports_activity_background
            {
                None
            } else {
                section_background_color
            },
            section_background_image_ref: if native_type == "situational-dialogue"
                || !supports_imported_section_background
            {
                None
            } else {
                section_background_image_ref
            },
            section_background_opacity: if native_type == "situational-dialogue"
                || !supports_activity_background
            {
                None
            } else if supports_imported_section_background
                && has_section_background_image
            {
                Some(1.0)
            } else {
                section_background_opacity
            },
            section_background_overlay_dark: None,
            divider_color: None,
            divider_width: None,
            divider_style: if native_type == "divider" && variant == "spacing divider" {
                Some("none".to_string())
            } else {
                None
            },
            marker_scheme: if native_type == "section-marker" {
                Some("arabic".to_string())
            } else {
                None
            },
            marker_type: if native_type == "section-marker" {
                Some("outline".to_string())
            } else {
                None
            },
            marker_text_color: None,
            point_of_interest_markers,
            image360_hotspots: Vec::new(),
            activity_items,
            situational_dialogue_characters,
            attachment_files,
            quiz: quiz_data,
            find_elements: None,
            complete: complete_data,
            card_sort: card_sort_data,
            matching: matching_data,
            marker_popup_width: (native_type == "point-of-interest").then(|| "270px".to_string()),
            marker_popup_height: (native_type == "point-of-interest").then(|| "auto".to_string()),
            padding_offset: rise_padding_offset,
            tracking_key: format!("{}-{}", native_type, block_id),
            source_format: Some("rise-scorm".to_string()),
            source_block_type: Some(item_type.to_string()),
            source_raw_html,
            asset_refs: asset_refs.clone(),
            rich_inline_asset_refs: Vec::new(),
            subtitle_refs: vec![],
        },
        mapping_quality: quality.to_string(),
        issue,
        asset_refs,
        rematching: ImportRematchingEntry {
            location,
            source_label,
            source_family: family.to_string(),
            source_variant: variant.to_string(),
            source_type: item_type.to_string(),
            mapped_to: native_type.to_string(),
            status: status.to_string(),
            missing_properties,
            artifact_path,
        },
        html_artifact,
    }
}

#[cfg(test)]
fn map_rise_quiz_lesson_to_block(lesson: &Value, lesson_number: usize) -> MappedBlock {
    map_rise_quiz_lesson_to_block_with_id(
        lesson,
        lesson_number,
        imported_block_id(lesson_number))
}

fn map_rise_quiz_lesson_to_block_with_id(
    lesson: &Value,
    lesson_number: usize,
    block_id: String,
) -> MappedBlock {
    let location = format!("lesson_{:02}/quiz", lesson_number);
    let source_label = lesson
        .get("title")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("Quiz Rise")
        .to_string();
    let extracted = extract_rise_quiz_lesson(lesson);
    build_rise_quiz_mapped_block(
        block_id,
        location,
        source_label,
        "quiz".to_string(),
        "lesson".to_string(),
        "quiz".to_string(),
        extracted,
    )
}

fn build_rise_quiz_mapped_block(
    block_id: String,
    location: String,
    source_label: String,
    source_family: String,
    source_variant: String,
    source_type: String,
    extracted: RiseQuizExtraction,
) -> MappedBlock {
    let status = if extracted.quality == "exact" {
        "exact"
    } else {
        "partial"
    };
    let issue = extracted.issue_message.as_ref().map(|message| ImportIssue {
        severity: "info".to_string(),
        location: location.clone(),
        source_block_type: format!("{}/{}", source_family, source_variant),
        mapped_to: "quiz".to_string(),
        message: message.clone(),
    });

    MappedBlock {
        block: PaideiaBlock {
            id: block_id.clone(),
            block_type: "quiz".to_string(),
            family: Some(source_family.clone()),
            variant: Some(source_variant.clone()),
            title: "Quiz".to_string(),
            summary: String::new(),
            content_html: None,
            quote_author_html: None,
            quote_show_author: Some(false),
            html_asset_root: None,
            html_entry_file: None,
            html_package_name: None,
            media_layout: None,
            image_size: None,
            content_width: None,
            content_align: None,
            media_gap: None,
            vertical_align: None,
            image_rounded: None,
            media_file_name: None,
            image_crop: None,
            image_accessibility: None,
            image_annotation_state_ref: None,
            image_annotation_source_asset_ref: None,
            video_caption_color: None,
            video_caption_background_enabled: None,
            video_caption_outline: None,
            video_subtitle_original_ref: None,
            video_original_asset_ref: None,
            video_optimized_asset_ref: None,
            video_optimization_profile: None,
            video_allow_fullscreen: None,
            audio_autoplay_next: None,
            audio_allow_download: None,
            image360_initial_yaw: None,
            image360_initial_pitch: None,
            image360_zoom_enabled: None,
            image360_full_width: None,
            image360_allow_fullscreen: None,
            header_background_color: None,
            header_text_color: None,
            header_text_outline: None,
            header_text_outline_color: None,
            header_height: None,
            header_image_position_y: None,
            button_background_color: None,
            button_text_color: None,
            panel_background_color: None,
            panel_border_color: None,
            panel_border_width: None,
            panel_border_style: None,
            panel_padding: None,
            panel_rounded: None,
            panel_shadow: None,
            note_icon: None,
            note_show_icon: None,
            note_icon_color: None,
            note_icon_matches_border: None,
            flip_card_front_background_color: None,
            flip_card_back_background_color: None,
            flip_card_front_border_color: None,
            flip_card_back_border_color: None,
            slides_activity_background_color: None,
            slides_activity_border_color: None,
            slides_activity_border_width: None,
            slides_activity_border_style: None,
            slides_activity_rounded: None,
            slides_activity_shadow: None,
            section_background_color: None,
            section_background_image_ref: None,
            section_background_opacity: None,
            section_background_overlay_dark: None,
            section_background_blur: None,
            section_background_position_y: None,
            section_background_rounded: None,
            section_background_wide: None,
            section_background_height: None,
            divider_color: None,
            divider_width: None,
            divider_style: None,
            marker_scheme: None,
            marker_type: None,
            marker_text_color: None,
            point_of_interest_markers: Vec::new(),
            image360_hotspots: Vec::new(),
            activity_items: Vec::new(),
            situational_dialogue_characters: Vec::new(),
            attachment_files: Vec::new(),
            quiz: Some(extracted.quiz),
            find_elements: None,
            complete: None,
            card_sort: None,
            matching: None,
            marker_popup_width: Some("270px".to_string()),
            marker_popup_height: Some("auto".to_string()),
            padding_offset: None,
            tracking_key: format!("quiz-{}", block_id),
            source_format: Some("rise-scorm".to_string()),
            source_block_type: Some(source_type.clone()),
            source_raw_html: None,
            asset_refs: Vec::new(),
            rich_inline_asset_refs: Vec::new(),
            subtitle_refs: Vec::new(),
        },
        mapping_quality: extracted.quality.to_string(),
        issue,
        asset_refs: Vec::new(),
        rematching: ImportRematchingEntry {
            location,
            source_label,
            source_family,
            source_variant,
            source_type,
            mapped_to: "quiz".to_string(),
            status: status.to_string(),
            missing_properties: extracted.missing_properties,
            artifact_path: None,
        },
        html_artifact: None,
    }
}

fn extract_rise_knowledge_check_quiz(item: &Value) -> RiseQuizExtraction {
    let source_variant = item
        .get("variant")
        .and_then(Value::as_str)
        .unwrap_or("knowledgeCheck");
    let source_items = item
        .get("items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let question_entry = source_items.first().cloned().unwrap_or(Value::Null);
    let mut missing_properties = Vec::new();

    let (questions, answer_feedback_detected) = if source_variant == "draw from question bank" {
        let draw_count = question_entry
            .get("drawCount")
            .and_then(Value::as_u64)
            .unwrap_or(0);
        let draw_source_id = question_entry
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("rise-question-bank");
        let extracted = question_entry
            .get("questions")
            .and_then(Value::as_array)
            .map(|questions| {
                questions
                    .iter()
                    .map(|question| build_rise_quiz_question(question, Some(draw_source_id)))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let answer_feedback = extracted
            .iter()
            .any(|(_, has_answer_feedback)| *has_answer_feedback);
        if draw_count > 0 {
            missing_properties.push("Tirage aleatoire Rise".to_string());
        }
        (
            extracted
                .into_iter()
                .map(|(question, _)| question)
                .collect::<Vec<_>>(),
            answer_feedback,
        )
    } else {
        let (question, has_answer_feedback) = build_rise_quiz_question(&question_entry, None);
        (vec![question], has_answer_feedback)
    };

    if answer_feedback_detected {
        missing_properties.push("Feedback par choix Rise (attente eval)".to_string());
    }

    let quality = if missing_properties.is_empty() {
        "exact"
    } else {
        "approximate"
    };
    let issue_message = if source_variant == "draw from question bank" {
        Some("Banque de questions Rise convertie en quiz PAIDEIA sans conserver le tirage aléatoire.".to_string())
    } else if answer_feedback_detected {
        Some(
            "Le feedback par choix Rise n'est pas rematché nativement et doit être vérifié."
                .to_string(),
        )
    } else {
        None
    };

    RiseQuizExtraction {
        quiz: QuizActivityData {
            title_html: "<p></p>".to_string(),
            title_mode: "auto".to_string(),
            intro_html: "<p></p>".to_string(),
            start_lead_html: "<p>Vous allez maintenant tester vos connaissances.</p>".to_string(),
            questions,
            settings: default_rise_quiz_settings(None),
        },
        quality,
        issue_message,
        missing_properties,
    }
}

fn extract_rise_fill_in_complete(items: &[Value], id_prefix: &str) -> RiseCompleteExtraction {
    let mut content_parts = Vec::with_capacity(items.len());
    let mut blanks = Vec::new();
    let mut item_missing_properties = Vec::with_capacity(items.len());

    for (item_index, item) in items.iter().enumerate() {
        let question = item
            .get("items")
            .and_then(Value::as_array)
            .and_then(|entries| entries.first())
            .unwrap_or(&Value::Null);
        let question_html = extract_html_field(question, &["title", "text", "prompt"])
            .filter(|html| has_meaningful_html(html))
            .unwrap_or_else(|| "<p></p>".to_string());
        let correct_answers = question
            .get("answers")
            .and_then(Value::as_array)
            .map(|answers| {
                answers
                    .iter()
                    .filter(|answer| {
                        answer
                            .get("correct")
                            .and_then(Value::as_bool)
                            .unwrap_or(false)
                    })
                    .filter_map(|answer| extract_html_field(answer, &["title", "text", "label"]))
                    .map(|answer| strip_html(&answer).trim().to_string())
                    .filter(|answer| !answer.is_empty())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let mut missing_properties = Vec::new();

        if let Some(answer) = correct_answers.first() {
            let blank_id = format!("complete_blank_{}_{:02}", id_prefix, item_index + 1);
            if let Some(marked_html) = mark_unique_rise_fill_in_answer(
                &question_html,
                answer,
                &blank_id) {
                let mut variants = Vec::new();
                for variant in correct_answers.iter().skip(1) {
                    if variant != answer && !variants.contains(variant) {
                        variants.push(variant.clone());
                    }
                }
                content_parts.push(marked_html);
                blanks.push(CompleteBlank {
                    id: blank_id,
                    answer: answer.clone(),
                    variants,
                    case_sensitive: false,
                });
            } else {
                content_parts.push(question_html);
                missing_properties.push(
                    "Emplacement non ambigu de la réponse dans le texte".to_string());
            }
        } else {
            content_parts.push(question_html);
            missing_properties.push("Réponse correcte Rise".to_string());
        }

        item_missing_properties.push(missing_properties);
    }

    let unresolved_count = item_missing_properties
        .iter()
        .filter(|missing| !missing.is_empty())
        .count();
    let mut missing_properties = Vec::new();
    for property in item_missing_properties.iter().flatten() {
        if !missing_properties.contains(property) {
            missing_properties.push(property.clone());
        }
    }
    let quality = if unresolved_count == 0 {
        "exact"
    } else {
        "approximate"
    };
    let issue_message = (unresolved_count > 0).then(|| {
        format!(
            "{} question(s) Fill in the blanks ont été reprises comme texte sans marqueur, faute d’emplacement de réponse non ambigu.",
            unresolved_count
        )
    });

    RiseCompleteExtraction {
        complete: CompleteActivityData {
            reveal_answers_on_final_review: false,
            orientation: None,
            cover: CompleteCover {
                enabled: false,
                title_html: "<h1>Texte à compléter</h1>".to_string(),
                description_html: "<p></p>".to_string(),
            },
            ending: CompleteEnding {
                success_html: "<p>Vous avez réussi cet exercice avec succès !</p><p>Vous pouvez continuer la leçon.</p>".to_string(),
                failure_html: "<p>Vous n’avez pas atteint le score requis.</p><p>Si une nouvelle tentative est disponible, vous pouvez recommencer l’exercice pour améliorer votre résultat.</p>".to_string(),
            },
            exercises: vec![CompleteExercise {
                id: format!("complete_exercise_{}_01", id_prefix),
                content_html: if content_parts.is_empty() {
                    "<p></p>".to_string()
                } else {
                    content_parts.join("<p><br></p>")
                },
                blanks,
            }],
            max_attempts: 3,
            success_threshold: 80,
            gate_chapter_until_passed: false,
        },
        quality,
        issue_message,
        missing_properties,
        item_missing_properties,
    }
}

fn extract_rise_matching_activity(
    item: &Value,
    id_prefix: &str,
    available_assets: &[String],
) -> RiseMatchingExtraction {
    let questions = item
        .get("items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let question = questions.first().unwrap_or(&Value::Null);
    let title = extract_html_field(question, &["title", "text", "prompt"])
        .map(|value| strip_html(&value))
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Relier".to_string());
    let answers = question
        .get("answers")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut missing_properties = Vec::new();

    if questions.len() != 1 {
        missing_properties.push("Une question Matching Rise unique par bloc".to_string());
    }
    if !question
        .get("type")
        .and_then(Value::as_str)
        .is_some_and(|value| normalize_rise_source_key(value) == "matching")
    {
        missing_properties.push("Type de question MATCHING".to_string());
    }
    if !(2..=10).contains(&answers.len()) {
        missing_properties.push("Entre 2 et 10 couples".to_string());
    }

    let mut pairs = Vec::with_capacity(answers.len());
    for (index, answer) in answers.iter().enumerate() {
        let left = extract_html_field(answer, &["title", "text", "label"])
            .filter(|value| has_meaningful_html(value));
        let right = extract_html_field(answer, &["matchTitle", "matchText", "matchLabel"])
            .filter(|value| has_meaningful_html(value));
        let has_media = answer.get("media").is_some()
            || answer.get("image").is_some()
            || !collect_asset_refs(answer, available_assets).is_empty();

        if left.is_none() || right.is_none() {
            missing_properties.push(format!("Couple {} complet", index + 1));
        }
        if has_media {
            missing_properties.push(format!("Couple {} textuel sans média", index + 1));
        }

        if let (Some(left), Some(right)) = (left, right) {
            let pair_number = index + 1;
            pairs.push(MatchingPair {
                id: format!("matching_pair_{}_{:02}", id_prefix, pair_number),
                left_id: format!("matching_left_{}_{:02}", id_prefix, pair_number),
                right_id: format!("matching_right_{}_{:02}", id_prefix, pair_number),
                left_html: normalize_rise_matching_label_html(&left),
                right_html: normalize_rise_matching_label_html(&right),
                left_background_color: None,
                right_background_color: None,
            });
        }
    }

    missing_properties.sort();
    missing_properties.dedup();
    if !missing_properties.is_empty() {
        return RiseMatchingExtraction {
            matching: None,
            title,
            quality: "unsupported",
            issue_message: Some(format!(
                "Le bloc Matching Rise n’a pas été rematché : {}.",
                missing_properties.join(", ")
            )),
            missing_properties,
        };
    }

    RiseMatchingExtraction {
        matching: Some(MatchingActivityData {
            pairs,
            max_attempts: 3,
            success_threshold: 100,
            show_attempt_feedback: true,
            success_feedback_html:
                "<p>Vous avez correctement relié tous les éléments.</p>".to_string(),
            failure_feedback_html: "<p>Certaines associations sont incorrectes. Recommencez si une nouvelle tentative est disponible.</p>".to_string(),
            label_appearance: MatchingAppearance {
                background_color: "#FFFFFF".to_string(),
                border_color: "#244585".to_string(),
                border_width: "1px".to_string(),
                border_style: "solid".to_string(),
                rounded: true,
            },
        }),
        title,
        quality: "exact",
        issue_message: None,
        missing_properties,
    }
}

fn normalize_rise_matching_label_html(value: &str) -> String {
    let normalized = normalize_rise_html_units(value.trim());
    let rich_markup = Regex::new(
        r"(?i)<(?:p|div|span|strong|em|b|i|u|s|br|ul|ol|li|h[1-6])(?:\s|>|/)")
    .expect("valid Rise matching Rich Text regex");
    if rich_markup.is_match(&normalized) {
        normalized
    } else {
        format!("<p>{}</p>", escape_html(&strip_html(&normalized)))
    }
}

fn extract_rise_card_sort_activity(
    item: &Value,
    id_prefix: &str,
    available_assets: &[String],
) -> RiseCardSortExtraction {
    let piles = item
        .get("piles")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let cards = item
        .get("items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut missing_properties = Vec::new();

    if !(2..=4).contains(&piles.len()) {
        missing_properties.push("Entre 2 et 4 catégories".to_string());
    }
    if cards.is_empty() {
        missing_properties.push("Au moins une carte".to_string());
    }

    let mut categories = Vec::with_capacity(piles.len());
    let mut category_ids_by_source = HashMap::new();
    for (index, pile) in piles.iter().enumerate() {
        let source_id = rise_scalar_identifier(pile.get("id"));
        let label = extract_html_field(pile, &["title", "label", "text"])
            .map(|value| strip_html(&value))
            .filter(|value| !value.trim().is_empty());

        if source_id.is_none() {
            missing_properties.push(format!("Identifiant de la catégorie {}", index + 1));
        }
        if label.is_none() {
            missing_properties.push(format!("Libellé de la catégorie {}", index + 1));
        }

        if let (Some(source_id), Some(label)) = (source_id, label) {
            let category_id = format!("card_sort_category_{}_{:02}", id_prefix, index + 1);
            if category_ids_by_source
                .insert(source_id, category_id.clone())
                .is_some()
            {
                missing_properties.push("Identifiants de catégories Rise uniques".to_string());
            }
            categories.push(CardSortCategory {
                id: category_id,
                label: label.trim().to_string(),
                label_html: format!("<p>{}</p>", escape_html(label.trim())),
                border_color: "#244585".to_string(),
            });
        }
    }

    let mut activity_items = Vec::with_capacity(cards.len());
    for (index, card) in cards.iter().enumerate() {
        let content = extract_html_field(card, &["title", "text", "label", "content"])
            .filter(|value| has_meaningful_html(value));
        let source_category_id = rise_scalar_identifier(card.get("pileId"));
        let correct_category_id = source_category_id
            .as_ref()
            .and_then(|source_id| category_ids_by_source.get(source_id))
            .cloned();
        let has_media = card.get("media").is_some()
            || card.get("image").is_some()
            || !collect_asset_refs(card, available_assets).is_empty();

        if content.is_none() {
            missing_properties.push(format!("Contenu de la carte {}", index + 1));
        }
        if source_category_id.is_none() {
            missing_properties.push(format!("Catégorie de la carte {}", index + 1));
        } else if correct_category_id.is_none() {
            missing_properties.push(format!(
                "Catégorie existante pour la carte {}",
                index + 1
            ));
        }
        if has_media {
            missing_properties.push(format!("Carte {} textuelle sans média", index + 1));
        }

        if let (Some(content), Some(correct_category_id)) = (content, correct_category_id) {
            activity_items.push(ActivityItem {
                id: format!("card_sort_item_{}_{:02}", id_prefix, index + 1),
                title: strip_html(&content).trim().to_string(),
                kind: None,
                node_type: None,
                character_id: None,
                character_name: None,
                character_role: None,
                situational_dialogue_pose_refs: HashMap::new(),
                emotion: None,
                next_node_id: None,
                responses: Vec::new(),
                date_label: None,
                content_title: None,
                time_color: None,
                title_color: None,
                accent_color: None,
                content_html: normalize_rise_card_sort_html(&content),
                asset_refs: Vec::new(),
                media_file_name: None,
                media_layout: None,
                image_size: None,
                image_rounded: Some(true),
                image_crop: None,
                image_accessibility: None,
                image_annotation_state_ref: None,
                image_annotation_source_asset_ref: None,
                front_type: None,
                front_text: None,
                front_image_asset_ref: None,
                front_image_file_name: None,
                front_image_crop: None,
                front_image_accessibility: None,
                back_type: None,
                back_title: None,
                back_image_asset_ref: None,
                back_image_file_name: None,
                back_image_crop: None,
                back_image_accessibility: None,
                resource_url: None,
                resource_raw_destination: None,
                resource_open_mode: None,
                resource_valid: None,
                correct_category_id: Some(correct_category_id),
                card_background_color: None,
                card_feedback_html: None,
                card_feedback_correct_html: None,
                card_feedback_incorrect_html: None,
                transcript_html: None,
                transcript_language: None,
                transcript_source: None,
                transcript_status: None,
                transcript_allow_download: None,
            });
        }
    }

    missing_properties.sort();
    missing_properties.dedup();
    if !missing_properties.is_empty() {
        return RiseCardSortExtraction {
            card_sort: None,
            activity_items: Vec::new(),
            quality: "unsupported",
            issue_message: Some(format!(
                "Le bloc de tri Rise n’a pas été rematché : {}.",
                missing_properties.join(", ")
            )),
            missing_properties,
        };
    }

    RiseCardSortExtraction {
        card_sort: Some(CardSortActivityData {
            categories,
            // Legacy fields required by the current persisted model. Rise sorting
            // does not provide them and the target formative contract ignores them.
            max_attempts: 3,
            success_threshold: 80,
            gate_chapter_until_passed: false,
            interaction_mode: Some("direct".to_string()),
            success_feedback_html: "<p>Vous avez correctement classé toutes les cartes.</p>"
                .to_string(),
            failure_feedback_html:
                "<p>Votre tri comporte encore des erreurs.</p>".to_string(),
            card_appearance: CardSortAppearance {
                background_color: "#FFFFFF".to_string(),
                border_color: "#244585".to_string(),
                border_width: "1px".to_string(),
                border_style: "solid".to_string(),
                rounded: true,
            },
        }),
        activity_items,
        quality: "exact",
        issue_message: None,
        missing_properties,
    }
}

fn rise_scalar_identifier(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(value)) if !value.trim().is_empty() => Some(value.trim().to_string()),
        Some(Value::Number(value)) => Some(value.to_string()),
        _ => None,
    }
}

fn normalize_rise_card_sort_html(value: &str) -> String {
    let normalized = normalize_rise_html_units(value.trim());
    let rich_markup = Regex::new(
        r"(?i)<(?:p|div|span|strong|em|b|i|u|s|br|ul|ol|li|h[1-6])(?:\s|>|/)")
    .expect("valid Rise Card Sort Rich Text regex");
    if rich_markup.is_match(&normalized) {
        normalized
    } else {
        format!("<p>{}</p>", escape_html(&strip_html(&normalized)))
    }
}

fn mark_unique_rise_fill_in_answer(
    html: &str,
    answer: &str,
    blank_id: &str) -> Option<String> {
    if answer.is_empty() {
        return None;
    }

    let mut cursor = 0usize;
    let mut matches = Vec::new();
    while cursor < html.len() {
        if html[cursor..].starts_with('<') {
            let tag_end = html[cursor..].find('>')?;
            cursor += tag_end + 1;
            continue;
        }
        let text_end = html[cursor..]
            .find('<')
            .map(|offset| cursor + offset)
            .unwrap_or(html.len());
        for (offset, _) in html[cursor..text_end].match_indices(answer) {
            let start = cursor + offset;
            matches.push((start, start + answer.len()));
        }
        cursor = text_end;
    }

    if matches.len() != 1 {
        return None;
    }
    let (start, end) = matches[0];
    Some(format!(
        "{}<span data-paideia-complete-id=\"{}\" contenteditable=\"false\">{}</span>&#8203;{}",
        &html[..start],
        escape_html_attribute(blank_id),
        &html[start..end],
        &html[end..]
    ))
}

fn extract_rise_quiz_lesson(lesson: &Value) -> RiseQuizExtraction {
    let lesson_title = lesson
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("Quiz");
    let lesson_description = extract_html_field(lesson, &["description"]).unwrap_or_default();
    let items = lesson
        .get("items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut questions = Vec::new();
    let mut missing_properties = Vec::new();
    let mut answer_feedback_detected = false;
    let mut unsupported_types = Vec::new();

    for item in items {
        let item_type = item
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("unknown");
        match item_type {
            "MULTIPLE_CHOICE" | "MULTIPLE_RESPONSE" => {
                let (question, has_answer_feedback) = build_rise_quiz_question(&item, None);
                answer_feedback_detected |= has_answer_feedback;
                questions.push(question);
            }
            "DRAW_FROM_QUESTION_BANK" => {
                let draw_count = item.get("drawCount").and_then(Value::as_u64).unwrap_or(0);
                let draw_source_id = item
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or("rise-question-bank");
                let bank_questions = item
                    .get("questions")
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();
                for question in bank_questions {
                    let (mapped_question, has_answer_feedback) =
                        build_rise_quiz_question(&question, Some(draw_source_id));
                    answer_feedback_detected |= has_answer_feedback;
                    questions.push(mapped_question);
                }
                if draw_count > 0 {
                    missing_properties.push("Tirage aleatoire Rise".to_string());
                }
            }
            other => unsupported_types.push(other.to_string()),
        }
    }

    if answer_feedback_detected {
        missing_properties.push("Feedback par choix Rise (attente eval)".to_string());
    }
    if !unsupported_types.is_empty() {
        missing_properties.push("Types de questions Rise non rematches".to_string());
    }

    let quality = if missing_properties.is_empty() {
        "exact"
    } else {
        "approximate"
    };
    let issue_message = if !unsupported_types.is_empty() {
        Some(format!(
            "Certaines questions Rise n'ont pas ete rematchees nativement : {}.",
            unsupported_types.join(", ")
        ))
    } else if answer_feedback_detected {
        Some(
            "Le feedback par choix Rise n'est pas rematche nativement et doit etre verifie."
                .to_string(),
        )
    } else if missing_properties
        .iter()
        .any(|value| value == "Tirage aleatoire Rise")
    {
        Some("Le quiz Rise a ete converti sans conserver le tirage aleatoire des questions de banque.".to_string())
    } else {
        None
    };

    RiseQuizExtraction {
        quiz: QuizActivityData {
            title_html: format!("<p>{}</p>", escape_html(lesson_title)),
            title_mode: "custom".to_string(),
            intro_html: lesson_description.clone(),
            start_lead_html: if has_meaningful_html(&lesson_description) {
                lesson_description
            } else {
                "<p>Vous allez maintenant tester vos connaissances.</p>".to_string()
            },
            questions,
            settings: default_rise_quiz_settings(lesson.get("settings")),
        },
        quality,
        issue_message,
        missing_properties,
    }
}

fn build_rise_quiz_question(
    question: &Value,
    source_bank_id: Option<&str>,
) -> (QuizQuestion, bool) {
    let question_id = question
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("rise-question")
        .to_string();
    let question_type = question
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("MULTIPLE_CHOICE");
    let mode = if question_type == "MULTIPLE_RESPONSE" {
        "multiple".to_string()
    } else {
        "single".to_string()
    };
    let question_html = extract_html_field(question, &["title", "heading", "label", "question"])
        .unwrap_or_else(|| "<p></p>".to_string());
    let correct_id = question
        .get("correct")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let correct_ids = question
        .get("corrects")
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect::<HashSet<_>>()
        })
        .unwrap_or_default();
    let mut correct_choice_feedbacks = Vec::new();
    let mut incorrect_choice_feedbacks = Vec::new();
    let has_explicit_correct_id = !correct_id.is_empty();
    let has_explicit_correct_ids = !correct_ids.is_empty();
    let is_multiple_response = question_type == "MULTIPLE_RESPONSE";
    let answers = question
        .get("answers")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|answer| {
            let answer_id = answer
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or("rise-answer")
                .to_string();
            let answer_feedback = extract_html_field(&answer, &["feedback"]).unwrap_or_default();
            let answer_level_correct = answer
                .get("correct")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let is_correct = if is_multiple_response {
                if has_explicit_correct_ids {
                    correct_ids.contains(&answer_id)
                } else if answer_level_correct {
                    true
                } else if has_explicit_correct_id {
                    answer_id == correct_id
                } else {
                    false
                }
            } else if has_explicit_correct_id {
                answer_id == correct_id
            } else if has_explicit_correct_ids {
                correct_ids.contains(&answer_id)
            } else {
                answer_level_correct
            };
            if has_meaningful_html(&answer_feedback) {
                if is_correct {
                    correct_choice_feedbacks.push(answer_feedback.clone());
                } else {
                    incorrect_choice_feedbacks.push(answer_feedback.clone());
                }
            }
            QuizAnswer {
                id: answer_id,
                text_html: extract_html_field(&answer, &["title", "label", "text", "answer"])
                    .unwrap_or_else(|| "<p></p>".to_string()),
                correct: is_correct,
                feedback_html: if has_meaningful_html(&answer_feedback) { Some(answer_feedback) } else { None },
                credit_percent: None,
            }
        })
        .collect::<Vec<_>>();
    let question_feedback_type = question
        .get("feedbackType")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let question_level_general_feedback = extract_html_field(question, &["feedback"]);
    let question_level_correct_feedback = extract_html_field(question, &["feedbackCorrect"]);
    let question_level_incorrect_feedback = extract_html_field(question, &["feedbackIncorrect"]);
    let can_absorb_choice_feedback =
        mode == "single" && question_feedback_type.eq_ignore_ascii_case("CHOICE");
    let merged_correct_choice_feedback = merge_rise_choice_feedbacks(&correct_choice_feedbacks);
    let merged_incorrect_choice_feedback = merge_rise_choice_feedbacks(&incorrect_choice_feedbacks);
    let feedback_correct_html =
        if has_meaningful_optional_html(question_level_correct_feedback.as_deref()) {
            question_level_correct_feedback
        } else if can_absorb_choice_feedback {
            merged_correct_choice_feedback
        } else {
            None
        };
    let feedback_incorrect_html =
        if has_meaningful_optional_html(question_level_incorrect_feedback.as_deref()) {
            question_level_incorrect_feedback
        } else if can_absorb_choice_feedback {
            merged_incorrect_choice_feedback
        } else {
            None
        };
    let has_unmapped_choice_feedback = (!can_absorb_choice_feedback
        && (!correct_choice_feedbacks.is_empty() || !incorrect_choice_feedbacks.is_empty()))
        || incorrect_choice_feedbacks.iter().collect::<HashSet<_>>().len() > 1
        || correct_choice_feedbacks.iter().collect::<HashSet<_>>().len() > 1;

    (
        QuizQuestion {
            credit_mode: None,
            id: question_id.clone(),
            source_question_id: Some(question_id),
            source_bank_id: source_bank_id.map(str::to_string),
            mode,
            question_html,
            answers,
            general_feedback_html: question_level_general_feedback,
            feedback_correct_html,
            feedback_incorrect_html,
            points: 1.0,
        },
        has_unmapped_choice_feedback,
    )
}

fn has_meaningful_optional_html(value: Option<&str>) -> bool {
    value.map(has_meaningful_html).unwrap_or(false)
}

fn merge_rise_choice_feedbacks(feedbacks: &[String]) -> Option<String> {
    let mut unique_feedbacks = Vec::new();
    for feedback in feedbacks {
        if !has_meaningful_html(feedback) {
            continue;
        }
        if !unique_feedbacks.iter().any(|existing| existing == feedback) {
            unique_feedbacks.push(feedback.clone());
        }
    }

    match unique_feedbacks.len() {
        0 => None,
        1 => unique_feedbacks.into_iter().next(),
        _ => Some(unique_feedbacks.join("<hr />")),
    }
}

fn default_rise_quiz_settings(settings: Option<&Value>) -> QuizSettings {
    let passing_score = settings
        .and_then(|value| value.get("passingScore"))
        .and_then(Value::as_f64)
        .unwrap_or(80.0);
    let retry_count = settings
        .and_then(|value| value.get("retryCount"))
        .and_then(Value::as_i64)
        .unwrap_or(0);
    let reveal_answers = settings
        .and_then(|value| value.get("revealAnswers"))
        .and_then(Value::as_str)
        .unwrap_or("");

    QuizSettings {
        shuffle_answers: settings
            .and_then(|value| value.get("shuffleAnswerChoices"))
            .and_then(Value::as_bool)
            .unwrap_or(false),
        shuffle_questions: settings
            .and_then(|value| value.get("randomizeQuestionOrder"))
            .and_then(Value::as_bool)
            .unwrap_or(false),
        limit_questions: false,
        question_limit: 1,
        show_feedback: true,
        show_correctness: true,
        show_correct_answer: reveal_answers.eq_ignore_ascii_case("all"),
        allow_retry: retry_count != 0,
        max_attempts: if retry_count < 0 {
            0
        } else {
            (retry_count as u32).saturating_add(1).max(1)
        },
        passing_score,
        review_mode: "disabled".to_string(),
        review_after_attempts: 1,
        send_score_to_lms: false,
        gate_chapter_until_passed: true,
    }
}

fn is_flashcard_family(family: &str, variant: &str, item_type: &str) -> bool {
    [family, variant, item_type].iter().any(|value| {
        let lowered = value.to_ascii_lowercase();
        lowered.contains("flashcard")
            || lowered.contains("flipcard")
            || lowered.contains("flip-card")
    })
}

fn extract_flashcard_activity_items(
    items: &[Value],
    available_assets: &[String],
) -> Vec<ActivityItem> {
    items
        .iter()
        .enumerate()
        .map(|(index, item)| {
            let front = item.get("front").unwrap_or(item);
            let back = item.get("back").unwrap_or(item);
            let extracted_front_html =
                extract_html_field(front, &["description", "title", "heading", "text"])
                    .or_else(|| extract_html_field(item, &["frontDescription", "frontText", "title"]),
                );
            let front_html = extracted_front_html
                .clone()
                .unwrap_or_else(|| format!("Carte {}", index + 1));
            let back_html = extract_html_field(back, &["description", "content", "body", "text"])
                .or_else(|| {
                    extract_html_field(item, &["backDescription", "backText", "description"])
                })
                .unwrap_or_else(|| "<p></p>".to_string());
            let back_title = extract_html_field(back, &["title", "heading"])
                .or_else(|| extract_html_field(item, &["backTitle"]))
                .map(|value| strip_html(&value))
                .filter(|value| !value.trim().is_empty());
            let front_declares_image = front
                .get("type")
                .and_then(Value::as_str)
                .map(|value| value.to_ascii_lowercase().contains("image"))
                .unwrap_or(false);
            let front_has_text = extracted_front_html
                .as_deref()
                .map(strip_html)
                .is_some_and(|value| !value.trim().is_empty());
            let (candidate_front_asset_refs, candidate_front_image_crop) =
                extract_flashcard_image(front, item, available_assets);
            let back_declares_image = back
                .get("type")
                .and_then(Value::as_str)
                .map(|value| value.to_ascii_lowercase().contains("image"))
                .unwrap_or(false);
            let back_has_text = !strip_html(&back_html).trim().is_empty();
            let (candidate_back_asset_refs, candidate_back_image_crop) =
                extract_flashcard_image(back, item, available_assets);
            // A face explicitly authored as text remains text, even when the
            // source payload carries a shared/template image beside it. An
            // explicitly declared image always wins; an image without text is
            // retained for legacy card payloads that omit the type field.
            let front_type = if front_declares_image
                || (!front_has_text && !candidate_front_asset_refs.is_empty())
            {
                "image"
            } else {
                "text"
            };
            let back_type = if back_declares_image
                || (!back_has_text && !candidate_back_asset_refs.is_empty())
            {
                "image"
            } else {
                "text"
            };
            let front_asset_refs = if front_type == "image" {
                candidate_front_asset_refs
            } else {
                Vec::new()
            };
            let back_asset_refs = if back_type == "image" {
                candidate_back_asset_refs
            } else {
                Vec::new()
            };
            let front_image_asset_ref = front_asset_refs.first().cloned();
            let back_image_asset_ref = back_asset_refs.first().cloned();
            let asset_refs = front_asset_refs
                .iter()
                .chain(back_asset_refs.iter())
                .cloned()
                .collect::<Vec<_>>();
            let title = strip_html(&front_html);
            ActivityItem {
                id: item
                    .get("id")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .unwrap_or_else(|| format!("card_{:02}", index + 1)),
                title: if title.trim().is_empty() {
                    format!("Carte {}", index + 1)
                } else {
                    title
                },
                date_label: None,
                content_title: None,
                time_color: None,
                title_color: None,
                accent_color: None,
                correct_category_id: None,
                card_background_color: None,
                card_feedback_html: None,
                card_feedback_correct_html: None,
                card_feedback_incorrect_html: None,
                transcript_html: None,
                transcript_language: None,
                transcript_source: None,
                transcript_status: None,
                transcript_allow_download: None,
                content_html: normalize_rise_html_units(&back_html),
                asset_refs,
                media_file_name: None,
                media_layout: Some("image-left".to_string()),
                image_size: Some("medium".to_string()),
                image_rounded: Some(false),
                image_crop: None,
                image_accessibility: None,
                image_annotation_state_ref: None,
                image_annotation_source_asset_ref: None,
                front_type: Some(front_type.to_string()),
                front_text: Some(normalize_rise_html_units(&front_html)),
                front_image_file_name: front_image_asset_ref
                    .as_deref()
                    .and_then(|value| value.rsplit('/').next())
                    .map(str::to_string),
                front_image_asset_ref,
                front_image_crop: (front_type == "image")
                    .then_some(candidate_front_image_crop)
                    .flatten(),
                front_image_accessibility: (front_type == "image")
                    .then(|| {
                        extract_image_accessibility(front)
                            .or_else(|| extract_image_accessibility(item))
                    })
                    .flatten(),
                back_type: Some(back_type.to_string()),
                back_title,
                back_image_file_name: back_image_asset_ref
                    .as_deref()
                    .and_then(|value| value.rsplit('/').next())
                    .map(str::to_string),
                back_image_asset_ref,
                back_image_crop: (back_type == "image")
                    .then_some(candidate_back_image_crop)
                    .flatten(),
                back_image_accessibility: (back_type == "image")
                    .then(|| {
                        extract_image_accessibility(back)
                            .or_else(|| extract_image_accessibility(item))
                    })
                    .flatten(),
                resource_url: None,
                resource_raw_destination: None,
                resource_open_mode: None,
                resource_valid: None,
                kind: None,
                node_type: None,
                character_id: None,
                character_name: None,
                character_role: None,
                situational_dialogue_pose_refs: HashMap::new(),
                emotion: None,
                next_node_id: None,
                responses: Vec::new(),
            }
        })
        .collect()
}

fn extract_timeline_activity_items(items: &[Value]) -> Vec<ActivityItem> {
    items
        .iter()
        .enumerate()
        .map(|(index, item)| {
            let title = extract_html_field(item, &["title", "heading"])
                .map(|value| strip_html(&value))
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| format!("Evenement {}", index + 1));
            let date_label = extract_html_field(item, &["date", "dateLabel", "label"])
                .map(|value| strip_html(&value))
                .filter(|value| !value.trim().is_empty());
            let content_html =
                extract_html_field(item, &["description", "content", "body", "text"])
                    .unwrap_or_else(|| "<p></p>".to_string());

            ActivityItem {
                id: item
                    .get("id")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .unwrap_or_else(|| format!("timeline_item_{:02}", index + 1)),
                title,
                date_label,
                content_title: None,
                time_color: None,
                title_color: None,
                accent_color: None,
                correct_category_id: None,
                card_background_color: None,
                card_feedback_html: None,
                card_feedback_correct_html: None,
                card_feedback_incorrect_html: None,
                transcript_html: None,
                transcript_language: None,
                transcript_source: None,
                transcript_status: None,
                transcript_allow_download: None,
                content_html: normalize_rise_html_units(&content_html),
                asset_refs: Vec::new(),
                media_file_name: None,
                media_layout: None,
                image_size: None,
                image_rounded: None,
                image_crop: None,
                image_accessibility: None,
                image_annotation_state_ref: None,
                image_annotation_source_asset_ref: None,
            front_type: None,
            front_text: None,
            front_image_asset_ref: None,
            front_image_file_name: None,
            front_image_crop: None,
            front_image_accessibility: None,
            back_type: None,
            back_title: None,
            back_image_asset_ref: None,
            back_image_file_name: None,
            back_image_crop: None,
            back_image_accessibility: None,
                resource_url: None,
                resource_raw_destination: None,
                resource_open_mode: None,
                resource_valid: None,
                kind: None,
                node_type: None,
                character_id: None,
                character_name: None,
                character_role: None,
                situational_dialogue_pose_refs: HashMap::new(),
                emotion: None,
                next_node_id: None,
                responses: Vec::new(),
            }
        })
        .collect()
}

fn extract_tabs_activity_items(
    parent: &Value,
    family: &str,
    items: &[Value],
    available_assets: &[String],
) -> Vec<ActivityItem> {
    let _ = (parent, family);
    let mut extracted = items
        .iter()
        .enumerate()
        .map(|(index, item)| {
            let title_html = extract_html_field(item, &["title", "heading", "label"])
                .filter(|value| has_meaningful_html(value))
                .unwrap_or_default();
            let content_html =
                extract_html_field(item, &["description", "content", "body", "text", "html"])
                    .unwrap_or_default();
            let image = explicit_rise_item_image(item);
            let asset_refs = image
                .map(|value| collect_preferred_image_asset_refs(value, available_assets))
                .unwrap_or_default();
            let image_crop = extract_image_crop(item);

            ActivityItem {
                id: item
                    .get("id")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .unwrap_or_else(|| format!("tabs_item_{:02}", index + 1)),
                title: normalize_rise_html_units(&title_html),
                date_label: None,
                content_title: None,
                time_color: None,
                title_color: None,
                accent_color: None,
                correct_category_id: None,
                card_background_color: None,
                card_feedback_html: None,
                card_feedback_correct_html: None,
                card_feedback_incorrect_html: None,
                transcript_html: None,
                transcript_language: None,
                transcript_source: None,
                transcript_status: None,
                transcript_allow_download: None,
                content_html: normalize_rise_html_units(&content_html),
                asset_refs,
                media_file_name: None,
                media_layout: Some("image-below".to_string()),
                image_size: Some("medium".to_string()),
                image_rounded: Some(true),
                image_crop,
                image_accessibility: extract_image_accessibility(item),
                image_annotation_state_ref: None,
                image_annotation_source_asset_ref: None,
                                        front_type: None,
                                        front_text: None,
                                        front_image_asset_ref: None,
                                        front_image_file_name: None,
                                        front_image_crop: None,
                                        front_image_accessibility: None,
                                        back_type: None,
                                        back_title: None,
                                        back_image_asset_ref: None,
                                        back_image_file_name: None,
                                        back_image_crop: None,
                                        back_image_accessibility: None,
                resource_url: None,
                resource_raw_destination: None,
                resource_open_mode: None,
                resource_valid: None,
                kind: None,
                node_type: None,
                character_id: None,
                character_name: None,
                character_role: None,
                situational_dialogue_pose_refs: HashMap::new(),
                emotion: None,
                next_node_id: None,
                responses: Vec::new(),
            }
        })
        .collect::<Vec<_>>();

    while extracted.len() < 2 {
        let order = extracted.len() + 1;
        extracted.push(ActivityItem {
            id: format!("tabs_item_{:02}", order),
            title: String::new(),
            date_label: None,
            content_title: None,
            time_color: None,
            title_color: None,
            accent_color: None,
            correct_category_id: None,
            card_background_color: None,
            card_feedback_html: None,
            card_feedback_correct_html: None,
            card_feedback_incorrect_html: None,
            transcript_html: None,
            transcript_language: None,
            transcript_source: None,
            transcript_status: None,
            transcript_allow_download: None,
            content_html: String::new(),
            asset_refs: Vec::new(),
            media_file_name: None,
            media_layout: Some("image-below".to_string()),
            image_size: Some("medium".to_string()),
            image_rounded: Some(true),
            image_crop: None,
            image_accessibility: None,
            image_annotation_state_ref: None,
            image_annotation_source_asset_ref: None,
                front_type: None,
                front_text: None,
                front_image_asset_ref: None,
                front_image_file_name: None,
                front_image_crop: None,
                front_image_accessibility: None,
                back_type: None,
                back_title: None,
                back_image_asset_ref: None,
                back_image_file_name: None,
                back_image_crop: None,
                back_image_accessibility: None,
            resource_url: None,
            resource_raw_destination: None,
            resource_open_mode: None,
            resource_valid: None,
            kind: None,
            node_type: None,
            character_id: None,
            character_name: None,
            character_role: None,
            situational_dialogue_pose_refs: HashMap::new(),
            emotion: None,
            next_node_id: None,
            responses: Vec::new(),
        });
    }

    extracted
}

fn extract_rise_accordion_activity_items(
    items: &[Value],
    available_assets: &[String],
) -> Vec<ActivityItem> {
    items
        .iter()
        .enumerate()
        .map(|(index, item)| {
            let title_html = extract_html_field(item, &["title", "heading", "label"])
                .filter(|value| has_meaningful_html(value))
                .unwrap_or_else(|| format!("Volet {}", index + 1));
            let content_html = extract_html_field(
                item,
                &["description", "content", "body", "text", "html"])
            .unwrap_or_default();
            let image = item
                .get("media")
                .and_then(|media| media.get("image"))
                .unwrap_or(item);

            ActivityItem {
                id: item
                    .get("id")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .unwrap_or_else(|| format!("accordion_item_{:02}", index + 1)),
                title: normalize_rise_html_units(&title_html),
                date_label: None,
                content_title: None,
                time_color: None,
                title_color: None,
                accent_color: None,
                correct_category_id: None,
                card_background_color: None,
                card_feedback_html: None,
                card_feedback_correct_html: None,
                card_feedback_incorrect_html: None,
                transcript_html: None,
                transcript_language: None,
                transcript_source: None,
                transcript_status: None,
                transcript_allow_download: None,
                content_html: normalize_rise_html_units(&content_html),
                asset_refs: collect_preferred_image_asset_refs(image, available_assets),
                media_file_name: None,
                media_layout: Some("image-below".to_string()),
                image_size: Some("medium".to_string()),
                image_rounded: Some(false),
                image_crop: extract_rise_image_dimensions_crop(image)
                    .or_else(|| extract_image_crop(image))
                    .or_else(|| extract_image_crop(item)),
                image_accessibility: extract_image_accessibility(image)
                    .or_else(|| extract_image_accessibility(item)),
                image_annotation_state_ref: None,
                image_annotation_source_asset_ref: None,
                front_type: None,
                front_text: None,
                front_image_asset_ref: None,
                front_image_file_name: None,
                front_image_crop: None,
                front_image_accessibility: None,
                back_type: None,
                back_title: None,
                back_image_asset_ref: None,
                back_image_file_name: None,
                back_image_crop: None,
                back_image_accessibility: None,
                resource_url: None,
                resource_raw_destination: None,
                resource_open_mode: None,
                resource_valid: None,
                kind: None,
                node_type: None,
                character_id: None,
                character_name: None,
                character_role: None,
                situational_dialogue_pose_refs: HashMap::new(),
                emotion: None,
                next_node_id: None,
                responses: Vec::new(),
            }
        })
        .collect()
}

fn extract_rise_image_grid_activity_items(
    items: &[Value],
    available_assets: &[String],
) -> Vec<ActivityItem> {
    items
        .iter()
        .take(4)
        .enumerate()
        .map(|(index, item)| {
            let content_html = extract_html_field(item, &["caption", "description", "content", "text"])
                .unwrap_or_default();
            let title = extract_html_field(item, &["title", "heading", "label"])
                .map(|value| strip_html(&value))
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| format!("Image {}", index + 1));
            let image = item
                .get("media")
                .and_then(|media| media.get("image"))
                .unwrap_or(item);
            let asset_refs = collect_preferred_image_asset_refs(image, available_assets);

            ActivityItem {
                id: item
                    .get("id")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .unwrap_or_else(|| format!("image_grid_item_{:02}", index + 1)),
                title,
                date_label: None,
                content_title: None,
                time_color: None,
                title_color: None,
                accent_color: None,
                correct_category_id: None,
                card_background_color: None,
                card_feedback_html: None,
                card_feedback_correct_html: None,
                card_feedback_incorrect_html: None,
                transcript_html: None,
                transcript_language: None,
                transcript_source: None,
                transcript_status: None,
                transcript_allow_download: None,
                content_html: normalize_rise_html_units(&content_html),
                asset_refs,
                media_file_name: None,
                media_layout: None,
                image_size: None,
                image_rounded: Some(false),
                image_crop: extract_rise_image_dimensions_crop(image)
                    .or_else(|| extract_image_crop(image))
                    .or_else(|| extract_image_crop(item)),
                image_accessibility: extract_image_accessibility(image)
                    .or_else(|| extract_image_accessibility(item)),
                image_annotation_state_ref: None,
                image_annotation_source_asset_ref: None,
                front_type: None,
                front_text: None,
                front_image_asset_ref: None,
                front_image_file_name: None,
                front_image_crop: None,
                front_image_accessibility: None,
                back_type: None,
                back_title: None,
                back_image_asset_ref: None,
                back_image_file_name: None,
                back_image_crop: None,
                back_image_accessibility: None,
                resource_url: None,
                resource_raw_destination: None,
                resource_open_mode: None,
                resource_valid: None,
                kind: None,
                node_type: None,
                character_id: None,
                character_name: None,
                character_role: None,
                situational_dialogue_pose_refs: HashMap::new(),
                emotion: None,
                next_node_id: None,
                responses: Vec::new(),
            }
        })
        .collect()
}

fn extract_situational_dialogue_activity_items(
    items: &[Value],
    _available_assets: &[String],
    _block_id: &str,
) -> Vec<ActivityItem> {
    let mut activity_items = Vec::new();

    for (situational_dialogue_index, situational_dialogue) in items.iter().enumerate() {
        let slides = situational_dialogue
            .get("slides")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        for (slide_index, slide) in slides.iter().enumerate() {
            let node_id = slide
                .get("id")
                .and_then(Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| {
                    format!(
                        "situational_dialogue_{}_node_{:02}",
                        situational_dialogue_index + 1,
                        slide_index + 1
                    )
                });
            let title = extract_html_field(slide, &["title", "heading", "label"])
                .map(|value| strip_html(&value))
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| {
                    if slide_index == 0 {
                        "Situation".to_string()
                    } else {
                        format!("Séquence {}", slide_index + 1)
                    }
                });
            let content_html =
                extract_html_field(slide, &["description", "content", "body", "text", "html"])
                    .unwrap_or_else(|| "<p></p>".to_string());
            let emotion = slide
                .get("emotion")
                .and_then(Value::as_str)
                .map(str::to_string);
            let responses = slide
                .get("responses")
                .and_then(Value::as_array)
                .map(|responses| {
                    responses
                        .iter()
                        .enumerate()
                        .map(|(response_index, response)| {
                            let response_id = response
                                .get("id")
                                .and_then(Value::as_str)
                                .map(str::to_string)
                                .unwrap_or_else(|| {
                                    format!("{}_response_{:02}", node_id, response_index + 1)
                                });
                            let label = extract_html_field(
                                response,
                                &["description", "label", "title", "text"],
                            )
                            .map(|value| strip_html(&value))
                            .filter(|value| !value.trim().is_empty())
                            .unwrap_or_else(|| format!("Choix {}", response_index + 1));
                            let feedback_html = extract_html_field(
                                response,
                                &["feedback", "feedbackHtml", "feedbackText"],
                            )
                            .map(|value| normalize_rise_html_units(&value));
                            let action = response
                                .get("action")
                                .and_then(Value::as_str)
                                .map(str::to_string);
                            let response_emotion = response
                                .get("emotion")
                                .and_then(Value::as_str)
                                .map(str::to_string);
                            let next_node_id = response
                                .get("nextSlide")
                                .and_then(|value| {
                                    value
                                        .get("slide")
                                        .or_else(|| value.get("id"))
                                        .or_else(|| value.get("nodeId"))
                                })
                                .and_then(Value::as_str)
                                .map(str::to_string);
                            SituationalDialogueResponse {
                                id: response_id,
                                label,
                                feedback_html,
                                action,
                                emotion: response_emotion,
                                next_node_id,
                            }
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let next_node_id = slide
                .get("nextSlide")
                .and_then(|value| value.get("slide").or_else(|| value.get("id")))
                .and_then(Value::as_str)
                .map(str::to_string);

            activity_items.push(ActivityItem {
                id: node_id,
                title,
                kind: None,
                node_type: Some(if slide_index == 0 {
                    "introduction".to_string()
                } else if slide_index + 1 == slides.len() {
                    "conclusion".to_string()
                } else {
                    slide
                        .get("type")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                        .unwrap_or_else(|| "dialogue".to_string())
                }),
                character_id: Some("situational_dialogue_character_nina".to_string()),
                character_name: Some("Nina".to_string()),
                character_role: None,
                situational_dialogue_pose_refs: HashMap::new(),
                emotion,
                next_node_id,
                responses,
                date_label: None,
                content_title: None,
                time_color: None,
                title_color: None,
                accent_color: None,
                correct_category_id: None,
                card_background_color: None,
                card_feedback_html: None,
                card_feedback_correct_html: None,
                card_feedback_incorrect_html: None,
                transcript_html: None,
                transcript_language: None,
                transcript_source: None,
                transcript_status: None,
                transcript_allow_download: None,
                content_html: normalize_rise_html_units(&content_html),
                asset_refs: Vec::new(),
                media_file_name: None,
                media_layout: Some("situational-dialogue".to_string()),
                image_size: None,
                image_rounded: Some(false),
                image_crop: None,
                image_accessibility: None,
                image_annotation_state_ref: None,
                image_annotation_source_asset_ref: None,
                front_type: None,
                front_text: None,
                front_image_asset_ref: None,
                front_image_file_name: None,
                front_image_crop: None,
                front_image_accessibility: None,
                back_type: None,
                back_title: None,
                back_image_asset_ref: None,
                back_image_file_name: None,
                back_image_crop: None,
                back_image_accessibility: None,
                resource_url: None,
                resource_raw_destination: None,
                resource_open_mode: None,
                resource_valid: None,
            });
        }
    }

    activity_items
}

fn default_situational_dialogue_character() -> SituationalDialogueCharacter {
    let poses = [
        (
            "introduction",
            "Pose introduction",
            "neutral",
            "neutral",
            "default-characters/Nina/introduction/introduction.png",
        ),
        (
            "question",
            "Pose question",
            "question",
            "neutral",
            "default-characters/Nina/question/question.png",
        ),
        (
            "neutral",
            "Pose neutre",
            "neutral",
            "neutral",
            "default-characters/Nina/neutral/neutral.png",
        ),
        (
            "positive",
            "Pose positive",
            "response",
            "happy",
            "default-characters/Nina/positive/positive.png",
        ),
        (
            "negative",
            "Pose négative",
            "response",
            "disappointed",
            "default-characters/Nina/negative/negative.png",
        ),
        (
            "conclusion",
            "Pose conclusion",
            "neutral",
            "neutral",
            "default-characters/Nina/conclusion/conclusion.png",
        ),
    ]
    .iter()
    .enumerate()
    .map(
        |(index, (state, label, usage, emotion, asset_ref))| SituationalDialogueCharacterPose {
            id: format!("situational_dialogue_character_pose_nina_{}", index + 1),
            label: (*label).to_string(),
            state: Some((*state).to_string()),
            usage: Some((*usage).to_string()),
            emotion: Some((*emotion).to_string()),
            asset_ref: Some((*asset_ref).to_string()),
        },
    )
    .collect::<Vec<_>>();

    SituationalDialogueCharacter {
        id: "situational_dialogue_character_nina".to_string(),
        name: "Nina".to_string(),
        default_character_id: Some("Nina".to_string()),
        role: None,
        description: None,
        show_name_role: Some(true),
        background_ref: None,
        default_pose_id: poses.first().map(|pose| pose.id.clone()),
        poses,
    }
}

fn extract_slides_activity_items(
    items: &[Value],
    available_assets: &[String],
    force_center_layout: bool,
) -> Vec<ActivityItem> {
    let visible_items = items
        .iter()
        .filter(|item| !force_center_layout || !is_rise_process_intro(item))
        .collect::<Vec<_>>();
    let extracted = visible_items
        .iter()
        .enumerate()
        .map(|(index, item)| {
            let kind = infer_step_kind(item, index, visible_items.len());
            let title = extract_html_field(item, &["title", "heading", "label"])
                .map(|value| strip_html(&value))
                .map(|value| strip_html(&value))
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| match kind.as_deref() {
                    Some("intro") => "Introduction".to_string(),
                    Some("summary") => "Conclusion".to_string(),
                    _ => format!("Etape {}", index + 1),
                });
            let content_html =
                extract_html_field(item, &["description", "content", "body", "text", "html"])
                    .unwrap_or_else(|| "<p></p>".to_string());
            let asset_refs = if force_center_layout {
                collect_rise_process_slide_asset_refs(item, available_assets)
            } else if let Some(image) = explicit_rise_item_image(item) {
                collect_preferred_image_asset_refs(image, available_assets)
            } else {
                collect_asset_refs(item, available_assets)
            };
            let image_crop = extract_image_crop(item);
            let media_layout = if force_center_layout {
                "image-center".to_string()
            } else {
                detect_media_layout("image", "text aside", item).unwrap_or_else(|| {
                    if asset_refs.is_empty() {
                        "image-full".to_string()
                    } else {
                        "image-left".to_string()
                    }
                })
            };
            let image_size =
                detect_image_size("image", "text aside", item).unwrap_or_else(|| "50".to_string());
            let image_rounded = detect_image_rounded(item);

            ActivityItem {
                id: item
                    .get("id")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .unwrap_or_else(|| format!("slides_item_{:02}", index + 1)),
                title,
                kind,
                date_label: None,
                content_title: None,
                time_color: None,
                title_color: None,
                accent_color: None,
                correct_category_id: None,
                card_background_color: None,
                card_feedback_html: None,
                card_feedback_correct_html: None,
                card_feedback_incorrect_html: None,
                transcript_html: None,
                transcript_language: None,
                transcript_source: None,
                transcript_status: None,
                transcript_allow_download: None,
                content_html: normalize_rise_html_units(&content_html),
                asset_refs,
                media_file_name: None,
                media_layout: Some(media_layout),
                image_size: Some(image_size),
                image_rounded,
                image_crop,
                image_accessibility: extract_image_accessibility(item),
                image_annotation_state_ref: None,
                image_annotation_source_asset_ref: None,
                front_type: None,
                front_text: None,
                front_image_asset_ref: None,
                front_image_file_name: None,
                front_image_crop: None,
                front_image_accessibility: None,
                back_type: None,
                back_title: None,
                back_image_asset_ref: None,
                back_image_file_name: None,
                back_image_crop: None,
                back_image_accessibility: None,
                resource_url: None,
                resource_raw_destination: None,
                resource_open_mode: None,
                resource_valid: None,
                node_type: None,
                character_id: None,
                character_name: None,
                character_role: None,
                situational_dialogue_pose_refs: HashMap::new(),
                emotion: None,
                next_node_id: None,
                responses: Vec::new(),
            }
        })
        .collect::<Vec<_>>();
    normalize_slides_activity_items(extracted)
}

fn normalize_slides_activity_items(items: Vec<ActivityItem>) -> Vec<ActivityItem> {
    let total = items.len();
    let mut enumerated: Vec<(usize, ActivityItem)> = items.into_iter().enumerate().collect();
    enumerated.sort_by_key(|(index, item)| {
        let kind = item.kind.as_deref().unwrap_or("");
        let rank = if kind == "intro" {
            0
        } else if kind == "summary" {
            2
        } else if kind == "step" {
            1
        } else if *index == 0 {
            0
        } else if *index + 1 == total {
            2
        } else {
            1
        };
        (rank, *index)
    });
    enumerated
        .into_iter()
        .map(|(_, mut item)| {
            item.kind = Some("step".to_string());
            item
        })
        .collect()
}

fn collect_rise_process_slide_asset_refs(
    item: &Value,
    available_assets: &[String]) -> Vec<String> {
    item.get("media")
        .and_then(|media| media.get("image"))
        .map(|image| collect_preferred_image_asset_refs(image, available_assets))
        .unwrap_or_default()
}

fn is_rise_process_intro(item: &Value) -> bool {
    item.get("type")
        .or_else(|| item.get("kind"))
        .and_then(Value::as_str)
        .is_some_and(|value| {
            let normalized = value.to_ascii_lowercase();
            normalized.contains("intro")
                || normalized.contains("begin")
                || normalized.contains("start")
                || normalized.contains("debut")
        })
}

fn infer_step_kind(item: &Value, index: usize, total: usize) -> Option<String> {
    let explicit = item
        .get("kind")
        .or_else(|| item.get("slideKind"))
        .or_else(|| item.get("type"))
        .and_then(Value::as_str)
        .map(|value| value.to_ascii_lowercase());

    if let Some(kind) = explicit {
        if kind.contains("intro")
            || kind.contains("debut")
            || kind.contains("begin")
            || kind.contains("start")
        {
            return Some("intro".to_string());
        }
        if kind.contains("summary")
            || kind.contains("conclusion")
            || kind.contains("end")
            || kind.contains("final")
        {
            return Some("summary".to_string());
        }
        if kind.contains("step") || kind.contains("etape") {
            return Some("step".to_string());
        }
    }

    if index == 0 {
        Some("intro".to_string())
    } else if index + 1 == total {
        Some("summary".to_string())
    } else {
        Some("step".to_string())
    }
}

fn extract_image_crop(value: &Value) -> Option<ImageCrop> {
    let direct = parse_image_crop_object(value);
    if direct.is_some() {
        return direct;
    }

    [
        "crop",
        "imageCrop",
        "image_crop",
        "cropRect",
        "cropRectangle",
        "visibleRect",
        "focusRect",
    ]
    .iter()
    .find_map(|field| value.get(*field).and_then(parse_image_crop_object))
}

fn extract_image_accessibility(value: &Value) -> Option<ImageAccessibility> {
    let candidates = [
        value,
        value.get("image").unwrap_or(&Value::Null),
        value
            .get("media")
            .and_then(|media| media.get("image"))
            .unwrap_or(&Value::Null),
    ];
    for candidate in candidates {
        let explicit_decorative = candidate
            .get("decorative")
            .and_then(Value::as_bool)
            .unwrap_or(false)
            || candidate
                .get("role")
                .and_then(Value::as_str)
                .is_some_and(|role| role.eq_ignore_ascii_case("presentation"))
            || candidate
                .get("ariaHidden")
                .and_then(Value::as_bool)
                .unwrap_or(false);
        if explicit_decorative {
            return Some(ImageAccessibility {
                alt_text: String::new(),
                decorative: true,
            });
        }
        for field in ["alt", "altText", "alternativeText", "description"] {
            if let Some(text) = candidate
                .get(field)
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|text| !text.is_empty())
            {
                let plain_text = strip_html(text);
                if plain_text.trim().is_empty() {
                    continue;
                }
                return Some(ImageAccessibility {
                    alt_text: plain_text,
                    decorative: false,
                });
            }
        }
    }
    None
}

fn extract_flashcard_image(
    front: &Value,
    _item: &Value,
    available_assets: &[String],
) -> (Vec<String>, Option<ImageCrop>) {
    let image = front.get("media").and_then(|media| media.get("image"));

    if let Some(image) = image {
        // Rise usually exports a card-specific crushed image. Prefer that exact
        // derivative and do not crop it again.
        if let Some(crushed_ref) = image
            .get("crushedKey")
            .and_then(Value::as_str)
            .and_then(|value| resolve_available_asset_ref(value, available_assets))
        {
            return (vec![asset_storage_ref(&crushed_ref)], None);
        }

        let crop = extract_rise_image_dimensions_crop(image)
            .or_else(|| extract_image_crop(front))
            .or_else(|| extract_image_crop(_item));
        // Only the explicit media object of the card face may provide its
        // image. Looking through the whole card also catches shared activity
        // assets (for example a template/background image) and incorrectly
        // turns text-only cards into image cards.
        return (collect_asset_refs(image, available_assets), crop);
    }

    // A text face must not inherit an image found elsewhere in the card
    // payload. It remains a text face unless Rise explicitly declares a
    // front media image above.
    (Vec::new(), None)
}

fn extract_rise_image_dimensions_crop(image: &Value) -> Option<ImageCrop> {
    let dimensions = image.get("dimensions")?.as_object()?;
    let left = read_crop_number(dimensions, &["left", "x"])?;
    let top = read_crop_number(dimensions, &["top", "y"])?;
    let width = read_crop_number(dimensions, &["width", "w"])?;
    let height = read_crop_number(dimensions, &["height", "h"])?;
    let original_width = read_crop_number(dimensions, &["originalWidth"])?;
    let original_height = read_crop_number(dimensions, &["originalHeight"])?;

    if original_width <= 0.0 || original_height <= 0.0 {
        return None;
    }

    normalize_imported_crop(
        left * 100.0 / original_width,
        top * 100.0 / original_height,
        width * 100.0 / original_width,
        height * 100.0 / original_height,
    )
}

fn parse_image_crop_object(value: &Value) -> Option<ImageCrop> {
    let object = value.as_object()?;
    let x = read_crop_number(object, &["x", "left"])?;
    let y = read_crop_number(object, &["y", "top"])?;
    let width = read_crop_number(object, &["width", "w"])?;
    let height = read_crop_number(object, &["height", "h"])?;

    normalize_imported_crop(x, y, width, height)
}

fn read_crop_number(object: &serde_json::Map<String, Value>, fields: &[&str]) -> Option<f64> {
    fields.iter().find_map(|field| {
        object.get(*field).and_then(|value| match value {
            Value::Number(number) => number.as_f64(),
            Value::String(text) => text.trim().trim_end_matches('%').parse::<f64>().ok(),
            _ => None,
        })
    })
}

fn normalize_imported_crop(x: f64, y: f64, width: f64, height: f64) -> Option<ImageCrop> {
    let mut x = x;
    let mut y = y;
    let mut width = width;
    let mut height = height;

    if [x, y, width, height]
        .iter()
        .all(|value| *value >= 0.0 && *value <= 1.0)
    {
        x *= 100.0;
        y *= 100.0;
        width *= 100.0;
        height *= 100.0;
    }

    if width <= 0.5 || height <= 0.5 {
        return None;
    }

    let x = x.clamp(0.0, 100.0);
    let y = y.clamp(0.0, 100.0);
    let width = width.clamp(0.5, 100.0 - x);
    let height = height.clamp(0.5, 100.0 - y);

    if x <= 0.5 && y <= 0.5 && width >= 99.5 && height >= 99.5 {
        return None;
    }

    Some(ImageCrop {
        x,
        y,
        width,
        height,
        shape: None,
    })
}

fn extract_html_field(value: &Value, fields: &[&str]) -> Option<String> {
    fields
        .iter()
        .find_map(|field| value.get(*field).and_then(value_to_html_string))
}

fn extract_rise_resource_actions(items: &[Value], settings: Option<&Value>) -> Vec<ActivityItem> {
    let show_descriptions = settings
        .and_then(|value| value.get("buttonShowDescription"))
        .and_then(Value::as_bool)
        .unwrap_or(true);

    items
        .iter()
        .enumerate()
        .filter_map(|(index, item)| {
            if is_rise_exit_course_action(item) {
                return None;
            }

            let source_label = extract_html_field(item, &["label", "title", "text"])
                .map(|value| strip_html(&value))
                .filter(|value| !value.trim().is_empty());
            let raw_destination = extract_html_field(
                item,
                &["destination", "url", "href", "link", "relativeUrl"])
            .map(|value| strip_html(&value))
            .unwrap_or_default();
            let (url, embedded_label) = extract_resource_url_and_label(&raw_destination);
            let label = source_label
                .or(embedded_label)
                .unwrap_or_else(|| format!("Ressource {}", index + 1));
            let valid = url.as_deref().map(is_safe_resource_url).unwrap_or(false);
            let description = if show_descriptions {
                extract_html_field(item, &["description"])
                    .filter(|value| has_meaningful_html(value))
                    .unwrap_or_default()
            } else {
                String::new()
            };

            Some(ActivityItem {
                id: item
                    .get("id")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .unwrap_or_else(|| format!("resource_item_{:02}", index + 1)),
                title: label,
                date_label: None,
                content_title: None,
                time_color: None,
                title_color: None,
                accent_color: None,
                correct_category_id: None,
                card_background_color: None,
                card_feedback_html: None,
                card_feedback_correct_html: None,
                card_feedback_incorrect_html: None,
                transcript_html: None,
                transcript_language: None,
                transcript_source: None,
                transcript_status: None,
                transcript_allow_download: None,
                content_html: normalize_rise_html_units(&description),
                asset_refs: Vec::new(),
                media_file_name: None,
                media_layout: None,
                image_size: None,
                image_rounded: Some(false),
                image_crop: None,
                image_accessibility: None,
                image_annotation_state_ref: None,
                image_annotation_source_asset_ref: None,
                front_type: None,
                front_text: None,
                front_image_asset_ref: None,
                front_image_file_name: None,
                front_image_crop: None,
                front_image_accessibility: None,
                back_type: None,
                back_title: None,
                back_image_asset_ref: None,
                back_image_file_name: None,
                back_image_crop: None,
                back_image_accessibility: None,
                resource_url: url,
                resource_raw_destination: (!raw_destination.trim().is_empty())
                    .then_some(raw_destination),
                resource_open_mode: Some("new-tab".to_string()),
                resource_valid: Some(valid),
                kind: Some("step".to_string()),
                node_type: None,
                character_id: None,
                character_name: None,
                character_role: None,
                situational_dialogue_pose_refs: HashMap::new(),
                emotion: None,
                next_node_id: None,
                responses: Vec::new(),
            })
        })
        .collect()
}

fn extract_resource_url_and_label(raw: &str) -> (Option<String>, Option<String>) {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return (None, None);
    }
    let url_pattern = Regex::new(r#"(?i)(?:https?://|mailto:)[^\s<>\"']+"#)
        .expect("valid resource URL regex");
    let Some(found) = url_pattern.find(trimmed) else {
        return (None, None);
    };
    let url = found
        .as_str()
        .trim_end_matches(|character: char| matches!(character, '.' | ',' | ';' | ')' | ']'))
        .to_string();
    let label = trimmed[..found.start()]
        .trim()
        .trim_end_matches([':', '-', '–', '—'])
        .trim();
    (
        is_safe_resource_url(&url).then_some(url),
        (!label.is_empty()).then_some(label.to_string()),
    )
}

fn is_safe_resource_url(value: &str) -> bool {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.chars().any(char::is_whitespace) {
        return false;
    }
    let normalized = trimmed.to_ascii_lowercase();
    if let Some(address) = normalized.strip_prefix("mailto:") {
        return address
            .split_once('@')
            .is_some_and(|(local, domain)| {
            !local.is_empty() && domain.contains('.') && !domain.ends_with('.')
        });
    }
    let authority = normalized
        .strip_prefix("https://")
        .or_else(|| normalized.strip_prefix("http://"))
        .and_then(|remainder| remainder.split(['/', '?', '#']).next());
    authority.is_some_and(|host| !host.is_empty() && host != "." && !host.contains('@'))
}

fn value_to_html_string(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(normalize_rise_html_units(trimmed))
            }
        }
        Value::Object(map) => {
            for key in [
                "html",
                "value",
                "text",
                "description",
                "paragraph",
                "heading",
                "title",
                "content",
                "fr-FR",
                "fr",
                "en-US",
                "en",
            ] {
                if let Some(found) = map.get(key).and_then(value_to_html_string) {
                    return Some(found);
                }
            }
            None
        }
        _ => None,
    }
}

fn preferred_native_asset_refs(
    item: &Value,
    family: &str,
    variant: &str,
    available_assets: &[String],
    collected_asset_refs: &[String],
) -> Vec<String> {
    let mut preferred = Vec::new();

    if family == "quote" {
        if let Some(avatar) = item
            .get("items")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|entry| entry.get("avatar"))
        {
            preferred.extend(collect_asset_refs(avatar, available_assets));
        }
    } else if family == "image" && variant == "text aside" {
        if let Some(media) = item
            .get("items")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|entry| entry.get("media"))
        {
            preferred.extend(collect_asset_refs(media, available_assets));
        }
    } else if family == "image" && variant == "hero" {
        if let Some(image) = item
            .get("items")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(explicit_rise_item_image)
        {
            preferred.extend(collect_preferred_image_asset_refs(image, available_assets));
        }
    } else if family == "interactive-fullscreen" && variant == "labeledgraphic" {
        if let Some(image) = item.get("media").and_then(|media| media.get("image")) {
            preferred.extend(collect_preferred_image_asset_refs(image, available_assets));
        }
    }

    if preferred.is_empty() {
        preferred.extend_from_slice(collected_asset_refs);
    }
    preferred.dedup();
    preferred
}

fn detect_media_layout(family: &str, variant: &str, item: &Value) -> Option<String> {
    let settings = item.get("settings");
    let image_position = detect_layout_hint(
        item,
        &[
            "imagePosition",
            "mediaPosition",
            "imageAlignment",
            "mediaAlignment",
            "position",
            "layout",
        ],
    );
    let media_width = settings
        .and_then(|value| value.get("mediaWidth"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let text_alignment = settings
        .and_then(|value| value.get("textAlignment"))
        .and_then(Value::as_str)
        .and_then(normalize_alignment)
        .or_else(|| detect_layout_hint(item, &["textAlignment", "alignment"]));

    if family == "quote" {
        let has_avatar = item
            .get("items")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|entry| entry.get("avatar"))
            .is_some();
        return has_avatar.then(|| "image-left".to_string());
    }

    if family == "image" && variant == "text aside" {
        let layout = match image_position.as_deref() {
            Some("right") | Some("end") => "image-right",
            Some("center") | Some("centre") | Some("middle") => "image-center",
            Some("bottom") | Some("below") => "image-below",
            Some("full") | Some("full-width") => "image-full",
            Some("overlay") => "image-overlay",
            Some("left") | Some("start") => "image-left",
            _ => match text_alignment.as_deref() {
                Some("center") => "image-center",
                Some("right") => "image-right",
                _ => "image-left",
            },
        };
        return Some(layout.to_string());
    }

    if family == "image" && variant == "hero" {
        return Some("image-full".to_string());
    }

    if family == "image" {
        if media_width == "1" || matches!(image_position.as_deref(), Some("full")) {
            return Some("image-full".to_string());
        }

        return Some("image-center".to_string());
    }

    if family == "interactive-fullscreen" || media_width == "1" {
        return Some("image-full".to_string());
    }

    None
}

fn detect_layout_hint(item: &Value, keys: &[&str]) -> Option<String> {
    let settings = item.get("settings");
    keys.iter()
        .find_map(|key| {
            settings
                .and_then(|value| value.get(*key))
                .and_then(Value::as_str)
                .map(str::to_string)
                .or_else(|| item.get(*key).and_then(Value::as_str).map(str::to_string))
        })
        .and_then(|value| {
            let normalized = value.to_ascii_lowercase();
            match normalized.as_str() {
                "left" | "start" => Some("left".to_string()),
                "right" | "end" => Some("right".to_string()),
                "center" | "centre" | "middle" => Some("center".to_string()),
                "bottom" | "below" => Some("below".to_string()),
                "full" | "full-width" | "fullwidth" => Some("full".to_string()),
                "overlay" => Some("overlay".to_string()),
                _ => None,
            }
        })
}

fn detect_image_size(family: &str, variant: &str, item: &Value) -> Option<String> {
    if family == "quote" {
        return item
            .get("settings")
            .and_then(|settings| settings.get("avatarSize"))
            .and_then(value_to_percentage)
            .map(format_imported_percentage);
    }

    if !(family == "image" && variant == "text aside") {
        return None;
    }

    // For Rise "image/text aside", imageSize is the internal split ratio of the
    // existing activity width, not a standalone image zoom. Normalize it to the
    // Paideia token used by the renderer/exporter.
    let settings = item.get("settings");
    let source_size = settings
        .and_then(|value| value.get("imageSize"))
        .or_else(|| settings.and_then(|value| value.get("mediaWidth")));

    source_size
        .and_then(|value| {
            value_to_percentage(value)
                .and_then(|percentage| {
                    Some(if percentage <= 37.5 {
                        "small".to_string()
                    } else if percentage <= 62.5 {
                        "medium".to_string()
                    } else {
                        "large".to_string()
                    })
                })
                .or_else(|| {
                    value.as_str().and_then(|value| {
                        match value.trim().to_ascii_lowercase().as_str() {
                            "small" => Some("small".to_string()),
                            "medium" | "normal" | "normale" => Some("medium".to_string()),
                            "large" => Some("large".to_string()),
                            _ => None,
                        }
                    })
                })
        })
        .or_else(|| Some("medium".to_string()))
}

fn detect_content_width(family: &str, item: &Value) -> Option<String> {
    source_content_width(item, family).map(|width| format!("{}", width.clamp(25.0, 100.0).round()))
}

fn detect_content_align(family: &str, item: &Value) -> Option<String> {
    let settings = item.get("settings")?;
    let keys: &[&str] = if family == "quote" {
        &["quoteAlignment", "textAlignment", "alignment"]
    } else {
        &["textAlignment", "alignment"]
    };

    keys.iter().find_map(|key| {
        settings
            .get(*key)
            .and_then(Value::as_str)
            .and_then(normalize_alignment)
    })
}

fn detect_media_gap(family: &str, variant: &str, item: &Value) -> Option<String> {
    if !((family == "image" && variant == "text aside") || family == "quote") {
        return None;
    }

    let settings = item.get("settings");
    let explicit_gap = ["mediaGap", "columnGap", "gap", "spacing"]
        .iter()
        .find_map(|key| {
            settings
                .and_then(|value| value.get(*key))
                .and_then(Value::as_f64)
        });

    let gap = explicit_gap
        .map(rise_spacing_to_pixels)
        .unwrap_or(28.0)
        .clamp(0.0, 120.0);
    Some(format!("{}px", gap.round()))
}

fn detect_vertical_align(family: &str, variant: &str, item: &Value) -> Option<String> {
    if !((family == "image" && variant == "text aside") || family == "quote") {
        return None;
    }

    item.get("settings")
        .and_then(|settings| {
            ["verticalAlignment", "verticalAlign", "contentAlignment"]
                .iter()
                .find_map(|key| settings.get(*key).and_then(Value::as_str))
        })
        .and_then(normalize_vertical_alignment)
        .or_else(|| Some("center".to_string()))
}

fn normalize_alignment(value: &str) -> Option<String> {
    match value.to_ascii_lowercase().as_str() {
        "left" | "start" => Some("left".to_string()),
        "center" | "centre" => Some("center".to_string()),
        "right" | "end" => Some("right".to_string()),
        "justify" | "justified" => Some("justify".to_string()),
        _ => None,
    }
}

fn normalize_vertical_alignment(value: &str) -> Option<String> {
    match value.to_ascii_lowercase().as_str() {
        "top" | "start" => Some("start".to_string()),
        "center" | "centre" | "middle" => Some("center".to_string()),
        "bottom" | "end" => Some("end".to_string()),
        _ => None,
    }
}

fn value_to_percentage(value: &Value) -> Option<f64> {
    let parsed = value.as_f64().or_else(|| {
        value
            .as_str()
            .and_then(|raw| raw.trim_end_matches('%').parse().ok())
    })?;
    Some(if parsed > 0.0 && parsed <= 1.0 {
        parsed * 100.0
    } else {
        parsed
    })
}

fn rise_spacing_to_pixels(value: f64) -> f64 {
    if value > 0.0 && value <= 12.0 {
        value * 10.0
    } else {
        value
    }
}

fn imported_rise_padding(item: &Value) -> Option<i32> {
    const MAX_ACTIVITY_PADDING: i32 = 120;

    let Some(settings) = item.get("settings") else {
        return None;
    };
    let top_source = settings.get("paddingTop").and_then(Value::as_f64);
    let bottom_source = settings.get("paddingBottom").and_then(Value::as_f64);
    if top_source.is_none() && bottom_source.is_none() {
        return None;
    }

    let top = rise_spacing_to_pixels(top_source.unwrap_or(3.0))
        .clamp(0.0, 120.0)
        .round() as i32;
    let bottom = rise_spacing_to_pixels(bottom_source.unwrap_or(3.0))
        .clamp(0.0, 120.0)
        .round() as i32;
    let symmetric = (((top + bottom) as f64) / 2.0)
        .round()
        .clamp(0.0, MAX_ACTIVITY_PADDING as f64) as i32;
    Some(symmetric)
}

fn imported_activity_minimum_padding(block_type: &str) -> i32 {
    if matches!(block_type, "divider" | "header") {
        0
    } else {
        10
    }
}

fn format_imported_percentage(value: f64) -> String {
    let clamped = value.clamp(5.0, 100.0);
    if (clamped - clamped.round()).abs() < 0.05 {
        format!("{}", clamped.round())
    } else {
        format!("{:.1}", clamped)
    }
}

fn detect_image_rounded(item: &Value) -> Option<bool> {
    item.get("settings")
        .and_then(|settings| settings.get("cornerRadius"))
        .and_then(Value::as_f64)
        .map(|radius| radius > 0.0)
}

fn normalize_rise_background_color(value: &str) -> Option<String> {
    let normalized = value.trim().to_ascii_uppercase();
    (normalized.len() == 7
        && normalized.starts_with('#')
        && normalized[1..].chars().all(|character| character.is_ascii_hexdigit()))
    .then_some(normalized)
}

fn supports_native_activity_background(block_type: &str) -> bool {
    matches!(
        block_type,
        "situational-dialogue"
            | "image-text"
            | "image-grid"
            | "point-of-interest"
            | "find-elements"
            | "complete"
            | "card-sort"
            | "matching"
            | "media"
            | "slides"
            | "rich-text"
            | "tabs"
            | "flip-cards"
            | "divider"
            | "section-marker"
            | "quote"
            | "note"
            | "image"
            | "accordion"
            | "timeline"
            | "result-message"
            | "attachment"
            | "links-resources"
            | "audio"
            | "continue"
            | "course-exit"
            | "quiz"
            | "html-custom"
            | "image-360"
    )
}

/// A lesson background is accepted only from an explicit course-level field.
/// Repeated activity colors are not evidence of a lesson canvas color: using
/// them here erases genuine activity appearance during the cleanup pass.
fn detect_rise_course_background_color(course: &Value) -> Option<String> {
    for candidate in [
        course.get("backgroundColor"),
        course.get("settings").and_then(|settings| settings.get("backgroundColor")),
    ] {
        if let Some(color) = candidate.and_then(Value::as_str).and_then(normalize_rise_background_color) {
            return Some(color);
        }
    }

    None
}

fn clear_imported_course_background_from_blocks(
    chapters: &mut [PaideiaChapter],
    course_background: &str,
) {
    for chapter in chapters {
        for page in &mut chapter.pages {
            for block in &mut page.blocks {
                if block.source_format.as_deref() != Some("rise-scorm") {
                    continue;
                }
                if !matches!(block.block_type.as_str(), "rich-text" | "note")
                    && block.panel_background_color.as_deref() == Some(course_background)
                {
                    block.panel_background_color = None;
                }
                if block.section_background_color.as_deref() == Some(course_background) {
                    block.section_background_color = None;
                }
            }
        }
    }
}

fn detect_panel_background_color(family: &str, item: &Value) -> Option<String> {
    let settings = item.get("settings")?;
    if let Some(color) = settings
        .get("backgroundColor")
        .and_then(Value::as_str)
        .filter(|color| !color.trim().is_empty())
    {
        return Some(color.to_string());
    }

    match settings
        .get("backgroundType")
        .and_then(Value::as_str)
        .unwrap_or("")
    {
        // Rise "GRAY" follows the course accent and appears as a cool blue-gray.
        "GRAY" if matches!(family, "impact" | "quote") => Some("#edf4ff".to_string()),
        "TINT" => Some("#edf4ff".to_string()),
        // Image backgrounds belong to the block section, not to the content panel.
        "IMAGE" => Some("transparent".to_string()),
        _ => None,
    }
}

fn detect_section_background_color(family: &str, item: &Value) -> Option<String> {
    let settings = item.get("settings")?;
    if let Some(color) = settings
        .get("backgroundColor")
        .and_then(Value::as_str)
        .filter(|color| !color.trim().is_empty())
    {
        return Some(color.to_string());
    }

    match settings
        .get("backgroundType")
        .and_then(Value::as_str)
        .unwrap_or("")
    {
        "GRAY" if !matches!(family, "impact" | "quote") => Some("#f4f6f9".to_string()),
        "TINT" if !matches!(family, "impact" | "quote") => Some("#edf4ff".to_string()),
        _ => None,
    }
}

fn detect_section_background_asset_ref(
    item: &Value,
    available_assets: &[String],
) -> Option<String> {
    item.get("background")
        .map(|background| collect_asset_refs(background, available_assets))
        .and_then(|refs| refs.into_iter().next())
}

fn detect_course_image_asset_ref(course: &Value, available_assets: &[String]) -> Option<String> {
    ["coverImage", "cover", "courseImage", "image"]
        .iter()
        .filter_map(|key| course.get(*key))
        .flat_map(|value| collect_asset_refs(value, available_assets))
        .find(|asset| is_image_asset_ref(asset))
}

fn detect_course_intro_html(course: &Value) -> String {
    extract_html_field(
        course,
        &[
            "description",
            "intro",
            "introduction",
            "overview",
            "summary",
            "subtitle",
            "body",
            "text",
        ],
    )
    .map(|value| normalize_rise_html_units(&value))
    .unwrap_or_default()
}

fn detect_section_background_opacity(item: &Value) -> Option<f64> {
    item.get("background")
        .and_then(|background| background.get("media"))
        .and_then(|media| media.get("image"))
        .and_then(|image| image.get("alpha"))
        .and_then(Value::as_f64)
        // Rise stores veil opacity. PAIDEIA stores image opacity and derives
        // its veil with `1 - image opacity`.
        .map(|value| 1.0 - value.clamp(0.0, 1.0))
}

fn detect_panel_padding(family: &str, item: &Value) -> Option<String> {
    let settings = item.get("settings")?;
    let key = match family {
        "quote" => "quotePadding",
        "impact" => "statementPadding",
        _ => return None,
    };
    settings
        .get(key)
        .and_then(Value::as_f64)
        .map(|value| format!("{}px", (value * 10.0).clamp(0.0, 120.0).round()))
}

fn source_content_width(item: &Value, family: &str) -> Option<f64> {
    let settings = item.get("settings")?;
    let keys: &[&str] = match family {
        "text" => &["textWidth", "contentWidth"],
        "list" => &["listWidth", "contentWidth"],
        "quote" => &["quoteWidth", "contentWidth"],
        "impact" => &["statementWidth", "contentWidth"],
        "image" => &["contentWidth", "blockWidth"],
        _ => &["contentWidth"],
    };
    keys.iter()
        .find_map(|key| settings.get(*key).and_then(value_to_percentage))
}

fn normalize_imported_header_html(value: &str) -> String {
    let wrapped_heading = Regex::new(
        r"(?is)^(?P<prefix>\s*<div\b[^>]*>\s*)<ol\b[^>]*>\s*<li\b[^>]*>\s*(?P<heading><h[1-6]\b[^>]*>.*?</h[1-6]>)\s*</li>\s*</ol>\s*(?P<suffix></div>\s*)$",
    )
    .expect("valid imported header wrapper regex");
    let bare_heading = Regex::new(
        r"(?is)^\s*<ol\b[^>]*>\s*<li\b[^>]*>\s*(?P<heading><h[1-6]\b[^>]*>.*?</h[1-6]>)\s*</li>\s*</ol>\s*$")
    .expect("valid imported bare header wrapper regex");

    let unwrapped = if wrapped_heading.is_match(value) {
        wrapped_heading
            .replace(value, "${prefix}${heading}${suffix}")
            .into_owned()
    } else if bare_heading.is_match(value) {
        bare_heading.replace(value, "${heading}").into_owned()
    } else {
        value.to_string()
    };

    let div_wrapped_heading = Regex::new(
        r"(?is)^\s*<div\b[^>]*>\s*(?P<heading><h[1-6]\b[^>]*>.*?</h[1-6]>)\s*</div>\s*$",
    )
    .expect("valid imported div-wrapped header regex");
    let unwrapped = if div_wrapped_heading.is_match(&unwrapped) {
        div_wrapped_heading
            .replace(&unwrapped, "${heading}")
            .into_owned()
    } else {
        unwrapped
    };

    let heading = Regex::new(
        r"(?is)<h[1-6]\b(?P<attributes>[^>]*)>(?P<body>.*?)</h[1-6]\s*>")
    .expect("valid imported header heading regex");
    if heading.is_match(&unwrapped) {
        return heading
            .replacen(&unwrapped, 1, "<h1${attributes}>${body}</h1>")
            .into_owned();
    }

    let paragraph = Regex::new(r"(?is)<p\b(?P<attributes>[^>]*)>(?P<body>.*?)</p\s*>")
        .expect("valid imported header paragraph regex");
    if paragraph.is_match(&unwrapped) {
        return paragraph
            .replacen(&unwrapped, 1, "<h1${attributes}>${body}</h1>")
            .into_owned();
    }

    let trimmed = unwrapped.trim();
    if trimmed.is_empty() {
        String::new()
    } else {
        format!("<h1>{trimmed}</h1>")
    }
}

fn normalize_rise_html_units(value: &str) -> String {
    // The exported canvas color is repeated on native text wrappers. It belongs
    // to the activity panel, not to an inner Rich Text field: retaining it here
    // creates a smaller colored rectangle inside the PAIDEIA activity panel.
    let native_wrapper_background = Regex::new(
        r#"(?is)(<div\b[^>]*\bclass\s*=\s*[\"'][^\"']*\brise-native-content\b[^\"']*[\"'][^>]*\bstyle\s*=\s*[\"'][^\"']*)\bbackground(?:-color)?\s*:\s*[^;\"']*;?\s*"#,
    )
    .expect("valid Rise native wrapper background regex");
    let without_native_wrapper_background = native_wrapper_background
        .replace_all(value, "$1")
        .into_owned();
    let normalized = normalize_rise_native_fragment(&without_native_wrapper_background);

    let normalized_lower = normalized.to_ascii_lowercase();
    let has_semantic_heading = ["<h1", "<h2", "<h3", "<h4", "<h5", "<h6"]
        .iter()
        .any(|tag| normalized_lower.contains(tag));

    if strip_html(&normalized).is_empty()
        || normalized_lower.contains("font-size")
        || has_semantic_heading
    {
        normalized
    } else {
        // Keep container groups around existing blocks, but use a native
        // paragraph for plain phrasing content from the first normalization.
        let wrapper = if Regex::new(r"(?i)<(?:p|div|ul|ol|table|blockquote|pre)\b").unwrap().is_match(&normalized) { "div" } else { "p" };
        format!(r#"<{wrapper} style="font-size: 18px;">{normalized}</{wrapper}>"#)
    }
}

// Transform only actual tag attributes. Text mentioning CSS, grouping divs,
// lists, tables and explicit paragraph boundaries retain their structure.
fn normalize_rise_native_fragment(html: &str) -> String {
    let tags = Regex::new(r#"(?s)<!--.*?-->|</?[a-zA-Z][^<>"']*(?:(?:"[^"]*"|'[^']*')[^<>"']*)*>"#).unwrap();
    let name = Regex::new(r"(?i)^</?([a-z][a-z0-9-]*)").unwrap();
    let style = Regex::new(r#"(?is)\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')"#).unwrap();
    let size = Regex::new(r"(?i)(^|;)\s*font-size\s*:\s*([0-9]+(?:\.[0-9]+)?)(px|rem|em|pt|%)?\s*(!important)?\s*(;|$)").unwrap();
    // (source tag, effective size, output opening index, has block children)
    let mut stack: Vec<(String, f64, usize, bool)> = Vec::new();
    let mut output: Vec<String> = Vec::new();
    let mut end = 0;
    for token in tags.find_iter(html) {
        output.push(html[end..token.start()].to_string());
        end = token.end();
        let raw = token.as_str();
        let Some(captures) = name.captures(raw) else { output.push(raw.to_string()); continue;
        };
        let tag = captures[1].to_ascii_lowercase();
        if raw.starts_with("</") {
            let mut close = raw.to_string();
            if let Some(index) = stack.iter().rposition(|entry| entry.0 == tag) {
                let (_, _, opening, has_blocks) = stack[index].clone();
                // A phrasing-only div is a paragraph, never an additional line
                // around existing paragraphs. Do not rewrite preformatted text.
                if tag == "div" && !has_blocks && !stack[..index].iter().any(|entry| matches!(entry.0.as_str(), "pre" | "p")) {
                    output[opening].replace_range(1..4, "p");
                    close = "</p>".to_string();
                }
                stack.truncate(index);
            }
            output.push(close);
            continue;
        }
        if matches!(tag.as_str(), "div" | "p" | "ul" | "ol" | "li" | "table" | "blockquote" | "pre" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "hr") {
            for entry in &mut stack { entry.3 = true; }
        }
        let parent_size = stack.last().map(|entry| entry.1).unwrap_or(18.0);
        let mut effective = parent_size;
        let mut opening = raw.to_string();
        if let Some(attribute) = style.captures(raw) {
            let value = attribute.get(1).or_else(|| attribute.get(2)).unwrap();
            let normalized = size.replace_all(value.as_str(), |m: &regex::Captures| {
                let number = m[2].parse::<f64>().unwrap_or(parent_size);
                let unit = m.get(3).map(|v| v.as_str().to_ascii_lowercase()).unwrap_or_default();
                effective = match unit.as_str() {
                    "rem" => number * 10.0, // Rise's known root baseline.
                    "em" => number * parent_size,
                    "%" => number * parent_size / 100.0,
                    "pt" => number * 96.0 / 72.0,
                    _ => number,
                }.clamp(6.0, 96.0);
                format!("{}font-size: {}px{}{}", &m[1], effective, m.get(4).map(|v| v.as_str()).unwrap_or(""), &m[5])
            });
            opening.replace_range(value.range(), &normalized);
        }
        let index = output.len();
        output.push(opening);
        if !raw.ends_with("/>") && !matches!(tag.as_str(), "br" | "hr" | "img" | "input" | "wbr" | "meta" | "link" | "col" | "source" | "embed" | "area" | "base" | "param" | "track") {
            stack.push((tag, effective, index, false));
        }
    }
    output.push(html[end..].to_string());
    output.concat()
}

fn extract_source_raw_html(items: &[Value]) -> Option<String> {
    const TEXT_FIELDS: [&str; 6] = [
        "heading",
        "subheading",
        "title",
        "paragraph",
        "description",
        "text",
    ];
    let mut fragments = Vec::new();

    for item in items {
        for field in TEXT_FIELDS {
            let Some(value) = item.get(field).and_then(Value::as_str) else {
                continue;
            };
            if strip_html(value).is_empty() {
                continue;
            }
            let normalized = normalize_rise_html_units(value);
            if !fragments.iter().any(|existing| existing == &normalized) {
                fragments.push(normalized);
            }
        }
    }

    (!fragments.is_empty()).then(|| fragments.join("\n"))
}

fn is_rise_text_columns_variant(family: &str, variant: &str) -> bool {
    normalize_rise_source_key(family) == "text"
        && matches!(
            normalize_rise_source_key(variant).as_str(),
            "two column" | "three column" | "four column" | "columns"
        )
}

fn extract_rise_text_columns_html(items: &[Value]) -> Option<String> {
    let cells = items
        .iter()
        .filter_map(|item| {
            extract_html_field(
                item,
                &[
                    "paragraph",
                    "description",
                    "text",
                    "content",
                    "body",
                    "html",
                ],
            )
        })
        .filter(|html| has_meaningful_html(html) && !is_rise_heading_demo_paragraph(html))
        .map(|html| normalize_rise_html_units(&html))
        .collect::<Vec<_>>();

    if cells.is_empty() {
        return None;
    }

    let width = 100.0 / cells.len() as f64;
    let last_index = cells.len().saturating_sub(1);
    let cells_html = cells
        .into_iter()
        .enumerate()
        .map(|(index, html)| {
            let padding = if index == 0 && index == last_index {
                "0"
            } else if index == 0 {
                "0 12px 0 0"
            } else if index == last_index {
                "0 0 0 12px"
            } else {
                "0 12px"
            };
            format!(
                r#"<td style="border:0;background:transparent;vertical-align:top;padding:{padding};width:{width:.4}%">{html}</td>"#,
            )
        })
        .collect::<Vec<_>>()
        .join("");

    Some(format!(
        r#"<table role="presentation" data-paideia-layout="columns" style="width:100%;max-width:100%;table-layout:fixed;border:0;border-collapse:collapse;background:transparent"><tbody><tr>{cells_html}</tr></tbody></table>"#
    ))
}

const RISE_HEADING_DEMO_PARAGRAPH: &str = "When we show up to the present moment with all of our senses, we invite the world to fill us with joy. The pains of the past are behind us. The future has yet to unfold. But the now is full of beauty simply waiting for our attention.";

fn normalize_rise_source_key(value: &str) -> String {
    Regex::new(r"([a-z0-9])([A-Z])")
        .expect("valid Rise source key regex")
        .replace_all(value.trim(), "$1 $2")
        .replace(['-', '_'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase()
}

fn is_rise_heading_demo_paragraph(value: &str) -> bool {
    strip_html(value)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        == RISE_HEADING_DEMO_PARAGRAPH
}

fn is_rise_statement_variant(family: &str, variant: &str) -> bool {
    let normalized_family = family.trim().to_ascii_lowercase();
    let normalized_variant = variant
        .trim()
        .to_ascii_lowercase()
        .replace(['-', '_'], " ");
    matches!(normalized_variant.as_str(), "statement a" | "statement b" | "statement c" | "statement d")
        || (matches!(normalized_family.as_str(), "statement" | "statements" | "impact")
            && matches!(normalized_variant.as_str(), "a" | "b" | "c" | "d"))
}

fn is_rise_accordion_variant(family: &str, variant: &str) -> bool {
    normalize_rise_source_key(family) == "accordion"
        || (normalize_rise_source_key(family) == "interactive"
            && normalize_rise_source_key(variant) == "accordion")
}

fn is_rise_exit_course_button(item: &Value) -> bool {
    item.get("items")
        .and_then(Value::as_array)
        .map(|items| items.iter().any(is_rise_exit_course_action))
        .unwrap_or(false)
}

fn is_rise_exit_course_action(entry: &Value) -> bool {
    if matches!(entry.get("type").and_then(Value::as_str), Some("exit-course"))
        || matches!(entry.get("destination").and_then(Value::as_str), Some("exit-course"))
    {
        return true;
    }

    let label = entry
        .get("label")
        .and_then(Value::as_str)
        .map(strip_html)
        .unwrap_or_default();
    let normalized_label = normalize_rise_source_key(&label);
    let destination = entry
        .get("destination")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim();

    destination.is_empty()
        && matches!(
            normalized_label.as_str(),
            "quitter le module" | "quitter la lecon" | "exit course" | "exit lesson"
        )
}

fn is_rise_terminal_exit_message(item: &Value) -> bool {
    normalize_rise_source_key(
        item.get("family")
            .and_then(Value::as_str)
            .unwrap_or_default(),
    ) == "text"
        && matches!(
            normalize_rise_source_key(
                item.get("variant")
                    .and_then(Value::as_str)
                    .unwrap_or_default(),
            )
            .as_str(),
            "heading" | "heading paragraph" | "paragraph" | "paragraph with heading" | "paragraph with subheading" | "subheading"
                | "subheading paragraph"
        )
}

fn extract_rise_heading_paragraph_or_default(items: &[Value], fallback: &str) -> String {
    for item in items {
        if let Some(value) = extract_html_field(item, &["paragraph", "description"]) {
            if !is_rise_heading_demo_paragraph(&value) && has_meaningful_html(&value) {
                return strip_html(&value);
            }
        }
    }
    fallback.to_string()
}

fn rise_plain_paragraph_contains_only_a_heading(items: &[Value]) -> bool {
    let heading_only = Regex::new(
        r"(?is)^\s*(?:<div\b[^>]*>\s*)*<h[1-6]\b[^>]*>.*?</h[1-6]\s*>(?:\s*</div>)*\s*$",
    )
    .expect("valid Rise paragraph heading-only regex");
    let displayed_fragments = items
        .iter()
        .filter_map(|item| extract_html_field(item, &["paragraph", "description"]))
        .filter(|value| !is_rise_heading_demo_paragraph(value) && has_meaningful_html(value))
        .collect::<Vec<_>>();

    !displayed_fragments.is_empty()
        && displayed_fragments
            .iter()
            .all(|value| heading_only.is_match(value.trim()))
}

fn extract_rise_text_variant_title_or_default(
    items: &[Value],
    variant: &str,
    fallback: &str,
) -> String {
    if variant == "paragraph" {
        return apply_french_typography_v2(fallback);
    }

    for item in items {
        let candidate = if matches!(
            variant,
            "subheading" | "subheading paragraph" | "paragraph with subheading"
        ) {
            item.get("subheading")
                .and_then(Value::as_str)
                .or_else(|| item.get("heading").and_then(Value::as_str))
        } else {
            item.get("heading").and_then(Value::as_str)
        };
        if let Some(value) = candidate {
            let cleaned = strip_html(value);
            if !cleaned.is_empty() {
                return apply_french_typography_v2(&cleaned);
            }
        }
    }

    apply_french_typography_v2(fallback)
}

fn extract_rise_text_variant_html(items: &[Value], variant: &str) -> Option<String> {
    let mut fragments = Vec::new();

    for item in items {
        let mut append_field = |field: &str| {
            let Some(value) = item.get(field).and_then(Value::as_str) else {
                return;
            };
            if is_rise_heading_demo_paragraph(value) || strip_html(value).is_empty() {
                return;
            }
            let normalized = normalize_rise_html_units(value);
            if !fragments.iter().any(|existing| existing == &normalized) {
                fragments.push(normalized);
            }
        };

        match variant {
            "paragraph" => append_field("paragraph"),
            "heading" => append_field("heading"),
            "subheading" => {
                if item.get("subheading").and_then(Value::as_str).is_some() {
                    append_field("subheading");
                } else {
                    append_field("heading");
                }
            }
            "paragraph with heading" | "heading paragraph" => {
                append_field("heading");
                append_field("paragraph");
            }
            "paragraph with subheading" | "subheading paragraph" => {
                if item.get("subheading").and_then(Value::as_str).is_some() {
                    append_field("subheading");
                } else {
                    append_field("heading");
                }
                append_field("paragraph");
            }
            _ => return None,
        }
    }

    (!fragments.is_empty()).then(|| fragments.join("\n"))
}

fn extract_rise_heading_html_without_placeholder(items: &[Value]) -> Option<String> {
    const TEXT_FIELDS: [&str; 6] = [
        "heading",
        "subheading",
        "title",
        "paragraph",
        "description",
        "text",
    ];
    let mut fragments = Vec::new();

    for item in items {
        for field in TEXT_FIELDS {
            let Some(value) = item.get(field).and_then(Value::as_str) else {
                continue;
            };
            if is_rise_heading_demo_paragraph(value) {
                continue;
            }
            if strip_html(value).is_empty() {
                continue;
            }
            let normalized = normalize_rise_html_units(value);
            if !fragments.iter().any(|existing| existing == &normalized) {
                fragments.push(normalized);
            }
        }
    }

    (!fragments.is_empty()).then(|| fragments.join("\n"))
}

fn extract_rise_text_overlay_html(items: &[Value]) -> Option<String> {
    let fragments = items
        .iter()
        .filter_map(|item| {
            extract_html_field(item, &["caption", "heading", "title", "paragraph", "description"],
            )
        })
        .filter(|value| has_meaningful_html(value))
        .collect::<Vec<_>>();
    (!fragments.is_empty()).then(|| fragments.join("\n"))
}

fn extract_rise_inline_html(items: &[Value]) -> Option<String> {
    items.iter().find_map(|item| {
        item.get("srcdoc")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    })
}

fn detect_rise_html_layout(item: &Value) -> String {
    match item
        .get("settings")
        .and_then(|settings| settings.get("width"))
        .and_then(Value::as_str)
    {
        Some("1") | Some("full") | Some("full-width") => "full-width".to_string(),
        _ => "activity-width".to_string(),
    }
}

fn extract_source_label(item: &Value, family: &str, variant: &str) -> String {
    for field in ["label", "title", "name"] {
        if let Some(value) = item
            .get(field)
            .and_then(value_to_html_string)
            .map(|value| strip_html(&value))
            .filter(|value| !value.trim().is_empty())
        {
            return value;
        }
    }

    if let Some(items) = item.get("items").and_then(Value::as_array) {
        for entry in items {
            if let Some(value) = extract_html_field(entry, &["title", "heading", "label", "name"])
                .map(|value| strip_html(&value))
                .filter(|value| !value.trim().is_empty())
            {
                return value;
            }
        }
    }

    format!("{} / {}", family, variant)
}

fn rematching_missing_properties(family: &str, variant: &str, quality: &str) -> Vec<String> {
    if quality == "exact" {
        return Vec::new();
    }

    if quality == "unsupported" {
        return vec![
            "Activite PAIDEIA native equivalente".to_string(),
            "Interaction source complete".to_string(),
            "Validation visuelle du fallback HTML".to_string(),
        ];
    }

    match (family, variant) {
        ("continue", "continue") => vec![
            "Regles de completion Rise specifiques".to_string(),
            "Styles Rise non natifs".to_string(),
        ],
        ("divider", "spacing divider") => Vec::new(),
        ("image", "text overlay") => vec!["Hauteur visuelle Rise exacte".to_string()],
        ("divider", _) => vec!["Espacement et styles decoratifs Rise exacts".to_string()],
        ("interactive-fullscreen", "labeledgraphic") => vec!["Styles de popup Rise".to_string()],
        _ => vec!["Proprietes Rise non prises en charge".to_string()],
    }
}

fn build_rise_line_chart_html(item: &Value) -> Option<String> {
    let points = item
        .get("items")
        .and_then(Value::as_array)?
        .iter()
        .filter_map(|entry| {
            let label = entry.get("type").and_then(Value::as_str)?.trim();
            let raw_value = entry.get("value").and_then(|value| {
                value
                    .as_str()
                    .map(str::to_string)
                    .or_else(|| value.as_f64().map(|number| number.to_string()))
            })?;
            let number = raw_value.trim().replace(',', ".").parse::<f64>().ok()?;
            if label.is_empty() || !number.is_finite() {
                return None;
            }
            let color = safe_rise_chart_color(
                entry
                    .get("color")
                    .and_then(Value::as_str)
                    .unwrap_or("#285f9f"),
                "#285f9f",
            );
            Some((label.to_string(), raw_value, number, color))
        })
        .collect::<Vec<_>>();

    if points.is_empty() {
        return None;
    }

    let settings = item.get("settings");
    let background = settings
        .and_then(|value| value.get("backgroundColor"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(|value| safe_rise_chart_color(value, "transparent"))
        .unwrap_or_else(|| "transparent".to_string());
    let line_color = safe_rise_chart_color(
        settings
            .and_then(|value| value.get("chartColor"))
            .and_then(Value::as_str)
            .unwrap_or("#285f9f"),
        "#285f9f",
    );
    let title_html = item
        .get("title")
        .and_then(Value::as_str)
        .filter(|value| has_meaningful_html(value))
        .map(|value| format!("<p>{}</p>", strip_html(value)))
        .unwrap_or_else(|| "<p>Graphique en courbe</p>".to_string());
    let items_label = item
        .get("itemsLabel")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("Catégorie");
    let values_label = item
        .get("valuesLabel")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("Valeur");

    let minimum = points
        .iter()
        .map(|(_, _, value, _)| *value)
        .fold(0.0_f64, f64::min);
    let maximum = points
        .iter()
        .map(|(_, _, value, _)| *value)
        .fold(0.0_f64, f64::max);
    let value_range = (maximum - minimum).max(1.0);
    let chart_left = 92.0;
    let chart_right = 948.0;
    let chart_top = 45.0;
    let chart_bottom = 390.0;
    let chart_width = chart_right - chart_left;
    let chart_height = chart_bottom - chart_top;
    let x_step = if points.len() > 1 {
        chart_width / (points.len() - 1) as f64
    } else {
        0.0
    };

    let coordinates = points
        .iter()
        .enumerate()
        .map(|(index, (_, _, value, _))| {
            let x = if points.len() > 1 {
                chart_left + index as f64 * x_step
            } else {
                chart_left + chart_width / 2.0
            };
            let y = chart_bottom - ((value - minimum) / value_range) * chart_height;
            (x, y)
        })
        .collect::<Vec<_>>();
    let polyline = coordinates
        .iter()
        .map(|(x, y)| format!("{x:.2},{y:.2}"))
        .collect::<Vec<_>>()
        .join(" ");

    let mut grid = String::new();
    for tick in 0..=5 {
        let ratio = tick as f64 / 5.0;
        let y = chart_bottom - ratio * chart_height;
        let value = minimum + value_range * ratio;
        grid.push_str(&format!(
            r#"<line class="chart-grid" x1="{chart_left}" x2="{chart_right}" y1="{y:.2}" y2="{y:.2}"/><text class="chart-y-tick" x="{label_x}" y="{label_y:.2}">{label}</text>"#,
            label_x = chart_left - 12.0,
            label_y = y + 5.0,
            label = escape_html(&format_chart_number(value)),
        ));
    }

    let mut marks = String::new();
    let mut table_rows = String::new();
    for (index, (label, raw_value, _, color)) in points.iter().enumerate() {
        let (x, y) = coordinates[index];
        marks.push_str(&format!(
            r##"<g><circle cx="{x:.2}" cy="{y:.2}" r="8" fill="{color}" stroke="#fff" stroke-width="3"><title>{accessible_label} : {accessible_value} {accessible_unit}</title></circle><text class="chart-value" x="{x:.2}" y="{value_y:.2}">{value}</text><text class="chart-x-tick" x="{x:.2}" y="425">{label}</text></g>"##,
            color = escape_html_attribute(color),
            accessible_label = escape_html(label),
            accessible_value = escape_html(raw_value),
            accessible_unit = escape_html(values_label),
            value_y = (y - 14.0).max(chart_top + 12.0),
            value = escape_html(raw_value),
            label = escape_html(label),
        ));
        table_rows.push_str(&format!(
            "<tr><th scope=\"row\">{}</th><td>{}</td></tr>",
            escape_html(label),
            escape_html(raw_value),
        ));
    }

    Some(format!(
        r#"<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
html,body{{margin:0;padding:0;background:transparent}}
body{{font-family:Arial,sans-serif;color:#152650}}
.rise-line-chart{{box-sizing:border-box;margin:0;padding:0 1rem;background:{background}}}
.rise-line-chart__inner{{width:min(1120px,100%);margin:0 auto}}
.rise-line-chart__title{{margin:0 0 1.25rem;text-align:center}}
.rise-line-chart__title p{{margin:0}}
.rise-line-chart svg{{display:block;width:100%;height:auto;overflow:visible}}
.chart-grid{{stroke:#d9dfE8;stroke-width:1}}
.chart-axis{{stroke:#62718d;stroke-width:2}}
.chart-line{{fill:none;stroke:{line_color};stroke-width:5;stroke-linecap:round;stroke-linejoin:round}}
.chart-y-tick{{font-size:16px;text-anchor:end;fill:#52617b}}
.chart-x-tick{{font-size:15px;text-anchor:middle;fill:#263958}}
.chart-value{{font-size:15px;font-weight:700;text-anchor:middle;fill:#152650}}
.chart-axis-label{{font-size:17px;font-weight:700;text-anchor:middle;fill:#152650}}
.rise-line-chart__table{{width:100%;margin-top:1rem;border-collapse:collapse}}
.rise-line-chart__table th,.rise-line-chart__table td{{padding:.55rem .75rem;border:1px solid #d9dfe8;text-align:left}}
.rise-line-chart__table thead th{{background:#eef3f9}}
@media(min-width:721px){{.rise-line-chart__table{{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}}}}
@media(max-width:720px){{.rise-line-chart{{padding-right:.5rem;padding-left:.5rem}}.rise-line-chart svg{{display:none}}}}
</style>
</head>
<body>
<figure class="rise-line-chart">
<div class="rise-line-chart__inner">
<figcaption class="rise-line-chart__title">{title_html}</figcaption>
<svg viewBox="0 0 1040 490" role="img" aria-labelledby="chart-title chart-description">
<title id="chart-title">Graphique en courbe</title>
<desc id="chart-description">{description}</desc>
{grid}
<line class="chart-axis" x1="{chart_left}" x2="{chart_left}" y1="{chart_top}" y2="{chart_bottom}"/>
<line class="chart-axis" x1="{chart_left}" x2="{chart_right}" y1="{chart_bottom}" y2="{chart_bottom}"/>
<polyline class="chart-line" points="{polyline}"/>
{marks}
<text class="chart-axis-label" x="520" y="480">{items_label}</text>
<text class="chart-axis-label" transform="translate(24 220) rotate(-90)">{values_label}</text>
</svg>
<table class="rise-line-chart__table">
<thead><tr><th scope="col">{items_label}</th><th scope="col">{values_label}</th></tr></thead>
<tbody>{table_rows}</tbody>
</table>
</div>
</figure>
</body>
</html>"#,
        background = escape_html_attribute(&background),
        line_color = escape_html_attribute(&line_color),
        title_html = title_html,
        description = escape_html(&format!(
            "{} points. Axe horizontal : {}. Axe vertical : {}.",
            points.len(),
            items_label,
            values_label
        )),
        grid = grid,
        chart_left = chart_left,
        chart_right = chart_right,
        chart_top = chart_top,
        chart_bottom = chart_bottom,
        polyline = polyline,
        marks = marks,
        items_label = escape_html(items_label),
        values_label = escape_html(values_label),
        table_rows = table_rows,
    ))
}

fn safe_rise_chart_color(value: &str, fallback: &str) -> String {
    let trimmed = value.trim();
    let is_hex = matches!(trimmed.len(), 4 | 5 | 7 | 9)
        && trimmed.starts_with('#')
        && trimmed[1..].chars().all(|character| character.is_ascii_hexdigit());
    if is_hex || trimmed.eq_ignore_ascii_case("transparent") {
        trimmed.to_string()
    } else {
        fallback.to_string()
    }
}

fn format_chart_number(value: f64) -> String {
    if (value.fract()).abs() < f64::EPSILON {
        format!("{value:.0}")
    } else {
        format!("{value:.2}")
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_string()
    }
}

fn build_structured_html_fallback(item: &Value, summary: &str, asset_refs: &[String]) -> String {
    let settings = item.get("settings");
    let background = settings
        .and_then(|value| value.get("backgroundColor"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("transparent");
    let corner_radius = settings
        .and_then(|value| value.get("cornerRadius"))
        .and_then(Value::as_f64)
        .unwrap_or(0.0);
    let source_items = item
        .get("items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let source_content = extract_all_source_html(&source_items)
        .unwrap_or_else(|| format!("<p>{}</p>", escape_html(summary)));
    let image_position = settings
        .and_then(|value| value.get("imagePosition"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let media_width = settings
        .and_then(|value| value.get("imageSize").or_else(|| value.get("mediaWidth")))
        .and_then(|value| {
            value_to_percentage(value).or_else(|| {
                value.as_str().and_then(|value| match value {
                    "small" => Some(25.0),
                    "medium" => Some(50.0),
                    "large" => Some(75.0),
                    "full" => Some(100.0),
                    _ => None,
                })
            })
        })
        .unwrap_or(50.0)
        .clamp(25.0, 100.0);
    let layout_class = match image_position {
        "right" => " is-image-right",
        "center" => " is-image-center",
        _ if asset_refs.iter().any(|asset| is_image_asset_ref(asset)) => " is-image-left",
        _ => "",
    };
    let image = asset_refs
        .iter()
        .find(|asset| is_image_asset_ref(asset))
        .map(|asset| {
            format!(
                r#"<img class="paideia-fallback__image" src="assets/{}" alt="" />"#,
                escape_html_attribute(asset)
            )
        })
        .unwrap_or_default();

    format!(
        r#"<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
html,body{{margin:0;padding:0;background:transparent}}
body{{font-family:Arial,sans-serif;color:#152650}}
.paideia-fallback{{box-sizing:border-box;padding:0 1rem;background:{background};border-radius:{corner_radius}px}}
.paideia-fallback__content{{max-width:1120px;margin:0 auto}}
.paideia-fallback__layout{{display:grid;grid-template-columns:minmax(0,{media_width}%) minmax(0,1fr);gap:1.5rem;align-items:start}}
.paideia-fallback__layout.is-image-right{{grid-template-columns:minmax(0,1fr) minmax(0,{media_width}%)}}
.paideia-fallback__layout.is-image-right .paideia-fallback__image{{order:2}}
.paideia-fallback__layout.is-image-center{{display:block}}
.paideia-fallback__image{{display:block;max-width:100%;height:auto;margin:0 auto}}
.paideia-fallback__text{{min-width:0;overflow-wrap:anywhere}}
@media(max-width:720px){{.paideia-fallback__layout{{display:block}}.paideia-fallback__image{{margin-bottom:1rem}}}}
</style>
</head>
<body>
<article class="paideia-fallback">
<div class="paideia-fallback__content">
<div class="paideia-fallback__layout{layout_class}">
{image}
<div class="paideia-fallback__text">{source_content}</div>
</div>
</div>
</article>
</body>
</html>"#,
        background = escape_html_attribute(background),
        corner_radius = corner_radius,
        media_width = media_width,
        layout_class = layout_class,
        image = image,
        source_content = source_content,
    )
}

fn extract_all_source_html(items: &[Value]) -> Option<String> {
    let sections = items
        .iter()
        .filter_map(|item| {
            let title = extract_html_field(item, &["heading", "title", "name"])
                .filter(|value| !strip_html(value).trim().is_empty());
            let body = extract_html_field(item, &["paragraph", "description", "content", "text"])
                .filter(|value| !strip_html(value).trim().is_empty());
            if title.is_none() && body.is_none() {
                return None;
            }
            Some(format!(
                r#"<section class="paideia-fallback__section">{}{}</section>"#,
                title
                    .map(|value| format!("<h3>{}</h3>", value))
                    .unwrap_or_default(),
                body.unwrap_or_default()
            ))
        })
        .collect::<Vec<_>>();

    (!sections.is_empty()).then(|| sections.join(""))
}

fn is_image_asset_ref(value: &str) -> bool {
    matches!(
        Path::new(value)
            .extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "svg" | "bmp" | "tif" | "tiff"
    )
}

fn is_video_asset_ref(value: &str) -> bool {
    matches!(
        Path::new(value)
            .extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "mp4" | "webm" | "ogg" | "ogv" | "mov" | "m4v" | "avi" | "mpg" | "mpeg"
    )
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn escape_html_attribute(value: &str) -> String {
    escape_html(value)
}

fn extract_quote_author_html(family: &str, item: &Value) -> Option<String> {
    if family != "quote" {
        return None;
    }

    let direct_name = item
        .get("name")
        .and_then(Value::as_str)
        .or_else(|| {
            item.get("items")
                .and_then(Value::as_array)
                .and_then(|items| items.first())
                .and_then(|entry| entry.get("name"))
                .and_then(Value::as_str)
        })
        .or_else(|| {
            item.get("settings")
                .and_then(|settings| settings.get("name"))
                .and_then(Value::as_str)
        });

    direct_name.and_then(|value| {
        let cleaned = strip_html(value);
        if cleaned.trim().is_empty() {
            None
        } else {
            Some(format!(
                "<p><strong>{}</strong></p>",
                escape_html(cleaned.trim())
            ))
        }
    })
}

fn canonicalize_rise_list_item_html(value: &str) -> (String, Option<String>) {
    let div_wrapper = Regex::new(
        r"(?is)^\s*<div(?P<attributes>[^>]*)>\s*(?P<body>.*)\s*</div\s*>\s*$")
    .expect("valid Rise list div wrapper regex");
    let paragraph_wrapper = Regex::new(
        r"(?is)^\s*<p(?P<attributes>[^>]*)>\s*(?P<body>.*)\s*</p\s*>\s*$")
    .expect("valid Rise list paragraph wrapper regex");
    let remaining_block = Regex::new(r"(?i)</?(?:div|p)\b")
        .expect("valid Rise list remaining block regex");
    let double_quoted_style = Regex::new(
        r#"(?is)\s+style\s*=\s*"(?P<value>[^"]*)""#)
    .expect("valid double-quoted style regex");
    let single_quoted_style = Regex::new(
        r"(?is)\s+style\s*=\s*'(?P<value>[^']*)'")
    .expect("valid single-quoted style regex");

    let original = value.trim().to_string();
    let mut body = original.clone();
    let mut wrapper_attributes = Vec::new();

    loop {
        let captures = div_wrapper
            .captures(&body)
            .or_else(|| paragraph_wrapper.captures(&body));
        let Some(captures) = captures else { break };
        wrapper_attributes.push(
            captures
                .name("attributes")
                .map(|value| value.as_str().to_string())
                .unwrap_or_default(),
        );
        body = captures
            .name("body")
            .map(|value| value.as_str().trim().to_string())
            .unwrap_or_default();
    }

    if wrapper_attributes.is_empty() || remaining_block.is_match(&body) {
        return (original, None);
    }

    let mut item_styles = Vec::new();
    let mut retained_wrappers = Vec::new();
    for attributes in wrapper_attributes {
        let style_match = double_quoted_style
            .captures(&attributes)
            .or_else(|| single_quoted_style.captures(&attributes));
        let mut retained_attributes = attributes.clone();
        if let Some(style_match) = style_match {
            if let Some(style) = style_match.name("value") {
                let normalized = style.as_str().trim().trim_end_matches(';').trim();
                if !normalized.is_empty() {
                    item_styles.push(normalized.to_string());
                }
            }
            if let Some(full_match) = style_match.get(0) {
                retained_attributes.replace_range(full_match.range(), "");
            }
        }
        if !retained_attributes.trim().is_empty() {
            retained_wrappers.push(retained_attributes);
        }
    }

    for attributes in retained_wrappers.into_iter().rev() {
        body = format!("<span{attributes}>{body}</span>");
    }
    let style = (!item_styles.is_empty()).then(|| item_styles.join(";"));
    (body, style)
}

fn extract_list_source_html(items: &[Value], variant: &str) -> Option<String> {
    let rendered_items = items
        .iter()
        .filter_map(|item| {
            extract_html_field(item, &["paragraph", "description", "text", "title"]).and_then(
                |value| {
                    if strip_html(&value).trim().is_empty() {
                        None
                    } else {
                        Some(value)
                    }
                },
            )
        })
        .map(|value| {
            let (body, style) = canonicalize_rise_list_item_html(&value);
            match style {
                Some(style) => format!(
                    "<li style=\"{}\">{}</li>",
                    escape_html_attribute(&style),
                    body,
                ),
                None => format!("<li>{}</li>", body),
            }
        })
        .collect::<Vec<_>>();

    if rendered_items.is_empty() {
        None
    } else {
        let list_tag = if variant.contains("number") || variant.contains("ordered") {
            "ol"
        } else {
            "ul"
        };
        Some(format!("<{list_tag}>{}</{list_tag}>", rendered_items.join("")))
    }
}

fn point_of_interest_roman_label(value: usize) -> String {
    const NUMERALS: &[(usize, &str)] = &[
        (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"),
        (90, "XC"), (50, "L"), (40, "XL"), (10, "X"), (9, "IX"),
        (5, "V"), (4, "IV"), (1, "I"),
    ];
    let mut remaining = value.max(1);
    let mut result = String::new();
    for (amount, numeral) in NUMERALS {
        while remaining >= *amount {
            result.push_str(numeral);
            remaining -= *amount;
        }
    }
    result
}

fn point_of_interest_alphabetic_label(value: usize, lowercase: bool) -> String {
    let mut remaining = value.max(1);
    let mut result = String::new();
    while remaining > 0 {
        remaining -= 1;
        result.insert(0, (b'A' + (remaining % 26) as u8) as char);
        remaining /= 26;
    }
    if lowercase { result.to_lowercase() } else { result }
}

fn point_of_interest_label_for_order(seed: &str, order: usize) -> String {
    if !seed.is_empty() && seed.chars().all(|character| character.is_ascii_digit()) {
        if let Ok(start) = seed.parse::<usize>() {
            return format!("{:0width$}", start + order.saturating_sub(1), width = seed.len());
        }
    }
    if seed == "I" || seed == "i" {
        let label = point_of_interest_roman_label(order);
        return if seed == "i" { label.to_lowercase() } else { label };
    }
    if seed.len() == 1 && seed.chars().all(|character| character.is_ascii_alphabetic()) {
        let lowercase = seed.chars().all(|character| character.is_ascii_lowercase());
        let start = seed.to_ascii_uppercase().as_bytes()[0] as usize - b'A' as usize + 1;
        return point_of_interest_alphabetic_label(start + order.saturating_sub(1), lowercase);
    }
    seed.to_string()
}

fn first_resolved_marker_media_ref(
    media: &Value,
    fields: &[&str],
    available_assets: &[String],
) -> Option<String> {
    fields.iter().find_map(|field| {
        media
            .get(*field)
            .and_then(Value::as_str)
            .and_then(|value| resolve_available_asset_ref(value, available_assets))
            .map(|value| asset_storage_ref(&value))
    })
}

fn extract_point_of_interest_marker_media(
    marker: &Value,
    available_assets: &[String],
) -> Option<PointOfInterestMarkerMedia> {
    let media = marker.get("media")?;
    if let Some(image) = media.get("image") {
        let asset_ref = collect_preferred_image_asset_refs(image, available_assets)
            .into_iter()
            .next()?;
        let file_name = image
            .get("originalUrl")
            .or_else(|| image.get("crushedKey"))
            .or_else(|| image.get("key"))
            .and_then(Value::as_str)
            .map(|value| basename(&normalize_asset_ref(value)))
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| basename(&asset_ref));
        return Some(PointOfInterestMarkerMedia {
            media_type: "image".to_string(),
            asset_ref,
            file_name,
            poster_asset_ref: None,
            subtitle_asset_ref: None,
            original_asset_ref: None,
            optimized_asset_ref: None,
            optimization_profile: None,
            image_accessibility: Some(ImageAccessibility {
                alt_text: String::new(),
                decorative: false,
            }),
            transcript_html: None,
            transcript_language: None,
            transcript_source: None,
            transcript_status: None,
            transcript_allow_download: None,
        });
    }

    for (kind, fields) in [
        ("video", &["originalUrl", "key", "inputKey", "url"][..]),
        ("audio", &["originalUrl", "key", "inputKey", "url"][..]),
    ] {
        let Some(source) = media.get(kind) else { continue;
        };
        let Some(asset_ref) = first_resolved_marker_media_ref(source, fields, available_assets) else {
            continue;
        };
        let file_name = source
            .get("originalUrl")
            .or_else(|| source.get("key"))
            .and_then(Value::as_str)
            .map(|value| basename(&normalize_asset_ref(value)))
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| basename(&asset_ref));
        let poster_asset_ref = (kind == "video")
            .then(|| first_resolved_marker_media_ref(source, &["poster"], available_assets))
            .flatten();
        return Some(PointOfInterestMarkerMedia {
            media_type: kind.to_string(),
            asset_ref: asset_ref.clone(),
            file_name,
            poster_asset_ref,
            subtitle_asset_ref: None,
            original_asset_ref: (kind == "video").then_some(asset_ref),
            optimized_asset_ref: None,
            optimization_profile: None,
            image_accessibility: None,
            transcript_html: None,
            transcript_language: None,
            transcript_source: None,
            transcript_status: None,
            transcript_allow_download: None,
        });
    }
    None
}

fn extract_point_of_interest_markers(
    item: &Value,
    available_assets: &[String],
) -> Vec<PointOfInterestMarker> {
    item.get("items")
        .and_then(Value::as_array)
        .map(|items| {
            let imported_labels = items
                .iter()
                .map(|marker| {
                    marker
                        .get("icon")
                        .and_then(Value::as_str)
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                })
                .collect::<Vec<_>>();
            let repeated_seed = imported_labels
                .first()
                .and_then(|label| *label)
                .filter(|seed| imported_labels.iter().all(|label| *label == Some(seed)));
            items
                .iter()
                .enumerate()
                .map(|(index, marker)| {
                    let fallback_label = (index + 1).to_string();
                    PointOfInterestMarker {
                        id: marker
                            .get("id")
                            .and_then(Value::as_str)
                            .map(str::to_string)
                            .unwrap_or_else(|| format!("marker_{}", index + 1)),
                        x: marker
                            .get("x")
                            .and_then(Value::as_str)
                            .and_then(|value| value.parse::<f64>().ok())
                            .or_else(|| marker.get("x").and_then(Value::as_f64))
                            .unwrap_or(50.0),
                        y: marker
                            .get("y")
                            .and_then(Value::as_str)
                            .and_then(|value| value.parse::<f64>().ok())
                            .or_else(|| marker.get("y").and_then(Value::as_f64))
                            .unwrap_or(50.0),
                        order: index + 1,
                        label: repeated_seed
                            .map(|seed| point_of_interest_label_for_order(seed, index + 1))
                            .or_else(|| imported_labels[index].map(str::to_string))
                            .unwrap_or(fallback_label),
                        title: marker
                            .get("title")
                            .and_then(Value::as_str)
                            .map(str::to_string)
                            .unwrap_or_else(|| format!("Marqueur {}", index + 1)),
                        content_html: marker
                            .get("description")
                            .and_then(Value::as_str)
                            .map(normalize_rise_html_units)
                            .unwrap_or_default(),
                        icon: marker
                            .get("icon")
                            .and_then(Value::as_str)
                            .map(str::to_string),
                        color: None,
                        media: extract_point_of_interest_marker_media(marker, available_assets),
                    }
                })
                .collect()
        })
        .unwrap_or_default()
}

fn extract_attachment_files(
    item: &Value,
    asset_refs: &[String],
    block_id: &str,
) -> Vec<AttachmentFile> {
    let metadata = collect_attachment_metadata(item);
    asset_refs
        .iter()
        .enumerate()
        .filter_map(|(index, asset_ref)| {
            attachment_file_from_asset_ref(asset_ref, block_id, index, metadata.get(index))
        })
        .collect()
}

fn attachment_file_from_asset_ref(
    asset_ref: &str,
    block_id: &str,
    index: usize,
    metadata: Option<&AttachmentMetadata>,
) -> Option<AttachmentFile> {
    let extension = Path::new(asset_ref)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !is_supported_attachment_extension(&extension) {
        return None;
    }

    let stored_name = Path::new(asset_ref)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(asset_ref)
        .to_string();
    let display_name = metadata
        .and_then(|data| data.display_name.as_ref())
        .filter(|value| !value.trim().is_empty())
        .cloned()
        .unwrap_or_else(|| stored_name.clone());
    let safe_id_name = sanitize_filename(&stored_name);
    Some(AttachmentFile {
        id: format!(
            "{}_attachment_{:02}_{}",
            sanitize_filename(block_id),
            index + 1,
            safe_id_name
        ),
        display_name,
        stored_name,
        extension,
        asset_ref: asset_ref.to_string(),
        size_bytes: metadata.and_then(|data| data.size_bytes),
        open_in_new_tab: Some(true),
    })
}

struct AttachmentMetadata {
    display_name: Option<String>,
    size_bytes: Option<u64>,
}

fn collect_attachment_metadata(item: &Value) -> Vec<AttachmentMetadata> {
    let mut metadata = Vec::new();
    collect_attachment_metadata_recursive(item, &mut metadata);
    metadata
}

fn collect_attachment_metadata_recursive(value: &Value, metadata: &mut Vec<AttachmentMetadata>) {
    match value {
        Value::Object(map) => {
            if let Some(attachment) = map.get("attachment").and_then(Value::as_object) {
                let display_name = attachment
                    .get("originalUrl")
                    .or_else(|| attachment.get("name"))
                    .or_else(|| attachment.get("filename"))
                    .and_then(Value::as_str)
                    .map(|value| basename(&normalize_asset_ref(value)));
                let size_bytes = attachment.get("size").and_then(Value::as_u64);
                metadata.push(AttachmentMetadata {
                    display_name,
                    size_bytes,
                });
            }
            for nested in map.values() {
                collect_attachment_metadata_recursive(nested, metadata);
            }
        }
        Value::Array(items) => {
            for nested in items {
                collect_attachment_metadata_recursive(nested, metadata);
            }
        }
        _ => {}
    }
}

fn is_supported_attachment_extension(extension: &str) -> bool {
    matches!(
        extension,
        "odt" | "doc" | "docx" | "pdf" | "ppt" | "pptx" | "odp" | "xls" | "xlsx" | "ods" | "zip"
    )
}

fn extract_heading_or_default(items: &[Value], fallback: &str) -> String {
    for item in items {
        if let Some(value) = item.get("heading").and_then(Value::as_str) {
            let cleaned = strip_html(value);
            if !cleaned.is_empty() {
                return apply_french_typography_v2(&cleaned);
            }
        }
    }
    apply_french_typography_v2(fallback)
}

fn extract_title_or_default(items: &[Value], fallback: &str) -> String {
    for item in items {
        if let Some(value) = item.get("title").and_then(Value::as_str) {
            if !value.trim().is_empty() {
                return apply_french_typography_v2(value.trim());
            }
        }
    }
    apply_french_typography_v2(fallback)
}

fn extract_paragraph_or_default(items: &[Value], fallback: &str) -> String {
    for item in items {
        if let Some(value) = item.get("paragraph").and_then(Value::as_str) {
            let cleaned = strip_html(value);
            if !cleaned.is_empty() {
                return apply_french_typography_v2(&cleaned);
            }
        }
        if let Some(value) = item.get("description").and_then(Value::as_str) {
            let cleaned = strip_html(value);
            if !cleaned.is_empty() {
                return apply_french_typography_v2(&cleaned);
            }
        }
    }
    apply_french_typography_v2(fallback)
}

#[allow(dead_code)]
fn apply_french_typography(value: &str) -> String {
    let narrow_nbsp = "\u{202f}";
    let nbsp = "\u{00a0}";
    let high_punctuation =
        Regex::new(r"[ \u{00a0}\u{202f}]*([;!?])").expect("valid french punctuation regex");
    let _colon = Regex::new(r"[ \u{00a0}\u{202f}]*(:)").expect("valid french colon regex");
    let double_quotes = Regex::new(r#""([^"]+)""#).expect("valid quote regex");
    let opening_quote = Regex::new(r"«[ \u{00a0}\u{202f}]*").expect("valid opening quote regex");
    let closing_quote = Regex::new(r"[ \u{00a0}\u{202f}]*»").expect("valid closing quote regex");

    let punctuation = high_punctuation;
    let with_punctuation = punctuation.replace_all(value, format!("{narrow_nbsp}$1"));
    let with_quotes = double_quotes.replace_all(&with_punctuation, format!("«{nbsp}$1{nbsp}»"));
    let with_opening_quotes = opening_quote.replace_all(&with_quotes, format!("«{nbsp}"));
    closing_quote
        .replace_all(&with_opening_quotes, format!("{nbsp}»"))
        .to_string()
}

fn apply_french_typography_v2(value: &str) -> String {
    let narrow_nbsp = "\u{202f}";
    let nbsp = "\u{00a0}";
    let high_punctuation =
        Regex::new(r"[ \u{00a0}\u{202f}]*([;!?])").expect("valid french punctuation regex");
    let colon = Regex::new(r"[ \u{00a0}\u{202f}]*(:)").expect("valid french colon regex");
    let double_quotes = Regex::new(r#""([^"]+)""#).expect("valid quote regex");
    let opening_quote =
        Regex::new(r"\u{00ab}[ \u{00a0}\u{202f}]*").expect("valid opening quote regex");
    let closing_quote =
        Regex::new(r"[ \u{00a0}\u{202f}]*\u{00bb}").expect("valid closing quote regex");

    let without_orphan_start = trim_leading_orphan_punctuation(value);
    let with_high_punctuation =
        high_punctuation.replace_all(&without_orphan_start, format!("{narrow_nbsp}$1"));
    let with_colon = colon.replace_all(&with_high_punctuation, format!("{nbsp}$1"));
    let with_quotes =
        double_quotes.replace_all(&with_colon, format!("\u{00ab}{nbsp}$1{nbsp}\u{00bb}"));
    let with_opening_quotes = opening_quote.replace_all(&with_quotes, format!("\u{00ab}{nbsp}"));
    closing_quote
        .replace_all(&with_opening_quotes, format!("{nbsp}\u{00bb}"))
        .to_string()
}

fn trim_leading_orphan_punctuation(value: &str) -> String {
    let orphan = Regex::new(r"^[\s\u{00a0}\u{202f}]*(?:[;:!?]\s*)+")
        .expect("valid leading orphan punctuation regex");
    orphan.replace(value, "").to_string()
}

fn strip_html(input: &str) -> String {
    let tags = Regex::new(r"<[^>]+>").expect("valid html stripping regex");
    let whitespace = Regex::new(r"\s+").expect("valid whitespace regex");
    let without_tags = tags.replace_all(input, " ");
    let without_entities = without_tags
        .replace("&nbsp;", " ")
        .replace("&emsp;", " ")
        .replace("&ensp;", " ")
        .replace("&thinsp;", " ")
        .replace("&numsp;", " ")
        .replace("&puncsp;", " ")
        .replace("&#8195;", " ")
        .replace("&#8194;", " ")
        .replace("&#8201;", " ")
        .replace("&#8239;", " ")
        .replace("&ndash;", "-")
        .replace("&mdash;", "-")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'");
    whitespace
        .replace_all(without_entities.trim(), " ")
        .to_string()
}

fn has_meaningful_html(input: &str) -> bool {
    !strip_html(input).trim().is_empty()
}

fn collect_asset_refs(item: &Value, available_assets: &[String]) -> Vec<String> {
    let mut refs = Vec::new();
    collect_asset_refs_recursive(item, &mut refs);
    refs = refs
        .into_iter()
        .filter_map(|value| resolve_available_asset_ref(&value, available_assets))
        .map(|value| asset_storage_ref(&value))
        .collect();
    refs.sort();
    refs.dedup();
    refs
}

fn explicit_rise_item_image(item: &Value) -> Option<&Value> {
    item.get("media")
        .and_then(|media| media.get("image"))
        .or_else(|| item.get("image"))
}

fn collect_preferred_image_asset_refs(
    image: &Value,
    available_assets: &[String]) -> Vec<String> {
    // Rise can expose several references for the same visual. The crushed key
    // identifies the derivative intended for the item, whereas originalUrl can
    // be a generic source filename shared by many unrelated visuals.
    for field in ["crushedKey", "key", "originalUrl", "src", "url"] {
        if let Some(asset_ref) = image
            .get(field)
            .and_then(Value::as_str)
            .and_then(|value| resolve_available_asset_ref(value, available_assets))
        {
            return vec![asset_storage_ref(&asset_ref)];
        }
    }

    // Unknown legacy shapes keep their complete set of references. They are
    // not forced through an arbitrary first-item choice.
    collect_asset_refs(image, available_assets)
}

fn collect_asset_refs_recursive(value: &Value, refs: &mut Vec<String>) {
    match value {
        Value::Object(map) => {
            for (key, nested) in map {
                if matches!(
                    key.as_str(),
                    "crushedKey"
                        | "poster"
                        | "url"
                        | "href"
                        | "file"
                        | "downloadUrl"
                        | "key"
                        | "originalUrl"
                        | "src"
                ) {
                    if let Some(text) = nested.as_str() {
                        if is_likely_local_asset(text) {
                            refs.push(text.to_string());
                        }
                    }
                }
                collect_asset_refs_recursive(nested, refs);
            }
        }
        Value::Array(items) => {
            for nested in items {
                collect_asset_refs_recursive(nested, refs);
            }
        }
        _ => {}
    }
}

fn missing_source_media_issues(payload: &Value, available_assets: &[String]) -> Vec<ImportIssue> {
    fn visit(value: &Value, location: &str, available: &[String], issues: &mut Vec<ImportIssue>) {
        match value {
            Value::Object(fields) => {
                let candidates = ["crushedKey", "poster", "url", "href", "file", "downloadUrl", "key", "originalUrl", "src"]
                    .iter()
                    .filter_map(|key| fields.get(*key).and_then(Value::as_str))
                    .filter(|value| is_likely_local_asset(value))
                    .collect::<Vec<_>>();
                for kind in ["image", "vidéo", "audio", "fichier"] {
                    let same_kind = candidates.iter().copied()
                        .filter(|candidate| crate::asset_integrity::media_type_for_report(&normalize_asset_ref(candidate)) == kind)
                        .collect::<Vec<_>>();
                    if same_kind.is_empty() || same_kind.iter().any(|candidate| resolve_available_asset_ref(candidate, available).is_some()) {
                        continue;
                    }
                    let name = normalize_asset_ref(same_kind[0]);
                    issues.push(ImportIssue {
                        severity: "error".to_string(),
                        location: location.to_string(),
                        source_block_type: kind.to_string(),
                        mapped_to: "empty".to_string(),
                        message: format!("Média manquant ({kind}) : {name}. Le champ a été laissé vide."),
                    });
                }
                for child in fields.values() { visit(child, location, available, issues); }
            }
            Value::Array(items) => for item in items { visit(item, location, available, issues); },
            _ => {}
        }
    }
    let mut issues = Vec::new();
    if let Some(lessons) = payload.get("course").and_then(|course| course.get("lessons")).and_then(Value::as_array) {
        for (lesson_index, lesson) in lessons.iter().enumerate() {
            if let Some(items) = lesson.get("items").and_then(Value::as_array) {
                for (item_index, item) in items.iter().enumerate() {
                    visit(item, &format!("lesson_{:02}/block_{:02}", lesson_index + 1, item_index + 1), available_assets, &mut issues);
                }
            }
        }
    }
    issues.sort_by(|left, right| left.location.cmp(&right.location).then(left.message.cmp(&right.message)));
    issues.dedup_by(|left, right| left.location == right.location && left.message == right.message);
    issues
}

fn is_likely_local_asset(value: &str) -> bool {
    let lowered = value.to_ascii_lowercase();
    if lowered.starts_with("http://") || lowered.starts_with("https://") {
        return false;
    }

    let normalized = normalize_asset_ref(value);
    let extension = Path::new(&normalized)
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    matches!(
        extension.as_str(),
        "png"
            | "jpg"
            | "jpeg"
            | "gif"
            | "webp"
            | "svg"
            | "bmp"
            | "tif"
            | "tiff"
            | "mp4"
            | "webm"
            | "ogg"
            | "ogv"
            | "mov"
            | "m4v"
            | "avi"
            | "mpg"
            | "mpeg"
            | "mp3"
            | "wav"
            | "m4a"
            | "aac"
            | "flac"
            | "pdf"
            | "doc"
            | "docx"
            | "odt"
            | "xls"
            | "xlsx"
            | "ppt"
            | "pptx"
            | "csv"
            | "txt"
            | "rtf"
    )
}

fn list_asset_filenames(source_assets_dir: &Path) -> Result<Vec<String>, String> {
    if !source_assets_dir.exists() {
        return Ok(vec![]);
    }
    let mut files = Vec::new();
    collect_asset_filenames_recursive(source_assets_dir, source_assets_dir, &mut files)?;
    Ok(files)
}

fn collect_asset_filenames_recursive(
    base_dir: &Path,
    current_dir: &Path,
    files: &mut Vec<String>,
) -> Result<(), String> {
    for entry in fs::read_dir(current_dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            collect_asset_filenames_recursive(base_dir, &path, files)?;
        } else if path.is_file() {
            let relative = path
                .strip_prefix(base_dir)
                .map_err(|err| err.to_string())?
                .to_string_lossy()
                .replace('\\', "/");
            files.push(relative);
        }
    }
    Ok(())
}

fn basename(value: &str) -> String {
    value
        .replace('\\', "/")
        .split('/')
        .next_back()
        .unwrap_or(value)
        .to_string()
}

fn resolve_available_asset_ref(value: &str, available_assets: &[String]) -> Option<String> {
    let normalized = normalize_asset_ref(value);
    if normalized.is_empty() {
        return None;
    }

    if let Some(exact) = available_assets
        .iter()
        .find(|asset| asset.eq_ignore_ascii_case(&normalized))
    {
        return Some(exact.clone());
    }

    let name = basename(&normalized);
    available_assets
        .iter()
        .find(|asset| {
            asset.eq_ignore_ascii_case(&name)
                || asset
                    .to_ascii_lowercase()
                    .ends_with(&format!("/{}", name.to_ascii_lowercase()))
        })
        .cloned()
}

fn normalize_asset_ref(value: &str) -> String {
    let without_fragment = value.split('#').next().unwrap_or(value);
    let without_query = without_fragment
        .split('?')
        .next()
        .unwrap_or(without_fragment);
    percent_decode(without_query)
        .replace('\\', "/")
        .trim_start_matches('/')
        .to_string()
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0usize;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let hi = from_hex(bytes[index + 1]);
            let lo = from_hex(bytes[index + 2]);
            if let (Some(hi), Some(lo)) = (hi, lo) {
                out.push((hi << 4) | lo);
                index += 3;
                continue;
            }
        }
        out.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

fn from_hex(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

fn sanitize_filename(value: &str) -> String {
    let mut out = String::new();
    let mut last_was_dash = false;

    for ch in value.chars() {
        let mapped = filename_ascii_fallback(ch);
        for mapped_ch in mapped.chars() {
            if mapped_ch.is_ascii_alphanumeric() || mapped_ch == '.' {
                out.push(mapped_ch);
                last_was_dash = false;
            } else if !last_was_dash {
                out.push('-');
                last_was_dash = true;
            }
        }
    }

    out.trim_matches('-').to_string()
}

fn copy_assets(
    source_assets_dir: &Path,
    destination_assets_dir: &Path,
    report: &ImportReport,
    excluded_asset_refs: &HashSet<String>,
) -> Result<(), String> {
    let _ = report;
    if !source_assets_dir.exists() {
        return Ok(());
    }
    fs::create_dir_all(destination_assets_dir).map_err(|err| err.to_string())?;
    copy_assets_recursive(
        source_assets_dir,
        source_assets_dir,
        destination_assets_dir,
        excluded_asset_refs,
        false,
    )?;
    Ok(())
}

struct CanonicalRiseAsset {
    path: PathBuf,
    storage_ref: String,
    size: u64,
    extension: String,
}

fn find_identical_rise_asset_refs(
    source_assets_dir: &Path,
    excluded_asset_refs: &HashSet<String>,
) -> Result<HashMap<String, String>, String> {
    let mut relative_refs = list_asset_filenames(source_assets_dir)?;
    relative_refs.sort();
    let mut canonical_assets = Vec::<CanonicalRiseAsset>::new();
    let mut duplicates = HashMap::new();

    for relative_ref in relative_refs {
        let storage_ref = asset_storage_ref(&relative_ref);
        if excluded_asset_refs.contains(&storage_ref) {
            continue;
        }
        let path = source_assets_dir.join(&relative_ref);
        let metadata = fs::metadata(&path).map_err(|err| err.to_string())?;
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        let mut matching_ref = None;
        for canonical in canonical_assets
            .iter()
            .filter(|candidate| {
            candidate.size == metadata.len() && candidate.extension == extension
        })
        {
            if files_are_identical(&path, &canonical.path)? {
                matching_ref = Some(canonical.storage_ref.clone());
                break;
            }
        }
        if let Some(canonical_ref) = matching_ref {
            duplicates.insert(storage_ref, canonical_ref);
        } else {
            canonical_assets.push(CanonicalRiseAsset {
                path,
                storage_ref,
                size: metadata.len(),
                extension,
            });
        }
    }

    Ok(duplicates)
}

fn files_are_identical(left: &Path, right: &Path) -> Result<bool, String> {
    if fs::metadata(left).map_err(|err| err.to_string())?.len()
        != fs::metadata(right).map_err(|err| err.to_string())?.len()
    {
        return Ok(false);
    }
    let mut left = BufReader::new(fs::File::open(left).map_err(|err| err.to_string())?);
    let mut right = BufReader::new(fs::File::open(right).map_err(|err| err.to_string())?);
    let mut left_buffer = [0u8; 64 * 1024];
    let mut right_buffer = [0u8; 64 * 1024];
    loop {
        let left_count = left.read(&mut left_buffer).map_err(|err| err.to_string())?;
        let right_count = right.read(&mut right_buffer).map_err(|err| err.to_string())?;
        if left_count != right_count || left_buffer[..left_count] != right_buffer[..right_count] {
            return Ok(false);
        }
        if left_count == 0 {
            return Ok(true);
        }
    }
}

fn remap_project_asset_refs(
    project: &mut PaideiaProject,
    replacements: &HashMap<String, String>,
) -> Result<(), String> {
    if replacements.is_empty() {
        return Ok(());
    }
    fn visit(value: &mut Value, replacements: &[(String, String)]) {
        match value {
            Value::String(text) => {
                for (source, target) in replacements {
                    if text.contains(source) {
                        *text = text.replace(source, target);
                    }
                }
            }
            Value::Array(values) => {
                for value in values {
                    visit(value, replacements);
                }
            }
            Value::Object(values) => {
                for value in values.values_mut() {
                    visit(value, replacements);
                }
            }
            _ => {}
        }
    }

    let mut ordered_replacements = replacements
        .iter()
        .map(|(source, target)| (source.clone(), target.clone()))
        .collect::<Vec<_>>();
    ordered_replacements.sort_by(|left, right| right.0.len().cmp(&left.0.len()));
    let mut value = serde_json::to_value(&*project).map_err(|err| err.to_string())?;
    visit(&mut value, &ordered_replacements);
    *project = serde_json::from_value(value).map_err(|err| err.to_string())?;
    Ok(())
}

fn copy_assets_recursive(
    base_dir: &Path,
    current_dir: &Path,
    destination_assets_dir: &Path,
    excluded_asset_refs: &HashSet<String>,
    preserve_storage_refs: bool,
) -> Result<(), String> {
    for entry in fs::read_dir(current_dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            copy_assets_recursive(
                base_dir,
                &path,
                destination_assets_dir,
                excluded_asset_refs,
                preserve_storage_refs,
            )?;
        } else if path.is_file() {
            let relative = path.strip_prefix(base_dir).map_err(|err| err.to_string())?;
            let storage_ref = if preserve_storage_refs {
                normalize_asset_ref(&relative.to_string_lossy())
            } else {
                asset_storage_ref(&relative.to_string_lossy())
            };
            if excluded_asset_refs.contains(&storage_ref) {
                continue;
            }
            let dest = destination_assets_dir.join(&storage_ref);
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|err| err.to_string())?;
            }
            fs::copy(path, dest).map_err(|err| err.to_string())?;
        }
    }
    Ok(())
}

fn asset_storage_ref(value: &str) -> String {
    let normalized = normalize_asset_ref(value);
    let category = match Path::new(&normalized)
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "svg" | "bmp" | "tif" | "tiff" => "images",
        "mp3" | "wav" | "ogg" | "m4a" | "aac" | "flac" => "audio",
        "mp4" | "webm" | "mov" | "m4v" | "avi" | "mpg" | "mpeg" | "ogv" => "video",
        _ => "documents",
    };
    format!("{}/scorm/{}", category, normalized)
}

fn write_import_report(project_root: &Path, report: &ImportReport) -> Result<(), String> {
    let imports_dir = project_root.join("imports");
    fs::create_dir_all(&imports_dir).map_err(|err| err.to_string())?;
    let payload = serde_json::to_string_pretty(report).map_err(|err| err.to_string())?;
    fs::write(imports_dir.join("rise-import-report.json"), &payload)
        .map_err(|err| err.to_string())?;
    fs::write(imports_dir.join("rematching-report.json"), payload).map_err(|err| err.to_string())
}

fn write_html_import_artifacts(
    project_root: &Path,
    artifacts: &[HtmlImportArtifact],
) -> Result<(), String> {
    for artifact in artifacts {
        let artifact_dir = project_root.join("assets").join(&artifact.folder);
        fs::create_dir_all(&artifact_dir).map_err(|err| err.to_string())?;
        fs::write(artifact_dir.join("index.html"), &artifact.html)
            .map_err(|err| err.to_string())?;
        let descriptor =
            serde_json::to_string_pretty(&artifact.descriptor).map_err(|err| err.to_string())?;
        fs::write(artifact_dir.join("descriptor.json"), descriptor)
            .map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn slugify(value: &str) -> String {
    let lowered = value.to_lowercase();
    let mut out = String::new();
    for ch in lowered.chars() {
        let mapped = filename_ascii_fallback(ch);
        for mapped_ch in mapped.chars() {
            if mapped_ch.is_ascii_alphanumeric() {
                out.push(mapped_ch);
            } else if (mapped_ch.is_whitespace() || mapped_ch == '-' || mapped_ch == '_')
                && !out.ends_with('-')
            {
                out.push('-');
            }
        }
    }
    let slug = out.trim_matches('-').to_string();
    if slug.is_empty() {
        "paideia".to_string()
    } else {
        slug
    }
}

fn filename_ascii_fallback(ch: char) -> String {
    match ch {
        'à' | 'á' | 'â' | 'ã' | 'ä' | 'å' | 'ā' | 'ă' | 'ą' | 'À' | 'Á' | 'Â' | 'Ã' | 'Ä' | 'Å'
        | 'Ā' | 'Ă' | 'Ą' => "a".to_string(),
        'ç' | 'ć' | 'ĉ' | 'ċ' | 'č' | 'Ç' | 'Ć' | 'Ĉ' | 'Ċ' | 'Č' => "c".to_string(),
        'ď' | 'đ' | 'Ð' | 'Ď' | 'Đ' => "d".to_string(),
        'è' | 'é' | 'ê' | 'ë' | 'ē' | 'ĕ' | 'ė' | 'ę' | 'ě' | 'È' | 'É' | 'Ê' | 'Ë' | 'Ē' | 'Ĕ'
        | 'Ė' | 'Ę' | 'Ě' => "e".to_string(),
        'ƒ' => "f".to_string(),
        'ĝ' | 'ğ' | 'ġ' | 'ģ' | 'Ĝ' | 'Ğ' | 'Ġ' | 'Ģ' => "g".to_string(),
        'ĥ' | 'ħ' | 'Ĥ' | 'Ħ' => "h".to_string(),
        'ì' | 'í' | 'î' | 'ï' | 'ĩ' | 'ī' | 'ĭ' | 'į' | 'ı' | 'Ì' | 'Í' | 'Î' | 'Ï' | 'Ĩ' | 'Ī'
        | 'Ĭ' | 'Į' => "i".to_string(),
        'ĵ' | 'Ĵ' => "j".to_string(),
        'ķ' | 'Ķ' => "k".to_string(),
        'ĺ' | 'ļ' | 'ľ' | 'ŀ' | 'ł' | 'Ĺ' | 'Ļ' | 'Ľ' | 'Ŀ' | 'Ł' => "l".to_string(),
        'ñ' | 'ń' | 'ņ' | 'ň' | 'Ñ' | 'Ń' | 'Ņ' | 'Ň' => "n".to_string(),
        'ò' | 'ó' | 'ô' | 'õ' | 'ö' | 'ø' | 'ō' | 'ŏ' | 'ő' | 'Ò' | 'Ó' | 'Ô' | 'Õ' | 'Ö' | 'Ø'
        | 'Ō' | 'Ŏ' | 'Ő' => "o".to_string(),
        'ŕ' | 'ŗ' | 'ř' | 'Ŕ' | 'Ŗ' | 'Ř' => "r".to_string(),
        'ś' | 'ŝ' | 'ş' | 'š' | 'Ś' | 'Ŝ' | 'Ş' | 'Š' => "s".to_string(),
        'ţ' | 'ť' | 'ŧ' | 'Ţ' | 'Ť' | 'Ŧ' => "t".to_string(),
        'ù' | 'ú' | 'û' | 'ü' | 'ũ' | 'ū' | 'ŭ' | 'ů' | 'ű' | 'ų' | 'Ù' | 'Ú' | 'Û' | 'Ü' | 'Ũ'
        | 'Ū' | 'Ŭ' | 'Ů' | 'Ű' | 'Ų' => "u".to_string(),
        'ŵ' | 'Ŵ' => "w".to_string(),
        'ý' | 'ÿ' | 'ŷ' | 'Ý' | 'Ÿ' | 'Ŷ' => "y".to_string(),
        'ź' | 'ż' | 'ž' | 'Ź' | 'Ż' | 'Ž' => "z".to_string(),
        'æ' | 'Æ' => "ae".to_string(),
        'œ' | 'Œ' => "oe".to_string(),
        'ß' => "ss".to_string(),
        _ if ch.is_ascii() => ch.to_string(),
        _ => "-".to_string(),
    }
}

fn collect_existing_project_titles(root: &Path) -> Result<HashSet<String>, String> {
    let mut titles = HashSet::new();
    if !root.exists() {
        return Ok(titles);
    }

    for entry in fs::read_dir(root).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        if !path.is_dir() || !path.join("project.json").exists() {
            continue;
        }
        let project = crate::repository::load_project_from_path(&path.to_string_lossy())?;
        titles.insert(project.title);
    }

    Ok(titles)
}

fn normalized_title_base(title: &str) -> String {
    let trimmed = title.trim();
    if let Some((base, suffix)) = trimmed.rsplit_once(" (") {
        if suffix.ends_with(')') {
            let number = &suffix[..suffix.len().saturating_sub(1)];
            if !number.is_empty() && number.chars().all(|ch| ch.is_ascii_digit()) {
                return base.trim().to_string();
            }
        }
    }
    trimmed.to_string()
}

fn title_suffix_number(title: &str) -> Option<usize> {
    let trimmed = title.trim();
    let (base, suffix) = trimmed.rsplit_once(" (")?;
    if !suffix.ends_with(')') {
        return None;
    }
    let number = &suffix[..suffix.len().saturating_sub(1)];
    if number.is_empty() || !number.chars().all(|ch| ch.is_ascii_digit()) || base.trim().is_empty()
    {
        return None;
    }
    number.parse::<usize>().ok()
}

fn next_project_title(base_title: &str, existing_titles: &HashSet<String>) -> String {
    let normalized_base = normalized_title_base(base_title);
    let mut max_suffix = 0usize;
    let mut has_plain = false;

    for existing in existing_titles {
        if normalized_title_base(existing) != normalized_base {
            continue;
        }
        match title_suffix_number(existing) {
            Some(value) => max_suffix = max_suffix.max(value),
            None => has_plain = true,
        }
    }

    if !has_plain && max_suffix == 0 {
        normalized_base
    } else {
        format!("{} ({})", normalized_base, max_suffix.max(1) + 1)
    }
}

fn compact_timestamp() -> String {
    Utc::now().format("%Y%m%d%H%M%S%3f").to_string()
}

fn unique_project_folder(root: &Path, slug: &str) -> Result<PathBuf, String> {
    let mut attempt = 0usize;
    loop {
        let suffix = if attempt == 0 {
            compact_timestamp()
        } else {
            format!("{}{:03}", compact_timestamp(), attempt % 1000)
        };
        let candidate = root.join(format!("{}-{}", slug, suffix));
        if !candidate.exists() {
            return Ok(candidate);
        }
        attempt += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;
    use zip::{CompressionMethod, ZipWriter};

    #[test]
    fn import_report_names_missing_video_even_when_poster_exists() {
        let payload = serde_json::json!({"course": {"lessons": [{"items": [{
            "media": {"video": {"url": "videos/missing.mp4", "poster": "images/poster.png"}}
        }]}]}});
        let issues = missing_source_media_issues(&payload, &["images/poster.png".to_string()]);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].severity, "error");
        assert_eq!(issues[0].location, "lesson_01/block_01");
        assert!(issues[0].message.contains("vidéo"));
        assert!(issues[0].message.contains("videos/missing.mp4"));
    }

    #[test]
    fn external_asset_storage_preserves_the_complete_source_path() {
        assert_eq!(
            asset_storage_ref("first/shared.png"),
            "images/scorm/first/shared.png"
        );
        assert_eq!(
            asset_storage_ref("second/shared.png"),
            "images/scorm/second/shared.png"
        );
        assert_ne!(
            asset_storage_ref("shared.png"),
            asset_storage_ref("images/shared.png")
        );
    }

    #[test]
    fn external_asset_copy_keeps_same_named_files_and_excludes_only_the_exact_ref() {
        let temp_root = std::env::temp_dir().join(format!(
            "paideia-import-assets-test-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let source = temp_root.join("source");
        let destination = temp_root.join("destination");
        fs::create_dir_all(source.join("first")).expect("create first source folder");
        fs::create_dir_all(source.join("second")).expect("create second source folder");
        fs::write(source.join("first/shared.png"), b"first").expect("write first image");
        fs::write(source.join("second/shared.png"), b"second").expect("write second image");

        let excluded = HashSet::from([asset_storage_ref("first/shared.png")]);
        copy_assets_recursive(&source, &source, &destination, &excluded, false)
            .expect("copy external assets");

        assert!(!destination.join("images/scorm/first/shared.png").exists());
        assert_eq!(
            fs::read(destination.join("images/scorm/second/shared.png"))
                .expect("read second copied image"),
            b"second"
        );

        let _ = fs::remove_dir_all(temp_root);
    }

    #[test]
    fn rise_asset_deduplication_requires_identical_bytes_not_matching_names() {
        let temp_root = std::env::temp_dir().join(format!(
            "paideia-import-asset-dedup-test-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let source = temp_root.join("source");
        fs::create_dir_all(source.join("first")).expect("create first folder");
        fs::create_dir_all(source.join("second")).expect("create second folder");
        fs::create_dir_all(source.join("third")).expect("create third folder");
        fs::write(source.join("first/shared.gif"), b"identical GIF bytes")
            .expect("write canonical GIF");
        fs::write(source.join("second/renamed.gif"), b"identical GIF bytes")
            .expect("write duplicate GIF");
        fs::write(source.join("third/shared.gif"), b"different GIF bytes")
            .expect("write same-name different GIF");
        fs::write(source.join("third/renamed.png"), b"identical GIF bytes")
            .expect("write same-bytes different extension");

        let duplicates = find_identical_rise_asset_refs(&source, &HashSet::new())
            .expect("find exact duplicate assets");

        assert_eq!(
            duplicates.get(&asset_storage_ref("second/renamed.gif")),
            Some(&asset_storage_ref("first/shared.gif"))
        );
        assert!(!duplicates.contains_key(&asset_storage_ref("third/shared.gif")));
        assert!(!duplicates.contains_key(&asset_storage_ref("third/renamed.png")));

        let _ = fs::remove_dir_all(temp_root);
    }

    #[test]
    fn preferred_item_image_uses_its_specific_derivative_only() {
        let image = serde_json::json!({
            "crushedKey": "item-42/stock-image.jpg",
            "originalUrl": "stock-image.jpg"
        });
        let refs = collect_preferred_image_asset_refs(
            &image,
            &[
                "stock-image.jpg".to_string(),
                "item-42/stock-image.jpg".to_string(),
            ],
        );

        assert_eq!(refs, vec!["images/scorm/item-42/stock-image.jpg"]);
    }

    #[test]
    fn rise_hero_uses_the_first_declared_image_and_ignores_stale_inserted_items() {
        let item = serde_json::json!({
            "family": "image",
            "variant": "hero",
            "type": "image",
            "items": [
                {
                    "media": { "image": {
                        "key": "rise/courses/course-id/source-cd.jpg",
                        "crushedKey": "cd-dvd-blu-ray-discs.jpg",
                        "originalUrl": "cd-dvd-blu-ray-discs.jpg",
                        "useCrushedKey": true
                    }}
                },
                {
                    "media": { "image": {
                        "key": "rise/courses/course-id/source-stock.jpg",
                        "crushedKey": "J-14wp/stock-image.jpg",
                        "originalUrl": "stock-image.jpg",
                        "useCrushedKey": true
                    }},
                    "isNewlyInserted": true
                }
            ]
        });
        let available = vec![
            "cd-dvd-blu-ray-discs.jpg".to_string(),
            "J-14wp/stock-image.jpg".to_string(),
            "stock-image.jpg".to_string(),
        ];

        let mapped = map_rise_item_to_block(&item, 8, 35, &available);

        assert_eq!(
            mapped.block.asset_refs,
            vec!["images/scorm/cd-dvd-blu-ray-discs.jpg"]
        );
    }

    #[test]
    fn imported_tabs_keep_the_distinct_image_of_each_tab() {
        let items = vec![
            serde_json::json!({
                "title": "Premier",
                "media": { "image": {
                    "crushedKey": "tab-1/shared.png",
                    "originalUrl": "shared.png"
                }}
            }),
            serde_json::json!({
                "title": "Second",
                "media": { "image": {
                    "crushedKey": "tab-2/shared.png",
                    "originalUrl": "shared.png"
                }}
            }),
        ];
        let available = vec![
            "shared.png".to_string(),
            "tab-1/shared.png".to_string(),
            "tab-2/shared.png".to_string(),
        ];

        let extracted = extract_tabs_activity_items(
            &Value::Null,
            "interactive",
            &items,
            &available);

        assert_eq!(
            extracted[0].asset_refs,
            vec!["images/scorm/tab-1/shared.png"]
        );
        assert_eq!(
            extracted[1].asset_refs,
            vec!["images/scorm/tab-2/shared.png"]
        );
    }

    #[test]
    fn rise_import_assigns_native_unique_block_ids() {
        let payload = serde_json::json!({
            "course": {
                "title": "IDs natifs",
                "lessons": [
                    {
                        "title": "Chapitre 1",
                        "items": [
                            {
                                "family": "text",
                                "variant": "paragraph",
                                "type": "text",
                                "items": [{ "paragraph": "<p>Premier</p>" }]
                            },
                            {
                                "family": "text",
                                "variant": "paragraph",
                                "type": "text",
                                "items": [{ "paragraph": "<p>Deuxième</p>" }]
                            }
                        ]
                    },
                    {
                        "title": "Chapitre 2",
                        "items": [
                            {
                                "family": "text",
                                "variant": "paragraph",
                                "type": "text",
                                "items": [{ "paragraph": "<p>Troisième</p>" }]
                            }
                        ]
                    }
                ]
            }
        });

        let (project, _, _) = map_rise_json_to_project(
            &payload,
            "native-import-ids",
            "IDs natifs",
            &[])
        .expect("Rise import should map");

        let block_ids = project
            .course
            .modules
            .iter()
            .flat_map(|module| module.chapters.iter())
            .flat_map(|chapter| chapter.pages.iter())
            .flat_map(|page| page.blocks.iter())
            .map(|block| block.id.clone())
            .collect::<Vec<_>>();
        let unique_ids = block_ids.iter().collect::<HashSet<_>>();

        assert_eq!(unique_ids.len(), block_ids.len());
        assert!(block_ids.iter().all(|id| {
            id.strip_prefix("blk_")
                .is_some_and(|suffix| {
                !suffix.is_empty() && suffix.chars().all(|character| character.is_ascii_digit())
            })
        }));
        assert!(block_ids.iter().any(|id| id == "blk_01"));
        assert!(block_ids.iter().any(|id| id == "blk_02"));
        assert!(block_ids.iter().any(|id| id == "blk_03"));
    }

    #[test]
    fn extracts_rise_payload_from_sample_index_html() {
        let sample_index =
            PathBuf::from("C:/tmp/paideia_rise_scorm_sample/scormcontent/index.html");
        if !sample_index.exists() {
            return;
        }

        let payload = extract_rise_course_payload(&sample_index).expect("payload should decode");
        let course = payload.get("course").expect("course should exist");
        let title = course
            .get("title")
            .and_then(Value::as_str)
            .expect("course title should exist");
        let lessons = course
            .get("lessons")
            .and_then(Value::as_array)
            .expect("lessons should exist");

        assert_eq!(title, "Connexion et interface");
        assert_eq!(lessons.len(), 2);
    }

    #[test]
    fn extracts_rise_payload_from_intermediate_window_course_data_format() {
        let temp_root = std::env::temp_dir().join(format!(
            "paideia-rise-window-course-data-test-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        fs::create_dir_all(&temp_root).expect("create window.courseData test root");
        let payload = r#"{"course":{"title":"Export Rise intermédiaire","lessons":[{"id":"lesson_01"}]}}"#;
        let encoded = STANDARD.encode(payload);
        fs::write(
            temp_root.join("index.html"),
            format!("<script>window.courseData = \"{}\";</script>", encoded),
        )
        .expect("write intermediate Rise index");

        let extracted = extract_rise_course_payload(&temp_root.join("index.html"))
            .expect("intermediate Rise payload should decode");
        assert_eq!(
            extracted
                .get("course")
                .and_then(|course| course.get("title"))
                .and_then(Value::as_str),
            Some("Export Rise intermédiaire")
        );

        fs::remove_dir_all(&temp_root).expect("remove window.courseData test root");
    }

    #[test]
    fn extracts_rise_payload_from_new_runtime_data_shell() {
        let temp_root = std::env::temp_dir().join(format!(
            "paideia-rise-runtime-data-test-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        fs::create_dir_all(&temp_root).expect("create runtime-data test root");
        fs::write(
            temp_root.join("index.html"),
            "<!doctype html><html><body><div id=\"app\"></div></body></html>",
        )
        .expect("write shell index");
        let payload = r#"{"course":{"title":"Export Rise récent","lessons":[{"id":"lesson_01"}]}}"#;
        let encoded = STANDARD.encode(payload);
        fs::write(
            temp_root.join("runtime-data.js"),
            format!("__jsonp(\"runtime-data.js\",\"{}\");", encoded),
        )
        .expect("write runtime data");

        let extracted = extract_rise_course_payload_from_content_root(&temp_root)
            .expect("new Rise runtime payload should decode");
        assert_eq!(
            extracted
                .get("course")
                .and_then(|course| course.get("title"))
                .and_then(Value::as_str),
            Some("Export Rise récent")
        );
        assert_eq!(
            extracted
                .get("course")
                .and_then(|course| course.get("lessons"))
                .and_then(Value::as_array)
                .map(Vec::len),
            Some(1)
        );

        fs::remove_dir_all(&temp_root).expect("remove runtime-data test root");
    }

    #[test]
    fn prefers_legacy_index_payload_when_both_rise_formats_exist() {
        let temp_root = std::env::temp_dir().join(format!(
            "paideia-rise-dual-format-test-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        fs::create_dir_all(&temp_root).expect("create dual-format test root");
        let legacy_payload = STANDARD.encode(r#"{"course":{"title":"Legacy","lessons":[]}}"#);
        fs::write(
            temp_root.join("index.html"),
            format!("<script>deserialize(\"{}\")</script>", legacy_payload),
        )
        .expect("write legacy index");
        let runtime_payload = STANDARD.encode(r#"{"course":{"title":"Runtime","lessons":[]}}"#);
        fs::write(
            temp_root.join("runtime-data.js"),
            format!("__jsonp(\"runtime-data.js\",\"{}\");", runtime_payload),
        )
        .expect("write runtime data");

        let extracted = extract_rise_course_payload_from_content_root(&temp_root)
            .expect("legacy Rise payload should remain preferred");
        assert_eq!(
            extracted
                .get("course")
                .and_then(|course| course.get("title"))
                .and_then(Value::as_str),
            Some("Legacy")
        );

        fs::remove_dir_all(&temp_root).expect("remove dual-format test root");
    }

    #[test]
    fn does_not_confuse_repeated_activity_colors_with_course_background() {
        let course = serde_json::json!({
            "lessons": [
                { "settings": { "backgroundColor": "#121419" } },
                { "settings": { "backgroundColor": "#121419" } },
                { "settings": { "backgroundColor": "#121419" } },
                { "settings": { "backgroundColor": "#EAF2FF" } }
            ]
        });

        assert_eq!(detect_rise_course_background_color(&course), None);
    }

    #[test]
    fn imports_only_explicit_course_level_background_color() {
        let direct = serde_json::json!({
            "settings": { "backgroundColor": "#121419" },
            "lessons": [{ "settings": { "backgroundColor": "#EAF2FF" } }]
        });

        assert_eq!(
            detect_rise_course_background_color(&direct).as_deref(),
            Some("#121419")
        );
    }

    #[test]
    fn importer_activity_background_matrix_matches_the_native_contract() {
        let supported = [
            "situational-dialogue", "image-text", "image-grid", "point-of-interest",
            "find-elements", "complete", "card-sort", "matching", "media", "slides",
            "rich-text", "tabs", "flip-cards", "divider", "section-marker", "quote",
            "note", "image", "accordion", "timeline", "result-message", "attachment",
            "links-resources", "audio", "continue", "course-exit", "quiz", "html-custom",
            "image-360",
        ];

        for block_type in supported {
            assert!(supports_native_activity_background(block_type), "{block_type}");
        }
        assert!(!supports_native_activity_background("header"));
        assert!(!supports_native_activity_background("unknown"));
    }

    #[test]
    fn normalizes_native_text_units_and_paragraphs_idempotently() {
        let input = r#"<div><p style="font-size:24px">A<span style="font-size:50%">B<span style="font-size:2em">C</span></span></p><div>D<br>E</div><ul><li style="margin-left:180px">F</li></ul></div>"#;
        let normalized = normalize_rise_html_units(input);
        assert!(normalized.contains("font-size: 12px"));
        assert_eq!(normalized.matches("font-size: 24px").count(), 2);
        assert!(normalized.contains("<p>D<br>E</p>"));
        assert!(normalized.contains("margin-left:180px"));
        assert_eq!(normalize_rise_html_units(&normalized), normalized);
        let plain = normalize_rise_html_units("Texte");
        assert_eq!(plain, r#"<p style="font-size: 18px;">Texte</p>"#);
        assert_eq!(normalize_rise_html_units(&plain), plain);
        assert!(normalize_rise_html_units("<p>font-size:2em est du texte</p>").contains("font-size:2em est du texte"));
    }

    #[test]
    fn removes_only_rise_canvas_background_from_imported_html() {
        let html = r#"<div class="rise-native-content" style="box-sizing:border-box;background:#121419;border-radius:0px"><p><span style="background-color:#FFEB3B">Texte</span></p></div>"#;
        let normalized = normalize_rise_html_units(html);

        assert!(!normalized.contains("background:#121419"));
        assert!(normalized.contains("background-color:#FFEB3B"));
    }

    #[test]
    fn rematches_rise_list_to_wide_rich_text() {
        let item = serde_json::json!({
            "family": "list",
            "variant": "bulleted",
            "type": "list",
            "settings": {
                "backgroundType": "COLOR",
                "backgroundColor": "#121419"
            },
            "items": [{
                "paragraph": "<p><span style=\"color:#ffffff\">Élément</span> <span style=\"background-color:#FFEB3B\">surligné</span></p>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        let html = mapped.block.content_html.as_deref().unwrap_or_default();

        assert_eq!(mapped.block.block_type, "rich-text");
        assert_eq!(mapped.block.title, "Texte");
        assert_eq!(mapped.block.panel_background_color, None);
        assert_eq!(mapped.block.section_background_color.as_deref(), Some("#121419"));
        assert_eq!(mapped.block.section_background_wide, Some(true));
        assert_eq!(mapped.block.section_background_height.as_deref(), Some("minimum"));
        assert!(html.starts_with("<ul>"));
        assert!(html.contains("<li"));
        assert!(!html.contains("paideia-rich-field-fill"));
        assert!(!html.contains("background-color:#121419"));
        assert!(html.contains("background-color:#FFEB3B"));
        assert!(html.contains("color:#ffffff"));
        assert!(!html.contains("rise-native-content"));
    }

    #[test]
    fn preserves_numbered_rise_list_semantics_in_rich_text() {
        let item = serde_json::json!({
            "family": "list",
            "variant": "numbered",
            "type": "list",
            "items": [
                { "paragraph": "<p>Premier</p>" },
                { "paragraph": "<p>Deuxieme</p>" }
            ]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        let html = mapped.block.content_html.as_deref().unwrap_or_default();

        assert_eq!(mapped.block.block_type, "rich-text");
        assert!(html.starts_with("<ol>"));
        assert_eq!(html.matches("<li").count(), 2);
        assert!(!html.contains("<p>"));
    }

    #[test]
    fn canonicalizes_rise_numbered_list_wrappers_for_rich_text_editing() {
        let item = serde_json::json!({
            "family": "list",
            "variant": "numbered",
            "type": "list",
            "items": [
                {
                    "paragraph": "<div style=\"font-size: 18px;\"><p><strong><span style=\"color: rgb(36, 103, 178);\">Les ports USB</span></strong></p></div>"
                },
                {
                    "paragraph": "<div style=\"font-size: 18px;\"><p style=\"text-align: center;\"><span data-source=\"rise\">Les ports réseau</span></p></div>"
                }
            ]
        });

        let mapped = map_rise_item_to_block(&item, 10, 3, &[]);
        let html = mapped.block.content_html.as_deref().unwrap_or_default();

        assert_eq!(mapped.block.block_type, "rich-text");
        assert!(html.starts_with("<ol>"));
        assert_eq!(html.matches("<li").count(), 2);
        assert!(!html.contains("<div"));
        assert!(!html.contains("<p"));
        assert!(html.contains("font-size: 18px"), "{html}");
        assert!(html.contains("text-align: center"), "{html}");
        assert!(html.contains("color: rgb(36, 103, 178)"));
        assert!(html.contains("<strong>"));
        assert!(html.contains("data-source=\"rise\""));
    }

    #[test]
    fn maps_rise_text_canvas_to_a_wide_activity_background() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "paragraph",
            "type": "text",
            "settings": {
                "backgroundType": "COLOR",
                "backgroundColor": "#121419"
            },
            "items": [{
                "paragraph": "<p><span style=\"color:#ffffff\">Texte</span></p>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        let html = mapped.block.content_html.as_deref().unwrap_or_default();

        assert_eq!(mapped.block.block_type, "rich-text");
        assert_eq!(mapped.block.panel_background_color, None);
        assert_eq!(mapped.block.section_background_color.as_deref(), Some("#121419"));
        assert_eq!(mapped.block.section_background_wide, Some(true));
        assert_eq!(mapped.block.section_background_height.as_deref(), Some("minimum"));
        assert!(!html.contains("paideia-rich-field-fill"));
        assert!(!html.contains("background-color:#121419"));
        assert!(html.contains("color:#ffffff"));
    }

    #[test]
    fn keeps_a_rise_text_background_out_of_rich_text_content_assets() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "paragraph",
            "type": "text",
            "settings": { "backgroundType": "IMAGE" },
            "background": {
                "media": { "image": { "crushedKey": "canvas.jpg", "alpha": 0.2 } }
            },
            "items": [{ "paragraph": "<p>Texte sans image incorporée</p>" }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &["canvas.jpg".to_string()]);

        assert_eq!(mapped.block.block_type, "rich-text");
        assert_eq!(
            mapped.block.section_background_image_ref.as_deref(),
            Some("images/scorm/canvas.jpg")
        );
        assert!(mapped.block.asset_refs.is_empty());
        assert_eq!(mapped.block.section_background_opacity, Some(1.0));
        assert_eq!(mapped.block.section_background_wide, Some(true));
    }

    #[test]
    fn recognizes_extended_local_asset_formats() {
        assert!(is_likely_local_asset("assets/image.svg?download=1"));
        assert!(is_likely_local_asset("assets/manual.docx#page=2"));
        assert!(is_likely_local_asset("assets/clip.mpeg"));
        assert!(!is_likely_local_asset("https://cdn.example.com/image.png"));
    }

    #[test]
    fn rejects_legacy_paideia_scorm_roundtrip_schema() {
        let error = parse_paideia_project_snapshot(r#"{"schemaVersion":1,"payload":{}}"#)
            .expect_err("schemaVersion 1 must not be accepted");

        assert!(error.contains("non supportee: 1"));
    }

    #[test]
    fn imports_paideia_scorm_from_roundtrip_metadata_before_rise_heuristics() {
        let temp_root = std::env::temp_dir().join(format!(
            "paideia-roundtrip-import-test-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let source_zip = temp_root.join("source.zip");
        let destination_root = temp_root.join("destination");
        fs::create_dir_all(&temp_root).expect("create temp root");

        let mut project = PaideiaProject {
            id: "proj_roundtrip".to_string(),
            slug: "roundtrip-source".to_string(),
            title: "Roundtrip Source".to_string(),
            description: "Projet PAIDEIA exporte en SCORM".to_string(),
            keywords: Vec::new(),
            course_intro_html: "<p>Intro</p>".to_string(),
            course_cover_title_html: String::new(),
            title_style: None,
            custom_font: None,
            imported_fonts: Vec::new(),
            course_image_ref: None,
            course_cover_style: None,
            activity_spacing_px: Some(36),
            hide_chapter_title_banner: false,
            course_appearance: None,
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
            created_by: "test".to_string(),
            default_locale: "fr-FR".to_string(),
            locales: vec!["fr-FR".to_string()],
            status: "draft".to_string(),
            current_version: "v-test".to_string(),
            root_course_id: "course_roundtrip".to_string(),
            course: PaideiaCourse {
                id: "course_roundtrip".to_string(),
                title: "Roundtrip Source".to_string(),
                modules: vec![PaideiaModule {
                    id: "mod_01".to_string(),
                    title: "Module".to_string(),
                    chapters: vec![PaideiaChapter {
                        id: "lesson_01".to_string(),
                        title: "Chapitre".to_string(),
                        pages: vec![PaideiaPage {
                            id: "page_01".to_string(),
                            title: "Page".to_string(),
                            blocks: vec![PaideiaBlock {
                                id: "block_01".to_string(),
                                block_type: "image".to_string(),
                                family: None,
                                variant: None,
                                title: "Image native".to_string(),
                                summary: "Résumé".to_string(),
                                content_html: Some("<p>Texte</p>".to_string()),
                                quote_author_html: None,
                                quote_show_author: None,
                                html_asset_root: None,
                                html_entry_file: None,
                                html_package_name: None,
                                media_layout: Some("image-center".to_string()),
                                image_size: Some("medium".to_string()),
                                content_width: Some("100".to_string()),
                                content_align: Some("left".to_string()),
                                media_gap: Some("28px".to_string()),
                                vertical_align: Some("center".to_string()),
                                image_rounded: Some(true),
                                media_file_name: Some("sample.png".to_string()),
                                image_crop: Some(ImageCrop {
                                    x: 10.0,
                                    y: 20.0,
                                    width: 70.0,
                                    height: 60.0,
                                    shape: Some("rectangle".to_string()),
                                }),
                                image_accessibility: None,
                                image_annotation_state_ref: None,
                                image_annotation_source_asset_ref: None,
                                video_caption_color: None,
                                video_caption_background_enabled: None,
                                video_caption_outline: None,
                                video_subtitle_original_ref: None,
                                video_original_asset_ref: None,
                                video_optimized_asset_ref: None,
                                video_optimization_profile: None,
                                video_allow_fullscreen: None,
                                audio_autoplay_next: None,
                                audio_allow_download: None,
                                image360_initial_yaw: None,
                                image360_initial_pitch: None,
                                image360_zoom_enabled: None,
                                image360_full_width: None,
                                image360_allow_fullscreen: None,
                                header_background_color: None,
                                header_text_color: None,
                                header_text_outline: None,
                                header_text_outline_color: None,
                                header_height: None,
                                header_image_position_y: None,
                                button_background_color: None,
                                button_text_color: None,
                                panel_background_color: Some("#ffffff".to_string()),
                                panel_border_color: Some("#123a7a".to_string()),
                                panel_border_width: Some("2px".to_string()),
                                panel_border_style: Some("none".to_string()),
                                panel_padding: Some("42px 52px".to_string()),
                                panel_rounded: Some(true),
                                panel_shadow: Some(false),
                                note_icon: None,
                                note_show_icon: None,
                                note_icon_color: None,
                                note_icon_matches_border: None,
                                flip_card_front_background_color: None,
                                flip_card_back_background_color: None,
                                flip_card_front_border_color: None,
                                flip_card_back_border_color: None,
                                slides_activity_background_color: None,
                                slides_activity_border_color: None,
                                slides_activity_border_width: None,
                                slides_activity_border_style: None,
                                slides_activity_rounded: None,
                                slides_activity_shadow: None,
                                section_background_color: None,
                                section_background_image_ref: None,
                                section_background_opacity: None,
                                section_background_overlay_dark: None,
                                section_background_blur: None,
                                section_background_position_y: None,
                                section_background_rounded: None,
                                section_background_wide: None,
                                section_background_height: None,
                                divider_color: None,
                                divider_width: None,
                                divider_style: None,
                                marker_scheme: None,
                                marker_type: None,
                                marker_text_color: None,
                                point_of_interest_markers: Vec::new(),
                                image360_hotspots: Vec::new(),
                                activity_items: Vec::new(),
                                situational_dialogue_characters: Vec::new(),
                                attachment_files: Vec::new(),
                                quiz: None,
                                find_elements: None,
                                complete: None,
                                card_sort: None,
                                matching: None,
                                marker_popup_width: None,
                                marker_popup_height: None,
                                padding_offset: None,
                                tracking_key: "block_01".to_string(),
                                source_format: None,
                                source_block_type: None,
                                source_raw_html: None,
                                asset_refs: vec!["images/sample.png".to_string()],
                                rich_inline_asset_refs: Vec::new(),
                                subtitle_refs: Vec::new(),
                            }, PaideiaBlock {
                                id: "block_accordion".to_string(),
                                block_type: "accordion".to_string(),
                                family: None,
                                variant: None,
                                title: "AccordÃ©on natif".to_string(),
                                summary: String::new(),
                                content_html: None,
                                quote_author_html: None,
                                quote_show_author: None,
                                html_asset_root: None,
                                html_entry_file: None,
                                html_package_name: None,
                                media_layout: None,
                                image_size: None,
                                content_width: None,
                                content_align: None,
                                media_gap: None,
                                vertical_align: None,
                                image_rounded: None,
                                media_file_name: None,
                                image_crop: None,
                                image_accessibility: None,
                                image_annotation_state_ref: None,
                                image_annotation_source_asset_ref: None,
                                video_caption_color: None,
                                video_caption_background_enabled: None,
                                video_caption_outline: None,
                                video_subtitle_original_ref: None,
                                video_original_asset_ref: None,
                                video_optimized_asset_ref: None,
                                video_optimization_profile: None,
                                video_allow_fullscreen: None,
                                audio_autoplay_next: None,
                                audio_allow_download: None,
                                image360_initial_yaw: None,
                                image360_initial_pitch: None,
                                image360_zoom_enabled: None,
                                image360_full_width: None,
                                image360_allow_fullscreen: None,
                                header_background_color: None,
                                header_text_color: None,
                                header_text_outline: None,
                                header_text_outline_color: None,
                                header_height: None,
                                header_image_position_y: None,
                                button_background_color: None,
                                button_text_color: None,
                                panel_background_color: Some("#fff6d8".to_string()),
                                panel_border_color: Some("#f08a00".to_string()),
                                panel_border_width: Some("0px".to_string()),
                                panel_border_style: Some("dashed".to_string()),
                                panel_padding: None,
                                panel_rounded: Some(true),
                                panel_shadow: Some(true),
                                note_icon: None,
                                note_show_icon: None,
                                note_icon_color: None,
                                note_icon_matches_border: None,
                                flip_card_front_background_color: None,
                                flip_card_back_background_color: None,
                                flip_card_front_border_color: None,
                                flip_card_back_border_color: None,
                                slides_activity_background_color: None,
                                slides_activity_border_color: None,
                                slides_activity_border_width: None,
                                slides_activity_border_style: None,
                                slides_activity_rounded: None,
                                slides_activity_shadow: None,
                                section_background_color: None,
                                section_background_image_ref: None,
                                section_background_opacity: None,
                                section_background_overlay_dark: None,
                                section_background_blur: None,
                                section_background_position_y: None,
                                section_background_rounded: None,
                                section_background_wide: None,
                                section_background_height: None,
                                divider_color: None,
                                divider_width: None,
                                divider_style: None,
                                marker_scheme: None,
                                marker_type: None,
                                marker_text_color: None,
                                point_of_interest_markers: Vec::new(),
                                image360_hotspots: Vec::new(),
                                activity_items: vec![
                                    ActivityItem {
                                        id: "accordion_item_rich".to_string(),
                                        title: "<p><span style=\"color:#f08a00\">Panneau riche</span></p>".to_string(),
                                        kind: Some("step".to_string()),
                                        node_type: None,
                                        character_id: None,
                                        character_name: None,
                                        character_role: None,
                                        situational_dialogue_pose_refs: HashMap::new(),
                                        emotion: None,
                                        next_node_id: None,
                                        responses: Vec::new(),
                                        date_label: None,
                                        content_title: None,
                                        time_color: None,
                                        title_color: None,
                                        accent_color: None,
                                        correct_category_id: None,
                                        card_background_color: None,
                                        card_feedback_html: None,
                                        card_feedback_correct_html: None,
                                        card_feedback_incorrect_html: None,
                                        transcript_html: None,
                                        transcript_language: None,
                                        transcript_source: None,
                                        transcript_status: None,
                                        transcript_allow_download: None,
                                        content_html: "<p>Contenu du panneau riche</p>".to_string(),
                                        asset_refs: vec!["images/sample.png".to_string()],
                                        media_file_name: Some("sample.png".to_string()),
                                        media_layout: Some("image-below".to_string()),
                                        image_size: Some("medium".to_string()),
                                        image_rounded: Some(true),
                                        image_crop: Some(ImageCrop {
                                            x: 12.0,
                                            y: 14.0,
                                            width: 66.0,
                                            height: 44.0,
                                            shape: Some("ellipse".to_string()),
                                        }),
                                        image_accessibility: None,
                                        image_annotation_state_ref: None,
                                        image_annotation_source_asset_ref: None,
                front_type: None,
                front_text: None,
                front_image_asset_ref: None,
                front_image_file_name: None,
                front_image_crop: None,
                front_image_accessibility: None,
                back_type: None,
                back_title: None,
                back_image_asset_ref: None,
                back_image_file_name: None,
                back_image_crop: None,
                back_image_accessibility: None,
                                        resource_url: None,
                                        resource_raw_destination: None,
                                        resource_open_mode: None,
                                        resource_valid: None,
                                    },
                                    ActivityItem {
                                        id: "accordion_item_empty_title".to_string(),
                                        title: String::new(),
                                        kind: Some("step".to_string()),
                                        node_type: None,
                                        character_id: None,
                                        character_name: None,
                                        character_role: None,
                                        situational_dialogue_pose_refs: HashMap::new(),
                                        emotion: None,
                                        next_node_id: None,
                                        responses: Vec::new(),
                                        date_label: None,
                                        content_title: None,
                                        time_color: None,
                                        title_color: None,
                                        accent_color: None,
                                        correct_category_id: None,
                                        card_background_color: None,
                                        card_feedback_html: None,
                                        card_feedback_correct_html: None,
                                        card_feedback_incorrect_html: None,
                                        transcript_html: None,
                                        transcript_language: None,
                                        transcript_source: None,
                                        transcript_status: None,
                                        transcript_allow_download: None,
                                        content_html: "<p>Contenu sans titre saisi</p>".to_string(),
                                        asset_refs: Vec::new(),
                                        media_file_name: None,
                                        media_layout: Some("image-below".to_string()),
                                        image_size: Some("medium".to_string()),
                                        image_rounded: Some(false),
                                        image_crop: None,
                                        image_accessibility: None,
                                        image_annotation_state_ref: None,
                                        image_annotation_source_asset_ref: None,
                                        front_type: None,
                                        front_text: None,
                                        front_image_asset_ref: None,
                                        front_image_file_name: None,
                                        front_image_crop: None,
                                        front_image_accessibility: None,
                                        back_type: None,
                                        back_title: None,
                                        back_image_asset_ref: None,
                                        back_image_file_name: None,
                                        back_image_crop: None,
                                        back_image_accessibility: None,
                                        resource_url: None,
                                        resource_raw_destination: None,
                                        resource_open_mode: None,
                                        resource_valid: None,
                                    },
                                ],
                                situational_dialogue_characters: Vec::new(),
                                attachment_files: Vec::new(),
                                quiz: None,
                                find_elements: None,
                                complete: None,
                                card_sort: None,
                                matching: None,
                                marker_popup_width: None,
                                marker_popup_height: None,
                                padding_offset: None,
                                tracking_key: "block_accordion".to_string(),
                                source_format: None,
                                source_block_type: None,
                                source_raw_html: None,
                                asset_refs: Vec::new(),
                                rich_inline_asset_refs: Vec::new(),
                                subtitle_refs: Vec::new(),
                            },
                            ],
                        }],
                        scorm_tracking: None,
                    }],
                }],
            },
            glossary_assistants: Vec::new(),
            question_banks: Vec::new(),
            reference_banks: Vec::new(),
        };

        let mut resource_block = project.course.modules[0].chapters[0].pages[0].blocks[1].clone();
        resource_block.id = "block_links_resources".to_string();
        resource_block.block_type = "links-resources".to_string();
        resource_block.title = "Ressources utiles".to_string();
        resource_block.activity_items = vec![
            serde_json::from_value(serde_json::json!({
                "id": "resource-official",
                "title": "Documentation officielle",
                "contentHtml": "<p>Consultez la documentation.</p>",
                "resourceUrl": "https://www.example.com/documentation",
                "resourceRawDestination": "Documentation officielle : https://www.example.com/documentation",
                "resourceOpenMode": "new-tab",
                "resourceValid": true
            }))
            .expect("roundtrip resource item")];
        project.course.modules[0].chapters[0].pages[0]
            .blocks
            .push(resource_block);

        let mut flip_cards_block = project.course.modules[0].chapters[0].pages[0].blocks[1].clone();
        flip_cards_block.id = "block_flip_cards".to_string();
        flip_cards_block.block_type = "flip-cards".to_string();
        flip_cards_block.title = "Cartes recto verso".to_string();
        flip_cards_block.activity_items = vec![
            serde_json::from_value(serde_json::json!({
                "id": "card-text-image",
                "title": "Question texte",
                "frontType": "text",
                "frontText": "<p>Question texte</p>",
                "backType": "image",
                "backImageAssetRef": "images/back-roundtrip.png",
                "backImageFileName": "back-roundtrip.png",
                "backImageAccessibility": {
                    "altText": "Réponse illustrée",
                    "decorative": false
                }
            }))
            .expect("roundtrip text/image flip card"),
            serde_json::from_value(serde_json::json!({
                "id": "card-image-text",
                "title": "Question illustrée",
                "frontType": "image",
                "frontImageAssetRef": "images/front-roundtrip.png",
                "frontImageFileName": "front-roundtrip.png",
                "frontImageCrop": {
                    "x": 10.0,
                    "y": 15.0,
                    "width": 80.0,
                    "height": 70.0,
                    "shape": "rectangle"
                },
                "frontImageAccessibility": {
                    "altText": "Question illustrée",
                    "decorative": false
                },
                "backType": "text",
                "contentHtml": "<p>Réponse texte</p>"
            }))
            .expect("roundtrip image/text flip card"),
        ];
        project.course.modules[0].chapters[0].pages[0]
            .blocks
            .push(flip_cards_block);

        let file = fs::File::create(&source_zip).expect("create source zip");
        let mut zip = ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
        zip.start_file("metadata/paideia-export.json", options)
            .expect("metadata entry");
        zip.write_all(
            br#"{"generator":"PAIDEIA","generator_version":"test","source_project_title":"Roundtrip Source"}"#)
        .expect("metadata bytes");
        zip.start_file("metadata/paideia-project.json", options)
            .expect("project entry");
        zip.write_all(
            serde_json::to_string_pretty(&serde_json::json!({
                "schemaVersion": 2,
                "generator": "PAIDEIA",
                "generatorVersion": "test",
                "createdWith": "PAIDEIA",
                "exportDate": Utc::now().to_rfc3339(),
                "payloadType": "PaideiaProject",
                "payload": project
            }))
            .expect("project json")
            .as_bytes(),
        )
        .expect("project bytes");
        zip.start_file("assets/images/sample.png", options)
            .expect("asset entry");
        zip.write_all(b"fake-png").expect("asset bytes");
        zip.start_file("assets/images/front-roundtrip.png", options)
            .expect("front flip card asset entry");
        zip.write_all(b"fake-front-png")
            .expect("front flip card asset bytes");
        zip.start_file("assets/images/back-roundtrip.png", options)
            .expect("back flip card asset entry");
        zip.write_all(b"fake-back-png")
            .expect("back flip card asset bytes");
        zip.finish().expect("finish zip");

        let imported_root = import_scorm_zip_with_details(
            source_zip.to_string_lossy().as_ref(),
            destination_root.to_string_lossy().as_ref(),
        )
        .expect("paideia scorm should import")
        .project_root;
        let restored = crate::repository::load_project_from_path(&imported_root.to_string_lossy())
            .expect("restored project should load");
        assert_eq!(restored.title, "Roundtrip Source");
        assert_eq!(restored.activity_spacing_px, Some(36));
        assert_eq!(
            restored.course.modules[0].chapters[0].pages[0].blocks[0].block_type,
            "image"
        );
        assert_eq!(
            restored.course.modules[0].chapters[0].pages[0].blocks[0]
                .image_crop
                .as_ref()
                .expect("crop should survive")
                .x,
            10.0
        );
        assert_eq!(
            restored.course.modules[0].chapters[0].pages[0].blocks[0]
                .panel_border_style
                .as_deref(),
            Some("none")
        );
        let restored_accordion = &restored.course.modules[0].chapters[0].pages[0].blocks[1];
        assert_eq!(restored_accordion.block_type, "accordion");
        assert_eq!(
            restored_accordion.panel_background_color.as_deref(),
            Some("#fff6d8")
        );
        assert_eq!(
            restored_accordion.panel_border_color.as_deref(),
            Some("#f08a00")
        );
        assert_eq!(
            restored_accordion.panel_border_width.as_deref(),
            Some("0px")
        );
        assert_eq!(
            restored_accordion.panel_border_style.as_deref(),
            Some("dashed")
        );
        assert_eq!(restored_accordion.panel_rounded, Some(true));
        assert_eq!(restored_accordion.panel_shadow, Some(true));
        assert_eq!(
            restored_accordion.activity_items[0].title,
            "<p><span style=\"color:#f08a00\">Panneau riche</span></p>"
        );
        assert_eq!(restored_accordion.activity_items[1].title, "");
        assert_eq!(
            restored_accordion.activity_items[0]
                .image_crop
                .as_ref()
                .unwrap()
                .shape
                .as_deref(),
            Some("ellipse")
        );
        let restored_resources = &restored.course.modules[0].chapters[0].pages[0].blocks[2];
        assert_eq!(restored_resources.block_type, "links-resources");
        assert_eq!(restored_resources.activity_items[0].title, "Documentation officielle");
        assert_eq!(
            restored_resources.activity_items[0].resource_url.as_deref(),
            Some("https://www.example.com/documentation")
        );
        assert_eq!(restored_resources.activity_items[0].resource_valid, Some(true));
        let restored_flip_cards = &restored.course.modules[0].chapters[0].pages[0].blocks[3];
        assert_eq!(restored_flip_cards.block_type, "flip-cards");
        assert_eq!(
            restored_flip_cards.activity_items[0].back_image_asset_ref.as_deref(),
            Some("images/back-roundtrip.png")
        );
        assert_eq!(
            restored_flip_cards.activity_items[1].front_image_asset_ref.as_deref(),
            Some("images/front-roundtrip.png")
        );
        assert_eq!(
            restored_flip_cards.activity_items[1]
                .front_image_crop
                .as_ref()
                .map(|crop| crop.x),
            Some(10.0)
        );
        assert_eq!(
            restored_flip_cards.activity_items[1].content_html,
            "<p>Réponse texte</p>"
        );
        assert_eq!(
            restored_accordion.activity_items[0].image_rounded,
            Some(true)
        );
        assert!(imported_root.join("assets/images/sample.png").exists());
        assert!(imported_root
            .join("assets/images/front-roundtrip.png")
            .exists());
        assert!(imported_root
            .join("assets/images/back-roundtrip.png")
            .exists());
        assert!(!imported_root.join("imports/rise-import-report.json").exists());
        assert!(!imported_root.join("imports/rematching-report.json").exists());
        assert!(!imported_root.join("log-import.md").exists());

        let _ = fs::remove_dir_all(temp_root);
    }

    #[test]
    fn paideia_signed_scorm_never_falls_back_to_rise_when_snapshot_is_missing() {
        let temp_root = std::env::temp_dir().join(format!(
            "paideia-no-rise-fallback-test-{}",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let source_zip = temp_root.join("source.zip");
        let destination_root = temp_root.join("destination");
        fs::create_dir_all(&temp_root).expect("create temp root");

        let file = fs::File::create(&source_zip).expect("create source zip");
        let mut zip = ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
        zip.start_file("metadata/paideia-export.json", options)
            .expect("metadata entry");
        zip.write_all(
            br#"{"generator":"PAIDEIA","generator_version":"test","source_project_title":"Roundtrip Source"}"#)
        .expect("metadata bytes");
        zip.start_file("index.html", options).expect("index entry");
        zip.write_all(b"<html><body>Not a Rise payload</body></html>")
            .expect("index bytes");
        zip.finish().expect("finish zip");

        let error = import_scorm_zip_with_details(
            source_zip.to_string_lossy().as_ref(),
            destination_root.to_string_lossy().as_ref(),
        )
        .expect_err("signed PAIDEIA SCORM without native snapshot must fail");
        assert!(
            error.contains("Aucun fallback Rise"),
            "unexpected import error: {error}"
        );

        let _ = fs::remove_dir_all(temp_root);
    }

    #[test]
    fn detects_rise_course_cover_image() {
        let course = serde_json::json!({
            "coverImage": {
                "media": {
                    "image": {
                        "crushedKey": "rise-cover.jpg"
                    }
                }
            }
        });
        let available_assets = vec!["rise-cover.jpg".to_string()];

        assert_eq!(
            detect_course_image_asset_ref(&course, &available_assets),
            Some("images/scorm/rise-cover.jpg".to_string())
        );
    }

    #[test]
    fn maps_rise_payload_to_paideia_project() {
        let sample_index =
            PathBuf::from("C:/tmp/paideia_rise_scorm_sample/scormcontent/index.html");
        if !sample_index.exists() {
            return;
        }

        let payload = extract_rise_course_payload(&sample_index).expect("payload should decode");
        let (project, report, _) = map_rise_json_to_project(
            &payload,
            "connexion-et-interface",
            "Connexion et interface",
            &[],
        )
        .expect("mapping should work");

        assert_eq!(project.title, "Connexion et interface");
        assert_eq!(project.course.modules.len(), 1);
        assert_eq!(project.course.modules[0].chapters.len(), 2);
        assert!(report.summary.blocks_detected >= 20);
        assert!(report.summary.blocks_mapped_exactly > 0);
    }

    #[test]
    fn rise_import_uses_inter_as_the_lesson_font() {
        let payload = serde_json::json!({
            "course": {
                "title": "Police Inter",
                "lessons": []
            }
        });
        let (mut project, _, _) = map_rise_json_to_project(
            &payload,
            "police-inter",
            "Police Inter",
            &[])
        .expect("minimal Rise project should map");
        let root = std::env::temp_dir().join(format!(
            "paideia-rise-inter-font-{}-{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));

        install_rise_default_inter_font(&root, &mut project)
            .expect("Inter should be installed in the imported project");

        let font = project.custom_font.as_ref().expect("Inter descriptor");
        assert_eq!(font.id, "inter");
        assert_eq!(font.font_family, "Inter");
        assert_eq!(font.faces.len(), 6);
        assert!(root.join("assets/fonts/inter/Inter-Regular.woff2").is_file());
        assert!(root.join("assets/fonts/inter/OFL.txt").is_file());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn injects_navigation_between_chapters_and_exits_after_the_final_chapter() {
        let payload = serde_json::json!({
            "course": {
                "lessons": [
                    {
                        "title": "Premier chapitre",
                        "items": [{
                            "family": "text",
                            "variant": "paragraph",
                            "type": "text",
                            "items": [{ "paragraph": "<p>Contenu 1</p>" }]
                        }]
                    },
                    {
                        "title": "Dernier chapitre",
                        "items": [{
                            "family": "text",
                            "variant": "paragraph",
                            "type": "text",
                            "items": [{ "paragraph": "<p>Contenu 2</p>" }]
                        }]
                    }
                ]
            }
        });

        let (project, report, _) = map_rise_json_to_project(
            &payload,
            "navigation-injected",
            "Navigation injectée",
            &[])
        .expect("mapping should inject navigation");
        let chapters = &project.course.modules[0].chapters;

        assert_eq!(chapters[0].pages[0].blocks.last().map(|block| block.block_type.as_str()), Some("continue"));
        assert_eq!(chapters[1].pages[0].blocks.last().map(|block| block.block_type.as_str()), Some("course-exit"));
        assert!(report.rematching.iter().any(|entry| entry.source_variant == "injected-continue"));
        assert!(report.rematching.iter().any(|entry| entry.source_variant == "injected-course-exit" && entry.mapped_to == "course-exit"));
    }

    #[test]
    fn rematches_styled_continue_as_native_plain_navigation() {
        let item = serde_json::json!({
            "family": "continue", "variant": "continue", "type": "continue",
            "settings": { "backgroundColor": "#ff0000", "fontSize": "32px" },
            "items": [{
                "title": "<span style=\"font-family:Georgia;font-size:32px\">Étape suivante</span>",
                "paragraph": "<p style=\"color:red\">Source navigation message</p>"
            }]
        });
        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        assert_eq!(mapped.block.block_type, "continue");
        assert_eq!(mapped.block.summary, "Étape suivante");
        assert!(mapped.block.content_html.is_none());
        assert!(mapped.block.source_raw_html.is_none());
        assert!(mapped.block.button_background_color.is_none());
        assert!(mapped.block.button_text_color.is_none());
    }

    #[test]
    fn rematches_an_existing_final_rise_continue_to_the_course_exit() {
        let payload = serde_json::json!({
            "course": {
                "lessons": [{
                    "title": "Dernier chapitre",
                    "items": [
                        {
                            "family": "text",
                            "variant": "paragraph",
                            "type": "text",
                            "items": [{ "paragraph": "<p>Fin du contenu</p>" }]
                        },
                        {
                            "family": "continue",
                            "variant": "continue",
                            "type": "continue",
                            "items": []
                        }
                    ]
                }]
            }
        });

        let (project, report, _) = map_rise_json_to_project(
            &payload,
            "final-rise-continue",
            "Fin Rise",
            &[])
        .expect("mapping should rematch final Rise continue");
        let blocks = &project.course.modules[0].chapters[0].pages[0].blocks;

        assert_eq!(blocks.len(), 2);
        assert_eq!(blocks.last().map(|block| block.block_type.as_str()), Some("course-exit"));
        assert!(report.rematching.iter().any(|entry| entry.mapped_to == "course-exit"));
        assert!(!report.rematching.iter().any(|entry| entry.source_variant == "injected-course-exit"));
    }

    #[test]
    fn keeps_contiguous_rise_knowledge_checks_as_independent_questions() {
        let knowledge_check = |id: &str, corrects: Vec<&str>| {
            serde_json::json!({
                "type": "knowledgeCheck",
                "family": "knowledgeCheck",
                "variant": "multiple response",
                "settings": { "requireCorrectAnswer": true },
                "items": [{
                    "id": id,
                    "type": "MULTIPLE_RESPONSE",
                    "title": format!("<p>Question {id}</p>"),
                    "corrects": corrects,
                    "answers": [
                        { "id": "a1", "title": "<p>Choix 1</p>" },
                        { "id": "a2", "title": "<p>Choix 2</p>" },
                        { "id": "a3", "title": "<p>Choix 3</p>" }
                    ]
                }]
            })
        };
        let payload = serde_json::json!({
            "course": {
                "lessons": [{
                    "title": "Mini-quiz",
                    "items": [
                        knowledge_check("q1", vec!["a1"]),
                        knowledge_check("q2", vec!["a1", "a3"]),
                        knowledge_check("q3", vec!["a2"])
                    ]
                }]
            }
        });

        let (project, report, _) = map_rise_json_to_project(
            &payload,
            "grouped-knowledge-checks",
            "Knowledge checks groupés",
            &[],
        )
        .expect("contiguous knowledge checks should stay independent");
        let blocks = &project.course.modules[0].chapters[0].pages[0].blocks;
        let question_blocks = blocks
            .iter()
            .filter(|block| block.block_type == "question-multiple")
            .collect::<Vec<_>>();

        assert_eq!(question_blocks.len(), 3);
        for block in question_blocks {
            let quiz = block.quiz.as_ref().expect("question data");
            assert_eq!(quiz.questions.len(), 1);
            assert_eq!(quiz.questions[0].mode, "multiple");
            assert_eq!(quiz.settings.passing_score, 0.0);
            assert_eq!(quiz.settings.max_attempts, 0);
            assert!(!quiz.settings.gate_chapter_until_passed);
            assert!(!quiz.settings.send_score_to_lms);
        }
        assert_eq!(
            report
                .rematching
                .iter()
                .filter(|entry| entry.status == "grouped")
                .count(),
            0
        );
        assert!(!report.issues.iter().any(|issue| issue.message.contains("Knowledge Check consécutifs")));
    }

    #[test]
    fn does_not_group_rise_knowledge_checks_separated_by_learning_content() {
        let knowledge_check = |id: &str| {
            serde_json::json!({
                "type": "knowledgeCheck",
                "family": "knowledgeCheck",
                "variant": "multiple choice",
                "settings": { "requireCorrectAnswer": true },
                "items": [{
                    "id": id,
                    "type": "MULTIPLE_CHOICE",
                    "title": format!("<p>Question {id}</p>"),
                    "correct": "a1",
                    "answers": [
                        { "id": "a1", "title": "<p>Oui</p>" },
                        { "id": "a2", "title": "<p>Non</p>" }
                    ]
                }]
            })
        };
        let payload = serde_json::json!({
            "course": {
                "lessons": [{
                    "title": "Questions séparées",
                    "items": [
                        knowledge_check("q1"),
                        {
                            "type": "text",
                            "family": "text",
                            "variant": "paragraph",
                            "items": [{ "paragraph": "<p>Contenu intermédiaire</p>" }]
                        },
                        knowledge_check("q2")
                    ]
                }]
            }
        });

        let (project, report, _) = map_rise_json_to_project(
            &payload,
            "separated-knowledge-checks",
            "Knowledge checks séparés",
            &[],
        )
        .expect("separated knowledge checks should remain separate");
        let blocks = &project.course.modules[0].chapters[0].pages[0].blocks;

        assert_eq!(
            blocks
                .iter()
                .filter(|block| block.block_type == "question-unique")
                .count(),
            2
        );
        assert!(!report
            .rematching
            .iter()
            .any(|entry| entry.status == "grouped"));
    }

    #[test]
    fn rematches_rise_multiple_choice_knowledge_check_to_single_question() {
        let item = serde_json::json!({
            "type": "knowledgeCheck",
            "family": "knowledgeCheck",
            "variant": "multiple choice",
            "items": [{
                "id": "rise-qcm-1",
                "type": "MULTIPLE_CHOICE",
                "title": "<p>Quelle est la bonne reponse ?</p>",
                "feedback": "<p>Feedback global</p>",
                "feedbackCorrect": "<p>Bravo</p>",
                "feedbackIncorrect": "<p>A revoir</p>",
                "correct": "a2",
                "answers": [
                    { "id": "a1", "title": "<p>Choix 1</p>" },
                    { "id": "a2", "title": "<p>Choix 2</p>" }
                ]
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        let quiz = mapped.block.quiz.expect("quiz should be rematched");
        let question = quiz.questions.first().expect("one question should exist");

        assert_eq!(mapped.block.block_type, "question-unique");
        assert_eq!(mapped.mapping_quality, "exact");
        assert_eq!(question.mode, "single");
        assert!(question
            .feedback_correct_html
            .as_deref()
            .unwrap_or_default()
            .contains("Bravo"));
        assert!(question
            .feedback_incorrect_html
            .as_deref()
            .unwrap_or_default()
            .contains("A revoir"));
        assert!(question
            .general_feedback_html
            .as_deref()
            .unwrap_or_default()
            .contains("Feedback global"));
        assert_eq!(question.answers.len(), 2);
        assert!(question.answers[1].correct);
        assert!(!question.answers[0].correct);
    }

    #[test]
    fn rematches_single_choice_feedback_by_choice_to_paideia_positive_negative_feedback() {
        let item = serde_json::json!({
            "type": "knowledgeCheck",
            "family": "knowledgeCheck",
            "variant": "multiple choice",
            "items": [{
                "id": "rise-qcu-1",
                "type": "MULTIPLE_CHOICE",
                "feedbackType": "CHOICE",
                "title": "<p>Question binaire</p>",
                "correct": "a2",
                "answers": [
                    { "id": "a1", "title": "<p>Vrai</p>", "feedback": "<p>Non, ce n'est pas exact.</p>" },
                    { "id": "a2", "title": "<p>Faux</p>", "feedback": "<p>Oui, c'est bien cela.</p>" }
                ]
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 2, &[]);
        let quiz = mapped.block.quiz.expect("quiz should be rematched");
        let question = quiz.questions.first().expect("one question should exist");

        assert_eq!(mapped.mapping_quality, "exact");
        assert_eq!(mapped.rematching.status, "exact");
        assert!(!mapped
            .rematching
            .missing_properties
            .contains(&"Feedback par choix Rise (attente eval)".to_string()));
        assert_eq!(mapped.block.block_type, "question-true-false");
        assert_eq!(question.mode, "true-false");
        assert!(question
            .feedback_correct_html
            .as_deref()
            .unwrap_or_default()
            .contains("Oui, c'est bien cela"));
        assert!(question
            .feedback_incorrect_html
            .as_deref()
            .unwrap_or_default()
            .contains("Non, ce n'est pas exact"));
        assert!(question.general_feedback_html.is_none());
        assert!(question.answers[0].feedback_html.as_deref().unwrap_or_default().contains("Non, ce n'est pas exact"));
        assert!(question.answers[1].feedback_html.as_deref().unwrap_or_default().contains("Oui, c'est bien cela"));
    }

    #[test]
    fn preserves_distinct_rise_answer_feedback_without_claiming_exact_activity_rendering() {
        let source = serde_json::json!({
            "id": "rise-three-choices",
            "type": "MULTIPLE_CHOICE",
            "feedbackType": "CHOICE",
            "title": "<p>Question</p>",
            "correct": "a1",
            "answers": [
                { "id": "a1", "title": "<p>Bonne</p>", "feedback": "<p>Bravo</p>" },
                { "id": "a2", "title": "<p>Erreur A</p>", "feedback": "<p>Explication A</p>" },
                { "id": "a3", "title": "<p>Erreur B</p>", "feedback": "<p>Explication B</p>" }
            ]
        });
        let (question, approximate) = build_rise_quiz_question(&source, None);
        assert!(approximate);
        assert_eq!(question.answers.len(), 3);
        assert!(question.answers[1].feedback_html.as_deref().unwrap_or_default().contains("Explication A"));
        assert!(question.answers[2].feedback_html.as_deref().unwrap_or_default().contains("Explication B"));
    }

    #[test]
    fn explicit_single_correct_id_overrides_inconsistent_answer_correct_flags() {
        let item = serde_json::json!({
            "type": "knowledgeCheck",
            "family": "knowledgeCheck",
            "variant": "multiple choice",
            "items": [{
                "id": "rise-qcu-2",
                "type": "MULTIPLE_CHOICE",
                "feedbackType": "CHOICE",
                "title": "<p>Question incoherente</p>",
                "correct": "a2",
                "answers": [
                    { "id": "a1", "title": "<p>Vrai</p>", "correct": true, "feedback": "<p>Incorrect</p>" },
                    { "id": "a2", "title": "<p>Faux</p>", "correct": true, "feedback": "<p>Correct</p>" }
                ]
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 3, &[]);
        let quiz = mapped.block.quiz.expect("quiz should be rematched");
        let question = quiz.questions.first().expect("one question should exist");

        assert_eq!(question.answers.len(), 2);
        assert!(!question.answers[0].correct);
        assert!(question.answers[1].correct);
        assert_eq!(
            question.feedback_correct_html.as_deref(),
            Some("<div style=\"font-size: 18px;\"><p>Correct</p></div>")
        );
        assert_eq!(
            question.feedback_incorrect_html.as_deref(),
            Some("<div style=\"font-size: 18px;\"><p>Incorrect</p></div>")
        );
    }

    #[test]
    fn flags_choice_feedback_and_random_draw_for_rise_question_bank() {
        let item = serde_json::json!({
            "type": "knowledgeCheck",
            "family": "knowledgeCheck",
            "variant": "draw from question bank",
            "items": [{
                "id": "rise-bank-1",
                "type": "DRAW_FROM_QUESTION_BANK",
                "drawCount": 1,
                "questions": [{
                    "id": "rise-qcu-1",
                    "type": "MULTIPLE_RESPONSE",
                    "title": "<p>Choisissez les bonnes reponses</p>",
                    "feedback": "<p>Feedback general banque</p>",
                    "corrects": ["a1", "a3"],
                    "answers": [
                        { "id": "a1", "title": "<p>Choix 1</p>", "feedback": "<p>Feedback choix 1</p>" },
                        { "id": "a2", "title": "<p>Choix 2</p>" },
                        { "id": "a3", "title": "<p>Choix 3</p>" }
                    ]
                }]
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 2, &[]);
        let quiz = mapped.block.quiz.expect("quiz should be rematched");
        let question = quiz
            .questions
            .first()
            .expect("one bank question should exist");

        assert_eq!(mapped.block.block_type, "question-random");
        assert_eq!(mapped.mapping_quality, "approximate");
        assert_eq!(mapped.rematching.status, "partial");
        assert!(!mapped
            .rematching
            .missing_properties
            .contains(&"Tirage aleatoire Rise".to_string()));
        assert!(mapped
            .rematching
            .missing_properties
            .contains(&"Feedback par choix Rise (attente eval)".to_string()));
        assert_eq!(question.mode, "multiple");
        assert_eq!(question.source_bank_id.as_deref(), Some("rise-bank-rise-bank-1-"));
        assert!(question
            .general_feedback_html
            .as_deref()
            .unwrap_or_default()
            .contains("Feedback general banque"));
        assert!(question.answers[0].correct);
        assert!(!question.answers[1].correct);
        assert!(question.answers[2].correct);
    }

    #[test]
    fn imports_rise_draw_as_random_questions_and_a_project_bank() {
        let payload = serde_json::json!({
            "course": { "lessons": [{
                "title": "Banque",
                "type": "blocks",
                "items": [{
                    "type": "knowledgeCheck",
                    "family": "knowledgeCheck",
                    "variant": "draw from question bank",
                    "items": [{
                        "id": "draw-1",
                        "type": "DRAW_FROM_QUESTION_BANK",
                        "drawCount": 1,
                        "questionBankId": "bank-1",
                        "questionBankTitle": "GesTT",
                        "questionBankUpdatedAt": "07/04/2026 13:06:10",
                        "questions": [{
                            "id": "q1", "type": "MULTIPLE_CHOICE", "title": "<p>Affirmation</p>",
                            "correct": "a1",
                            "answers": [{"id":"a1","title":"<p>Vrai</p>"},{"id":"a2","title":"<p>Faux</p>"}]
                        }, {
                            "id": "q2", "type": "MULTIPLE_RESPONSE", "title": "<p>Choisir</p>",
                            "corrects": ["b1", "b2"],
                            "answers": [{"id":"b1","title":"<p>A</p>"},{"id":"b2","title":"<p>B</p>"}]
                        }]
                    }]
                }]
            }] }
        });
        let (project, report, _) = map_rise_json_to_project(&payload, "bank", "Banque", &[]).unwrap();
        let bank = &project.question_banks[0];
        assert_eq!(bank.name, "GesTT");
        assert_eq!(bank.questions.len(), 2);
        assert_eq!(bank.questions[0].question.mode, "true-false");
        let block = &project.course.modules[0].chapters[0].pages[0].blocks[0];
        assert_eq!(block.block_type, "question-random");
        let activity = block.quiz.as_ref().unwrap();
        assert_eq!(activity.questions.len(), 2);
        assert_eq!(activity.settings.question_limit, 1);
        assert!(activity.settings.limit_questions);
        assert!(!activity.settings.gate_chapter_until_passed);
        assert_eq!(activity.questions[0].source_bank_id.as_deref(), Some(bank.id.as_str()));
        assert!(report.rematching.iter().any(|entry| entry.mapped_to == "question-random"));
    }

    #[test]
    fn multiple_response_prefers_corrects_over_stale_single_correct_id() {
        let lesson = serde_json::json!({
            "title": "Quiz final",
            "type": "quiz",
            "items": [
                {
                    "id": "q-multi-1",
                    "type": "MULTIPLE_RESPONSE",
                    "title": "<p>Question multi</p>",
                    "correct": "a1",
                    "corrects": ["a2", "a3"],
                    "answers": [
                        { "id": "a1", "title": "<p>Choix 1</p>" },
                        { "id": "a2", "title": "<p>Choix 2</p>" },
                        { "id": "a3", "title": "<p>Choix 3</p>" }
                    ]
                }
            ]
        });

        let mapped = map_rise_quiz_lesson_to_block(&lesson, 4);
        let quiz = mapped.block.quiz.expect("lesson quiz should be rematched");
        let question = quiz.questions.first().expect("one question should exist");

        assert_eq!(question.mode, "multiple");
        assert!(!question.answers[0].correct);
        assert!(question.answers[1].correct);
        assert!(question.answers[2].correct);
    }

    #[test]
    fn rematches_rise_quiz_lesson_without_enabling_scorm_score_push() {
        let lesson = serde_json::json!({
            "title": "Quiz final",
            "type": "quiz",
            "description": "<p>Introduction du quiz</p>",
            "settings": {
                "retryCount": 2,
                "passingScore": 75,
                "revealAnswers": "all",
                "shuffleAnswerChoices": true,
                "randomizeQuestionOrder": true
            },
            "items": [
                {
                    "id": "q1",
                    "type": "MULTIPLE_CHOICE",
                    "title": "<p>Question 1</p>",
                    "feedbackCorrect": "<p>Correct 1</p>",
                    "feedbackIncorrect": "<p>Incorrect 1</p>",
                    "feedback": "<p>General 1</p>",
                    "correct": "q1-a2",
                    "answers": [
                        { "id": "q1-a1", "title": "<p>A</p>" },
                        { "id": "q1-a2", "title": "<p>B</p>" }
                    ]
                },
                {
                    "id": "bank-2",
                    "type": "DRAW_FROM_QUESTION_BANK",
                    "drawCount": 1,
                    "questions": [{
                        "id": "q2",
                        "type": "MULTIPLE_RESPONSE",
                        "title": "<p>Question 2</p>",
                        "corrects": ["q2-a1"],
                        "answers": [
                            { "id": "q2-a1", "title": "<p>Oui</p>" },
                            { "id": "q2-a2", "title": "<p>Non</p>" }
                        ]
                    }]
                }
            ]
        });

        let mapped = map_rise_quiz_lesson_to_block(&lesson, 3);
        let quiz = mapped.block.quiz.expect("lesson quiz should be rematched");

        assert_eq!(mapped.block.block_type, "quiz");
        assert_eq!(mapped.mapping_quality, "approximate");
        assert_eq!(mapped.rematching.status, "partial");
        assert_eq!(quiz.questions.len(), 2);
        assert_eq!(quiz.title_html, "<p>Quiz final</p>");
        assert!(quiz.intro_html.contains("Introduction du quiz"));
        assert_eq!(quiz.questions[0].mode, "single");
        assert_eq!(quiz.questions[1].mode, "multiple");
        assert!(quiz.questions[0]
            .general_feedback_html
            .as_deref()
            .unwrap_or_default()
            .contains("General 1"));
        assert_eq!(quiz.questions[1].source_bank_id.as_deref(), Some("bank-2"));
        assert!(quiz.settings.shuffle_answers);
        assert!(quiz.settings.shuffle_questions);
        assert!(quiz.settings.show_correct_answer);
        assert_eq!(quiz.settings.max_attempts, 3);
        assert_eq!(quiz.settings.passing_score, 75.0);
        assert!(!quiz.settings.send_score_to_lms);
        assert!(quiz.settings.gate_chapter_until_passed);
        assert!(mapped
            .rematching
            .missing_properties
            .contains(&"Tirage aleatoire Rise".to_string()));
    }

    #[test]
    fn converts_rise_flashcard_dimensions_to_paideia_crop() {
        let item = serde_json::json!({
            "front": {
                "media": {
                    "image": {
                        "key": "source.png",
                        "dimensions": {
                            "top": 100,
                            "left": 200,
                            "width": 400,
                            "height": 300,
                            "originalWidth": 1000,
                            "originalHeight": 600
                        }
                    }
                }
            },
            "back": {"description": "<p>Dos</p>"}
        });

        let cards = extract_flashcard_activity_items(&[item], &["source.png".to_string()]);
        let crop = cards[0]
            .front_image_crop
            .as_ref()
            .expect("crop should be imported");
        assert!((crop.x - 20.0).abs() < 0.01);
        assert!((crop.y - 16.666_666).abs() < 0.01);
        assert!((crop.width - 40.0).abs() < 0.01);
        assert!((crop.height - 50.0).abs() < 0.01);
    }

    #[test]
    fn prefers_rise_card_derivative_without_double_crop() {
        let item = serde_json::json!({
            "front": {
                "media": {
                    "image": {
                        "crushedKey": "card-01/cropped.jpg",
                        "dimensions": {
                            "top": 100,
                            "left": 200,
                            "width": 400,
                            "height": 300,
                            "originalWidth": 1000,
                            "originalHeight": 600
                        }
                    }
                }
            },
            "back": {"description": "<p>Dos</p>"}
        });

        let cards = extract_flashcard_activity_items(
            &[item],
            &["card-01/cropped.jpg".to_string(), "source.png".to_string()],
        );
        assert_eq!(
            cards[0].front_image_asset_ref.as_deref(),
            Some("images/scorm/card-01/cropped.jpg")
        );
        assert!(cards[0].front_image_crop.is_none());
    }

    #[test]
    fn keeps_text_only_flashcard_fronts_as_text_when_the_parent_has_an_image() {
        let item = serde_json::json!({
            "front": {"title": "Texte de face avant"},
            "back": {"description": "<p>Dos</p>"},
            "background": {"image": {"key": "shared-background.jpg"}}
        });

        let cards = extract_flashcard_activity_items(&[item], &["shared-background.jpg".to_string()]);
        assert_eq!(cards[0].front_type.as_deref(), Some("text"));
        assert_eq!(
            cards[0].front_text.as_deref(),
            Some("<p style=\"font-size: 18px;\">Texte de face avant</p>")
        );
        assert!(cards[0].asset_refs.is_empty());
    }

    #[test]
    fn keeps_flashcard_text_fronts_as_text_when_rise_carries_a_shared_media_image() {
        let item = serde_json::json!({
            "front": {
                "title": "Texte de face avant",
                "media": {"image": {"key": "shared-background.jpg"}}
            },
            "back": {"description": "<p>Dos</p>"}
        });

        let cards = extract_flashcard_activity_items(&[item], &["shared-background.jpg".to_string()]);
        assert_eq!(cards[0].front_type.as_deref(), Some("text"));
        assert_eq!(
            cards[0].front_text.as_deref(),
            Some("<p style=\"font-size: 18px;\">Texte de face avant</p>")
        );
        assert!(cards[0].asset_refs.is_empty());
    }

    #[test]
    fn keeps_explicit_image_flashcard_fronts_as_images_when_they_have_a_title() {
        let item = serde_json::json!({
            "front": {
                "type": "image",
                "title": "Une vraie image de carte",
                "media": {"image": {"key": "card-photo.jpg"}}
            },
            "back": {"description": "<p>Dos</p>"}
        });

        let cards = extract_flashcard_activity_items(&[item], &["card-photo.jpg".to_string()]);
        assert_eq!(cards[0].front_type.as_deref(), Some("image"));
        assert_eq!(
            cards[0].front_image_asset_ref.as_deref(),
            Some("images/scorm/card-photo.jpg")
        );
    }

    #[test]
    fn rematches_rise_flashcard_faces_independently_as_text_or_image() {
        let items = vec![
            serde_json::json!({
                "front": {"text": "Question texte"},
                "back": {
                    "type": "image",
                    "media": {"image": {"key": "back-photo.jpg"}},
                    "alt": "Illustration de réponse"
                }
            }),
            serde_json::json!({
                "front": {
                    "type": "image",
                    "media": {"image": {"key": "front-photo.jpg"}},
                    "alt": "Illustration de question"
                },
                "back": {"text": "Réponse texte"}
            }),
            serde_json::json!({
                "front": {
                    "type": "image",
                    "media": {"image": {"key": "front-both.jpg"}}
                },
                "back": {
                    "type": "image",
                    "media": {"image": {"key": "back-both.jpg"}}
                }
            }),
        ];

        let cards = extract_flashcard_activity_items(
            &items,
            &[
                "back-photo.jpg".to_string(),
                "front-photo.jpg".to_string(),
                "front-both.jpg".to_string(),
                "back-both.jpg".to_string(),
            ],
        );

        assert_eq!(cards[0].front_type.as_deref(), Some("text"));
        assert_eq!(cards[0].back_type.as_deref(), Some("image"));
        assert_eq!(
            cards[0].back_image_asset_ref.as_deref(),
            Some("images/scorm/back-photo.jpg")
        );
        assert_eq!(cards[0].back_image_file_name.as_deref(), Some("back-photo.jpg"));
        assert_eq!(
            cards[0]
                .back_image_accessibility
                .as_ref()
                .map(|accessibility| accessibility.alt_text.as_str()),
            Some("Illustration de réponse")
        );
        assert_eq!(cards[1].front_type.as_deref(), Some("image"));
        assert_eq!(
            cards[1].front_image_asset_ref.as_deref(),
            Some("images/scorm/front-photo.jpg")
        );
        assert_eq!(cards[1].back_type.as_deref(), Some("text"));
        assert_eq!(
            cards[1].content_html,
            "<p style=\"font-size: 18px;\">Réponse texte</p>"
        );
        assert_eq!(cards[2].front_type.as_deref(), Some("image"));
        assert_eq!(cards[2].back_type.as_deref(), Some("image"));
        assert_eq!(
            cards[2].asset_refs,
            vec![
                "images/scorm/front-both.jpg",
                "images/scorm/back-both.jpg"
            ]
        );
    }

    #[test]
    fn maps_rise_inline_html_to_native_custom_html() {
        let item = serde_json::json!({
            "family": "html",
            "variant": "inline",
            "type": "html",
            "settings": {"width": "2", "height": 300, "autoResize": true},
            "items": [{"srcdoc": "<button>Tester</button>"}]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        assert_eq!(mapped.block.block_type, "html-custom");
        assert_eq!(
            mapped.block.content_html.as_deref(),
            Some("<button>Tester</button>")
        );
        assert_eq!(mapped.block.media_layout.as_deref(), Some("activity-width"));
        assert_eq!(mapped.rematching.status, "exact");
        assert!(mapped.html_artifact.is_some());
    }

    #[test]
    fn maps_rise_line_chart_to_useful_accessible_html_fallback() {
        let item = serde_json::json!({
            "family": "chart",
            "variant": "line",
            "type": "chart",
            "title": "<p><span style=\"color: rgb(36, 103, 178); font-size: 20px;\">&Eacute;volution des d&eacute;bits en Mo/s en fonction de la norme USB</span></p>",
            "itemsLabel": "Norme",
            "valuesLabel": "Debit en Mo/s",
            "settings": {
                "chartColor": "#285f9f",
                "paddingTop": 10,
                "paddingBottom": 3,
                "lineCurve": "linear",
                "entranceAnimation": true
            },
            "items": [
                {"type": "USB 1.0", "value": "0.2", "color": "#ff6602"},
                {"type": "USB 1.1", "value": "1.5", "color": "#eb524d"},
                {"type": "USB 2.0", "value": "60", "color": "#730300"},
                {"type": "USB 3.1 Gen 1", "value": "600", "color": "#9764ae"},
                {"type": "USB 3.1 Gen 2", "value": "1200", "color": "#730676"},
                {"type": "USB 3.2", "value": "2500", "color": "#3c003e"},
                {"type": "USB 4", "value": "5000", "color": "#4399ea"}
            ]
        });

        let mapped = map_rise_item_to_block(&item, 10, 17, &[]);
        let html = mapped
            .block
            .content_html
            .as_deref()
            .expect("line chart fallback should contain HTML");

        assert_eq!(mapped.block.block_type, "html-custom");
        assert_eq!(mapped.mapping_quality, "approximate");
        assert_eq!(mapped.rematching.status, "partial");
        assert_eq!(mapped.rematching.mapped_to, "html-custom");
        assert!(mapped.rematching.artifact_path.is_none());
        assert!(mapped.html_artifact.is_none());
        assert!(html.contains("<svg"));
        assert!(html.contains("<polyline"));
        assert!(html.contains("USB 1.0"));
        assert!(html.contains("USB 4"));
        assert!(html.contains("5000"));
        assert!(html.contains("<table"));
        assert!(html.contains("role=\"img\""));
        assert!(html.contains("margin:0;padding:0 1rem"));
        assert!(!html.contains("padding:10rem"));
        assert_eq!(mapped.block.padding_offset, Some(35));
        assert!(!mapped
            .rematching
            .missing_properties
            .iter()
            .any(|property| property.contains("Padding Rise")));
        assert!(!html.contains("Activité non mappée automatiquement"));
        assert!(mapped
            .rematching
            .missing_properties
            .iter()
            .any(|property| property.contains("Rendu graphique Rise exact")));
    }

    #[test]
    fn rise_asymmetric_padding_is_imported_as_one_editable_symmetric_value() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "paragraph",
            "type": "text",
            "settings": {
                "paddingTop": 3,
                "paddingBottom": 0
            },
            "items": [{"paragraph": "<p>Exemple</p>"}]
        });

        let mapped = map_rise_item_to_block(&item, 8, 11, &[]);

        assert_eq!(mapped.block.padding_offset, Some(-15));
        assert_eq!(mapped.mapping_quality, "exact");
        assert_eq!(mapped.rematching.status, "exact");
        assert!(mapped.issue.is_none());
        assert!(!mapped
            .rematching
            .missing_properties
            .iter()
            .any(|property| property.contains("Padding Rise")));
    }

    #[test]
    fn rise_zero_padding_remains_a_native_editable_zero() {
        let item = serde_json::json!({
            "family": "divider",
            "variant": "divider",
            "type": "divider",
            "settings": {
                "paddingTop": 0,
                "paddingBottom": 0
            },
            "items": []
        });

        let mapped = map_rise_item_to_block(&item, 10, 39, &[]);

        assert_eq!(mapped.block.padding_offset, Some(-30));
        assert_eq!(mapped.mapping_quality, "exact");
        assert_eq!(mapped.rematching.status, "exact");
    }

    #[test]
    fn rise_zero_padding_on_text_uses_the_paideia_control_safety_floor() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "paragraph",
            "type": "text",
            "settings": {
                "paddingTop": 0,
                "paddingBottom": 0
            },
            "items": [{"paragraph": "<p>Une ligne</p>"}]
        });

        let mapped = map_rise_item_to_block(&item, 8, 12, &[]);

        assert_eq!(mapped.block.padding_offset, Some(-20));
        assert!(mapped.issue.is_none());
        assert!(!mapped
            .rematching
            .missing_properties
            .iter()
            .any(|property| property.contains("Padding Rise")));
    }

    #[test]
    fn rise_zero_padding_on_a_header_includes_the_native_banner_inset() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "heading",
            "type": "text",
            "settings": {
                "paddingTop": 0,
                "paddingBottom": 0
            },
            "items": [{"heading": "Titre"}]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);

        assert_eq!(mapped.block.block_type, "header");
        assert_eq!(mapped.block.padding_offset, Some(-62));
    }

    #[test]
    fn maps_rise_attachment_to_native_attachment_activity() {
        let item = serde_json::json!({
            "family": "multimedia",
            "variant": "attachment",
            "type": "multimedia",
            "items": [
                {
                    "media": {
                        "attachment": {
                            "key": "Guide%20utilisateur.pdf",
                            "size": 123456,
                            "type": "attachment",
                            "filename": "technical-name.pdf",
                            "mimeType": "application/pdf",
                            "originalUrl": "Guide utilisateur.pdf"
                        }
                    }
                },
                {"href": "presentation.pptx"},
                {"src": "decorative.png"}
            ]
        });

        let mapped = map_rise_item_to_block(
            &item,
            1,
            2,
            &[
                "Guide utilisateur.pdf".to_string(),
                "presentation.pptx".to_string(),
                "decorative.png".to_string(),
            ],
        );

        assert_eq!(mapped.block.block_type, "attachment");
        assert_eq!(mapped.block.title, "Fichier");
        assert_eq!(mapped.rematching.status, "exact");
        assert!(mapped.html_artifact.is_none());
        assert_eq!(mapped.block.attachment_files.len(), 2);
        assert_eq!(
            mapped.block.attachment_files[0].display_name,
            "Guide utilisateur.pdf"
        );
        assert_eq!(
            mapped.block.attachment_files[0].asset_ref,
            "documents/scorm/Guide utilisateur.pdf"
        );
        assert_eq!(mapped.block.attachment_files[0].size_bytes, Some(123456));
        assert_eq!(mapped.block.attachment_files[1].extension, "pptx");
    }

    #[test]
    fn rise_timeline_maps_to_native_timeline() {
        let item = serde_json::json!({
            "family": "interactive-fullscreen",
            "variant": "timeline",
            "type": "interactive",
            "settings": {"paddingTop": 3, "paddingBottom": 3},
            "items": [{"date": "Date 1", "title": "Etape 1", "description": "<p>Contenu</p>"}]
        });

        let mapped = map_rise_item_to_block(&item, 1, 2, &[]);
        assert_eq!(mapped.block.block_type, "timeline");
        assert_eq!(mapped.rematching.status, "exact");
        assert!(mapped.rematching.missing_properties.is_empty());
        assert!(mapped.html_artifact.is_none());
        assert_eq!(mapped.block.activity_items.len(), 1);
        assert_eq!(
            mapped.block.activity_items[0].date_label.as_deref(),
            Some("Date 1")
        );
        assert_eq!(mapped.block.activity_items[0].title, "Etape 1");
        assert!(mapped.block.activity_items[0]
            .content_html
            .contains("<p>Contenu</p>"));
    }

    #[test]
    fn rise_scenario_uses_the_native_paideia_background() {
        let item = serde_json::json!({
            "family": "interactive-fullscreen",
            "variant": "scenario",
            "type": "interactive-fullscreen",
            "settings": {"backgroundType": "GRAY"},
            "items": []
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);

        assert_eq!(mapped.block.block_type, "situational-dialogue");
        assert!(mapped.block.section_background_color.is_none());
    }

    #[test]
    fn treats_rematchings_to_core_native_activities_as_exact_without_import_alerts() {
        let cases = [
            ("divider", "divider", "divider"),
            ("divider", "numbered divider", "section-marker"),
            ("interactive-fullscreen", "process", "slides"),
            ("interactive-fullscreen", "scenario", "situational-dialogue"),
        ];

        for (family, variant, expected_type) in cases {
            let item = serde_json::json!({
                "family": family,
                "variant": variant,
                "type": "interactive",
                "items": []
            });
            let mapped = map_rise_item_to_block(&item, 1, 1, &[]);

            assert_eq!(mapped.block.block_type, expected_type, "{family}/{variant}");
            assert_eq!(mapped.mapping_quality, "exact", "{family}/{variant}");
            assert_eq!(mapped.rematching.status, "exact", "{family}/{variant}");
            assert!(mapped.rematching.missing_properties.is_empty(), "{family}/{variant}");
            assert!(mapped.issue.is_none(), "{family}/{variant}");
        }
    }

    #[test]
    fn maps_rise_quote_avatar_before_decorative_background() {
        let item = serde_json::json!({
            "family": "quote",
            "variant": "c",
            "type": "quote",
            "settings": {
                "avatar": true,
                "avatarSize": 14.8,
                "quoteWidth": 92,
                "quoteAlignment": "center",
                "quotePadding": 3.6,
                "backgroundType": "IMAGE"
            },
            "background": {
                "media": {"image": {"crushedKey": "background.jpg"}}
            },
            "items": [{
                "avatar": {"media": {"image": {"crushedKey": "avatar.jpg"}}},
                "paragraph": "<p><span style=\"font-size: 1.8rem\">Citation</span></p>"
            }]
        });

        let mapped = map_rise_item_to_block(
            &item,
            1,
            1,
            &["avatar.jpg".to_string(), "background.jpg".to_string()],
        );

        assert_eq!(mapped.block.block_type, "quote");
        assert_eq!(mapped.block.media_layout.as_deref(), Some("image-left"));
        assert_eq!(mapped.block.image_size.as_deref(), Some("14.8"));
        assert_eq!(mapped.block.content_width.as_deref(), Some("92"));
        assert_eq!(mapped.block.content_align.as_deref(), Some("center"));
        assert_eq!(mapped.block.panel_padding.as_deref(), Some("36px"));
        assert_eq!(
            mapped.block.asset_refs,
            vec!["images/scorm/avatar.jpg".to_string()]
        );
        assert_eq!(
            mapped.block.section_background_image_ref.as_deref(),
            Some("images/scorm/background.jpg")
        );
        assert_eq!(mapped.block.section_background_opacity, Some(1.0));
        assert_eq!(mapped.block.section_background_blur, Some(0.0));
        assert_eq!(mapped.block.section_background_wide, Some(true));
        assert_eq!(mapped.block.section_background_height.as_deref(), Some("medium"));
        assert!(mapped
            .block
            .content_html
            .as_deref()
            .unwrap_or_default()
            .contains("font-size: 18px"));
    }

    #[test]
    fn maps_rise_image_text_background_to_the_pilot_appearance_contract() {
        let item = serde_json::json!({
            "family": "image",
            "variant": "text aside",
            "type": "image",
            "settings": { "backgroundType": "IMAGE" },
            "background": {
                "media": {
                    "image": {
                        "crushedKey": "fondtitre-1.jpg",
                        "alpha": 0.3
                    }
                }
            },
            "items": [{
                "image": {
                    "media": {
                        "image": { "crushedKey": "LOGO-2.png" }
                    }
                },
                "heading": "<h2>Système V</h2>",
                "paragraph": "<p>Introduction</p>"
            }]
        });

        let mapped = map_rise_item_to_block(
            &item,
            2,
            1,
            &["LOGO-2.png".to_string(), "fondtitre-1.jpg".to_string()],
        );

        assert_eq!(mapped.block.block_type, "image-text");
        assert_eq!(
            mapped.block.asset_refs,
            vec!["images/scorm/LOGO-2.png".to_string()]
        );
        assert_eq!(
            mapped.block.section_background_image_ref.as_deref(),
            Some("images/scorm/fondtitre-1.jpg")
        );
        assert_eq!(mapped.block.section_background_opacity, Some(1.0));
        assert_eq!(mapped.block.section_background_blur, Some(0.0));
        assert_eq!(mapped.block.section_background_wide, Some(true));
        assert_eq!(mapped.block.section_background_height.as_deref(), Some("medium"));
    }

    #[test]
    fn maps_rise_video_background_without_treating_it_as_a_pdf_poster() {
        let item = serde_json::json!({
            "family": "multimedia",
            "variant": "video",
            "type": "multimedia",
            "settings": { "backgroundType": "IMAGE" },
            "background": {
                "media": {
                    "image": {
                        "crushedKey": "video-background.jpg",
                        "alpha": 0.35
                    }
                }
            },
            "items": [{
                "media": {
                    "video": { "key": "lesson-video.mp4" }
                }
            }]
        });

        let mapped = map_rise_item_to_block(
            &item,
            2,
            1,
            &[
                "lesson-video.mp4".to_string(),
                "video-background.jpg".to_string(),
            ],
        );

        assert_eq!(mapped.block.block_type, "media");
        assert_eq!(
            mapped.block.asset_refs,
            vec!["video/scorm/lesson-video.mp4".to_string()]
        );
        assert_eq!(
            mapped.block.media_file_name.as_deref(),
            Some("lesson-video.mp4")
        );
        assert_eq!(
            mapped.block.section_background_image_ref.as_deref(),
            Some("images/scorm/video-background.jpg")
        );
        assert_eq!(mapped.block.section_background_opacity, Some(1.0));
        assert_eq!(mapped.block.section_background_blur, Some(0.0));
        assert_eq!(mapped.block.section_background_wide, Some(true));
        assert_eq!(mapped.block.section_background_height.as_deref(), Some("medium"));
    }

    #[test]
    fn video_display_name_uses_the_video_when_the_source_also_contains_an_image() {
        let item = serde_json::json!({
            "family": "multimedia",
            "variant": "video",
            "type": "multimedia",
            "items": [{
                "media": {
                    "image": { "key": "La Carte Mère.png" },
                    "video": { "key": "La Carte Mère.mp4" }
                }
            }]
        });

        let mapped = map_rise_item_to_block(
            &item,
            2,
            1,
            &[
                "La Carte Mère.png".to_string(),
                "La Carte Mère.mp4".to_string(),
            ],
        );

        assert!(mapped
            .block
            .asset_refs
            .contains(&"images/scorm/La Carte Mère.png".to_string()));
        assert!(mapped
            .block
            .asset_refs
            .contains(&"video/scorm/La Carte Mère.mp4".to_string()));
        assert_eq!(
            mapped.block.media_file_name.as_deref(),
            Some("La Carte Mère.mp4")
        );
    }

    #[test]
    fn rise_scenario_does_not_import_an_activity_background() {
        let item = serde_json::json!({
            "family": "interactive-fullscreen",
            "variant": "scenario",
            "type": "interactive",
            "background": {
                "media": {
                    "image": {
                        "crushedKey": "scenario-background.jpg",
                        "alpha": 0.4
                    }
                }
            },
            "items": []
        });

        let mapped = map_rise_item_to_block(
            &item,
            1,
            1,
            &["scenario-background.jpg".to_string()]);

        assert_eq!(mapped.block.block_type, "situational-dialogue");
        assert_eq!(mapped.block.section_background_image_ref, None);
        assert_eq!(mapped.block.section_background_opacity, None);
        assert_eq!(mapped.block.section_background_wide, Some(true));
    }

    #[test]
    fn maps_rise_small_image_profile_as_a_reduced_image_column() {
        let item = serde_json::json!({
            "family": "image",
            "variant": "text aside",
            "type": "image",
            "settings": {
                "imageSize": "small",
                "imagePosition": "left"
            },
            "items": [{
                "media": {"image": {"crushedKey": "photo.jpg"}},
                "paragraph": "<p><span style=\"font-size: 1.8rem\">Texte</span></p>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &["photo.jpg".to_string()]);
        assert_eq!(mapped.block.image_size.as_deref(), Some("small"));
        assert!(mapped
            .block
            .content_html
            .as_deref()
            .unwrap_or_default()
            .contains("font-size: 18px"));
    }

    #[test]
    fn maps_rise_image_text_size_values_identically() {
        let base_item = |size: serde_json::Value| {
            serde_json::json!({
                "family": "image",
                "variant": "text aside",
                "type": "image",
                "settings": {
                    "imageSize": size,
                    "imagePosition": "left"
                },
                "items": [{
                    "media": {"image": {"crushedKey": "photo.jpg"}},
                    "paragraph": "<p>Texte</p>"
                }]
            })
        };

        assert_eq!(
            map_rise_item_to_block(
                &base_item(serde_json::json!(25)),
                1,
                1,
                &["photo.jpg".to_string()]
            )
            .block
            .image_size
            .as_deref(),
            Some("small")
        );
        assert_eq!(
            map_rise_item_to_block(
                &base_item(serde_json::json!(50)),
                1,
                1,
                &["photo.jpg".to_string()]
            )
            .block
            .image_size
            .as_deref(),
            Some("medium")
        );
        assert_eq!(
            map_rise_item_to_block(
                &base_item(serde_json::json!(75)),
                1,
                1,
                &["photo.jpg".to_string()]
            )
            .block
            .image_size
            .as_deref(),
            Some("large")
        );
    }

    #[test]
    fn keeps_rise_content_width_separate_from_image_split() {
        let item = serde_json::json!({
            "family": "image",
            "variant": "text aside",
            "type": "image",
            "settings": {
                "imageSize": 75,
                "contentWidth": 88,
                "columnGap": 3.2,
                "verticalAlignment": "top",
                "imagePosition": "right",
                "textAlignment": "right"
            },
            "items": [{
                "media": {"image": {"crushedKey": "photo.jpg"}},
                "paragraph": "<p>Texte</p>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &["photo.jpg".to_string()]);
        assert_eq!(mapped.block.media_layout.as_deref(), Some("image-right"));
        assert_eq!(mapped.block.image_size.as_deref(), Some("large"));
        assert_eq!(mapped.block.content_width.as_deref(), Some("88"));
        assert_eq!(mapped.block.media_gap.as_deref(), Some("32px"));
        assert_eq!(mapped.block.vertical_align.as_deref(), Some("start"));
        assert_eq!(mapped.block.content_align.as_deref(), Some("right"));
    }

    #[test]
    fn maps_rise_image_size_to_nearest_supported_value() {
        let item = serde_json::json!({
            "family": "image",
            "variant": "text aside",
            "type": "image",
            "settings": {
                "imageSize": 0.63,
                "imagePosition": "right",
                "contentWidth": 88,
                "columnGap": 3.2,
                "verticalAlignment": "top",
                "textAlignment": "right"
            },
            "items": [{
                "media": {"image": {"crushedKey": "photo.jpg"}},
                "paragraph": "<p>Texte</p>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &["photo.jpg".to_string()]);
        assert_eq!(mapped.block.media_layout.as_deref(), Some("image-right"));
        assert_eq!(mapped.block.image_size.as_deref(), Some("large"));
        assert_eq!(mapped.block.content_width.as_deref(), Some("88"));
        assert_eq!(mapped.block.media_gap.as_deref(), Some("32px"));
        assert_eq!(mapped.block.vertical_align.as_deref(), Some("start"));
        assert_eq!(mapped.block.content_align.as_deref(), Some("right"));
    }

    #[test]
    fn imported_image_text_without_size_defaults_to_fifty_percent() {
        let item = serde_json::json!({
            "family": "image",
            "variant": "text aside",
            "type": "image",
            "settings": {},
            "items": [{
                "media": {"image": {"crushedKey": "photo.jpg"}},
                "paragraph": "<p>Texte</p>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &["photo.jpg".to_string()]);
        assert_eq!(mapped.block.image_size.as_deref(), Some("medium"));
    }

    #[test]
    fn rise_images_map_to_normal_width_without_rounded_corners() {
        for variant in ["image", "hero"] {
            let item = serde_json::json!({
                "family": "image",
                "variant": variant,
                "type": "image",
                "settings": {
                    "imagePosition": "full",
                    "roundedCorners": true
                },
                "items": [{
                    "media": {"image": {"crushedKey": "photo.jpg"}}
                }]
            });

            let mapped = map_rise_item_to_block(&item, 1, 1, &["photo.jpg".to_string()]);
            assert_eq!(mapped.block.block_type, "image");
            assert_eq!(mapped.block.media_layout.as_deref(), Some("image-center"));
            assert_eq!(mapped.block.image_rounded, Some(false));
        }
    }

    #[test]
    fn maps_rise_image_text_position_across_left_center_right() {
        let base_item = |position: &str| {
            serde_json::json!({
                "family": "image",
                "variant": "text aside",
                "type": "image",
                "settings": {
                    "imagePosition": position
                },
                "items": [{
                    "media": {"image": {"crushedKey": "photo.jpg"}},
                    "paragraph": "<p>Texte</p>"
                }]
            })
        };

        assert_eq!(
            map_rise_item_to_block(&base_item("left"), 1, 1, &["photo.jpg".to_string()])
                .block
                .media_layout
                .as_deref(),
            Some("image-left")
        );
        assert_eq!(
            map_rise_item_to_block(&base_item("center"), 1, 1, &["photo.jpg".to_string()])
                .block
                .media_layout
                .as_deref(),
            Some("image-center")
        );
        assert_eq!(
            map_rise_item_to_block(&base_item("right"), 1, 1, &["photo.jpg".to_string()])
                .block
                .media_layout
                .as_deref(),
            Some("image-right")
        );
    }

    #[test]
    fn maps_rise_image_text_below_and_full_layouts() {
        let base_item = |position: &str| {
            serde_json::json!({
                "family": "image",
                "variant": "text aside",
                "type": "image",
                "settings": {
                    "imagePosition": position
                },
                "items": [{
                    "media": {"image": {"crushedKey": "photo.jpg"}},
                    "paragraph": "<p>Texte</p>"
                }]
            })
        };

        assert_eq!(
            map_rise_item_to_block(&base_item("below"), 1, 1, &["photo.jpg".to_string()])
                .block
                .media_layout
                .as_deref(),
            Some("image-below")
        );
        assert_eq!(
            map_rise_item_to_block(&base_item("full"), 1, 1, &["photo.jpg".to_string()])
                .block
                .media_layout
                .as_deref(),
            Some("image-full")
        );
    }

    #[test]
    fn maps_rise_process_to_centered_uniform_slides_in_visual_order() {
        let item = serde_json::json!({
            "family": "interactive-fullscreen",
            "variant": "process",
            "type": "interactive-fullscreen",
            "items": [
                {
                    "kind": "intro",
                    "title": "Début",
                    "description": "<p>Intro</p>"
                },
                {
                    "kind": "summary",
                    "title": "Fin",
                    "description": "<p>Conclusion</p>"
                },
                {
                    "kind": "step",
                    "title": "Étape 1",
                    "description": "<p>Corps</p>",
                    "media": {"image": {"crushedKey": "photo.jpg"}},
                    "settings": {
                        "imagePosition": "right",
                        "imageSize": "small"
                    }
                }
            ]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &["photo.jpg".to_string()]);
        assert_eq!(mapped.block.block_type, "slides");
        assert_eq!(mapped.block.section_background_color, None);
        assert_eq!(
            mapped.block.slides_activity_background_color.as_deref(),
            Some("transparent")
        );
        assert_eq!(mapped.block.activity_items.len(), 2);
        assert!(mapped
            .block
            .activity_items
            .iter()
            .all(|item| item.kind.as_deref() == Some("step")));
        assert_eq!(mapped.block.activity_items[0].title, "Étape 1");
        assert_eq!(mapped.block.activity_items[1].title, "Fin");
        assert_eq!(
            mapped.block.activity_items[0].media_layout.as_deref(),
            Some("image-center")
        );
        assert_eq!(
            mapped.block.activity_items[0].image_size.as_deref(),
            Some("small")
        );
        assert_eq!(
            mapped.block.activity_items[0].asset_refs,
            vec!["images/scorm/photo.jpg"]
        );
    }

    #[test]
    fn rise_process_ignores_temporary_summary_media() {
        let item = serde_json::json!({
            "family": "interactive-fullscreen",
            "variant": "process",
            "type": "interactive-fullscreen",
            "items": [{
                "id": "summary-1",
                "type": "summary",
                "title": "Conclusion",
                "description": "<p>Fin</p>",
                "media": {
                    "tmp": {
                        "image": {
                            "crushedKey": "previous-slide.jpg",
                            "originalUrl": "previous-slide.jpg"
                        }
                    }
                }
            }]
        });

        let mapped = map_rise_item_to_block(
            &item,
            1,
            1,
            &["previous-slide.jpg".to_string()]);
        assert!(mapped.block.activity_items[0].asset_refs.is_empty());
    }

    #[test]
    fn rise_process_excludes_technical_intros_and_keeps_steps_and_summaries() {
        let payload = serde_json::json!({
            "course": {
                "lessons": [{
                    "title": "Chapitre 1",
                    "type": "blocks",
                    "items": [{
                        "family": "interactive-fullscreen",
                        "variant": "process",
                        "type": "interactive-fullscreen",
                        "items": [
                            {"id": "shared-intro", "type": "intro", "title": "Introduction", "description": "<p>Texte du premier bloc</p>"},
                            {"id": "summary-a", "type": "summary", "title": "Fin A", "description": "<p>Conclusion A</p>"},
                            {"id": "step-a", "type": "step", "title": "Etape A", "description": "<p>Corps A</p>"}
                        ]
                    }, {
                        "family": "interactive-fullscreen",
                        "variant": "process",
                        "type": "interactive-fullscreen",
                        "items": [
                            {"id": "shared-intro", "type": "intro", "title": "Introduction", "description": "<p>Texte du premier bloc</p>"},
                            {"id": "summary-b", "type": "summary", "title": "Fin B", "description": "<p>Conclusion B</p>"},
                            {"id": "step-b", "type": "step", "title": "Etape B", "description": "<p>Corps B</p>"}
                        ]
                    }]
                }]
            }
        });

        let (project, _, _) = map_rise_json_to_project(
            &payload,
            "duplicate-process-intro",
            "Process",
            &[])
        .expect("Rise process should map");
        let blocks = &project.course.modules[0].chapters[0].pages[0].blocks;
        assert_eq!(blocks[0].activity_items.len(), 2);
        assert_eq!(blocks[1].activity_items.len(), 2);
        assert_eq!(blocks[0].activity_items[0].title, "Etape A");
        assert_eq!(blocks[0].activity_items[1].title, "Fin A");
        assert_eq!(blocks[1].activity_items[0].title, "Etape B");
        assert_eq!(blocks[1].activity_items[1].title, "Fin B");
        assert!(!blocks[1]
            .activity_items
            .iter()
            .any(|item| item.content_html.contains("premier bloc")));
    }

    #[test]
    fn rise_items_only_produce_markers_for_point_of_interest() {
        for (family, variant) in [
            ("image", "hero"), ("image", "text aside"), ("image", "text overlay"),
            ("text", "paragraph"), ("continue", "continue"),
            ("gallery", "carousel"), ("interactive", "tabs"),
            ("flashcard", "grid"), ("multimedia", "video"),
        ] {
            let item = serde_json::json!({
                "family": family, "variant": variant, "type": family,
                "items": [{
                    "id": "ordinary-item", "title": "Titre", "description": "<p>Texte</p>",
                    "x": 50, "y": 50, "icon": "1"
                }]
            });
            let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
            assert_ne!(mapped.block.block_type, "point-of-interest");
            assert!(mapped.block.point_of_interest_markers.is_empty(), "{family}/{variant}");
            assert!(mapped.block.marker_popup_width.is_none(), "{family}/{variant}");
            assert!(mapped.block.marker_popup_height.is_none(), "{family}/{variant}");
        }
    }

    #[test]
    fn maps_rise_labeled_graphic_to_point_of_interest() {
        let item = serde_json::json!({
            "family": "interactive-fullscreen",
            "variant": "labeledgraphic",
            "type": "interactive-fullscreen",
            "items": [{
                "id": "marker-a",
                "x": "25",
                "y": 40,
                "icon": "A",
                "title": "Point A",
                "description": "<p>Détail</p>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &["image.jpg".to_string()]);
        assert_eq!(mapped.block.block_type, "point-of-interest");
        assert_eq!(mapped.block.point_of_interest_markers.len(), 1);
        assert_eq!(mapped.block.point_of_interest_markers[0].id, "marker-a");
        assert_eq!(mapped.block.point_of_interest_markers[0].label, "A");
        assert_eq!(mapped.block.source_raw_html, None);
        assert_eq!(mapped.block.content_html, None);
        assert_eq!(mapped.block.section_background_wide, Some(true));
    }

    #[test]
    fn preserves_rise_labeled_graphic_root_and_marker_media_relations() {
        let item = serde_json::json!({
            "family": "interactive-fullscreen",
            "variant": "labeledgraphic",
            "type": "interactive-fullscreen",
            "media": { "image": { "crushedKey": "root/pl3.png", "originalUrl": "pl3.png" } },
            "items": [
                {
                    "id": "marker-video",
                    "x": 20,
                    "y": 30,
                    "title": "Vidéo",
                    "media": { "video": {
                        "originalUrl": "clips/demo.mp4",
                        "url": "transcoded-missing.mp4",
                        "poster": "posters/demo.png"
                    }}
                },
                {
                    "id": "marker-image",
                    "x": 40,
                    "y": 50,
                    "title": "Image",
                    "media": { "image": {
                        "crushedKey": "details/capture.png",
                        "originalUrl": "capture.png"
                    }}
                }
            ]
        });
        let available = vec![
            "root/pl3.png".to_string(),
            "clips/demo.mp4".to_string(),
            "posters/demo.png".to_string(),
            "details/capture.png".to_string(),
        ];

        let mapped = map_rise_item_to_block(&item, 1, 1, &available);
        assert_eq!(mapped.block.asset_refs, vec!["images/scorm/root/pl3.png"]);
        let video = mapped.block.point_of_interest_markers[0].media.as_ref().unwrap();
        assert_eq!(video.media_type, "video");
        assert_eq!(video.asset_ref, "video/scorm/clips/demo.mp4");
        assert_eq!(video.poster_asset_ref.as_deref(), Some("images/scorm/posters/demo.png"));
        let image = mapped.block.point_of_interest_markers[1].media.as_ref().unwrap();
        assert_eq!(image.media_type, "image");
        assert_eq!(image.asset_ref, "images/scorm/details/capture.png");
    }

    #[test]
    fn increments_repeated_rise_point_of_interest_labels_during_rematching() {
        for (seed, expected) in [
            ("01", vec!["01", "02", "03"]),
            ("A", vec!["A", "B", "C"]),
            ("I", vec!["I", "II", "III"]),
            ("?", vec!["?", "?", "?"]),
        ] {
            let item = serde_json::json!({
                "family": "interactive-fullscreen",
                "variant": "labeledgraphic",
                "type": "interactive-fullscreen",
                "items": [
                    { "id": "marker-1", "x": 10, "y": 20, "icon": seed },
                    { "id": "marker-2", "x": 30, "y": 40, "icon": seed },
                    { "id": "marker-3", "x": 50, "y": 60, "icon": seed }
                ]
            });

            let mapped = map_rise_item_to_block(&item, 1, 1, &["image.jpg".to_string()]);
            let labels = mapped
                .block
                .point_of_interest_markers
                .iter()
                .map(|marker| marker.label.as_str())
                .collect::<Vec<_>>();
            assert_eq!(labels, expected, "seed {seed}");
        }
    }

    #[test]
    fn preserves_rise_slide_title_in_title_field() {
        let item = serde_json::json!({
            "family": "interactive-fullscreen",
            "variant": "process",
            "type": "interactive-fullscreen",
            "items": [
                {
                    "kind": "intro",
                    "title": "Début"
                },
                {
                    "kind": "step",
                    "title": "<h3>Vérifier le bulletin reçu</h3>",
                    "description": "<p>Corps</p>"
                },
                {
                    "kind": "summary",
                    "title": "Fin"
                }
            ]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        assert_eq!(mapped.block.activity_items.len(), 2);
        assert_eq!(
            mapped.block.activity_items[0].title,
            "Vérifier le bulletin reçu"
        );
        assert_eq!(mapped.block.activity_items[1].title, "Fin");
    }

    #[test]
    fn preserves_ordered_rise_heading_and_body_fragments_when_variant_displays_both() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "paragraph with heading",
            "type": "text",
            "items": [{
                "heading": "<h2>Titre source</h2>",
                "paragraph": "<p>Corps source</p>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        let html = mapped.block.content_html.as_deref().unwrap_or_default();
        assert!(html.contains("<h2>Titre source</h2>"));
        assert!(html.contains("<p>Corps source</p>"));
        assert!(
            html.find("Titre source").unwrap_or(usize::MAX)
                < html.find("Corps source").unwrap_or(usize::MAX)
        );
    }

    #[test]
    fn ignores_dormant_rise_heading_field_in_plain_paragraph() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "paragraph",
            "type": "text",
            "items": [{
                "heading": "<strong>Heading</strong>",
                "paragraph": "<p>Corps réellement affiché par Rise.</p>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        let html = mapped.block.content_html.as_deref().unwrap_or_default();

        assert_eq!(mapped.block.block_type, "rich-text");
        assert_eq!(mapped.block.title, "Texte");
        assert!(html.contains("Corps réellement affiché par Rise."));
        assert!(!html.contains("Heading"));
    }

    #[test]
    fn rematches_a_heading_only_rise_paragraph_as_a_native_header() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "paragraph",
            "type": "text",
            "settings": { "backgroundType": "IMAGE" },
            "background": {
                "media": { "image": { "crushedKey": "header-background.jpg" } }
            },
            "items": [{
                "heading": "<strong>Champ dormant</strong>",
                "paragraph": "<div><h2 style=\"text-align:center\">En-tête réellement affiché</h2></div>"
            }]
        });

        let mapped = map_rise_item_to_block(
            &item,
            1,
            1,
            &["header-background.jpg".to_string()],
        );

        assert_eq!(mapped.block.block_type, "header");
        assert_eq!(mapped.block.title, "En-tête");
        assert_eq!(
            mapped.block.content_html.as_deref(),
            Some("<h1 style=\"text-align:center\">En-tête réellement affiché</h1>")
        );
        assert_eq!(
            mapped.block.asset_refs,
            vec!["images/scorm/header-background.jpg".to_string()]
        );
        assert_eq!(mapped.block.section_background_image_ref, None);
    }

    #[test]
    fn ignores_dormant_rise_paragraph_field_in_heading() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "heading",
            "type": "text",
            "items": [{
                "heading": "<h2>Titre réellement affiché</h2>",
                "paragraph": "<p>Texte dormant qui ne doit pas être aspiré.</p>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        let html = mapped.block.content_html.as_deref().unwrap_or_default();

        assert_eq!(mapped.block.block_type, "header");
        assert!(html.contains("<h1>Titre réellement affiché</h1>"));
        assert!(!html.contains("<h2"));
        assert!(html.contains("Titre réellement affiché"));
        assert!(!html.contains("Texte dormant"));
    }

    #[test]
    fn maps_rise_header_without_explicit_background_to_transparent() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "heading",
            "type": "text",
            "settings": { "backgroundType": "GRAY" },
            "items": [{ "heading": "<h2>Titre sans fond explicite</h2>" }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);

        assert_eq!(mapped.block.block_type, "header");
        assert_eq!(
            mapped.block.header_background_color.as_deref(),
            Some("transparent")
        );
    }

    #[test]
    fn preserves_explicit_rise_header_background_color() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "heading",
            "type": "text",
            "settings": {
                "backgroundType": "COLOR",
                "backgroundColor": "#24364b"
            },
            "items": [{ "heading": "<h2>Titre avec fond explicite</h2>" }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);

        assert_eq!(mapped.block.block_type, "header");
        assert_eq!(
            mapped.block.header_background_color.as_deref(),
            Some("#24364b")
        );
    }

    #[test]
    fn ignores_rise_header_background_color_when_an_image_is_present() {
        let item = serde_json::json!({
            "family": "image",
            "variant": "text overlay",
            "type": "image",
            "settings": { "backgroundColor": "#24364b" },
            "items": [{
                "heading": "<h2>Titre illustré</h2>",
                "image": { "crushedKey": "header-image.jpg" }
            }]
        });

        let mapped = map_rise_item_to_block(
            &item,
            1,
            1,
            &["header-image.jpg".to_string()]);

        assert_eq!(mapped.block.block_type, "header");
        assert_eq!(mapped.block.header_height.as_deref(), Some("240px"));
        assert_eq!(mapped.mapping_quality, "approximate");
        assert_eq!(mapped.rematching.status, "partial");
        assert_eq!(
            mapped.rematching.missing_properties,
            vec!["Hauteur visuelle Rise exacte".to_string()]
        );
        assert_eq!(
            mapped.block.header_background_color.as_deref(),
            Some("transparent")
        );
    }

    #[test]
    fn maps_rise_tabs_without_explicit_panel_background_to_transparent() {
        let item = serde_json::json!({
            "family": "interactive",
            "variant": "tabs",
            "type": "interactive",
            "settings": {},
            "items": [{
                "title": "Onglet illustré",
                "content": "<p>Contenu</p>",
                "media": { "image": { "crushedKey": "tab-image.png" } }
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &["tab-image.png".to_string()]);

        assert_eq!(mapped.block.block_type, "tabs");
        assert_eq!(
            mapped.block.panel_background_color.as_deref(),
            Some("transparent")
        );
        assert_eq!(mapped.block.activity_items[0].media_layout.as_deref(), Some("image-below"));
        assert_eq!(mapped.block.activity_items[0].image_size.as_deref(), Some("medium"));
    }

    #[test]
    fn initializes_rise_tabs_with_explicit_panel_background_to_transparent() {
        let item = serde_json::json!({
            "family": "interactive",
            "variant": "tabs",
            "type": "interactive",
            "settings": { "backgroundColor": "#314159" },
            "items": []
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);

        assert_eq!(mapped.block.block_type, "tabs");
        assert_eq!(
            mapped.block.panel_background_color.as_deref(),
            Some("transparent")
        );
    }

    #[test]
    fn maps_rise_image_grid_to_native_square_image_grid() {
        let item = serde_json::json!({
            "family": "image",
            "variant": "three column",
            "type": "image",
            "items": [{
                "title": "Carte 1",
                "caption": "<p>Légende 1</p>",
                "media": { "image": { "crushedKey": "tile-1.jpg" } }
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &["tile-1.jpg".to_string()]);
        assert_eq!(mapped.block.block_type, "image-grid");
        assert_eq!(mapped.block.content_width.as_deref(), Some("3"));
        assert_eq!(mapped.block.activity_items.len(), 1);
        assert!(mapped.block.activity_items[0].asset_refs.iter().any(|value| value.ends_with("tile-1.jpg")));
    }

    #[test]
    fn maps_rise_impact_statement_b_to_rich_text() {
        let item = serde_json::json!({
            "family": "impact",
            "variant": "B",
            "type": "text",
            "items": [{ "paragraph": "<p>Texte de la déclaration</p>" }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        assert_eq!(mapped.block.block_type, "rich-text");
        assert_eq!(mapped.mapping_quality, "exact");
    }

    #[test]
    fn maps_rise_note_to_one_editable_content_source_without_nested_background() {
        let item = serde_json::json!({
            "family": "impact",
            "variant": "note",
            "type": "text",
            "settings": {
                "backgroundType": "COLOR",
                "backgroundColor": "#121419"
            },
            "items": [{
                "paragraph": "<h2><span style=\"color:#ffffff\">Texte de la note</span></h2>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        let html = mapped.block.content_html.as_deref().unwrap_or_default();

        assert_eq!(mapped.block.block_type, "note");
        assert_eq!(mapped.block.title, "Note");
        assert_eq!(mapped.block.note_icon.as_deref(), Some("info-circle"));
        assert_eq!(mapped.block.note_show_icon, Some(true));
        assert_eq!(mapped.block.note_icon_matches_border, Some(true));
        assert!(mapped.block.summary.is_empty());
        assert_eq!(html.matches("Texte de la note").count(), 1);
        assert!(html.contains("<h2>"));
        assert!(html.contains("color:#ffffff"));
        assert!(!html.contains("background:#121419"));
        assert_eq!(
            mapped.block.panel_background_color.as_deref(),
            Some("#121419")
        );
    }

    #[test]
    fn maps_rise_subheading_paragraph_to_rich_text() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "subheading paragraph",
            "type": "text",
            "items": [{
                "heading": "<p>Sous-titre</p>",
                "paragraph": "<p>Texte formaté importé.</p>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        assert_eq!(mapped.block.block_type, "rich-text");
        assert_eq!(mapped.mapping_quality, "exact");
        assert_ne!(mapped.block.block_type, "html-custom");
    }

    #[test]
    fn omits_rise_exit_course_message_and_button_before_injecting_course_exit() {
        let payload = serde_json::json!({
            "course": {
                "lessons": [{
                    "title": "Fin de module",
                    "items": [
                        {
                            "family": "text",
                            "variant": "subheading",
                            "type": "text",
                            "items": [{
                                "heading": "<p>Ce module est terminé</p>",
                                "paragraph": "<p>Les points essentiels à retenir :</p>"
                            }]
                        },
                        {
                            "family": "buttons",
                            "variant": "button",
                            "type": "interactive",
                            "items": [{
                                "type": "",
                                "label": "quitter le module",
                                "description": "<p>Vous pouvez le refaire.</p>",
                                "destination": ""
                            }]
                        }
                    ]
                }]
            }
        });

        let (project, report, _) = map_rise_json_to_project(
            &payload,
            "rise-terminal-screen",
            "Fin Rise",
            &[])
        .expect("mapping should omit Rise terminal screen");
        let blocks = &project.course.modules[0].chapters[0].pages[0].blocks;

        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].block_type, "course-exit");
        assert!(report.rematching.iter().all(|entry| entry.source_type != "exit-course"));
    }

    #[test]
    fn removes_only_the_known_rise_heading_demo_paragraph() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "heading",
            "type": "text",
            "items": [{
                "heading": "<h2>Titre</h2>",
                "paragraph": "<p>When we show up to the present moment with all of our senses, we invite the world to fill us with joy. The pains of the past are behind us. The future has yet to unfold. But the now is full of beauty simply waiting for our attention.</p>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        assert_eq!(mapped.block.block_type, "header");
        assert!(mapped.block.summary.is_empty());
        assert!(!mapped.block.content_html.unwrap_or_default().contains("When we show up"));
    }

    #[test]
    fn removes_rise_order_marker_from_imported_header_banner() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "heading",
            "type": "text",
            "settings": {
                "backgroundType": "IMAGE"
            },
            "items": [{
                "heading": "<div data-editor-id=\"header-source\"><ol start=\"3\"><li><h2 style=\"text-align: center\"><span style=\"font-size: 28px\">Contenu technique incompris</span></h2></li></ol></div>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        let html = mapped.block.content_html.as_deref().unwrap_or_default();
        assert_eq!(mapped.block.block_type, "header");
        assert!(html.contains("Contenu technique incompris"));
        assert!(!html.contains("<ol"));
        assert!(!html.contains("<li"));
        assert!(!html.contains("start=\"3\""));
    }

    #[test]
    fn maps_rise_numbered_divider_to_section_marker() {
        let item = serde_json::json!({
            "family": "divider",
            "variant": "numbered divider",
            "type": "divider",
            "items": []
        });
        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        assert_eq!(mapped.block.block_type, "section-marker");
        assert_eq!(mapped.block.marker_scheme.as_deref(), Some("arabic"));
        assert_eq!(mapped.block.marker_type.as_deref(), Some("outline"));
    }

    #[test]
    fn maps_rise_spacing_divider_to_native_invisible_divider_without_padding_warning() {
        let item = serde_json::json!({
            "family": "divider",
            "variant": "spacing divider",
            "type": "divider",
            "items": [],
            "settings": {
                "paddingTop": 0,
                "paddingBottom": 0
            }
        });

        let mapped = map_rise_item_to_block(&item, 10, 39, &[]);

        assert_eq!(mapped.block.block_type, "divider");
        assert_eq!(mapped.block.divider_style.as_deref(), Some("none"));
        assert_eq!(mapped.mapping_quality, "exact");
        assert_eq!(mapped.rematching.status, "exact");
        assert_eq!(mapped.rematching.mapped_to, "divider");
        assert!(mapped.rematching.artifact_path.is_none());
        assert!(mapped.html_artifact.is_none());
        assert!(mapped.rematching.missing_properties.is_empty());
        assert!(mapped.issue.is_none());
    }

    #[test]
    fn maps_real_rise_accordion_to_native_accordion() {
        let item = serde_json::json!({
            "family": "interactive",
            "variant": "accordion",
            "type": "interactive",
            "items": [
                {
                    "id": "accordion-1",
                    "title": "<p>Embracing Discovery</p>",
                    "description": "<p>Discover a new perspective.</p>",
                    "media": { "image": { "key": "paraglide.jpg" } }
                },
                {
                    "id": "accordion-2",
                    "title": "Gaining Insight",
                    "description": "<p>Make sense of the information.</p>"
                },
                {
                    "id": "accordion-3",
                    "title": "Making It Real",
                    "description": "<p>Apply the learning.</p>"
                }
            ]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &["paraglide.jpg".to_string()]);

        assert_eq!(mapped.block.block_type, "accordion");
        assert_eq!(mapped.mapping_quality, "exact");
        assert_eq!(mapped.block.activity_items.len(), 3);
        assert!(mapped.block.activity_items[0].title.contains("Embracing Discovery"));
        assert!(mapped.block.activity_items[0].content_html.contains("new perspective"));
        assert!(mapped.block.activity_items[0]
            .asset_refs
            .iter()
            .any(|value| value.ends_with("paraglide.jpg")));
    }

    #[test]
    fn maps_rise_heading_to_header_without_background_image() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "heading",
            "type": "text",
            "settings": {
                "backgroundType": "COLOR",
                "backgroundColor": "#101318"
            },
            "items": [{
                "heading": "<h2 style=\"text-align:center;color:#ffffff\"><span style=\"font-size:28px\">Un titre Rise</span></h2>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);

        assert_eq!(mapped.block.block_type, "header");
        assert_eq!(mapped.mapping_quality, "exact");
        let html = mapped.block.content_html.unwrap_or_default();
        assert!(html.contains("<h1 style=\"text-align:center;color:#ffffff\">"));
        assert!(html.contains("Un titre Rise"));
        assert!(html.contains("font-size:28px") || html.contains("font-size: 28px"));
        assert!(!html.contains("<h2"));
    }

    #[test]
    fn unwraps_rise_header_transport_div_before_enforcing_h1() {
        let normalized = normalize_imported_header_html(
            r#"<div><h2 style="text-align:center">Titre éditable</h2></div>"#,
        );

        assert_eq!(
            normalized,
            r#"<h1 style="text-align:center">Titre éditable</h1>"#
        );
        assert!(!normalized.contains("<div"));
        assert!(!normalized.contains("<h1><h1"));

        let sample = normalize_imported_header_html(
            r#"<div><h1 style="text-align:center"><span style="font-size:28px"><span style="color:rgb(36, 103, 178);text-decoration:inherit">Synthèse</span></span></h1></div>"#,
        );
        assert!(!sample.contains("<div"), "sample wrapper remains: {sample}");
    }

    #[test]
    fn maps_rise_heading_paragraph_to_native_rich_text() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "heading paragraph",
            "type": "text",
            "items": [{
                "heading": "<h2>Un titre</h2>",
                "paragraph": "<p>Un <strong>texte formaté</strong>.</p>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);

        assert_eq!(mapped.block.block_type, "rich-text");
        assert_eq!(mapped.mapping_quality, "exact");
        assert!(mapped.block.content_html.unwrap_or_default().contains("<strong>texte formaté</strong>"));
    }

    #[test]
    fn maps_real_rise_text_columns_to_an_invisible_rich_text_table() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "two column",
            "type": "text",
            "items": [
                { "paragraph": "<div><p>Colonne de gauche</p></div>" },
                { "paragraph": "<div><p>Colonne de droite</p></div>" }
            ]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        let html = mapped.block.content_html.unwrap_or_default();

        assert_eq!(mapped.block.block_type, "rich-text");
        assert_eq!(mapped.mapping_quality, "exact");
        assert!(html.contains("<table"));
        assert!(html.contains("role=\"presentation\""));
        assert!(html.contains("border:0"));
        assert!(html.contains("background:transparent"));
        assert!(html.contains("Colonne de gauche"));
        assert!(html.contains("Colonne de droite"));
    }

    #[test]
    fn does_not_rematch_an_unknown_rise_text_variant_without_an_explicit_contract() {
        let item = serde_json::json!({
            "family": "text",
            "variant": "paragraph with emphasis",
            "type": "text",
            "items": [{
                "heading": "<h2>Un titre</h2>",
                "paragraph": "<p>Un texte hors contrat.</p>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);

        assert_eq!(mapped.block.block_type, "html-custom");
        assert_eq!(mapped.mapping_quality, "unsupported");
    }

    #[test]
    fn does_not_add_a_flashcard_import_counter_to_learning_content() {
        let item = serde_json::json!({
            "family": "flashcards",
            "variant": "flashcards",
            "type": "interactive",
            "items": [{ "front": { "text": "Question" }, "back": { "text": "Réponse" } }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);

        assert_eq!(mapped.block.block_type, "flip-cards");
        assert!(mapped.block.summary.is_empty());
    }

    #[test]
    fn maps_rise_button_stack_to_links_resources_and_separates_composite_url() {
        let item = serde_json::json!({
            "family": "buttons",
            "variant": "button stack",
            "type": "buttons",
            "settings": { "buttonShowDescription": true },
            "items": [
                {
                    "id": "resource-1",
                    "type": "link",
                    "label": "Documentation officielle",
                    "description": "<p>Consultez la ressource.</p>",
                    "destination": "Legifrance : https://www.legifrance.gouv.fr/"
                },
                {
                    "id": "resource-2",
                    "type": "link",
                    "label": "Référentiel",
                    "destination": "https://example.org/reference"
                }
            ]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);

        assert_eq!(mapped.block.block_type, "links-resources");
        assert!(mapped.block.content_html.as_deref().unwrap_or_default().is_empty());
        assert_eq!(mapped.block.activity_items.len(), 2);
        assert_eq!(mapped.block.activity_items[0].title, "Documentation officielle");
        assert_eq!(mapped.block.activity_items[0].resource_url.as_deref(), Some("https://www.legifrance.gouv.fr/"));
        assert_eq!(mapped.block.activity_items[0].resource_valid, Some(true));
        assert!(mapped.block.activity_items[0].content_html.contains("Consultez"));
    }

    #[test]
    fn preserves_an_ambiguous_rise_destination_without_activating_it() {
        let item = serde_json::json!({
            "family": "buttons",
            "variant": "button",
            "type": "buttons",
            "items": [{
                "id": "resource-1",
                "type": "link",
                "label": "Ressource",
                "destination": "destination à vérifier"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        let action = &mapped.block.activity_items[0];

        assert_eq!(mapped.mapping_quality, "approximate");
        assert_eq!(action.resource_url, None);
        assert_eq!(action.resource_raw_destination.as_deref(), Some("destination à vérifier"));
        assert_eq!(action.resource_valid, Some(false));
    }

    #[test]
    fn ignores_rise_exit_course_buttons() {
        let item = serde_json::json!({
            "family": "buttons",
            "variant": "button",
            "type": "buttons",
            "items": [{
                "id": "exit",
                "type": "",
                "label": "Quitter le module",
                "destination": ""
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        assert_eq!(mapped.block.block_type, "links-resources");
        assert!(mapped.block.activity_items.is_empty());
    }

    #[test]
    fn rematches_a_simple_rise_fill_in_as_complete() {
        let item = serde_json::json!({
            "type": "knowledgeCheck",
            "family": "knowledgeCheck",
            "variant": "fillin",
            "items": [{
                "type": "FILL_IN_THE_BLANK",
                "title": "<div data-editor-id=\"question\"><p>le ciel est bleu</p></div>",
                "answers": [{ "id": "duplicated-rise-id", "title": "bleu", "correct": true }],
                "feedback": "<p>Feedback Rise volontairement ignoré.</p>"
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        let complete = mapped.block.complete.as_ref().expect("complete data");
        let exercise = &complete.exercises[0];

        assert_eq!(mapped.block.block_type, "complete");
        assert_eq!(mapped.mapping_quality, "exact");
        assert!(!complete.cover.enabled);
        assert_eq!(exercise.blanks.len(), 1);
        assert_eq!(exercise.blanks[0].answer, "bleu");
        assert!(exercise.content_html.contains(
            "<span data-paideia-complete-id=\"complete_blank_blk_01_01\" contenteditable=\"false\">bleu</span>&#8203;"
        ));
    }

    #[test]
    fn groups_consecutive_rise_fill_ins_in_one_complete_document() {
        let items = vec![
            serde_json::json!({
                "type": "knowledgeCheck",
                "family": "knowledgeCheck",
                "variant": "fillin",
                "items": [{
                    "type": "FILL_IN_THE_BLANK",
                    "title": "<p>le ciel est bleu</p>",
                    "answers": [{ "id": "same-rise-id", "title": "bleu", "correct": true }]
                }]
            }),
            serde_json::json!({
                "type": "knowledgeCheck",
                "family": "knowledgeCheck",
                "variant": "fillin",
                "items": [{
                    "type": "FILL_IN_THE_BLANK",
                    "title": "<p>le ciel est gris</p>",
                    "answers": [{ "id": "same-rise-id", "title": "gris", "correct": true }]
                }]
            }),
        ];

        let mapped = map_rise_fill_in_group_to_block_with_id(
            &items,
            1,
            1,
            &[],
            "block_fillin".to_string());
        let complete = mapped.block.complete.as_ref().expect("complete data");
        let exercise = &complete.exercises[0];

        assert_eq!(mapped.block.block_type, "complete");
        assert_eq!(mapped.mapping_quality, "exact");
        assert_eq!(exercise.blanks.len(), 2);
        assert_ne!(exercise.blanks[0].id, exercise.blanks[1].id);
        assert!(exercise.content_html.contains("le ciel est "));
        assert!(exercise.content_html.contains(">bleu</span>"));
        assert!(exercise.content_html.contains(">gris</span>"));
        assert_eq!(mapped.rematching_entries.len(), 2);
        assert!(mapped
            .rematching_entries
            .iter()
            .all(|entry| entry.status == "grouped"));
    }

    #[test]
    fn preserves_ambiguous_rise_fill_in_text_without_marker() {
        let item = serde_json::json!({
            "type": "knowledgeCheck",
            "family": "knowledgeCheck",
            "variant": "fillin",
            "items": [{
                "type": "FILL_IN_THE_BLANK",
                "title": "<p>bleu puis encore bleu</p>",
                "answers": [{ "title": "bleu", "correct": true }]
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        let complete = mapped.block.complete.as_ref().expect("complete data");
        let exercise = &complete.exercises[0];

        assert_eq!(mapped.mapping_quality, "approximate");
        assert!(exercise.blanks.is_empty());
        assert!(exercise.content_html.contains("<p>bleu puis encore bleu</p>"));
        assert!(!exercise.content_html.contains("data-paideia-complete-id"));
        assert!(mapped
            .rematching
            .missing_properties
            .iter()
            .any(|property| property.contains("Emplacement non ambigu")));
    }

    #[test]
    fn rematches_simple_rise_matching_pairs_to_native_matching() {
        let item = serde_json::json!({
            "id": "rise-matching-block",
            "type": "knowledgeCheck",
            "family": "knowledgeCheck",
            "variant": "matching",
            "settings": { "retryCount": -1 },
            "items": [{
                "id": "rise-matching-question",
                "type": "MATCHING",
                "title": "",
                "feedback": "<p>Ce feedback Rise doit être ignoré.</p>",
                "answers": [
                    { "id": "a1", "title": "un", "matchTitle": "deux", "correct": true },
                    { "id": "a2", "title": "trois", "matchTitle": "quatre", "correct": true },
                    { "id": "a3", "title": "cinq", "matchTitle": "six", "correct": true }
                ]
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        let matching = mapped.block.matching.as_ref().expect("native matching data");

        assert_eq!(mapped.block.block_type, "matching");
        assert_eq!(mapped.block.title, "Relier");
        assert_eq!(mapped.mapping_quality, "exact");
        assert_eq!(mapped.rematching.status, "exact");
        assert!(mapped.rematching.missing_properties.is_empty());
        assert_eq!(matching.pairs.len(), 3);
        assert_eq!(
            matching.pairs[0].left_html,
            "<p style=\"font-size: 18px;\">un</p>"
        );
        assert_eq!(
            matching.pairs[0].right_html,
            "<p style=\"font-size: 18px;\">deux</p>"
        );
        assert!(matching.pairs[2].left_html.contains("cinq"));
        assert!(matching.pairs[2].right_html.contains("six"));
        assert_eq!(matching.max_attempts, 3);
        assert_eq!(matching.success_threshold, 100);
        assert!(matching.show_attempt_feedback);
        assert_eq!(
            matching.success_feedback_html,
            "<p>Vous avez correctement relié tous les éléments.</p>"
        );
        assert!(!matching.success_feedback_html.contains("feedback Rise"));
        assert_eq!(matching.label_appearance.background_color, "#FFFFFF");
    }

    #[test]
    fn preserves_rise_matching_as_fallback_when_pair_count_is_out_of_bounds() {
        for answers in [
            serde_json::json!([
                { "title": "seul", "matchTitle": "unique", "correct": true }
            ]),
            serde_json::json!((1..=11)
                .map(|index| serde_json::json!({
                    "title": format!("gauche {index}"),
                    "matchTitle": format!("droite {index}"),
                    "correct": true
                }))
                .collect::<Vec<_>>()),
        ] {
            let item = serde_json::json!({
                "type": "knowledgeCheck",
                "family": "knowledgeCheck",
                "variant": "matching",
                "items": [{
                    "type": "MATCHING",
                    "answers": answers
                }]
            });

            let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
            assert_eq!(mapped.block.block_type, "html-custom");
            assert!(mapped.block.matching.is_none());
            assert_eq!(mapped.mapping_quality, "unsupported");
            assert_eq!(mapped.rematching.status, "unsupported");
            assert!(mapped.block.content_html.is_none());
            assert!(mapped.rematching.artifact_path.is_none());
            assert!(mapped
                .rematching
                .missing_properties
                .contains(&"Entre 2 et 10 couples".to_string()));
        }
    }

    #[test]
    fn preserves_rise_matching_as_fallback_when_a_pair_is_incomplete() {
        let item = serde_json::json!({
            "type": "knowledgeCheck",
            "family": "knowledgeCheck",
            "variant": "matching",
            "items": [{
                "type": "MATCHING",
                "answers": [
                    { "title": "un", "matchTitle": "deux", "correct": true },
                    { "title": "trois", "matchTitle": "", "correct": true }
                ]
            }]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        assert_eq!(mapped.block.block_type, "html-custom");
        assert!(mapped.block.matching.is_none());
        assert!(mapped
            .rematching
            .missing_properties
            .contains(&"Couple 2 complet".to_string()));
    }

    #[test]
    fn rematches_rise_sorting_categories_and_cards_to_native_card_sort() {
        let item = serde_json::json!({
            "id": "rise-sorting-block",
            "type": "interactive",
            "family": "interactive-fullscreen",
            "variant": "sorting",
            "piles": [
                { "id": 1, "title": "aa" },
                { "id": 2, "title": "bb" },
                { "id": "category-cc", "title": "cc" },
                { "id": "category-dd", "title": "dd" }
            ],
            "items": [
                { "id": "card-1", "title": "1", "pileId": 1 },
                { "id": "card-2", "title": "2", "pileId": 2 },
                { "id": "card-3", "title": "3", "pileId": "category-cc" },
                { "id": "card-4a", "title": "4", "pileId": "category-cc" },
                { "id": "card-4b", "title": "4", "pileId": "category-dd" },
                { "id": "card-5", "title": "5", "pileId": "category-dd" },
                { "id": "card-7", "title": "7", "pileId": "category-dd" },
                { "id": "card-6", "title": "6", "pileId": "category-cc" },
                { "id": "card-a", "title": "a", "pileId": 1 },
                { "id": "card-b", "title": "b", "pileId": 1 },
                { "id": "card-c", "title": "c", "pileId": 2 },
                { "id": "card-d", "title": "d", "pileId": 2, "isNewlyInserted": true }
            ]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        let card_sort = mapped.block.card_sort.as_ref().expect("native Card Sort data");

        assert_eq!(mapped.block.block_type, "card-sort");
        assert_eq!(mapped.block.title, "Tri de cartes");
        assert_eq!(mapped.mapping_quality, "exact");
        assert_eq!(mapped.rematching.status, "exact");
        assert!(mapped.rematching.missing_properties.is_empty());
        assert_eq!(
            card_sort
                .categories
                .iter()
                .map(|category| category.label.as_str())
                .collect::<Vec<_>>(),
            vec!["aa", "bb", "cc", "dd"]
        );
        assert_eq!(mapped.block.activity_items.len(), 12);

        let duplicate_fours = mapped
            .block
            .activity_items
            .iter()
            .filter(|card| card.title == "4")
            .collect::<Vec<_>>();
        assert_eq!(duplicate_fours.len(), 2);
        assert_ne!(
            duplicate_fours[0].correct_category_id,
            duplicate_fours[1].correct_category_id
        );
        assert_eq!(mapped.block.activity_items[0].title, "1");
        assert!(mapped.block.activity_items[0].content_html.contains("1"));
        assert_eq!(card_sort.max_attempts, 3);
        assert_eq!(card_sort.success_threshold, 80);
        assert_eq!(card_sort.card_appearance.background_color, "#FFFFFF");
    }

    #[test]
    fn preserves_rise_sorting_as_fallback_when_category_count_is_out_of_bounds() {
        for piles in [
            serde_json::json!([{ "id": 1, "title": "seule" }]),
            serde_json::json!([
                { "id": 1, "title": "a" },
                { "id": 2, "title": "b" },
                { "id": 3, "title": "c" },
                { "id": 4, "title": "d" },
                { "id": 5, "title": "e" }
            ]),
        ] {
            let item = serde_json::json!({
                "type": "interactive",
                "family": "interactive-fullscreen",
                "variant": "sorting",
                "piles": piles,
                "items": [{ "title": "carte", "pileId": 1 }]
            });

            let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
            assert_eq!(mapped.block.block_type, "html-custom");
            assert!(mapped.block.card_sort.is_none());
            assert!(mapped.block.activity_items.is_empty());
            assert_eq!(mapped.mapping_quality, "unsupported");
            assert!(mapped
                .rematching
                .missing_properties
                .contains(&"Entre 2 et 4 catégories".to_string()));
        }
    }

    #[test]
    fn preserves_rise_sorting_as_fallback_when_a_card_targets_an_unknown_category() {
        let item = serde_json::json!({
            "type": "interactive",
            "family": "interactive-fullscreen",
            "variant": "sorting",
            "piles": [
                { "id": 1, "title": "a" },
                { "id": 2, "title": "b" }
            ],
            "items": [
                { "title": "valide", "pileId": 1 },
                { "title": "orpheline", "pileId": 99 }
            ]
        });

        let mapped = map_rise_item_to_block(&item, 1, 1, &[]);
        assert_eq!(mapped.block.block_type, "html-custom");
        assert!(mapped.block.card_sort.is_none());
        assert!(mapped
            .rematching
            .missing_properties
            .contains(&"Catégorie existante pour la carte 2".to_string()));
    }
}
