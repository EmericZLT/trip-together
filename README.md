# TripTogether · 同行

开源、可自行部署的多人旅行规划工具。用户注册后创建行程，邀请同行人，共同维护航班、住宿、活动、资料与账本。默认数据库为空，没有预设成员、示例账号或私人行程。

Next.js static export + React + Tailwind CSS。默认部署切分与 quatre-vingt 相同：前端 Vercel（可绑国内域名），后端 Render，SQLite 与上传文件落在 Render 磁盘，UptimeRobot 访问 `/health` 防止休眠。界面遵循 [DESIGN.md](DESIGN.md)。

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm ci
cp .env.example .env
# 把 SESSION_SIGNING_KEY 改成至少 32 个字符
npm run dev:backend
```

另开终端：

```bash
NEXT_PUBLIC_API_URL=http://localhost:8790 npm run dev:web
```

打开 http://localhost:3000。后端 http://localhost:8790/health。首次启动会在 `data/` 创建空白 SQLite。

## 写入本次南北岛行程与四人账号

账本没有单独的「管理员开关」。创建者把四人都加入同一行程后，用自己的账号打开账本，就可以预填机票、租车、活动等已垫付款；付款人选实际出钱的人，分摊勾选四人。成员之后在「我的」修改密码即可。

不要把真实邮箱和密码提交到 Git。`data/` 已被忽略。

```bash
mkdir -p data
cp scripts/seed-members.example.json data/seed-members.json
# 编辑四人邮箱、至少 10 位的初始密码、姓名；仅一名 owner: true
npm run seed
```

可选：复制 `scripts/seed-expenses.example.json` 为 `data/seed-expenses.json`。金额单位是分，例如 `1280000` 表示 12800.00 元。不确定的费用不要写进文件，登录后在账本里填更合适。

重复运行会更新行程事项，不会覆盖已有账本（除非你在费用文件里新增）。若要重置初始密码，使用 `npm run seed -- --reset-passwords`。

Render 上线后可用一次性接口（需设置环境变量 `SEED_TOKEN`）：

```bash
curl -X POST https://your-service.onrender.com/api/setup/seed \
  -H "content-type: application/json" \
  -H "x-seed-token: $SEED_TOKEN" \
  -d @data/seed-members.json
```

若把成员写在 JSON 文件根级数组，请改成 `{"members":[...],"expenses":[]}` 再 POST。

## 使用流程

1. 使用邮箱和密码注册，不要求填写昵称。登录只需邮箱和密码。默认关闭邮箱验证码（`SKIP_EMAIL_VERIFICATION=true`），便于四人内部分享。注册后进入首页，即使没有行程也可以自由使用底部导航和个人资料。
2. 通过首页引导或“我的 → 我的行程”创建、加入行程，管理页面可以返回。创建时填写名称、日期、目的地和常用时区、两种币种；在“我的”页面切换当前行程，并按账号记住选择。
3. 在“我的行程”中点击具体行程管理设置、生成同行邀请口令或删除。管理其他行程不会自动切换当前行程。口令为 6 位大写字母，不包含 I/O，每个行程一个且不重复；再次打开管理页会显示已有有效口令。同行人注册后输入口令加入，大小写均可。口令 7 天有效，主动重新生成或确认撤销邀请会使旧口令失效。
4. 在“完整行程”添加航班、自驾、住宿、活动或接驳事项。填写当地日期时间、时区、真实起终点、来源、提醒及关联文件。跨时区事项支持分别设置开始和结束时区。首页自动显示当前或下一事项及倒计时。
5. 在“旅行资料”上传图片或 PDF，选择分类和“仅本人可见”。共享文件可以关联事项；个人证件在“我的”上传，仅本人可以读取。
6. 在“完整行程 → 出发前”添加准备事项，每位成员独立勾选。
7. 在账本添加支出，选择实际付款人和分摊成员，可上传凭证。支持同行成员修改、删除支出和导出 CSV。
8. 在“我的”编辑昵称、英文姓名、证件信息和头像，修改密码，进入行程管理。个人证件可以在没有行程时上传与查看。

重新录入既有旅行时，按照以上流程注册同行账号、建立行程、上传原始资料、填写所有事项与费用，即可获得票券首页、每日安排、文件查看、个人证件与分摊账本的完整展示，不需要修改源码。

## 权限与数据

- 用户账号独立于行程。`trips` 和 `trip_members` 管理所属关系；事项、清单、支出、旅行文件均关联 `trip_id`。
- 同行成员可以共同编辑行程内容和账本。创建者负责行程设置、邀请和删除整个行程。删除操作必须确认。
- 个人证件与证件号码仅本人可见；其他成员只能看到姓名、英文姓名与头像。即使知道文件 ID，也需要通过权限检查。
- 上传文件保存在后端私有目录，经登录会话校验后读取，不作为公开静态资源。
- 密码使用独立随机 salt 与 PBKDF2，session 仅保存 hash。重置密码和修改密码会撤销旧会话。
- 费用使用整数分，按币种独立统计；分摊余数确定分配。支持 CNY、NZD、USD、EUR、GBP、AUD、CAD、SGD、HKD，不自动换汇。
- 事项时间按 IANA 时区显示；夏令时不存在的当地时间会拒绝，重复时间需要指定 UTC 偏移。设备位置仅从 Geolocation 获取坐标后查询，失败显示未定位。
- 上传仅允许 JPG、PNG、WebP、PDF，服务端检查文件头，单份最多 10 MB；每笔支出最多 5 份凭证。

## 验证

```bash
npm run verify
npm run deploy:check
```

`verify` 执行类型检查、构建，并启动独立临时 Wrangler D1/R2，运行 API、领域逻辑、Chromium 与 WebKit 测试，结束后清理测试存储。测试使用自动生成的虚构账号和内容，不读取开发或生产数据。首次运行浏览器测试可能需要 `npx playwright install chromium webkit`。

API 测试覆盖邮箱注册、验证码、密码重置、旧账号绑定邮箱、CSRF、注销、跨行程隔离、文件权限、完整录入、并发修改和超过六人的分摊。截图和失败 trace 位于 `.local/`。

## 部署

详见 [部署与维护](docs/deployment.md)。推荐与 quatre-vingt 相同：

1. GitHub 推送本仓库
2. Render 部署后端 Web Service（Oregon、Free），健康检查 `/health`
3. UptimeRobot 每 5 分钟请求 `https://your-service.onrender.com/health`
4. Vercel 部署前端，环境变量 `NEXT_PUBLIC_API_URL` 指向 Render
5. 阿里云域名 CNAME 到 Vercel；Render 的 `ALLOWED_ORIGINS` 写上该域名和 `*.vercel.app`

仓库不含真实账号或行程数据。Render 免费磁盘在重新部署后可能被清空，行程填好后避免无意义的重复 Deploy。

## 产品统计

可选接入 OpenPanel，默认关闭。本地不向生产分析实例发送。业务总量包含历史数据，行为事件通过持久队列发送；看板默认私有。指标口径、实例配置和看板方案（平台创建接口限制见说明）见 [产品指标与 OpenPanel](docs/analytics.md)。

## 源码归档

如果当前 Git 历史曾包含真实旅行资料，不要直接公开现有仓库或分支。完成并提交所有修改后执行：

```bash
npm run export:source
```

该命令从当前提交导出 `release/trip-together-source.tar.gz`，不包含 `.git` 历史、忽略目录、数据库、密钥、上传文件或本地私人原件。可以解压后新建独立公开仓库。导出前运行 `npm run audit:source`，并检查输出内容；自动检查不是对历史中所有可能隐私内容的完整审计。

采用 [MIT License](LICENSE)。
