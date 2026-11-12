// 文案草稿生成（本地规则拼装，不调用任何在线 AI 接口）。
//
// 只用穴位文件里已有的字段拼装：name / displayName / code / meridian / bodyRegion /
// specialPointCategories / standardLocation.standard / standardLocation.findingTips。
// 不写疗效、不写针刺/艾灸教学、不写价格和报名、不写“穴位就是皮穿支”。
//
// 生成的草稿只放在 src/content/drafts/<slug>.json 的 draftCopySets 里，状态为“待负责人确认”，
// 网站上只在 /teacher/drafts/ 待确认页显示；正式老师工作台只读取穴位文件里的 copySets。
//
// 角度顺序参照负责人已确认的三阴交、足三里、阳陵泉的分法（前 6 组），第 7—10 组为扩展角度：
//   1 在哪里  2 怎么找  3 经络/特定穴属性  4 位置介绍 + 定位演示  5 皮门多普勒设备操作演示  6 跟着老师认识
//   7 国家标准定位原文  8 体表标志  9 穴位代码  10 常见问题

export const DRAFT_STATUS = '待负责人确认';
export const MAX_GROUPS = 10;

/** 禁止出现在草稿里的说法（测试与生成时都会检查） */
export const FORBIDDEN = [
  /治疗|治愈|疗效|功效|主治|缓解|改善|保健|养生|调理|祛|补益/,
  /针刺|扎针|进针|下针|艾灸|按摩手法|刺激/,
  /价格|费用|收费|\d+\s*元|优惠|报名|招生|学费|课程费|加微信|私信/,
  /穴位就是皮穿支|穴位即皮穿支|穴位=皮穿支|穴位＝皮穿支|都是皮穿支/,
  /已证实|已被证明|科学证明|证明了|精准定位|百分之百|100%|绝对准确/,
  /专利/,
];

const stripParen = (s) => String(s || '').replace(/（[^）]*）|\([^)]*\)/g, '').trim();
const noEndPunct = (s) => String(s || '').replace(/[。；;，,\s]+$/, '');
const tag = (s) => '#' + String(s).replace(/\s+/g, '');

/** 一个穴位的全部可用角度（按顺序）。每个角度返回 { angle, title, description, keywords } */
export function draftAngles(p) {
  const name = p.name;
  const disp = p.displayName || `${name}穴`;
  const xue = disp.endsWith('穴') ? disp : `${name}穴`;
  const mer = p.meridian;
  const region = p.bodyRegion || '';
  const cats = (p.specialPointCategories || []).filter(Boolean);
  const cat1 = stripParen(cats[0] || '');
  const std = noEndPunct(p.standardLocation?.standard || '');
  const tips = (p.standardLocation?.findingTips || []).map(noEndPunct).filter(Boolean);
  const kw = (arr) => arr.filter(Boolean).map(tag).join(' ');
  const list = [
    {
      angle: '在哪里',
      title: `${name}在哪里？皮门多普勒定位演示`,
      description: `${name}属于${mer}${region ? `，位于${region}` : ''}。本期通过皮门多普勒设备进行现场定位演示。`,
      keywords: kw([name, xue, `${name}位置`, '穴位科普', '身体里的科学']),
    },
    {
      angle: '怎么找',
      title: `${xue}怎么找？现场定位过程展示`,
      description: `${xue}怎么找？${tips.length ? tips.join('；') + '。' : ''}跟随老师，通过多普勒设备看看实际探测和定位过程。`,
      keywords: kw([`${name}在哪里`, `${name}怎么找`, `${name}定位`, '人体穴位', '皮门']),
    },
    {
      angle: cats.length ? '经络与特定穴' : '经络归属',
      title: cats.length ? `${name}在哪里？认识${mer}的${cat1}` : `${name}在哪里？认识${mer}上的常见穴位`,
      description: `今天认识${xue}，它属于${mer}${cats.length ? `，在传统经络理论中为${cats.join('、')}` : ''}。本期同时记录皮门多普勒设备的现场演示过程。`,
      keywords: kw([`${name}穴位置`, mer, cat1, '经络知识', '皮门']),
    },
    {
      angle: '位置介绍 + 定位演示',
      title: `${xue}位置介绍及多普勒定位演示`,
      description: `${name}是${mer}上的穴位。${std ? `标准位置：${std}。` : ''}本篇介绍${name}的基本位置及多普勒设备定位演示。`,
      keywords: kw([`${name}穴介绍`, `${name}定位演示`, '传统经络', '穴位知识', '皮穿支']),
    },
    {
      angle: '皮门多普勒设备操作演示',
      title: `${xue}｜皮门多普勒设备操作演示`,
      description: `现场操作皮门多普勒设备，展示${xue}探测、设备提示音及定位过程。`,
      keywords: kw(['丁志伟', '皮门多普勒', `${name}定位`, '多普勒设备', '设备演示']),
    },
    {
      angle: '跟着老师认识',
      title: `跟着老师认识${xue}，了解定位过程`,
      description: `跟着老师学习${xue}，从认识穴位名称、找到体表标志，到观看设备定位演示，一起探索人体知识。`,
      keywords: kw(['皮穿支', '穴位学习', `${name}教学`, '人体奥秘', '穴位定位']),
    },
    std && {
      angle: '国家标准定位',
      title: `国家标准里的${xue}：标准定位怎么读`,
      description: `按GB/T 12346-2021《经穴名称与定位》，${xue}：${std}。本期对照标准描述，演示现场定位过程。`,
      keywords: kw([`${name}标准定位`, xue, '经穴定位', '国家标准', '身体里的科学']),
    },
    tips.length && {
      angle: '体表标志',
      title: `找${xue}，先认体表标志`,
      description: `${region ? `${name}位于${region}。` : ''}找穴时先看体表标志：${tips.slice(0, 2).join('；')}。本期结合皮门多普勒设备演示定位过程。`,
      keywords: kw([`${name}体表标志`, `${name}取穴`, '找穴位', '人体穴位', '皮门']),
    },
    p.code && {
      angle: '穴位代码',
      title: `${p.code}是哪个穴位？认识${xue}`,
      description: `${xue}的 WHO 标准代码为${p.code}，属于${mer}。本期介绍它的位置，并记录皮门多普勒设备的定位演示。`,
      keywords: kw([p.code, xue, mer, '穴位代码', '穴位科普']),
    },
    {
      angle: '常见问题',
      title: `${xue}常见问题：在哪、怎么找、属于哪条经`,
      description: `关于${xue}，常被问到三个问题：在哪里——${region || '见标准定位'}；怎么找——${tips.slice(0, 2).join('，') || '按标准定位描述'}；属于哪条经——${mer}。本期通过现场定位演示一起看看。`,
      keywords: kw([xue, `${name}在哪里`, `${name}怎么找`, mer, '穴位问答']),
    },
  ];
  return list.filter(Boolean);
}

/** 检查一组文字里有没有禁止的说法，返回命中的问题列表 */
export function forbiddenHits(text) {
  return FORBIDDEN.filter((re) => re.test(text)).map((re) => re.source);
}

/** 生成一个穴位的草稿（默认 6 组，最多 10 组） */
export function buildDraft(p, { n = 6, generatedAt = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10) /* 北京时间 */ } = {}) {
  const angles = draftAngles(p);
  const count = Math.max(1, Math.min(Number(n) || 6, MAX_GROUPS, angles.length));
  const variants = angles.slice(0, count).map((a, i) => ({ id: `g${i + 1}`, no: i + 1, angle: a.angle, title: a.title, description: a.description, keywords: a.keywords }));
  for (const v of variants) {
    const hits = forbiddenHits(`${v.title}\n${v.description}`);
    if (hits.length) throw new Error(`${p.slug} 第 ${v.no} 组含有禁止的说法：${hits.join('；')}`);
  }
  return {
    _说明: '自动生成的文案草稿，只用于负责人确认，老师请勿直接使用。确认后用 scripts/promote-draft.mjs 转为正式文案（copySets）。重新生成：node scripts/draft-copy.mjs --slug ' + p.slug,
    slug: p.slug,
    status: DRAFT_STATUS,
    generatedAt,
    generator: 'scripts/draft-copy.mjs（本地规则拼装，未使用在线 AI）',
    sourceFields: ['name', 'displayName', 'code', 'meridian', 'bodyRegion', 'specialPointCategories', 'standardLocation.standard', 'standardLocation.findingTips'],
    draftCopySets: [{ id: 'video', label: `${p.displayName || p.name}定位与皮门多普勒演示视频（草稿）`, variants }],
  };
}
