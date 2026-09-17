"use client";
import {
  Compass,
  CalendarDays,
  FolderOpen,
  Wallet,
  UserRound,
} from "lucide-react";
import type { Bootstrap } from "@/lib/models";
import { Avatar } from "../avatar";
const tabs = [
  ["today", "现在", Compass],
  ["itinerary", "行程", CalendarDays],
  ["documents", "资料", FolderOpen],
  ["ledger", "账本", Wallet],
  ["profile", "我的", UserRound],
] as const;
export function NavigationDock({
  data,
  tab,
  onNavigate,
}: {
  data: Bootstrap;
  tab: string;
  onNavigate: (tab: string) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {tabs.map(([id, label, Icon]) => (
        <button
          key={id}
          aria-label={label}
          aria-current={tab === id ? "page" : undefined}
          className={tab === id ? "selected" : ""}
          onClick={() => onNavigate(id)}
        >
          <span className="nav-symbol">
            {id === "profile" ? (
              <Avatar member={data.me} />
            ) : (
              <Icon size={23} strokeWidth={tab === id ? 2.3 : 1.8} />
            )}
          </span>
        </button>
      ))}
    </nav>
  );
}
