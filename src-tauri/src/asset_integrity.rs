use crate::models::PaideiaProject;
use serde_json::Value;
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::ErrorKind;
use std::path::{Component, Path};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MissingMedia {
    pub asset_ref: String,
    pub location: String,
    pub media_type: String,
}

fn local_asset_ref(value: &str) -> Option<String> {
    let normalized = value.trim().replace('\\', "/");
    if normalized.is_empty()
        || normalized.starts_with("default-assets/")
        || normalized.starts_with("default-characters/")
        || normalized.starts_with("http://")
        || normalized.starts_with("https://")
        || normalized.starts_with("data:")
    {
        return None;
    }
    let normalized = normalized
        .trim_start_matches("./")
        .trim_start_matches("assets/");
    let path = Path::new(normalized);
    if path.is_absolute()
        || path.components().any(|part| {
            matches!(
                part,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return None;
    }
    Some(normalized.to_string())
}

fn media_type(asset_ref: &str) -> String {
    match Path::new(asset_ref)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "tif" | "tiff" => "image",
        "mp4" | "webm" | "mov" | "m4v" | "avi" | "mpg" | "mpeg" | "ogv" => "vidéo",
        "mp3" | "wav" | "ogg" | "m4a" | "aac" | "flac" => "audio",
        _ => "fichier",
    }
    .to_string()
}

pub fn media_type_for_report(asset_ref: &str) -> String {
    media_type(asset_ref)
}

fn collect_refs(value: &Value, refs: &mut HashSet<String>) {
    match value {
        Value::Object(fields) => {
            for (key, child) in fields {
                if key.ends_with("Ref") {
                    if let Some(asset_ref) = child.as_str().and_then(local_asset_ref) {
                        refs.insert(asset_ref);
                    }
                } else if key.ends_with("Refs") {
                    if let Some(items) = child.as_array() {
                        for item in items {
                            if let Some(asset_ref) = item.as_str().and_then(local_asset_ref) {
                                refs.insert(asset_ref);
                            }
                        }
                    }
                }
                collect_refs(child, refs);
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_refs(item, refs);
            }
        }
        _ => {}
    }
}

fn clear_missing_refs(
    value: &mut Value,
    missing: &HashSet<String>,
    legacy_avatars: &HashSet<String>,
    location: &str,
    removed: &mut Vec<MissingMedia>,
) {
    match value {
        Value::Object(fields) => {
            // These models require a non-empty assetRef. Their empty state is
            // the absence of the entire media object, not a null assetRef.
            for key in ["customFont", "media"] {
                let missing_ref = fields
                    .get(key)
                    .and_then(|child| child.get("assetRef"))
                    .and_then(Value::as_str)
                    .and_then(local_asset_ref)
                    .filter(|asset_ref| missing.contains(asset_ref));
                if let Some(asset_ref) = missing_ref {
                    removed.push(MissingMedia {
                        media_type: media_type(&asset_ref),
                        asset_ref,
                        location: location.to_string(),
                    });
                    fields.insert(key.to_string(), Value::Null);
                }
            }
            for key in ["attachmentFiles", "faces"] {
                if let Some(items) = fields.get_mut(key).and_then(Value::as_array_mut) {
                    items.retain(|item| {
                        let Some(asset_ref) = item
                            .get("assetRef")
                            .and_then(Value::as_str)
                            .and_then(local_asset_ref)
                            .filter(|asset_ref| missing.contains(asset_ref))
                        else {
                            return true;
                        };
                        removed.push(MissingMedia {
                            media_type: media_type(&asset_ref),
                            asset_ref,
                            location: location.to_string(),
                        });
                        false
                    });
                }
            }
            let mut removed_here = Vec::new();
            let mut clear_front_name = false;
            let mut clear_back_name = false;
            for (key, child) in fields.iter_mut() {
                if key.ends_with("Ref") {
                    if let Some(asset_ref) = child
                        .as_str()
                        .and_then(local_asset_ref)
                        .filter(|value| missing.contains(value))
                        .filter(|value| key != "avatarRef" || !legacy_avatars.contains(value))
                    {
                        clear_front_name |= key == "frontImageAssetRef";
                        clear_back_name |= key == "backImageAssetRef";
                        removed_here.push(asset_ref.clone());
                        removed.push(MissingMedia {
                            media_type: media_type(&asset_ref),
                            asset_ref,
                            location: location.to_string(),
                        });
                        *child = Value::Null;
                    }
                } else if key.ends_with("Refs") {
                    if let Some(items) = child.as_array_mut() {
                        items.retain(|item| {
                            let Some(asset_ref) = item
                                .as_str()
                                .and_then(local_asset_ref)
                                .filter(|value| missing.contains(value))
                            else {
                                return true;
                            };
                            removed_here.push(asset_ref.clone());
                            removed.push(MissingMedia {
                                media_type: media_type(&asset_ref),
                                asset_ref,
                                location: location.to_string(),
                            });
                            false
                        });
                    }
                }
            }
            if !removed_here.is_empty() {
                if clear_front_name {
                    fields.insert("frontImageFileName".to_string(), Value::Null);
                }
                if clear_back_name {
                    fields.insert("backImageFileName".to_string(), Value::Null);
                }
                let should_clear_name = fields
                    .get("mediaFileName")
                    .and_then(Value::as_str)
                    .is_some_and(|name| {
                        removed_here.iter().any(|asset_ref| {
                            Path::new(asset_ref)
                                .file_name()
                                .and_then(|name| name.to_str())
                                == Some(name)
                        }) || fields
                            .get("assetRefs")
                            .and_then(Value::as_array)
                            .is_some_and(|refs| refs.is_empty())
                    });
                if should_clear_name {
                    fields.insert("mediaFileName".to_string(), Value::Null);
                }
            }
            for child in fields.values_mut() {
                clear_missing_refs(child, missing, legacy_avatars, location, removed);
            }
        }
        Value::Array(items) => {
            for (index, item) in items.iter_mut().enumerate() {
                let label = item
                    .get("title")
                    .and_then(Value::as_str)
                    .filter(|value| !value.is_empty())
                    .or_else(|| item.get("id").and_then(Value::as_str));
                let next_location = match label {
                    Some(label) => format!("{location} / {label}"),
                    None => format!("{location} / {}", index + 1),
                };
                clear_missing_refs(item, missing, legacy_avatars, &next_location, removed);
            }
        }
        _ => {}
    }
}

fn restore_legacy_avatar(root: &Path, assets: &Path, reference: &str, source: &Path) -> std::io::Result<()> {
    if root.join(".paideia-collaboration-readonly").is_file() {
        return Ok(());
    }
    let root = root.canonicalize()?;
    fs::create_dir_all(assets)?;
    let assets = assets.canonicalize()?;
    if !assets.starts_with(&root) {
        return Ok(());
    }
    let directory = assets.join("avatars");
    fs::create_dir_all(&directory)?;
    let directory = directory.canonicalize()?;
    if !directory.starts_with(&assets) {
        return Ok(());
    }
    let Some(name) = Path::new(reference).file_name() else {
        return Ok(());
    };
    let target = directory.join(name);
    let mut source = File::open(source)?;
    let mut target_file = File::create_new(&target)?;
    if let Err(error) = std::io::copy(&mut source, &mut target_file) {
        drop(target_file);
        let _ = fs::remove_file(target);
        return Err(error);
    }
    Ok(())
}

/// Only a confirmed missing file is cleared. An inaccessible asset directory or
/// any other I/O error leaves the lesson untouched.
pub fn clear_confirmed_missing_media(
    root: &Path,
    project: &mut PaideiaProject,
) -> Result<Vec<MissingMedia>, String> {
    let assets = root.join("assets");
    match fs::read_dir(&assets) {
        Ok(_) => {}
        Err(error) if error.kind() == ErrorKind::NotFound => {
            fs::read_dir(root)
                .map_err(|error| format!("Dossier du projet inaccessible : {error}"))?;
        }
        Err(error) => return Err(format!("Dossier des médias inaccessible : {error}")),
    }
    let mut value = serde_json::to_value(&*project).map_err(|error| error.to_string())?;
    let mut refs = HashSet::new();
    collect_refs(&value, &mut refs);
    let mut missing = HashSet::new();
    for asset_ref in refs {
        match fs::metadata(assets.join(&asset_ref)) {
            Ok(_) => {}
            Err(error) if error.kind() == ErrorKind::NotFound => {
                missing.insert(asset_ref);
            }
            Err(error) => return Err(format!("Vérification du média impossible : {error}")),
        }
    }
    if missing.is_empty() {
        return Ok(Vec::new());
    }
    let legacy_avatars = project
        .glossary_assistants
        .iter()
        .filter_map(|assistant| assistant.avatar_ref.as_deref().and_then(local_asset_ref))
        .filter(|reference| missing.contains(reference))
        .filter(|reference| {
            let Some(source) = crate::distribution::legacy_glossary_avatar(reference) else {
                return false;
            };
            // Keep the reference even if the lesson is read-only. The preview
            // and SCORM exporter can still resolve the avatar from the bank.
            let _ = restore_legacy_avatar(root, &assets, reference, &source);
            true
        })
        .collect();
    let mut removed = Vec::new();
    clear_missing_refs(&mut value, &missing, &legacy_avatars, "Leçon", &mut removed);
    *project = serde_json::from_value(value).map_err(|error| error.to_string())?;
    Ok(removed)
}
