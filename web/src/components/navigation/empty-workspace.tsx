import { CalendarDays, FolderOpen, Wallet, ArrowRight } from "lucide-react";
import { TravelSticker } from "../travel-sticker";
export function EmptyWorkspace({
  tab,
  onManage,
}: {
  tab: string;
  onManage: () => void;
}) {
  const content =
    tab === "itinerary"
      ? {
          title: "还没有行程安排",
          text: "创建或加入行程后，在这里查看每日安排。",
          Icon: CalendarDays,
        }
      : tab === "documents"
        ? {
            title: "还没有行程资料",
            text: "机票、预订和共享文件会显示在这里。请勿上传护照等私人证件。",
            Icon: FolderOpen,
          }
        : {
            title: "还没有行程账本",
            text: "选择行程后，记录支出并与同行成员分摊。",
            Icon: Wallet,
          };
  return (
    <section className="page-content empty-workspace">
      {tab === "today" ? (
        <>
          <article className="onboarding-ticket">
            <div className="onboarding-ticket-body">
              <span className="status-pill">尚未添加行程</span>
              <TravelSticker kind="luggage" />
              <h1>还没有行程</h1>
              <p>创建自己的旅行计划，或使用同行人的邀请口令加入行程。</p>
            </div>
            <button onClick={onManage}>
              前往我的行程 <ArrowRight size={19} />
            </button>
          </article>
          <div className="onboarding-note">
            <CalendarDays size={19} />
            <p>
              添加行程后，这里会显示接下来的安排。你也可以先在“我的”中修改昵称。请勿上传护照等私人证件。
            </p>
          </div>
        </>
      ) : (
        <div className="empty-workspace-message">
          <content.Icon size={34} strokeWidth={1.4} />
          <h1>{content.title}</h1>
          <p>{content.text}</p>
          <button className="secondary-button" onClick={onManage}>
            前往我的行程 <ArrowRight size={17} />
          </button>
        </div>
      )}
    </section>
  );
}
