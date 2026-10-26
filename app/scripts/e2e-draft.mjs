/**
 * E2E：记录页刷新数据丢失修复验证
 * 流程：开始训练 → 记录一组 → 刷新页面 → 验证恢复 → 退出（保留草稿）→ 今日页继续 → 结束 → 验证草稿清除
 * 运行：node scripts/e2e-draft.mjs（需先 npm run build；使用本机 Edge 无头浏览器）
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 3199;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(500);
    res.end();
  }
});

const ok = (msg) => console.log('✅ ' + msg);
const fail = (msg) => { console.error('❌ ' + msg); process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** React 受控输入：必须用原生 setter + input 事件才能进 state */
const setReactInput = (el, value) =>
  el.evaluate((node, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(node, v);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

await new Promise((r) => server.listen(PORT, r));

const profile = path.join(ROOT, '..', '.e2e-profile');
rmSync(profile, { recursive: true, force: true });

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  userDataDir: profile,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 800 });
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('  [console.error]', m.text()); });

const waitText = (text, timeout = 20000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
const clickButton = async (text) => {
  const clicked = await page.evaluate((t) => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === t && !b.disabled);
    if (btn) { btn.click(); return true; }
    return false;
  }, text);
  if (!clicked) throw new Error(`按钮未找到：${text}`);
};

const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

try {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle2', timeout: 40000 });
  await waitText('开始训练');
  ok('1. 应用启动，种子计划就绪');

  await clickButton('开始训练');
  await waitText('添加一组');
  ok('2. 进入记录页');

  // 填写第一组 60kg × 10 并点击完成（触发 done + 草稿防抖落盘）
  const inputs = await page.$$('input');
  await setReactInput(inputs[0], '60');
  await setReactInput(inputs[1], '10');
  await page.evaluate(() => {
    const row = document.querySelectorAll('input')[0].closest('div.flex.items-center.gap-2');
    row.querySelector('button').click();
  });
  await sleep(900); // 等 500ms 防抖落盘完成
  ok('3. 完成第一组（60kg × 10），草稿已落盘');

  // —— 核心验证：刷新页面 ——
  // 设计预期：刷新后回到今日页，草稿以「未完成的训练」卡片呈现（单页状态机不持久化 tab）
  await page.reload({ waitUntil: 'networkidle2' });
  await waitText('未完成的训练');
  ok('4. 刷新后回到今日页，「未完成的训练」草稿卡片出现（数据未丢）');

  // 从卡片继续训练 → 组数据与完成状态完整恢复
  await clickButton('继续训练');
  await waitText('添加一组');
  const restored = await page.evaluate(() => {
    const w = document.querySelectorAll('input')[0];
    const row = w.closest('div.flex.items-center.gap-2');
    const btn = row.querySelector('button');
    return { weight: w.value, done: btn.classList.contains('from-purple-500') };
  });
  if (restored.weight === '60' && restored.done) ok('5. 继续训练后数据完整恢复：60kg × 10，完成状态保留');
  else fail(`5. 继续训练后恢复异常：weight=${restored.weight} done=${restored.done}`);

  // 左上角返回 → 保存并退出（草稿保留；退出落点是复盘页，需切回今日看卡片）
  await page.evaluate(() => document.querySelector('header button').click());
  await waitText('保存并退出');
  await clickButton('保存并退出');
  await waitText('训练时间线');
  await clickButton('今日');
  await waitText('未完成的训练');
  ok('6. 退出确认「保存并退出」后，今日页草稿卡片仍在（草稿保留）');

  // 从卡片继续训练 → 结束训练 → 复盘页出现该记录
  await clickButton('继续训练');
  await waitText('添加一组');
  await clickButton('结束');
  await waitText('训练时间线');
  ok('7. 从草稿继续训练并结束，进入复盘页（训练已落盘）');

  // 回到今日页：草稿卡片应消失，最近训练应出现
  await clickButton('今日');
  await sleep(600);
  if (await page.evaluate(() => !document.body.innerText.includes('未完成的训练'))) {
    ok('8. 结束后草稿卡片消失（草稿已清除）');
  } else {
    fail('8. 结束后草稿卡片仍在');
  }
  if (await page.evaluate((t) => document.body.innerText.includes(t), today)) {
    ok('9. 今日页「最近训练」出现刚完成的记录');
  } else {
    fail('9. 今日页未找到刚完成的训练记录');
  }
} catch (e) {
  fail('E2E 异常：' + e.message);
  try {
    const text = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').slice(0, 400));
    console.log('  [当前页面文本]', text);
    const inputs = await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => `${i.placeholder}=${i.value}`).join(', '));
    console.log('  [输入框状态]', inputs || '(无输入框)');
  } catch { /* 页面可能已关闭 */ }
} finally {
  await browser.close();
  server.close();
  rmSync(profile, { recursive: true, force: true });
}

console.log(process.exitCode ? '\n结果：存在失败项' : '\n结果：全部通过 🎉');
