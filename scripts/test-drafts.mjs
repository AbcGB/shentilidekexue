// 草稿与正式文案隔离测试（需先 npm run build）。
// 1) 草稿不含禁止的说法；2) 三个负责人原文穴位的 copySets 与录入时逐字一致；
// 3) 草稿不出现在正式工作台、统计清单、站点地图、搜索；4) 组数可在 1—10 之间灵活生成。
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildDraft, forbiddenHits, MAX_GROUPS } from '../src/lib/draft-core.mjs';
import { hasWorkbenchCopies, validateCopies, buildCopyItems } from '../src/lib/copy-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } };
const J = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const OFFICIAL = ['sanyinjiao', 'zusanli', 'yanglingquan'];
const PENDING = ['waiguan', 'houxi', 'shenmen'];
// 负责人原文录入时的提交（逐字对照基准）
const VERBATIM_COMMIT = '7403d01';

console.log('A. 草稿内容');
const dDir = path.join(root, 'src/content/drafts');
const draftFiles = fs.readdirSync(dDir).filter((f) => f.endsWith('.json'));
ok(draftFiles.sort().join() === PENDING.map((s) => s + '.json').sort().join(), `草稿文件应只有外关、后溪、神门：${draftFiles}`);
for (const f of draftFiles) {
  const d = J(`src/content/drafts/${f}`);
  ok(!OFFICIAL.includes(d.slug), `${d.slug} 已有负责人原文，不能有草稿`);
  ok(d.status === '待负责人确认', `${f} 状态应为“待负责人确认”`);
  const vs = d.draftCopySets[0].variants;
  ok(vs.length === 6, `${f} 本轮应为 6 组`);
  ok(new Set(vs.map((v) => v.title)).size === vs.length && new Set(vs.map((v) => v.angle)).size === vs.length, `${f} 各组标题/角度不能重复`);
  const p = J(`src/content/acupoints/${d.slug}.json`);
  ok(Array.isArray(p.copySets) && p.copySets.length === 0, `${d.slug} 草稿不能写进 copySets`);
  const others = fs.readdirSync(path.join(root, 'src/content/acupoints')).map((x) => J(`src/content/acupoints/${x}`)).filter((x) => x.slug !== d.slug);
  for (const v of vs) {
    const all = `${v.title}\n${v.description}\n${v.keywords}`;
    ok(!forbiddenHits(`${v.title}\n${v.description}`).length, `${f} 第 ${v.no} 组含禁止说法`);
    ok(/^#\S+( #\S+)*$/.test(v.keywords), `${f} 第 ${v.no} 组关键词应为 # 话题串`);
    for (const o of others) ok(!all.includes(o.name), `${f} 第 ${v.no} 组出现了其他穴位“${o.name}”`);
  }
}

console.log('B. 组数灵活（1—10）');
const w = J('src/content/acupoints/waiguan.json');
for (const n of [6, 7, 8, 9, 10]) {
  const vs = buildDraft(w, { n }).draftCopySets[0].variants;
  ok(vs.length === n && vs.map((v) => v.no).join() === Array.from({ length: n }, (_, i) => i + 1).join(), `生成 ${n} 组失败`);
  ok(new Set(vs.map((v) => v.angle)).size === n, `${n} 组角度应互不相同`);
}
ok(forbiddenHits('按揉可以治疗头痛').length && forbiddenHits('穴位就是皮穿支').length && forbiddenHits('报名费用 980 元').length, '禁止说法检查本身失效');
// 正式工作台同样支持 7—10 组：用 10 组草稿模拟一份正式文案，检查格式与统计条目
const sim = { ...w, copySets: [{ id: 'video', label: 'x', variants: buildDraft(w, { n: 10 }).draftCopySets[0].variants }] };
ok(validateCopies(sim).length === 0, '10 组文案应通过正式文案格式检查：' + validateCopies(sim).join('；'));
ok(new Set(buildCopyItems(sim, J('src/content/copy-settings.json')).map((i) => i.variant)).size >= 10, '10 组文案的统计条目不完整');
ok(buildDraft(w, { n: 99 }).draftCopySets[0].variants.length === MAX_GROUPS, '最多 10 组');

console.log('C. 负责人原文逐字未改动');
let base = null;
try { execSync(`git cat-file -e ${VERBATIM_COMMIT}`, { cwd: root, stdio: 'ignore' }); base = VERBATIM_COMMIT; } catch { console.log('  （找不到基准提交，跳过逐字对照）'); }
for (const s of OFFICIAL) {
  const p = J(`src/content/acupoints/${s}.json`);
  ok(hasWorkbenchCopies(p) && p.copySets[0].variants.length === 6, `${s} 正式文案应为 6 组`);
  if (base) {
    const old = JSON.parse(execSync(`git show ${base}:./src/content/acupoints/${s}.json`, { cwd: root, encoding: 'utf8' }).toString());
    ok(JSON.stringify(old.copySets) === JSON.stringify(p.copySets), `${s} 的 copySets 与负责人原文录入时不一致`);
  }
}

console.log('D. 草稿不进入正式工作台 / 统计 / 收录');
const R = (f) => fs.readFileSync(path.join(dist, f), 'utf8');
for (const s of PENDING) {
  ok(!fs.existsSync(path.join(dist, `teacher/${s}/index.html`)), `${s} 不应有正式工作台页`);
  ok(fs.existsSync(path.join(dist, `teacher/drafts/${s}/index.html`)), `${s} 缺少草稿确认页`);
  const h = R(`teacher/drafts/${s}/index.html`);
  ok(h.includes('noindex') && h.includes('老师请勿复制使用') && !h.includes('data-copy-key'), `${s} 草稿页应 noindex、有提示、无复制按钮`);
  const d = J(`src/content/drafts/${s}.json`);
  const t1 = d.draftCopySets[0].variants[0].title;
  for (const f of ['teacher/index.html', ...OFFICIAL.map((o) => `teacher/${o}/index.html`), 'sitemap.xml', `xuewei/${s}/index.html`]) ok(!R(f).includes(t1), `草稿标题出现在 ${f}`);
}
ok(!R('sitemap.xml').includes('/teacher/'), '站点地图不应包含工作台');
const manifest = J('api/generated/copy-manifest.json');
ok(!manifest.items.some((i) => PENDING.includes(i.acupoint)), '统计清单不应包含草稿穴位');
for (const f of ['teacher/drafts/index.html', 'teacher/jindu/index.html', 'teacher/paishe/index.html']) ok(R(f).includes('noindex'), `${f} 应 noindex`);
const jd = R('teacher/jindu/index.html');
ok((jd.match(/正式文案已确认<\/span>/g) || []).length === 3 && (jd.match(/草稿待确认<\/span>/g) || []).length === 3, '拍摄清单状态统计不对');

console.log(fails ? `❌ 草稿测试失败 ${fails} 项` : '✅ 草稿测试全部通过');
process.exit(fails ? 1 : 0);
