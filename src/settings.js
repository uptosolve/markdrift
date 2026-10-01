const KEY = 'markdrift.settings.v1';

export const DEFAULTS = {
  kind: 'text',          // 'text' | 'image'
  text: '',              // empty on purpose: nobody should export a placeholder by accident
  font: 'sans',
  bold: true,
  color: '#ffffff',
  outline: true,
  whiten: false,
  logoId: 0,

  size: 5,               // % of the short side of the frame
  opacity: 60,           // %
  rotation: 0,           // degrees, for single marks
  margin: 3,             // % of short side

  mode: 'bounce',        // fixed | bounce | jump | tile | combo
  position: 'br',
  speed: 4,              // 1..10
  interval: 3,           // seconds, jump mode
  tileGap: 12,           // extra spacing between tiles
  tileAngle: -30,
  tileDrift: true,
  tileOpacity: 35,       // % of main opacity, combo mode

  jitter: 35,            // 0..100
  seed: 1,

  quality: 'original',   // original | high | low
};

export function randomSeed() {
  return Math.floor(Math.random() * 1e9) + 1;
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const s = { ...DEFAULTS, ...saved };
      if (!['original', 'high', 'low'].includes(s.quality)) s.quality = DEFAULTS.quality;
      if (!['fixed', 'bounce', 'jump', 'tile', 'combo'].includes(s.mode)) s.mode = DEFAULTS.mode;
      return s;
    }
  } catch { /* storage blocked, fall back to defaults */ }
  return { ...DEFAULTS, seed: randomSeed() };
}

export function saveSettings(s) {
  try {
        localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}
