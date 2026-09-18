"use client";
import { useState } from "react";
import type { Profile } from "@/lib/models";
import { api } from "@/lib/api";
import { uploadFile, validateFiles } from "@/lib/files/upload";
import { Sheet } from "../ui";
import { Avatar } from "../avatar";
import { Field } from "../editors/fields";
export function ProfileEditor({
  profile,
  onClose,
  onSaved,
}: {
  profile: Profile;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [v, setV] = useState(profile),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState<number | null>(null);
  const fields = {
    name: "昵称",
    english_name: "英文姓名",
    passport: "护照号码",
    identity_number: "身份证号码",
    expiry: "证件有效期",
  };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/profile", { method: "PUT", body: JSON.stringify(v) });
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function avatar(file?: File) {
    setBusy(true);
    setError("");
    try {
      if (file) {
        validateFiles([file], true);
        await uploadFile("/api/avatar", file, setProgress).promise;
      } else await api("/avatar", { method: "DELETE" });
      const result = await api<{ me: Profile }>("/bootstrap");
      setV((prev) => ({
        ...prev,
        version: result.me.version,
        has_avatar: result.me.has_avatar,
      }));
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  return (
    <Sheet open title="编辑个人资料" onClose={() => !busy && onClose()}>
      <form className="editor-form" onSubmit={save}>
        <p className="muted">昵称和头像供同行成员查看，证件信息仅本人可见。</p>
        <Field
          label="昵称"
          value={v.name}
          required
          maxLength={60}
          onChange={(name) => setV({ ...v, name })}
        />
        <details className="optional-details">
          <summary>证件信息（选填，仅自己可见）</summary>
          <div className="optional-fields">
            {Object.entries(fields)
              .filter(([key]) => key !== "name")
              .map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  type={key === "expiry" ? "date" : "text"}
                  value={v[key as keyof typeof fields]}
                  onChange={(value) => setV({ ...v, [key]: value })}
                />
              ))}
          </div>
        </details>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={busy}>
          保存个人资料
        </button>
        <div className="optional-fields">
          <Avatar member={v} className="profile-avatar" />
          <label>
            上传头像
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void avatar(file);
              }}
            />
          </label>
          {progress !== null && (
            <progress value={progress} max={100} aria-label="头像上传进度" />
          )}
          {v.has_avatar ? (
            <button
              type="button"
              className="text-action"
              disabled={busy}
              onClick={() => void avatar()}
            >
              移除头像
            </button>
          ) : null}
          <small>头像修改后立即生效，其他资料可以继续填写。</small>
        </div>
      </form>
    </Sheet>
  );
}
export function PasswordEditor({
  onClose,
  onLogout,
}: {
  onClose: () => void;
  onLogout: () => Promise<void>;
}) {
  const [currentPassword, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [saved, setSaved] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Sheet
      open
      title={saved ? "密码已经更新" : "修改密码"}
      onClose={() => !busy && !saved && onClose()}
    >
      {saved ? (
        <div className="editor-form">
          <p>密码已经更新，请使用新密码重新登录。</p>
          <button
            className="primary-button"
            onClick={() => void onLogout().catch(() => location.reload())}
          >
            重新登录
          </button>
        </div>
      ) : (
        <form
          className="editor-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("/password", {
                method: "PUT",
                body: JSON.stringify({ currentPassword, password }),
              });
              setSaved(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field
            label="当前密码"
            type="password"
            value={currentPassword}
            required
            onChange={setCurrent}
          />
          <Field
            label="新密码"
            type="password"
            value={password}
            required
            onChange={setPassword}
          />
          <small>至少 10 个字符，区分大小写。</small>
          {error && <p role="alert">{error}</p>}
          <button className="primary-button" disabled={busy}>
            保存新密码
          </button>
        </form>
      )}
    </Sheet>
  );
}
