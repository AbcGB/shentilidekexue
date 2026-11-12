// 网站逻辑一致性测试（需先 npm run build；子目录部署时用 BASE_PATH=/仓库名/ 构建后，以同样的 BASE_PATH 运行）。
// 1) 全站站内链接都能打开；2) 简短回答出现在该出现的公开页面、不带内部审核徽章、结构化数据与可见文字一致；
// 3) 内部页面（工作台、草稿、拍摄清单、拍摄建议、审核进度）noindex 且不在站点地图；4) 用词统一、无禁止说法。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { visibleAccounts, canShowAccount, validatePlatforms } from '../src/lib/platform-core.mjs';

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
  ok(h.includes('class="quick-answer"'), `${f} 缺少简短回答`);
  ok(!/<section class="quick-answer"[\s\S]*?<\/section>/.exec(h)?.[0].includes('待审核'), `${f} 简短回答不应再显示“待审核”徽章`);
  for (const id of ids) { const a = qa.answers.find((x) => x.id === id); ok(text(h).includes(a.a), `${f} 未显示简短回答 ${id}`); }
}
for (const a of qa.answers) {
  ok(a.reviewStatus === '待审核' || a.reviewStatus === '已审核', `简短回答 ${a.id} 缺审核状态`);
  // 简短回答可以在否定句里提到这些词，但不能有肯定的疗效、价格、报名、精准等说法
  const bad = /治愈|疗效显著|有效治疗|调理|保健|\d+\s*元|报名|学费|已证实|已被证明|科学证明|精准定位(?!，)|绝对准确/;
  ok(!bad.test(a.a), `简短回答 ${a.id} 含禁止说法`);
  ok(!/不宣称|百分之百|精准到毫米|毫米级/.test(a.a), `简短回答 ${a.id} 不应出现“不宣称/百分之百/毫米”这类可被引用的说法`);
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


console.log('E. 第一阶段商业化页面');
for (const f of ['equipment/history/index.html', 'training/index.html', 'contact/device/index.html', 'contact/training/index.html']) {
  ok(fs.existsSync(path.join(dist, f)), `缺少页面 ${f}`);
  if (!fs.existsSync(path.join(dist, f))) continue;
  ok(/<meta name="robots" content="index, follow"/.test(R(f)), `${f} 应允许收录`);
  ok(sitemap.includes('/' + f.replace('index.html', '') + '<'), `站点地图缺少 ${f}`);
}
const home = R('index.html');
for (const p of ['/equipment/', '/training/', '/contact/device/', '/contact/training/']) ok(home.includes(`href="${BASE}${p}"`), `首页缺少入口 ${p}`);
for (const p of ['/training/', '/contact/']) ok(nav.includes(`href="${BASE}${p}`), `主导航缺少 ${p}`);
const eqText = text(eq);
ok(!/不宣称/.test(eqText), '设备页不应再出现“不宣称……”说明列表');
ok(eqText.includes('定位操作快速、精细'), '设备页应介绍“定位操作快速、精细”');
ok(eqText.includes('素材待提供'), '设备页没有真实照片/视频/测试数据时应清楚显示“素材待提供”');
ok(!/8\s*MHz|2\s*厘米/.test(eqText), '设备页不应把 8 MHz / 约 2 厘米写成当前设备性能');
ok(eqText.includes('当前设备以丁老师团队提供的最新资料为准') && eqText.includes('不代表当前设备的性能'), '设备页应说明早期研究不代表当前设备性能');
for (const k of ['当前版本', '实际操作过程', '真实操作演示', '当前版本技术资料', '设备迭代与技术发展', '相关研究与背景']) ok(eqText.includes(k), `设备页缺少栏目「${k}」`);
ok(eqText.includes('并非皮门多普勒设备本身的专利'), '设备页专利说明应保留“并非皮门多普勒设备本身的专利”');
ok(eq.includes(`href="${BASE}/equipment/history/"`) && eq.includes(`href="${BASE}/training/"`) && eq.includes(`href="${BASE}/contact/device/"`), '设备页应链接到设备迭代、培训和设备咨询');
const publicFiles = htmlFiles.filter((f) => !f.startsWith('teacher/') && !f.startsWith('admin/'));
for (const f of publicFiles) {
  const t = text(R(f));
  ok(!/待审核|待填写|审核日志|审核老师|内容审核信息|尚未经专业老师|待核对/.test(t), `${f} 公开页面不应展示内部审核/待填写状态`);
  ok(!/仅供学习参考|不构成诊断或治疗/.test(t), `${f} 不应出现机械重复的“仅供学习参考，不构成诊断或治疗”`);
  ok((t.match(/不构成诊疗建议/g) || []).length <= 1, `${f} 诊疗说明只应在页脚出现一次`);
  ok(t.includes('如有内容建议、合作咨询或其他问题，请联系陈老师'), `${f} 页脚缺少“联系陈老师”说明`);
  ok(R(f).includes(`href="${BASE}/platforms/"`), `${f} 页脚缺少官方平台入口`);
}
for (const f of publicFiles.filter((f) => f.startsWith('xuewei/') && f !== 'xuewei/index.html')) ok(!R(f).includes(`href="${BASE}/contact/device/"`), `${f} 穴位页不应放设备销售按钮`);
const hist = text(R('equipment/history/index.html'));
ok(hist.includes('资料待提供') && !/\d{4}\s*年/.test(hist), '设备迭代页缺资料的各代应合并说明“资料待提供”，不能出现未提供的年份');
const tr = R('training/index.html'), trText = text(tr);
ok(trText.includes('具体安排请咨询'), '培训页未定的安排应写“具体安排请咨询”');
ok(/data-course="small"[\s\S]*?牛老师[\s\S]*?基础教学/.test(tr) && /data-course="big"[\s\S]*?丁志伟老师[\s\S]*?核心技术讲解/.test(tr), '培训页应区分牛老师小课（基础教学）和丁志伟老师大课（核心技术讲解）');
ok(text(R('index.html')).includes('牛老师') && text(R('index.html')).includes('了解培训 / 课程咨询'), '首页应突出培训咨询与小课/大课');

console.log('F. 官方平台矩阵与联系方式');
const plat = JSON.parse(fs.readFileSync(path.join(root, 'src/content/platforms.json'), 'utf8'));
ok(validatePlatforms(plat).length === 0, '官方平台配置有问题：' + validatePlatforms(plat).join('；'));
ok(fs.existsSync(path.join(dist, 'platforms/index.html')) && sitemap.includes('/platforms/<'), '缺少官方平台页或未进入站点地图');
const vis = visibleAccounts(plat);
for (const f of ['index.html', 'about/index.html', 'contact/index.html', 'platforms/index.html']) {
  const h = R(f);
  ok(h.includes('class="platform-matrix"'), `${f} 缺少官方平台 / 关注我们`);
  ok(h.includes(`data-platform-count="${vis.length}"`), `${f} 展示的账号数应为 ${vis.length}`);
}
for (const a of plat.accounts) {
  const shown = R('platforms/index.html').includes(`data-account="${a.id}"`);
  ok(shown === canShowAccount(a), `账号 ${a.id} 的显示状态不对（visible=${a.visible}）`);
}
for (const f of publicFiles) for (const m of R(f).matchAll(/<a\b[^>]*href="([^"]*)"/g)) ok(m[1].trim() !== '', `${f} 有空链接`);
for (const f of ['contact/index.html', 'feedback/index.html']) {
  const h = R(f);
  ok(!/<form\b|<input\b|<textarea\b(?![^>]*readonly)/.test(h.replace(/<div class="manual-dialog"[\s\S]*?<\/div>\s*<\/div>/, '')), `${f} 不应有收集信息的表单`);
  ok(text(h).includes('如有内容建议、合作咨询或其他问题，请联系陈老师'), `${f} 应优先展示“联系陈老师”`);
}
const siteCfg = JSON.parse(fs.readFileSync(path.join(root, 'src/config/site.json'), 'utf8'));
const contactPage = text(R('contact/index.html'));
if (siteCfg.contact.wechatId) {
  ok(contactPage.includes('微信搜索') && contactPage.includes(siteCfg.contact.wechatId), '联系页应展示微信搜索号');
} else {
  ok(!/微信号[:：]|微信搜索/.test(contactPage), '没有真实微信号时不应显示微信号或微信搜索');
}
if (siteCfg.contact.phoneChina) ok(contactPage.includes(siteCfg.contact.phoneChina) && contactPage.includes('中国电话'), '联系页应展示中国电话');
if (siteCfg.contact.phoneHongKong) ok(contactPage.includes(siteCfg.contact.phoneHongKong) && contactPage.includes('香港电话'), '联系页应展示香港电话');
if (siteCfg.contact.whatsapp) ok(contactPage.includes('WhatsApp 搜索') && contactPage.includes(siteCfg.contact.whatsapp), '联系页应展示 WhatsApp 搜索号');
ok(!/images\/contact\//.test(R('contact/index.html')) || !!(siteCfg.contact.wechatQr || siteCfg.contact.groupQr), '未提供二维码时不应出现联系二维码图片');
ok(!/登录保护(?!，)/.test(text(R('teacher/index.html')).replace(/没有登录保护/g, '')), '工作台不应宣称具有登录保护');
for (const f of ['contact/device/index.html', 'contact/training/index.html']) {
  const h = R(f);
  const tpage = text(h);
  ok(h.includes('id="consult-form"') && h.includes('name="name"') && h.includes('name="contact"') && h.includes('name="region"') && h.includes('name="intent"'), `${f} 应有在线咨询表单（称呼、联系方式、省市、意向）`);
  ok(tpage.includes('请不要填写患者姓名、病历、检查单') && tpage.includes('不会在网站上公开'), `${f} 表单旁应有用途说明，并禁止填写患者资料`);
  ok(!/患者姓名|病历号|检查单号|诊断/.test(h.match(/id="consult-form"[\s\S]*?<\/form>/)?.[0] || ''), `${f} 表单字段不应收集患者资料`);
  ok(tpage.includes('以陈老师的正式答复为准'), `${f} 不应把未定的时间或费用写死`);
  ok(tpage.includes('如有内容建议、合作咨询或其他问题，请联系陈老师') && tpage.includes('@陈老师'), `${f} 仍应保留联系陈老师和工作群 @陈老师`);
}
const adminConsult = R('admin/consults/index.html');
ok(/<meta name="robots" content="noindex/.test(adminConsult) && !/STATS_ADMIN_TOKEN/.test(adminConsult), '咨询管理页应 noindex，且页面本身不含管理口令');
ok(R('robots.txt').includes('Disallow: /admin/'), 'robots.txt 应继续屏蔽 /admin/');
for (const f of htmlFiles.filter((f) => !f.startsWith('teacher/') && !f.startsWith('admin/'))) {
  const t = text(R(f));
  ok(!/精准到毫米|毫米级|百分之百精准|治愈/.test(t), `${f} 出现不应使用的说法（精准到毫米/毫米级/百分之百精准/治愈）`);
}


console.log(`\n网站逻辑测试：通过 ${passes} 项，失败 ${fails} 项`);
process.exit(fails ? 1 : 0);
