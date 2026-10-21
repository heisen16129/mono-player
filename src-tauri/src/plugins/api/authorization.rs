use crate::models::plugin_api::{Error, Result};
use serde_json::Value;

// Constructed by a trusted host adapter after binding a connection to an installed package.
#[derive(Clone)]
pub(crate) struct Principal {
    pub plugin_id: String,
    pub package_revision: String,
    pub surface: String,
}

pub(crate) fn permissions(manifest: &Value, grant: &Value) -> Vec<String> {
    manifest["permissions"].as_array().into_iter().flatten()
        .filter_map(Value::as_str)
        .filter(|permission| grant["permissions"].as_array().is_some_and(|items| items.iter().any(|v| v == permission)))
        .map(String::from).collect()
}

pub(crate) fn authorize(principal: &Principal, manifest: Option<&Value>, grant: Option<&Value>, permission: Option<&str>) -> Result<()> {
    let manifest = manifest.ok_or_else(|| Error::new("PLUGIN_DISABLED", "Plugin is not installed"))?;
    if manifest["id"] != principal.plugin_id { return Err(Error::new("PERMISSION_DENIED", "Plugin identity mismatch")); }
    if manifest["enabled"] != true { return Err(Error::new("PLUGIN_DISABLED", "Plugin is disabled")); }
    if manifest["schemaVersion"] != 1 || manifest["apiVersion"] != 1 {
        return Err(Error::new("UNSUPPORTED", "Plugin must be rebuilt for API v1"));
    }
    if principal.package_revision.is_empty() || manifest["packageRevision"] != principal.package_revision {
        return Err(Error::new("PLUGIN_DISABLED", "Plugin instance is no longer current"));
    }
    let grant = grant.ok_or_else(|| Error::new("PERMISSION_DENIED", "Plugin has not been authorized"))?;
    if grant["packageRevision"] != principal.package_revision {
        return Err(Error::new("PERMISSION_DENIED", "This package requires authorization"));
    }
    if let Some(permission) = permission {
        if !permissions(manifest, grant).iter().any(|p| p == permission) {
            return Err(Error::new("PERMISSION_DENIED", "Permission is not granted"));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn authorization_requires_declared_granted_current_package() {
        let principal = Principal { plugin_id: "example".into(), package_revision: "a".into(), surface: "sidebar".into() };
        let mut manifest = json!({"id":"example","enabled":true,"schemaVersion":1,"apiVersion":1,"packageRevision":"a","permissions":["library.read"]});
        let grant = json!({"packageRevision":"a","permissions":["library.read","player.control"]});
        assert!(authorize(&principal, Some(&manifest), Some(&grant), Some("library.read")).is_ok());
        assert_eq!(authorize(&principal, Some(&manifest), Some(&grant), Some("player.control")).unwrap_err().code, "PERMISSION_DENIED");
        assert!(authorize(&principal, Some(&manifest), None, None).is_err());
        manifest["id"] = json!("another");
        assert_eq!(authorize(&principal, Some(&manifest), Some(&grant), None).unwrap_err().code, "PERMISSION_DENIED");
        manifest["id"] = json!("example");
        manifest["packageRevision"] = json!("b");
        assert_eq!(authorize(&principal, Some(&manifest), Some(&grant), None).unwrap_err().code, "PLUGIN_DISABLED");
        manifest["packageRevision"] = json!("a");
        manifest["enabled"] = json!(false);
        assert_eq!(authorize(&principal, Some(&manifest), Some(&grant), None).unwrap_err().code, "PLUGIN_DISABLED");
        manifest["enabled"] = json!(true);
        manifest.as_object_mut().unwrap().remove("apiVersion");
        assert_eq!(authorize(&principal, Some(&manifest), Some(&grant), None).unwrap_err().code, "UNSUPPORTED");
    }
}
