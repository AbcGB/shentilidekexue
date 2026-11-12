# 「身体里的科学」官方网站及新媒体内容工作台 · 使用说明

> 探索人体奥秘，发现生命科学。

这份说明写给负责人陈老师和以后帮忙维护网站的同事，尽量不用技术术语。遇到看不懂的地方，可以把这份文件和出错的截图一起发给技术人员。

---

## 0. 现在的状态（请先看）

- ✅ 网站第一阶段（MVP）已经开发完成，并在开发电脑上实际生成、测试通过。
- ❌ **网站目前还没有正式上线**：还没有上传到 GitHub、没有部署到任何服务器、也没有绑定域名。外面的人现在还打不开这个网站。
- 上线需要按本说明第 7～9 部分操作（需要先决定托管方案和购买域名）。
- 网站里所有穴位知识和发布文案目前都是 **“待审核”** 状态：内容按国家标准和针灸教材整理，文案由 AI 辅助起草，**必须由专业老师核对、负责人确认后才能对外发布**。

---

## 1. 网站有哪些页面

| 页面 | 网址（域名后面的部分） | 给谁用 |
| --- | --- | --- |
| 首页（搜索、今日更新、最新/热门穴位、设备演示、学习资料、品牌介绍） | `/` | 所有人 |
| 穴位知识库（全部穴位、按经络浏览） | `/xuewei/` | 所有人 |
| 穴位详情页（6 个） | `/xuewei/zusanli/`、`/xuewei/yanglingquan/`、`/xuewei/sanyinjiao/`、`/xuewei/waiguan/`、`/xuewei/houxi/`、`/xuewei/shenmen/` | 所有人、搜索引擎 |
| 今日学习 | `/learning/today/` | 老师 |
| 历史更新（按日期、穴位、经络、类型、老师、关键词筛选） | `/learning/archive/` | 老师 |
| 皮门多普勒定位演示 | `/equipment/` | 所有人 |
| 老师工作台（六账号文案） | `/teacher/`，每个穴位 `/teacher/zusanli/` 等 | 老师（不被搜索引擎收录） |
| 学习资料 | `/ziliao/` | 所有人 |
| 意见反馈 | `/feedback/` | 老师 |
| 关于我们（含隐私说明） | `/about/` | 所有人 |
| 搜索结果页 | `/search/?q=足三里` | 所有人 |
| 站点地图、爬虫规则 | `/sitemap.xml`、`/robots.txt` | 搜索引擎（自动生成） |

### 老师每天怎么用（可以直接转发给老师）

1. 用手机或电脑打开网站。
2. 在首页“今日更新”里点当天视频旁边的 **【复制文案】**；或者在搜索框输入穴位名称（支持“足三里”“三里”“zusanli”“zsl”这样的写法）。
3. 进入老师工作台后，内容按类型排好：六个标题、六个描述、六组关键词、话题标签。找到**自己账号那一行**，点右边的【复制标题】【复制描述】【复制关键词】。
4. 也可以点 **【复制该账号全部发布内容】** 一次复制自己账号的标题+描述+关键词+话题标签；负责人可以点页面最上方 **【复制全部六组内容】** 发到工作群。
5. 看到“复制成功！”就可以粘贴到平台了。如果手机浏览器不允许自动复制，会弹出一个文字框，长按“全选”再“复制”即可。
6. 发布后把链接或截图发到工作群。

---

## 2. 文件夹说明（只需要关心这几个）

```
website/
├─ src/
│  ├─ config/site.json                  ← 网站设置：域名、反馈表单地址、热门穴位、搜索引擎验证码、备案号
│  └─ content/
│     ├─ accounts/account-settings.json ← 六个账号的名称、平台、发布时间
│     ├─ acupoints/zusanli.json 等      ← 每个穴位一个文件：知识内容 + 六组发布文案 + 公众号正文
│     ├─ articles/zusanli.md 等         ← 每个穴位的公开科普文章（详情页“相关知识”部分）
│     ├─ learning/2026-11-12-xxx.json   ← 每日学习/更新内容，一条一个文件
│     └─ equipment/device.json          ← 设备演示专区内容
├─ public/
│  ├─ images/brand/        ← 品牌标志、分享图
│  ├─ images/acupoints/    ← 穴位照片（请按穴位建子文件夹，如 images/acupoints/zusanli/）
│  ├─ images/equipment/    ← 设备真实照片
│  └─ videos/              ← 小视频文件（大视频建议放视频平台，网站只放链接）
├─ templates/              ← 新增穴位、新增每日内容时可复制的模板
├─ scripts/                ← 内容检查和自动测试脚本（不用改）
├─ .github/workflows/deploy.yml ← GitHub 自动构建/部署设置
└─ README.md               ← 本说明
```

其他文件（`src/pages`、`src/components`、`src/layouts`、`src/styles` 等）是网站程序，日常更新不需要碰。

---

## 3. 在自己电脑上预览网站

只需要第一次做一遍安装，以后每次两条命令就行。

### 第一次：安装 Node.js

1. 打开 <https://nodejs.org/zh-cn>（或国内镜像 <https://npmmirror.com/mirrors/node/>），下载 **24 版本（LTS）** 的安装包。
2. 双击安装，一路点“下一步”。
3. 打开“终端”：
   - Windows：按键盘 Win 键，输入 `PowerShell`，回车。
   - 苹果电脑：按 ⌘+空格，输入“终端”，回车。
4. 输入 `node -v` 回车，看到 `v24.x.x` 这样的数字就说明装好了。

### 每次预览

1. 在终端里进入网站文件夹。最简单的方法：先输入 `cd `（cd 后面有一个空格），再把 `website` 文件夹拖到终端窗口里，回车。
2. 第一次（或者更新过程序之后）输入：`npm install`，等它下载完成（国内网络慢可以先输入 `npm config set registry https://registry.npmmirror.com`）。
3. 输入：`npm run dev`
4. 看到 `http://localhost:4321/` 后，在浏览器打开这个地址，就能看到网站。修改内容文件并保存后，浏览器会自动刷新。
5. 用手机预览：手机和电脑连同一个 Wi-Fi，在手机浏览器打开终端里显示的 `Network` 地址（例如 `http://192.168.1.10:4321/`）。
6. 预览完毕，在终端按 `Ctrl + C` 停止。

### 生成正式网站文件

- 输入：`npm run build`。它会先**自动检查内容**（例如六组文案是否写全、JSON 格式是否正确），然后生成一个 `dist` 文件夹——**这个文件夹就是完整的网站**，上传到任何服务器都能用。
- 想看生成后的效果：`npm run preview`，再打开 `http://localhost:4321/`。
- 想跑一遍自动验收测试：先 `npm run build`，另开一个终端运行 `npm run preview`，再运行 `npm test`（需要电脑上装有 Chrome 浏览器）。

---

## 4. 每天更新文案（最常用）

所有内容都是普通的文字文件，用任何文本编辑器都能改。推荐免费的 **VS Code**（<https://code.visualstudio.com/>），它会用颜色提示格式错误。

### 4.1 修改某个穴位的六组标题、描述、关键词

打开 `src/content/acupoints/穴位拼音.json`（例如 `houxi.json`），找到 `"accountCopies"`，里面有六段，每段对应一个账号：

```json
{
  "accountId": "douyin",
  "title": "这里是抖音标题",
  "description": "这里是描述，\n换行用 \\n 表示",
  "keywords": ["后溪", "后溪怎么找", "身体里的科学"],
  "hashtags": ["#后溪", "#穴位", "#身体里的科学"]
}
```

- **`accountId` 千万不要改**，它决定这段文字属于哪个账号（六个编号是：`wx-video` 视频号、`douyin` 抖音、`xiaohongshu` 小红书、`wechat-mp` 公众号、`ding-device` 丁老师设备演示、`other-teacher` 其他老师/学习记录）。网站靠它对齐，所以不管六段的先后顺序如何，都不会错位。
- 只改引号里的文字。描述里要换行，写 `\n`；文字里如果要用英文双引号，写成 `\"`（建议直接用中文引号“”或「」）。
- 每一项之间用英文逗号 `,` 分隔，最后一项后面不加逗号。
- 改完后把文件顶部的 `"updateDate"` 改成当天日期。

### 4.2 添加今天的更新（今日学习 / 首页今日更新）

1. 复制 `templates/learning-template.json` 到 `src/content/learning/`，文件名改为 `日期-简短英文或拼音.json`，例如 `2026-11-13-neiguan-video.json`。
2. 修改里面的内容：
   - `date` 日期（如 `2026-11-13`）、`time` 时间（如 `12:00`）
   - `title` 标题、`type` 类型（建议用：穴位视频 / 穴位知识 / 设备演示 / 学习资料 / 公众号文章）
   - `acupoints` 对应穴位的拼音文件名，如 `["houxi"]`（可以多个，也可以空 `[]`）
   - `teachers` 参与老师（填真实姓名或称呼）
   - `videoLinks` 视频链接（没有就写 `[]`）
   - `reviewStatus` 审核状态（待审核 / 已审核）
   - `publishStatus` 发布状态（已发布 / 待发布 / 待补充素材 / 待专业审核）
3. 保存、构建后，首页“今日更新”和“今日学习”会自动显示**最新日期**的所有内容（时间、标题、类型、查看详情），旧内容自动进入“历史更新”。

### 4.3 添加公众号文章正文

在穴位文件的 `"wechatArticle"` 里填写 `title`（文章标题）、`summary`（摘要）、`keywords`、`body`（正文，支持 Markdown：`## 小标题`、`- 列表`、`**加粗**`）、`coverTitle`（封面标题）、`coverImageSuggestion`（封面图片建议），`status` 写 `已起草（待审核）` 或 `已审核`。可参考 `zusanli.json`。
没有文章时保持 `"wechatArticle": { "status": "待制作" }`，工作台会显示“待制作”。

### 4.4 标记为已审核

专业老师确认后，在穴位文件中填写：

```json
"reviewer": "真实审核老师姓名",
"reviewDate": "2026-11-20",
"reviewStatus": "已审核",
```

只有真实审核过才能这样写。没有填审核老师和日期却写“已审核”，构建时会报错拦下。

---

## 5. 新增一个穴位（不需要改程序）

1. 复制 `templates/acupoint-template.json` 到 `src/content/acupoints/`，文件名改成穴位拼音，例如 `neiguan.json`（只用小写字母）。
2. 打开文件，把 `id`、`slug` 都改成 `neiguan`（必须与文件名一致），然后逐项填写：名称、别名、拼音、经络、标准定位（照国家标准原文）、通俗说法、简便找法、传统应用、参考资料等。
3. 复制 `templates/article-template.md` 到 `src/content/articles/neiguan.md`，改写成这个穴位的科普文章。
4. 填写六个账号的 `title`、`description`、`keywords`、`hashtags`。
5. 先保持 `"publishStatus": "draft"`（草稿，网站上不显示）。**六组文案全部写好后**，改成 `"published"`。如果标成 published 但文案没写全，网站会自动不显示这个穴位，并在构建时提示缺了什么。
6. 构建后会自动生成：`/xuewei/neiguan/` 公开页面、`/teacher/neiguan/` 工作台页面，并自动加入搜索、穴位列表和站点地图。
7. 有真实照片时：放到 `public/images/acupoints/neiguan/`，在穴位文件的 `images` 里写 `{ "src": "/images/acupoints/neiguan/1.jpg", "alt": "内关穴定位演示（真实拍摄）", "caption": "说明文字" }`。设备演示照片和视频写在 `dopplerDemo` 的 `photos`/`videos` 里。

---

## 6. 常用设置在哪里改

| 想改什么 | 改哪个文件 | 改哪一项 |
| --- | --- | --- |
| 六个账号的名称 | `src/content/accounts/account-settings.json` | 每个账号的 `name`（不要改 `id`） |
| 每日发布时间 | 同上 | `publishTimes`，例如 `["12:30", "20:00"]` |
| 账号排列顺序 | 同上 | `order` |
| 关键词之间的分隔符 | 同上 | `keywordSeparator`（默认 `、`） |
| 意见反馈表单地址 | `src/config/site.json` | `feedback.formUrl`（填腾讯问卷、金数据、飞书表单等地址） |
| 工作群链接 | 同上 | `feedback.groupUrl` |
| 首页“热门穴位” | 同上 | `hotAcupoints`（填穴位拼音文件名） |
| 正式域名 | 同上 | `siteUrl`（例如 `https://www.你的域名.com`） |
| 搜索引擎验证 | 同上 | `seo.googleSiteVerification`、`seo.baiduSiteVerification` |
| ICP 备案号 | 同上 | `icp.number` |
| 设备演示内容和照片 | `src/content/equipment/device.json` | `photos`、`videos`、`materials` 等 |

---

## 7. 上传到 GitHub（保存源代码和修改记录）

GitHub 用来保存网站的所有文件和每一次修改记录，并自动生成网站。**建议建“私有仓库”。**

### 7.1 第一次上传（推荐用 GitHub Desktop，全程点鼠标）

1. 打开 <https://github.com/>，点右上角 **Sign up** 注册账号（已有账号就点 **Sign in** 登录）。
2. 登录后点右上角 **＋** → **New repository**。
3. `Repository name` 填 `shentilidekexue-website`；选择 **Private**（私有）；其他都不要勾选；点最下面绿色按钮 **Create repository**。
4. 下载安装 **GitHub Desktop**：<https://desktop.github.com/>，打开后用 GitHub 账号登录。
5. 在 GitHub Desktop 点菜单 **File → Add local repository…**，选择 `website` 文件夹。如果提示 “This directory does not appear to be a Git repository”，点 **create a repository**，再点 **Create repository**。
6. 左下角 `Summary` 里写“第一次上传”，点 **Commit to main**。
7. 点上方 **Publish repository**，确认勾选 **Keep this code private**，点 **Publish repository**。
8. 回到 GitHub 网页刷新，就能看到所有文件。`node_modules`、`dist` 两个文件夹不会上传（已经设置好自动忽略），这是正常的。

### 7.2 以后在网页上直接修改内容（不用装任何软件）

1. 打开 GitHub 上的仓库 → 依次点进 `src` → `content` → `acupoints` → 某个文件（如 `houxi.json`）。
2. 点右上方的 **铅笔图标（Edit this file）**。
3. 修改文字后，点右上角绿色按钮 **Commit changes…**，在弹窗里写一句说明（例如“修改后溪抖音标题”），再点 **Commit changes**。
4. 新增文件：进入目标文件夹，点 **Add file → Create new file**（新建）或 **Upload files**（上传照片）。
5. 每次提交后，点仓库上方的 **Actions** 标签可以看到“构建网站”的进度：绿色 ✓ 表示成功；红色 ✗ 表示内容有误，点进去看中文错误提示（例如“文件格式错误……少了逗号”），改正后再提交即可。

---

## 8. 部署网站（让外面的人能打开）

网站生成后只是一个 `dist` 文件夹（纯网页文件，不需要数据库），所以可以放到任何地方，以后换服务器也很容易。**GitHub 只负责保存和生成，不建议把 GitHub Pages 当作正式经营网站的托管**（GitHub Pages 官方规定不能主要用于经营性业务，而且中国大陆访问不稳定）。

主要用户在中国大陆，请先决定下面一种方案：

### 方案 A：中国大陆云服务器（访问最快，需 ICP 备案）

适合主要服务大陆的医生和老师。需要：在阿里云/腾讯云等购买服务器或静态网站托管（对象存储 + CDN）；域名完成**实名认证**并办理 **ICP 备案**（一般需要几周，由云服务商协助；备案前请确认域名、主体资料和服务器符合要求）。

### 方案 B：中国香港等境外服务器

一般不需要办理大陆 ICP 备案，但大陆访问速度和稳定性需要**实际测试**，其他适用的法律和网络要求仍需遵守。

### 方案 C：Cloudflare Pages 等静态托管

免费、省事，已预留自动部署配置，但中国大陆访问情况**必须实测**，不能默认稳定。

### 怎么把网站放上去

**办法一：手动上传（最简单）**
1. 在电脑上运行 `npm run build`，得到 `dist` 文件夹；或者在 GitHub 仓库 **Actions** → 最近一次成功的“构建网站” → 页面底部 **Artifacts** 下载 `website-dist` 压缩包并解压。
2. 把 `dist` 里的**全部文件**上传到服务器的网站根目录（例如宝塔面板：网站 → 根目录 → 上传）。
3. 服务器（Nginx）设置要点（请技术人员配置）：
   ```nginx
   server {
     listen 80;
     server_name 你的域名.com www.你的域名.com;
     root /www/wwwroot/shentilidekexue;   # 放 dist 文件的位置
     index index.html;
     error_page 404 /404.html;
     location / { try_files $uri $uri/ =404; }
     location /teacher/ { add_header X-Robots-Tag "noindex, nofollow"; try_files $uri $uri/ =404; }
   }
   ```

**办法二：提交到 GitHub 后自动部署**
在 GitHub 仓库点 **Settings → Secrets and variables → Actions**：
- 在 **Variables** 标签点 **New repository variable**，新建 `DEPLOY_TARGET`：
  - 自己的服务器（方案 A/B）：值填 `server`；再新建变量 `SERVER_PATH`（服务器网站目录，如 `/www/wwwroot/shentilidekexue`），如端口不是 22 再建 `SSH_PORT`；然后在 **Secrets** 标签新建 `SSH_HOST`（服务器 IP）、`SSH_USER`（登录用户名）、`SSH_PRIVATE_KEY`（部署用的 SSH 私钥，请技术人员生成，不要用个人主密码）。
  - Cloudflare Pages（方案 C）：值填 `cloudflare`；再新建变量 `CLOUDFLARE_PROJECT_NAME`，Secrets 新建 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。
  - 仅测试预览用 GitHub Pages：值填 `github-pages-test`，并在 **Settings → Pages → Source** 选 **GitHub Actions**。测试地址形如 `https://用户名.github.io/仓库名/`，需要再新建变量 `BASE_PATH`，值为 `/仓库名/`。（注意：私有仓库使用 Pages 可能需要付费账户。）
- 同时新建变量 `SITE_URL`，值为正式网址（如 `https://www.你的域名.com`）。
- 设置好后，每次提交修改，网站会自动更新。不设置 `DEPLOY_TARGET` 时只生成、不部署。

> 提醒：只有真正完成部署、并能用手机（包括微信内打开）正常访问后，才算网站上线。

---

## 9. 购买和绑定自己的域名

1. 在阿里云、腾讯云等域名服务商购买域名（建议 `.com` 或 `.cn`），完成实名认证。用大陆服务器还需办理 ICP 备案。
2. 在域名服务商的“DNS 解析”里添加记录（具体数值由托管平台提供）：
   - 根域名（`@`）：类型 `A`，值为服务器 IP；
   - `www`：类型 `A` 填同一 IP，或类型 `CNAME` 指向托管平台给的地址。
3. 开启 HTTPS：服务器上申请免费 SSL 证书（宝塔面板：网站 → 设置 → SSL → Let's Encrypt），并打开“强制 HTTPS”。Cloudflare Pages 会自动提供证书。
4. 选定一个主网址（建议 `https://www.你的域名.com`），另一个设置跳转到主网址。
5. 打开 `src/config/site.json`，把 `siteUrl` 改为主网址（或在 GitHub 变量 `SITE_URL` 中填写），重新构建。这样规范网址、分享链接和站点地图才会使用正式域名。
6. 以后换服务器，只要把 `dist` 放到新服务器、把域名解析改过去，所有网址保持不变。

---

## 10. 提交到搜索引擎

网站正式上线、绑定域名之后：
1. **百度搜索资源平台** <https://ziyuan.baidu.com/>：登录 → 用户中心 → 站点管理 → 添加网站 → 验证方式选“HTML 标签验证”，复制 `content="..."` 里的字符，填到 `site.json` 的 `seo.baiduSiteVerification`，重新构建发布后点“完成验证”。之后在“普通收录 → sitemap”提交 `https://你的域名/sitemap.xml`。
2. **Google Search Console** <https://search.google.com/search-console>：添加资源 → 网址前缀 → 验证方式选“HTML 标记”，同样把字符填到 `seo.googleSiteVerification`。验证后在“站点地图”提交 `sitemap.xml`。
3. 搜索引擎收录需要时间，不能保证上线后马上有流量；坚持更新真实、有价值的内容最重要。

---

## 11. 数据备份

- **GitHub 本身就是备份**：每次修改都有记录，可以随时查看和恢复旧版本（在文件页面点 **History**）。
- **定期下载完整备份**（建议每月一次）：GitHub 仓库首页 → 绿色 **Code** 按钮 → **Download ZIP**，保存到电脑和网盘/移动硬盘。
- **照片和视频原始文件**单独保存在网盘或移动硬盘中（网站里只放压缩后的版本或视频平台链接）。
- 所有内容都是普通文字文件（JSON/Markdown），即使以后换网站系统，也能直接迁移。

---

## 12. 需要负责人提供的素材和决定

| 事项 | 用在哪里 | 状态 |
| --- | --- | --- |
| 皮门多普勒设备真实照片（整体、正面、探头、使用中） | 设备演示专区、穴位页定位演示区 | 待提供（网站不使用 AI 生成或来源不明的设备图） |
| 设备技术原理、检测能力和适用范围的正式说明 | 设备演示专区 | 待研发/技术人员确认 |
| 多普勒提示音演示视频/录音、各穴位定位演示视频 | 设备演示、穴位页 | 待拍摄 |
| 经审核的穴位照片或人体示意图（含授权） | 穴位详情页 | 待提供 |
| 6 个穴位知识内容的专业审核（审核老师姓名、日期） | 穴位详情页审核信息 | 待审核 |
| 36 组发布文案的人工确认 | 老师工作台 | 待确认 |
| 内容作者署名（真实姓名） | 穴位详情页 | 待填写 |
| 参考教材的具体版次和页码 | 参考资料 | 待审核老师补充 |
| 意见反馈表单地址或工作群链接 | 意见反馈页 | 待提供（目前显示可复制的反馈模板） |
| 六个账号的正式名称（如需修改）、设备演示账号和学习记录账号的发布时间 | 老师工作台 | 可随时修改 |
| 每日视频的拍摄老师姓名 | 今日学习、历史更新 | 待填写 |
| 托管方案（大陆服务器 / 香港服务器 / 其他）与 ICP 备案安排 | 部署 | 待决定 |
| 正式域名 | SEO、分享链接 | 待购买 |
| GitHub 账号和仓库 | 保存代码、自动构建 | 待创建 |
| 团队老师介绍（真实资料） | 关于我们 | 待提供 |

---

## 13. 内容合规提醒（发布前请对照）

- 穴位定位、经络归属、传统应用以国家标准和教材为依据；传统理论中的“主治”不能写成现代医学已证实的疗效，不写“治好”“根治”等字眼。
- 设备演示只描述真实操作过程（探头探测、观察信号变化和提示音、做定位标记），不说“百分之百精准”“证明穴位存在”“能治病”。
- 不虚构医生资质、专家身份、机构背景；不把培训结业说成执业资格。
- 只使用真实拍摄、已获授权的图片和视频；不展示患者隐私。
- 老师工作台虽然不被搜索引擎收录，但**没有密码保护**，任何拿到链接的人都能看到，不要放敏感内容。
- 三阴交相关内容请保留“孕期慎用/孕妇禁针”的提示。

---

## 14. 常见问题

**构建时出现“❌ 错误：文件格式错误”**：多半是 JSON 少了逗号、多了逗号或引号不成对。按提示找到对应文件，用 VS Code 打开会有红色波浪线提示位置。

**新加的穴位网站上看不到**：检查 `publishStatus` 是否为 `published`，六组文案是否都写了标题、描述和关键词（构建时会有“⚠️ 提醒”说明缺什么）。

**手机微信里点复制没反应**：会自动弹出手动复制框；也可以直接长按文字选择复制。网站正式使用 HTTPS 后，复制会更顺畅。

**首页“今日更新”显示的是前几天的内容**：首页显示最新日期的内容；如果当天没有新增 `learning` 文件，就会显示“最近更新”。

---

## 15. 技术信息（给技术人员）

- 技术栈：Astro 7 + TypeScript，纯静态输出（`dist/`），无数据库、无服务器端程序。需要 Node.js ≥ 22.23（推荐 24）。
- 命令：`npm install`、`npm run dev`、`npm run build`（含内容检查 `scripts/check-content.mjs`）、`npm run preview`、`npm test`（`scripts/test-dist.mjs`：SEO、noindex、站点地图、六组文案对齐、搜索、复制、手动复制备用、手机布局检查，需 Chrome）。
- 六账号文案的拼接逻辑在 `src/lib/copy-core.mjs`，页面和测试共用，以 `accountId` 对齐。
- 搜索为前端本地搜索（索引在构建时生成并嵌入页面），支持中文名、别名、部分关键词、拼音全拼/首字母、经络、历史内容。
- 环境变量：`SITE_URL`（正式网址）、`BASE_PATH`（部署在子目录时使用）。
- 没有接入任何统计或第三方脚本。
