// Node.js 内置 SQLite（node:sqlite，Node 22.13+/24 可用）适配器。适合本地预览和自有服务器（大陆云/香港服务器）。
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function openSqlite(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  const prep = (sql) => raw.prepare(sql);
  const db = {
    raw,
    async all(sql, params = []) { return prep(sql).all(...params); },
    async first(sql, params = []) { return prep(sql).get(...params) ?? null; },
    async run(sql, params = []) { return prep(sql).run(...params); },
    async batch(stmts) {
      // 事务：BEGIN IMMEDIATE 先拿写锁，多个进程同时写也会排队，不会丢失累加
      raw.exec('BEGIN IMMEDIATE');
      try {
        for (const s of stmts) db._exec(s);
        raw.exec('COMMIT');
      } catch (e) {
        try { raw.exec('ROLLBACK'); } catch {}
        throw e;
      }
    },
    _exec(s) { prep(s.sql).run(...(s.params || [])); },
    close() { raw.close(); },
  };
  return db;
}
