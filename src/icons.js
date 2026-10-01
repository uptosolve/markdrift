// MarkDrift line icons. Original geometry on a 24x24 grid.
// All icons share one style: no fill, currentColor stroke 1.75, round caps and joins.

export const ICONS = {
  upload:
    '<path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>' +
    '<path d="M12 15V4"/><path d="M7.5 8.5 12 4l4.5 4.5"/>',
  download:
    '<path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>' +
    '<path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  x: '<path d="M6.5 6.5l11 11"/><path d="M17.5 6.5l-11 11"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M9 5.5v13"/><path d="M15 5.5v13"/>',
  lock:
    '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/>' +
    '<path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.25v2"/>',
  folder:
    '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.4.6l1.4 1.4h6.6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  video:
    '<rect x="3" y="5" width="18" height="14" rx="2.5"/>' +
    '<path d="M10.25 9.5v5l4.25-2.5z"/>',
  image:
    '<rect x="3" y="5" width="18" height="14" rx="2.5"/>' +
    '<path d="M3 17l6-6 8 8"/><path d="M14 16l3-3 4 4"/>' +
    '<circle cx="16" cy="9" r="1.5"/>',
  trash:
    '<path d="M4 7h16"/>' +
    '<path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2"/>' +
    '<path d="M6 7l.8 11.2a2 2 0 0 0 2 1.8h6.4a2 2 0 0 0 2-1.8L18 7"/>' +
    '<path d="M10 11v5"/><path d="M14 11v5"/>',
  'chevron-down': '<path d="M6 9.5l6 6 6-6"/>',
  'arrow-up': '<path d="M12 19V5"/><path d="M6.5 10.5 12 5l5.5 5.5"/>',
  shuffle:
    '<path d="M4 7h2.5c2 0 3 1 4 2.5l3 5c1 1.5 2 2.5 4 2.5H20"/>' +
    '<path d="M4 17h2.5c2 0 3-1 4-2.5l3-5c1-1.5 2-2.5 4-2.5H20"/>' +
    '<path d="M17.5 4.5 20 7l-2.5 2.5"/><path d="M17.5 14.5 20 17l-2.5 2.5"/>',
  alert:
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<path d="M12 7.75v4.75"/><path d="M12 16.25v.01"/>',
};

export function icon(name, size = 20) {
  const body = ICONS[name];
  if (!body) throw new Error(`Unknown icon: ${name}`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"` +
    ` fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"` +
    ` aria-hidden="true" focusable="false">${body}</svg>`
  );
}
