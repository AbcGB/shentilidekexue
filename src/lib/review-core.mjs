// 网站“学习循环”状态汇总：资料进来 → 起草/整理 → 待审核/待确认 → 负责人确认后上线。
// 只读取内容文件，统计每一步现在有哪些内容；不会修改、发布或升级任何内容。
// 被 /teacher/shenhe/ 页面和 scripts/review-status.mjs（npm run status）共同使用。

const notReviewed = (s) => s !== '已审核';

/**
 * @param {{ lessons:any[], acupoints:any[], drafts:any[], device:any, answers:any[], filming:any }} d
 */
export function buildReviewQueue({ lessons = [], acupoints = [], drafts = [], device = {}, answers = [], filming = {} }) {
  const published = acupoints.filter((p) => p.publishStatus === 'published');
  const official = published.filter((p) => (p.copySets || []).length > 0);
  const draftSlugs = new Set(drafts.map((x) => x.slug));

  // 1. 等待的资料（没有资料就不写，不编造）
  const materials = [];
  if (!(device.photos || []).length) materials.push({ what: '皮门多普勒真实设备照片', where: '设备页 /equipment/', who: '负责人' });
  if (!(device.videos || []).length) materials.push({ what: '皮门多普勒真实操作与提示音视频', where: '设备页 /equipment/', who: '负责人' });
  if ((device.statement || []).some((s) => /待与说明书核对/.test(s))) materials.push({ what: '设备说明书（核对约 8 MHz、约 2 厘米等参数和适用范围）', where: '设备页、学习路径第 5 课', who: '负责人 / 设备研发人员' });
  const noDemo = published.filter((p) => !(p.dopplerDemo?.photos || []).length && !(p.dopplerDemo?.videos || []).length && !(p.videos || []).length);
  if (noDemo.length) materials.push({ what: `穴位定位演示视频或照片（${noDemo.map((p) => p.displayName).join('、')}）`, where: '各穴位页“多普勒定位演示”', who: '拍摄老师' });
  const noCopy = published.filter((p) => !(p.copySets || []).length && !draftSlugs.has(p.slug));
  if (noCopy.length) materials.push({ what: `视频文案原文（${noCopy.map((p) => p.displayName).join('、')}）`, where: '老师工作台', who: '负责人' });
  if (filming && filming.complete === false) materials.push({ what: '全身经穴名单（逐条对照 GB/T 12346-2021 原文核对后补充）', where: '拍摄清单 /teacher/jindu/', who: '负责人 / 专业老师' });

  // 2. 已起草、待负责人确认（文案草稿）
  const draftItems = drafts.map((x) => ({ slug: x.slug, name: x.acupoint?.displayName || x.slug, groups: x.draftCopySets?.[0]?.variants?.length || 0, generatedAt: x.generatedAt }));

  // 3. 已公开、待专业审核（医学/学习内容不会自动变成“已审核”）
  const review = [
    ...lessons.filter((l) => notReviewed(l.reviewStatus)).map((l) => ({ kind: '学习路径', name: `第 ${l.order} 课：${l.title}`, href: `/xuexi/${l.slug}/` })),
    ...published.filter((p) => notReviewed(p.reviewStatus)).map((p) => ({ kind: '穴位知识', name: p.displayName, href: `/xuewei/${p.slug}/` })),
    ...answers.filter((a) => notReviewed(a.reviewStatus)).map((a) => ({ kind: '简短回答', name: a.q, href: a.link })),
    ...(notReviewed(device.reviewStatus) ? [{ kind: '设备介绍', name: device.title || '皮门多普勒', href: '/equipment/' }] : []),
  ];

  // 4. 已确认
  const confirmed = {
    officialCopy: official.map((p) => ({ slug: p.slug, name: p.displayName, groups: p.copySets.reduce((n, s) => n + (s.variants || []).length, 0) })),
    reviewed: [
      ...lessons.filter((l) => !notReviewed(l.reviewStatus)).map((l) => l.title),
      ...published.filter((p) => !notReviewed(p.reviewStatus)).map((p) => p.displayName),
    ],
  };
  return { materials, drafts: draftItems, review, confirmed };
}
