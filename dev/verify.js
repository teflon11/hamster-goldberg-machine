const { chromium } = require('playwright-core');
const fs = require('fs');
const P = require('./paths');

const browserInfo = P.findBrowser();
if (!browserInfo.path) {
  console.error('Не найден браузер. Укажите: QWEN_EDGE="C:/путь/msedge.exe" или QWEN_CHANNEL=chrome');
  process.exit(1);
}
const EDGE = browserInfo.path;
const CHANNEL = browserInfo.channel;
const URL = P.URL;
const SHOT = P.SHOTS;

(async () => {
  fs.rmSync(SHOT, { recursive: true, force: true });
  fs.mkdirSync(SHOT, { recursive: true });

  const browser = await chromium.launch({
    channel: CHANNEL, executablePath: EDGE,
    args: ['--no-first-run', '--disable-gpu', '--allow-file-access-from-files']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  const boot = await page.evaluate(() => ({
    hasMatter: typeof Matter !== 'undefined' && Matter.version,
    hasT: typeof window.__t === 'object' && Object.keys(window.__t),
    bodies: window.__t ? window.__t.state().total : -1,
    listItems: document.querySelectorAll('#stageList li').length
  }));
  console.log('загрузка:', JSON.stringify(boot));

  // ---- приёмка: 5 прогонов подряд внутри браузера ----
  let ok = 0;
  for (let i = 1; i <= 5; i++) {
    const r = await page.evaluate(() => window.__t.run(40));
    if (r.ok) { ok++; console.log(`прогон ${i}: OK  (${(r.steps / 60).toFixed(1)}s, ${r.doneCount}/${r.total})`); }
    else console.log(`прогон ${i}: FAIL — ${r.failed} | этап ${r.stage}: ${r.stageName}`);
  }
  console.log(`браузер: ${ok}/5 успешных прогонов`);

  // ---- скриншоты реальных состояний ----
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOT + '/a-start.png' });
  const mid = await page.evaluate(() => window.__t.play(3.2));
  await page.screenshot({ path: SHOT + '/b-mid.png' });
  const end = await page.evaluate(() => window.__t.play(9));
  await page.waitForTimeout(120);
  await page.screenshot({ path: SHOT + '/c-win.png' });
  console.log('после play(12.2):', JSON.stringify({ done: end.done, failed: end.failed, stage: end.stage, doneCount: end.doneCount }));

  // ---- нижняя панель при разных размерах окна ----
  const sizes = [[1440, 900], [1440, 560], [1000, 640], [800, 560], [700, 520], [430, 760]];
  let barFails = 0;
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(180);
    const r = await page.evaluate(() => {
      const bar = document.getElementById('bar'), b = bar.getBoundingClientRect();
      const kids = [...bar.children].map(el => el.getBoundingClientRect()).filter(k => k.width > 0 && k.height > 0);
      const tops = kids.map(k => Math.round(k.top));
      const bot = Math.max(...kids.map(k => k.bottom));
      const mids = kids.map(k => k.top + k.height / 2);
      return {
        barBottom: Math.round(b.bottom), innerH: window.innerHeight,
        barH: Math.round(b.height),
        clipped: Math.round(b.bottom) > window.innerHeight + 0.5,
        kidClipped: Math.round(bot) > Math.round(b.bottom) + 0.5,
        // строка одна, если центры всех элементов на одной высоте и панель не выросла
        midSpread: Math.round(Math.max(...mids) - Math.min(...mids)),
        oneLine: (Math.max(...mids) - Math.min(...mids)) < 6 && bar.scrollHeight <= bar.clientHeight + 1,
        sceneH: Math.round(document.getElementById('scene').getBoundingClientRect().height),
        barReserved: getComputedStyle(document.documentElement).getPropertyValue('--bar').trim()
      };
    });
    const bad = r.clipped || r.kidClipped || !r.oneLine || r.barReserved === '0px';
    if (bad) barFails++;
    console.log(`  ${String(w + '×' + h).padEnd(10)} bar=${r.barH}px резерв=${r.barReserved} сцена=${r.sceneH}px разбросЦентров=${r.midSpread}px ${bad ? 'ПРОБЛЕМА ' + JSON.stringify(r) : 'ok'}`);
    await page.screenshot({ path: SHOT + `/bar-${w}x${h}.png` });
  }

  console.log('\nошибки страницы:', errors.length ? errors.join('\n  ') : 'нет');
  const pass = ok === 5 && end.done && barFails === 0 && errors.length === 0;
  console.log('\n== приёмка: ' + (pass ? 'ПРОЙДЕНА' : 'НЕ ПРОЙДЕНА') + ' ==');
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
