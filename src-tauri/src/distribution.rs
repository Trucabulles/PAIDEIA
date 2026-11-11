use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

pub const PORTABLE_MARKER_FILE: &str = "portable.mode";

#[derive(Debug, Clone)]
pub struct DistributionContext {
    executable_dir: PathBuf,
    data_root: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DistributionDescriptor {
    pub portable: bool,
    pub data_root: Option<String>,
    pub library_root: Option<String>,
}

static DISTRIBUTION_CONTEXT: OnceLock<DistributionContext> = OnceLock::new();

impl DistributionContext {
    fn from_executable(executable: &Path) -> Result<Self, String> {
        let executable_dir = executable
            .parent()
            .ok_or_else(|| "Dossier de l’exécutable PAIDEIA introuvable".to_string())?
            .to_path_buf();
        let data_root = executable_dir
            .join(PORTABLE_MARKER_FILE)
            .is_file()
            .then(|| executable_dir.join("data"));
        Ok(Self {
            executable_dir,
            data_root,
        })
    }

    pub fn is_portable(&self) -> bool {
        self.data_root.is_some()
    }

    pub fn data_root(&self) -> Option<&Path> {
        self.data_root.as_deref()
    }

    pub fn config_root(&self) -> Option<PathBuf> {
        self.data_root().map(|root| root.join("config"))
    }

    pub fn library_root(&self) -> Option<PathBuf> {
        self.data_root().map(|root| root.join("library"))
    }

    pub fn resources_root(&self) -> Option<PathBuf> {
        self.data_root().map(|root| root.join("resources"))
    }

    pub fn logs_root(&self) -> Option<PathBuf> {
        self.data_root().map(|root| root.join("logs"))
    }

    pub fn webview_root(&self) -> Option<PathBuf> {
        self.data_root().map(|root| root.join("webview"))
    }

    pub fn ensure_portable_directories(&self) -> Result<(), String> {
        for directory in [
            self.config_root(),
            self.library_root(),
            self.resources_root(),
            self.logs_root(),
            self.webview_root(),
        ]
        .into_iter()
        .flatten()
        {
            fs::create_dir_all(directory).map_err(|error| error.to_string())?;
        }
        Ok(())
    }

    pub fn configure_portable_webview_runtime(&self) {
        if !self.is_portable() {
            return;
        }
        let runtime_root = self.executable_dir.join("webview2-fixed-runtime");
        if runtime_root.join("msedgewebview2.exe").is_file() {
            std::env::set_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", runtime_root);
        }
    }

    /// Local Cargo executables reuse the source runtime. Packaged applications
    /// keep their configured, adjacent runtime and never depend on source paths.
    pub fn source_webview_runtime(&self) -> Option<PathBuf> {
        if self.is_portable()
            || self.executable_dir.join("webview2-fixed-runtime/msedgewebview2.exe").is_file()
            || !matches!(self.executable_dir.file_name()?.to_str()?, "debug" | "release")
        {
            return None;
        }
        for ancestor in self.executable_dir.ancestors().skip(1).take(4) {
            for source in [ancestor.to_path_buf(), ancestor.join("src-tauri")] {
                if !source.join("Cargo.toml").is_file()
                    || !source.join("tauri.conf.json").is_file()
                    || !source.join("src/main.rs").is_file()
                {
                    continue;
                }
                let runtime = source.join("webview2-fixed-runtime");
                if runtime.join("msedgewebview2.exe").is_file() {
                    return fs::canonicalize(runtime).ok();
                }
            }
        }
        None
    }

    pub fn descriptor(&self) -> DistributionDescriptor {
        DistributionDescriptor {
            portable: self.is_portable(),
            data_root: self
                .data_root()
                .map(|path| path.to_string_lossy().to_string()),
            library_root: self
                .library_root()
                .map(|path| path.to_string_lossy().to_string()),
        }
    }
}

pub fn initialize() -> Result<&'static DistributionContext, String> {
    if let Some(context) = DISTRIBUTION_CONTEXT.get() {
        return Ok(context);
    }
    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let context = DistributionContext::from_executable(&executable)?;
    context.ensure_portable_directories()?;
    context.configure_portable_webview_runtime();
    let _ = DISTRIBUTION_CONTEXT.set(context);
    DISTRIBUTION_CONTEXT
        .get()
        .ok_or_else(|| "Contexte de distribution PAIDEIA indisponible".to_string())
}

pub fn current() -> &'static DistributionContext {
    initialize().expect("failed to resolve PAIDEIA distribution context")
}

pub(crate) fn user_assistant_bank_root() -> Result<PathBuf, String> {
    if let Some(root) = current().resources_root() {
        return Ok(root.join("assistants"));
    }
    let documents = std::env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .map(|profile| profile.join("Documents"))
        .ok_or_else(|| "Impossible de trouver le dossier Documents utilisateur".to_string())?;
    Ok(documents.join("PAIDEIA").join("assistants"))
}

pub(crate) fn legacy_glossary_avatar(reference: &str) -> Option<PathBuf> {
    let filename = reference.strip_prefix("avatars/")?;
    let mut components = Path::new(filename).components();
    if !matches!(components.next(), Some(std::path::Component::Normal(_)))
        || components.next().is_some()
    {
        return None;
    }
    let bank = user_assistant_bank_root().ok()?.canonicalize().ok()?;
    let file = bank.join(reference).canonicalize().ok()?;
    (file.starts_with(&bank) && file.is_file()).then_some(file)
}

pub fn app_config_root(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(root) = current().config_root() {
        return Ok(root);
    }
    app.path()
        .app_config_dir()
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cargo_executables_reuse_only_a_valid_source_runtime() {
        let root = std::env::temp_dir().join(format!("paideia-source-runtime-{}", std::process::id()));
        let source = root.join("src-tauri");
        let runtime = source.join("webview2-fixed-runtime");
        fs::create_dir_all(source.join("src")).unwrap();
        fs::create_dir_all(&runtime).unwrap();
        for file in ["Cargo.toml", "tauri.conf.json", "src/main.rs", "webview2-fixed-runtime/msedgewebview2.exe"] {
            fs::write(source.join(file), "test").unwrap();
        }
        let expected = fs::canonicalize(&runtime).unwrap();
        for directory in [source.join("target/debug"), source.join("target/release"), root.join("target-custom/release")] {
            fs::create_dir_all(&directory).unwrap();
            let context = DistributionContext::from_executable(&directory.join("PAIDEIA.exe")).unwrap();
            assert_eq!(context.source_webview_runtime(), Some(expected.clone()));
        }
        let release = source.join("target/release");
        fs::create_dir_all(release.join("webview2-fixed-runtime")).unwrap();
        fs::write(release.join("webview2-fixed-runtime/msedgewebview2.exe"), "bundled").unwrap();
        assert_eq!(DistributionContext::from_executable(&release.join("PAIDEIA.exe")).unwrap().source_webview_runtime(), None);
        fs::remove_file(release.join("webview2-fixed-runtime/msedgewebview2.exe")).unwrap();
        fs::write(release.join(PORTABLE_MARKER_FILE), "portable").unwrap();
        assert_eq!(DistributionContext::from_executable(&release.join("PAIDEIA.exe")).unwrap().source_webview_runtime(), None);
        assert_eq!(DistributionContext::from_executable(&root.join("installed/PAIDEIA.exe")).unwrap().source_webview_runtime(), None);
        fs::remove_file(runtime.join("msedgewebview2.exe")).unwrap();
        assert_eq!(DistributionContext::from_executable(&source.join("target/debug/PAIDEIA.exe")).unwrap().source_webview_runtime(), None);
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn portable_mode_requires_marker_beside_executable() {
        let root =
            std::env::temp_dir().join(format!("paideia-portable-context-{}", std::process::id()));
        let executable = root.join("PAIDEIA.exe");
        fs::create_dir_all(&root).unwrap();

        let installed = DistributionContext::from_executable(&executable).unwrap();
        assert!(!installed.is_portable());

        fs::write(root.join(PORTABLE_MARKER_FILE), "PAIDEIA portable\n").unwrap();
        let portable = DistributionContext::from_executable(&executable).unwrap();
        assert!(portable.is_portable());
        assert_eq!(portable.data_root(), Some(root.join("data").as_path()));
        assert_eq!(portable.library_root(), Some(root.join("data/library")));
        assert_eq!(portable.webview_root(), Some(root.join("data/webview")));

        fs::remove_dir_all(root).unwrap();
    }
}
