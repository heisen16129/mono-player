import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Plugin build failed: ${command} ${args.join(' ')}`);
}
run(process.execPath, ['scripts/build-plugin-wasm.mjs']);
run(process.execPath, ['scripts/build-plugin-renderers.mjs']);
run(process.execPath, ['plugin/stem-separation/build.mjs']);
run(process.execPath, ['plugin/miot/build.mjs']);
run('python', ['scripts/build-plugin-packages.py']);
run('cargo', ['test', '--offline', '--manifest-path', 'src-tauri/Cargo.toml', 'all_migrated_packages_pass_native_validation', '--lib', '--', '--ignored']);

run('cargo', ['test', '--offline', '--manifest-path', 'src-tauri/Cargo.toml', 'all_migrated_wasm_metadata_matches_canonical_manifests', '--lib', '--', '--ignored']);
