"use client";
import { useEffect, useState } from "react";
import type { Member } from "@/lib/models";

export function Avatar({
  member,
  className = "",
}: {
  member: Pick<Member, "id" | "name" | "has_avatar" | "version"> | undefined;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [member?.id, member?.version]);
  return (
    <span className={`avatar ${className}`}>
      {member && member.has_avatar && !failed ? (
        // Private Worker images require the same-origin session cookie.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/avatars/${encodeURIComponent(member.id)}?v=${member.version ?? 0}`}
          alt={`${member.name}的头像`}
          width={96}
          height={96}
          onError={() => setFailed(true)}
          draggable={false}
        />
      ) : (
        <span aria-label={member?.name ?? "成员"}>
          {member?.name.slice(-1) ?? "?"}
        </span>
      )}
    </span>
  );
}
