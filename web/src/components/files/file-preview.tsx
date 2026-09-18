"use client";
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
export function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url ? (
    <img className="upload-preview" src={url} alt="待上传图片" />
  ) : (
    <FileText size={28} />
  );
}
