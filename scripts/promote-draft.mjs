// 负责人确认后，把草稿转为正式文案（写入穴位文件的 copySets）。
//
// 确认流程（网站是静态预览，没有可写入的后台）：
//   1. 负责人在 /teacher/drafts/<slug>/ 看草稿；
//   2. 在对话里告诉我们：哪个穴位、确认哪几组、哪些字要改（改动先直接改 src/content/drafts/<slug>.json）；
//   3. 运行本脚本，把确认的组写进穴位文件的 copySets，并删除草稿文件；
//   4. 构建、提交，老师工作台就会出现这个穴位。
//
// 用法：
//   node scripts/promote-draft.mjs --slug waiguan --confirm "负责人 2026-11-20 在对话中确认"
//   node scripts/promote-draft.mjs --slug waiguan --groups 1,2,3,5 --confirm "..."   只转部分组（会重新编号 1、2、3……）
//   加 --dry-run 只预览，不写文件。
//
// 安全规则：穴位已有正式文案（copySets 不为空）时拒绝执行，绝不覆盖负责人原文。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCopies } from '../src/lib/copy-core.mjs';
import { forbiddenHits } from '../src/lib/draft-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const slug = opt('--slug');
const confirm = opt('--confirm');
const groups = opt('--groups');
const dry = args.includes('--dry-run');
const fail = (m) => { console.error('❌ ' + m); process.exit(1); };
if (!slug) fail('请用 --slug 指定穴位，例如 --slug waiguan');
if (!confirm) fail('请用 --confirm 写明负责人确认记录（谁、何时、在哪里确认）');

const aFile = path.join(root, 'src/content/acupoints', `${slug}.json`);
const dFile = path.join(root, 'src/content/drafts', `${slug}.json`);
if (!fs.existsSync(aFile)) fail(`找不到穴位文件 ${aFile}`);
const p = JSON.parse(fs.readFileSync(aFile, 'utf8'));
if (Array.isArray(p.copySets) && p.copySets.length > 0) fail(`${p.displayName} 已有正式文案（copySets），拒绝覆盖。`);
if (!fs.existsSync(dFile)) fail(`找不到草稿文件 ${dFile}`);
const d = JSON.parse(fs.readFileSync(dFile, 'utf8'));

const set = d.draftCopySets[0];
let vs = set.variants;
if (groups) { const pick = groups.split(',').map(Number); vs = pick.map((no) => vs.find((v) => v.no === no) || fail(`草稿里没有第 ${no} 组`)); }
const variants = vs.map((v, i) => {
  const hits = forbiddenHits(`${v.title}\n${v.description}`);
  if (hits.length) fail(`第 ${v.no} 组含有禁止的说法：${hits.join('；')}`);
  const o = { id: `g${i + 1}`, no: i + 1, title: v.title, description: v.description, keywords: v.keywords };
  if (v.angle) o.angle = v.angle;
  return o;
});
p.copySets = [{ id: 'video', label: set.label.replace(/（草稿）$/, ''), note: `草稿经负责人确认后转为正式文案：${confirm}`, variants }];
p.copyStatus = `负责人确认的草稿（${confirm}）`;
const problems = validateCopies(p);
if (problems.length) fail('转换后的文案未通过检查：\n' + problems.join('\n'));
if (dry) { console.log(JSON.stringify(p.copySets, null, 2)); console.log('（预览，未写入）'); process.exit(0); }
fs.writeFileSync(aFile, JSON.stringify(p, null, 2) + '\n');
fs.unlinkSync(dFile);
console.log(`✅ ${p.displayName}：${variants.length} 组已写入正式文案 copySets，草稿文件已删除。请运行 npm run build 检查后提交。`);
