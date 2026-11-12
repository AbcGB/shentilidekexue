// 复制统计后台的核心逻辑（与平台无关）。
// 使用标准 Request/Response，可运行在：本地/自有服务器 Node.js + SQLite（api/node-server.mjs），
// 或 Cloudflare Workers + D1（api/worker.mjs）。数据库通过 adapter 统一接口访问：
//   db.all(sql, params) / db.first(sql, params) / db.run(sql, params) / db.batch([{sql, params}])（batch 必须是事务）

const DEDUPE_MS = 10_000;          // 同一浏览器同一内容 10 秒内重复复制只计一次
const EVENT_KEEP_DAYS = 35;
const enc = new TextEncoder();

export function dayKey(ms = Date.now()) {
  return new Date(ms + 8 * 3600_000).toISOString().slice(0, 10); // 北京时间日期
}
async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...headers } });
}
function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0 && a.length > 0;
}

export async function applySchema(db, schemaSql) {
  const stmts = schemaSql.split(/;\s*(?:\n|$)/).map((s) => s.replace(/--.*$/gm, '').trim()).filter(Boolean);
  for (const s of stmts) await db.run(s, []);
}

/** 把内容清单同步到数据库：新条目登记，已有条目更新文字指纹，不在清单中的标记为历史版本（统计保留） */
export async function syncManifest(db, manifest) {
  const now = new Date().toISOString();
  const stmts = [{ sql: 'UPDATE copy_items SET active = 0', params: [] }];
  for (const it of manifest.items) {
    stmts.push({
      sql: `INSERT INTO copy_items (id, acupoint, account_id, content_type, variant, version, content_hash, original_hash, preview, active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET content_hash = excluded.content_hash, preview = excluded.preview, active = 1, updated_at = excluded.updated_at`,
      params: [it.id, it.acupoint, it.accountId, it.type, it.variant, it.version, it.hash, it.hash, it.preview, now, now],
    });
    for (const m of it.members || []) stmts.push({ sql: 'INSERT INTO copy_bundle_members (bundle_id, member_id) VALUES (?, ?) ON CONFLICT DO NOTHING', params: [it.id, m] });
  }
  await db.batch(stmts);
  return manifest.items.length;
}

async function statsFor(db, ids) {
  if (!ids.length) return {};
  const today = dayKey();
  const d7 = dayKey(Date.now() - 6 * 86400_000);
  const d30 = dayKey(Date.now() - 29 * 86400_000);
  const out = {};
  // 分批查询，避免参数过多
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50);
    const ph = part.map(() => '?').join(',');
    const rows = await db.all(
      `SELECT i.id AS id, COALESCE(s.total, 0) AS t, s.last_copied_at AS last,
        COALESCE((SELECT SUM(count) FROM copy_daily_stats d WHERE d.item_id = i.id AND d.day >= ? AND d.day <= ?), 0) AS d7,
        COALESCE((SELECT SUM(count) FROM copy_daily_stats d WHERE d.item_id = i.id AND d.day >= ? AND d.day <= ?), 0) AS d30
       FROM copy_items i LEFT JOIN copy_stats s ON s.item_id = i.id WHERE i.id IN (${ph})`,
      [d7, today, d30, today, ...part]);
    for (const r of rows) out[r.id] = { t: Number(r.t), d7: Number(r.d7), d30: Number(r.d30), last: r.last || null };
  }
  return out;
}

async function rateLimit(db, env, ip, scope, limit) {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const bucket = await sha256(`${env.STATS_SALT || 'stl-default-salt'}|${scope}|${ip}|${minute}`);
  await db.run('INSERT INTO rate_limits (bucket, count, at_ms) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET count = count + 1', [bucket, now]);
  const row = await db.first('SELECT count FROM rate_limits WHERE bucket = ?', [bucket]);
  return Number(row?.count || 0) <= limit;
}

async function housekeeping(db) {
  const now = Date.now();
  const cutoff = new Date(now - EVENT_KEEP_DAYS * 86400_000).toISOString();
  await db.batch([
    { sql: 'DELETE FROM copy_events WHERE created_at < ?', params: [cutoff] },
    { sql: 'DELETE FROM copy_recent WHERE at_ms < ?', params: [now - 86400_000] },
    { sql: 'DELETE FROM rate_limits WHERE at_ms < ?', params: [now - 3600_000] },
  ]);
}

/** 记录一次复制：所有累加在同一个事务内完成，且以 event_id 保证幂等 */
async function recordCopy(db, env, body) {
  const eventId = String(body.event_id || '');
  const itemId = String(body.item_id || '');
  const client = String(body.client || '').slice(0, 64);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(eventId) || !itemId || itemId.length > 200) return json({ ok: false, error: 'bad_request' }, 400);

  const item = await db.first('SELECT id, acupoint, account_id, content_type, active FROM copy_items WHERE id = ?', [itemId]);
  if (!item || !item.active) return json({ ok: false, error: 'unknown_item' }, 404);

  const existing = await db.first('SELECT applied FROM copy_events WHERE event_id = ?', [eventId]);
  let targets = [itemId];
  if (item.content_type === 'group_bundle' || item.content_type === 'account_bundle') { // 整组（account_bundle 为旧名称，兼容）
    const mem = await db.all('SELECT m.member_id AS id FROM copy_bundle_members m JOIN copy_items i ON i.id = m.member_id WHERE m.bundle_id = ? AND i.active = 1', [itemId]);
    targets = [itemId, ...mem.map((r) => r.id)];
  }
  if (existing) {
    return json({ ok: true, status: 'duplicate', stats: await statsFor(db, targets) });
  }

  const now = Date.now();
  const iso = new Date(now).toISOString();
  const day = dayKey(now);
  const dedupeKey = await sha256(`${env.STATS_SALT || 'stl-default-salt'}|${client || eventId}|${itemId}`);
  const pending = 'EXISTS (SELECT 1 FROM copy_events WHERE event_id = ? AND applied = 0)';
  const stmts = [
    // 1. 登记事件（若同一浏览器 10 秒内已复制过同一内容，则不登记 → 后续累加都不会执行）
    { sql: `INSERT INTO copy_events (event_id, item_id, applied, created_at)
            SELECT ?, ?, 0, ? WHERE NOT EXISTS (SELECT 1 FROM copy_recent WHERE dedupe_key = ? AND at_ms > ?)
            ON CONFLICT(event_id) DO NOTHING`, params: [eventId, itemId, iso, dedupeKey, now - DEDUPE_MS] },
  ];
  for (const t of targets) {
    stmts.push({ sql: `INSERT INTO copy_stats (item_id, total, last_copied_at) SELECT ?, 1, ? WHERE ${pending}
                       ON CONFLICT(item_id) DO UPDATE SET total = total + 1, last_copied_at = excluded.last_copied_at`, params: [t, iso, eventId] });
    stmts.push({ sql: `INSERT INTO copy_daily_stats (item_id, day, count) SELECT ?, ?, 1 WHERE ${pending}
                       ON CONFLICT(item_id, day) DO UPDATE SET count = count + 1`, params: [t, day, eventId] });
  }
  if (['group_bundle', 'set_bundle', 'account_bundle', 'all_bundle'].includes(item.content_type)) {
    stmts.push({ sql: `INSERT INTO copy_batch_stats (event_id, batch_type, item_id, acupoint, account_id, created_at)
                       SELECT ?, ?, ?, ?, ?, ? WHERE ${pending} ON CONFLICT(event_id) DO NOTHING`,
      params: [eventId, (item.content_type === 'set_bundle' || item.content_type === 'all_bundle') ? 'all' : 'group', itemId, item.acupoint, item.account_id, iso, eventId] });
  }
  stmts.push({ sql: `INSERT INTO copy_recent (dedupe_key, at_ms) SELECT ?, ? WHERE ${pending}
                     ON CONFLICT(dedupe_key) DO UPDATE SET at_ms = excluded.at_ms`, params: [dedupeKey, now, eventId] });
  stmts.push({ sql: 'UPDATE copy_events SET applied = 1 WHERE event_id = ?', params: [eventId] });
  await db.batch(stmts); // 事务：任何一步失败都会整体回滚，不会出现只加了一半的情况

  const row = await db.first('SELECT applied FROM copy_events WHERE event_id = ?', [eventId]);
  const status = row ? 'counted' : 'deduped';
  if (Math.random() < 0.02) housekeeping(db).catch(() => {});
  return json({ ok: true, status, stats: await statsFor(db, targets) });
}

async function adminStats(db) {
  const items = await db.all('SELECT id, acupoint, account_id, content_type, variant, version, content_hash, original_hash, preview, active FROM copy_items', []);
  const stats = await statsFor(db, items.map((i) => i.id));
  const since = dayKey(Date.now() - 29 * 86400_000);
  const daily = await db.all(
    `SELECT d.day AS day, i.content_type AS type, SUM(d.count) AS n FROM copy_daily_stats d JOIN copy_items i ON i.id = d.item_id
     WHERE d.day >= ? GROUP BY d.day, i.content_type ORDER BY d.day`, [since]);
  const batches = await db.all('SELECT batch_type, acupoint, account_id, COUNT(*) AS n, MAX(created_at) AS last FROM copy_batch_stats GROUP BY batch_type, acupoint, account_id', []);
  return json({ ok: true, today: dayKey(), items: items.map((i) => ({ ...i, edited: i.content_hash !== i.original_hash, ...stats[i.id] })), daily, batches });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) {
    return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Vary': 'Origin' };
  }
  return {};
}

/**
 * 处理 /api/* 请求。ctx: { db, env, ip, manifest? }
 * env: STATS_ADMIN_TOKEN（管理口令，必须在服务器端配置）、STATS_SALT、RATE_LIMIT_PER_MIN、ALLOWED_ORIGINS
 */
export async function handleApi(request, ctx) {
  const { db, env, ip = 'unknown' } = ctx;
  const url = new URL(request.url);
  const cors = corsHeaders(request, env);
  const withCors = (res) => { for (const [k, v] of Object.entries(cors)) res.headers.set(k, v); return res; };
  if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }));
  try {
    const limit = Number(env.RATE_LIMIT_PER_MIN || 120);
    if (url.pathname === '/api/health') return withCors(json({ ok: true, time: new Date().toISOString() }));

    if (url.pathname === '/api/stats' && request.method === 'GET') {
      if (!(await rateLimit(db, env, ip, 'read', limit * 3))) return withCors(json({ ok: false, error: 'rate_limited' }, 429));
      const acupoint = url.searchParams.get('acupoint') || '';
      if (!/^[a-z0-9-]{1,40}$/.test(acupoint)) return withCors(json({ ok: false, error: 'bad_request' }, 400));
      const ids = (await db.all('SELECT id FROM copy_items WHERE acupoint = ? AND active = 1', [acupoint])).map((r) => r.id);
      return withCors(json({ ok: true, today: dayKey(), stats: await statsFor(db, ids) }));
    }

    if (url.pathname === '/api/copy' && request.method === 'POST') {
      if (!(await rateLimit(db, env, ip, 'copy', limit))) return withCors(json({ ok: false, error: 'rate_limited' }, 429));
      let body;
      try { body = await request.json(); } catch { return withCors(json({ ok: false, error: 'bad_request' }, 400)); }
      return withCors(await recordCopy(db, env, body));
    }

    if (url.pathname.startsWith('/api/admin/')) {
      if (!(await rateLimit(db, env, ip, 'admin', 20))) return withCors(json({ ok: false, error: 'rate_limited' }, 429));
      if (!env.STATS_ADMIN_TOKEN) return withCors(json({ ok: false, error: 'admin_not_configured' }, 503));
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (!safeEqual(token, env.STATS_ADMIN_TOKEN)) return withCors(json({ ok: false, error: 'unauthorized' }, 401));
      if (url.pathname === '/api/admin/stats' && request.method === 'GET') return withCors(await adminStats(db));
      if (url.pathname === '/api/admin/sync' && request.method === 'POST' && ctx.manifest) {
        const n = await syncManifest(db, ctx.manifest);
        return withCors(json({ ok: true, synced: n }));
      }
    }
    return withCors(json({ ok: false, error: 'not_found' }, 404));
  } catch (e) {
    console.error('[stats api error]', e);
    return withCors(json({ ok: false, error: 'server_error' }, 500));
  }
}
