# 产品指标与 OpenPanel

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

总量由 D1 查询，删除资料或行程后相应当前总量会减少。新增趋势来自 OpenPanel，不会因为删除业务数据而减少。旧账号和事项缺少可靠创建时间，不进行历史事件回填。OpenPanel visitors、visits 均不能代替账号总量。

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
| page_viewed | 预定义页面打开，发送为 OpenPanel screen_view |
| event_form_opened | 打开事项编辑 |
| event_step_viewed | 浏览事项步骤；step 1–4 |
| document_upload_started | 开始上传一批资料 |

业务事件通过 D1 触发器与业务写入同事务记录；上传重试、重复加入不会重复产生业务创建事件。业务记录保留当前权限校验。浏览事件只接受白名单字段，限制请求频率；匿名访问不计入活跃账号。本地不向 OpenPanel 发送。浏览端尊重 DNT，也可用 `localStorage.setItem('analytics-disabled','true')` 停止当前浏览器的浏览行为采集；业务数据库计数不因此消失。

不采集邮箱、姓名、地址、行程标题、资料名称、金额、搜索词、邀请码、原始 URL、IP 或文件内容。账号及业务实体通过独立 HMAC 密钥匿名化后发送。只发送固定虚拟页面路径。发送端使用服务 UA，不转发用户 UA/IP，因此不应使用本网站 OpenPanel 的地域和设备报表分析真实用户来源。页面访问会有网络来源，但这里不转发给 OpenPanel。

## 看板设计

OpenPanel 看板使用私有访问。完整指标方案在 `scripts/analytics/definition.mjs`：

1. 新增账号和邮箱验证趋势，按 profile 去重。
2. 创建行程的用户数，按 profile 去重；新增行程、事项、多人形成次数。
3. 新用户「注册 → 创建行程 → 添加事项」七日转化漏斗；加入行程的用户单独分析。
4. 事项类型分布、资料与记账使用人数、填写步骤漏斗、页面使用分布。

所有业务报告排除 `source=integration_test`。当前总量（包含历史用户、活动、多人行程）通过受 Bearer Token 保护的 `/api/analytics/summary` 查看；不能把新增事件或每天的存量相加冒充总量。OpenPanel 的日期筛选只作用于行为报告。

已核实官方 Manage API 和 MCP：目前公开了看板及报告的列表、报告查询，没有公开创建或修改看板的接口。因此配置脚本生成指标方案，不能声称已经创建平台看板，也不使用未经支持的内部接口。需要在 OpenPanel 控制台依据该方案创建报告。生产尚未部署此接入时，平台仅有显式发送的 integration_check 测试事件。

## 配置

默认 `ANALYTICS_ENABLED=false`。复制 `scripts/analytics/.env.example` 到 `.local/openpanel.env`；仅服务端读取凭据。文件权限设置为 600。该文件不会被 Wrangler 自动读取，生产必须通过 Worker Secret 配置，不要误以为保存本地文件等于发布。

Worker 普通变量：

- `ANALYTICS_ENABLED=true`：只有 production 环境允许外发。
- `ANALYTICS_HOSTNAME`：产品域名。
- `OPENPANEL_ORIGIN=https://api.openpanel.dev`：HTTPS 根地址。
- `OPENPANEL_CLIENT_ID`：采集客户端 ID。

Worker Secrets：

- `OPENPANEL_CLIENT_SECRET`：仅采集所需的 write 客户端凭据；不要给生产采集服务 root 权限。
- `ANALYTICS_HASH_KEY`：独立随机密钥，至少 32 字符；不是 SESSION_SIGNING_KEY，变更会断开匿名账号连续性。
- `ANALYTICS_READ_TOKEN`：至少 32 字符，用于受保护的 `/api/analytics/summary`。

生产配置添加 `triggers.crons = ["*/5 * * * *"]`。事件每 5 分钟最多发送 50 条，并发 10 条。应用 `0006_product_analytics.sql` 增量迁移，新增分析表、触发器和事项记录人字段，不修改旧用户资料。首次迁移时记录采集起点，旧数据只通过当前总量展示。

```sh
npm run analytics:setup -- --env=.local/openpanel.env
# 显式发送一条不含真实用户信息的测试事件：
npm run analytics:setup -- --env=.local/openpanel.env --send-test
```

第一条只读检查管理权限，并将看板方案保存到 `.local/analytics/openpanel-dashboard.json`，这不是平台导入格式。默认 write 客户端访问管理接口可能返回 401，不代表不能采集。第二条通过 `/track` 发送 integration_check 并检查 sessionId。采集接口接受并不等于已经从报表读回验证；查询报表需要另外配置 read 客户端及 projectId。

服务端使用 `profileId` 和 `__deviceId` 传递 HMAC 匿名标识，避免所有用户共用服务器身份；`__timestamp` 保留原始事件时间，重试不会改成重发时间。`__url` 只包含固定页面路径。不开启 session replay，不上传用户 IP、浏览器 UA 或输入内容。

## 可靠性与维护

队列存放在 D1，单次处理通过租约避免并发重复发送。失败指数退避，最多每天重试一次；不丢弃失败事件。超时后可能已经被 OpenPanel 接收但没有返回响应，收集 API 没有幂等保证，因此重发可能使 OpenPanel 趋势产生少量重复；事件有匿名 delivery_id 供排查，总量以 D1 为准。

受保护 summary 返回 pending_events、retrying_events、oldest_pending_at。日志仅记录发送成功/失败数，不输出 payload 或令牌。队列暂不自动清理，以保留统计和排查依据；数据量增加时应先归档再清理，不能删除近 30 天事件，否则活跃统计会不完整。

停用：将 `ANALYTICS_ENABLED` 设为 false，关闭外发和浏览事件接收；业务计数仍记录在数据库中。不要删除 analytics 表而保留触发器。回退应用代码时可以保留迁移与触发器，不需要删除业务数据。

## 参考

[Track API](https://openpanel.dev/docs/api/track)、[权限说明](https://openpanel.dev/docs/api/authentication)、[Manage API](https://openpanel.dev/docs/api/manage)、[MCP 查询能力](https://openpanel.dev/docs/mcp)、[官方 Track 实现](https://github.com/Openpanel-dev/openpanel/blob/main/apps/api/src/controllers/track.controller.ts)。
