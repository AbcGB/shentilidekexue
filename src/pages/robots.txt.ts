// 自动生成 robots.txt。老师工作台页面已在页面内设置 noindex（不收录），
// 这里不屏蔽抓取，以便搜索引擎能读到 noindex 指令。
import { siteUrl } from '../lib/data';
export function GET() {
  const base = siteUrl() + (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const body = `User-agent: *\nAllow: /\nDisallow: /search/\nDisallow: /admin/\n\nSitemap: ${base}/sitemap.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
