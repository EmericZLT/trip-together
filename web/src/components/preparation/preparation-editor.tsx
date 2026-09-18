"use client";
import { useState } from "react";
import { Sheet } from "../ui";
import { Field } from "../editors/fields";
export function PreparationEditor({
  groups,
  existing,
  onAdd,
  onClose,
  error,
}: {
  groups: string[];
  existing: string[];
  onAdd: (v: {
    group_name: string;
    title: string;
    note: string;
  }) => Promise<boolean>;
  onClose: () => void;
  error: string;
}) {
  const [title, setTitle] = useState(""),
    [group, setGroup] = useState(groups[0] ?? "出发准备"),
    [note, setNote] = useState(""),
    [more, setMore] = useState(true),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function add(name: string) {
    setBusy(true);
    try {
      if (await onAdd({ group_name: group || "出发准备", title: name, note })) {
        setTitle("");
        setNote("");
        setNotice(`已添加：${name}`);
        if (!more) onClose();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      hasChanges={!!title.trim() || !!note.trim()}
      open
      title="添加准备事项"
      onClose={() => !busy && onClose()}
    >
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void add(title);
        }}
      >
        <Field
          label="准备事项"
          value={title}
          required
          maxLength={200}
          placeholder="例如：携带充电器"
          onChange={setTitle}
        />
        <details className="optional-details">
          <summary>分组与说明（选填）</summary>
          <div className="optional-fields">
            <label>
              分组
              <input
                aria-label="分组"
                list="preparation-groups"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
              />
              <datalist id="preparation-groups">
                {groups.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </datalist>
            </label>
            <Field label="说明" value={note} onChange={setNote} />
          </div>
        </details>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={more}
            onChange={(e) => setMore(e.target.checked)}
          />
          保存后继续添加
        </label>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        <button className="primary-button" disabled={busy}>
          {busy ? "正在添加…" : "添加准备事项"}
        </button>
        <details className="optional-details">
          <summary>从常用清单快速添加</summary>
          <div className="optional-fields">
            {[
              "检查护照与签证",
              "确认机票与酒店订单",
              "携带充电器与转换插头",
              "准备常用药品",
              "检查行李额度",
            ].map((name) => (
              <button
                type="button"
                className="secondary-button"
                key={name}
                disabled={busy || existing.includes(name)}
                onClick={() => void add(name)}
              >
                {existing.includes(name) ? "已添加 · " : "＋ "}
                {name}
              </button>
            ))}
          </div>
        </details>
      </form>
    </Sheet>
  );
}
