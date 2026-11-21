const fs = require('fs');
const path = require('path');
const P = require('./paths');

if (!fs.existsSync(P.MATTER)) {
  console.error('Нет matter.min.js. Сначала: cd dev && npm i');
  process.exit(1);
}

const read = p => fs.readFileSync(p, 'utf8');
// replacement-функция: иначе $-последовательности внутри min.js подставились бы specially
const guard = s => s.replace(/<\/script/gi, '<\\/script');

const page = read(path.join(P.SRC, 'page.html'));
const parts = {
  '/*__MATTER__*/': read(P.MATTER),
  '/*__CORE__*/': read(path.join(P.SRC, 'core.js')),
  '/*__APP__*/': read(path.join(P.SRC, 'app.js'))
};

let out = page;
for (const mark of Object.keys(parts)) {
  if (!out.includes(mark)) throw new Error('в шаблоне нет метки ' + mark);
  out = out.replace(mark, () => guard(parts[mark]));
}
if (out.includes('/*__')) throw new Error('остались незаменённые метки');
// URL в баннере лицензии Matter — это комментарий, сеть не дёргается.
// Проверяем именно места, где браузер начал бы что-то грузить.
for (const bad of ['src="http', "src='http", 'src=./', 'src="../', 'href="http', "href='http",
                   '@import', 'importScripts', 'url(http', "url('http", 'new Worker(', 'fetch(']) {
  if (out.includes(bad)) throw new Error('внешняя загрузка в готовом файле: ' + bad);
}
const tags = out.match(/<(script|link|img|iframe)\b[^>]*>/gi) || [];
for (const tg of tags) {
  if (/<img\b|<iframe\b/i.test(tg)) throw new Error('неожиданный тег: ' + tg.slice(0, 60));
  // Любой src/href обязан быть data: URI — иначе файл уже не автономен.
  const urls = [...tg.matchAll(/(?:src|href)\s*=\s*"([^"]*)"/gi)].map(m => m[1]);
  for (const u of urls) {
    if (!/^data:/i.test(u)) throw new Error('не-data URL в ' + tg.slice(1, 8) + ': ' + u.slice(0, 70));
  }
  if (/<script\b/i.test(tg) && urls.length) throw new Error('script с src: ' + tg.slice(0, 60));
}

fs.writeFileSync(P.INDEX, out);
const kb = (fs.statSync(P.INDEX).size / 1024).toFixed(1);
console.log('index.html собран: ' + kb + ' КБ, ' + out.split('\n').length + ' строк  ->  ' + P.INDEX);
