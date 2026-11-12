// 测试辅助：用临时数据库启动一个独立的网站+统计服务，不影响本地预览的数据。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function startServer({ port, db, env = {}, staticDir = 'dist' } = {}) {
  db = db || path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stl-')), 'stats.sqlite');
  const args = ['api/node-server.mjs', '--port', String(port), '--db', db, '--stats-env', '/nonexistent'];
  if (staticDir) args.push('--static', staticDir);
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, STATS_ADMIN_TOKEN: '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => (log += d)); child.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try { const r = await fetch(`http://localhost:${port}/api/health`); if (r.ok) return { url: `http://localhost:${port}`, db, child, stop: () => child.kill(), log: () => log }; } catch {}
  }
  child.kill();
  throw new Error('测试服务启动失败：\n' + log);
}
