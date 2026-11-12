// 官方平台 / 关注我们（品牌新媒体矩阵）的公共逻辑。页面和测试共用，保证“哪些账号会显示”的规则一致。
// 规则：visible 为 true，并且有账号名称或所属人，同时至少有一种可用的关注方式（真实主页链接、二维码或搜索提示）。
// 没有真实链接/二维码的账号即使写进配置也不会显示，避免出现失效链接或编造账号。

const isHttp = (s) => typeof s === 'string' && /^https?:\/\/\S+$/.test(s.trim());
const filled = (s) => typeof s === 'string' && s.trim().length > 0;

export function canShowAccount(a) {
  if (!a || a.visible !== true) return false;
  if (!filled(a.accountName)) return false;
  return isHttp(a.homeUrl) || filled(a.qrImage) || filled(a.searchHint);
}

export function visibleAccounts(cfg, group) {
  return (cfg?.accounts || [])
    .filter((a) => canShowAccount(a) && (!group || a.group === group))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
}

/** 按分组返回可展示账号；没有可展示账号的分组不返回 */
export function groupedAccounts(cfg) {
  return [...(cfg?.groups || [])]
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
    .map((g) => ({ ...g, accounts: visibleAccounts(cfg, g.id) }))
    .filter((g) => g.accounts.length > 0);
}

/** 配置检查：返回问题列表（空数组表示没问题） */
export function validatePlatforms(cfg) {
  const problems = [];
  const groups = new Set((cfg?.groups || []).map((g) => g.id));
  const ids = new Set();
  for (const a of cfg?.accounts || []) {
    const l = `账号 ${a.id || '（无编号）'}`;
    if (!a.id || !/^[a-z0-9-]+$/.test(a.id)) problems.push(`${l} 的 id 只能使用小写字母、数字和短横线`);
    if (ids.has(a.id)) problems.push(`${l} 的 id 重复`);
    ids.add(a.id);
    if (!groups.has(a.group)) problems.push(`${l} 的 group（${a.group}）不在 groups 里`);
    if (!filled(a.platform)) problems.push(`${l} 缺少 platform（平台名称）`);
    if (typeof a.visible !== 'boolean') problems.push(`${l} 的 visible 应为 true 或 false`);
    if (filled(a.homeUrl) && !isHttp(a.homeUrl)) problems.push(`${l} 的 homeUrl 应是 http(s):// 开头的真实主页地址`);
    if (a.visible === true && !canShowAccount(a)) problems.push(`${l} 设为展示，但缺少账号名称，或没有主页链接/二维码/搜索提示，页面不会显示它`);
  }
  return problems;
}
