"use client";
import { useState } from "react";
import {
  destinations,
  type Destination,
} from "../../../../shared/travel-options";
import { ChoiceField } from "../editors/choice-field";
import { Field, ZoneField, CurrencyField } from "../editors/fields";
export function DestinationPicker({
  value,
  onChange,
}: {
  value: Destination[];
  onChange: (v: Destination[]) => void;
}) {
  const [adding, setAdding] = useState(!value.length),
    [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState<Destination>({
    name: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    currency: "CNY",
  });
  function add(d: Destination) {
    onChange([...value, d]);
    setAdding(false);
    setCustom(false);
  }
  return (
    <div className="destination-picker">
      {value.map((d, i) => (
        <div className="destination-row" key={`${i}-${d.name}`}>
          <span>
            {d.name}
            {i === 0 && <small>主要目的地</small>}
          </span>
          <button
            type="button"
            className="text-action"
            aria-label={`移除${d.name}`}
            onClick={() => {
              onChange(value.filter((_, index) => index !== i));
              if (value.length === 1) setAdding(true);
            }}
          >
            移除
          </button>
        </div>
      ))}
      {adding && (
        <>
          <ChoiceField
            label="目的地"
            value=""
            placeholder="搜索国家或城市"
            options={destinations.map((d, i) => ({
              value: String(i),
              label: d.name,
            }))}
            onChange={(i) => add(destinations[Number(i)])}
          />
          <button
            type="button"
            className="text-action"
            onClick={() => setCustom(!custom)}
          >
            找不到目的地？自行添加
          </button>
          {custom && (
            <div className="optional-fields">
              <Field
                label="城市名称"
                value={draft.name}
                onChange={(name) => setDraft({ ...draft, name })}
              />
              <ZoneField
                label="当地时间"
                value={draft.timezone}
                onChange={(timezone) => setDraft({ ...draft, timezone })}
              />
              <CurrencyField
                label="当地币种"
                value={draft.currency}
                onChange={(currency) =>
                  setDraft({
                    ...draft,
                    currency: currency as Destination["currency"],
                  })
                }
              />
              <button
                type="button"
                className="secondary-button"
                disabled={!draft.name.trim()}
                onClick={() => add({ ...draft, name: draft.name.trim() })}
              >
                添加这个目的地
              </button>
            </div>
          )}
        </>
      )}
      {!adding && value.length < 20 && (
        <button
          type="button"
          className="text-action"
          onClick={() => setAdding(true)}
        >
          ＋ 添加其他目的地
        </button>
      )}
    </div>
  );
}
