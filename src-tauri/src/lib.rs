mod ai;
mod commands;
mod error;
mod fs_ops;
mod history;
mod open_paths;
mod scope;
mod search;
mod storage;
mod text;
mod updater;
mod watcher;

use commands::AppState;
use std::sync::Mutex;
use tauri::{Manager, WindowEvent, DragDropEvent};

/// The window background for a theme setting ("light", "dark" or "system",
/// which follows the OS), matching `--bg` in the app's CSS.
fn window_background(theme: Option<&str>, os_dark: bool) -> tauri::window::Color {
    let dark = match theme {
        Some("dark") => true,
        Some("light") => false,
        _ => os_dark,
    };
    if dark {
        tauri::window::Color(0x1b, 0x1e, 0x24, 0xff)
    } else {
        tauri::window::Color(0xff, 0xff, 0xff, 0xff)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be registered first: a second launch forwards its arguments here
        // and exits, so files double-clicked in the OS open in the running app.
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let paths = open_paths::paths_from_args(argv.into_iter().skip(1), std::path::Path::new(&cwd));
            open_paths::open_in_ui(app, paths);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // Restores window size/position between launches (FR-003).
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let paths = app.path();
            let config_dir = paths.app_config_dir()?;
            let data_dir = paths.app_data_dir()?;
            // Keep settings, recent files and history from Markdown Studio (the old name).
            storage::migrate_legacy_dir(&config_dir);
            storage::migrate_legacy_dir(&data_dir);
            let log_dir = paths.app_log_dir()?;
            let logger = storage::Logger::new(log_dir, paths.home_dir().ok());
            logger.log(
                "info",
                "app.start",
                &format!("{} {}", std::env::consts::OS, std::env::consts::ARCH),
            );
            let state = AppState {
                scope: scope::Scope::default(),
                logger,
                config_dir,
                data_dir,
                recents: Mutex::new(Vec::new()),
                pending_open: Mutex::new(open_paths::OpenPaths::default()),
                ai_cancelled: Mutex::new(Default::default()),
            };
            state.load_recents();
            // The main window is created here rather than in tauri.conf.json so
            // its background matches the theme from the first frame: while the
            // web view starts (slow on a first run, when WebView2 creates its
            // profile), a dark-theme user sees a dark window, not a white one.
            let theme = storage::read_json(&state.config_dir.join("settings.json"));
            let window = tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::default())
                .title("Markpion")
                .inner_size(1280.0, 800.0)
                .min_inner_size(720.0, 480.0)
                .center()
                .build()?;
            // Set before the event loop runs, so the first paint already has it.
            let os_dark = matches!(window.theme(), Ok(tauri::Theme::Dark));
            let _ = window.set_background_color(Some(window_background(theme.get("theme").and_then(|t| t.as_str()), os_dark)));
            // Files passed on the command line (file association, "Open with").
            let cwd = std::env::current_dir().unwrap_or_default();
            let launch = open_paths::paths_from_args(std::env::args().skip(1), &cwd);
            *state.pending_open.lock().unwrap() = open_paths::accept(&state, launch);
            app.manage(state);
            app.manage(watcher::WorkspaceWatcher::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::dialogs::pick_open_file,
            commands::dialogs::pick_open_folder,
            commands::dialogs::pick_export_folder,
            commands::dialogs::pick_save_path,
            commands::app_data::list_recent,
            commands::app_data::open_recent,
            commands::app_data::remove_recent,
            commands::files::list_dir,
            commands::files::read_text_file,
            commands::files::write_text_file,
            commands::files::file_mtime,
            commands::files::create_file,
            commands::files::create_folder,
            commands::files::ensure_folder,
            commands::files::rename_path,
            commands::files::move_path,
            commands::files::delete_path,
            commands::files::read_image,
            commands::files::save_image_asset,
            commands::dialogs::pick_import_file,
            commands::files::read_binary_file,
            commands::platform::open_external,
            commands::platform::reveal_in_folder,
            commands::files::export_file,
            commands::files::export_binary_file,
            commands::platform::take_pending_opens,
            commands::workspace::search_workspace,
            commands::workspace::list_workspace_files,
            commands::workspace::list_convertible_files,
            commands::app_data::list_history,
            commands::workspace::watch_workspace,
            commands::workspace::unwatch_workspace,
            commands::app_data::read_history,
            commands::app_data::load_settings,
            commands::app_data::load_policy,
            commands::app_data::save_settings,
            commands::app_data::load_recovery,
            commands::app_data::save_recovery,
            commands::app_data::clear_recovery,
            commands::platform::log_event,
            commands::platform::export_logs,
            commands::ai::ai_status,
            commands::ai::ai_set_key,
            commands::ai::ai_complete,
            commands::ai::ai_cancel,
            updater::check_app_update,
            updater::install_app_update,
        ])
        // Files and folders dropped onto the window.
        .on_window_event(|window, event| {
            if let WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) = event {
                open_paths::open_in_ui(window.app_handle(), paths.clone());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Markpion")
        .run(|_app, _event| {
            // macOS delivers "Open With" / double-clicked documents as an event.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                let paths = urls.into_iter().filter_map(|u| u.to_file_path().ok());
                open_paths::open_in_ui(_app, paths);
            }
        });
}
