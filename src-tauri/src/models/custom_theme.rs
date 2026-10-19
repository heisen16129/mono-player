use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CustomTheme {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) author: String,
    pub(crate) variables: HashMap<String, String>,
    pub(crate) preview: Option<String>,
    pub(crate) background: Option<String>,
    pub(crate) background_opacity: Option<f64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ThemeSnapshot {
    pub(crate) themes: Vec<CustomTheme>,
    pub(crate) active_theme: String,
}

