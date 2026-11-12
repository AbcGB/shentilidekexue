// 网站逻辑一致性测试（需先 npm run build；子目录部署时用 BASE_PATH=/仓库名/ 构建后，以同样的 BASE_PATH 运行）。
// 1) 全站站内链接都能打开；2) 简短回答出现在该出现的公开页面、标“待审核”、结构化数据与可见文字一致；
// 3) 内部页面（工作台、草稿、拍摄清单、拍摄建议、审核进度）noindex 且不在站点地图；4) 用词统一、无禁止说法。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const BASE = (process.env.BASE_PATH || '/').replace(/\/$/, '');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('  ✗ ' + m); } };
const R = (f) => fs.readFileSync(path.join(dist, f), 'utf8');
const htmlFiles = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.html')) htmlFiles.push(path.relative(dist, p)); } })(dist);

console.log('A. 站内链接');
const decode = (s) => s.replace(/&amp;/g, '&');
for (const f of htmlFiles) {
  const html = R(f).replace(/<script[\s\S]*?<\/script>/g, '');
  const pageUrl = '/' + f.replace(/index\.html$/, '').replace(/\\/g, '/');
  for (const m of html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
    let href = decode(m[1]);
    if (/^(https?:|mailto:|tel:|#|javascript:|data:)/.test(href)) continue;
    href = href.split('#')[0].split('?')[0];
    if (!href) continue;
    let abs = href.startsWith('/') ? href : new URL(href, 'http://x' + BASE + pageUrl).pathname;
    if (BASE) { ok(abs.startsWith(BASE + '/'), `${f} 的链接 ${m[1]} 缺少子目录前缀 ${BASE}`); abs = abs.slice(BASE.length) || '/'; }
    if (abs.startsWith('/api/')) continue;
    const target = abs.endsWith('/') ? path.join(dist, abs, 'index.html') : path.join(dist, abs);
    ok(fs.existsSync(target), `${f} 的链接 ${m[1]} 打不开`);
  }
}

console.log('B. 简短回答（GEO）');
const qa = JSON.parse(fs.readFileSync(path.join(root, 'src/content/quick-answers.json'), 'utf8'));
const where = { 'index.html': ['definition', 'acupoints'], 'xuexi/index.html': ['definition', 'acupoints', 'pimen'], 'xuexi/shenme-shi-pichuanzhi/index.html': ['definition'], 'xuexi/yu-shuxue-de-guanxi/index.html': ['acupoints'], 'xuexi/duopule-dingwei/index.html': ['pimen'], 'equipment/index.html': ['pimen'] };
const text = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '');
for (const [f, ids] of Object.entries(where)) {
  const h = R(f);
  ok(h.includes('class="quick-answer"') && /quick-answer[\s\S]*?待审核/.test(h), `${f} 缺少简短回答或未标待审核`);
  for (const id of ids) { const a = qa.answers.find((x) => x.id === id); ok(text(h).includes(a.a), `${f} 未显示简短回答 ${id}`); }
}
for (const a of qa.answers) {
  ok(a.reviewStatus === '待审核' || a.reviewStatus === '已审核', `简短回答 ${a.id} 缺审核状态`);
  // 简短回答可以在否定句里提到这些词，但不能有肯定的疗效、价格、报名、精准等说法
  const bad = /治愈|疗效显著|有效治疗|调理|保健|\d+\s*元|报名|学费|已证实|已被证明|科学证明|精准定位(?!，)|绝对准确/;
  ok(!bad.test(a.a.replace(/不宣称它能百分之百精准定位/g, '')), `简短回答 ${a.id} 含禁止说法`);
}
ok(qa.answers.find((a) => a.id === 'definition').a.includes('cutaneous perforator') && qa.answers.find((a) => a.id === 'definition').a.includes('pí chuān zhī'), '定义里应包含英文和拼音');
// 结构化数据必须和可见文字一致
const xh = R('xuexi/index.html');
const ld = JSON.parse(xh.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const faq = ld['@graph'].find((g) => g['@type'] === 'FAQPage');
ok(faq && faq.mainEntity.length === qa.answers.length, '学习路径页缺少 FAQ 结构化数据');
for (const e of faq?.mainEntity || []) ok(text(xh).includes(e.name) && text(xh).includes(e.acceptedAnswer.text), `结构化数据“${e.name}”与页面可见文字不一致`);
// 课文里的关键更正
const l4 = text(R('xuexi/yu-shuxue-de-guanxi/index.html'));
ok(!/两具新鲜|标本只有两具/.test(l4) && l4.includes('两个新鲜成人上肢标本'), '第 4 课标本描述应为“两个新鲜成人上肢标本”');
const l6 = text(R('xuexi/cong-xuewei-yanshen/index.html'));
ok(l6.includes('本课要点') && l6.includes('怎么看定位演示短视频'), '第 6 课缺本课要点或短视频说明');
for (const f of htmlFiles.filter((f) => f.startsWith('xuexi/') && f !== 'xuexi/index.html')) ok(text(R(f)).includes('本课要点'), `${f} 缺本课要点`);

console.log('C. 内部页面不收录');
const sitemap = R('sitemap.xml');
for (const f of htmlFiles.filter((f) => f.startsWith('teacher/') || f.startsWith('admin/'))) {
  ok(/<meta name="robots" content="noindex/.test(R(f)), `${f} 应设置 noindex`);
}
ok(!/\/teacher\/|\/admin\//.test(sitemap), '站点地图不应包含工作台或管理页');
ok(fs.existsSync(path.join(dist, 'teacher/shenhe/index.html')), '缺少学习循环与审核进度页');
const ti = R('teacher/index.html');
for (const p of ['/teacher/jindu/', '/teacher/paishe/', '/teacher/drafts/', '/teacher/shenhe/', '/xuexi/']) ok(ti.includes(`href="${BASE}${p}"`), `工作台首页缺少入口 ${p}`);
ok(R('about/index.html').includes('网站怎么持续学习和更新'), '关于我们缺少更新循环说明');

console.log('D. 用词统一');
for (const f of htmlFiles) {
  const t = text(R(f));
  for (const bad of ['皮环子', '皮川之', '皮穿机']) ok(!t.includes(bad), `${f} 出现错误写法“${bad}”`);
  ok(!/(?<!不说：|不能说|不是|不宣称|不把)穴位就是皮穿支/.test(t.replace(/[“"「]穴位就是皮穿支[”"」]/g, '')), `${f} 出现肯定语气的“穴位就是皮穿支”`);
}
ok(!htmlFiles.filter((f) => !f.startsWith('teacher/') && !f.startsWith('admin/')).some((f) => /\d+\s*元|报名方式[:：]|学费/.test(text(R(f)).replace(/培训的时间、地点、费用和报名方式以负责人正式发布为准|培训时间、地点、费用和报名方式以负责人正式发布为准|设备价格、培训费用、报名方式/g, ''))), '公开页面不应出现价格或报名信息');
const nav = R('index.html').match(/<nav class="nav"[\s\S]*?<\/nav>/)[0];
ok(nav.includes('皮门多普勒') && !nav.includes('>设备演示<'), '主导航应统一称“皮门多普勒”');

const eq = R('equipment/index.html');
ok(eq.includes('/zhuanli/cn113975152b/'), '设备页应链接到站内专利公开页');
ok(!/href="https:\/\/patents\.google\.com/.test(eq), '设备页不应再跳转到 Google Patents');
ok(fs.existsSync(path.join(dist, 'zhuanli/cn113975152b/index.html')), '缺少专利公开信息页');
const pat = R('zhuanli/cn113975152b/index.html');
ok(pat.includes('CN113975152B') && pat.includes('https://patents.google.com/patent/CN113975152B/zh'), '专利页应收录公开信息和原文地址');
ok(pat.includes('并非皮门多普勒设备本身的专利'), '专利页应说明这不是皮门设备专利');
ok(/\/zhuanli\/cn113975152b\//.test(sitemap), '站点地图应包含专利公开页');


console.log(`\n网站逻辑测试：通过 ${passes} 项，失败 ${fails} 项`);
process.exit(fails ? 1 : 0);
