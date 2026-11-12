// 培训/设备咨询表单接口验收：写入、校验、蜜罐、不公开查询、管理口令保护。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openSqlite } from '../api/adapters/sqlite.mjs';
import { handleApi, applySchema } from '../api/core.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.error('  ✗ ' + m); } };

const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stl-consult-')), 'c.sqlite');
const db = openSqlite(f);
await applySchema(db, fs.readFileSync(new URL('../api/schema.sql', import.meta.url), 'utf8'));
const TOKEN = 'consult-admin-token-test';
const env = { STATS_ADMIN_TOKEN: TOKEN, STATS_SALT: 'consult-test-salt', RATE_LIMIT_PER_MIN: '1000' };
const ctx = { db, env, ip: '203.0.113.10' };

async function call(req) {
  return handleApi(req, ctx);
}
async function post(body) {
  return call(new Request('http://x/api/consult', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
}

const validTraining = {
  kind: 'training', name: '测试医生', contact: '13800001234', region: '海南省三亚市',
  background: '执业医师', intent: 'small', message: '想了解小课怎么报名',
};

console.log('咨询表单接口');
const r1 = await post(validTraining);
const b1 = await r1.json();
ok(r1.status === 200 && b1.ok === true, '培训咨询提交成功');
const row = db.raw.prepare('SELECT * FROM consult_leads').get();
ok(row && row.kind === 'training' && row.name === '测试医生' && row.intent === 'small' && row.contact === '13800001234', '数据库写入称呼、联系方式和意向');
ok(row.ip_hash && !String(row.ip_hash).includes('203.0.113'), '只保存 IP 哈希，不保存原始 IP');

const missing = await post({ kind: 'training', name: '', contact: '123', region: '', intent: 'small' });
ok(missing.status === 400 && (await missing.json()).error === 'bad_request', '缺少必填项返回 bad_request');

const badIntent = await post({ ...validTraining, intent: 'miracle' });
ok(badIntent.status === 400, '非法意向被拒绝');

const before = db.raw.prepare('SELECT COUNT(*) AS n FROM consult_leads').get().n;
const honey = await post({ ...validTraining, name: '蜜罐', company: 'http://spam.example', contact: '13800009999' });
const hb = await honey.json();
const afterHoney = db.raw.prepare('SELECT COUNT(*) AS n FROM consult_leads').get().n;
ok(honey.status === 200 && hb.ok === true && afterHoney === before, '蜜罐字段填写时假装成功且不入库');

const device = await post({
  kind: 'device', name: '机构负责人', contact: 'wxid_test_001', region: '山东省潍坊市',
  background: '诊所', intent: 'demo', message: '希望安排演示',
});
ok(device.status === 200 && (await device.json()).ok === true, '设备咨询提交成功');
ok(db.raw.prepare("SELECT COUNT(*) AS n FROM consult_leads WHERE kind='device'").get().n === 1, '设备咨询单独按类型保存');

const pub = await call(new Request('http://x/api/consults'));
ok(pub.status === 404, '没有公开查询他人提交的接口');
const pubGet = await call(new Request('http://x/api/consult'));
ok(pubGet.status === 404, '咨询接口不提供公开 GET');

const noTok = await call(new Request('http://x/api/admin/consults'));
ok(noTok.status === 401 && (await noTok.json()).error === 'unauthorized', '无口令不能看留言');
const badTok = await call(new Request('http://x/api/admin/consults', { headers: { Authorization: 'Bearer wrong-token-value' } }));
ok(badTok.status === 401, '错误口令不能看留言');

const admin = await call(new Request('http://x/api/admin/consults', { headers: { Authorization: `Bearer ${TOKEN}` } }));
const ab = await admin.json();
ok(admin.status === 200 && ab.ok && ab.items.length === 2, '正确口令可以看到全部留言');
ok(ab.items.every((i) => i.name && i.contact && !('ip_hash' in i)), '管理列表含联系方式但不含 IP 哈希');
const onlyDevice = await call(new Request('http://x/api/admin/consults?kind=device', { headers: { Authorization: `Bearer ${TOKEN}` } }));
const dbod = await onlyDevice.json();
ok(dbod.items.length === 1 && dbod.items[0].kind === 'device', '可以按培训/设备筛选');

const listedPublic = JSON.stringify(ab);
ok(!listedPublic.includes('203.0.113'), '管理接口响应中没有原始 IP');

console.log(`\n咨询表单验收：通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
