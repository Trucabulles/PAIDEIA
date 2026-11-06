use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const ARION_WINDOW_LABEL: &str = "arion";
const ARION_DEFAULT_WIDTH: f64 = 650.0;
const ARION_DEFAULT_HEIGHT: f64 = 680.0;
const ARION_MIN_WIDTH: f64 = 650.0;
const ARION_MIN_HEIGHT: f64 = 600.0;

#[tauri::command]
pub async fn open_arion_window(
    app: tauri::AppHandle,
    width: Option<f64>,
    height: Option<f64>,
    compact: Option<bool>,
) -> Result<(), String> {
    // WebView2 creation in a synchronous IPC command deadlocks the Windows UI thread.
    // Tauri dispatches async commands on its runtime, leaving the event loop available.
    if let Some(window) = app.get_webview_window(ARION_WINDOW_LABEL) {
        window.unminimize().map_err(|error| error.to_string())?;
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    let webview_url = if cfg!(debug_assertions) {
        app.config()
            .build
            .dev_url
            .clone()
            .map(|mut url| {
                url.set_query(Some("surface=arion"));
                WebviewUrl::External(url)
            })
            .unwrap_or_else(|| WebviewUrl::App("index.html".into()))
    } else {
        WebviewUrl::App("index.html".into())
    };

    let mut builder = WebviewWindowBuilder::new(&app, ARION_WINDOW_LABEL, webview_url)
        .title("Arion — PAIDEIA")
        .inner_size(
            width
                .filter(|v| v.is_finite() && *v > 0.0)
                .unwrap_or(ARION_DEFAULT_WIDTH),
            height
                .filter(|v| v.is_finite() && *v > 0.0)
                .unwrap_or(ARION_DEFAULT_HEIGHT),
        )
        .min_inner_size(ARION_MIN_WIDTH, ARION_MIN_HEIGHT)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(true)
        .drag_and_drop(false)
        .initialization_script(format!(
            "window.__PAIDEIA_SURFACE__ = 'arion'; window.__ARION_COMPACT__ = {};",
            compact.unwrap_or(false)
        ));

    if let Some(webview_root) = crate::distribution::current().webview_root() {
        builder = builder.data_directory(webview_root);
    }

    builder.build().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn close_arion_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(ARION_WINDOW_LABEL) {
        window.destroy().map_err(|error| error.to_string())?;
    }
    Ok(())
}
