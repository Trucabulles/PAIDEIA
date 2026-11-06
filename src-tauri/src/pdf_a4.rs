#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

// A WebView2 environment must be owned by a live native controller. This
// isolated helper never starts the editor, distribution setup or project IPC.
#[cfg(debug_assertions)]
pub fn run_print_host() {
    let profile = std::env::args().nth(2).expect("Missing PDF print profile");
    let runtime = std::env::args()
        .nth(3)
        .expect("Missing bundled WebView2 runtime");
    std::env::set_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", runtime);
    std::env::remove_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS");
    std::env::remove_var("WEBVIEW2_USER_DATA_FOLDER");
    let mut context = tauri::generate_context!();
    for window in &mut context.config_mut().app.windows {
        window.create = false;
    }
    tauri::Builder::default()
        .setup(move |app| {
            tauri::WebviewWindowBuilder::new(app, "pdf-print-host", tauri::WebviewUrl::External("about:blank".parse()?))
                .title("PAIDEIA — PDF")
                .visible(false)
                .focused(false)
                .decorations(false)
                .skip_taskbar(true)
                .data_directory(PathBuf::from(&profile))
                .additional_browser_args("--remote-debugging-port=0 --disable-background-networking --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows")
                .build()?;
            Ok(())
        })
        .run(context)
        .expect("Unable to initialize PAIDEIA PDF print host");
}

// Tauri can return verbatim Windows paths. Node's entry-point resolver rejects
// these paths before loading the generator; pass ordinary drive/UNC paths.
fn process_path(path: &Path) -> PathBuf {
    let value = path.to_string_lossy();
    if let Some(rest) = value.strip_prefix(r"\\?\UNC\") {
        return PathBuf::from(format!(r"\\{}", rest));
    }
    if let Some(rest) = value.strip_prefix(r"\\?\") {
        return PathBuf::from(rest);
    }
    path.to_path_buf()
}

#[tauri::command]
pub async fn generate_pdf_a4(
    app: AppHandle,
    source_path: String,
    target_path: String,
    profile: Option<String>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        generate_pdf_a4_blocking(app, source_path, target_path, profile)
    })
    .await
    .map_err(|error| format!("La tâche PDF A4 s'est interrompue : {error}"))?
}

fn generate_pdf_a4_blocking(
    app: AppHandle,
    source_path: String,
    target_path: String,
    profile: Option<String>,
) -> Result<String, String> {
    if !matches!(profile.as_deref(), None | Some("review") | Some("learner")) {
        return Err("Profil PDF invalide.".into());
    }
    let target = Path::new(&target_path);
    if !target.is_absolute()
        || !target
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value.eq_ignore_ascii_case("pdf"))
    {
        return Err("Chemin PDF invalide.".into());
    }
    let source = Path::new(&source_path);
    if !source.is_absolute() || !source.exists() {
        return Err("Dossier de leçon invalide.".into());
    }
    let resources = process_path(
        &app.path()
            .resource_dir()
            .map_err(|error| error.to_string())?,
    );
    let webview = resources
        .join("webview2-fixed-runtime")
        .join("msedgewebview2.exe");
    if !webview.is_file() {
        return Err("Le moteur WebView2 embarqué est introuvable.".into());
    }

    let scratch = process_path(
        &app.path()
            .app_cache_dir()
            .map_err(|error| error.to_string())?,
    )
    .join("pdf-a4")
    .join(Uuid::new_v4().to_string());
    fs::create_dir_all(&scratch).map_err(|error| error.to_string())?;
    let result = (|| -> Result<String, String> {
        let lesson = if source.is_dir() {
            source.to_path_buf()
        } else if source.is_file()
            && source
                .extension()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("paideia"))
        {
            PathBuf::from(crate::commands::open_paideia_archive_path(
                source_path.clone(),
                scratch.join("source").to_string_lossy().into_owned(),
            )?)
        } else {
            return Err("La source PDF doit être une leçon ou une archive .paideia.".into());
        };
        let output = scratch.join("output");
        let manifest = scratch.join("job.json");
        let job = crate::pdf_a4_native::PrintJob {
            source: process_path(&lesson),
            output: scratch.join("output"),
            webview: webview.parent().unwrap().to_path_buf(),
            profile: profile.clone().unwrap_or_else(|| "review".into()),
        };
        fs::write(
            &manifest,
            serde_json::to_vec(&job).map_err(|error| error.to_string())?,
        )
        .map_err(|error| error.to_string())?;
        let mut command = Command::new(process_path(
            &std::env::current_exe().map_err(|error| error.to_string())?,
        ));
        command.arg("--pdf-a4-native").arg(process_path(&manifest));
        #[cfg(target_os = "windows")]
        command.creation_flags(0x0800_0000);
        let process = command
            .output()
            .map_err(|error| format!("Impossible de démarrer le générateur PDF A4 : {error}"))?;
        if !process.status.success() {
            let report: serde_json::Value = fs::read(output.join("result.json"))
                .ok()
                .and_then(|bytes| serde_json::from_slice(&bytes).ok())
                .unwrap_or_default();
            if let Some(error) = report["error"].as_str() {
                return Err(format!("Échec de l'export PDF A4 : {error}"));
            }
            let error = String::from_utf8_lossy(&process.stderr);
            let log = String::from_utf8_lossy(&process.stdout);
            return Err(format!(
                "Échec de l'export PDF A4 : {}",
                if error.trim().is_empty() {
                    log.trim()
                } else {
                    error.trim()
                }
            ));
        }
        let bytes = fs::read(output.join("essai-a4.pdf"))
            .map_err(|error| format!("PDF A4 introuvable après génération : {error}"))?;
        crate::commands::write_pdf_export_atomic(
            target_path,
            base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes),
        )
    })();
    let _ = fs::remove_dir_all(&scratch);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generator_paths_remove_verbatim_drive_and_unc_prefixes() {
        assert_eq!(
            process_path(Path::new(r"\\?\C:\Program Files\PAIDEIA\runner.mjs")),
            PathBuf::from(r"C:\Program Files\PAIDEIA\runner.mjs")
        );
        assert_eq!(
            process_path(Path::new(r"\\?\UNC\server\share\lesson")),
            PathBuf::from(r"\\server\share\lesson")
        );
        assert_eq!(
            process_path(Path::new(r"C:\PAIDEIA\runner.mjs")),
            PathBuf::from(r"C:\PAIDEIA\runner.mjs")
        );
    }
}
