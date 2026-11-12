// 生成站内链接，自动加上部署子目录（BASE_PATH）。
const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
export function u(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return base + path.replace(/^\//, '');
}
export function entryLink(e: any): string {
  if (e.link) return u(e.link);
  if (e.acupoints && e.acupoints.length === 1) return u(`/xuewei/${e.acupoints[0]}/`);
  return u(`/learning/archive/#${e.id}`);
}
