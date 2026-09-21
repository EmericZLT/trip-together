# 部署与维护

TripTogether 把源码放在 GitHub，把页面放在 Vercel，把 API 和数据放在 Render。账号、行程和账本写在 Render 上的 SQLite 里，多人同时修改的是这一份库，不是 Git 仓库。

## 1. 后端 Render

1. 打开 https://dashboard.render.com ，New → Web Service，连接 `EmericZLT/trip-together`。
2. 设置：
   - Name: `trip-together-backend`
   - Language: Node
   - Branch: `main`
   - Region: Oregon (US West)
   - Build Command: `npm ci`
   - Start Command: `npm start`
   - Instance: Free
3. 环境变量：

```
NODE_VERSION=22
APP_ENV=production
SKIP_EMAIL_VERIFICATION=true
DATA_DIR=./data
SESSION_SIGNING_KEY=至少32个随机字符
ALLOWED_ORIGINS=https://your-app.vercel.app,https://www.your-domain.com
SEED_TOKEN=随机长字符串，仅用于一次性写入行程
```

4. Health Check Path: `/health`
5. 记下 URL，例如 `https://trip-together-backend.onrender.com`

仓库根目录的 `render.yaml` 可导入同样配置。`ALLOWED_ORIGINS` 必须包含 Vercel 域名以及之后绑定的自定义域名，否则浏览器会拦截登录请求。

## 2. 防止休眠

Render 免费实例约 15 分钟无访问会休眠。使用 UptimeRobot 保持进程在线：

- URL: `https://trip-together-backend.onrender.com/health`
- 间隔: 5 分钟
- 协议: HTTP

## 3. 前端 Vercel

1. 打开 https://vercel.com ，导入同一 GitHub 仓库。
2. Root Directory 留空（仓库根目录）。构建使用根目录 `vercel.json`：`npm run build`，产物 `web/out`。
3. 环境变量：

```
NEXT_PUBLIC_API_URL=https://trip-together-backend.onrender.com
```

4. 部署完成后会得到 `xxx.vercel.app`。把该地址补进 Render 的 `ALLOWED_ORIGINS` 后手动 Redeploy 一次后端。
5. 若要使用自己的域名，在 Vercel Domains 中添加，并在域名服务商处把记录 CNAME 到 Vercel 给出的目标。然后将 `https://www.your-domain.com` 写入 `ALLOWED_ORIGINS`。

## 4. 数据落在哪里

- 账号、行程、账本：Render 进程目录下的 `data/trip.db`（SQLite）
- 资料和凭证：`data/files/`
- 源码：GitHub
- 页面：Vercel

UptimeRobot 保活时数据会一直在；**重新部署 Web Service 可能清空磁盘**，填好行程后不要频繁点 Manual Deploy。

## 5. 使用

本地或 Render 启动后，用 `npm run seed`（或带 `SEED_TOKEN` 的 `/api/setup/seed`）写入四人账号和南北岛行程。创建者登录账本预填已垫付费用。成员用告知的用户名和初始密码登录，在「我的」修改密码。不要把护照扫描上传到公开位置。
