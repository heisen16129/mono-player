use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub(super) struct SeparationPlan {
    pub engine: String,
    pub model: String,
    pub device: String,
}

impl SeparationPlan {
    pub fn validate(&self) -> Result<(), String> {
        if self.engine != "demucs"
            || self.model != "htdemucs_6s"
            || !matches!(self.device.as_str(), "auto" | "cpu" | "cuda" | "mps")
        {
            return Err("插件返回了不支持的音源分离方案。".to_string());
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SeparationStatus {
    pub id: String,
    pub plugin_id: String,
    pub stage: String,
    pub progress: Option<u8>,
    pub device: Option<String>,
    pub message: Option<String>,
    pub output_dir: String,
    pub vocals_path: Option<String>,
    pub accompaniment_path: Option<String>,
}

impl SeparationStatus {
    pub fn is_running(&self) -> bool {
        !matches!(self.stage.as_str(), "done" | "error" | "cancelled")
    }
}
