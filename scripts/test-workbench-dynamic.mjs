// 老师工作台“文案数量完全动态”测试（npm test 的一部分）。
// 1) 逻辑：3 组、24 组、30 组、缺字段的组都能通过格式检查，复制内容和统计条目按实际字段生成；
// 2) 页面：临时生成 3 组 / 24 组 / 缺字段三份模拟文案，单独构建到 dist-fixtures（不影响正式 dist），
//    用浏览器检查每个复制按钮复制到的文字与页面显示一致，空字段不显示，文字可以选中。
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateCopies, buildCopyMap, buildCopyItems, getSets, variantKey, hasWorkbenchCopies } from '../src/lib/copy-core.mjs';
import { startServer } from './test-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const settings = J('src/content/copy-settings.json');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };

const base = J('src/content/acupoints/waiguan.json');
const mk = (slug, name, variants) => ({ ...base, id: slug, slug, name, displayName: `${name}穴`, code: 'TST', aliases: [`${name}穴`], pinyin: 'ce shi', publicArticle: '', relatedSlugs: [], copySets: [{ id: 'video', label: `${name}测试视频`, variants }] });
const full = (n) => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, no: i + 1, title: `测试标题第${i + 1}条`, description: `测试视频描述第${i + 1}条`, keywords: `#测试${i + 1} #关键词`, hashtags: i % 2 ? [`#话题${i + 1}`] : undefined }));
const partial = [
  { id: 'only-title', no: 1, title: '只有标题的一组' },
  { id: 'no-desc', no: 2, title: '没有视频描述的一组', keywords: '#只有关键词' },
  { id: 'only-tags', no: 3, hashtags: ['#只有话题'] },
  { id: 'with-extra', no: 4, description: '只有描述和其他文案', extras: [{ id: 'cover', label: '封面文字', text: '封面：测试' }, { id: 'pin', label: '置顶评论', text: '欢迎关注官方网站 pimen.cc' }] },
];
const fixtures = [mk('ceshisan', '测三', full(3)), mk('ceshiershisi', '测二十四', full(24)), mk('ceshique', '测缺', partial)];

console.log('A. 动态组数与可选字段（逻辑）');
for (const n of [1, 3, 8, 20, 24, 30, 50]) {
  const p = mk('x', '甲', full(n));
  ok(validateCopies(p).length === 0, `${n} 组应通过格式检查：${validateCopies(p).join('；')}`);
  const map = buildCopyMap(p, settings);
  ok(Object.keys(map).filter((k) => k.startsWith('title:')).length === n, `${n} 组应生成 ${n} 个标题复制项`);
  ok(map['set:video'].includes(`共 ${n} 组`), `${n} 组的“复制全部”应写明共 ${n} 组`);
  ok(new Set(buildCopyItems(p, settings).filter((i) => i.type === 'title').map((i) => i.variant)).size === n, `${n} 组的统计条目不完整`);
}
const pp = mk('y', '乙', partial);
ok(validateCopies(pp).length === 0, '缺字段的组应通过格式检查：' + validateCopies(pp).join('；'));
const pm = buildCopyMap(pp, settings);
ok(!('description:video/only-title' in pm) && !('keywords:video/only-title' in pm), '空字段不应生成复制项');
ok(pm['hashtags:video/only-tags'] === '#只有话题' && !('title:video/only-tags' in pm), '只有话题标签的组只生成话题标签复制项');
ok(pm['extra-cover:video/with-extra'] === '封面：测试' && pm['extra-pin:video/with-extra'].includes('pimen.cc'), '其他可选文案应可单独复制');
ok(pm['group:video/with-extra'].includes('封面文字：') && !pm['group:video/only-title'].includes('描述：'), '整组内容只包含有内容的字段');
ok(Object.values(pm).every((t) => typeof t === 'string' && t.length > 0), '复制内容不应有空字符串');
ok(buildCopyItems(pp, settings).every((i) => i.preview !== '' || i.type.endsWith('bundle')), '统计条目不应包含空字段');
ok(validateCopies(mk('z', '丙', [{ id: 'empty', no: 1 }])).length > 0, '一项内容都没有的组应提示');
// 正式三穴位的复制内容与统计编号不因本次改动变化（空话题标签不再生成空复制项）
for (const s of ['zusanli', 'yanglingquan', 'sanyinjiao']) {
  const p = J(`src/content/acupoints/${s}.json`);
  const ids = buildCopyItems(p, settings).map((i) => i.id);
  ok(ids.length === new Set(ids).size && ids.filter((i) => /:title:v1$/.test(i)).length === getSets(p)[0].variants.length, `${s} 统计编号异常`);
}

console.log('B. 页面渲染与复制（模拟 3 组 / 24 组 / 缺字段）');
const fxDir = path.join(root, 'test-fixtures-tmp/acupoints');
const outDir = path.join(root, 'dist-fixtures');
fs.rmSync(path.join(root, 'test-fixtures-tmp'), { recursive: true, force: true });
fs.mkdirSync(fxDir, { recursive: true });
for (const f of fixtures) fs.writeFileSync(path.join(fxDir, `${f.slug}.json`), JSON.stringify(f));
let server = null;
try {
  execSync(`npx astro build --outDir ${JSON.stringify(outDir)} --silent`, { cwd: root, stdio: 'pipe', env: { ...process.env, STL_TEST_FIXTURES: '1' } });
  for (const f of fixtures) ok(hasWorkbenchCopies(f) && fs.existsSync(path.join(outDir, `teacher/${f.slug}/index.html`)), `${f.slug} 工作台页面未生成`);
  ok(!fs.existsSync(path.join(root, 'dist/teacher/ceshisan/index.html')), '模拟文案不能进入正式 dist');
  let chromium;
  try { ({ chromium } = await import('playwright-core')); } catch { console.warn('  未安装 playwright-core，跳过浏览器部分'); }
  const chromePath = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
  if (chromium && chromePath) {
    server = await startServer({ port: 4398, staticDir: 'dist-fixtures', env: { RATE_LIMIT_PER_MIN: '100000' } });
    const browser = await chromium.launch({ executablePath: chromePath, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 MicroMessenger/8.0.40' });
    const page = await ctx.newPage();
    for (const f of fixtures) {
      await page.goto(`${server.url}/teacher/${f.slug}/`);
      const map = JSON.parse(await page.locator('#copy-data').textContent());
      ok(JSON.stringify(map) === JSON.stringify(buildCopyMap(f, settings)), `${f.slug} 页面复制数据与源数据不一致`);
      const n = f.copySets[0].variants.length;
      ok((await page.locator('.wb-card').count()) === n, `${f.slug} 应显示 ${n} 组，实际 ${await page.locator('.wb-card').count()}`);
      ok((await page.locator('h1').textContent()).includes(`${n} 组`), `${f.slug} 标题应显示 ${n} 组`);
      const btns = await page.locator('[data-copy-key]').all();
      ok(btns.length === Object.keys(map).length, `${f.slug} 复制按钮数 ${btns.length} 与复制项 ${Object.keys(map).length} 不一致`);
      // 每个字段按钮都复制到对应文字；整组、全部只抽查
      for (const b of btns) {
        const key = await b.getAttribute('data-copy-key');
        if (f.slug === 'ceshiershisi' && /^(title|keywords):/.test(key) && !/\/t(1|12|24)$/.test(key)) continue;
        await b.scrollIntoViewIfNeeded();
        await b.click();
        ok((await page.evaluate(() => navigator.clipboard.readText())) === map[key], `${f.slug} ${key} 复制内容不一致`);
      }
      for (const v of f.copySets[0].variants) {
        const card = page.locator(`[data-variant="${v.id}"]`);
        for (const g of ['title', 'description', 'keywords', 'hashtags']) {
          const has = !!map[`${g}:${variantKey('video', v.id)}`];
          ok((await card.locator(`[data-field="${g}"]`).count()) === (has ? 1 : 0), `${f.slug}/${v.id} 字段 ${g} 显示状态不对`);
        }
      }
      const sel = await page.locator('.wb-text').first().evaluate((el) => getComputedStyle(el).userSelect || getComputedStyle(el).webkitUserSelect);
      ok(sel !== 'none', `${f.slug} 文案文字应可选中`);
    }
    // 缺字段页：其他可选文案显示标签
    await page.goto(`${server.url}/teacher/ceshique/`);
    ok((await page.locator('[data-variant="with-extra"] .wb-acc').allTextContents()).join('|') === '视频描述|封面文字|置顶评论', '缺字段组的字段标签不对');
    // 统计服务不可用：复制照常成功，状态如实显示，不显示假的计数
    const p2 = await ctx.newPage();
    await p2.route('**/api/**', (r) => r.abort());
    await p2.goto(`${server.url}/teacher/ceshisan/`);
    await p2.locator('[data-copy-key="title:video/t2"]').click();
    ok((await p2.evaluate(() => navigator.clipboard.readText())) === '测试标题第2条', '统计不可用时复制失败');
    const status = await p2.locator('#stats-status').textContent();
    ok(!/累计\s*\d/.test(status) && /暂|不可用|无法|失败|未/.test(status), `统计不可用时应如实提示：${status}`);
    ok((await p2.locator('[data-stat-for] [data-t]').first().textContent()).trim() === '–', '统计不可用时不应显示计数');
    await browser.close();
  } else console.warn('  未找到 Chrome，跳过浏览器部分');
} finally {
  server?.stop();
  fs.rmSync(path.join(root, 'test-fixtures-tmp'), { recursive: true, force: true });
  fs.rmSync(outDir, { recursive: true, force: true });
}

console.log(`\n工作台动态组数测试：通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
