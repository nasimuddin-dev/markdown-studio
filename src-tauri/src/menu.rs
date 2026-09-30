//! The native menu bar on macOS, built from the menus the UI sends (the
//! in-app menu bar is used on Windows and Linux). Choosing an item emits a
//! `menu-command` event with the command's id; the UI runs the command.

use serde::Deserialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Runtime};

/// The menu event handler is registered once, however often the menu is rebuilt.
static HANDLER: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum MenuEntry {
    Command {
        id: String,
        label: String,
        accelerator: Option<String>,
    },
    Separator,
    Submenu {
        label: String,
        items: Vec<MenuEntry>,
    },
}

#[derive(Debug, Deserialize)]
pub struct MenuSpec {
    pub label: String,
    pub items: Vec<MenuEntry>,
}

/// Commands that macOS's own Edit items do (they work in every text field,
/// including the web view's), by the UI's command id.
fn predefined<R: Runtime>(app: &AppHandle<R>, id: &str) -> tauri::Result<Option<PredefinedMenuItem<R>>> {
    Ok(match id {
        "undo" => Some(PredefinedMenuItem::undo(app, None)?),
        "redo" => Some(PredefinedMenuItem::redo(app, None)?),
        "selectAll" => Some(PredefinedMenuItem::select_all(app, None)?),
        _ => None,
    })
}

fn submenu<R: Runtime>(app: &AppHandle<R>, spec: &MenuSpec) -> tauri::Result<Submenu<R>> {
    build_submenu(app, &spec.label, &spec.items, spec.label == "Edit")
}

/// Builds a menu and, recursively, its submenus.
fn build_submenu<R: Runtime>(app: &AppHandle<R>, label: &str, items: &[MenuEntry], is_edit: bool) -> tauri::Result<Submenu<R>> {
    let mut builder = SubmenuBuilder::new(app, label);
    for entry in items {
        match entry {
            MenuEntry::Separator => builder = builder.separator(),
            MenuEntry::Submenu { label, items } => {
                let child = build_submenu(app, label, items, false)?;
                builder = builder.item(&child);
            }
            MenuEntry::Command { id, label, accelerator } => {
                if let Some(item) = predefined(app, id)? {
                    builder = builder.item(&item);
                    // Cut, Copy and Paste follow Redo, as in every Mac app.
                    if is_edit && id == "redo" {
                        builder = builder.separator().cut().copy().paste();
                    }
                    continue;
                }
                // An accelerator the menu can't parse is left out; the UI's own
                // keyboard handling still runs the command.
                let item = match MenuItem::with_id(app, id.as_str(), label, true, accelerator.as_deref()) {
                    Ok(item) => item,
                    Err(_) => MenuItem::with_id(app, id.as_str(), label, true, None::<&str>)?,
                };
                builder = builder.item(&item);
            }
        }
    }
    builder.build()
}

/// Installs the native menu bar (macOS only); returns whether it did.
pub fn install<R: Runtime>(app: &AppHandle<R>, menus: &[MenuSpec]) -> tauri::Result<bool> {
    if !cfg!(target_os = "macos") {
        return Ok(false);
    }
    let app_menu = SubmenuBuilder::new(app, "Markpion")
        .about(None)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;
    let menu = Menu::new(app)?;
    menu.append(&app_menu)?;
    for spec in menus {
        menu.append(&submenu(app, spec)?)?;
    }
    let window = SubmenuBuilder::new(app, "Window").minimize().maximize().separator().fullscreen().build()?;
    menu.append(&window)?;
    app.set_menu(menu)?;
    if !HANDLER.swap(true, Ordering::SeqCst) {
        app.on_menu_event(|app, event| {
            let _ = app.emit("menu-command", event.id().0.clone());
        });
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_menus_the_ui_sends() {
        let json = r#"[{"label":"File","items":[
            {"type":"command","id":"save","label":"Save","accelerator":"CmdOrCtrl+S"},
            {"type":"separator"},
            {"type":"command","id":"closeTab","label":"Close Tab"},
            {"type":"submenu","label":"Export","items":[{"type":"command","id":"exportPdf","label":"PDF…"}]}]}]"#;
        let menus: Vec<MenuSpec> = serde_json::from_str(json).unwrap();
        assert_eq!(menus[0].label, "File");
        assert!(matches!(&menus[0].items[0], MenuEntry::Command { id, accelerator: Some(a), .. } if id == "save" && a == "CmdOrCtrl+S"));
        assert!(matches!(menus[0].items[1], MenuEntry::Separator));
        assert!(matches!(&menus[0].items[2], MenuEntry::Command { accelerator: None, .. }));
        assert!(matches!(&menus[0].items[3], MenuEntry::Submenu { label, items } if label == "Export" && items.len() == 1));
    }
}
