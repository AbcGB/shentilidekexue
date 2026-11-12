// 复制统计后台：Cloudflare Workers + D1 版本（可选部署方式之一）。
// 部署方法见 README“复制统计 → 正式部署”。管理口令用 `wrangler secret put STATS_ADMIN_TOKEN` 设置，不要写进代码。
import { handleApi } from './core.mjs';
import { d1Adapter } from './adapters/d1.mjs';
import manifest from './generated/copy-manifest.json';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      return handleApi(request, { db: d1Adapter(env.DB), env, ip, manifest });
    }
    // Pages 上传 _worker.js 时，非 /api 路径交回静态资源，避免整站被接口脚本拦截。
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};
