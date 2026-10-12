"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SectionTitle } from "../ui";
type RequestRow = { id: string; email: string; created_at: string };
export function RegistrationReview() {
  const [rows, setRows] = useState<RequestRow[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  async function load() {
    const result = await api<{ requests: RequestRow[] }>("/registrations");
    setRows(result.requests);
  }
  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);
  async function review(id: string, action: "approve" | "reject") {
    setBusy(id);
    setError("");
    try {
      await api(`/registrations/${id}/${action}`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <SectionTitle>注册申请</SectionTitle>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {rows?.length === 0 && (
        <p className="muted">目前没有待审批的注册申请。</p>
      )}
      {rows?.map((row) => (
        <div className="surface registration-request" key={row.id}>
          <strong>{row.email}</strong>
          <p className="muted">{row.created_at}</p>
          <div className="form-actions">
            <button
              className="primary-button"
              disabled={busy === row.id}
              onClick={() => void review(row.id, "approve")}
            >
              通过
            </button>
            <button
              className="secondary-button"
              disabled={busy === row.id}
              onClick={() => void review(row.id, "reject")}
            >
              拒绝
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
