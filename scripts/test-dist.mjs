// 验收测试脚本：先运行 npm run build，并启动 npm run preview，然后运行 npm test。
// 默认自动用临时数据库启动独立测试服务（端口 4399），也可用 TEST_URL 指定已运行的网站。
// 1) 静态检查 dist（SEO、noindex、站点地图、核心内容可抓取、文案数据对齐）
// 2) 浏览器检查（搜索、复制、手动复制备用方式、手机布局），需要本机安装 Chrome。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCopyMap, getSets, variantKey, keywordsText, hashtagsText } from '../src/lib/copy-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
import { startServer } from './test-server.mjs';
let server = null;
if (!process.env.TEST_URL) server = await startServer({ port: 4399, env: { RATE_LIMIT_PER_MIN: '100000' } });
const BASE = process.env.TEST_URL || server.url;
const settings = JSON.parse(fs.readFileSync(path.join(root, 'src/content/copy-settings.json'), 'utf8'));
const points = fs.readdirSync(path.join(root, 'src/content/acupoints')).map((f) => JSON.parse(fs.readFileSync(path.join(root, 'src/content/acupoints', f), 'utf8')));
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + msg); } };
const read = (p) => fs.readFileSync(path.join(dist, p), 'utf8');
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
const meta = (html, re) => { const m = html.match(re); return m ? decode(m[1]) : null; };

console.log('A. 页面是否全部生成');
const pages = ['admin/stats/index.html', 'index.html', 'xuexi/index.html', 'xuewei/index.html', 'learning/today/index.html', 'learning/archive/index.html', 'equipment/index.html', 'equipment/history/index.html', 'training/index.html', 'contact/device/index.html', 'contact/training/index.html', 'teacher/index.html', 'feedback/index.html', 'about/index.html', 'ziliao/index.html', 'search/index.html', '404.html', 'sitemap.xml', 'robots.txt'];
const slugs = ['zusanli', 'yanglingquan', 'sanyinjiao', 'waiguan', 'houxi', 'shenmen'];
const wbSlugs = ['zusanli', 'yanglingquan', 'sanyinjiao']; // 已录入负责人原文的穴位
for (const s of slugs) pages.push(`xuewei/${s}/index.html`);
for (const s of wbSlugs) pages.push(`teacher/${s}/index.html`);
for (const s of slugs.filter((x) => !wbSlugs.includes(x))) ok(!fs.existsSync(path.join(dist, `teacher/${s}/index.html`)), `${s} 没有负责人文案，不应生成工作台页面`);
for (const f of fs.readdirSync(path.join(root, 'src/content/lessons'))) { const m = fs.readFileSync(path.join(root, 'src/content/lessons', f), 'utf8').match(/slug: "([^"]+)"/); pages.push(`xuexi/${m[1]}/index.html`); }
for (const p of pages) ok(fs.existsSync(path.join(dist, p)), `缺少页面 ${p}`);

console.log('E. SEO 检查');
const titles = new Set(), canonicals = new Set();
for (const s of slugs) {
  const html = read(`xuewei/${s}/index.html`);
  const p = points.find((x) => x.slug === s);
  const title = meta(html, /<title>([^<]+)<\/title>/);
  ok(title && title.includes(p.name), `${s} 标题不含穴位名`);
  ok(!titles.has(title), `${s} 标题重复`); titles.add(title);
  ok(meta(html, /<meta name="description" content="([^"]+)"/) === p.seo.description, `${s} 描述不正确`);
  const can = meta(html, /<link rel="canonical" href="([^"]+)"/);
  ok(can && can.endsWith(`/xuewei/${s}/`), `${s} canonical 不正确: ${can}`);
  ok(!canonicals.has(can), `${s} canonical 重复`); canonicals.add(can);
  ok(/<meta property="og:title"/.test(html) && /<meta property="og:image" content="https?:/.test(html), `${s} 缺少 OG`);
  ok((html.match(/<h1[^>]*>/g) || []).length === 1 && html.includes(`<h1>${p.displayName}</h1>`), `${s} H1 不正确`);
  ok(/<h2/.test(html) && /<h3/.test(html), `${s} 缺少 H2/H3`);
  ok(decode(html).includes(p.standardLocation.standard), `${s} 标准位置不在 HTML 源代码中`);
  ok(html.includes('content="index, follow"'), `${s} 应允许收录`);
  ok(html.includes('待审核'), `${s} 未标注待审核`);
  ok(html.includes(`datetime="${p.updateDate}"`), `${s} 缺少更新时间`);
  ok(html.includes('GB/T 12346-2021'), `${s} 缺少参考资料`);
  for (const img of html.match(/<img [^>]*>/g) || []) ok(/alt="[^"]+"/.test(img), `${s} 图片缺少 alt: ${img}`);
  ok((html.match(/href="\/xuewei\/[a-z]+\/"/g) || []).length >= 3, `${s} 内部链接过少`);
}
for (const s of ['admin/stats/index.html', 'teacher/index.html', ...wbSlugs.map((s) => `teacher/${s}/index.html`)]) {
  ok(read(s).includes('<meta name="robots" content="noindex, nofollow">'), `${s} 未设置 noindex`);
}
const sitemap = read('sitemap.xml');
for (const s of slugs) ok(sitemap.includes(`/xuewei/${s}/</loc>`), `sitemap 缺少 ${s}`);
ok(!sitemap.includes('/teacher/'), 'sitemap 不应包含老师工作台');
ok(!sitemap.includes('/admin/'), 'sitemap 不应包含管理页');
const locs = sitemap.match(/<loc>[^<]+<\/loc>/g) || [];
ok(new Set(locs).size === locs.length, 'sitemap 有重复网址');
ok(/Sitemap: https?:\/\/.+\/sitemap\.xml/.test(read('robots.txt')), 'robots.txt 缺少 Sitemap');

console.log('C. 多组文案数据对齐（静态）');
for (const s of wbSlugs) {
  const p = points.find((x) => x.slug === s);
  const html = read(`teacher/${s}/index.html`);
  const m = html.match(/<script type="application\/json" id="copy-data">([\s\S]*?)<\/script>/);
  ok(m, `${s} 缺少复制数据`); if (!m) continue;
  const map = JSON.parse(m[1]);
  ok(JSON.stringify(map) === JSON.stringify(buildCopyMap(p, settings)), `${s} 页面复制数据与源文件不一致`);
  ok(!/视频号|抖音账号|小红书账号|微信公众号/.test(html.split('id="copy-data"')[0]), `${s} 工作台页面不应再出现平台账号名`);
  const sets = getSets(p);
  ok(sets.length >= 1 && sets[0].variants.length >= 1, `${s} 没有文案组`);
  for (const set of sets) {
    for (const v of set.variants) {
      const k = variantKey(set.id, v.id);
      ok(map[`title:${k}`] === v.title && map[`description:${k}`] === v.description && map[`keywords:${k}`] === keywordsText(v, settings), `${s}/${k} 文案错位`);
      const block = map[`group:${k}`];
      ok(block.startsWith(`【第 ${v.no} 组${v.angle ? `｜${v.angle}` : ''}】`) && block.includes(v.title) && block.includes(v.description) && block.includes(hashtagsText(v, settings)), `${s}/${k} 整组内容不完整`);
      for (const o of set.variants) if (o.id !== v.id && o.title !== v.title) ok(!block.includes(o.title), `${s}/${k} 整组内容混入了 ${o.id} 的标题`);
      ok(map[`set:${set.id}`].includes(block), `${s}/${k} 未包含在“复制全部 N 组”中`);
      const card = html.split(`data-variant="${v.id}"`)[1] || '';
      for (const g of ['title', 'description', 'keywords']) {
        const mm = card.match(new RegExp(`data-field="${g}"[^>]*>([\\s\\S]*?)</div>`));
        ok(mm && decode(mm[1]) === map[`${g}:${k}`], `${s}/${k} 页面显示的${g}与复制内容不一致`);
      }
    }
  }
  ok(html.includes('原文录入'), `${s} 未说明文案为负责人原文`);
  ok(p.longCopy?.showInWorkbench ? html.includes('长文案（可选）') : !html.includes('长文案（可选）'), `${s} 长文案显示错误`);
  ok(sets[0].variants.length === 6 && sets[0].variants.map((v) => v.no).join('') === '123456', `${s} 应为编号 1—6 的 6 组`);
}

console.log('B/C/D. 浏览器测试');
let chromium;
try { ({ chromium } = await import('playwright-core')); } catch { console.warn('  未安装 playwright-core，跳过浏览器测试'); }
const chromePath = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
if (chromium && chromePath) {
  const browser = await chromium.launch({ executablePath: chromePath, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  // 搜索
  const cases = [['足三里', '足三里穴'], ['阳陵泉', '阳陵泉穴'], ['三阴交', '三阴交穴'], ['外关穴', '外关穴'], ['后溪', '后溪穴'], ['神门', '神门穴'],
    ['三里', '足三里穴'], ['阳陵', '阳陵泉穴'], ['zusanli', '足三里穴'], ['zsl', '足三里穴'], ['yanglingquan', '阳陵泉穴'], ['syj', '三阴交穴'], ['waiguan', '外关穴'], ['houxi', '后溪穴'], ['shenmen', '神门穴'],
    ['足三里在哪里', '足三里穴'], ['ST36', '足三里穴'], ['筋会', '阳陵泉穴'], ['心经', '神门穴'], ['三阴', '三阴交穴']];
  await page.goto(BASE + '/');
  for (const [q, want] of cases) {
    await page.fill('#q-live', q);
    const first = await page.locator('[data-search] .search-results li .sr-title').first().textContent().catch(() => null);
    ok(first === want, `搜索「${q}」第一条应为 ${want}，实际为 ${first}`);
  }
  await page.fill('#q-live', '后溪');
  await page.locator('[data-search] .search-results li a').first().click();
  await page.waitForURL('**/xuewei/houxi/');
  ok(page.url().endsWith('/xuewei/houxi/'), '点击搜索结果未进入详情页');
  await page.goto(BASE + '/search/?q=神门');
  ok((await page.locator('.search-results li').count()) > 0, '搜索页 ?q= 无结果');
  // 复制
  for (const s of wbSlugs) {
    await page.goto(BASE + `/teacher/${s}/`);
    const map = JSON.parse(await page.locator('#copy-data').textContent());
    const buttons = await page.locator('[data-copy-key]').all();
    ok(buttons.length === Object.keys(map).filter((k) => !(k.startsWith('hashtags:') && !map[k])).length, `${s} 复制按钮数量不对：${buttons.length}`);
    for (const btn of buttons) {
      const key = await btn.getAttribute('data-copy-key');
      await btn.click();
      const clip = await page.evaluate(() => navigator.clipboard.readText());
      ok(clip === map[key], `${s} 按钮 ${key} 复制内容不一致`);
    }
    const toastText = await page.locator('.toast').textContent();
    ok(toastText.startsWith('复制成功！'), `${s} 未显示“复制成功！”：${toastText}`);
  }
  // 手动复制备用方式
  await page.goto(BASE + '/teacher/yanglingquan/');
  await page.evaluate(() => { window.__forceManualCopy = true; });
  await page.locator('[data-copy-key="group:video/g2"]').click();
  ok(await page.locator('.manual-dialog.open').isVisible(), '复制失败时没有弹出手动复制框');
  const manual = await page.locator('.manual-dialog textarea').inputValue();
  const mapH = JSON.parse(await page.locator('#copy-data').textContent());
  ok(manual === mapH['group:video/g2'], '手动复制框内容不完整');
  // 兼容方式（浏览器不支持剪贴板接口时，例如部分微信内置浏览器或非 HTTPS 页面）
  await page.goto(BASE + '/teacher/zusanli/');
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); });
  await page.locator('[data-copy-key="description:video/g3"]').click();
  const legacy = await page.evaluate(() => window.__lastCopied);
  const mapW = JSON.parse(await page.locator('#copy-data').textContent());
  ok(legacy && legacy.ok && legacy.text === mapW['description:video/g3'], '兼容复制方式失败');
  ok(!(await page.locator('.manual-dialog.open').isVisible()), '兼容复制成功时不应弹出手动框');
  // 历史筛选
  await page.goto(BASE + '/learning/archive/');
  await page.selectOption('select[name=point]', '后溪');
  ok((await page.locator('#count').textContent()).match(/共 [1-9]/), '历史更新按穴位筛选（后溪）无结果');
  await page.selectOption('select[name=point]', '');
  await page.selectOption('select[name=type]', '设备演示');
  ok((await page.locator('#entries .entry:not([hidden])').count()) >= 1, '按类型筛选无结果');
  await ctx.close();
  // 手机布局：无横向滚动
  for (const vp of [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    const mctx = await browser.newContext({ viewport: vp, isMobile: vp.width < 600, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 MicroMessenger/8.0.40' });
    const mp = await mctx.newPage();
    for (const p of ['/', '/xuewei/', '/xuewei/zusanli/', '/xuewei/sanyinjiao/', '/teacher/', '/teacher/zusanli/', '/learning/today/', '/learning/archive/', '/equipment/', '/equipment/history/', '/training/', '/contact/device/', '/contact/training/', '/feedback/', '/about/', '/ziliao/']) {
      await mp.goto(BASE + p);
      const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(over <= 1, `${vp.width}px 宽度下 ${p} 出现横向滚动（${over}px）`);
    }
    // 按钮大小
    await mp.goto(BASE + '/teacher/zusanli/');
    const small = await mp.evaluate(() => [...document.querySelectorAll('[data-copy-key]')].filter((b) => b.getBoundingClientRect().height < 36).length);
    ok(small === 0, `${vp.width}px 宽度下有 ${small} 个复制按钮过小`);
    // 菜单
    if (vp.width < 600) {
      await mp.goto(BASE + '/');
      await mp.click('.nav-toggle');
      ok(await mp.locator('#site-nav a[href="/teacher/"]').isVisible(), '手机菜单无法展开');
    }
    await mctx.close();
  }
  await browser.close();
} else if (chromium) console.warn('  未找到 Chrome，跳过浏览器测试');

server?.stop();
console.log(`\n结果：通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
