// 自动生成站点地图。老师工作台、搜索页不会出现在这里。
import { getAcupoints, getLearning, getLessons, equipment, equipmentHistory, training, siteUrl } from '../lib/data';

export function GET() {
  const base = siteUrl() + (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const latest = getLearning()[0]?.date;
  const pages: { loc: string; lastmod?: string }[] = [
    { loc: '/', lastmod: latest },
    { loc: '/xuexi/', lastmod: getLessons().map((l) => l.updateDate).sort().pop() },
    ...getLessons().map((l) => ({ loc: `/xuexi/${l.slug}/`, lastmod: l.updateDate })),
    { loc: '/xuewei/', lastmod: latest },
    ...getAcupoints().map((p: any) => ({ loc: `/xuewei/${p.slug}/`, lastmod: p.updateDate })),
    { loc: '/learning/today/', lastmod: latest },
    { loc: '/learning/archive/', lastmod: latest },
    { loc: '/equipment/', lastmod: (equipment as any).updateDate },
    { loc: '/equipment/history/', lastmod: (equipmentHistory as any).updateDate },
    { loc: '/training/', lastmod: (training as any).updateDate },
    { loc: '/contact/device/' },
    { loc: '/contact/training/' },
    { loc: '/zhuanli/cn113975152b/', lastmod: '2026-11-13' },
    { loc: '/ziliao/', lastmod: latest },
    { loc: '/about/' },
    { loc: '/feedback/' },
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((p) => `  <url><loc>${base}${p.loc}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
