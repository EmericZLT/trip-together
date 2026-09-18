// Report recipes, not undocumented OpenPanel API request bodies.
export const dashboard = {
  name: "TripTogether · 产品使用",
  visibility: "private",
  exclude: { source: "integration_test" },
  reports: [
    {
      name: "新增账号与邮箱验证",
      chart: "line",
      events: ["account_registered", "email_verified"],
      aggregation: "unique profiles",
    },
    {
      name: "创建行程的用户",
      chart: "metric",
      events: ["trip_created"],
      aggregation: "unique profiles",
    },
    {
      name: "新增行程、事项与多人协作",
      chart: "line",
      events: ["trip_created", "event_created", "trip_became_multiplayer"],
      aggregation: "event count",
    },
    {
      name: "事项类型",
      chart: "bar",
      events: ["event_created"],
      breakdown: "kind",
      aggregation: "event count",
    },
    {
      name: "首次使用转化",
      chart: "funnel",
      events: ["account_registered", "trip_created", "event_created"],
      aggregation: "unique profiles",
      window: "7 days",
    },
    {
      name: "资料与记账",
      chart: "line",
      events: ["document_uploaded", "expense_created"],
      aggregation: "unique profiles",
    },
    {
      name: "事项填写步骤",
      chart: "funnel",
      events: [
        "event_step_viewed:step=1",
        "event_step_viewed:step=2",
        "event_step_viewed:step=3",
        "event_step_viewed:step=4",
        "event_created",
      ],
      window: "1 day",
    },
    {
      name: "页面使用",
      chart: "bar",
      events: ["screen_view"],
      breakdown: "page",
      aggregation: "unique profiles",
    },
  ],
  notes: [
    "业务事件 total_* 属性包含历史全量，按照 totals_sampled_at 取最新样本，禁止求和或取最大值；/api/analytics/summary 可实时核验。",
    "此处报告仅覆盖开始采集后的行为。多人行程表示至少两位成员实际加入。",
    "事件至少一次投递；极少数网络故障可能重复，delivery_id 用于排查。",
    "首次使用漏斗用于新注册且自己创建行程的人；加入他人行程的用户单独分析 trip_joined。",
    "服务端发送不转发用户 IP 和 UA，不使用地域、设备或浏览会话报表推断用户。",
  ],
};
