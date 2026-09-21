# TripTogether · 同行

开源、可自行部署的多人旅行规划工具。用户注册后创建行程，邀请同行人，共同维护航班、住宿、活动、资料与账本。默认数据库为空，没有预设成员、示例账号或私人行程。

前端为 Next.js 静态导出，界面规范见 [DESIGN.md](DESIGN.md)。后端为 Node 服务：账号、行程和账本写入 SQLite，资料文件存于服务器私有目录。推荐部署方式是前端放在 Vercel，后端放在 Render，并用 UptimeRobot 访问 `/health` 避免免费实例休眠。自定义域名解析到 Vercel 即可。

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm ci
cp .env.example .env
# 把 SESSION_SIGNING_KEY 改成至少 32 个字符
npm run dev
```

一条命令会同时启动页面和 API，改前端或后端代码后会自动重载。打开 http://localhost:3000；后端健康检查为 http://localhost:8790/health。首次启动会在 `data/` 创建空白 SQLite。

也可以分两个终端手动启动：`npm run dev:backend`，以及 `NEXT_PUBLIC_API_URL=http://localhost:8790 npm run dev:web`。

## 写入本次南北岛行程与四人账号

账本没有单独的「管理员开关」。创建者把四人都加入同一行程后，用自己的账号打开账本，就可以预填机票、租车、活动等已垫付款；付款人选实际出钱的人，分摊勾选四人。成员之后在「我的」修改密码即可。

不要把真实用户名和密码提交到 Git。`data/` 已被忽略。

```bash
mkdir -p data
cp scripts/seed-members.example.json data/seed-members.json
# 编辑四人用户名、密码和姓名；仅一名 owner: true
npm run seed
```

可选：复制 `scripts/seed-expenses.example.json` 为 `data/seed-expenses.json`。金额单位是分，例如 `1280000` 表示 12800.00 元。不确定的费用不要写进文件，登录后在账本里填更合适。

重复运行会更新成员姓名，不会覆盖已有行程事项或账本（除非你在费用文件里新增）。前端里改过、删过的活动会留在数据库里。若要按 `nz-itinerary.ts` 重建行程，使用 `npm run seed -- --reset-itinerary`。若要重置初始密码，使用 `npm run seed -- --reset-passwords`。

Render 上线后可用一次性接口（需设置环境变量 `SEED_TOKEN`）：

```bash
curl -X POST https://your-service.onrender.com/api/setup/seed \
  -H "content-type: application/json" \
  -H "x-seed-token: $SEED_TOKEN" \
  -d @data/seed-members.json
```

成员 JSON 可以是数组，也可以是 `{"members":[...],"expenses":[]}`。

## 使用流程

1. 使用用户名和密码注册，不要求填写昵称。登录只需用户名和密码。默认关闭邮箱验证码（`SKIP_EMAIL_VERIFICATION=true`），便于四人内部分享。注册后进入首页，即使没有行程也可以自由使用底部导航和个人资料。
2. 通过首页引导或“我的 → 我的行程”创建、加入行程，管理页面可以返回。创建时填写名称、日期、目的地和常用时区、两种币种；在“我的”页面切换当前行程，并按账号记住选择。
3. 在“我的行程”中点击具体行程管理设置、生成同行邀请口令或删除。管理其他行程不会自动切换当前行程。口令为 6 位大写字母，不包含 I/O，每个行程一个且不重复；再次打开管理页会显示已有有效口令。同行人注册后输入口令加入，大小写均可。口令 7 天有效，主动重新生成或确认撤销邀请会使旧口令失效。
4. 在“完整行程”添加航班、自驾、住宿、活动或接驳事项。填写当地日期时间、时区、真实起终点、来源、提醒及关联文件。跨时区事项支持分别设置开始和结束时区。首页自动显示当前或下一事项及倒计时。
5. 在“旅行资料”上传机票、酒店、租车等行程文件，选择分类和“仅本人可见”。共享文件可以关联事项。请勿上传护照、签证、身份证等私人原件。
6. 在“完整行程 → 出发前”添加准备事项，每位成员独立勾选。
7. 在账本添加支出，选择实际付款人和分摊成员，可上传消费凭证（不要上传证件）。支持同行成员修改、删除支出和导出 CSV。
8. 在“我的”编辑昵称、英文姓名和头像，修改密码，进入行程管理。证件号码可以不填；文件区也不要上传护照扫描。

重新录入既有旅行时，按照以上流程注册同行账号、建立行程、上传原始资料、填写所有事项与费用，即可获得票券首页、每日安排、文件查看、个人证件与分摊账本的完整展示，不需要修改源码。

## 权限与数据

- 用户账号独立于行程。`trips` 和 `trip_members` 管理所属关系；事项、清单、支出、旅行文件均关联 `trip_id`。
- 同行成员可以共同编辑行程内容和账本。创建者负责行程设置、邀请和删除整个行程。删除操作必须确认。
- 个人证件与证件号码仅本人可见；其他成员只能看到姓名、英文姓名与头像。即使知道文件 ID，也需要通过权限检查。界面会提示不要上传护照等私人原件。
- 上传文件保存在后端私有目录，经登录会话校验后读取，不作为公开静态资源。
- 密码使用独立随机 salt 与 PBKDF2，session 仅保存 hash。重置密码和修改密码会撤销旧会话。
- 费用使用整数分。记账可选新西兰元、美元或人民币；结算按默认汇率折成人民币（1 新西兰元 = 4 人民币，1 美元 = 6.8 人民币，可在账本页修改）。分摊余数确定分配。
- 事项时间按 IANA 时区显示；夏令时不存在的当地时间会拒绝，重复时间需要指定 UTC 偏移。设备位置仅从 Geolocation 获取坐标后查询，失败显示未定位。
- 上传仅允许 JPG、PNG、WebP、PDF，服务端检查文件头，单份最多 10 MB；每笔支出最多 5 份凭证。

## 验证

```bash
npm run verify
npm run deploy:check
```

`verify` 执行类型检查与前端构建。仓库仍保留针对原 Cloudflare Worker 路径的测试；当前默认运行方式是 `npm run dev:backend` 与 `npm run seed`。浏览器测试可能需要先执行 `npx playwright install chromium webkit`。

API 测试覆盖邮箱注册、验证码、密码重置、旧账号绑定邮箱、CSRF、注销、跨行程隔离、文件权限、完整录入、并发修改和超过六人的分摊。截图和失败 trace 位于 `.local/`。

## 部署

详见 [部署与维护](docs/deployment.md)。推荐步骤：

1. 将本仓库推送到 GitHub
2. 在 Render 用 Starter + 持久盘 `/data` 部署 Web Service，健康检查路径为 `/health`
3. 把本机 `data/trip.db` 和 `data/files` 拷到 Render 磁盘（不要只跑 seed）
4. 用 UptimeRobot 每 5 分钟请求 `https://your-service.onrender.com/health`
5. 在 Vercel 部署前端，环境变量 `NEXT_PUBLIC_API_URL` 指向 Render 地址
6. 国内域名绑到 Vercel，并把该域名写入 Render 的 `ALLOWED_ORIGINS`

GitHub 不含真实账号和行程库。真实数据只存在 Render 磁盘上。

## 产品统计

可选接入 OpenPanel，默认关闭。本地不向生产分析实例发送。业务总量包含历史数据，行为事件通过持久队列发送；看板默认私有。指标口径、实例配置和看板方案（平台创建接口限制见说明）见 [产品指标与 OpenPanel](docs/analytics.md)。

## 源码归档

如果当前 Git 历史曾包含真实旅行资料，不要直接公开现有仓库或分支。完成并提交所有修改后执行：

```bash
npm run export:source
```

该命令从当前提交导出 `release/trip-together-source.tar.gz`，不包含 `.git` 历史、忽略目录、数据库、密钥、上传文件或本地私人原件。可以解压后新建独立公开仓库。导出前运行 `npm run audit:source`，并检查输出内容；自动检查不是对历史中所有可能隐私内容的完整审计。

采用 [MIT License](LICENSE)。
