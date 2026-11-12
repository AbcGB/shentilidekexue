// 读取 content 目录下的所有内容。新增文件后无需修改这里的代码。
import site from '../config/site.json';
import copySettings from '../content/copy-settings.json';
import filmingList from '../content/filming/acupoint-list.json';
import equipment from '../content/equipment/device.json';
import equipmentHistory from '../content/equipment/history.json';
import training from '../content/training.json';
import { hasWorkbenchCopies } from './copy-core.mjs';

export type CopyVariant = { id: string; no: number; angle: string; title: string; description: string; keywords: string[]; hashtags?: string[]; versions?: Record<string, number> };
export type CopySet = { id: string; label: string; note?: string; variants: CopyVariant[]; bundleVersion?: number };
export type Acupoint = any;
export type LearningEntry = {
  id: string; date: string; time?: string; title: string; type: string; acupoints?: string[]; teachers?: string[];
  content: string; videoLinks?: { title: string; url: string }[]; images?: { src: string; alt: string }[];
  reviewStatus: string; publishStatus: string; keywords?: string[]; link?: string;
};

export { site, copySettings, equipment, equipmentHistory, training };

const acupointModules = import.meta.glob('../content/acupoints/*.json', { eager: true, import: 'default' });
const learningModules = import.meta.glob('../content/learning/*.json', { eager: true, import: 'default' });
const articleModules = import.meta.glob('../content/articles/*.md', { eager: true });

const allAcupointsRaw: Acupoint[] = Object.values(acupointModules) as Acupoint[];

/** 已发布的穴位（公开知识页）。草稿不会出现在网站上。穴位会持续增加，新增文件即可。 */
export function getAcupoints(): Acupoint[] {
  return allAcupointsRaw
    .filter((a) => a.publishStatus === 'published')
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

/** 老师工作台里出现的穴位：已发布、并且已录入负责人确认的视频文案（copySets 不为空且检查通过） */
export function getWorkbenchAcupoints(): Acupoint[] {
  return getAcupointsOrdered().filter((a) => hasWorkbenchCopies(a));
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

// ───── 皮穿支学习路径（src/content/lessons/*.md，按 frontmatter 的 order 排序） ─────
export type Lesson = {
  order: number; slug: string; title: string; seoTitle?: string; description: string; keywords?: string[];
  minutes?: number; reviewStatus: string; updateDate: string; diagram?: string; showAcupoints?: boolean; evidenceNote?: boolean;
  quickAnswers?: string[];
  Content: any;
};
const lessonModules = import.meta.glob('../content/lessons/*.md', { eager: true });
export function getLessons(): Lesson[] {
  return Object.values(lessonModules)
    .map((m: any) => ({ ...m.frontmatter, Content: m.Content }) as Lesson)
    .sort((a, b) => a.order - b.order);
}

// ───── 待负责人确认的文案草稿（src/content/drafts/*.json）。只给 /teacher/drafts/ 使用，正式工作台不读取 ─────
const draftModules = import.meta.glob('../content/drafts/*.json', { eager: true, import: 'default' });
/** 草稿列表：只保留“对应穴位已发布、且还没有正式文案”的草稿（已有正式文案的穴位绝不显示草稿） */
export function getDrafts(): any[] {
  const bySlug = Object.fromEntries(getAcupoints().map((a) => [a.slug, a]));
  return (Object.values(draftModules) as any[])
    .filter((d) => bySlug[d.slug] && !(bySlug[d.slug].copySets || []).length)
    .map((d) => ({ ...d, acupoint: bySlug[d.slug] }))
    .sort((a, b) => getAcupointsOrdered().indexOf(a.acupoint) - getAcupointsOrdered().indexOf(b.acupoint));
}

// ───── 拍摄清单（老师工作台内部） ─────
export type FilmingRow = { name: string; code: string; meridian: string; meridianCode: string; slug?: string; copyStatus: 'official' | 'draft' | 'none'; hasPublicPage: boolean; videoStatus: string };
/** 合并清单与穴位文件：清单里没有、但已有穴位文件的穴位也会自动列入。只计算状态，不生成任何页面 */
export function getFilmingRows(): FilmingRow[] {
  const list: any = filmingList;
  const merCode = Object.fromEntries(list.meridians.map((m: any) => [m.name, m.code]));
  const all = allAcupointsRaw;
  const drafts = new Set(getDrafts().map((d) => d.slug));
  const rows: any[] = list.points.map((x: any) => ({ ...x }));
  for (const a of all) if (!rows.some((r) => r.slug === a.slug)) rows.push({ name: a.name, code: a.code, meridian: a.meridian, slug: a.slug });
  return rows.map((r) => {
    const a = all.find((x) => x.slug === r.slug);
    const official = !!a && hasWorkbenchCopies(a) && a.publishStatus === 'published';
    return {
      ...r, meridianCode: merCode[r.meridian] || '',
      copyStatus: official ? 'official' : r.slug && drafts.has(r.slug) ? 'draft' : 'none',
      hasPublicPage: !!a && a.publishStatus === 'published',
      videoStatus: r.videoStatus || a?.videoStatus || '未记录',
    };
  }).sort((x, y) => list.meridians.findIndex((m: any) => m.name === x.meridian) - list.meridians.findIndex((m: any) => m.name === y.meridian) || x.code.localeCompare(y.code, 'en', { numeric: true }));
}
export { filmingList };
