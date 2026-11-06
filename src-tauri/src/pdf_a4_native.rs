use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    io::{Read, Write},
    net::TcpListener,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, WebviewWindow};
use webview2_com::{
    CallDevToolsProtocolMethodCompletedHandler,
    Microsoft::Web::WebView2::Win32::ICoreWebView2CallDevToolsProtocolMethodCompletedHandler,
};
use windows::core::PCWSTR;

const PRINT_SCRIPT: &str = include_str!("../target/pdf-a4/print.js");
const TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Deserialize, Serialize)]
pub struct PrintJob {
    pub source: PathBuf,
    pub output: PathBuf,
    pub webview: PathBuf,
    pub profile: String,
}

// The print helper is PAIDEIA itself. It has no project/editor commands and
// no remote debugging listener; COM calls stay inside this native process.
pub fn run(job_file: &Path) -> Result<(), String> {
    let job: PrintJob = serde_json::from_slice(&fs::read(job_file).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    if !job.webview.join("msedgewebview2.exe").is_file() {
        return Err("Le WebView2 fixe embarqué est introuvable.".into());
    }
    if !matches!(job.profile.as_str(), "review" | "learner") {
        return Err("Profil PDF invalide.".into());
    }
    fs::create_dir_all(&job.output).map_err(|e| e.to_string())?;
    std::env::set_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", &job.webview);
    std::env::remove_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS");
    std::env::remove_var("WEBVIEW2_USER_DATA_FOLDER");
    let mut context = tauri::generate_context!();
    for window in &mut context.config_mut().app.windows {
        window.create = false;
    }
    // Tauri resolves FixedRuntime itself; supply the exact absolute runtime.
    context.config_mut().bundle.windows.webview_install_mode =
        tauri::utils::config::WebviewInstallMode::FixedRuntime {
            path: job.webview.clone(),
        };
    let result_file = job.output.join("result.json");
    match fs::remove_file(&result_file) {
        Ok(()) => (),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => (),
        Err(error) => return Err(error.to_string()),
    }
    let completed_file = result_file.clone();
    tauri::Builder::default().setup(move |app| {
        let mut windows = Vec::new();
        for label in ["pdf-print-host", "pdf-html-capture"] {
            windows.push(tauri::WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::External("about:blank".parse()?))
                .title("PAIDEIA — PDF").visible(false).focused(false).decorations(false).skip_taskbar(true)
                .data_directory(job.output.join("profile"))
                .additional_browser_args("--disable-component-update --disable-background-networking --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows")
                .build()?);
        }
        let handle = app.handle().clone();
        thread::spawn(move || {
            let result = generate(&job, &windows[0], &windows[1], &handle);
            let report = match &result { Ok(_) => json!({"ok":true}), Err(error) => json!({"ok":false,"error":error}) };
            let _ = fs::write(result_file, report.to_string());
            handle.exit(if result.is_ok() { 0 } else { 1 });
        });
        Ok(())
    }).run(context).map_err(|e| e.to_string())?;
    let report: Value =
        serde_json::from_slice(&fs::read(completed_file).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    if report["ok"] != true {
        return Err(report["error"]
            .as_str()
            .unwrap_or("Échec du générateur PDF")
            .to_string());
    }
    Ok(())
}

fn cdp(window: &WebviewWindow, method: &str, params: Value) -> Result<Value, String> {
    let (sender, receiver) = mpsc::channel();
    let method: Vec<u16> = method.encode_utf16().chain(Some(0)).collect();
    let params: Vec<u16> = params.to_string().encode_utf16().chain(Some(0)).collect();
    window
        .with_webview(move |webview| unsafe {
            let completed_sender = sender.clone();
            let handler: ICoreWebView2CallDevToolsProtocolMethodCompletedHandler =
                CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
                    move |status, response| {
                        let result = status.map_err(|e| e.to_string()).and_then(|_| {
                            serde_json::from_str(&response).map_err(|e| e.to_string())
                        });
                        let _ = completed_sender.send(result);
                        Ok(())
                    },
                ));
            let started = webview.controller().CoreWebView2().and_then(|core| {
                core.CallDevToolsProtocolMethod(
                    PCWSTR(method.as_ptr()),
                    PCWSTR(params.as_ptr()),
                    &handler,
                )
            });
            if let Err(error) = started {
                let _ = sender.send(Err(error.to_string()));
            }
        })
        .map_err(|e| e.to_string())?;
    receiver
        .recv_timeout(TIMEOUT)
        .map_err(|_| "Le moteur PDF n'a pas répondu dans le délai prévu.".to_string())?
}

fn evaluate(window: &WebviewWindow, expression: &str) -> Result<Value, String> {
    let result = cdp(
        window,
        "Runtime.evaluate",
        json!({"expression":expression,"awaitPromise":true,"returnByValue":true}),
    )?;
    if let Some(details) = result.get("exceptionDetails") {
        return Err(details["exception"]["description"]
            .as_str()
            .or_else(|| details["text"].as_str())
            .unwrap_or("Erreur de préparation PDF")
            .to_string());
    }
    Ok(result["result"]["value"].clone())
}

fn navigate(window: &WebviewWindow, url: &str) -> Result<(), String> {
    cdp(window, "Page.navigate", json!({"url":url}))?;
    let expression = format!(
        "location.href==={} && document.readyState==='complete'",
        json!(url)
    );
    let started = Instant::now();
    while started.elapsed() < TIMEOUT {
        if evaluate(window, &expression).unwrap_or(Value::Null) == true {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(50));
    }
    Err("Le document PDF n'a pas terminé son chargement.".into())
}

fn asset_path(source: &Path, reference: &str) -> Result<PathBuf, String> {
    let normalized = reference.replace('\\', "/");
    let relative = normalized.strip_prefix("assets/").unwrap_or(&normalized);
    if relative.is_empty()
        || relative.contains(':')
        || relative.starts_with('/')
        || relative.split('/').any(|part| part == "..")
    {
        return Err("Référence de ressource hors du projet.".into());
    }
    let base = source
        .join("assets")
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let path = base
        .join(relative)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if !path.starts_with(&base) {
        return Err("Référence de ressource hors du projet.".into());
    }
    Ok(path)
}

fn blocks(project: &Value) -> Vec<&Value> {
    project["course"]["modules"]
        .as_array()
        .into_iter()
        .flatten()
        .flat_map(|m| m["chapters"].as_array().into_iter().flatten())
        .flat_map(|c| c["pages"].as_array().into_iter().flatten())
        .flat_map(|p| p["blocks"].as_array().into_iter().flatten())
        .collect()
}

fn generate(
    job: &PrintJob,
    window: &WebviewWindow,
    capture: &WebviewWindow,
    app: &AppHandle,
) -> Result<(), String> {
    let mut project: Value = serde_json::from_slice(
        &fs::read(job.source.join("project.json")).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    project["course"] = serde_json::from_slice(
        &fs::read(job.source.join("content/course.json")).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    cdp(window, "Page.enable", json!({}))?;
    // A local document provides a real origin for shared rendering helpers
    // (notably duration preferences); about:blank denies localStorage.
    let bootstrap = job.output.join("bootstrap.html");
    fs::write(&bootstrap, "<!doctype html><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; connect-src data: blob:; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'\"><body></body>").map_err(|e| e.to_string())?;
    navigate(
        window,
        tauri::Url::from_file_path(&bootstrap)
            .map_err(|_| "Chemin PDF invalide")?
            .as_str(),
    )?;
    evaluate(window, PRINT_SCRIPT)?;
    let refs = evaluate(
        window,
        &format!("PaideiaPdf.setProject({},{})", project, json!(job.profile)),
    )?;
    let mut omitted = Vec::<String>::new();
    for reference in refs.as_array().ok_or("Liste des médias PDF invalide")? {
        let reference = reference.as_str().ok_or("Référence PDF invalide")?;
        let extension = Path::new(reference)
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if job.profile == "learner" && matches!(extension.as_str(), "mp4" | "webm" | "m4v" | "mov")
        {
            continue;
        }
        let kind = match extension.as_str() {
            "mp4" | "webm" => "video",
            "mp3" | "wav" | "ogg" => "audio",
            "png" | "jpg" | "jpeg" | "gif" | "webp" => "image",
            _ => continue,
        };
        let path = match asset_path(&job.source, reference) {
            Ok(path) => path,
            Err(_) => {
                continue;
            }
        };
        if kind == "video"
            && fs::metadata(&path).map_err(|e| e.to_string())?.len() > 100 * 1024 * 1024
        {
            omitted.push(reference.into());
            continue;
        }
        let bytes = fs::read(path).map_err(|e| e.to_string())?;
        let extension = match extension.as_str() {
            "jpg" => "jpeg",
            "mp3" => "mpeg",
            other => other,
        };
        let data = format!("data:{kind}/{extension};base64,{}", STANDARD.encode(bytes));
        evaluate(window, "window._pdfChunks=[];true")?;
        for chunk in data.as_bytes().chunks(400_000) {
            evaluate(
                window,
                &format!(
                    "window._pdfChunks.push({});true",
                    json!(std::str::from_utf8(chunk).map_err(|e| e.to_string())?)
                ),
            )?;
        }
        evaluate(
            window,
            &format!(
                "PaideiaPdf.setAsset({},window._pdfChunks.join(''));window._pdfChunks=null;true",
                json!(reference)
            ),
        )?;
    }
    let mut html_entries = HashMap::new();
    let mut subtitles = HashMap::new();
    let mut packages = HashMap::new();
    let mut html_blocks = Vec::new();
    for block in blocks(&project) {
        let id = block["id"].as_str().unwrap_or("");
        if let Some(reference) = block["htmlEntryFile"].as_str() {
            if let Ok(path) = asset_path(&job.source, reference) {
                if let Ok(content) = fs::read_to_string(&path) {
                    html_entries.insert(id.to_string(), content);
                    if job.profile != "learner" && block["type"] == "html-custom" {
                        let base = asset_path(
                            &job.source,
                            block["htmlAssetRoot"]
                                .as_str()
                                .ok_or("Dossier HTML absent")?,
                        )?;
                        if !path.starts_with(&base) {
                            return Err("Entrée HTML hors du paquet.".into());
                        }
                        let entry = path
                            .strip_prefix(&base)
                            .map_err(|e| e.to_string())?
                            .to_string_lossy()
                            .replace('\\', "/");
                        packages.insert(id.to_string(), base);
                        html_blocks.push((id.to_string(), entry));
                    }
                }
            }
        }
        for reference in block["subtitleRefs"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
        {
            if let Ok(path) = asset_path(&job.source, reference) {
                if let Ok(content) = fs::read_to_string(path) {
                    subtitles.insert(reference.to_string(), content);
                }
            }
        }
    }
    evaluate(
        window,
        &format!(
            "PaideiaPdf.prepare({},{},{})",
            json!(html_entries),
            json!(subtitles),
            json!(omitted)
        ),
    )?;
    if !html_blocks.is_empty() {
        let server = HtmlServer::start(packages)?;
        cdp(capture, "Page.enable", json!({}))?;
        cdp(
            capture,
            "Emulation.setDeviceMetricsOverride",
            json!({"width":1090,"height":680,"deviceScaleFactor":1,"mobile":false}),
        )?;
        for (id, entry) in html_blocks {
            let url = tauri::Url::parse(&format!(
                "http://127.0.0.1:{}/{}/{}/{}",
                server.port, server.token, id, entry
            ))
            .map_err(|e| e.to_string())?;
            navigate(capture, url.as_str())?;
            evaluate(capture, "Promise.race([Promise.all([document.fonts.ready,...[...document.images].map(i=>i.decode().catch(()=>{}))]),new Promise(r=>setTimeout(r,3000))]).then(()=>new Promise(r=>setTimeout(r,100)))")?;
            let image = cdp(
                capture,
                "Page.captureScreenshot",
                json!({"format":"png","captureBeyondViewport":false}),
            )?;
            evaluate(
                window,
                &format!(
                    "PaideiaPdf.setCapture({},{});true",
                    json!(id),
                    json!(format!(
                        "data:image/png;base64,{}",
                        image["data"].as_str().ok_or("Capture HTML absente")?
                    ))
                ),
            )?;
        }
    }
    let font_css = font_css(job, &project, app)?;
    let html = evaluate(window, &format!("PaideiaPdf.render({})", json!(font_css)))?;
    let html_path = job.output.join("essai-a4.html");
    fs::write(&html_path, html.as_str().ok_or("Document HTML PDF absent")?)
        .map_err(|e| e.to_string())?;
    let url = tauri::Url::from_file_path(&html_path).map_err(|_| "Chemin HTML invalide")?;
    navigate(window, url.as_str())?;
    evaluate(window, PRINT_SCRIPT)?;
    let diagnostics = evaluate(window, "PaideiaPdf.readyForPrint()")?;
    let printed = cdp(
        window,
        "Page.printToPDF",
        json!({"transferMode":"ReturnAsStream","printBackground":true,"preferCSSPageSize":true,"displayHeaderFooter":true,"headerTemplate":"<span></span>","footerTemplate":"<div style=\"font-size:12px;text-align:center;width:100%;color:#64748b\"><span class=\"pageNumber\"></span> / <span class=\"totalPages\"></span></div>"}),
    )?;
    let stream = printed["stream"].as_str().ok_or("Flux PDF absent")?;
    let mut file = fs::File::create(job.output.join("essai-a4.pdf")).map_err(|e| e.to_string())?;
    loop {
        let chunk = cdp(window, "IO.read", json!({"handle":stream,"size":400000}))?;
        let data = chunk["data"].as_str().ok_or("Données PDF absentes")?;
        let bytes = if chunk["base64Encoded"] == true {
            STANDARD.decode(data).map_err(|e| e.to_string())?
        } else {
            data.as_bytes().to_vec()
        };
        file.write_all(&bytes).map_err(|e| e.to_string())?;
        if chunk["eof"] == true {
            break;
        }
    }
    cdp(window, "IO.close", json!({"handle":stream}))?;
    fs::write(
        job.output.join("verification.json"),
        json!({"diagnostics":diagnostics}).to_string(),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn font_face(
    css: &mut String,
    family: &str,
    path: &Path,
    weight: i64,
    style: &str,
) -> Result<(), String> {
    let bytes =
        fs::read(path).map_err(|e| format!("Police PDF absente : {} : {e}", path.display()))?;
    let extension = path.extension().and_then(|s| s.to_str()).unwrap_or("woff2");
    font_face_bytes(css, family, &bytes, extension, weight, style);
    Ok(())
}

fn font_face_bytes(
    css: &mut String,
    family: &str,
    bytes: &[u8],
    extension: &str,
    weight: i64,
    style: &str,
) {
    css.push_str(&format!("@font-face{{font-family:{};src:url(data:font/{extension};base64,{});font-weight:{weight};font-style:{style};}}", json!(family), STANDARD.encode(bytes)));
}

fn font_css(job: &PrintJob, project: &Value, app: &AppHandle) -> Result<String, String> {
    let mut css = String::new();
    for family in ["Inter", "Spectral", "Bellefair"] {
        let variants: &[&str] = if family == "Bellefair" {
            &["Regular"]
        } else {
            &["Regular", "Bold", "Italic", "BoldItalic"]
        };
        for variant in variants {
            let reference = format!("fonts/{family}/{family}-{variant}.woff2");
            let asset = app
                .asset_resolver()
                .get(reference.clone())
                .filter(|asset| asset.bytes.starts_with(b"wOF2"))
                .ok_or_else(|| format!("Police embarquée absente : {reference}"))?;
            font_face_bytes(
                &mut css,
                family,
                &asset.bytes,
                "woff2",
                if variant.contains("Bold") { 700 } else { 400 },
                if variant.contains("Italic") {
                    "italic"
                } else {
                    "normal"
                },
            );
        }
    }
    if let Ok(directories) = fs::read_dir(job.source.join("assets/fonts")) {
        for directory in directories.flatten().filter(|d| d.path().is_dir()) {
            for file in fs::read_dir(directory.path())
                .map_err(|e| e.to_string())?
                .flatten()
            {
                let name = file.file_name().to_string_lossy().to_ascii_lowercase();
                if !matches!(
                    file.path().extension().and_then(|s| s.to_str()),
                    Some("woff" | "woff2" | "ttf" | "otf")
                ) {
                    continue;
                }
                let path = asset_path(
                    &job.source,
                    &format!(
                        "fonts/{}/{}",
                        directory.file_name().to_string_lossy(),
                        file.file_name().to_string_lossy()
                    ),
                )?;
                font_face(
                    &mut css,
                    &format!(
                        "PaideiaRichFont-{}",
                        directory.file_name().to_string_lossy()
                    ),
                    &path,
                    if name.contains("bold") {
                        700
                    } else if name.contains("medium") {
                        500
                    } else {
                        400
                    },
                    if name.contains("italic") {
                        "italic"
                    } else {
                        "normal"
                    },
                )?;
            }
        }
    }
    if let Some(reference) = project["customFont"]["assetRef"].as_str() {
        let faces = project["customFont"]["faces"]
            .as_array()
            .filter(|a| !a.is_empty())
            .cloned()
            .unwrap_or_else(|| vec![json!({"assetRef":reference,"weight":400,"style":"normal"})]);
        for face in faces {
            font_face(
                &mut css,
                "PaideiaLesson",
                &asset_path(
                    &job.source,
                    face["assetRef"]
                        .as_str()
                        .ok_or("Police de leçon invalide")?,
                )?,
                face["weight"].as_i64().unwrap_or(400),
                face["style"].as_str().unwrap_or("normal"),
            )?;
            css.push_str("body{font-family:PaideiaLesson,Inter,sans-serif!important}");
        }
    }
    Ok(css)
}

struct HtmlServer {
    port: u16,
    token: String,
    stopped: Arc<AtomicBool>,
    worker: Option<thread::JoinHandle<()>>,
}
impl HtmlServer {
    fn start(packages: HashMap<String, PathBuf>) -> Result<Self, String> {
        let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|e| e.to_string())?;
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();
        listener.set_nonblocking(true).map_err(|e| e.to_string())?;
        let token = uuid::Uuid::new_v4().to_string();
        let prefix = format!("/{token}/");
        let stopped = Arc::new(AtomicBool::new(false));
        let stop = stopped.clone();
        let worker = thread::spawn(move || {
            while !stop.load(Ordering::Relaxed) {
                let (mut stream, _) = match listener.accept() {
                    Ok(value) => value,
                    Err(_) => {
                        thread::sleep(Duration::from_millis(10));
                        continue;
                    }
                };
                let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
                let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));
                let mut request = [0u8; 8192];
                let result = (|| -> Result<(Vec<u8>, &'static str), String> {
                    let length = stream.read(&mut request).map_err(|e| e.to_string())?;
                    let line = std::str::from_utf8(&request[..length])
                        .map_err(|e| e.to_string())?
                        .lines()
                        .next()
                        .ok_or("Requête vide")?;
                    let uri = line
                        .strip_prefix("GET ")
                        .and_then(|s| s.split_whitespace().next())
                        .ok_or("Requête refusée")?;
                    let url = tauri::Url::parse(&format!("http://localhost{uri}"))
                        .map_err(|e| e.to_string())?;
                    let decoded = percent_decode(url.path())?;
                    let route = decoded.strip_prefix(&prefix).ok_or("Paquet inconnu")?;
                    let (id, relative) = route.split_once('/').ok_or("Ressource inconnue")?;
                    let base = packages.get(id).ok_or("Paquet inconnu")?;
                    if relative.contains('\\')
                        || relative.contains(':')
                        || relative.split('/').any(|s| s == "..")
                    {
                        return Err("Chemin refusé".into());
                    }
                    let path = base
                        .join(relative)
                        .canonicalize()
                        .map_err(|e| e.to_string())?;
                    if !path.starts_with(base) {
                        return Err("Chemin refusé".into());
                    }
                    let mime = match path.extension().and_then(|s| s.to_str()).unwrap_or("") {
                        "html" => "text/html",
                        "js" => "text/javascript",
                        "css" => "text/css",
                        "json" => "application/json",
                        "png" => "image/png",
                        "jpg" | "jpeg" => "image/jpeg",
                        "webp" => "image/webp",
                        "svg" => "image/svg+xml",
                        "woff2" => "font/woff2",
                        "woff" => "font/woff",
                        "otf" => "font/otf",
                        "ttf" => "font/ttf",
                        _ => "application/octet-stream",
                    };
                    Ok((fs::read(path).map_err(|e| e.to_string())?, mime))
                })();
                if let Ok((bytes, mime)) = result {
                    let headers = format!("HTTP/1.1 200 OK\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nConnection: close\r\nContent-Security-Policy: default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'none'; object-src 'none'; sandbox allow-scripts allow-same-origin\r\n\r\n", bytes.len());
                    let _ = stream
                        .write_all(headers.as_bytes())
                        .and_then(|_| stream.write_all(&bytes));
                } else {
                    let _ = stream.write_all(
                        b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                    );
                }
            }
        });
        Ok(Self {
            port,
            token,
            stopped,
            worker: Some(worker),
        })
    }
}
impl Drop for HtmlServer {
    fn drop(&mut self) {
        self.stopped.store(true, Ordering::Relaxed);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}
fn percent_decode(value: &str) -> Result<String, String> {
    let mut output = Vec::new();
    let mut chars = value.as_bytes().iter().copied();
    while let Some(byte) = chars.next() {
        if byte == b'%' {
            let high = chars
                .next()
                .and_then(|c| (c as char).to_digit(16))
                .ok_or("URL invalide")?;
            let low = chars
                .next()
                .and_then(|c| (c as char).to_digit(16))
                .ok_or("URL invalide")?;
            output.push((high * 16 + low) as u8);
        } else {
            output.push(byte);
        }
    }
    String::from_utf8(output).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn resource_paths_reject_escape_and_decode_unicode() {
        let root = std::env::temp_dir().join(format!("paideia-pdf-paths-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("assets/images")).unwrap();
        fs::write(root.join("assets/images/é.png"), [1]).unwrap();
        assert!(asset_path(&root, "assets/images/é.png").is_ok());
        for path in [
            "../private.txt",
            "assets/../project.json",
            "C:/secret.txt",
            "//server/secret",
            "images/../../secret",
        ] {
            assert!(asset_path(&root, path).is_err());
        }
        assert_eq!(percent_decode("/image/%C3%A9.png").unwrap(), "/image/é.png");
        assert!(percent_decode("%zz").is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn html_capture_server_serves_only_its_selected_package() {
        use std::net::TcpStream;
        let root = std::env::temp_dir().join(format!("paideia-pdf-html-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("package")).unwrap();
        fs::write(root.join("package/é.html"), "<h1>Contenu local</h1>").unwrap();
        fs::write(root.join("private.txt"), "private").unwrap();
        let base = root.join("package").canonicalize().unwrap();
        let server = HtmlServer::start(HashMap::from([("activity".into(), base)])).unwrap();
        let get = |route: &str| {
            let mut stream = TcpStream::connect(("127.0.0.1", server.port)).unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            stream
                .write_all(format!("GET {route} HTTP/1.1\r\nHost: localhost\r\n\r\n").as_bytes())
                .unwrap();
            let mut response = String::new();
            stream.read_to_string(&mut response).unwrap();
            response
        };
        let response = get(&format!("/{}/activity/%C3%A9.html", server.token));
        assert!(response.starts_with("HTTP/1.1 200"));
        assert!(
            response.contains("Content-Security-Policy:")
                && response.ends_with("<h1>Contenu local</h1>")
        );
        for route in [
            "/wrong/activity/%C3%A9.html".to_string(),
            format!("/{}/activity/%2e%2e/private.txt", server.token),
            format!("/{}/other/%C3%A9.html", server.token),
        ] {
            assert!(get(&route).starts_with("HTTP/1.1 404"));
        }
        let port = server.port;
        drop(server);
        assert!(TcpStream::connect(("127.0.0.1", port)).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
