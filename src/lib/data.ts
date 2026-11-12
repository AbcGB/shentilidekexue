// 读取 content 目录下的所有内容。新增文件后无需修改这里的代码。
import site from '../config/site.json';
import accountSettings from '../content/accounts/account-settings.json';
import equipment from '../content/equipment/device.json';
import { validateCopies } from './copy-core.mjs';

export type AccountCopy = { accountId: string; title: string; description: string; keywords: string[]; hashtags: string[] };
export type Acupoint = any;
export type LearningEntry = {
  id: string; date: string; time?: string; title: string; type: string; acupoints?: string[]; teachers?: string[];
  content: string; videoLinks?: { title: string; url: string }[]; images?: { src: string; alt: string }[];
  reviewStatus: string; publishStatus: string; keywords?: string[]; link?: string;
};

export { site, accountSettings, equipment };

const acupointModules = import.meta.glob('../content/acupoints/*.json', { eager: true, import: 'default' });
const learningModules = import.meta.glob('../content/learning/*.json', { eager: true, import: 'default' });
const articleModules = import.meta.glob('../content/articles/*.md', { eager: true });

const allAcupointsRaw: Acupoint[] = Object.values(acupointModules) as Acupoint[];

/** 已发布并且六组文案完整的穴位。草稿或不完整的穴位不会出现在网站上。 */
export function getAcupoints(): Acupoint[] {
  return allAcupointsRaw
    .filter((a) => a.publishStatus === 'published' && validateCopies(a, accountSettings).length === 0)
    .sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || '') || 0);
}

/** 按固定顺序（文件中的 order，若没有则按发布日期）排列，用于列表页 */
export function getAcupointsOrdered(): Acupoint[] {
  const order = ['zusanli', 'yanglingquan', 'sanyinjiao', 'waiguan', 'houxi', 'shenmen'];
  return getAcupoints().sort((a, b) => {
    const ia = order.indexOf(a.slug), ib = order.indexOf(b.slug);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return (b.publishDate || '').localeCompare(a.publishDate || '');
  });
}

export function getAcupoint(slug: string) { return getAcupoints().find((a) => a.slug === slug); }

export function getArticle(slug: string): any {
  const key = Object.keys(articleModules).find((k) => k.endsWith(`/${slug}.md`));
  return key ? (articleModules as any)[key] : null;
}

export function getLearning(): LearningEntry[] {
  return (Object.values(learningModules) as LearningEntry[]).sort((a, b) =>
    `${b.date} ${b.time || ''}`.localeCompare(`${a.date} ${a.time || ''}`));
}

export function latestDate(): string {
  return getLearning()[0]?.date || '';
}

export function siteUrl(): string {
  // astro.config.mjs 已经按“环境变量 SITE_URL → site.json 中的 siteUrl”的顺序确定了网址
  return String(import.meta.env.SITE || site.siteUrl).replace(/\/$/, '');
}
