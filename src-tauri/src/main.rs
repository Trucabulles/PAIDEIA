#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod third_party_notices;
mod block_ids;
mod asset_integrity;
mod arion_window;
mod commands;
mod library_discovery;
mod library_catalog;
mod resource_bank_store;
mod distribution;
mod importer;
mod models;
mod observations;
mod pdf_a4;
mod pdf_a4_native;
mod project_compatibility;
mod repository;
mod rich_text_sanitizer;
mod scorm_package;
mod screen_color_picker;
mod whisper;

use commands::{
    activate_library_asset_root, analyze_project_video, apply_activity_item_crop,
    apply_designer_block_changes, cancel_video_optimization, clear_block_image_annotation_state,
    confirm_detached_video_optimization, confirm_video_optimization, create_block, create_chapter, create_module, create_page, create_project, create_snapshot, create_inline_snapshot,
    delete_block, delete_designer_blocks, delete_chapter, delete_paideia_archive, delete_user_font, delete_user_glossary_assistant,
    delete_user_question_bank, delete_user_reference_bank, delete_user_situational_dialogue_character,
    detach_video_block_asset, discard_video_optimization, duplicate_project,
    export_attachment_file_to, export_paideia_archive, export_paideia_archive_to,
    export_user_situational_dialogue_characters,
    export_paideia_license_to, export_resource_workbook_to, export_scorm_12, export_scorm_12_to,
    get_active_user_projects_root, get_app_overview, get_default_user_projects_root,
    get_dev_log_path, get_distribution_context,
    get_embedded_webview2_runtime_version,
    get_startup_paideia_archive,
    get_user_glossary_assistant_bank_path, get_user_question_bank_path, get_user_reference_bank_path,
    get_user_situational_dialogue_character_bank_path, import_html_activity_package, import_scorm,
    import_user_situational_dialogue_character, import_user_situational_dialogue_character_package,
    inspect_chapter_asset_duplicates, inspect_ffmpeg_configuration, inspect_project_asset_duplicate,
    inspect_user_situational_dialogue_character_package,
    inspect_project_asset_duplicate_from_path, is_project_image_animated,
    link_bundled_rich_text_font, link_project_rich_text_font, link_user_rich_text_font,
    list_default_situational_dialogue_characters, list_library_projects, list_personal_library_projects,
    list_project_rich_text_fonts, list_user_fonts, list_user_glossary_assistants,
    list_user_preferences, list_user_question_banks, list_user_reference_banks, list_user_situational_dialogue_characters,
    load_activity_item_annotation_state, load_block_image_annotation_state,
    load_project_for_pdf_export, load_workspace_state, log_dev_event, migrate_library_root,
    open_paideia_archive_bytes, open_paideia_archive_path,
    open_user_situational_dialogue_character_bank_folder, paste_activity_block, paste_chapter, path_exists,
    quit_paideia, read_import_report, read_lesson_duration_current,
    read_project_files_for_pdf_export, read_transcript_document, remove_attachment_file,
    remove_project_font, reorder_block, reorder_chapter, restore_original_video, restore_snapshot,
    save_activity_item_annotation, save_project_workspace, save_user_glossary_assistants,
    save_user_preferences, save_user_question_banks, save_user_reference_banks, apply_user_reference_banks, save_user_situational_dialogue_character, duplicate_user_situational_dialogue_character,
    select_bundled_project_font, select_user_project_font,
    set_user_situational_dialogue_character_default_pose, stage_designer_background_asset,
    stage_point_of_interest_marker_asset, start_video_optimization, update_block, update_chapter,
    update_situational_dialogue_framing,
    update_project_language, update_project_metadata, update_project_keywords, rename_project_title, update_question_banks,
    upload_attachment_file, upload_block_asset, upload_collection_image, upload_course_image,
    upload_project_font, upload_situational_dialogue_character_asset, upload_user_font, prepare_uploaded_font, select_imported_project_font, delete_imported_project_font,
    upload_user_glossary_assistant_avatar, upload_user_question_bank_tile_image, upload_user_reference_bank_tile_image,
    upload_user_situational_dialogue_character_pose,
    upload_user_situational_dialogue_character_preview, upload_video_block_asset_from_path,
    validate_media_tool_path, write_import_log, write_lesson_duration_log, write_pdf_export_atomic, write_transcript_rtf,
};
use screen_color_picker::pick_screen_color;
use whisper::{
    cancel_subtitle_generation, inspect_whisper_configuration, start_subtitle_generation,
    validate_whisper_component_path,
};

fn require_startup<T, E: std::fmt::Display>(result: Result<T, E>) -> T {
    match result {
        Ok(value) => value,
        Err(error) => {
            eprintln!("Échec du démarrage de PAIDEIA : {error}");
            // Startup runs inside the native event loop. Unwinding its window
            // and plugin state can wait on that same loop indefinitely.
            // No user editing session exists yet; release all OS handles now.
            std::process::exit(1);
        }
    }
}

#[cfg(windows)]
fn check_startup_webview(config: &tauri::Config) -> Result<(), String> {
    use webview2_com::Microsoft::Web::WebView2::Win32::GetAvailableCoreWebView2BrowserVersionString;
    use windows::core::{HSTRING, PCWSTR, PWSTR};

    if let tauri::utils::config::WebviewInstallMode::FixedRuntime { path } =
        &config.bundle.windows.webview_install_mode
    {
        let executable = std::env::current_exe().map_err(|error| error.to_string())?;
        let root = executable
            .parent()
            .ok_or("Dossier PAIDEIA introuvable")?
            .join(path);
        let folder = HSTRING::from(root.as_os_str());
        let mut version = PWSTR::null();
        let result = unsafe {
            GetAvailableCoreWebView2BrowserVersionString(PCWSTR(folder.as_ptr()), &mut version)
        };
        let version = webview2_com::take_pwstr(version);
        if result.is_err() || version.is_empty() {
            return Err(format!(
                "Le runtime WebView2 embarqué est absent ou inutilisable.\n\nEmplacement : {}\n\nRestaurez le runtime livré avec PAIDEIA avant de relancer l’application.",
                root.display()
            ));
        }
    }
    Ok(())
}

// The Windows plugin publishes its forwarding window just after taking its
// own mutex. Serialize startup until that window is ready so a second launch
// cannot miss it and build a separate UI.
#[cfg(windows)]
struct StartupGate(windows::Win32::Foundation::HANDLE);

#[cfg(windows)]
impl StartupGate {
    fn acquire() -> Result<Self, String> {
        use windows::core::w;
        use windows::Win32::Foundation::{CloseHandle, WAIT_ABANDONED, WAIT_OBJECT_0};
        use windows::Win32::System::Threading::{CreateMutexW, WaitForSingleObject};
        let handle = unsafe { CreateMutexW(None, false, w!("Local\\com.paideia.app-startup")) }
            .map_err(|error| error.to_string())?;
        let result = unsafe { WaitForSingleObject(handle, 60_000) };
        if result == WAIT_OBJECT_0 || result == WAIT_ABANDONED {
            Ok(Self(handle))
        } else {
            let _ = unsafe { CloseHandle(handle) };
            Err("Une autre instance de PAIDEIA n’a pas terminé son démarrage".into())
        }
    }
}

#[cfg(windows)]
impl Drop for StartupGate {
    fn drop(&mut self) {
        use windows::Win32::{Foundation::CloseHandle, System::Threading::ReleaseMutex};
        let _ = unsafe { ReleaseMutex(self.0) };
        let _ = unsafe { CloseHandle(self.0) };
    }
}

fn main() {
    if std::env::args().nth(1).as_deref() == Some("--pdf-a4-native") {
        let result = std::env::args().nth(2).ok_or_else(|| "ParamÃ¨tres PDF absents".to_string())
            .and_then(|path| pdf_a4_native::run(std::path::Path::new(&path)));
        if let Err(error) = result { eprintln!("{error}"); std::process::exit(1); }
        return;
    }
    #[cfg(debug_assertions)]
    if std::env::args().nth(1).as_deref() == Some("--pdf-a4-host") {
        pdf_a4::run_print_host();
        return;
    }
    #[cfg(windows)]
    let startup_gate = require_startup(StartupGate::acquire());
    #[cfg(windows)]
    {
        // WebView2 adds these to Wry's arguments for both PAIDEIA and Arion.
        let key = "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS";
        let mut arguments = std::env::var_os(key).unwrap_or_default();
        arguments.push(" --disable-component-update --disable-background-networking");
        std::env::set_var(key, arguments);
    }
    let distribution = require_startup(distribution::initialize()).clone();
    let portable_webview_root = distribution.webview_root();
    let mut context = tauri::generate_context!();
    if let Some(runtime) = distribution.source_webview_runtime() {
        // Tauri sets the runtime environment from this configuration during
        // build(), so setting only the environment before it is insufficient.
        context.config_mut().bundle.windows.webview_install_mode =
            tauri::utils::config::WebviewInstallMode::FixedRuntime { path: runtime };
    }
    #[cfg(windows)]
    if let Err(error) = check_startup_webview(context.config()) {
        use windows::core::HSTRING;
        use windows::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};
        // Check before constructing the event loop: missing WebView2 must not
        // enter a partially initialized window teardown.
        unsafe {
            MessageBoxW(None, &HSTRING::from(&error), &HSTRING::from("PAIDEIA"), MB_OK | MB_ICONERROR);
        }
        require_startup::<(), _>(Err(error));
    }
    let startup_windows = if distribution.is_portable() {
        vec![require_startup(
            context.config().app.windows.first().cloned()
                .ok_or("Configuration de fenêtre PAIDEIA absente"),
        )]
    } else {
        context.config().app.windows.iter()
            .filter(|window| window.create).cloned().collect()
    };
    // Handle window creation errors explicitly in setup, before Tauri can
    // panic inside its native Ready callback.
    for window in &mut context.config_mut().app.windows {
        window.create = false;
    }

    let app = require_startup(tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            use tauri::{Emitter, Manager};
            commands::queue_paideia_archives(args, &cwd);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
            let _ = app.emit_to("main", "paideia-archive-pending", ());
        }))
        .setup(move |app| {
            require_startup(commands::configure_asset_protocol_scope(app.handle()));
            for window_config in &startup_windows {
                let mut builder = require_startup(
                    tauri::WebviewWindowBuilder::from_config(app, window_config));
                if let Some(webview_root) = portable_webview_root.as_ref() {
                    builder = builder.data_directory(webview_root.clone());
                }
                require_startup(builder.build());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            arion_window::open_arion_window,
            arion_window::close_arion_window,
            get_app_overview,
            get_distribution_context,
            observations::list_observations,
            observations::create_observation,
            observations::reply_observation,
            observations::set_observation_resolved,
            observations::delete_observation_message,
            observations::purge_observations,
            get_embedded_webview2_runtime_version,
            pick_screen_color,
            quit_paideia,
            get_startup_paideia_archive,
            get_dev_log_path,
            get_default_user_projects_root,
            get_active_user_projects_root,
            activate_library_asset_root,
            list_default_situational_dialogue_characters,
            list_user_glossary_assistants,
            get_user_glossary_assistant_bank_path,
            save_user_glossary_assistants,
            list_user_preferences,
            inspect_ffmpeg_configuration,
            inspect_whisper_configuration,
            validate_media_tool_path,
            validate_whisper_component_path,
            analyze_project_video,
            start_video_optimization,
            cancel_video_optimization,
            start_subtitle_generation,
            cancel_subtitle_generation,
            discard_video_optimization,
            confirm_video_optimization,
            confirm_detached_video_optimization,
            restore_original_video,
            list_user_fonts,
            list_project_rich_text_fonts,
            upload_user_font,
            prepare_uploaded_font,
            select_imported_project_font,
            delete_imported_project_font,
            delete_user_font,
            save_user_preferences,
            delete_user_glossary_assistant,
            export_resource_workbook_to,
            upload_user_glossary_assistant_avatar,
            list_user_question_banks,
            commands::resource_bank_catalog,
            commands::resource_bank_load,
            commands::resource_bank_save,
            commands::resource_bank_delete,
            commands::resource_bank_image,
            get_user_question_bank_path,
            save_user_question_banks,
            upload_user_question_bank_tile_image,
            delete_user_question_bank,
            list_user_reference_banks,
            get_user_reference_bank_path,
            save_user_reference_banks,
            apply_user_reference_banks,
            upload_user_reference_bank_tile_image,
            delete_user_reference_bank,
            list_user_situational_dialogue_characters,
            get_user_situational_dialogue_character_bank_path,
            open_user_situational_dialogue_character_bank_folder,
            save_user_situational_dialogue_character,
            duplicate_user_situational_dialogue_character,
            upload_user_situational_dialogue_character_pose,
            upload_user_situational_dialogue_character_preview,
            set_user_situational_dialogue_character_default_pose,
            delete_user_situational_dialogue_character,
            import_user_situational_dialogue_character,
            export_user_situational_dialogue_characters,
            inspect_user_situational_dialogue_character_package,
            import_user_situational_dialogue_character_package,
            migrate_library_root,
            list_library_projects,
            list_personal_library_projects,
            delete_paideia_archive,
            log_dev_event,
            path_exists,
            save_project_workspace,
            update_question_banks,
            load_workspace_state,
            load_project_for_pdf_export,
            read_project_files_for_pdf_export,
            write_pdf_export_atomic,
            pdf_a4::generate_pdf_a4,
            commands::open_exported_pdf,
            read_transcript_document,
            write_transcript_rtf,
            create_project,
            duplicate_project,
            import_scorm,
            read_import_report,
            write_import_log,
            write_lesson_duration_log,
            read_lesson_duration_current,
            export_paideia_archive,
            export_paideia_archive_to,
            open_paideia_archive_bytes,
            open_paideia_archive_path,
            commands::has_paideia_shared_banks,
            commands::inspect_paideia_shared_bank_updates,
            commands::import_paideia_shared_banks,
            export_scorm_12,
            export_scorm_12_to,
            create_module,
            create_chapter,
            delete_chapter,
            update_chapter,
            reorder_chapter,
            create_page,
            create_block,
            paste_activity_block,
            inspect_chapter_asset_duplicates,
            paste_chapter,
            apply_designer_block_changes,
            commands::arion_usage_store,
            stage_designer_background_asset,
            stage_point_of_interest_marker_asset,
            update_block,
            update_situational_dialogue_framing,
            delete_block,
            delete_designer_blocks,
            update_project_metadata,
            update_project_keywords,
            rename_project_title,
            update_project_language,
            reorder_block,
            create_snapshot,
            create_inline_snapshot,
            restore_snapshot,
            import_html_activity_package,
            upload_block_asset,
            inspect_project_asset_duplicate,
            inspect_project_asset_duplicate_from_path,
            is_project_image_animated,
            apply_activity_item_crop,
            detach_video_block_asset,
            upload_video_block_asset_from_path,
            save_activity_item_annotation,
            load_activity_item_annotation_state,
            load_block_image_annotation_state,
            clear_block_image_annotation_state,
            upload_attachment_file,
            export_attachment_file_to,
            export_paideia_license_to,
            remove_attachment_file,
            upload_collection_image,
            upload_course_image,
            upload_situational_dialogue_character_asset,
            upload_project_font,
            select_bundled_project_font,
            select_user_project_font,
            link_bundled_rich_text_font,
            link_user_rich_text_font,
            link_project_rich_text_font,
            remove_project_font
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .build(context));
    #[cfg(windows)]
    drop(startup_gate);
    app.run(|app, event| {
            if matches!(&event, tauri::RunEvent::WindowEvent { label, event: tauri::WindowEvent::Destroyed, .. } if label == "main") {
                let _ = arion_window::close_arion_window(app.clone());
            }
            if matches!(event, tauri::RunEvent::ExitRequested { .. })
                && whisper::cancel_all_subtitle_generations()
            {
                std::thread::sleep(std::time::Duration::from_millis(500));
            }
        });
}

#[cfg(test)]
mod startup_tests {
    #[cfg(windows)]
    #[test]
    fn missing_fixed_runtime_is_rejected_before_window_creation() {
        let mut config = tauri::Config::default();
        config.bundle.windows.webview_install_mode =
            tauri::utils::config::WebviewInstallMode::FixedRuntime {
                path: std::env::temp_dir().join(format!(
                    "paideia-missing-runtime-{}", uuid::Uuid::new_v4()
                )),
            };
        assert!(super::check_startup_webview(&config).is_err());
    }

    #[test]
    fn startup_error_terminates_process() {
        const CHILD_ENV: &str = "PAIDEIA_STARTUP_FAILURE_TEST";
        if std::env::var_os(CHILD_ENV).is_some() {
            super::require_startup::<(), _>(Err("startup failure test"));
            unreachable!();
        }
        let output = std::process::Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "startup_tests::startup_error_terminates_process", "--nocapture"])
            .env(CHILD_ENV, "1")
            .output()
            .unwrap();
        assert_eq!(output.status.code(), Some(1));
        assert!(String::from_utf8_lossy(&output.stderr).contains("startup failure test"));
        assert_eq!(super::require_startup::<_, &str>(Ok(42)), 42);
    }
}
