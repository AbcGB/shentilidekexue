// 六账号文案的核心逻辑（网站页面和检查脚本共用同一份代码，保证页面显示与复制内容一致）。
// 所有对应关系都通过 accountId 完成，不依赖数组顺序，避免错位。

export function sortedAccounts(settings) {
  return [...settings.accounts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** 按账号设置的顺序，把某个穴位的文案与账号一一对应（以 accountId 匹配） */
export function alignCopies(acupoint, settings) {
  const list = acupoint.accountCopies || [];
  return sortedAccounts(settings).map((account) => {
    const matches = list.filter((c) => c.accountId === account.id);
    return { account, copy: matches[0] || null, duplicate: matches.length > 1 };
  });
}

/** 检查一个穴位的六组文案是否完整。返回问题列表（空数组表示完整） */
export function validateCopies(acupoint, settings) {
  const problems = [];
  const ids = new Set(settings.accounts.map((a) => a.id));
  for (const c of acupoint.accountCopies || []) {
    if (!ids.has(c.accountId)) problems.push(`存在未知的账号编号 accountId="${c.accountId}"（请检查 account-settings.json）`);
  }
  for (const { account, copy, duplicate } of alignCopies(acupoint, settings)) {
    const label = `${account.name}（${account.id}）`;
    if (!copy) { problems.push(`缺少账号 ${label} 的文案`); continue; }
    if (duplicate) problems.push(`账号 ${label} 有重复的文案`);
    if (!copy.title || !String(copy.title).trim()) problems.push(`${label} 缺少标题`);
    if (!copy.description || !String(copy.description).trim()) problems.push(`${label} 缺少描述`);
    if (!Array.isArray(copy.keywords) || copy.keywords.filter((k) => String(k).trim()).length === 0) problems.push(`${label} 缺少关键词`);
  }
  return problems;
}

export function keywordsText(copy, settings) {
  return (copy.keywords || []).join(settings.keywordSeparator ?? '、');
}
export function hashtagsText(copy, settings) {
  return (copy.hashtags || []).join(settings.hashtagSeparator ?? ' ');
}

/** 单个账号的全部发布内容 */
export function accountBlockText(acupoint, account, copy, settings) {
  const lines = [
    `【${account.name}】${acupoint.displayName}`,
    `标题：${copy.title}`,
    `描述：`,
    copy.description,
    `关键词：${keywordsText(copy, settings)}`,
  ];
  const tags = hashtagsText(copy, settings);
  if (tags) lines.push(`话题标签：${tags}`);
  return lines.join('\n');
}

/** 六组全部内容（发到工作群用） */
export function allAccountsText(acupoint, settings) {
  const header = `「身体里的科学」${acupoint.displayName}｜六个账号发布内容\n更新日期：${acupoint.updateDate}\n（${acupoint.copyStatus || '请人工确认后再发布'}）`;
  const blocks = alignCopies(acupoint, settings)
    .filter((x) => x.copy)
    .map(({ account, copy }) => accountBlockText(acupoint, account, copy, settings));
  return [header, ...blocks].join('\n\n——————————\n\n');
}

/** 生成页面上所有复制按钮对应的文本，key 唯一 */
export function buildCopyMap(acupoint, settings) {
  const map = {};
  for (const { account, copy } of alignCopies(acupoint, settings)) {
    if (!copy) continue;
    map[`title:${account.id}`] = copy.title;
    map[`description:${account.id}`] = copy.description;
    map[`keywords:${account.id}`] = keywordsText(copy, settings);
    map[`hashtags:${account.id}`] = hashtagsText(copy, settings);
    map[`account:${account.id}`] = accountBlockText(acupoint, account, copy, settings);
  }
  map['all'] = allAccountsText(acupoint, settings);
  const art = acupoint.wechatArticle;
  if (art && art.body) {
    map['article:title'] = art.title || '';
    map['article:summary'] = art.summary || '';
    map['article:keywords'] = (art.keywords || []).join(settings.keywordSeparator ?? '、');
    map['article:body'] = art.body || '';
    map['article:coverTitle'] = art.coverTitle || '';
    map['article:coverImageSuggestion'] = art.coverImageSuggestion || '';
  }
  return map;
}

/** 生成拼音的紧凑写法与首字母，用于搜索 */
export function pinyinForms(pinyin) {
  const parts = String(pinyin || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return { full: parts.join(''), initials: parts.map((p) => p[0]).join(''), spaced: parts.join(' ') };
}
