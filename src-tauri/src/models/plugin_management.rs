use serde::{Deserialize, Serialize};
use crate::plugins::PluginCatalogItem;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PluginAction {
    pub(crate) action: String,
    pub(crate) id: Option<String>,
    pub(crate) item: Option<PluginCatalogItem>,
    pub(crate) file_path: Option<String>,
    pub(crate) enabled: Option<bool>,
    pub(crate) ids: Option<Vec<String>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BatchItemResult {
    pub(crate) index: usize,
    pub(crate) id: String,
    pub(crate) success: bool,
    pub(crate) error: Option<String>,
}
