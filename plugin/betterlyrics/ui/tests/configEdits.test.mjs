import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfigEdits } from '../src/utils/configEdits.mjs';

test('playback snapshots cannot overwrite a drag, even after matching its intermediate value', () => {
  const edits = createConfigEdits();
  edits.preview({ fontSize: 48 });
  assert.equal(edits.receive({ fontSize: 48 }).fontSize, 48);
  for (let i = 0; i < 20; i++) assert.equal(edits.receive({ fontSize: 40 }).fontSize, 48);
  edits.preview({ fontSize: 60 });
  assert.equal(edits.receive({ fontSize: 40 }).fontSize, 60);
});

test('release retains the latest edit until acknowledged; later host edits work', () => {
  const edits = createConfigEdits();
  edits.commit({ fontSize: 48 });
  edits.preview({ fontSize: 60 });
  edits.commit({ fontSize: 60 });
  assert.equal(edits.isEditing('fontSize'), false);
  assert.equal(edits.receive({ fontSize: 48 }).fontSize, 60);
  assert.equal(edits.receive({ fontSize: 60 }).fontSize, 60);
  assert.equal(edits.receive({ fontSize: 32 }).fontSize, 32);
});

test('protect only edited fields and acknowledge presets independently', () => {
  const edits = createConfigEdits();
  edits.commit({ lyricStyle: 'glow', glowAmount: 16 });
  let config = edits.receive({ lyricStyle: 'glow', glowAmount: 8, alignment: 'center' });
  assert.equal(config.glowAmount, 16);
  assert.equal(config.alignment, 'center');
  config = edits.receive({ lyricStyle: 'fan', glowAmount: 16 });
  assert.equal(config.lyricStyle, 'fan');
  assert.equal(config.glowAmount, 16);
});
