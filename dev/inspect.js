const fs = require('fs');
const P = require('./paths');
const s = fs.readFileSync(P.INDEX, 'utf8');

// Значения src/href внутри тегов, грузящих ресурсы. Разбираем сами атрибуты:
// регулярка с необязательной кавычкой ["']? проверяла бы look-ahead на самой
// кавычке и давала ложный «есть внешний URL» для data: URI.
const externalUrls = [];
for (const tg of (s.match(/<(script|link|img|iframe)\b[^>]*>/gi) || [])) {
  for (const m of tg.matchAll(/(?:src|href)\s*=\s*"([^"]*)"/gi)) {
    if (!/^data:/i.test(m[1])) externalUrls.push(m[1].slice(0, 60));
  }
}

const checks = {
  'полный документ (doctype)': /^<!DOCTYPE html>/i.test(s.trim()),
  'Matter.js 0.20.0 инлайнится': /matter-js 0\.20\.0/.test(s),
  'createMachine инлайнится': /function createMachine/.test(s),
  'отладочный API есть': /window\.__t\s*=/.test(s),
  'нет внешних src/href': externalUrls.length === 0,
  'нет @import / fetch / importScripts': !/@import|importScripts|fetch\(/.test(s),
  'нет CDN-ссылок': !/\/\/cdn|unpkg|jsdelivr|cdnjs/i.test(s),
  'помеченные EXCEPTION есть': (s.match(/EXCEPTION/g) || []).length >= 2,
  'фиксированный шаг 1/60': /STEP = 1000 \/ 60/.test(s),
  'нет Math.random в физике': !/Math\.random\(\)[^;]*;.*(body|position|angle)/i.test(s),
  'watchdog называет этап': /stageName/.test(s) && /STAGE_LIMIT/.test(s),
  'резерв высоты нижней панели': /--bar/.test(s) && /ResizeObserver/.test(s)
};
let bad = 0;
for (const k of Object.keys(checks)) {
  if (!checks[k]) bad++;
  console.log(`  ${checks[k] ? 'ok  ' : 'ПЛОХО'} ${k}`);
}
console.log(`\nindex.html: ${(s.length / 1024).toFixed(1)} КБ, ${s.split('\n').length} строк, ${bad ? bad + ' замечаний' : 'замечаний нет'}`);
process.exit(bad ? 1 : 0);
