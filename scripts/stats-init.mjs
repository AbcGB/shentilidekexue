// 生成本地统计配置文件 .stats.env（含随机管理口令和随机盐）。文件已在 .gitignore 中，不会上传到 GitHub。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, '.stats.env');
if (fs.existsSync(file)) {
  console.log('.stats.env 已存在，未做修改。管理口令请打开该文件查看 STATS_ADMIN_TOKEN 一行。');
} else {
  const token = crypto.randomBytes(18).toString('base64url');
  const salt = crypto.randomBytes(24).toString('base64url');
  fs.writeFileSync(file, `# 复制统计本地配置（不要上传、不要发到群里）\nSTATS_ADMIN_TOKEN=${token}\nSTATS_SALT=${salt}\nRATE_LIMIT_PER_MIN=120\n`, { mode: 0o600 });
  console.log('✅ 已生成 .stats.env（管理口令在 STATS_ADMIN_TOKEN 一行）。请妥善保管，不要发到群里。');
}
