const { chromium } = require('playwright-core');
const P = require('./paths');

const browserInfo = P.findBrowser();
if (!browserInfo.path) {
  console.error('Не найден браузер. Укажите: QWEN_EDGE="C:/путь/msedge.exe" или QWEN_CHANNEL=chrome');
  process.exit(1);
}
const EDGE = browserInfo.path;
const CHANNEL = browserInfo.channel;

(async () => {
  const browser = await chromium.launch({
    channel: CHANNEL, executablePath: EDGE,
    args: ['--no-first-run', '--disable-gpu', '--allow-file-access-from-files']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(P.URL, { waitUntil: 'load' });
  await page.waitForTimeout(300);

  console.log('до клика:', await page.textContent('#status'), '| prog', await page.textContent('#prog'));
  await page.click('#start');

  let last = '';
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => {
      const s = window.__t.state();
      return { done: s.done, failed: s.failed, n: s.doneCount, stage: s.stageName, running: s.running };
    });
    const line = `${st.n}/8  ${st.done ? 'ГОТОВО' : st.failed ? 'СТОП: ' + st.failed : st.stage}`;
    if (line !== last) { console.log('  ' + line); last = line; }
    if (st.done || st.failed) break;
  }

  const fin = await page.evaluate(() => ({
    state: window.__t.state(),
    status: document.getElementById('status').textContent,
    prog: document.getElementById('prog').textContent,
    winShown: document.getElementById('win').classList.contains('on'),
    green: document.querySelectorAll('#stageList li.ok').length,
    startDisabled: document.getElementById('start').disabled
  }));
  console.log('\nитог:', JSON.stringify({ status: fin.status, prog: fin.prog, winShown: fin.winShown, green: fin.green, startDisabled: fin.startDisabled }));
  const fs = require('fs');
  fs.mkdirSync(P.SHOTS, { recursive: true });
  await page.screenshot({ path: P.SHOTS + '/live-win.png' });

  // и сброс должен вернуть всё в исходное состояние
  await page.click('#reset');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    n: window.__t.state().doneCount, running: window.__t.state().running,
    prog: document.getElementById('prog').textContent,
    green: document.querySelectorAll('#stageList li.ok').length
  }));
  console.log('после «Сброс»:', JSON.stringify(after));
  console.log('ошибки:', errors.length ? errors.join('\n  ') : 'нет');

  const pass = fin.state.done && fin.winShown && fin.green === 8 && after.n === 0 && after.green === 0 && !errors.length;
  console.log('\n== интерактивный прогон (Пуск -> ожидание -> Сброс): ' + (pass ? 'OK' : 'ПРОБЛЕМА') + ' ==');
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
