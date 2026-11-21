/* Пересоздаёт картинки README: живой прогон с реальным кликом и ожиданием,
   чтобы в кадре были настоящие состояния, а не синхронная докрутка. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const P = require('./paths');

const browserInfo = P.findBrowser();
if (!browserInfo.path) {
  console.error('Не найден браузер. Укажите: QWEN_EDGE="C:/путь/msedge.exe" или QWEN_CHANNEL=chrome');
  process.exit(1);
}

(async () => {
  fs.mkdirSync(P.DOCS, { recursive: true });
  const browser = await chromium.launch({
    channel: browserInfo.channel, executablePath: browserInfo.path,
    args: ['--no-first-run', '--disable-gpu', '--allow-file-access-from-files']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(P.URL, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  await page.click('#start');
  // ждём реальным временем, чтобы конфетти и анимация были в настоящем кадре
  await page.waitForTimeout(5400);
  const st = await page.evaluate(() => window.__t.state());
  console.log('кадр:', st.doneCount + '/' + st.total, st.done ? 'ГОТОВО' : st.stageName);
  await page.screenshot({ path: path.join(P.DOCS, 'preview.png') });

  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(P.DOCS, 'preview-final.png') });
  console.log('файлы:', fs.readdirSync(P.DOCS)
    .map(f => f + ' ' + (fs.statSync(path.join(P.DOCS, f)).size / 1024).toFixed(0) + 'К')
    .join(', '));
  await browser.close();
})();
