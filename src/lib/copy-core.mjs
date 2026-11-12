// 老师工作台文案的核心逻辑（网站页面、检查脚本、统计清单共用同一份代码，保证页面显示与复制内容一致）。
//
// 数据结构（每个穴位 JSON 里的 copySets）：
//   copySets: [
//     { id: "video", label: "足三里穴定位与皮门多普勒演示视频", note: "...", variants: [
//         { id: "g1", no: 1, title, description, keywords: "#三阴交 #三阴交穴 ...", angle?: "", hashtags?: [], versions?: {} },
//         { id: "g2", no: 2, ... }, ...   ← 组数不固定，6 组、8 组、10 组都可以
//     ] }
//   ]
// - keywords 可以是一整串文字（例如负责人给的 "#a #b #c"，按原样复制），也可以是数组（用顿号连接）。
// - angle（角度说明）、hashtags（话题标签）都是可选的，没有就不显示。
//   （一个穴位可以有多条视频，每条视频一个 copySet）
// - 一个 copySet = 一条视频（或一个发布任务）；variants = 这条视频的第 1、2、3…… 组文案。
// - variant.id 是这组文案的永久编号（小写字母/数字/短横线），复制统计靠它对应，**写好后不要改**；
//   no 只是显示编号，可以调整顺序。新增第 7、8 组时，直接在 variants 末尾加一项、取一个新的 id 即可。
// - 不再区分视频号/抖音/小红书/公众号等平台。

export const ID_RE = /^[a-z0-9-]+$/;

/** 某个穴位的全部文案组（按 no 排序后的副本） */
export function getSets(acupoint) {
  return (acupoint.copySets || []).map((s) => ({
    ...s,
    variants: [...(s.variants || [])].sort((a, b) => (a.no ?? 0) - (b.no ?? 0)),
  }));
}

/** 是否有可用于老师工作台的文案（至少一条视频、且检查通过） */
export function hasWorkbenchCopies(acupoint) {
  return Array.isArray(acupoint.copySets) && acupoint.copySets.length > 0 && validateCopies(acupoint).length === 0;
}

/** 主文案组：穴位科普短视频（第一个 copySet） */
export function mainSet(acupoint) {
  return getSets(acupoint)[0] || null;
}

export function variantKey(setId, variantId) {
  return `${setId}/${variantId}`;
}

/** 检查一个穴位的文案是否完整。返回问题列表（空数组表示完整） */
export function validateCopies(acupoint) {
  const problems = [];
  const sets = acupoint.copySets;
  if (!Array.isArray(sets)) return ['缺少 copySets（没有文案时写 []）'];
  const setIds = new Set();
  sets.forEach((s, si) => {
    const sl = `第 ${si + 1} 条视频（${s.id || '无编号'}）`;
    if (!s.id || !ID_RE.test(s.id)) problems.push(`${sl} 的 id 只能使用小写字母、数字和短横线`);
    if (setIds.has(s.id)) problems.push(`${sl} 的 id 重复`);
    setIds.add(s.id);
    if (!s.label) problems.push(`${sl} 缺少 label（显示名称）`);
    const vs = s.variants || [];
    if (vs.length === 0) problems.push(`${sl} 一组文案都没有`);
    const ids = new Set(), nos = new Set();
    for (const v of vs) {
      const vl = `${sl} 第 ${v.no ?? '?'} 组（${v.id || '无编号'}）`;
      if (!v.id || !ID_RE.test(v.id)) problems.push(`${vl} 的 id 只能使用小写字母、数字和短横线`);
      if (ids.has(v.id)) problems.push(`${vl} 的 id 与同一条视频的其他组重复`);
      ids.add(v.id);
      if (!Number.isInteger(v.no) || v.no < 1) problems.push(`${vl} 的编号 no 应为 1、2、3 这样的正整数`);
      if (nos.has(v.no)) problems.push(`${vl} 的编号 no 与其他组重复`);
      nos.add(v.no);
      if (!v.title || !String(v.title).trim()) problems.push(`${vl} 缺少标题`);
      if (!v.description || !String(v.description).trim()) problems.push(`${vl} 缺少描述`);
      if (!keywordsText(v).trim()) problems.push(`${vl} 缺少关键词`);
    }
  });
  return problems;
}

export function keywordsText(copy, settings) {
  if (typeof copy.keywords === 'string') return copy.keywords; // 原文整串，按原样复制
  return (copy.keywords || []).join(settings?.keywordSeparator ?? '、');
}
export function hashtagsText(copy, settings) {
  return (copy.hashtags || []).join(settings?.hashtagSeparator ?? ' ');
}

/** 一组文案的全部内容（标题 + 描述 + 关键词 + 话题标签） */
export function variantBlockText(acupoint, set, v, settings) {
  const lines = [
    `【第 ${v.no} 组${v.angle ? `｜${v.angle}` : ''}】${acupoint.displayName}`,
    `标题：${v.title}`,
    `描述：`,
    v.description,
    `关键词：${keywordsText(v, settings)}`,
  ];
  const tags = hashtagsText(v, settings);
  if (tags) lines.push(`话题标签：${tags}`);
  return lines.join('\n');
}

/** 一条视频的全部 N 组（发到工作群用） */
export function setBundleText(acupoint, set, settings) {
  const header = `「皮穿支 - 身体里的科学」${set.label}｜共 ${set.variants.length} 组文案\n更新日期：${acupoint.updateDate}\n（${acupoint.copyStatus || '请人工确认后再发布'}；每位老师选一组发布，尽量不要重复）`;
  return [header, ...set.variants.map((v) => variantBlockText(acupoint, set, v, settings))].join('\n\n——————————\n\n');
}

/** 生成页面上所有复制按钮对应的文本，key 唯一 */
export function buildCopyMap(acupoint, settings) {
  const map = {};
  for (const set of getSets(acupoint)) {
    for (const v of set.variants) {
      const k = variantKey(set.id, v.id);
      map[`title:${k}`] = v.title;
      map[`description:${k}`] = v.description;
      map[`keywords:${k}`] = keywordsText(v, settings);
      map[`hashtags:${k}`] = hashtagsText(v, settings);
      map[`group:${k}`] = variantBlockText(acupoint, set, v, settings);
    }
    map[`set:${set.id}`] = setBundleText(acupoint, set, settings);
  }
  const art = longCopyOf(acupoint);
  if (art && art.body && art.showInWorkbench) { // 长文案默认不在工作台显示
    map['long:title'] = art.title || '';
    map['long:summary'] = art.summary || '';
    map['long:keywords'] = (art.keywords || []).join(settings?.keywordSeparator ?? '、');
    map['long:body'] = art.body || '';
    map['long:coverTitle'] = art.coverTitle || '';
    map['long:coverImageSuggestion'] = art.coverImageSuggestion || '';
  }
  return map;
}

/** 可选的长文案（以前叫 wechatArticle，兼容旧字段） */
export function longCopyOf(acupoint) {
  return acupoint.longCopy || acupoint.wechatArticle || null;
}

/** 生成拼音的紧凑写法与首字母，用于搜索 */
export function pinyinForms(pinyin) {
  const parts = String(pinyin || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return { full: parts.join(''), initials: parts.map((p) => p[0]).join(''), spaced: parts.join(' ') };
}

// ───────────── 复制统计：内容编号（content_item_id） ─────────────
// 编号格式：穴位:视频编号:组编号:类型:v版本号，例如 zusanli:video:zaina:title:v1
// - 组编号用 variant.id（不是显示编号 no，也不再是平台账号），所以调整显示顺序、增加第 7、8 组都不会影响已有统计。
// - 类型：title 标题 / description 描述 / keywords 关键词 / hashtags 话题标签 /
//         group_bundle 整组 / set_bundle 这条视频的全部 N 组
// - 版本号：文案“小修改”时不变（沿用统计）；改成“新内容版本”时在该组的 versions 里把对应类型 +1（重新从 0 计数）
// 统计数据库沿用原表结构：account_id 列存视频编号（set id），variant 列存组编号（variant id）。
export const COPY_TYPES = ['title', 'description', 'keywords', 'hashtags'];
export const TYPE_LABELS = { title: '标题', description: '描述', keywords: '关键词', hashtags: '话题标签', group_bundle: '整组', set_bundle: '全部 N 组' };

export function contentItemId(slug, setId, variantId, type, version = 1) {
  return `${slug}:${setId}:${variantId}:${type}:v${version}`;
}

/** 简单稳定的文本指纹（FNV-1a），用于判断文案是否被修改过 */
export function textHash(s) {
  let h = 0x811c9dc5;
  const str = String(s ?? '');
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** 某个穴位全部可统计的内容条目（单条 + 整组 + 全部 N 组） */
export function buildCopyItems(acupoint, settings) {
  const slug = acupoint.slug;
  const items = [];
  const map = buildCopyMap(acupoint, settings);
  for (const set of getSets(acupoint)) {
    for (const v of set.variants) {
      const k = variantKey(set.id, v.id);
      const ver = v.versions || {};
      const memberIds = [];
      for (const type of COPY_TYPES) {
        const text = map[`${type}:${k}`] || '';
        if (type === 'hashtags' && !text) continue;
        const id = contentItemId(slug, set.id, v.id, type, ver[type] || 1);
        memberIds.push(id);
        items.push({ id, acupoint: slug, accountId: set.id, setId: set.id, type, variant: v.id, no: v.no, version: ver[type] || 1, hash: textHash(text), preview: text.slice(0, 80), copyKey: `${type}:${k}` });
      }
      items.push({ id: contentItemId(slug, set.id, v.id, 'group_bundle', ver.bundle || 1), acupoint: slug, accountId: set.id, setId: set.id, type: 'group_bundle', variant: v.id, no: v.no, version: ver.bundle || 1, hash: textHash(map[`group:${k}`]), preview: `第 ${v.no} 组${v.angle ? `（${v.angle}）` : ''}：整组内容`, copyKey: `group:${k}`, members: memberIds });
    }
    items.push({ id: contentItemId(slug, set.id, '_all', 'set_bundle', set.bundleVersion || 1), acupoint: slug, accountId: set.id, setId: set.id, type: 'set_bundle', variant: '_all', no: 0, version: set.bundleVersion || 1, hash: textHash(map[`set:${set.id}`]), preview: `${set.label}：全部 ${set.variants.length} 组`, copyKey: `set:${set.id}` });
  }
  return items;
}
