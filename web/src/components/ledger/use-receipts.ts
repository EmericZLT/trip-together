"use client";
import { useEffect, useRef, useState } from "react";
import type { Receipt } from "@/lib/models";
import type { FileTile } from "../files/file-tiles";
import { uploadFile, validateFiles } from "@/lib/files/upload";
import { api, apiUrl, fileUrl } from "@/lib/api";
type Attachment = FileTile & { file?: File };
export function useReceipts(existing: Receipt[]) {
  const [files, setFiles] = useState<Attachment[]>(() =>
    existing.map((r) => ({ ...r, url: fileUrl(r.id), status: "ready" })),
  );
  const endpoint = useRef(apiUrl("/receipts")).current;
  const items = useRef(files);
  const drafts = useRef(new Set<string>());
  const running = useRef(new Map<string, Promise<void>>());
  const urls = useRef(new Set<string>());
  function render() {
    setFiles([...items.current]);
  }
  function start(item: Attachment) {
    if (!item.file || running.current.has(item.id)) return;
    item.status = "uploading";
    item.progress = 0;
    item.error = undefined;
    drafts.current.add(item.id);
    render();
    const task = uploadFile(`${endpoint}/${item.id}`, item.file, (progress) => {
      item.progress = progress;
      render();
    })
      .promise.then(() => {
        item.status = "ready";
      })
      .catch((error) => {
        item.status = "error";
        item.error = error.message;
      })
      .finally(() => {
        running.current.delete(item.id);
        render();
      });
    running.current.set(item.id, task);
  }
  function add(selected: File[]) {
    if (items.current.length + selected.length > 5)
      throw new Error("最多上传 5 份资料");
    validateFiles(selected, true);
    const added = selected.map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      return {
        id: crypto.randomUUID(),
        name: file.name,
        mime: file.type,
        size: file.size,
        file,
        url,
        status: "uploading" as const,
        progress: 0,
      };
    });
    items.current = [...items.current, ...added];
    render();
    added.forEach(start);
  }
  async function remove(id: string) {
    items.current = items.current.filter((item) => item.id !== id);
    render();
    await running.current.get(id);
    if (drafts.current.has(id)) {
      await api(`/receipts/${id}`, { method: "DELETE" }, `${endpoint}/${id}`);
      drafts.current.delete(id);
    }
  }
  async function upload() {
    await Promise.all([...running.current.values()]);
    if (items.current.some((item) => item.status !== "ready"))
      throw new Error("请先重试上传失败的资料，或移除后保存");
    return items.current.map((item) => item.id);
  }
  async function cleanup() {
    await Promise.allSettled([...running.current.values()]);
    await Promise.allSettled(
      [...drafts.current].map((id) =>
        api(`/receipts/${id}`, { method: "DELETE" }, `${endpoint}/${id}`),
      ),
    );
  }
  useEffect(
    () => () => {
      void cleanup();
      for (const url of urls.current) URL.revokeObjectURL(url);
    },
    [],
  );
  return {
    files,
    add,
    remove,
    upload,
    cleanup,
    retry: (id: string) => {
      const item = items.current.find((item) => item.id === id);
      if (item) start(item);
    },
    uploading: files.some((file) => file.status === "uploading"),
  };
}
