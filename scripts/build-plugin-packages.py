"""Package already-built v1 plugins; never copy dependencies or build caches."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "plugin" / "dist"


def package(directory):
    manifest_path = directory / "plugin.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != 1 or manifest.get("apiVersion") != 1:
        raise ValueError(f"{directory.name}: only API v1 can be packaged")
    files = {"plugin.json": manifest_path.read_bytes()}
    for name in ("backend", "ui", "assets"):
        for path in sorted((directory / name).rglob("*")):
            if any(part in {'node_modules', 'target', '.git', '__pycache__', '.vite'} for part in path.relative_to(directory).parts):
                continue
            if path.is_symlink():
                raise ValueError(f"{path}: symlinks are forbidden")
            if path.is_file():
                files[path.relative_to(directory).as_posix()] = path.read_bytes()
    for path in directory.iterdir():
        if path.is_file() and path.name.startswith(("LICENSE", "NOTICE", "COPYING")):
            files[path.name] = path.read_bytes()
    for entry in manifest['entry'].values():
        if entry and entry.startswith('dist/'):
            files[entry] = (directory / entry).read_bytes()
    entries = list(manifest["entry"].values()) + [p["entry"] for p in manifest.get("contributions", {}).get("pages", [])]
    for entry in entries:
        if entry and entry not in files:
            raise ValueError(f"{directory.name}: declared entry is missing: {entry}")
    if len(files) >= 2048 or sum(map(len, files.values())) > 256 * 1024 * 1024 or any(len(b) > 64 * 1024 * 1024 for b in files.values()):
        raise ValueError(f"{directory.name}: package exceeds host limits")
    integrity = {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())}
    files["integrity.json"] = json.dumps({"files": integrity}, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    filename = f"{manifest['id']}.monoplugin.zip"
    destination = directory / filename
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    return {"directory": directory.name, "id": manifest["id"], "file": f"{directory.name}/{filename}",
            "revision": hashlib.sha256(files["integrity.json"]).hexdigest(),
            "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    directories = sorted(p.parent for p in (ROOT / "plugin").glob("*/plugin.json"))
    if len(directories) != 24:
        raise ValueError(f"Expected 24 plugins, found {len(directories)}")
    packages = [package(directory) for directory in directories]
    catalog = [dict(json.loads((directory / "plugin.json").read_text(encoding="utf-8")), file=item["file"])
               for directory, item in zip(directories, packages)]
    (OUTPUT / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUTPUT / "packages.json").write_text(json.dumps({"apiVersion": 1, "sourceMigrationComplete": True, "runtimeAcceptance": "see docs/plugin-api-progress.md", "packages": packages}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Packaged {len(packages)} plugins in their own directories; indexes in {OUTPUT}. API v1 package build complete.")
