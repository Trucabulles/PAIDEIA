use crate::distribution;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

const MAX_TEXT_CHARS: usize = 4_000;
const MAX_EVENTS: usize = 5_000;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ObservationIdentity {
    schema_version: u32,
    id: String,
    display_name: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ObservationEvent {
    schema_version: u32,
    id: String,
    thread_id: String,
    kind: String,
    project_id: String,
    chapter_id: String,
    page_id: String,
    block_id: String,
    block_label: String,
    author_id: String,
    author_display_name: String,
    #[serde(default)]
    text: String,
    #[serde(default)]
    source_revision: String,
    #[serde(default)]
    target_message_id: String,
    created_at: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ObservationPurgeArchive {
    schema_version: u32,
    project_id: String,
    purged_at: String,
    purged_by_id: String,
    purged_by_display_name: String,
    events: Vec<ObservationEvent>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObservationMessage {
    id: String,
    author_id: String,
    author_display_name: String,
    text: String,
    created_at: String,
    deleted_at: Option<String>,
    deleted_by_display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObservationThread {
    id: String,
    chapter_id: String,
    page_id: String,
    block_id: String,
    block_label: String,
    source_revision: String,
    resolved: bool,
    messages: Vec<ObservationMessage>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObservationState {
    threads: Vec<ObservationThread>,
    current_user_id: String,
    current_user_display_name: String,
    collaborative: bool,
    can_resolve: bool,
    can_purge: bool,
    revision: String,
}

#[derive(Debug)]
struct StorageContext {
    notes_dir: PathBuf,
    mirror_notes_dir: Option<PathBuf>,
    events_dir: PathBuf,
    project_id: String,
    source_revision: String,
    identity: ObservationIdentity,
    legacy_local_identity_id: Option<String>,
    collaborative: bool,
    can_resolve: bool,
    can_purge: bool,
}

fn write_json_new(path: &Path, value: &impl Serialize) -> Result<(), String> {
    let bytes = serde_json::to_vec(value).map_err(|error| error.to_string())?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| error.to_string())?;
    file.write_all(&bytes).map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())
}

fn write_event_atomic(path: &Path, value: &ObservationEvent) -> Result<(), String> {
    let temporary = path.with_extension(format!("pending-{}", uuid::Uuid::new_v4()));
    write_json_new(&temporary, value)?;
    match fs::rename(&temporary, path) {
        Ok(()) => Ok(()),
        Err(error) => {
            let _ = fs::remove_file(&temporary);
            Err(error.to_string())
        }
    }
}

fn local_identity(app: &AppHandle) -> Result<ObservationIdentity, String> {
    let path = distribution::app_config_root(app)?
        .join("observations")
        .join("identity.json");
    if let Ok(bytes) = fs::read(&path) {
        let mut identity: ObservationIdentity = serde_json::from_slice(&bytes)
            .map_err(|error| format!("Identité des observations invalide : {error}"))?;
        identity.display_name.clear();
        return Ok(identity);
    }
    fs::create_dir_all(path.parent().ok_or("Dossier d’identité introuvable.")?)
        .map_err(|error| error.to_string())?;
    let identity = ObservationIdentity {
        schema_version: 1,
        id: uuid::Uuid::new_v4().to_string(),
        display_name: String::new(),
    };
    write_json_new(&path, &identity)?;
    Ok(identity)
}

fn project_id(project_path: &Path) -> Result<String, String> {
    let value: serde_json::Value = serde_json::from_slice(
        &fs::read(project_path.join("project.json")).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    value
        .get("id")
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or("Identifiant de projet absent.".into())
}

fn copy_local_events_once(local: &Path, shared: &Path) -> Result<(), String> {
    if !local.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(shared).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(local).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_file()
            && entry
                .path()
                .extension()
                .is_some_and(|extension| extension == "json")
        {
            let target = shared.join(entry.file_name());
            if !target.exists() {
                let event: ObservationEvent = serde_json::from_slice(
                    &fs::read(entry.path()).map_err(|error| error.to_string())?,
                )
                .map_err(|error| format!("Observation locale invalide : {error}"))?;
                if let Err(error) = write_event_atomic(&target, &event) {
                    if !target.exists() {
                        return Err(error);
                    }
                }
            }
        }
    }
    Ok(())
}

fn copy_history_once(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(destination).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry.file_type().map_err(|error| error.to_string())?.is_file()
            || entry.path().extension().is_none_or(|extension| extension != "json")
        {
            continue;
        }
        let target = destination.join(entry.file_name());
        if target.exists() {
            continue;
        }
        let bytes = fs::read(entry.path()).map_err(|error| error.to_string())?;
        let _: ObservationPurgeArchive = serde_json::from_slice(&bytes)
            .map_err(|error| format!("Historique de notes invalide : {error}"))?;
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(target)
            .map_err(|error| error.to_string())?;
        file.write_all(&bytes).map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn migrate_legacy_notes(legacy_root: &Path, notes_root: &Path) -> Result<(), String> {
    if !legacy_root.is_dir() {
        return Ok(());
    }
    if !notes_root.exists() {
        if let Some(parent) = notes_root.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        if fs::rename(legacy_root, notes_root).is_ok() {
            return Ok(());
        }
    }
    copy_local_events_once(&legacy_root.join("events"), &notes_root.join("events"))?;
    fs::remove_dir_all(legacy_root).map_err(|error| {
        format!("Ancien stockage des notes impossible à retirer après migration : {error}")
    })
}

fn storage_context(app: &AppHandle, project_path: &Path) -> Result<StorageContext, String> {
    let local_notes_dir = project_path.join("notes");
    migrate_legacy_notes(&project_path.join(".paideia-observations"), &local_notes_dir)?;
    let local_events_dir = local_notes_dir.join("events");
    Ok(StorageContext {
        notes_dir: local_notes_dir,
        mirror_notes_dir: None,
        events_dir: local_events_dir.clone(),
        project_id: project_id(project_path)?,
        source_revision: String::new(),
        identity: local_identity(app)?,
        legacy_local_identity_id: None,
        collaborative: false,
        can_resolve: true,
        can_purge: true,
    })
}

fn clean_id(value: &str, label: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() || value.len() > 160 || value.chars().any(char::is_control) {
        return Err(format!("{label} invalide."));
    }
    Ok(value.to_string())
}

fn clean_text(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > MAX_TEXT_CHARS {
        return Err(format!(
            "L’observation doit contenir entre 1 et {MAX_TEXT_CHARS} caractères."
        ));
    }
    Ok(value.to_string())
}

fn read_events(path: &Path) -> Result<Vec<ObservationEvent>, String> {
    if !path.is_dir() {
        return Ok(Vec::new());
    }
    let mut events = Vec::new();
    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_file()
            || entry
                .path()
                .extension()
                .is_none_or(|extension| extension != "json")
        {
            continue;
        }
        let event: ObservationEvent =
            serde_json::from_slice(&fs::read(entry.path()).map_err(|error| error.to_string())?)
                .map_err(|error| format!("Événement d’observation invalide : {error}"))?;
        if event.schema_version != 1 {
            return Err("Version d’observation non prise en charge.".into());
        }
        events.push(event);
        if events.len() > MAX_EVENTS {
            return Err("Trop d’événements d’observation pour ce projet.".into());
        }
    }
    events.sort_by(|left, right| {
        left.created_at
            .cmp(&right.created_at)
            .then(left.id.cmp(&right.id))
    });
    Ok(events)
}

fn state_from_context(context: &StorageContext) -> Result<ObservationState, String> {
    let events = read_events(&context.events_dir)?;
    let mut threads: BTreeMap<String, ObservationThread> = BTreeMap::new();
    for mut event in events {
        if context.collaborative
            && context.legacy_local_identity_id.as_deref() == Some(event.author_id.as_str())
        {
            event.author_id.clone_from(&context.identity.id);
            event.author_display_name
                .clone_from(&context.identity.display_name);
        }
        if event.kind == "purge" {
            threads.clear();
            continue;
        }
        if event.kind == "delete" {
            if let Some(message) = threads
                .values_mut()
                .flat_map(|candidate| candidate.messages.iter_mut())
                .find(|message| message.id == event.target_message_id)
            {
                message.text.clear();
                message.deleted_at = Some(event.created_at);
                message.deleted_by_display_name = Some(event.author_display_name);
            }
            continue;
        }
        let thread = threads
            .entry(event.thread_id.clone())
            .or_insert_with(|| ObservationThread {
                id: event.thread_id.clone(),
                chapter_id: event.chapter_id.clone(),
                page_id: event.page_id.clone(),
                block_id: event.block_id.clone(),
                block_label: event.block_label.clone(),
                source_revision: event.source_revision.clone(),
                resolved: false,
                messages: Vec::new(),
            });
        match event.kind.as_str() {
            "create" | "reply" => thread.messages.push(ObservationMessage {
                id: event.id,
                author_id: event.author_id,
                author_display_name: event.author_display_name,
                text: event.text,
                created_at: event.created_at,
                deleted_at: None,
                deleted_by_display_name: None,
            }),
            "resolve" => thread.resolved = true,
            "reopen" => thread.resolved = false,
            _ => {}
        }
    }
    let mut threads = threads.into_values().collect::<Vec<_>>();
    threads.sort_by(|left, right| {
        right
            .messages
            .last()
            .map(|message| &message.created_at)
            .cmp(&left.messages.last().map(|message| &message.created_at))
    });
    let revision = threads
        .iter()
        .flat_map(|thread| thread.messages.iter())
        .map(|message| message.id.as_str())
        .max()
        .unwrap_or("")
        .to_string();
    Ok(ObservationState {
        threads,
        current_user_id: context.identity.id.clone(),
        current_user_display_name: context.identity.display_name.clone(),
        collaborative: context.collaborative,
        can_resolve: context.can_resolve,
        can_purge: context.can_purge,
        revision,
    })
}

fn append_event(context: &StorageContext, mut event: ObservationEvent) -> Result<(), String> {
    fs::create_dir_all(&context.events_dir).map_err(|error| error.to_string())?;
    for _ in 0..3 {
        event.id = uuid::Uuid::new_v4().to_string();
        let path = context.events_dir.join(format!("{}.json", event.id));
        match write_event_atomic(&path, &event) {
            Ok(()) => {
                if let Some(mirror_notes_dir) = &context.mirror_notes_dir {
                    let mirror_events_dir = mirror_notes_dir.join("events");
                    fs::create_dir_all(&mirror_events_dir).map_err(|error| error.to_string())?;
                    let mirror_path = mirror_events_dir.join(format!("{}.json", event.id));
                    if !mirror_path.exists() {
                        write_event_atomic(&mirror_path, &event)?;
                    }
                }
                return Ok(());
            }
            Err(_error) if path.exists() => continue,
            Err(error) => return Err(error),
        }
    }
    Err("Impossible d’attribuer un identifiant unique à l’observation.".into())
}

#[tauri::command]
pub fn list_observations(app: AppHandle, project_path: String) -> Result<ObservationState, String> {
    let context = storage_context(&app, &PathBuf::from(project_path))?;
    state_from_context(&context)
}

#[tauri::command]
pub fn create_observation(
    app: AppHandle,
    project_path: String,
    chapter_id: String,
    page_id: String,
    block_id: String,
    block_label: String,
    text: String,
) -> Result<ObservationState, String> {
    let context = storage_context(&app, &PathBuf::from(project_path))?;
    let thread_id = uuid::Uuid::new_v4().to_string();
    append_event(
        &context,
        ObservationEvent {
            schema_version: 1,
            id: String::new(),
            thread_id,
            kind: "create".into(),
            project_id: context.project_id.clone(),
            chapter_id: clean_id(&chapter_id, "Chapitre")?,
            page_id: clean_id(&page_id, "Page")?,
            block_id: clean_id(&block_id, "Activité")?,
            block_label: block_label.trim().chars().take(200).collect(),
            author_id: context.identity.id.clone(),
            author_display_name: context.identity.display_name.clone(),
            text: clean_text(&text)?,
            source_revision: context.source_revision.clone(),
            target_message_id: String::new(),
            created_at: chrono::Utc::now().to_rfc3339(),
        },
    )?;
    state_from_context(&context)
}

#[tauri::command]
pub fn reply_observation(
    app: AppHandle,
    project_path: String,
    thread_id: String,
    text: String,
) -> Result<ObservationState, String> {
    let context = storage_context(&app, &PathBuf::from(project_path))?;
    let thread_id = clean_id(&thread_id, "Fil")?;
    let state = state_from_context(&context)?;
    let thread = state
        .threads
        .iter()
        .find(|thread| thread.id == thread_id)
        .ok_or("Observation introuvable.")?;
    append_event(
        &context,
        ObservationEvent {
            schema_version: 1,
            id: String::new(),
            thread_id,
            kind: "reply".into(),
            project_id: context.project_id.clone(),
            chapter_id: thread.chapter_id.clone(),
            page_id: thread.page_id.clone(),
            block_id: thread.block_id.clone(),
            block_label: thread.block_label.clone(),
            author_id: context.identity.id.clone(),
            author_display_name: context.identity.display_name.clone(),
            text: clean_text(&text)?,
            source_revision: context.source_revision.clone(),
            target_message_id: String::new(),
            created_at: chrono::Utc::now().to_rfc3339(),
        },
    )?;
    state_from_context(&context)
}

#[tauri::command]
pub fn set_observation_resolved(
    app: AppHandle,
    project_path: String,
    thread_id: String,
    resolved: bool,
) -> Result<ObservationState, String> {
    let context = storage_context(&app, &PathBuf::from(project_path))?;
    if !context.can_resolve {
        return Err(
            "Seuls les collaborateurs autorisés à modifier peuvent traiter une observation.".into(),
        );
    }
    let thread_id = clean_id(&thread_id, "Fil")?;
    let state = state_from_context(&context)?;
    let thread = state
        .threads
        .iter()
        .find(|thread| thread.id == thread_id)
        .ok_or("Observation introuvable.")?;
    append_event(
        &context,
        ObservationEvent {
            schema_version: 1,
            id: String::new(),
            thread_id,
            kind: if resolved { "resolve" } else { "reopen" }.into(),
            project_id: context.project_id.clone(),
            chapter_id: thread.chapter_id.clone(),
            page_id: thread.page_id.clone(),
            block_id: thread.block_id.clone(),
            block_label: thread.block_label.clone(),
            author_id: context.identity.id.clone(),
            author_display_name: context.identity.display_name.clone(),
            text: String::new(),
            source_revision: context.source_revision.clone(),
            target_message_id: String::new(),
            created_at: chrono::Utc::now().to_rfc3339(),
        },
    )?;
    state_from_context(&context)
}

#[tauri::command]
pub fn delete_observation_message(
    app: AppHandle,
    project_path: String,
    message_id: String,
) -> Result<ObservationState, String> {
    let context = storage_context(&app, &PathBuf::from(project_path))?;
    let message_id = clean_id(&message_id, "Message")?;
    let state = state_from_context(&context)?;
    let (thread, message) = state
        .threads
        .iter()
        .find_map(|thread| {
            thread
                .messages
                .iter()
                .find(|message| message.id == message_id)
                .map(|message| (thread, message))
        })
        .ok_or("Note introuvable.")?;
    if message.author_id != context.identity.id {
        return Err("Seul l’auteur d’une note peut la supprimer.".into());
    }
    if message.deleted_at.is_some() {
        return Err("Cette note est déjà supprimée.".into());
    }
    append_event(
        &context,
        ObservationEvent {
            schema_version: 1,
            id: String::new(),
            thread_id: thread.id.clone(),
            kind: "delete".into(),
            project_id: context.project_id.clone(),
            chapter_id: thread.chapter_id.clone(),
            page_id: thread.page_id.clone(),
            block_id: thread.block_id.clone(),
            block_label: thread.block_label.clone(),
            author_id: context.identity.id.clone(),
            author_display_name: context.identity.display_name.clone(),
            text: String::new(),
            source_revision: context.source_revision.clone(),
            target_message_id: message_id,
            created_at: chrono::Utc::now().to_rfc3339(),
        },
    )?;
    state_from_context(&context)
}

#[tauri::command]
pub fn purge_observations(app: AppHandle, project_path: String) -> Result<ObservationState, String> {
    let context = storage_context(&app, &PathBuf::from(project_path))?;
    if !context.can_purge {
        return Err("Seul le propriétaire de la leçon peut purger toutes les notes.".into());
    }
    let events = read_events(&context.events_dir)?;
    if events.is_empty() {
        return state_from_context(&context);
    }
    let purged_at = chrono::Utc::now();
    let history_dir = context.notes_dir.join("history");
    fs::create_dir_all(&history_dir).map_err(|error| error.to_string())?;
    let archive_path = history_dir.join(format!(
        "purge-{}-{}.json",
        purged_at.format("%Y%m%dT%H%M%S"),
        uuid::Uuid::new_v4()
    ));
    write_json_new(
        &archive_path,
        &ObservationPurgeArchive {
            schema_version: 1,
            project_id: context.project_id.clone(),
            purged_at: purged_at.to_rfc3339(),
            purged_by_id: context.identity.id.clone(),
            purged_by_display_name: context.identity.display_name.clone(),
            events: events.clone(),
        },
    )?;
    if let Some(mirror_notes_dir) = &context.mirror_notes_dir {
        copy_history_once(&history_dir, &mirror_notes_dir.join("history"))?;
    }
    let purge_event = ObservationEvent {
        schema_version: 1,
        id: String::new(),
        thread_id: "purge".into(),
        kind: "purge".into(),
        project_id: context.project_id.clone(),
        chapter_id: String::new(),
        page_id: String::new(),
        block_id: String::new(),
        block_label: String::new(),
        author_id: context.identity.id.clone(),
        author_display_name: context.identity.display_name.clone(),
        text: String::new(),
        source_revision: context.source_revision.clone(),
        target_message_id: String::new(),
        created_at: purged_at.to_rfc3339(),
    };
    append_event(&context, purge_event)?;
    for event in events {
        let path = context.events_dir.join(format!("{}.json", event.id));
        if let Err(error) = fs::remove_file(&path) {
            if error.kind() != std::io::ErrorKind::NotFound {
                return Err(format!("Purge enregistrée, mais nettoyage incomplet : {error}"));
            }
        }
        if let Some(mirror_notes_dir) = &context.mirror_notes_dir {
            let mirror_path = mirror_notes_dir.join("events").join(format!("{}.json", event.id));
            if let Err(error) = fs::remove_file(&mirror_path) {
                if error.kind() != std::io::ErrorKind::NotFound {
                    return Err(format!("Purge enregistrée, mais nettoyage local incomplet : {error}"));
                }
            }
        }
    }
    state_from_context(&context)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_context(root: &Path) -> StorageContext {
        StorageContext {
            notes_dir: root.to_path_buf(),
            mirror_notes_dir: None,
            events_dir: root.join("events"),
            project_id: "project".into(),
            source_revision: String::new(),
            identity: ObservationIdentity {
                schema_version: 1,
                id: "user".into(),
                display_name: "User".into(),
            },
            legacy_local_identity_id: None,
            collaborative: false,
            can_resolve: true,
            can_purge: true,
        }
    }

    fn test_event(kind: &str, thread_id: &str, text: &str) -> ObservationEvent {
        ObservationEvent {
            schema_version: 1,
            id: String::new(),
            thread_id: thread_id.into(),
            kind: kind.into(),
            project_id: "project".into(),
            chapter_id: "chapter".into(),
            page_id: "page".into(),
            block_id: "block".into(),
            block_label: "Texte".into(),
            author_id: "user".into(),
            author_display_name: "User".into(),
            text: text.into(),
            source_revision: String::new(),
            target_message_id: String::new(),
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    #[test]
    fn append_only_events_preserve_every_contribution() {
        let root =
            std::env::temp_dir().join(format!("paideia-observations-{}", uuid::Uuid::new_v4()));
        let context = test_context(&root);
        for text in ["Première contribution", "Seconde contribution"] {
            append_event(&context, test_event(if text.starts_with("Prem") { "create" } else { "reply" }, "thread", text)).unwrap();
        }
        let state = state_from_context(&context).unwrap();
        assert_eq!(state.threads[0].messages.len(), 2);
        assert_eq!(fs::read_dir(&context.events_dir).unwrap().count(), 2);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn legacy_local_author_uses_connected_identity_in_collaboration() {
        let root = std::env::temp_dir().join(format!(
            "paideia-observation-collaborative-author-{}",
            uuid::Uuid::new_v4()
        ));
        let mut context = test_context(&root);
        context.collaborative = true;
        context.legacy_local_identity_id = Some("local-id".into());
        context.identity.id = "connected-id".into();
        context.identity.display_name = "Compte PAIDEIA".into();
        let mut event = test_event("create", "thread", "Note locale");
        event.author_id = "local-id".into();
        event.author_display_name = "session-windows".into();
        append_event(&context, event).unwrap();

        let state = state_from_context(&context).unwrap();
        let message = &state.threads[0].messages[0];
        assert_eq!(message.author_id, "connected-id");
        assert_eq!(message.author_display_name, "Compte PAIDEIA");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn delete_event_keeps_a_timestamped_tombstone_and_replies() {
        let root = std::env::temp_dir().join(format!("paideia-observation-delete-{}", uuid::Uuid::new_v4()));
        let context = test_context(&root);
        append_event(&context, test_event("create", "thread", "À supprimer")).unwrap();
        append_event(&context, test_event("reply", "thread", "Réponse conservée")).unwrap();
        let before = state_from_context(&context).unwrap();
        let target_message_id = before.threads[0].messages[0].id.clone();
        let mut deletion = test_event("delete", "thread", "");
        deletion.target_message_id = target_message_id;
        append_event(&context, deletion).unwrap();

        let after = state_from_context(&context).unwrap();
        assert_eq!(after.threads[0].messages.len(), 2);
        assert!(after.threads[0].messages[0].text.is_empty());
        assert!(after.threads[0].messages[0].deleted_at.is_some());
        assert_eq!(after.threads[0].messages[1].text, "Réponse conservée");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn purge_event_resets_visible_state_without_loading_history() {
        let root = std::env::temp_dir().join(format!("paideia-observation-purge-{}", uuid::Uuid::new_v4()));
        let context = test_context(&root);
        append_event(&context, test_event("create", "old-thread", "Ancienne note")).unwrap();
        append_event(&context, test_event("purge", "purge", "")).unwrap();
        append_event(&context, test_event("create", "new-thread", "Nouvelle note")).unwrap();

        let state = state_from_context(&context).unwrap();
        assert_eq!(state.threads.len(), 1);
        assert_eq!(state.threads[0].id, "new-thread");
        assert_eq!(state.threads[0].messages[0].text, "Nouvelle note");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn legacy_observation_folder_is_migrated_to_notes() {
        let root = std::env::temp_dir().join(format!("paideia-observation-migration-{}", uuid::Uuid::new_v4()));
        let legacy = root.join(".paideia-observations");
        let notes = root.join("notes");
        fs::create_dir_all(legacy.join("events")).unwrap();
        fs::write(legacy.join("events/event.json"), serde_json::to_vec(&test_event("create", "thread", "Migrée")).unwrap()).unwrap();

        migrate_legacy_notes(&legacy, &notes).unwrap();
        assert!(!legacy.exists());
        assert!(notes.join("events/event.json").is_file());
        fs::remove_dir_all(root).unwrap();
    }
}
