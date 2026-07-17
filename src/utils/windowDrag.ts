export function shouldSkipWindowDrag(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true;

  return Boolean(
    target.closest(
      [
        'button',
        'a',
        'input',
        'select',
        'textarea',
        '[role="button"]',
        '[role="menu"]',
        '.window-controls',
        '.track-row',
        '.queue-popover',
        '.volume-popover',
        '.lyrics-panel',
        '.plugin-table',
        '.drag-handle',
      ].join(', '),
    ),
  );
}
