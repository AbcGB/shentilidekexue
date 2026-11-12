// 复制统计验收测试（对应《文案复制次数统计与使用热度系统》第十四部分）。
// 用法：npm run build 后运行 npm run test:stats（自动用临时数据库启动独立服务，不影响本地预览数据）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { startServer } from './test-server.mjs';
import { openSqlite } from '../api/adapters/sqlite.mjs';
import { handleApi, applySchema, syncManifest } from '../api/core.mjs';
import { buildManifest } from './build-copy-manifest.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.error('  ✗ ' + m); } };
const TOKEN = 'test-admin-token-' + Math.random().toString(36).slice(2);
const db = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stl-')), 'stats.sqlite');
const env = { STATS_ADMIN_TOKEN: TOKEN, STATS_SALT: 'test-salt', RATE_LIMIT_PER_MIN: '100000' };
const s1 = await startServer({ port: 4391, db, env });
const s2 = await startServer({ port: 4392, db, env, staticDir: '' }); // 第二个进程共用同一数据库（模拟多实例并发）
const BASE = s1.url;
const chromePath = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: chromePath, args: ['--no-sandbox'] });

async function snapshot() {
  const out = {};
  for (const a of ['sanyinjiao', 'zusanli', 'houxi']) {
    const r = await (await fetch(`${BASE}/api/stats?acupoint=${a}`)).json();
    for (const [k, v] of Object.entries(r.stats)) out[k] = v.t;
  }
  return out;
}
function diff(a, b) { const d = {}; for (const k of Object.keys(b)) if ((b[k] || 0) !== (a[k] || 0)) d[k] = b[k] - (a[k] || 0); return d; }
const same = (d, exp) => JSON.stringify(Object.entries(d).sort()) === JSON.stringify(Object.entries(exp).sort());
const id = (a, acc, t) => `${a}:${acc}:${t}:a:v1`;

async function teacher(ctxOpts = {}) {
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1280, height: 900 }, ...ctxOpts });
  const page = await ctx.newPage();
  return { ctx, page };
}
async function open(page, slug) {
  await page.goto(`${BASE}/teacher/${slug}/`);
  await page.waitForFunction(() => document.querySelector('.wb-stat.ready'));
}
const statText = (page, itemId) => page.locator(`.wb-stat[data-stat-for="${itemId}"] [data-t]`).first().textContent();
const d7Text = (page, itemId) => page.locator(`.wb-stat[data-stat-for="${itemId}"] [data-d7]`).first().textContent();
async function click(page, key) {
  await page.locator(`[data-copy-key="${key}"]`).click();
  await page.waitForFunction(() => !document.querySelector('[data-busy]'));
}

console.log('1. 老师A复制标题1 → 标题1 +1');
const A = await teacher();
await open(A.page, 'sanyinjiao');
let before = await snapshot();
await click(A.page, 'title:wx-video');
let after = await snapshot();
ok(same(diff(before, after), { [id('sanyinjiao', 'wx-video', 'title')]: 1 }), '只有三阴交·视频号标题 +1');
ok((await statText(A.page, id('sanyinjiao', 'wx-video', 'title'))) === '1' && (await d7Text(A.page, id('sanyinjiao', 'wx-video', 'title'))) === '1', '页面上累计与近7天立即更新为 1');
ok((await A.page.locator('.toast').textContent()) === '复制成功！', '提示“复制成功！”');

console.log('2. 老师B（另一个浏览器会话）刷新后看到新的累计次数；复制标题2 独立 +1');
const B = await teacher();
await open(B.page, 'sanyinjiao');
ok((await statText(B.page, id('sanyinjiao', 'wx-video', 'title'))) === '1', '老师B看到标题1累计 1');
before = await snapshot();
await click(B.page, 'title:douyin');
after = await snapshot();
ok(same(diff(before, after), { [id('sanyinjiao', 'douyin', 'title')]: 1 }), '标题2（抖音）独立 +1，标题1 不变');

console.log('3/4. 复制描述不加标题；复制关键词不加描述；话题标签独立');
before = await snapshot();
await click(B.page, 'description:wx-video');
after = await snapshot();
ok(same(diff(before, after), { [id('sanyinjiao', 'wx-video', 'description')]: 1 }), '描述 +1，标题不变');
before = after;
await click(B.page, 'keywords:wx-video');
after = await snapshot();
ok(same(diff(before, after), { [id('sanyinjiao', 'wx-video', 'keywords')]: 1 }), '关键词 +1，描述不变');
before = after;
await click(B.page, 'hashtags:wx-video');
after = await snapshot();
ok(same(diff(before, after), { [id('sanyinjiao', 'wx-video', 'hashtags')]: 1 }), '话题标签 +1，其他不变');

console.log('5/6. 三阴交不影响足三里；不同账号不混淆');
const zs = Object.entries(after).filter(([k]) => k.startsWith('zusanli:'));
ok(zs.length > 0 && zs.every(([, v]) => v === 0), '足三里全部为 0');
ok(Object.entries(after).filter(([k]) => k.startsWith('sanyinjiao:') && !k.includes(':wx-video:') && k !== id('sanyinjiao', 'douyin', 'title')).every(([, v]) => v === 0), '三阴交其他账号均为 0');
await open(A.page, 'zusanli');
before = await snapshot();
await click(A.page, 'title:wx-video');
after = await snapshot();
ok(same(diff(before, after), { [id('zusanli', 'wx-video', 'title')]: 1 }), '复制足三里标题1 只加足三里，三阴交标题1 仍为 ' + after[id('sanyinjiao', 'wx-video', 'title')]);

console.log('7. 排序后复制仍对应正确文案');
await open(B.page, 'sanyinjiao');
// 让抖音描述 2 次、小红书描述 1 次，形成不同次数
await click(B.page, 'description:douyin'); await B.page.waitForTimeout(2100);
await A.page.goto(`${BASE}/teacher/sanyinjiao/`); await A.page.waitForFunction(() => document.querySelector('.wb-stat.ready'));
await click(A.page, 'description:douyin'); await click(A.page, 'description:xiaohongshu');
await open(B.page, 'sanyinjiao');
await B.page.selectOption('[data-sort-select="description"]', 't-desc');
const order = await B.page.$$eval('[data-rows="description"] > .wb-row', (rs) => rs.map((r) => ({ acc: r.dataset.account, t: Number(r.dataset.t) })));
ok(order[0].acc === 'douyin' && order.every((r, i) => i === 0 || r.t <= order[i - 1].t), '“累计多→少”排序正确：' + order.map((r) => `${r.acc}=${r.t}`).join(' '));
const copyMap = JSON.parse(await B.page.locator('#copy-data').textContent());
const aligned = await B.page.$$eval('[data-rows="description"] > .wb-row', (rs) => rs.map((r) => ({ acc: r.dataset.account, item: r.dataset.itemId, btnItem: r.querySelector('button').dataset.itemId, btnKey: r.querySelector('button').dataset.copyKey, text: r.querySelector('.wb-text').textContent })));
ok(aligned.every((r) => r.btnKey === `description:${r.acc}` && r.item === r.btnItem && r.item.includes(`:${r.acc}:description:`) && r.text === copyMap[r.btnKey]), '排序后每行的账号、文字、按钮、内容编号仍一一对应');
// 复制排序后的第 3 行
const third = aligned[2];
before = await snapshot();
await B.page.locator('[data-rows="description"] > .wb-row').nth(2).locator('button').click();
await B.page.waitForFunction(() => !document.querySelector('[data-busy]'));
const clip = await B.page.evaluate(() => navigator.clipboard.readText());
after = await snapshot();
ok(clip === copyMap[`description:${third.acc}`], `排序后第 3 行复制到的是 ${third.acc} 的描述`);
ok(same(diff(before, after), { [third.item]: 1 }), '且只给该条计数');
await B.page.selectOption('[data-sort-select="description"]', 'd7-asc');
const asc = await B.page.$$eval('[data-rows="description"] > .wb-row', (rs) => rs.map((r) => Number(r.dataset.d7)));
ok(asc.every((v, i) => i === 0 || v >= asc[i - 1]), '“近7天少→多”排序正确');
await B.page.click('[data-sort-reset="description"]');
const def = await B.page.$$eval('[data-rows="description"] > .wb-row', (rs) => rs.map((r) => r.dataset.index).join(''));
ok(def === '012345' && (await B.page.inputValue('[data-sort-select="description"]')) === 'default', '“恢复默认”回到账号 1—6 顺序');
for (const g of ['title', 'keywords']) ok(await B.page.locator(`[data-sort-select="${g}"]`).count() === 1, `${g} 区域也有排序`);

console.log('8. 复制失败不增加次数');
before = await snapshot();
await B.page.evaluate(() => { window.__forceManualCopy = true; });
await B.page.locator('[data-copy-key="title:xiaohongshu"]').click();
await B.page.waitForTimeout(500);
ok(await B.page.locator('.manual-dialog.open').isVisible(), '弹出手动复制框');
after = await snapshot();
ok(same(diff(before, after), {}), '没有任何计数变化');
await B.page.click('[data-manual-close]');
await B.page.evaluate(() => { window.__forceManualCopy = false; });

console.log('9. 连续误触不重复计数');
before = await snapshot();
await B.page.evaluate(() => { const b = document.querySelector('[data-copy-key="keywords:douyin"]'); for (let i = 0; i < 6; i++) b.click(); });
await B.page.waitForTimeout(800);
await B.page.locator('[data-copy-key="keywords:douyin"]').click(); // 0.8 秒后再点
await B.page.waitForFunction(() => !document.querySelector('[data-busy]'));
await B.page.waitForTimeout(2200);
await B.page.locator('[data-copy-key="keywords:douyin"]').click(); // 3 秒后（服务器 10 秒去重）
await B.page.waitForFunction(() => !document.querySelector('[data-busy]'));
after = await snapshot();
ok(same(diff(before, after), { [id('sanyinjiao', 'douyin', 'keywords')]: 1 }), '6 次连点 + 两次补点（10 秒内）只计 1 次');

console.log('10. 整组复制按规则计数');
before = await snapshot();
await click(B.page, 'account:ding-device');
after = await snapshot();
const exp = {}; for (const t of ['account_bundle', 'title', 'description', 'keywords', 'hashtags']) exp[id('sanyinjiao', 'ding-device', t)] = 1;
ok(same(diff(before, after), exp), '单账号整组：整组 +1，该账号标题/描述/关键词/标签各 +1，其他不变');
ok((await statText(B.page, id('sanyinjiao', 'ding-device', 'account_bundle'))) === '1' && (await statText(B.page, id('sanyinjiao', 'ding-device', 'title'))) === '1', '页面上整组与单条数字分别显示并更新');
before = after;
await click(B.page, 'all');
after = await snapshot();
ok(same(diff(before, after), { [id('sanyinjiao', '_all', 'all_bundle')]: 1 }), '全部六组：只记一次整批，不计入任何单条或账号整组');
const adm = await (await fetch(`${BASE}/api/admin/stats`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
const bt = (t) => adm.batches.filter((b) => b.batch_type === t && b.acupoint === 'sanyinjiao').reduce((n, b) => n + b.n, 0);
ok(bt('account') === 1 && bt('all') === 1, '整批记录表（copy_batch_stats）分别保存了 1 次单账号整组、1 次全部六组');

console.log('11. 数据库/网络失败时不虚假显示成功，之后重试不重复计数');
const iid = id('sanyinjiao', 'other-teacher', 'title');
await B.page.route('**/api/copy', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"server_error"}' }));
before = await snapshot();
await click(B.page, 'title:other-teacher');
ok((await B.page.locator('.toast').textContent()) === '文案已复制，统计暂未同步。', '提示“文案已复制，统计暂未同步。”');
ok((await B.page.evaluate(() => navigator.clipboard.readText())) === copyMap['title:other-teacher'], '文字仍然复制成功');
ok((await statText(B.page, iid)) === '0', '页面数字没有虚假增加');
ok(same(diff(before, await snapshot()), {}), '数据库没有计数');
await B.page.unroute('**/api/copy');
await B.page.route('**/api/copy', (r) => r.abort('internetdisconnected'));
await B.page.waitForTimeout(2100);
await click(B.page, 'title:other-teacher');
ok((await B.page.locator('.toast').textContent()) === '文案已复制，统计暂未同步。', '断网时同样提示，未计数');
await B.page.unroute('**/api/copy');
const pend = await B.page.evaluate(() => JSON.parse(localStorage.getItem('stl_pending_events') || '[]'));
ok(pend.length === 2, '两次未同步事件进入待同步队列');
await B.page.evaluate(() => window.__flushPendingCopyEvents());
await B.page.waitForTimeout(300);
let d = diff(before, await snapshot());
ok(same(d, { [iid]: 1 }), '恢复后补同步：两次事件在 10 秒去重规则下记为 1 次（同一浏览器同一内容短时间内）');
await B.page.evaluate(() => window.__flushPendingCopyEvents());
ok((await B.page.evaluate(() => JSON.parse(localStorage.getItem('stl_pending_events') || '[]'))).length === 0, '队列已清空');
const re = await (await fetch(`${BASE}/api/copy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pend[0]) })).json();
ok(re.status === 'duplicate' && same(diff(before, await snapshot()), { [iid]: 1 }), '同一事件编号再次提交 → duplicate，不重复计数');

// 服务器端：数据库写入中途失败 → 整体回滚、返回 500
{
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stl-')), 'x.sqlite');
  const sdb = openSqlite(f);
  await applySchema(sdb, fs.readFileSync(new URL('../api/schema.sql', import.meta.url), 'utf8'));
  await syncManifest(sdb, buildManifest());
  let n = 0; const orig = sdb._exec.bind(sdb);
  sdb._exec = (s) => { if (++n === 4) throw new Error('模拟数据库写入失败'); return orig(s); };
  const ce = console.error; console.error = () => {};
  const res = await handleApi(new Request('http://x/api/copy', { method: 'POST', body: JSON.stringify({ event_id: 'evt-fail-0001', item_id: 'houxi:douyin:account_bundle:a:v1', client: 'c' }) }), { db: sdb, env: {}, ip: '1' });
  console.error = ce;
  const rows = sdb.raw.prepare('SELECT COUNT(*) AS n FROM copy_stats').get().n + sdb.raw.prepare('SELECT COUNT(*) AS n FROM copy_events').get().n;
  ok(res.status === 500 && rows === 0, '服务器端写入中途失败：返回 500，且事务回滚、没有半截计数');
  sdb._exec = orig;
  const res2 = await handleApi(new Request('http://x/api/copy', { method: 'POST', body: JSON.stringify({ event_id: 'evt-fail-0001', item_id: 'houxi:douyin:account_bundle:a:v1', client: 'c' }) }), { db: sdb, env: {}, ip: '1' });
  const j2 = await res2.json();
  ok(j2.status === 'counted' && j2.stats['houxi:douyin:account_bundle:a:v1'].t === 1, '恢复后用同一事件编号重试 → 正常计 1 次');
}

console.log('12. 多个老师同时操作（两个服务进程共用同一数据库，并发 400 次）');
const hot = id('houxi', 'xiaohongshu', 'title');
const bund = id('houxi', 'wx-video', 'account_bundle');
const tasks = [];
for (let i = 0; i < 400; i++) {
  const base = i % 2 ? s1.url : s2.url;
  const item = i % 4 === 3 ? bund : hot;
  tasks.push(fetch(`${base}/api/copy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_id: `evt-conc-${i}-${Math.random().toString(36).slice(2, 8)}`, item_id: item, client: `client-${i}` }) }).then((r) => r.json()));
}
const results = await Promise.all(tasks);
const after12 = await snapshot();
ok(results.every((r) => r.ok && r.status === 'counted'), '400 个并发请求全部成功');
ok(after12[hot] === 300 && after12[bund] === 100 && after12[id('houxi', 'wx-video', 'title')] === 100, `累加无丢失：小红书标题=${after12[hot]}（应300），视频号整组=${after12[bund]}（应100），其成员标题=${after12[id('houxi', 'wx-video', 'title')]}（应100）`);

console.log('13. 手机端复制和统计');
for (const vp of [{ width: 360, height: 740 }, { width: 390, height: 844 }]) {
  const M = await teacher({ viewport: vp, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.40' });
  await open(M.page, 'houxi');
  const over = await M.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const outside = await M.page.evaluate(() => [...document.querySelectorAll('[data-copy-key], .wb-stat, [data-sort-select], [data-sort-reset]')].filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.right > window.innerWidth + 1 || r.left < -1); }).length);
  ok(over <= 1 && outside === 0, `${vp.width}px：无横向滚动，按钮/统计/排序控件都在屏幕内`);
  const small = await M.page.evaluate(() => [...document.querySelectorAll('[data-copy-key]')].filter((b) => b.getBoundingClientRect().height < 36).length);
  ok(small === 0, `${vp.width}px：复制按钮高度足够点按`);
  const it = id('houxi', 'douyin', 'description');
  const b0 = Number(await statText(M.page, it));
  await M.page.locator('[data-copy-key="description:douyin"]').tap();
  await M.page.waitForFunction(() => !document.querySelector('[data-busy]'));
  ok(Number(await statText(M.page, it)) === b0 + 1, `${vp.width}px：点按复制后数字 +1`);
  await M.page.screenshot({ path: `/tmp/stats-mobile-${vp.width}.png` });
  await M.ctx.close();
}

console.log('14. 其他：限流、未知内容、管理页保护、版本管理');
{
  const s3 = await startServer({ port: 4393, env: { RATE_LIMIT_PER_MIN: '5', STATS_SALT: 'x' }, staticDir: '' });
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await fetch(`${s3.url}/api/copy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_id: `evt-rl-${i}-abcdef`, item_id: hot, client: `rl${i}` }) })).status);
  ok(codes.slice(0, 5).every((c) => c === 200) && codes.slice(5).every((c) => c === 429), '超过每分钟上限返回 429：' + codes.join(','));
  const adm503 = await fetch(`${s3.url}/api/admin/stats`, { headers: { Authorization: 'Bearer anything' } });
  ok(adm503.status === 503, '未配置管理口令时管理接口不可用（503）');
  s3.stop();
}
const unk = await fetch(`${BASE}/api/copy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_id: 'evt-unknown-1', item_id: 'fake:item', client: 'x' }) });
ok(unk.status === 404, '不存在的内容编号被拒绝（404），无法随意写入');
ok((await fetch(`${BASE}/api/admin/stats`)).status === 401 && (await fetch(`${BASE}/api/admin/stats`, { headers: { Authorization: 'Bearer wrong' } })).status === 401, '管理接口无口令/错误口令返回 401');
const adminHtml = fs.readFileSync(new URL('../dist/admin/stats/index.html', import.meta.url), 'utf8');
ok(adminHtml.includes('noindex') && !adminHtml.includes(TOKEN) && !/STATS_ADMIN_TOKEN=|test-admin-token/.test(adminHtml), '管理页 noindex，且页面代码中没有口令');
const distJs = fs.readdirSync(new URL('../dist/_astro/', import.meta.url)).map((f) => fs.readFileSync(new URL('../dist/_astro/' + f, import.meta.url), 'utf8')).join('');
const realToken = fs.existsSync('.stats.env') ? (fs.readFileSync('.stats.env', 'utf8').match(/STATS_ADMIN_TOKEN=(.+)/) || [])[1] : '';
ok(!realToken || (!distJs.includes(realToken) && !adminHtml.includes(realToken)), '本地真实口令没有出现在任何前端文件中');
{
  const P = await teacher();
  await P.page.goto(`${BASE}/admin/stats/`);
  await P.page.fill('#token', 'wrong'); await P.page.click('#login button');
  await P.page.waitForFunction(() => document.querySelector('#login-msg').textContent.length > 0);
  ok((await P.page.textContent('#login-msg')).includes('口令不正确') && await P.page.locator('#dash').isHidden(), '管理页：错误口令无法查看');
  await P.page.fill('#token', TOKEN); await P.page.click('#login button');
  await P.page.waitForSelector('#dash:not([hidden])');
  const text = await P.page.textContent('#out');
  ok(['全部穴位累计复制情况', '六个账号的内容复制情况', '标题复制排行', '描述复制排行', '关键词复制排行', '最近7天热门内容', '最近7天较少使用的内容', '最近30天复制趋势'].every((s) => text.includes(s)), '管理页显示全部要求的板块');
  await P.page.selectOption('#f select[name=point]', 'houxi');
  await P.page.selectOption('#f select[name=type]', 'title');
  const t2 = await P.page.textContent('#out');
  ok(t2.includes('标题复制排行') && !t2.includes('描述复制排行') && t2.includes('后溪穴'), '管理页按穴位/类型筛选生效');
  ok(!/老师[A-Z]|client-/.test(t2), '管理页没有任何个人/浏览器标识');
  await P.page.screenshot({ path: '/tmp/stats-admin.png', fullPage: false });
  await P.ctx.close();
}
{
  // 版本管理：小修改沿用统计；版本号 +1 → 新编号从 0 开始，旧版本保留为历史
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stl-')), 'v.sqlite');
  const vdb = openSqlite(f);
  await applySchema(vdb, fs.readFileSync(new URL('../api/schema.sql', import.meta.url), 'utf8'));
  const m = buildManifest();
  await syncManifest(vdb, m);
  const tid = 'houxi:douyin:title:a:v1';
  await handleApi(new Request('http://x/api/copy', { method: 'POST', body: JSON.stringify({ event_id: 'evt-ver-0001', item_id: tid, client: 'c' }) }), { db: vdb, env: {}, ip: '1' });
  const m2 = structuredClone(m); m2.items.find((i) => i.id === tid).hash = 'changed1';
  await syncManifest(vdb, m2);
  let r = vdb.raw.prepare('SELECT i.content_hash != i.original_hash AS edited, s.total FROM copy_items i JOIN copy_stats s ON s.item_id = i.id WHERE i.id = ?').get(tid);
  ok(r.edited === 1 && r.total === 1, '小修改（版本号不变）：沿用原统计，并标记“有小修改”');
  const m3 = structuredClone(m); const it = m3.items.find((i) => i.id === tid); it.id = 'houxi:douyin:title:a:v2'; it.version = 2;
  await syncManifest(vdb, m3);
  const old = vdb.raw.prepare('SELECT active FROM copy_items WHERE id = ?').get(tid);
  const nw = vdb.raw.prepare('SELECT COALESCE((SELECT total FROM copy_stats WHERE item_id = ?), 0) AS t').get('houxi:douyin:title:a:v2');
  ok(old.active === 0 && nw.t === 0, '新内容版本（版本号 +1）：新编号从 0 计数，旧版本保留为历史');
}

await A.ctx.close(); await B.ctx.close(); await browser.close();
s1.stop(); s2.stop();
console.log(`\n复制统计验收：通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
