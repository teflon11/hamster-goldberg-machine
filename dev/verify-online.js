/* Проверяет опубликованный экспонат: ждёт, пока Pages отдаст страницу,
   и прогоняет на живом URL те же проверки, что и локально. */
const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const P = require('./paths');

const LIVE = process.argv[2] || 'https://teflon11.github.io/hamster-goldberg-machine/';

function pagesStatus() {
  try {
    const out = execFileSync('gh', ['api', 'repos/teflon11/hamster-goldberg-machine/pages',
      '--jq', '.status + "|" + .html_url'], { encoding: 'utf8' }).trim();
    return out.split('|')[0];
  } catch (e) { return 'нет ответа'; }
}

(async () => {
  console.log('ожидание сборки Pages…');
  let st = '';
  for (let i = 0; i < 40; i++) {
    st = pagesStatus();
    if (st === 'built') break;
    process.stdout.write(`  ${st || 'building'}\r`);
    await new Promise(r => setTimeout(r, 5000));
  }
  console.log('  статус Pages:', st || 'built');

  const b = P.findBrowser();
  if (!b.path) { console.error('Браузер не найден'); process.exit(1); }
  const browser = await chromium.launch({
    channel: b.channel, executablePath: b.path,
    args: ['--no-first-run', '--disable-gpu']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  const failedRequests = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => failedRequests.push(r.url() + ' :: ' + (r.failure() || {}).errorText));
  page.on('response', r => { if (r.status() >= 400) failedRequests.push('HTTP ' + r.status() + ' ' + r.url()); });

  console.log('загрузка:', LIVE);
  const resp = await page.goto(LIVE, { waitUntil: 'load', timeout: 60000 });
  console.log('  ответ сервера:', resp.status());
  await page.waitForTimeout(800);

  const boot = await page.evaluate(() => ({
    matter: typeof Matter !== 'undefined' ? Matter.version : null,
    stages: window.__t ? window.__t.state().total : -1,
    title: document.title,
    barVisible: (() => { const b = document.getElementById('bar').getBoundingClientRect();
      return b.bottom <= window.innerHeight + 0.5 && b.height > 0; })()
  }));
  console.log('состояние:', JSON.stringify(boot));

  // 5 прогонов ядра прямо на опубликованной странице
  let ok = 0;
  for (let i = 1; i <= 5; i++) {
    const r = await page.evaluate(() => window.__t.run(40));
    if (r.ok) ok++; else console.log(`  прогон ${i} FAIL: ${r.failed} (этап ${r.stage})`);
  }
  console.log(`прогонов на живом URL: ${ok}/5`);

  // реальный клик по опубликованной странице
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('#start');
  let fin = null;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    fin = await page.evaluate(() => window.__t.state());
    if (fin.done || fin.failed) break;
  }
  console.log('после клика:', fin.done ? 'ГОТОВО' : 'СТОП: ' + fin.failed, `(${fin.doneCount}/${fin.total})`);

  console.log('ошибки страницы:', errors.length ? errors.join('; ') : 'нет');
  console.log('сбой запросов:', failedRequests.length ? [...new Set(failedRequests)].join('; ') : 'нет');

  const pass = ok === 5 && fin.done && boot.matter === '0.20.0' && boot.barVisible
    && errors.length === 0 && failedRequests.length === 0;
  console.log('\n== опубликованный экспонат: ' + (pass ? 'РАБОТАЕТ' : 'ПРОБЛЕМА') + ' ==');
  await page.screenshot({ path: P.SHOTS + '/online.png' }).catch(() => {});
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
