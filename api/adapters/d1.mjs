// Cloudflare D1 适配器。D1 的 batch() 本身就是事务。
export function d1Adapter(D1) {
  const bind = (sql, params) => D1.prepare(sql).bind(...(params || []));
  return {
    async all(sql, params) { return (await bind(sql, params).all()).results || []; },
    async first(sql, params) { return (await bind(sql, params).first()) ?? null; },
    async run(sql, params) { return bind(sql, params).run(); },
    async batch(stmts) { return D1.batch(stmts.map((s) => bind(s.sql, s.params))); },
  };
}
