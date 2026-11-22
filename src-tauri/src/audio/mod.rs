use serde::Serialize;

pub mod processes;
pub mod windows_wasapi;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioApplication {
    pub executable: String,
    pub window_title: Option<String>,
    pub process_id: u32,
}

pub fn pending() -> String {
    "A captura WASAPI por processo ainda está no gate técnico da Fase 0.".into()
}
