/* Пути харнеса. Корень репозитория = на уровень выше dev/.
   Ничего не зашито абсолютного, кроме пути браузера по умолчанию. */
const path = require('path');
const fs = require('fs');

const DEV = __dirname;
const ROOT = path.resolve(DEV, '..');

// Куда положить промежуточные скриншоты проверки. Вне репозитория,
// чтобы приёмка не создавала мусора в рабочем дереве.
const SHOTS = process.env.QWEN_SHOTS
  ? path.resolve(process.env.QWEN_SHOTS)
  : path.join(fs.mkdtempSync(path.join(require('os').tmpdir(), 'goldberg-verify-')), 'shots');

// Браузер для headless-проверки. По умолчанию Edge (ставится с Windows 10/11);
// можно перебить: QWEN_EDGE="C:/.../chrome.exe" или QWEN_CHANNEL=chrome
const BROWSERS = {
  msedge: [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ],
  chrome: [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
  ]
};

function findBrowser() {
  if (process.env.QWEN_EDGE) return { path: process.env.QWEN_EDGE, channel: process.env.QWEN_CHANNEL || 'msedge' };
  const channel = process.env.QWEN_CHANNEL || 'msedge';
  for (const p of (BROWSERS[channel] || BROWSERS.msedge)) {
    if (fs.existsSync(p)) return { path: p, channel };
  }
  return { path: null, channel };
}

module.exports = {
  DEV, ROOT, SHOTS,
  SRC: path.join(DEV, 'src'),
  MATTER: path.join(DEV, 'node_modules', 'matter-js', 'build', 'matter.min.js'),
  INDEX: path.join(ROOT, 'index.html'),
  DOCS: path.join(ROOT, 'docs'),
  URL: 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'),
  findBrowser
};
