// Small, consistent vector icons for the botanical interface.
const paths = {
  temperature:
    '<path d="M9 14.5V5a3 3 0 0 1 6 0v9.5a5 5 0 1 1-6 0Z"/><path d="M12 8v10"/><circle cx="12" cy="18" r="1"/>',
  mist: '<path d="M12 3S5 10 5 15a7 7 0 0 0 14 0c0-5-7-12-7-12Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  leaf: '<path d="M5 19C1 10 7 3 21 3c0 14-7 20-16 16Zm0 0L16 8"/>',
};
export function icon(name) {
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.leaf}</svg>`;
}
const crops = {
  Cucumber:
    '<path d="M15 37C7 32 18 10 28 8c7-1 8 5 6 12-3 11-11 23-19 17Z"/><path d="m29 8 4-4M17 26l1-2m5-7 1-2m0 15 1-2m4-6 1-2"/>',
  Tomato:
    '<path d="M24 15c-19-7-24 24 0 25 24-1 19-32 0-25Z"/><path d="m24 16-7 3 2-6-5-3 8 1 2-7 3 7 7-1-5 4 2 5-7-3Z"/><path d="M12 26c-1 4 2 8 5 9"/>',
  Lettuce:
    '<path d="M24 41C8 41 3 31 9 25 2 16 10 9 17 12c0-9 14-10 16-1 9-3 14 7 8 14 7 10-4 16-17 16Z"/><path d="M24 40V18m0 13-9-8m9 13 10-9m-10-3 6-7"/>',
  Cauliflower:
    '<path d="M12 28c-10-4-7-15 1-15-2-9 10-12 14-6 8-5 16 2 12 9 10 5 5 16-3 15"/><path d="M24 41C12 41 7 34 7 26c9 0 15 5 17 15Zm0 0c0-10 8-16 17-16 0 10-6 16-17 16Z"/><path d="M24 41V25"/>',
  Clover:
    '<path d="M24 23C8 24 5 10 13 8c6-1 10 5 11 15Zm0 0C23 7 36 3 39 11c2 6-4 11-15 12Zm0 0c16-1 20 12 12 15-6 2-11-4-12-15Zm0 0C25 39 12 42 9 34c-2-6 4-10 15-11Z"/><path d="M24 24c1 8-1 14-6 19"/>',
};
export function cropIcon(name) {
  return `<svg class="crop-art" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${crops[name] || crops.Lettuce}</svg>`;
}
