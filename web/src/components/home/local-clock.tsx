"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, ArrowLeftRight, RefreshCw } from "lucide-react";
import { clockTime, dateLabel, zoneName } from "@/lib/time";
import {
  currentCoordinates,
  lookupLocation,
  type ClockZone,
  type CurrentLocation,
} from "@/lib/location";

let recent: { location: CurrentLocation | null; at: number } | null = null;
export function LocalClock({
  now,
  homeZone,
  destinationZone,
}: {
  now: number;
  homeZone: string;
  destinationZone: string;
}) {
  const clockZones = {
    home: { timezone: homeZone, label: zoneName(homeZone) },
    destination: {
      timezone: destinationZone,
      label: zoneName(destinationZone),
    },
  };
  const [location, setLocation] = useState<CurrentLocation | null>(null);
  const [choice, setChoice] = useState<ClockZone>("home");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("点击允许获取设备位置");
  const manual = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const locate = useCallback(async (retry = false) => {
    if (!retry && recent && Date.now() - recent.at < 300000) {
      setLocation(recent.location);

      return;
    }
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      const coords = await currentCoordinates();
      if (controller.signal.aborted) return;
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const result = await lookupLocation(coords, controller.signal);
        if (pending.current !== controller) return;
        setLocation(result);
        recent = { location: result, at: Date.now() };
        setMessage("点击重新获取设备位置");
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      if (pending.current !== controller) return;
      setLocation(null);
      recent = { location: null, at: Date.now() };
      setMessage("未获取到设备位置，请允许定位后重试；仍可切换时区");
    } finally {
      if (pending.current === controller) {
        setBusy(false);
        pending.current = null;
      }
    }
  }, []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        `trip-clock-zone:${homeZone}:${destinationZone}`,
      );
      if (saved === "home" || saved === "destination") {
        manual.current = true;
        setChoice(saved);
      }
    } catch {
      /* Clock switching remains available without storage. */
    }
    void locate();
    const refresh = () => {
      if (document.visibilityState === "visible") void locate();
    };
    const timer = setInterval(refresh, 300000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      pending.current?.abort();
      pending.current = null;
    };
  }, [locate, homeZone, destinationZone]);
  const zone = clockZones[choice];
  const nextChoice = choice === "home" ? "destination" : "home";
  function switchZone() {
    manual.current = true;
    setChoice(nextChoice);
    try {
      localStorage.setItem(
        `trip-clock-zone:${homeZone}:${destinationZone}`,
        nextChoice,
      );
    } catch {
      /* Keep the current selection in memory. */
    }
  }
  return (
    <div className="local-clock" aria-label="当前时间与位置">
      <button
        className="clock-location"
        aria-label="重新定位当前位置"
        title={message}
        disabled={busy}
        onClick={() => void locate(true)}
      >
        {busy ? (
          <RefreshCw size={10} className="animate-spin" />
        ) : (
          <MapPin size={10} />
        )}
        <span>{busy ? "正在定位" : (location?.name ?? "未定位")}</span>
      </button>
      <button
        className="clock-switch"
        aria-label={`切换为${clockZones[nextChoice].label}`}
        title={`${dateLabel(now, zone.timezone)} · 点击切换时区`}
        onClick={switchZone}
      >
        <span>{zone.label}</span>
        <time data-testid="live-clock" dateTime={new Date(now).toISOString()}>
          {clockTime(now, zone.timezone, true)}
        </time>
        <ArrowLeftRight size={10} />
      </button>
    </div>
  );
}
