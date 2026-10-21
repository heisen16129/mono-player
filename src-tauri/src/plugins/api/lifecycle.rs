use super::authorization::{authorize, Principal};
use serde_json::{Map, Value};
use tauri::{AppHandle, Manager};

pub(super) fn active(values: &Map<String,Value>, principal: &Principal) -> bool {
    values.get("mono-player-settings").is_none_or(|s|s["enablePlugins"]!=false)
        && authorize(principal,
            values.get("plugins.installed").and_then(Value::as_array).and_then(|items|items.iter().find(|p|p["id"]==principal.plugin_id)),
            values.get("plugins.api.grants").and_then(|g|g.get(&principal.plugin_id)),None).is_ok()
}

// Run after committing state, never while holding the persistent-store lock.
pub(crate) fn sync(app:&AppHandle) {
    let Ok(values)=crate::store::read_values(app) else { return; };
    app.state::<super::subscriptions::State>().revoke(|principal|!active(&values,principal));
    app.state::<super::sessions::Sessions>().revoke(|principal|!active(&values,principal));
    crate::plugins::services::sync(app);
    let _=crate::miot::sync_service(app);
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn global_disable_and_package_update_revoke_running_instances() {
        let principal=Principal{plugin_id:"one".into(),package_revision:"a".into(),surface:"page".into()};
        let mut values=serde_json::json!({"plugins.installed":[{"id":"one","schemaVersion":1,"apiVersion":1,"enabled":true,"packageRevision":"a","permissions":[]}],"plugins.api.grants":{"one":{"packageRevision":"a","permissions":[]}}}).as_object().unwrap().clone();
        assert!(active(&values,&principal));
        values.insert("mono-player-settings".into(),serde_json::json!({"enablePlugins":false}));
        assert!(!active(&values,&principal));
        values.remove("mono-player-settings");
        values.get_mut("plugins.installed").unwrap()[0]["packageRevision"]=serde_json::json!("b");
        assert!(!active(&values,&principal));
    }
}
