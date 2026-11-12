// 生成“待负责人确认”的文案草稿（本地规则拼装，不调用在线 AI）。
//
// 用法：
//   node scripts/draft-copy.mjs                 为所有“已发布、但还没有正式文案（copySets 为空）”的穴位生成草稿（默认 6 组）
//   node scripts/draft-copy.mjs --slug waiguan  只生成外关
//   node scripts/draft-copy.mjs --slug waiguan --n 8   生成 8 组（最多 10 组）
//   node scripts/draft-copy.mjs --force         覆盖已有的草稿文件（默认不覆盖，避免冲掉负责人改过的草稿）
//
// 规则：
// - 已有正式文案（copySets 不为空）的穴位一律跳过，绝不生成草稿、绝不改动穴位文件。
// - 草稿写到 src/content/drafts/<slug>.json，网站上只显示在 /teacher/drafts/ 待确认页（不收录），不进入老师工作台。
// - 负责人确认后，用 scripts/promote-draft.mjs 转为正式文案。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDraft } from '../src/lib/draft-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const only = opt('--slug');
const n = Number(opt('--n') || 6);
const force = args.includes('--force');
const aDir = path.join(root, 'src/content/acupoints');
const dDir = path.join(root, 'src/content/drafts');
fs.mkdirSync(dDir, { recursive: true });

let made = 0;
for (const f of fs.readdirSync(aDir).filter((f) => f.endsWith('.json')).sort()) {
  const p = JSON.parse(fs.readFileSync(path.join(aDir, f), 'utf8'));
  if (only && p.slug !== only) continue;
  if (Array.isArray(p.copySets) && p.copySets.length > 0) { if (only) console.log(`跳过 ${p.displayName}：已有正式文案（copySets），不生成草稿。`); continue; }
  if (!only && p.publishStatus !== 'published') continue;
  const out = path.join(dDir, `${p.slug}.json`);
  if (fs.existsSync(out) && !force) { console.log(`跳过 ${p.displayName}：草稿已存在（要重新生成请加 --force）。`); continue; }
  const draft = buildDraft(p, { n });
  fs.writeFileSync(out, JSON.stringify(draft, null, 2) + '\n');
  console.log(`✅ 已生成 ${p.displayName} 的 ${draft.draftCopySets[0].variants.length} 组草稿：src/content/drafts/${p.slug}.json`);
  made++;
}
if (only && !made) process.exitCode = 0;
console.log(`共生成 ${made} 个穴位的草稿。草稿只在 /teacher/drafts/ 待确认页显示。`);
