// 生成搜索索引：穴位 + 历史学习内容 + 栏目页面。构建时自动生成，无需手动维护。
import { getAcupointsOrdered, getLearning, getLessons } from './data';
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
    { title: '皮门多普勒（设备演示与培训）', url: '/equipment/', kw: '设备演示 设备培训 培训 多普勒 皮门 探头 提示音 丁老师 丁志伟 专利 定位演示 pimen duopule', desc: '丁老师研发的皮门多普勒设备：外观、探头、操作流程与定位演示记录。' },
    { title: '发明专利 CN113975152B：一种基于3D打印的个性化皮穿支定位装置及其制作方法', url: '/zhuanli/cn113975152b/', kw: '专利 CN113975152B 3D打印 丁志伟 丁奕铭 潍坊新星中智 皮穿支定位装置 zhuanli patent', desc: '该发明专利的公开信息转载页，便于在国内阅读，不必打开 Google。该专利并非皮门多普勒设备本身的专利。' },
    { title: '皮穿支学习路径', url: '/xuexi/', kw: '皮穿支 学习 课程 学习路径 穿支 pichuanzhi xuexi', desc: '按顺序学皮穿支：定义、层次、显微外科、与腧穴的研究、多普勒定位。' },
    { title: '老师工作台（视频多组文案）', url: '/teacher/', kw: '工作台 文案 标题 描述 关键词 复制 发布 laoshi gongzuotai', desc: '每条视频若干组标题、描述、关键词，按编号一键复制。' },
    { title: '今日学习', url: '/learning/today/', kw: '今日 今天 学习 更新 jinri', desc: '当天新增的学习内容与视频。' },
    { title: '历史更新', url: '/learning/archive/', kw: '历史 往期 归档 archive lishi', desc: '按日期、穴位、经络、类型筛选过去的内容。' },
    { title: '学习资料', url: '/ziliao/', kw: '资料 参考 教材 国家标准 骨度分寸 同身寸 ziliao', desc: '参考资料与取穴基础知识。' },
    { title: '意见反馈', url: '/feedback/', kw: '反馈 意见 建议 纠错 fankui', desc: '给网站管理者反馈修改建议与纠错。' },
  ];
  getLessons().forEach((l, i) => items.push({ k: 'page', title: `第 ${i + 1} 课：${l.title}`, meta: '皮穿支学习路径', desc: l.description, url: u(`/xuexi/${l.slug}/`), name: l.title, aliases: [], py: '', pyi: '', meridian: '', kw: (l.keywords || []).join(' '), body: '' }));
  for (const pg of pages) items.push({ k: 'page', title: pg.title, meta: '栏目', desc: pg.desc, url: u(pg.url), name: pg.title, aliases: [], py: '', pyi: '', meridian: '', kw: pg.kw, body: '' });
  return items;
}
