use super::manifest::{self, Manifest};
use crate::models::plugin_api::{Error, Result};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{collections::{BTreeMap, HashSet}, io::{Read, Seek}};

const MAX_FILES: usize = 2048;
const MAX_BYTES: u64 = 256 * 1024 * 1024;
const MAX_FILE_BYTES: u64 = 64 * 1024 * 1024;

pub(crate) struct Package {
    pub manifest: Manifest,
    pub revision: String,
    pub files: BTreeMap<String, Vec<u8>>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Integrity { files: BTreeMap<String, String> }

fn invalid(message: &str) -> Error { Error::new("INVALID_ARGUMENT", message) }

pub(crate) fn read<R: Read + Seek>(source: R, host_version: &str) -> Result<Package> {
    let mut zip = zip::ZipArchive::new(source).map_err(|_| invalid("Invalid plugin ZIP"))?;
    if zip.len() > MAX_FILES { return Err(invalid("Too many package files")); }
    let mut names = HashSet::new();
    let mut files = BTreeMap::new();
    let mut total = 0;
    for index in 0..zip.len() {
        let mut entry = zip.by_index(index).map_err(|_| invalid("Cannot read package entry"))?;
        let name = entry.name().to_owned();
        if entry.is_dir() { return Err(invalid("Package must contain files without explicit directory entries")); }
        if !manifest::valid_path(&name) || !names.insert(name.to_lowercase()) {
            return Err(invalid("Unsafe or duplicate package path"));
        }
        if entry.unix_mode().is_some_and(|mode| mode & 0o170000 == 0o120000) { return Err(invalid("Package symlinks are forbidden")); }
        let size = entry.size();
        if size > MAX_FILE_BYTES || total + size > MAX_BYTES { return Err(invalid("Plugin package exceeds size limit")); }
        total += size;
        let mut bytes = Vec::new();
        entry.by_ref().take(MAX_FILE_BYTES + 1).read_to_end(&mut bytes).map_err(|_| invalid("Corrupt package entry"))?;
        if bytes.len() as u64 != size { return Err(invalid("Package entry size mismatch")); }
        files.insert(name, bytes);
    }
    let descriptor = files.get("plugin.json").ok_or_else(|| invalid("Missing v1 plugin.json"))?;
    let manifest: Manifest = serde_json::from_slice(descriptor).map_err(|_| invalid("Invalid v1 plugin manifest"))?;
    manifest::validate(&manifest, host_version)?;
    let integrity = files.get("integrity.json").ok_or_else(|| invalid("Missing integrity.json"))?;
    let checks: Integrity = serde_json::from_slice(integrity).map_err(|_| invalid("Invalid integrity manifest"))?;
    if checks.files.len() + 1 != files.len() { return Err(invalid("Integrity file set differs from package")); }
    for (name, hash) in &checks.files {
        if name == "integrity.json" { return Err(invalid("Integrity file cannot hash itself")); }
        let contents = files.get(name).ok_or_else(|| invalid("Missing integrity entry"))?;
        if format!("{:x}", Sha256::digest(contents)) != *hash { return Err(invalid("Package integrity mismatch")); }
    }
    for path in [&manifest.entry.wasm, &manifest.entry.renderer, &manifest.entry.service].into_iter().flatten()
        .chain(manifest.contributions.pages.iter().map(|page| &page.entry)) {
        if !files.contains_key(path) { return Err(invalid("Declared entry is missing from package")); }
    }
    if manifest.entry.renderer.is_some() && !files.contains_key("ui/index.html") { return Err(invalid("Renderer requires ui/index.html")); }
    let revision = format!("{:x}", Sha256::digest(integrity));
    Ok(Package { manifest, revision, files })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Cursor, Write};
    use serde_json::json;
    fn archive(extra: Option<(&str, &[u8])>, damaged: bool) -> Vec<u8> {
        let manifest = serde_json::to_vec(&json!({"schemaVersion":1,"apiVersion":1,"minHostVersion":"0.1.0","id":"test","name":"Test","kind":"theme","version":"1.0.0","entry":{"wasm":"backend/plugin.wasm"},"capabilities":["theme"],"permissions":[]})).unwrap();
        let mut files = BTreeMap::from([("plugin.json",manifest), ("backend/plugin.wasm",vec![0,97,115,109])]);
        let checks: BTreeMap<_,_> = files.iter().map(|(k,v)| (*k,format!("{:x}",Sha256::digest(v)))).collect();
        files.insert("integrity.json",serde_json::to_vec(&json!({"files":checks})).unwrap());
        if damaged { files.insert("backend/plugin.wasm",vec![1]); }
        if let Some((name, contents)) = extra { files.insert(name,contents.to_vec()); }
        let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
        for (path, contents) in files { zip.start_file(path,zip::write::SimpleFileOptions::default()).unwrap(); zip.write_all(&contents).unwrap(); }
        zip.finish().unwrap().into_inner()
    }
    #[test]
    fn verifies_integrity_and_rejects_traversal_and_unlisted_files() {
        let package = read(Cursor::new(archive(None,false)),"0.1.0").unwrap();
        assert_eq!(package.manifest.id,"test"); assert_eq!(package.revision.len(),64); assert_eq!(package.files.len(),3);
        assert!(read(Cursor::new(archive(None,true)),"0.1.0").is_err());
        assert!(read(Cursor::new(archive(Some(("../escape",b"bad")),false)),"0.1.0").is_err());
        assert!(read(Cursor::new(archive(Some(("unlisted.js",b"bad")),false)),"0.1.0").is_err());
        assert!(read(Cursor::new(archive(Some(("PLUGIN.json",b"bad")),false)),"0.1.0").is_err());
    }

    // Run explicitly after build-plugin-packages.py; ordinary unit tests do not need generated artifacts.
    #[test]
    #[ignore = "requires all 24 built plugin packages"]
    fn all_migrated_packages_pass_native_validation() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../plugin/dist");
        let index: serde_json::Value = serde_json::from_slice(&std::fs::read(root.join("packages.json")).unwrap()).unwrap();
        let packages = index["packages"].as_array().unwrap();
        assert_eq!(packages.len(), 24);
        let mut ids = HashSet::new();
        let config: serde_json::Value = serde_json::from_str(include_str!("../../../tauri.conf.json")).unwrap();
        for item in packages {
            let relative = format!("{}/{}.monoplugin.zip", item["directory"].as_str().unwrap(), item["id"].as_str().unwrap());
            assert_eq!(item["file"], relative);
            assert_eq!(config["bundle"]["resources"][format!("../plugin/{relative}")], format!("plugin-packages/{relative}"));
            let file = std::fs::File::open(root.parent().unwrap().join(item["file"].as_str().unwrap())).unwrap();
            let package = read(file, env!("CARGO_PKG_VERSION")).unwrap_or_else(|error| panic!("{}: {:?}", item["file"], error));
            assert!(ids.insert(package.manifest.id.clone()));
            assert_eq!(package.manifest.id, item["id"]);
            assert_eq!(package.revision, item["revision"]);
        }
    }
}
