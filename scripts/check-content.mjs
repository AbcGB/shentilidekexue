// 内容检查脚本：构建前自动运行（npm run build 时），也可以单独运行：npm run check:content
// 作用：检查穴位文件格式、六组文案是否完整、账号编号是否对应，发现问题用中文提示。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCopies } from '../src/lib/copy-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = (p) => path.join(root, 'src/content', p);
const errors = [];
const warnings = [];

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { errors.push(`文件格式错误（JSON 写法有误）：${path.relative(root, file)}\n    ${e.message}\n    常见原因：少了逗号、多了逗号、引号没有成对、使用了中文引号作为 JSON 引号。`); return null; }
}

const settings = readJson(C('accounts/account-settings.json'));
if (settings) {
  const ids = settings.accounts.map((a) => a.id);
  if (new Set(ids).size !== ids.length) errors.push('account-settings.json 中有重复的账号编号 id');
  for (const a of settings.accounts) if (!a.id || !a.name) errors.push(`account-settings.json 中有账号缺少 id 或 name`);
  if (settings.accounts.length !== 6) warnings.push(`当前设置了 ${settings.accounts.length} 个账号（需求为 6 个）`);
}

const REQUIRED = ['id', 'slug', 'name', 'displayName', 'pinyin', 'aliases', 'meridian', 'standardLocation', 'traditionalApplications', 'videoText', 'publicArticle', 'videos', 'images', 'sources', 'reviewer', 'reviewStatus', 'publishStatus', 'publishDate', 'updateDate', 'seo', 'summary', 'accountCopies'];
const slugs = new Set();
let published = 0;
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
  if (p.publishStatus === 'published') {
    if (problems.length) warnings.push(`${label} 标记为发布，但六组文案不完整，本次不会出现在网站上：\n    - ${problems.join('\n    - ')}`);
    else published++;
  } else {
    warnings.push(`${label} 是草稿（draft），不会出现在网站上${problems.length ? `；还缺：${problems.join('；')}` : ''}`);
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
console.log(`✅ 内容检查通过：已发布穴位 ${published} 个，六组文案完整。`);
