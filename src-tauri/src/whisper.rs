use crate::commands::{
    configured_ffmpeg_path_for_transcription, subtitle_generation_video_source,
    transcription_media_asset_source,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Read;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Emitter;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;
const MAX_PROCESS_OUTPUT_BYTES: u64 = 4 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
pub struct WhisperComponentValidation {
    pub kind: String,
    pub path: String,
    pub valid: bool,
    pub version: Option<String>,
    #[serde(rename = "sizeBytes")]
    pub size_bytes: Option<u64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WhisperConfigurationStatus {
    pub engine: WhisperComponentValidation,
    #[serde(rename = "smallModel")]
    pub small_model: WhisperComponentValidation,
    #[serde(rename = "mediumModel")]
    pub medium_model: WhisperComponentValidation,
    #[serde(rename = "ffmpegReady")]
    pub ffmpeg_ready: bool,
    pub ready: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SubtitleGenerationOptions {
    pub language: String,
    pub model: String,
    #[serde(default, rename = "outputKind")]
    pub output_kind: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SubtitleGenerationStartResult {
    #[serde(rename = "taskId")]
    pub task_id: String,
}

#[derive(Debug, Clone, Serialize)]
struct SubtitleGenerationEvent {
    #[serde(rename = "taskId")]
    task_id: String,
    state: String,
    progress: f64,
    #[serde(rename = "elapsedSeconds")]
    elapsed_seconds: f64,
    error: Option<String>,
    #[serde(rename = "vttContent")]
    vtt_content: Option<String>,
    #[serde(rename = "textContent")]
    text_content: Option<String>,
    #[serde(rename = "suggestedFileName")]
    suggested_file_name: Option<String>,
    #[serde(rename = "detectedLanguage", skip_serializing_if = "Option::is_none")]
    detected_language: Option<String>,
}

#[derive(Debug, Clone)]
struct SubtitleGenerationTask {
    project_path: String,
    block_id: String,
    cancel: Arc<AtomicBool>,
}

static SUBTITLE_GENERATION_TASKS: OnceLock<Mutex<HashMap<String, SubtitleGenerationTask>>> =
    OnceLock::new();

fn subtitle_generation_tasks() -> &'static Mutex<HashMap<String, SubtitleGenerationTask>> {
    SUBTITLE_GENERATION_TASKS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn empty_validation(kind: &str, path: &str) -> WhisperComponentValidation {
    WhisperComponentValidation {
        kind: kind.to_string(),
        path: path.to_string(),
        valid: false,
        version: None,
        size_bytes: None,
        error: None,
    }
}

fn normalized_path(value: &str) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Some(path) = value.strip_prefix(r"\\?\UNC\") {
            return PathBuf::from(format!(r"\\{}", path));
        }
        if let Some(path) = value.strip_prefix(r"\\?\") {
            return PathBuf::from(path);
        }
    }
    PathBuf::from(value)
}

fn canonical_user_path(path: &Path) -> PathBuf {
    let canonical = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    normalized_path(&canonical.to_string_lossy())
}

fn resolve_engine_path(raw_path: &str) -> PathBuf {
    let selected = normalized_path(raw_path);
    if selected.is_file() {
        return selected;
    }
    if selected.is_dir() {
        for relative_path in [
            PathBuf::from("whisper-cli.exe"),
            PathBuf::from("Release").join("whisper-cli.exe"),
            PathBuf::from("bin").join("whisper-cli.exe"),
        ] {
            let candidate = selected.join(relative_path);
            if candidate.is_file() {
                return candidate;
            }
        }
    }
    selected
}

fn read_limited<R: Read>(mut stream: R, max_bytes: u64) -> (Vec<u8>, bool) {
    let mut bytes = Vec::new();
    let mut buffer = [0_u8; 8192];
    let mut exceeded = false;
    loop {
        let read = match stream.read(&mut buffer) {
            Ok(0) => break,
            Ok(value) => value,
            Err(_) => break,
        };
        let remaining = max_bytes.saturating_sub(bytes.len() as u64) as usize;
        let retained = remaining.min(read);
        bytes.extend_from_slice(&buffer[..retained]);
        if retained < read {
            exceeded = true;
        }
    }
    (bytes, exceeded)
}

fn run_checked_command(
    mut command: Command,
    timeout: Duration,
) -> Result<(Vec<u8>, Vec<u8>), String> {
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|error| error.to_string())?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let stdout_reader = thread::spawn(move || {
        stdout
            .map(|stream| read_limited(stream, MAX_PROCESS_OUTPUT_BYTES))
            .unwrap_or_default()
    });
    let stderr_reader = thread::spawn(move || {
        stderr
            .map(|stream| read_limited(stream, MAX_PROCESS_OUTPUT_BYTES))
            .unwrap_or_default()
    });
    let started_at = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if started_at.elapsed() < timeout => thread::sleep(Duration::from_millis(50)),
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Le composant n'a pas répondu dans le délai prévu".to_string());
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(error.to_string());
            }
        }
    };
    let (stdout, stdout_exceeded) = stdout_reader.join().unwrap_or_default();
    let (stderr, stderr_exceeded) = stderr_reader.join().unwrap_or_default();
    if stdout_exceeded || stderr_exceeded {
        return Err("La sortie du composant est anormalement volumineuse".to_string());
    }
    if !status.success() {
        let stderr_text = String::from_utf8_lossy(&stderr);
        let detail = stderr_text
            .lines()
            .rev()
            .find(|line| !line.trim().is_empty())
            .unwrap_or("Le composant a retourné une erreur");
        return Err(detail.chars().take(500).collect());
    }
    Ok((stdout, stderr))
}

fn validate_engine(raw_path: &str) -> WhisperComponentValidation {
    let mut validation = empty_validation("engine", raw_path.trim());
    if validation.path.is_empty() {
        validation.error = Some("Aucun moteur sélectionné".to_string());
        return validation;
    }
    let path = resolve_engine_path(&validation.path);
    if !path.is_absolute() || !path.is_file() {
        validation.error = Some("Le dossier sélectionné ne contient pas whisper-cli.exe à la racine, dans Release ou dans bin".to_string());
        return validation;
    }
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if !file_name.eq_ignore_ascii_case("whisper-cli.exe") {
        validation.error = Some("Sélectionnez whisper-cli.exe".to_string());
        return validation;
    }
    validation.path = canonical_user_path(&path).to_string_lossy().to_string();
    let mut version_command = Command::new(&path);
    version_command.arg("--version");
    let output = run_checked_command(version_command, Duration::from_secs(20)).or_else(|_| {
        let mut help_command = Command::new(&path);
        help_command.arg("--help");
        run_checked_command(help_command, Duration::from_secs(20))
    });
    match output {
        Ok((stdout, stderr)) => {
            let stdout_text = String::from_utf8_lossy(&stdout);
            let stderr_text = String::from_utf8_lossy(&stderr);
            let version = stdout_text
                .lines()
                .chain(stderr_text.lines())
                .find(|line| !line.trim().is_empty())
                .map(|line| line.trim().chars().take(200).collect::<String>());
            validation.valid = true;
            validation.version = version;
        }
        Err(error) => validation.error = Some(format!("Impossible de vérifier Whisper : {error}")),
    }
    validation
}

fn validate_model(kind: &str, raw_path: &str) -> WhisperComponentValidation {
    let mut validation = empty_validation(kind, raw_path.trim());
    if validation.path.is_empty() {
        validation.error = Some("Aucun modèle sélectionné".to_string());
        return validation;
    }
    let path = normalized_path(&validation.path);
    if !path.is_absolute() || !path.is_file() {
        validation.error = Some("Le modèle sélectionné est introuvable".to_string());
        return validation;
    }
    if path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        != "bin"
    {
        validation.error = Some("Sélectionnez un modèle Whisper au format .bin".to_string());
        return validation;
    }
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let expected_family = if kind == "small" { "small" } else { "medium" };
    if !file_name.contains(expected_family) {
        validation.error = Some(format!("Sélectionnez un modèle {expected_family}"));
        return validation;
    }
    let size = match fs::metadata(&path) {
        Ok(metadata) => metadata.len(),
        Err(error) => {
            validation.error = Some(error.to_string());
            return validation;
        }
    };
    if size < 10 * 1024 * 1024 {
        validation.error = Some("Le fichier du modèle paraît incomplet".to_string());
        return validation;
    }
    validation.path = canonical_user_path(&path).to_string_lossy().to_string();
    validation.size_bytes = Some(size);
    validation.valid = true;
    validation
}

#[tauri::command]
pub fn validate_whisper_component_path(kind: String, path: String) -> WhisperComponentValidation {
    match kind.as_str() {
        "engine" => validate_engine(&path),
        "small" | "medium" => validate_model(&kind, &path),
        _ => {
            let mut validation = empty_validation(&kind, &path);
            validation.error = Some("Composant Whisper inconnu".to_string());
            validation
        }
    }
}

#[tauri::command]
pub fn inspect_whisper_configuration(
    whisper_cli_path: Option<String>,
    whisper_small_model_path: Option<String>,
    whisper_medium_model_path: Option<String>,
) -> WhisperConfigurationStatus {
    let engine = validate_engine(whisper_cli_path.as_deref().unwrap_or_default());
    let small_model = validate_model(
        "small",
        whisper_small_model_path.as_deref().unwrap_or_default(),
    );
    let medium_model = validate_model(
        "medium",
        whisper_medium_model_path.as_deref().unwrap_or_default(),
    );
    let ffmpeg_ready = configured_ffmpeg_path_for_transcription().is_ok();
    let ready = engine.valid && ffmpeg_ready && (small_model.valid || medium_model.valid);
    WhisperConfigurationStatus {
        engine,
        small_model,
        medium_model,
        ffmpeg_ready,
        ready,
    }
}

fn validate_language(value: &str) -> Result<String, String> {
    let normalized = value.trim().to_ascii_lowercase();
    const LANGUAGES: &[&str] = &[
        "auto", "fr", "en", "de", "es", "it", "pt", "nl", "pl", "tr", "ro", "cs", "da", "sv", "fi",
        "el", "hu", "bg", "hr", "et", "lt", "lv", "sk", "sl", "mt", "cy", "eu", "br",
    ];
    LANGUAGES
        .contains(&normalized.as_str())
        .then_some(normalized)
        .ok_or_else(|| "Langue de transcription non prise en charge".to_string())
}

fn emit_event(app: &tauri::AppHandle, event: SubtitleGenerationEvent) {
    let _ = app.emit("subtitle-generation-progress", event);
}

fn run_cancellable_process<F>(
    mut command: Command,
    cancel: Arc<AtomicBool>,
    mut on_tick: F,
) -> Result<(Vec<u8>, Vec<u8>), String>
where
    F: FnMut(),
{
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|error| error.to_string())?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let stdout_reader = thread::spawn(move || {
        stdout
            .map(|stream| read_limited(stream, MAX_PROCESS_OUTPUT_BYTES))
            .unwrap_or_default()
    });
    let stderr_reader = thread::spawn(move || {
        stderr
            .map(|stream| read_limited(stream, MAX_PROCESS_OUTPUT_BYTES))
            .unwrap_or_default()
    });
    let status = loop {
        if cancel.load(Ordering::Relaxed) {
            let _ = child.kill();
            let _ = child.wait();
            let _ = stdout_reader.join();
            let _ = stderr_reader.join();
            return Err("__CANCELLED__".to_string());
        }
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                on_tick();
                thread::sleep(Duration::from_millis(250));
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(error.to_string());
            }
        }
    };
    let (stdout, stdout_exceeded) = stdout_reader.join().unwrap_or_default();
    let (stderr, stderr_exceeded) = stderr_reader.join().unwrap_or_default();
    if stdout_exceeded || stderr_exceeded {
        return Err("La sortie du composant est anormalement volumineuse".to_string());
    }
    if !status.success() {
        let stderr_text = String::from_utf8_lossy(&stderr);
        let stdout_text = String::from_utf8_lossy(&stdout);
        let detail = stderr_text
            .lines()
            .rev()
            .find(|line| !line.trim().is_empty())
            .or_else(|| {
                stdout_text
                    .lines()
                    .rev()
                    .find(|line| !line.trim().is_empty())
            })
            .unwrap_or("Le composant a retourné une erreur");
        return Err(detail.chars().take(500).collect());
    }
    Ok((stdout, stderr))
}

fn detected_whisper_language(stdout: &[u8], stderr: &[u8]) -> Option<String> {
    let output = format!(
        "{}\n{}",
        String::from_utf8_lossy(stdout),
        String::from_utf8_lossy(stderr)
    );
    let pattern = regex::Regex::new(
        r"(?i)(?:auto[- ]detected|detected)\s+language\s*:\s*([a-z]{2,3})(?:\s|\(|$)",
    )
    .expect("valid Whisper detected language regex");
    pattern
        .captures(&output)
        .and_then(|captures| captures.get(1))
        .map(|value| value.as_str().to_ascii_lowercase())
}

const SUBTITLE_MAX_LINE_CHARS: usize = 42;
const SUBTITLE_MAX_WORDS_PER_LINE: usize = 8;
const SUBTITLE_MAX_WORDS: usize = 14;
const SUBTITLE_TARGET_WORDS: usize = 9;

#[derive(Debug, Clone)]
struct RawSubtitleCue {
    start_ms: u64,
    end_ms: u64,
    text: String,
}

#[derive(Debug, Clone)]
struct TimedSubtitleWord {
    text: String,
    start_ms: u64,
    end_ms: u64,
    source_break_after: bool,
}

fn parse_vtt_time(value: &str) -> Option<u64> {
    let normalized = value.trim().replace(',', ".");
    let mut parts = normalized.split(':').collect::<Vec<_>>();
    if parts.len() == 2 {
        parts.insert(0, "0");
    }
    if parts.len() != 3 {
        return None;
    }
    let hours = parts[0].parse::<u64>().ok()?;
    let minutes = parts[1].parse::<u64>().ok()?;
    let mut seconds_parts = parts[2].split('.');
    let seconds = seconds_parts.next()?.parse::<u64>().ok()?;
    let milliseconds_text = seconds_parts.next().unwrap_or("0");
    let milliseconds = format!("{milliseconds_text:0<3}")
        .chars()
        .take(3)
        .collect::<String>()
        .parse::<u64>()
        .ok()?;
    Some((((hours * 60) + minutes) * 60 + seconds) * 1000 + milliseconds)
}

fn format_vtt_time(value_ms: u64) -> String {
    let milliseconds = value_ms % 1000;
    let total_seconds = value_ms / 1000;
    let seconds = total_seconds % 60;
    let total_minutes = total_seconds / 60;
    let minutes = total_minutes % 60;
    let hours = total_minutes / 60;
    format!("{hours:02}:{minutes:02}:{seconds:02}.{milliseconds:03}")
}

fn parse_vtt_cues(source: &str) -> Vec<RawSubtitleCue> {
    source
        .split("\n\n")
        .filter_map(|block| {
            let lines = block.lines().collect::<Vec<_>>();
            let timing_index = lines.iter().position(|line| line.contains("-->"))?;
            let mut timing = lines[timing_index].split("-->");
            let start_ms = parse_vtt_time(timing.next()?)?;
            let end_token = timing.next()?.split_whitespace().next()?;
            let end_ms = parse_vtt_time(end_token)?;
            if end_ms <= start_ms {
                return None;
            }
            let text = lines
                .iter()
                .skip(timing_index + 1)
                .map(|line| line.trim())
                .filter(|line| !line.is_empty())
                .collect::<Vec<_>>()
                .join(" ");
            (!text.is_empty()).then_some(RawSubtitleCue {
                start_ms,
                end_ms,
                text,
            })
        })
        .collect()
}

fn normalized_word(value: &str) -> String {
    value
        .trim_matches(|character: char| {
            !character.is_alphanumeric() && character != '\'' && character != '’'
        })
        .to_lowercase()
}

fn timed_words(cues: &[RawSubtitleCue]) -> Vec<TimedSubtitleWord> {
    let mut words = Vec::new();
    for cue in cues {
        let cue_words = cue.text.split_whitespace().collect::<Vec<_>>();
        if cue_words.is_empty() {
            continue;
        }
        let weights = cue_words
            .iter()
            .map(|word| {
                word.chars()
                    .filter(|character| character.is_alphanumeric())
                    .count()
                    .max(1) as u64
            })
            .collect::<Vec<_>>();
        let total_weight = weights.iter().sum::<u64>().max(1);
        let duration = cue.end_ms.saturating_sub(cue.start_ms);
        let mut elapsed_weight = 0_u64;
        for (index, word) in cue_words.iter().enumerate() {
            let start_ms = cue.start_ms + duration.saturating_mul(elapsed_weight) / total_weight;
            elapsed_weight += weights[index];
            let end_ms = cue.start_ms + duration.saturating_mul(elapsed_weight) / total_weight;
            if index == 0
                && words
                    .last()
                    .map(|previous: &TimedSubtitleWord| {
                        previous.source_break_after
                            && normalized_word(&previous.text) == normalized_word(word)
                    })
                    .unwrap_or(false)
            {
                continue;
            }
            words.push(TimedSubtitleWord {
                text: (*word).to_string(),
                start_ms,
                end_ms,
                source_break_after: index + 1 == cue_words.len(),
            });
        }
    }
    words
}

fn ends_sentence(value: &str) -> bool {
    value
        .trim_end_matches(['"', '”', '\'', '’', ')', ']', '»'])
        .ends_with(['.', '!', '?'])
}

fn ends_clause(value: &str) -> bool {
    value.trim_end_matches(['"', '”', '\'', '’', ')', ']', '»'])
        .ends_with([';', ':', ','])
}

fn is_french_glue_word(value: &str) -> bool {
    matches!(
        normalized_word(value).as_str(),
        "à" | "au" | "aux" | "avec" | "car" | "ce" | "ces" | "cet" | "cette" | "chez"
            | "dans" | "de" | "des" | "du" | "en" | "et" | "la" | "le" | "les" | "leur"
            | "leurs" | "mais" | "ni" | "notre" | "nos" | "ou" | "par" | "pour" | "que"
            | "quel" | "quelle" | "quelles" | "quels" | "qui" | "sans" | "ses" | "son"
            | "sous" | "sur" | "un" | "une" | "vers" | "votre" | "vos"
    ) || value.ends_with('\'')
        || value.ends_with('’')
        || value.ends_with('-')
}

fn bad_subtitle_break(left: &str, right: &str) -> bool {
    is_french_glue_word(left)
        || right.starts_with(|character: char| matches!(character, ',' | ';' | ':' | '.' | '!' | '?'))
}

fn starts_french_clause(value: &str) -> bool {
    matches!(
        normalized_word(value).as_str(),
        "car" | "cependant" | "donc" | "dont" | "lorsque" | "mais" | "où" | "puisque"
            | "quand" | "que" | "qui"
    )
}

fn wrapped_subtitle_lines(words: &[TimedSubtitleWord]) -> Option<Vec<String>> {
    let text = words
        .iter()
        .map(|word| word.text.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    if text.chars().count() <= SUBTITLE_MAX_LINE_CHARS
        && words.len() <= SUBTITLE_MAX_WORDS_PER_LINE
    {
        return Some(vec![text]);
    }
    let mut best: Option<(usize, usize, String, String)> = None;
    for split in 1..words.len() {
        if bad_subtitle_break(&words[split - 1].text, &words[split].text) {
            continue;
        }
        let first = words[..split]
            .iter()
            .map(|word| word.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");
        let second = words[split..]
            .iter()
            .map(|word| word.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");
        let first_length = first.chars().count();
        let second_length = second.chars().count();
        if first_length > SUBTITLE_MAX_LINE_CHARS
            || second_length > SUBTITLE_MAX_LINE_CHARS
            || split > SUBTITLE_MAX_WORDS_PER_LINE
            || words.len() - split > SUBTITLE_MAX_WORDS_PER_LINE
        {
            continue;
        }
        let orphan_penalty = usize::from(split == 1 || words.len() - split == 1) * 100;
        let balance = first_length.abs_diff(second_length);
        let score = orphan_penalty + balance;
        if best.as_ref().map(|candidate| score < candidate.0).unwrap_or(true) {
            best = Some((score, split, first, second));
        }
    }
    best.map(|(_, _, first, second)| vec![first, second])
}

fn subtitle_boundary_score(words: &[TimedSubtitleWord], start: usize, end: usize) -> i32 {
    let word_count = end - start + 1;
    let current = &words[end];
    let next = words.get(end + 1);
    if next
        .map(|next_word| bad_subtitle_break(&current.text, &next_word.text))
        .unwrap_or(false)
    {
        return i32::MIN;
    }
    let punctuation_score = if ends_sentence(&current.text) {
        100
    } else if ends_clause(&current.text) {
        55
    } else if current.source_break_after {
        20
    } else {
        0
    };
    let clause_score = next
        .map(|next_word| starts_french_clause(&next_word.text))
        .map(i32::from)
        .unwrap_or(0)
        * 35;
    let target_penalty = word_count.abs_diff(SUBTITLE_TARGET_WORDS) as i32 * 4;
    let short_tail_penalty = next
        .map(|_| words.len().saturating_sub(end + 1))
        .filter(|remaining| *remaining <= 2)
        .map(|_| 45)
        .unwrap_or(0);
    punctuation_score + clause_score - target_penalty - short_tail_penalty
}

fn resegment_vtt(cues: &[RawSubtitleCue]) -> Result<String, String> {
    let words = timed_words(cues);
    if words.is_empty() {
        return Err("Aucune parole n'a été détectée".to_string());
    }
    let mut output = String::from("WEBVTT\n\n");
    let mut start = 0usize;
    while start < words.len() {
        let max_end = (start + SUBTITLE_MAX_WORDS).min(words.len()) - 1;
        let mut candidates = Vec::new();
        for end in start..=max_end {
            if wrapped_subtitle_lines(&words[start..=end]).is_none() {
                break;
            }
            let score = subtitle_boundary_score(&words, start, end);
            if score > i32::MIN {
                candidates.push((score, end));
            }
            if ends_sentence(&words[end].text) && end + 1 - start >= 2 {
                break;
            }
        }
        let end = candidates
            .into_iter()
            .max_by_key(|(score, end)| (*score, *end))
            .map(|(_, end)| end)
            .unwrap_or(start);
        let lines = wrapped_subtitle_lines(&words[start..=end])
            .ok_or_else(|| "Impossible de découper les sous-titres générés".to_string())?;
        output.push_str(&format!(
            "{} --> {}\n{}\n\n",
            format_vtt_time(words[start].start_ms),
            format_vtt_time(words[end].end_ms.max(words[start].start_ms + 1)),
            lines.join("\n")
        ));
        start = end + 1;
    }
    Ok(format!("{}\n", output.trim_end()))
}

fn normalize_vtt(source: &str) -> Result<String, String> {
    let normalized = source
        .trim_start_matches('\u{feff}')
        .replace("\r\n", "\n")
        .replace('\r', "\n");
    if !normalized.trim_start().starts_with("WEBVTT") {
        return Err("Whisper n'a pas produit un fichier WebVTT valide".to_string());
    }
    let cues = parse_vtt_cues(&normalized);
    if cues.is_empty() {
        return Err("Aucune parole n'a été détectée".to_string());
    }
    resegment_vtt(&cues)
}

fn normalize_transcript_text(source: &str) -> Result<String, String> {
    let normalized = source
        .trim_start_matches('\u{feff}')
        .replace("\r\n", "\n")
        .replace('\r', "\n");
    let paragraphs = normalized
        .split("\n\n")
        .map(|paragraph| {
            paragraph.lines().map(str::trim).filter(|line| !line.is_empty()).collect::<Vec<_>>().join(" ")
        })
        .filter(|paragraph| !paragraph.is_empty())
        .collect::<Vec<_>>();
    if paragraphs.is_empty() {
        return Err("Aucune parole n'a été détectée".to_string());
    }
    Ok(paragraphs.join("\n\n"))
}

fn finish_task(task_id: &str) {
    if let Ok(mut tasks) = subtitle_generation_tasks().lock() {
        tasks.remove(task_id);
    }
}

#[tauri::command]
pub fn start_subtitle_generation(
    app: tauri::AppHandle,
    task_id: String,
    project_path: String,
    block_id: String,
    asset_ref: Option<String>,
    options: SubtitleGenerationOptions,
    whisper_cli_path: String,
    whisper_small_model_path: Option<String>,
    whisper_medium_model_path: Option<String>,
) -> Result<SubtitleGenerationStartResult, String> {
    if task_id.len() > 160
        || task_id.is_empty()
        || !task_id.chars().all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err("Identifiant de transcription invalide".to_string());
    }
    let engine = validate_engine(&whisper_cli_path);
    if !engine.valid {
        return Err(engine.error.unwrap_or_else(|| "Moteur Whisper indisponible".to_string()));
    }
    let model_validation = match options.model.as_str() {
        "small" => validate_model("small", whisper_small_model_path.as_deref().unwrap_or_default(),
        ),
        "medium" => validate_model("medium", whisper_medium_model_path.as_deref().unwrap_or_default(),
        ),
        _ => return Err("Modèle Whisper inconnu".to_string()),
    };
    if !model_validation.valid {
        return Err(model_validation.error.unwrap_or_else(|| "Modèle Whisper indisponible".to_string()));
    }
    let language = validate_language(&options.language)?;
    let ffmpeg = configured_ffmpeg_path_for_transcription()?;
    let output_kind = options.output_kind.unwrap_or_else(|| "subtitles".to_string());
    if !matches!(output_kind.as_str(), "subtitles" | "transcript") {
        return Err("Type de transcription inconnu".to_string());
    }
    let (source_ref, source_path) = if output_kind == "transcript" {
        transcription_media_asset_source(
            &project_path,
            asset_ref.as_deref().filter(|value| !value.trim().is_empty()).ok_or_else(|| {
                    "Aucun fichier audio n'est associé à cette transcription".to_string()
                })?,
        )?
    } else {
        subtitle_generation_video_source(&project_path, &block_id, asset_ref.as_deref())?
    };
    {
        let tasks = subtitle_generation_tasks()
            .lock()
            .map_err(|_| "Gestionnaire de transcription indisponible".to_string())?;
        if tasks.values().any(|task| task.project_path == project_path && task.block_id == block_id) {
            return Err("Une transcription est déjà en cours pour cette activité".to_string());
        }
    }
    let cancel = Arc::new(AtomicBool::new(false));
    subtitle_generation_tasks()
        .lock()
        .map_err(|_| "Gestionnaire de transcription indisponible".to_string())?
        .insert(task_id.clone(), SubtitleGenerationTask {
            project_path: project_path.clone(),
            block_id: block_id.clone(),
            cancel: cancel.clone(),
        },
        );
    let worker_task_id = task_id.clone();
    let engine_path = PathBuf::from(engine.path);
    let model_path = PathBuf::from(model_validation.path);
    thread::spawn(move || {
        let started_at = Instant::now();
        let temp_root = std::env::temp_dir()
            .join("paideia-subtitle-generation")
            .join(&worker_task_id);
        let audio_path = temp_root.join("audio.wav");
        let output_base = temp_root.join("draft");
        let output_vtt = temp_root.join("draft.vtt");
        let output_txt = temp_root.join("draft.txt");
        if let Err(error) = fs::create_dir_all(&temp_root) {
            emit_event(&app, SubtitleGenerationEvent {
                task_id: worker_task_id.clone(),
                state: "failed".to_string(),
                progress: 0.0,
                elapsed_seconds: started_at.elapsed().as_secs_f64(),
                error: Some(format!("Impossible de préparer les fichiers temporaires : {error}")),
                vtt_content: None,
                text_content: None,
                suggested_file_name: None,
                detected_language: None,
            },
            );
            finish_task(&worker_task_id);
            return;
        }
        emit_event(&app, SubtitleGenerationEvent {
            task_id: worker_task_id.clone(),
            state: "extracting-audio".to_string(),
            progress: 5.0,
            elapsed_seconds: 0.0,
            error: None,
            vtt_content: None,
            text_content: None,
            suggested_file_name: None,
            detected_language: None,
        },
        );
        let mut ffmpeg_command = Command::new(&ffmpeg);
        ffmpeg_command.args([
            "-hide_banner", "-loglevel", "error", "-y", "-i"]);
        ffmpeg_command.arg(&source_path);
        ffmpeg_command.args(["-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le"]);
        ffmpeg_command.arg(&audio_path);
        let extraction = run_cancellable_process(ffmpeg_command, cancel.clone(), || {
            emit_event(&app, SubtitleGenerationEvent {
                task_id: worker_task_id.clone(),
                state: "extracting-audio".to_string(),
                progress: 15.0,
                elapsed_seconds: started_at.elapsed().as_secs_f64(),
                error: None,
                vtt_content: None,
                text_content: None,
                suggested_file_name: None,
                detected_language: None,
            },
            );
        });
        if let Err(error) = extraction {
            let cancelled = error == "__CANCELLED__";
            emit_event(&app, SubtitleGenerationEvent {
                task_id: worker_task_id.clone(),
                state: if cancelled { "cancelled" } else { "failed" }.to_string(),
                progress: 15.0,
                elapsed_seconds: started_at.elapsed().as_secs_f64(),
                error: (!cancelled).then_some(if error.trim().is_empty() {
                    "Impossible d'extraire la piste audio".to_string()
                } else {
                    error
                }),
                vtt_content: None,
                text_content: None,
                suggested_file_name: None,
                detected_language: None,
            },
            );
            let _ = fs::remove_dir_all(&temp_root);
            finish_task(&worker_task_id);
            return;
        }
        emit_event(&app, SubtitleGenerationEvent {
            task_id: worker_task_id.clone(),
            state: "transcribing".to_string(),
            progress: 30.0,
            elapsed_seconds: started_at.elapsed().as_secs_f64(),
            error: None,
            vtt_content: None,
            text_content: None,
            suggested_file_name: None,
            detected_language: None,
        },
        );
        let mut whisper_command = Command::new(&engine_path);
        whisper_command.arg("-m").arg(&model_path);
        whisper_command.arg("-f").arg(&audio_path);
        whisper_command.arg("-l").arg(&language);
        whisper_command.arg(if output_kind == "transcript" { "-otxt" } else { "-ovtt" }).arg("-of").arg(&output_base);
        let transcription = run_cancellable_process(whisper_command, cancel, || {
            emit_event(&app, SubtitleGenerationEvent {
                task_id: worker_task_id.clone(),
                state: "transcribing".to_string(),
                progress: 60.0,
                elapsed_seconds: started_at.elapsed().as_secs_f64(),
                error: None,
                vtt_content: None,
                text_content: None,
                suggested_file_name: None,
                detected_language: None,
            },
            );
        });
        let event = match transcription {
            Err(error) if error == "__CANCELLED__" => SubtitleGenerationEvent {
                task_id: worker_task_id.clone(),
                state: "cancelled".to_string(),
                progress: 60.0,
                elapsed_seconds: started_at.elapsed().as_secs_f64(),
                error: None,
                vtt_content: None,
                text_content: None,
                suggested_file_name: None,
                detected_language: None,
            },
            Err(error) => SubtitleGenerationEvent {
                task_id: worker_task_id.clone(),
                state: "failed".to_string(),
                progress: 60.0,
                elapsed_seconds: started_at.elapsed().as_secs_f64(),
                error: Some(error),
                vtt_content: None,
                text_content: None,
                suggested_file_name: None,
                detected_language: None,
            },
            Ok((stdout, stderr)) => {
                let result_language = if language == "auto" {
                    detected_whisper_language(&stdout, &stderr).unwrap_or_else(|| "und".to_string())
                } else {
                    language.clone()
                };
                match fs::read_to_string(if output_kind == "transcript" { &output_txt } else { &output_vtt })
                    .map_err(|error| error.to_string())
                    .and_then(|content| {
                    if output_kind == "transcript" { normalize_transcript_text(&content) } else { normalize_vtt(&content) }
                })
                {
                Ok(generated_content) => {
                    let stem = Path::new(&source_ref)
                        .file_stem()
                        .and_then(|value| value.to_str())
                        .filter(|value| !value.trim().is_empty())
                        .unwrap_or("subtitles");
                    SubtitleGenerationEvent {
                        task_id: worker_task_id.clone(),
                        state: "completed".to_string(),
                        progress: 100.0,
                        elapsed_seconds: started_at.elapsed().as_secs_f64(),
                        error: None,
                        vtt_content: (output_kind == "subtitles").then_some(generated_content.clone()),
                        text_content: (output_kind == "transcript").then_some(generated_content),
                        suggested_file_name: Some(format!("{stem}.{}", if output_kind == "transcript" { "txt" } else { "vtt" })),
                        detected_language: Some(result_language),
                    }
                }
                Err(error) => SubtitleGenerationEvent {
                    task_id: worker_task_id.clone(),
                    state: "failed".to_string(),
                    progress: 100.0,
                    elapsed_seconds: started_at.elapsed().as_secs_f64(),
                    error: Some(error),
                    vtt_content: None,
                    text_content: None,
                    suggested_file_name: None,
                    detected_language: None,
                },
                }
            }
        };
        emit_event(&app, event);
        let _ = fs::remove_dir_all(&temp_root);
        finish_task(&worker_task_id);
    });
    Ok(SubtitleGenerationStartResult { task_id })
}

#[tauri::command]
pub fn cancel_subtitle_generation(task_id: String) -> Result<(), String> {
    let tasks = subtitle_generation_tasks()
        .lock()
        .map_err(|_| "Gestionnaire de transcription indisponible".to_string())?;
    let task = tasks
        .get(&task_id)
        .ok_or_else(|| "Tâche de transcription introuvable".to_string())?;
    task.cancel.store(true, Ordering::Relaxed);
    Ok(())
}

pub fn cancel_all_subtitle_generations() -> bool {
    let Ok(tasks) = subtitle_generation_tasks().lock() else {
        return false;
    };
    if tasks.is_empty() {
        return false;
    }
    for task in tasks.values() {
        task.cancel.store(true, Ordering::Relaxed);
    }
    true
}

#[cfg(test)]
mod tests {
    use super::{detected_whisper_language, normalize_transcript_text, normalize_vtt, normalized_path, validate_language,
    };

    #[test]
    fn subtitle_generation_accepts_supported_languages() {
        assert_eq!(validate_language("FR").unwrap(), "fr");
        assert_eq!(validate_language(" auto ").unwrap(), "auto");
        assert!(validate_language("co").is_err());
        assert!(validate_language("sc").is_err());
        assert!(validate_language("ga").is_err());
        assert!(validate_language("xx").is_err());
    }

    #[test]
    fn subtitle_generation_normalizes_webvtt() {
        let result = normalize_vtt("\u{feff}WEBVTT\r\n\r\n00:00:00.000 --> 00:00:01.000\r\nBonjour\r\n")
            .unwrap();
        assert_eq!(
            result,
            "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nBonjour\n"
        );
    }

    #[test]
    fn subtitle_generation_rejects_empty_webvtt() {
        assert!(normalize_vtt("WEBVTT\n\n").is_err());
        assert!(normalize_vtt("not-vtt").is_err());
    }

    #[test]
    fn subtitle_generation_reads_whisper_detected_language() {
        let stderr = b"whisper_full_with_state: auto-detected language: fr (p = 0.991)";
        assert_eq!(detected_whisper_language(&[], stderr).as_deref(), Some("fr"));
        assert_eq!(detected_whisper_language(b"detected language: DE", &[]).as_deref(), Some("de"));
        assert_eq!(detected_whisper_language(b"transcription completed", &[]), None);
    }

    #[test]
    fn transcript_generation_normalizes_paragraphs_without_timestamps() {
        let result = normalize_transcript_text("\u{feff} Première ligne.\r\nDeuxième ligne.\r\n\r\n Nouveau paragraphe. \r\n",
        )
            .expect("normalize generated transcript");
        assert_eq!(result, "Première ligne. Deuxième ligne.\n\nNouveau paragraphe.");
        assert!(normalize_transcript_text(" \r\n ").is_err());
    }

    #[test]
    fn subtitle_generation_resegments_long_whisper_lines_for_readability() {
        let source = r#"WEBVTT

00:00:00.000 --> 00:00:03.560
 Bonjour et bienvenue, je serai votre guide pour cette première séquence qui pose les

00:00:03.560 --> 00:00:08.160
 fondations de votre formation, car avant d'agir, il faut d'abord comprendre notre environnement.

00:00:08.160 --> 00:00:12.640
 Nous avancerons en trois temps. Dans la première section, nous aborderons les grands enjeux

00:00:12.640 --> 00:00:17.400
 de la cybersécurité. Vous comprendrez pourquoi le ministère est une cible, quelles menaces
"#;
        let result = normalize_vtt(source).expect("resegment generated subtitles");
        let text_lines = result
            .lines()
            .filter(|line| !line.is_empty() && *line != "WEBVTT" && !line.contains("-->"))
            .collect::<Vec<_>>();

        assert!(text_lines
            .iter()
            .all(|line| line.chars().count() <= 42));
        assert!(text_lines
            .iter()
            .all(|line| line.split_whitespace().count() <= 8));
        assert!(!result.contains("pose les\nfondations"));
        assert!(!result.contains("de la\ncybersécurité"));
        assert!(result.matches(" --> ").count() > 4);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn whisper_paths_hide_windows_extended_length_prefixes() {
        assert_eq!(
            normalized_path(r"\\?\C:\whisper\bin\whisper-cli.exe"),
            std::path::PathBuf::from(r"C:\whisper\bin\whisper-cli.exe")
        );
        assert_eq!(
            normalized_path(r"\\?\UNC\server\share\whisper-cli.exe"),
            std::path::PathBuf::from(r"\\server\share\whisper-cli.exe")
        );
    }
}
