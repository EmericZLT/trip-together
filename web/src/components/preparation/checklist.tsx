"use client";
import { useState } from "react";
import { Check, ChevronDown, Trash2 } from "lucide-react";
import type { PreparationItem } from "@/lib/models";
import { api } from "@/lib/api";
import { Sheet } from "../ui";
import { Field } from "../editors/fields";
export function PreparationChecklist({
  items,
  checked,
  onRefresh,
}: {
  items: PreparationItem[];
  checked: string[];
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [adding, setAdding] = useState(false),
    [removing, setRemoving] = useState<PreparationItem | null>(null),
    [group, setGroup] = useState("出发准备"),
    [title, setTitle] = useState(""),
    [note, setNote] = useState("");
  const completed = items.filter((i) => checked.includes(i.id)).length,
    groups = [...new Set(items.map((i) => i.group_name))];
  async function action(path: string, method: string, body?: object) {
    setBusy(true);
    setError("");
    try {
      await api(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await onRefresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="preparation-checklist">
      <div className="preparation-summary">
        <strong>
          已完成 {completed} / {items.length}
        </strong>
        <span>按本人准备情况勾选</span>
      </div>
      <progress
        value={completed}
        max={items.length || 1}
        aria-label="准备进度"
      />
      {groups.map((g) => (
        <details className="preparation-group" key={g} open>
          <summary>
            <strong>{g}</strong>
            <ChevronDown size={15} />
          </summary>
          {items
            .filter((i) => i.group_name === g)
            .map((i) => (
              <div className="checklist-row" key={i.id}>
                <button
                  className="preparation-item"
                  role="checkbox"
                  aria-checked={checked.includes(i.id)}
                  disabled={busy}
                  onClick={() =>
                    void action("/packing", "PUT", {
                      itemId: i.id,
                      checked: !checked.includes(i.id),
                    })
                  }
                >
                  <span
                    className={`checkbox ${checked.includes(i.id) ? "checked" : ""}`}
                  >
                    {checked.includes(i.id) && <Check size={13} />}
                  </span>
                  <span>
                    <strong>{i.title}</strong>
                    {i.note && <small>{i.note}</small>}
                  </span>
                </button>
                <button
                  className="icon-button"
                  aria-label={`删除${i.title}`}
                  onClick={() => setRemoving(i)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
        </details>
      ))}
      {!items.length && (
        <p className="muted">
          添加需要准备的物品或提前办理的事项。每位成员分别记录完成情况。
        </p>
      )}
      <button
        className="secondary-button w-full"
        onClick={() => setAdding(true)}
      >
        添加准备事项
      </button>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {adding && (
        <Sheet
          open
          title="添加准备事项"
          onClose={() => !busy && setAdding(false)}
        >
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await action("/preparation", "POST", {
                  group_name: group,
                  title,
                  note,
                })
              ) {
                setAdding(false);
                setTitle("");
                setNote("");
              }
            }}
          >
            <Field label="分组" value={group} required onChange={setGroup} />
            <Field
              label="准备事项"
              value={title}
              required
              onChange={setTitle}
            />
            <Field label="说明" value={note} onChange={setNote} />
            {error && <p role="alert">{error}</p>}
            <button className="primary-button" disabled={busy}>
              保存准备事项
            </button>
          </form>
        </Sheet>
      )}
      {removing && (
        <Sheet
          open
          title="删除准备事项"
          onClose={() => !busy && setRemoving(null)}
        >
          <div className="editor-form">
            <p>删除「{removing.title}」及所有成员对此项的勾选记录？</p>
            <button
              className="primary-button"
              disabled={busy}
              onClick={async () => {
                if (await action(`/preparation/${removing.id}`, "DELETE"))
                  setRemoving(null);
              }}
            >
              确认删除
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
