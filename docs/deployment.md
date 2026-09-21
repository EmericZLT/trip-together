# 部署与维护

源码走 GitHub。页面走 Vercel。账号、行程、账本、上传文件走 Render 上的一份 SQLite 和磁盘。

GitHub **不会**包含 `data/`（库文件、凭证、账号 JSON）。要给四人实际使用，必须把本机 `data/` 拷到 Render 的持久盘，不要只靠 `npm run seed`。`seed` 只会按模板重建账号/行程，盖不住你已经在前端改过的活动和账本。

## 1. 后端 Render

需要 **Starter**（约 $7/月）并挂持久盘。免费实例没有持久盘，重新部署会丢库，不适合这次旅行。

1. 打开 https://dashboard.render.com ，New → Blueprint，连接 `EmericZLT/trip-together`，使用仓库里的 `render.yaml`。或 New → Web Service，手动填写：
   - Name: `trip-together-backend`
   - Language: Node
   - Branch: `main`
   - Region: Oregon (US West)
   - Instance: **Starter**
   - Build Command: `npm ci`
   - Start Command: `npm start`
   - Health Check Path: `/health`
2. Disk：Name `trip-data`，Mount Path `/data`，大小 1 GB。
3. 环境变量：

```
NODE_VERSION=22
APP_ENV=production
SKIP_EMAIL_VERIFICATION=true
DATA_DIR=/data
SESSION_SIGNING_KEY=至少32个随机字符（生成后不要再改）
ALLOWED_ORIGINS=https://你的项目.vercel.app,https://www.你的域名.com
SEED_TOKEN=随机长字符串（仅应急，导入真实库之后不要再打 seed）
```

4. 记下 URL，例如 `https://trip-together-backend.onrender.com`。
5. 在服务页打开 Shell / SSH，后面拷库要用。

`ALLOWED_ORIGINS` 必须包含 Vercel 默认域名和国内自定义域名（有 `www` 就写带 `www` 的，两者都用就都写），否则浏览器会拦登录。改环境变量后点 Manual Deploy。

## 2. 把本机数据拷到 Render

在**本机**项目根目录（先停一下账本写入，避免拷到一半的 WAL）：

```bash
sqlite3 data/trip.db "PRAGMA wal_checkpoint(FULL);"
tar czf /tmp/trip-together-data.tgz -C data trip.db files
ls -lh /tmp/trip-together-data.tgz
```

在 Render 服务的 Shell 里（磁盘已挂到 `/data`）：

```bash
mkdir -p /data
# 把 /tmp/trip-together-data.tgz 用 SCP 传到实例后再解压，例如：
# 本机执行：
#   scp /tmp/trip-together-data.tgz <render-ssh-host>:/data/trip-together-data.tgz
cd /data
tar xzf trip-together-data.tgz
ls -l trip.db files
rm trip-together-data.tgz
```

SCP 目标以 Dashboard → SSH 页给出的命令为准，一般是：

```bash
scp /tmp/trip-together-data.tgz SERVICE_NAME@ssh.oregon.render.com:/data/trip-together-data.tgz
```

解压后在 Dashboard 点 Restart。不要再运行 seed。用创建者账号登录，核对行程、账本、资料是否与本机一致。

`SESSION_SIGNING_KEY` 与本机 `.env` 可以不同；不同则旧 cookie 失效，重新登录即可。密码哈希在库里，账号不用重造。

## 3. 防止休眠

Starter 默认不因闲置关机。仍建议探活，部署失败能早点发现：

- 打开 https://uptimerobot.com
- 监控类型 HTTP(s)
- URL: `https://trip-together-backend.onrender.com/health`
- 间隔: 5 分钟
- 期望状态码: 200
- 可选再加一条：国内域名首页 `https://www.你的域名.com`

## 4. 前端 Vercel

1. 打开 https://vercel.com ，导入同一 GitHub 仓库。
2. Root Directory 留空。构建用根目录 `vercel.json`：`npm run build`，产物 `web/out`。
3. 环境变量（Production）：

```
NEXT_PUBLIC_API_URL=https://trip-together-backend.onrender.com
```

改过 `NEXT_PUBLIC_API_URL` 必须重新部署前端，它会打进静态页面。
4. 得到 `xxx.vercel.app` 后，把它写进 Render 的 `ALLOWED_ORIGINS`，再 Redeploy 后端。

## 5. 国内域名

页面绑在 Vercel，不要把国内域名指到 Render（API 继续用 `*.onrender.com`）。

1. Vercel → Project → Settings → Domains → 添加 `www.你的域名.com`（以及需要的根域名）。
2. 按 Vercel 提示，在阿里云 / 腾讯云 / Cloudflare DNS：
   - 推荐：`www` 的 CNAME 指向 Vercel 给的 `cname.vercel-dns.com`（以控制台显示为准）
   - 根域名 `@` 用 A 记录（Vercel 会给出 IP）或 ALIAS/ANAME
3. SSL 由 Vercel 自动签发，等到 Domains 显示 Valid。
4. 把 `https://www.你的域名.com` 追加到 Render `ALLOWED_ORIGINS`（不要漏 `https://`，不要末尾斜杠），Redeploy 后端。
5. 用国内域名打开网站，登录一次。不要用 `http://`。

`.cn` 域名在国内解析到海外主机通常要备案，且可能无法指向 Vercel。个人旅行站点更稳妥的是已备案或可境外解析的 `.com` / `.net`。域名只改入口，不能把 Render 变成国内机房，大陆访问仍可能偏慢。

## 6. 数据落在哪里

| 内容 | 位置 |
| --- | --- |
| 账号、行程、账本 | Render 持久盘 `/data/trip.db` |
| 资料和凭证 | `/data/files/` |
| 源码 | GitHub |
| 页面 | Vercel |

之后改代码：照常 `git push`，Render / Vercel 会自动部署。**只要不删 Disk，库不会丢。** 不要在已经导入真实库之后对 Render 跑 seed，也不要改 `DATA_DIR`。

## 7. 使用注意

成员用现有用户名和密码登录，在「我的」修改密码。不要把护照扫描上传到公开位置。
