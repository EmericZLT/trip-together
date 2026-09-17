"use client";
import { useState } from "react";
import { ChevronDown, Check, ArrowRight } from "lucide-react";
import type { Bootstrap } from "@/lib/models";
import { Sheet } from "../ui";
export function ProfileTrips({
  data,
  selected,
  onSelect,
  onManage,
}: {
  data: Bootstrap;
  selected: string;
  onSelect: (id: string) => void;
  onManage: () => void;
}) {
  const [open, setOpen] = useState(false);
  const current = data.trips.find((t) => t.id === selected);
  return (
    <div className="profile-trip-controls">
      {current && (
        <button
          className="profile-current-trip"
          aria-label={`当前行程：${current.title}，切换行程`}
          onClick={() => setOpen(true)}
        >
          <span>
            <small>当前行程</small>
            <strong>{current.title}</strong>
          </span>
          <ChevronDown size={19} />
        </button>
      )}
      <button className="profile-trip-manage" onClick={onManage}>
        <span>
          <strong>我的行程</strong>
          <small>创建、加入与管理行程</small>
        </span>
        <ArrowRight size={18} />
      </button>
      {open && (
        <Sheet open title="切换当前行程" onClose={() => setOpen(false)}>
          <div className="trip-picker">
            {data.trips.map((t) => (
              <button
                key={t.id}
                aria-pressed={t.id === selected}
                onClick={() => {
                  onSelect(t.id);
                  setOpen(false);
                }}
              >
                <span>
                  <strong>{t.title}</strong>
                  <small>
                    {t.start_date} — {t.end_date}
                  </small>
                </span>
                {t.id === selected ? (
                  <Check size={20} />
                ) : (
                  <ArrowRight size={18} />
                )}
              </button>
            ))}
            <button
              className="text-action"
              onClick={() => {
                setOpen(false);
                onManage();
              }}
            >
              管理、创建或加入行程 <ArrowRight size={16} />
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
