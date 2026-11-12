// 内容检查脚本：构建前自动运行（npm run build 时），也可以单独运行：npm run check:content
// 作用：检查穴位文件格式、每条视频的 N 组文案是否完整、组编号是否重复，发现问题用中文提示。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCopies } from '../src/lib/copy-core.mjs';
import { forbiddenHits } from '../src/lib/draft-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = (p) => path.join(root, 'src/content', p);
const errors = [];
const warnings = [];

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { errors.push(`文件格式错误（JSON 写法有误）：${path.relative(root, file)}\n    ${e.message}\n    常见原因：少了逗号、多了逗号、引号没有成对、使用了中文引号作为 JSON 引号。`); return null; }
}

const settings = readJson(C('copy-settings.json'));

const REQUIRED = ['id', 'slug', 'name', 'displayName', 'pinyin', 'aliases', 'meridian', 'standardLocation', 'traditionalApplications', 'videoText', 'publicArticle', 'videos', 'images', 'sources', 'reviewer', 'reviewStatus', 'publishStatus', 'publishDate', 'updateDate', 'seo', 'summary', 'copySets'];
const slugs = new Set();
let published = 0;
let workbench = 0;
const infos = [];
for (const f of fs.readdirSync(C('acupoints')).filter((f) => f.endsWith('.json'))) {
  const file = C(`acupoints/${f}`);
  const p = readJson(file);
  if (!p || !settings) continue;
  const label = `穴位文件 ${f}`;
  for (const k of REQUIRED) if (p[k] === undefined) errors.push(`${label} 缺少字段 "${k}"`);
  if (p.slug && `${p.slug}.json` !== f) errors.push(`${label} 的 slug（${p.slug}）应与文件名一致`);
  if (p.slug && !/^[a-z0-9-]+$/.test(p.slug)) errors.push(`${label} 的 slug 只能使用小写拼音字母、数字和短横线`);
  if (slugs.has(p.slug)) errors.push(`${label} 的 slug 与其他穴位重复`);
  slugs.add(p.slug);
  if (p.publicArticle && !fs.existsSync(C(`articles/${p.publicArticle}.md`))) warnings.push(`${label}：找不到公开文章 articles/${p.publicArticle}.md（页面“相关知识”将显示整理中）`);
  if (!['published', 'draft'].includes(p.publishStatus)) errors.push(`${label} 的 publishStatus 只能是 "published"（发布）或 "draft"（草稿）`);
  if (p.reviewStatus === '已审核' && (!p.reviewer || p.reviewer === '待审核' || !p.reviewDate)) errors.push(`${label} 标记为“已审核”，但没有填写真实的审核老师 reviewer 和审核日期 reviewDate`);
  const problems = validateCopies(p, settings);
  if (p.accountCopies) warnings.push(`${label} 仍有旧字段 accountCopies（按平台账号分的旧格式），已不再使用，请改写到 copySets`);
  if (p.publishStatus === 'published') {
    published++;
    if (problems.length) warnings.push(`${label} 的工作台文案有问题，本次不会出现在老师工作台（公开知识页不受影响）：\n    - ${problems.join('\n    - ')}`);
    else if (!p.copySets.length) infos.push(`${p.displayName || f}：公开知识页已发布，工作台正式文案待负责人提供（草稿见 /teacher/drafts/）`);
    else workbench++;
  } else {
    warnings.push(`${label} 是草稿（draft），不会出现在网站上${problems.length ? `；还缺：${problems.join('；')}` : ''}`);
  }
}

// 草稿检查：已有正式文案的穴位不能再有草稿；草稿不能含禁止的说法
const dDir = C('drafts');
if (fs.existsSync(dDir)) {
  for (const f of fs.readdirSync(dDir).filter((f) => f.endsWith('.json'))) {
    const d = readJson(path.join(dDir, f));
    if (!d) continue;
    const pf = C(`acupoints/${d.slug}.json`);
    if (!fs.existsSync(pf)) { errors.push(`草稿 ${f} 对应的穴位文件不存在`); continue; }
    const p = JSON.parse(fs.readFileSync(pf, 'utf8'));
    if ((p.copySets || []).length) errors.push(`草稿 ${f}：${p.displayName} 已有正式文案（copySets），不能再有待确认草稿，请删除该草稿文件`);
    for (const v of d.draftCopySets?.[0]?.variants || []) {
      const hits = forbiddenHits(`${v.title}\n${v.description}`);
      if (hits.length) errors.push(`草稿 ${f} 第 ${v.no} 组含有禁止的说法：${hits.join('；')}`);
    }
  }
}

for (const f of fs.readdirSync(C('learning')).filter((f) => f.endsWith('.json'))) {
  const e = readJson(C(`learning/${f}`));
  if (!e) continue;
  for (const k of ['id', 'date', 'title', 'type', 'content', 'reviewStatus', 'publishStatus']) if (!e[k]) errors.push(`学习内容 ${f} 缺少字段 "${k}"`);
  if (e.date && !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) errors.push(`学习内容 ${f} 的日期格式应为 2026-11-12 这样的格式`);
  if (e.time && !/^\d{2}:\d{2}$/.test(e.time)) errors.push(`学习内容 ${f} 的时间格式应为 12:30 这样的格式`);
  for (const s of e.acupoints || []) if (!slugs.has(s)) errors.push(`学习内容 ${f} 引用了不存在的穴位 "${s}"`);
}
readJson(C('equipment/device.json'));
readJson(path.join(root, 'src/config/site.json'));

for (const w of warnings) console.warn(`⚠️  提醒：${w}`);
if (errors.length) {
  for (const e of errors) console.error(`❌ 错误：${e}`);
  console.error(`\n内容检查未通过，共 ${errors.length} 个错误。请按上面的提示修改后再试。`);
  process.exit(1);
}
for (const i of infos) console.log(`ℹ️  ${i}`);
console.log(`✅ 内容检查通过：已发布穴位 ${published} 个，其中 ${workbench} 个已录入工作台文案。`);
