"use client";
import { useId, useState } from "react";
import { ConfigProvider, Select } from "antd";
import zhCN from "antd/locale/zh_CN";
export function CategorySelect({
  value,
  categories,
  disabled,
  onChange,
}: {
  value: string;
  categories: string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const names = [
    ...new Set(
      ["行程", "交通", "住宿", "活动", "其他", ...categories, value]
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
  const candidate = search.trim();
  const options = names
    .filter((name) =>
      name.toLocaleLowerCase().includes(candidate.toLocaleLowerCase()),
    )
    .map((name) => ({ value: name, label: name }));
  if (candidate && candidate.length <= 60 && !names.includes(candidate)) {
    options.push({ value: candidate, label: `新建分类「${candidate}」` });
  }
  return (
    <ConfigProvider
      locale={zhCN}
      getPopupContainer={(trigger) =>
        trigger?.closest<HTMLElement>(".sheet") ?? document.body
      }
      theme={{
        token: {
          colorPrimary: "#9685b0",
          motion: false,
          borderRadius: 12,
          controlHeight: 44,
          fontSize: 15,
          fontFamily: "inherit",
        },
      }}
    >
      <div className="category-field">
        <label htmlFor={id}>资料分类</label>
        <Select
          id={id}
          aria-label="资料分类"
          value={value}
          disabled={disabled}
          options={options}
          showSearch={{
            searchValue: search,
            onSearch: setSearch,
            filterOption: false,
          }}
          onChange={(next) => {
            onChange(next);
            setSearch("");
          }}
          onOpenChange={(open) => {
            if (!open) setSearch("");
          }}
          onInputKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          placeholder="选择分类，或输入新分类"
          notFoundContent={
            candidate.length > 60 ? "分类名称最多 60 个字" : "没有匹配的分类"
          }
        />
        <small>可以选择已有分类，也可以直接输入名称新建分类。</small>
      </div>
    </ConfigProvider>
  );
}
