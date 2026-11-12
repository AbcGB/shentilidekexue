// 生成“可统计内容清单”（copy-manifest.json + seed.sql），构建时自动运行。
// 统计后台只接受清单中存在的内容编号，防止被随意写入。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCopyItems, hasWorkbenchCopies, getSets } from '../src/lib/copy-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function buildManifest() {
  const settings = JSON.parse(fs.readFileSync(path.join(root, 'src/content/copy-settings.json'), 'utf8'));
  const dir = path.join(root, 'src/content/acupoints');
  const items = [];
  const sets = {};
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (p.publishStatus !== 'published' || !hasWorkbenchCopies(p)) continue;
    items.push(...buildCopyItems(p, settings));
    for (const s of getSets(p)) sets[`${p.slug}:${s.id}`] = s.label;
  }
  return { generatedAt: new Date().toISOString(), sets, items };
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
export function manifestToSql(m) {
  const lines = ['-- 自动生成：同步可统计内容清单（可重复执行）', 'UPDATE copy_items SET active = 0;'];
  for (const it of m.items) {
    lines.push(`INSERT INTO copy_items (id, acupoint, account_id, content_type, variant, version, content_hash, original_hash, preview, active, created_at, updated_at) VALUES (${q(it.id)}, ${q(it.acupoint)}, ${q(it.accountId)}, ${q(it.type)}, ${q(it.variant)}, ${it.version}, ${q(it.hash)}, ${q(it.hash)}, ${q(it.preview)}, 1, datetime('now'), datetime('now')) ON CONFLICT(id) DO UPDATE SET content_hash = excluded.content_hash, preview = excluded.preview, active = 1, updated_at = excluded.updated_at;`);
    for (const mem of it.members || []) lines.push(`INSERT INTO copy_bundle_members (bundle_id, member_id) VALUES (${q(it.id)}, ${q(mem)}) ON CONFLICT DO NOTHING;`);
  }
  return lines.join('\n') + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const m = buildManifest();
  fs.mkdirSync(path.join(root, 'api/generated'), { recursive: true });
  fs.writeFileSync(path.join(root, 'api/generated/copy-manifest.json'), JSON.stringify(m, null, 1));
  fs.writeFileSync(path.join(root, 'api/generated/seed.sql'), manifestToSql(m));
  console.log(`✅ 已生成可统计内容清单：${m.items.length} 条（api/generated/）`);
}
