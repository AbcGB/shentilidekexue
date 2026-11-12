// 复制统计后台：Node.js + SQLite 版本（本地预览、自有服务器通用）。
// 用法：
//   node api/node-server.mjs                       只启动统计接口（默认端口 8787），配合 npm run dev 使用
//   node api/node-server.mjs --static dist --port 4321   同时提供网站页面和统计接口（本地完整预览 / 自有服务器）
// 配置（环境变量，或写在项目根目录的 .stats.env 文件中，该文件不会上传到 GitHub）：
//   STATS_ADMIN_TOKEN  管理员统计页口令（必须自己设置，建议 20 位以上随机字符）
//   STATS_SALT         哈希用的随机字符串（用于限流和去重，不保存原始 IP）
//   STATS_DB           数据库文件路径（默认 data/stats.sqlite）
//   RATE_LIMIT_PER_MIN 每个 IP 每分钟最多记录次数（默认 120）
//   ALLOWED_ORIGINS    统计接口与网站不同域名时，允许的网站地址（逗号分隔）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSqlite } from './adapters/sqlite.mjs';
import { handleApi, applySchema, syncManifest } from './core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };

// 读取 .stats.env
const envFile = arg('stats-env', path.join(root, '.stats.env'));
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const env = process.env;
const port = Number(arg('port', env.PORT || 8787));
const host = arg('host', env.HOST || '0.0.0.0');
const staticDir = arg('static', env.STATIC_DIR || '') ? path.resolve(root, arg('static', env.STATIC_DIR)) : '';
const dbFile = path.resolve(root, arg('db', env.STATS_DB || 'data/stats.sqlite'));

const db = openSqlite(dbFile);
await applySchema(db, fs.readFileSync(path.join(root, 'api/schema.sql'), 'utf8'));
let manifestPath = path.join(root, 'api/generated/copy-manifest.json');
let manifest;
if (fs.existsSync(manifestPath)) manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
else { const { buildManifest } = await import('../scripts/build-copy-manifest.mjs'); manifest = buildManifest(); }
const synced = await syncManifest(db, manifest);

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };

function serveStatic(req, res, pathname) {
  let p = decodeURIComponent(pathname);
  let file = path.join(staticDir, p);
  if (!file.startsWith(staticDir)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' }).end(); return; }
    file = path.join(file, 'index.html');
  }
  const headers = {};
  if (p.startsWith('/teacher/') || p.startsWith('/admin/')) headers['X-Robots-Tag'] = 'noindex, nofollow';
  if (!fs.existsSync(file)) {
    const nf = path.join(staticDir, '404.html');
    res.writeHead(404, { 'Content-Type': TYPES['.html'], ...headers });
    res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', ...headers });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    const chunks = [];
    for await (const c of req) { chunks.push(c); if (chunks.reduce((n, b) => n + b.length, 0) > 16_384) { res.writeHead(413).end(); return; } }
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
    // 只在内存中使用 IP 做限流哈希，不写入日志、不落库
    const ip = (env.TRUST_PROXY === '1' && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
    const response = await handleApi(request, { db, env, ip, manifest });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  if (staticDir) return serveStatic(req, res, url.pathname);
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('统计接口服务：请访问 /api/health');
});
server.listen(port, host, () => {
  console.log(`✅ 复制统计服务已启动：http://localhost:${port}/  （数据库：${path.relative(root, dbFile)}，已登记内容 ${synced} 条）`);
  if (staticDir) console.log(`   网站页面：http://localhost:${port}/  老师工作台：http://localhost:${port}/teacher/  管理统计页：http://localhost:${port}/admin/stats/`);
  if (!env.STATS_ADMIN_TOKEN) console.log('⚠️  未设置管理口令 STATS_ADMIN_TOKEN，管理员统计页暂不可用（见 README“复制统计”章节）。');
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(); db.close(); process.exit(0); });
