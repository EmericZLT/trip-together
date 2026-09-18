# 产品指标与 Umami

## 指标口径

| 指标 | 定义 | 包含历史数据 |
|---|---|---|
| 用户数 | 当前注册账号数 | 是 |
| 邮箱验证用户数 | 邮箱验证时间非空的账号数，不是验证码发送次数 | 是 |
| 创建行程用户数 | 当前仍有自己创建行程的账号去重 | 是 |
| 行程事项数 | 航班、住宿、交通、游玩等全部事项 | 是 |
| 游玩活动数 | 事项类型为 explore | 是 |
| 多人行程数 | 至少两名不同成员实际加入的行程 | 是 |
| 有安排的行程 | 至少有一个事项的行程数 | 是 |
| 参与行程用户 | 创建或加入行程的账号去重 | 是 |
| 资料 / 支出数 | 行程资料数、支出记录数，不读取文件或金额 | 是 |
| 活跃账号 | 最近 24 小时、7 天、30 天有页面浏览或成功业务操作的登录账号去重 | 仅采集启用后 |
| 创建行程率 | 创建行程用户 / 注册用户 | 是 |
| 邮箱验证率 | 验证用户 / 注册用户 | 是 |
| 多人行程占比 | 多人行程 / 全部行程 | 是 |

总量由 D1 查询，删除资料或行程后相应当前总量会减少。新增趋势来自 Umami，不会因为删除业务数据而减少。旧账号和事项缺少可靠创建时间，不进行历史事件回填。Umami visitors、visits 均不能代替账号总量。

## 事件

| 事件 | 触发时机 / 属性 |
|---|---|
| account_registered | 注册记录首次写入 |
| email_verified | 首次具有已验证邮箱 |
| session_started | 成功建立登录会话，包括注册自动登录 |
| trip_created | 新建行程成功 |
| trip_joined | 实际新增非创建人的成员关系，重复加入不重复记录 |
| trip_became_multiplayer | 首次加入第二名成员 |
| event_created | 新增事项成功；kind 类型 |
| document_uploaded | 新增行程资料成功；visibility 与 image/pdf 分类 |
| expense_created | 记账成功，不发送金额或币种 |
| page_viewed | 预定义页面打开，发送为 Umami pageview |
| event_form_opened | 打开事项编辑 |
| event_step_viewed | 浏览事项步骤；step 1–4 |
| document_upload_started | 开始上传一批资料 |

业务事件通过 D1 触发器与业务写入同事务记录；上传重试、重复加入不会重复产生业务创建事件。业务记录保留当前权限校验。浏览事件只接受白名单字段，限制请求频率；匿名访问不计入活跃账号。本地不向 Umami 发送。浏览端尊重 DNT，也可用 `localStorage.setItem('analytics-disabled','true')` 停止当前浏览器的浏览行为采集；业务数据库计数不因此消失。

不采集邮箱、姓名、地址、行程标题、资料名称、金额、搜索词、邀请码、原始 URL、IP 或文件内容。账号及业务实体通过独立 HMAC 密钥匿名化后发送。只发送固定虚拟页面路径。发送端使用服务 UA，不转发用户 UA/IP，因此不应使用本网站 Umami 的地域和设备报表分析真实用户来源。页面访问会有网络来源，但这里不转发给 Umami。

## 看板设计

使用 Umami 3.1+ 的私有 Website Board（实际 API 兼容性仍需连接实例验证），不创建公开分享链接：

1. 顶部「当前产品总量」：D1 当前数据的文本快照，包含五项核心指标、活跃用户和转化比例；标注更新时间，不受 Umami 日期筛选影响。
2. 「新增行为趋势」：自开始采集后的事件变化。
3. 8 个目标：注册、邮箱验证、创建、加入、多人形成、事项、资料、记账。
4. 「功能使用分布」及统计口径说明。

快照每小时更新一次；事件每 5 分钟最多发送 50 条，10 条并发。总量与增长趋势分开展示，不能把每天总量快照相加。Umami 目标的访客转化口径以 Umami 为准；账号创建行程率使用顶部 D1 结果。

## 配置

默认 `ANALYTICS_ENABLED=false`。配置缺失不会影响用户操作。先在 Umami 创建独立网站，再复制 `scripts/analytics/.env.example` 到忽略目录 `.local/umami.env`，填写实例和管理凭据。Cloud 与自建的管理 API 地址可能不同；采集地址是实例根地址下 `/api/send`，不是管理 API 地址。

Worker 变量：

- `ANALYTICS_ENABLED=true`：只有 production 环境允许外发。
- `ANALYTICS_HOSTNAME`：产品域名。
- `UMAMI_ORIGIN`：HTTPS Umami 采集实例根地址；Cloud 使用 `https://cloud.umami.is`。
- `UMAMI_WEBSITE_ID`：网站 ID。
- `UMAMI_API_ORIGIN`：管理 API 基础地址。自建通常为 `https://你的实例/api`；Cloud 需按账号文档核验。
- `UMAMI_BOARD_ID`：配置脚本返回的看板 ID。

Worker Secrets（不得进入 vars 或公开源码）：

- `ANALYTICS_HASH_KEY`：独立随机密钥，至少 32 字符；不是 SESSION_SIGNING_KEY，变更会断开匿名账号连续性。
- `ANALYTICS_READ_TOKEN`：至少 32 字符，用于受保护的 `/api/analytics/summary`。
- `UMAMI_API_TOKEN`：有权读取和修改目标网站看板的管理令牌，尽量只授予必要权限。

生产配置必须添加 `triggers.crons = ["*/5 * * * *"]`。应用 `0006_product_analytics.sql` 增量迁移，只新增分析表、触发器和事项记录人字段，不修改旧用户资料。首次迁移时记录采集起点，启用前已有数据只通过当前总量展示。

```sh
npm run analytics:setup -- --env=.local/umami.env
npm run analytics:setup -- --env=.local/umami.env --apply
```

第一条只读核验网站、实例 Board 支持和权限；第二条按名称复用报告与看板，保留额外自定义行，创建后读取核验，将非敏感资源 ID 记录到 `.local/analytics/board.json`。脚本不创建公开分享。首次快照在 Worker 配置完整后的下一次定时任务更新；脚本也可使用私密文件中的产品地址及只读令牌初始化快照。

## 可靠性与维护

队列存放在 D1，单次处理通过租约避免并发重复发送。失败指数退避，最多每天重试一次；不丢弃失败事件。超时后可能已经被 Umami 接收但没有返回响应，收集 API 没有幂等保证，因此重发可能使 Umami 趋势产生少量重复；事件有匿名 delivery_id 供排查，总量以 D1 为准。

受保护 summary 返回 pending_events、retrying_events、oldest_pending_at。日志仅记录发送成功/失败数，不输出 payload 或令牌。队列暂不自动清理，以保留统计和排查依据；数据量增加时应先归档再清理，不能删除近 30 天事件，否则活跃统计会不完整。

停用：将 `ANALYTICS_ENABLED` 设为 false，关闭外发和浏览事件接收；业务计数仍记录在数据库中。不要删除 analytics 表而保留触发器。回退应用代码时可以保留迁移与触发器，不需要删除业务数据。

## 参考

[收集 API](https://docs.umami.is/docs/api/sending-stats)、[Reports API](https://docs.umami.is/docs/api/reports)、[Boards](https://docs.umami.is/docs/using-boards)、[官方 Board API 实现](https://github.com/umami-software/umami/blob/master/src/app/api/boards/route.ts)。
