// Astro 配置。一般不需要修改。
// 正式域名请在 src/config/site.json 的 siteUrl 中填写，或在部署平台设置环境变量 SITE_URL。
// 如果网站部署在子目录（例如 GitHub Pages 测试地址 https://用户名.github.io/仓库名/），设置环境变量 BASE_PATH=/仓库名/。
import { defineConfig } from 'astro/config';
import fs from 'node:fs';

const siteConfig = JSON.parse(fs.readFileSync(new URL('./src/config/site.json', import.meta.url), 'utf8'));
const site = (process.env.SITE_URL || siteConfig.siteUrl).replace(/\/$/, '');

export default defineConfig({
  site,
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
  build: { format: 'directory' },
  output: 'static',
});
