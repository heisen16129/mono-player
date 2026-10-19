import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { computed, ref, effectScope, onScopeDispose } from 'vue';
const { code } = await transform(readFileSync('src/composables/useScanFolders.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export function', 'function'), { loader: 'ts' });

for (const canceled of [false, true]) {
  test(`submits all directories once, displays backend progress and handles cancellation=${canceled}`, async () => {
    let listener, resolveScan, started, removed = 0, cancelCalls = 0;
    const ready = new Promise(resolve => { started = resolve; });
    const calls = [];
    const player = { settings: { musicDirs: ['D:/A', 'E:/B'], locale: 'en-US' },
      async setMusicDirs() {},
      scanLibraries: paths => { calls.push([...paths]); started(); return new Promise(resolve => { resolveScan = resolve; }); },
    };
    const context = vm.createContext({ ref, computed, onScopeDispose,
      resolveLocale: x => x, getErrorMessage: e => e.message, isTauriRuntime: () => true,
      listen: async (name, callback) => { assert.equal(name, 'scan://batch'); listener = callback; return () => { removed++; }; },
      cancelScanMusicDir: async () => { cancelCalls++; },
    });
    vm.runInContext(code, context);
    const scope = effectScope();
    const ui = scope.run(() => context.useScanFolders({ player, activeFolderPath: ref(null) }));
    ui.openScanDialog();
    ui.updateScanFolderChecked('D:/A', true); ui.updateScanFolderChecked('E:/B', true);
    const pending = ui.confirmScanFolders();
    await ready;
    assert.deepEqual(calls, [['D:/A', 'E:/B']]);
    listener({ payload: { currentFolder: 'E:/B', completedFolders: 1, totalFolders: 2, scannedTracks: 7 } });
    assert.equal(ui.scanProgressText.value, '2/2 - 7 tracks scanned - B');
    if (canceled) { await ui.cancelScanFolders(); assert.equal(cancelCalls, 1); }
    resolveScan({ canceled }); await pending;
    assert.equal(ui.isConfirmingScan.value, false);
    assert.equal(ui.isScanDialogOpen.value, canceled);
    assert.equal(removed, 1);
    assert.equal(calls.length, 1);
    scope.stop();
  });
}

test('failed directory removal keeps the folder and active selection visible', async () => {
  const player = { settings: { musicDirs: ['D:/A'], locale: 'en-US' }, setMusicDirs: async () => { throw new Error('save failed'); } };
  const context = vm.createContext({ ref, computed, onScopeDispose, resolveLocale: x => x, isTauriRuntime: () => true });
  vm.runInContext(code, context);
  const scope = effectScope(), activeFolderPath = ref('D:/A');
  const ui = scope.run(() => context.useScanFolders({ player, activeFolderPath }));
  ui.openScanDialog();
  await ui.removeScanFolder('D:/A');
  assert.equal(ui.scanFolders.value.length,1);
  assert.equal(activeFolderPath.value,'D:/A');
  scope.stop();
});
