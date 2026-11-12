// 生成搜索索引：穴位 + 历史学习内容 + 栏目页面。构建时自动生成，无需手动维护。
import { getAcupointsOrdered, getLearning } from './data';
import { pinyinForms } from './copy-core.mjs';
import { u, entryLink } from './url';

export function buildSearchIndex() {
  const points = getAcupointsOrdered();
  const bySlug = Object.fromEntries(points.map((p: any) => [p.slug, p]));
  const items: any[] = [];
  for (const p of points) {
    const py = pinyinForms(p.pinyin);
    items.push({
      k: 'point', title: p.displayName, meta: p.meridian, desc: p.summary, url: u(`/xuewei/${p.slug}/`),
      name: p.name, aliases: p.aliases, py: py.full, pyi: py.initials, meridian: p.meridian,
      kw: [...(p.seo?.keywords || []), ...(p.specialPointCategories || []), p.bodyRegion, p.code].join(' '),
      body: [p.standardLocation?.standard, p.standardLocation?.plain, ...(p.traditionalApplications?.items || [])].join(' '),
    });
  }
  for (const e of getLearning()) {
    const names = (e.acupoints || []).map((s) => bySlug[s]?.name).filter(Boolean);
    const meridians = (e.acupoints || []).map((s) => bySlug[s]?.meridian).filter(Boolean);
    items.push({
      k: 'entry', title: e.title, meta: `${e.type} · ${e.date}`, desc: e.content.slice(0, 60) + (e.content.length > 60 ? '…' : ''),
      url: entryLink(e), name: '', aliases: names, py: (e.acupoints || []).join(' '), pyi: '', meridian: meridians.join(' '),
      kw: [...(e.keywords || []), e.type, ...(e.teachers || [])].join(' '), body: e.content,
    });
  }
  const pages = [
    { title: '皮门多普勒定位演示', url: '/equipment/', kw: '设备演示 多普勒 皮门 探头 提示音 丁老师 定位演示 pimen duopule', desc: '丁老师研发的皮门多普勒设备：外观、探头、操作流程与定位演示记录。' },
    { title: '老师工作台（六账号发布文案）', url: '/teacher/', kw: '工作台 文案 标题 描述 关键词 复制 发布 视频号 抖音 小红书 公众号 laoshi gongzuotai', desc: '按账号复制标题、描述、关键词和话题标签。' },
    { title: '今日学习', url: '/learning/today/', kw: '今日 今天 学习 更新 jinri', desc: '当天新增的学习内容与视频。' },
    { title: '历史更新', url: '/learning/archive/', kw: '历史 往期 归档 archive lishi', desc: '按日期、穴位、经络、类型筛选过去的内容。' },
    { title: '学习资料', url: '/ziliao/', kw: '资料 参考 教材 国家标准 骨度分寸 同身寸 ziliao', desc: '参考资料与取穴基础知识。' },
    { title: '意见反馈', url: '/feedback/', kw: '反馈 意见 建议 纠错 fankui', desc: '给网站管理者反馈修改建议与纠错。' },
  ];
  for (const pg of pages) items.push({ k: 'page', title: pg.title, meta: '栏目', desc: pg.desc, url: u(pg.url), name: pg.title, aliases: [], py: '', pyi: '', meridian: '', kw: pg.kw, body: '' });
  return items;
}
