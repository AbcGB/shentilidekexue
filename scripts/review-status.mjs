// 查看网站“学习循环”现在卡在哪一步：npm run status
// 只读，不修改任何文件。和老师工作台的 /teacher/shenhe/ 页面显示同样的内容。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReviewQueue } from '../src/lib/review-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = (...p) => path.join(root, 'src/content', ...p);
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const lessons = fs.readdirSync(C('lessons')).filter((f) => f.endsWith('.md')).map((f) => {
  const fm = fs.readFileSync(C('lessons', f), 'utf8').match(/^---\n([\s\S]*?)\n---/)[1];
  const get = (k) => (fm.match(new RegExp(`^${k}:\\s*"?([^"\\n]*)"?`, 'm')) || [])[1];
  return { order: Number(get('order')), slug: get('slug'), title: get('title'), reviewStatus: get('reviewStatus') };
}).sort((a, b) => a.order - b.order);
const acupoints = fs.readdirSync(C('acupoints')).filter((f) => f.endsWith('.json')).map((f) => J(C('acupoints', f)));
const drafts = fs.existsSync(C('drafts')) ? fs.readdirSync(C('drafts')).filter((f) => f.endsWith('.json')).map((f) => J(C('drafts', f))) : [];
for (const d of drafts) d.acupoint = acupoints.find((p) => p.slug === d.slug);
const q = buildReviewQueue({ lessons, acupoints, drafts, device: J(C('equipment/device.json')), answers: J(C('quick-answers.json')).answers, filming: J(C('filming/acupoint-list.json')) });

console.log('网站学习循环：资料进来 → 起草/整理 → 待审核/待确认 → 负责人确认后上线\n');
console.log(`① 等待资料（${q.materials.length}）`);
for (const m of q.materials) console.log(`   - ${m.what}　→ ${m.where}（${m.who}）`);
console.log(`\n② 文案草稿，待负责人确认（${q.drafts.length}）`);
for (const d of q.drafts) console.log(`   - ${d.name}：${d.groups} 组，生成于 ${d.generatedAt}　→ /teacher/drafts/${d.slug}/`);
console.log(`\n③ 已公开但待专业审核（${q.review.length}）`);
for (const r of q.review) console.log(`   - [${r.kind}] ${r.name}　→ ${r.href}`);
console.log(`\n④ 已确认：正式文案 ${q.confirmed.officialCopy.length} 个穴位（${q.confirmed.officialCopy.map((x) => `${x.name} ${x.groups} 组`).join('、')}）；专业审核通过 ${q.confirmed.reviewed.length} 项。`);
