export const boardName = "TripTogether · 产品使用";
export const goals = [
  ["account_registered", "新增注册"],
  ["email_verified", "完成邮箱验证"],
  ["trip_created", "创建行程"],
  ["trip_joined", "加入同行行程"],
  ["trip_became_multiplayer", "形成多人行程"],
  ["event_created", "创建行程事项"],
  ["document_uploaded", "上传旅行资料"],
  ["expense_created", "记录支出"],
];
export function boardParameters(websiteId, reports, text) {
  const column = (id, type, title, props = {}) => ({
    id,
    component: { type, title, props },
  });
  return {
    websiteId,
    rows: [
      {
        id: "product-totals",
        columns: [
          column("trip-product-totals", "TextBlock", "当前产品总量", { text }),
        ],
      },
      {
        id: "event-trends",
        columns: [column("product-events", "EventsChart", "新增行为趋势")],
      },
      ...[0, 2, 4, 6].map((i) => ({
        id: `goals-${i}`,
        columns: goals
          .slice(i, i + 2)
          .map(([event, label]) =>
            column(`goal-${event}`, "Goal", label, {
              reportId: reports[event],
            }),
          ),
      })),
      {
        id: "features",
        columns: [
          column("feature-events", "MetricsTable", "功能使用分布", {
            type: "event",
            limit: 20,
          }),
        ],
      },
      {
        id: "measurement-notes",
        columns: [
          column("measurement-notes-text", "TextBlock", "统计口径", {
            text: "顶部总量来自业务数据库，包含历史数据；定时更新，以标注时间为准，不跟随日期筛选。下方 Umami 图表只包含开始采集后的事件，不能用 visitors 代替注册账号数。网络响应丢失时重发可能重复，业务总量以顶部为准。服务端发送的数据不适合分析真实设备和地理位置。多人行程表示至少两位成员实际加入；事项数包括航班、住宿、交通和游玩。",
          }),
        ],
      },
    ],
  };
}
