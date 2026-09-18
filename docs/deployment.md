# 部署与维护

默认采用与 quatre-vingt 相同的切分：GitHub 存源码，Vercel 挂前端并可绑定国内域名，Render 跑 API 与 SQLite。四个人改行程和账本，读写的是 Render 上那一份库，不是 Git。

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
```

4. Health Check Path: `/health`
5. 记下 URL，例如 `https://trip-together-backend.onrender.com`

仓库根目录的 `render.yaml` 可导入同样配置。`ALLOWED_ORIGINS` 必须包含 Vercel 域名和之后绑定的国内域名，否则浏览器会拦截登录请求。

## 2. 防止休眠

Render 免费实例约 15 分钟无访问会休眠。与八十分相同，用 UptimeRobot：

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
5. Domains 里添加阿里云域名。阿里云解析添加 CNAME 到 Vercel 给出的目标。再把 `https://www.your-domain.com` 写入 `ALLOWED_ORIGINS`。

## 4. 数据落在哪里

- 账号、行程、账本：Render 进程目录下的 `data/trip.db`（SQLite）
- 资料和凭证：`data/files/`
- 源码：GitHub
- 页面：Vercel

这与 quatre-vingt 的 `game.db` 在 Render 上是同一类做法。UptimeRobot 保活时数据会一直在；**重新部署 Web Service 可能清空磁盘**，填好行程后不要频繁点 Manual Deploy。

## 5. 使用

四人分别用邮箱注册（默认不发验证码），创建者建行程后生成 6 位口令，其余人加入。不要把护照扫描上传到资料库以外的公开位置。
