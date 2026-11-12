-- 文案复制统计数据库结构（SQLite / Cloudflare D1 通用，可重复执行）
-- 只保存内容编号、操作类型、时间和汇总数字；不保存老师身份、不保存原始 IP。

-- 每条可统计的文案（标题/描述/关键词/话题标签/整组/全部 N 组）
CREATE TABLE IF NOT EXISTS copy_items (
  id TEXT PRIMARY KEY,               -- content_item_id，如 zusanli:douyin:title:a:v1
  acupoint TEXT NOT NULL,            -- 穴位 slug
  account_id TEXT NOT NULL,          -- 视频编号（copySets 的 id，例如 video）；列名沿用旧结构
  content_type TEXT NOT NULL,        -- title / description / keywords / hashtags / group_bundle 整组 / set_bundle 全部 N 组
  variant TEXT NOT NULL DEFAULT 'a', -- 组编号（variant id，例如 zaina；全部 N 组为 _all）
  version INTEGER NOT NULL DEFAULT 1,-- 内容版本号：新版本从 0 计数，旧版本保留为历史
  content_hash TEXT,                 -- 当前文字指纹
  original_hash TEXT,                -- 该版本首次登记时的文字指纹（不同说明做过“小修改”）
  preview TEXT,                      -- 文案开头，便于管理员识别
  active INTEGER NOT NULL DEFAULT 1, -- 1=网站当前在用；0=历史版本
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_copy_items_acupoint ON copy_items(acupoint);

-- 单账号整组包含哪些单条
CREATE TABLE IF NOT EXISTS copy_bundle_members (
  bundle_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  PRIMARY KEY (bundle_id, member_id)
);

-- 累计次数与最后复制时间
CREATE TABLE IF NOT EXISTS copy_stats (
  item_id TEXT PRIMARY KEY,
  total INTEGER NOT NULL DEFAULT 0,
  last_copied_at TEXT
);

-- 每天每条的复制数（北京时间日期），用于近 7 天 / 近 30 天 / 趋势
CREATE TABLE IF NOT EXISTS copy_daily_stats (
  item_id TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, day)
);
CREATE INDEX IF NOT EXISTS idx_copy_daily_day ON copy_daily_stats(day);

-- 整组复制记录：单组整组（group）与全部 N 组（all）分开保存
CREATE TABLE IF NOT EXISTS copy_batch_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  batch_type TEXT NOT NULL,          -- group 单组整组 / all 全部 N 组（旧数据可能为 account）
  item_id TEXT NOT NULL,
  acupoint TEXT NOT NULL,
  account_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_copy_batch_acupoint ON copy_batch_stats(acupoint);

-- 已处理的复制事件（客户端事件编号，用于重试时不重复计数；约 35 天后自动清理）
CREATE TABLE IF NOT EXISTS copy_events (
  event_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- 短时间去重（同一浏览器、同一内容 10 秒内只计一次）。key 为加盐哈希，1 天后清理
CREATE TABLE IF NOT EXISTS copy_recent (
  dedupe_key TEXT PRIMARY KEY,
  at_ms INTEGER NOT NULL
);

-- 接口限流计数。bucket 为“加盐哈希(IP)+分钟”，不保存原始 IP，1 小时后清理
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  at_ms INTEGER NOT NULL
);
