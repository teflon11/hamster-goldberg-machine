const fs = require('fs');
const P = require('./paths');
const s = fs.readFileSync(P.INDEX, 'utf8');
const checks = {
  'полный документ (doctype)': /^<!DOCTYPE html>/i.test(s.trim()),
  'Matter.js 0.20.0 инлайнится': /matter-js 0\.20\.0/.test(s),
  'createMachine инлайнится': /function createMachine/.test(s),
  'отладочный API есть': /window\.__t\s*=/.test(s),
  'нет внешних src/href': !/<(script|link|img|iframe)[^>]+(src|href)\s*=\s*["']?(?!data:)/i.test(s),
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
