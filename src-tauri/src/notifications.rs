use tauri_plugin_notification::NotificationExt;

pub fn show_live(app: &tauri::AppHandle, host_name: &str, room_name: &str) -> Result<(), String> {
    app.notification()
        .builder()
        .title(format!("{host_name} está compartilhando"))
        .body(format!("Abra a sala {room_name} para assistir."))
        .show()
        .map_err(|error| error.to_string())
}
