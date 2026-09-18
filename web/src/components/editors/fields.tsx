"use client";
import {
  currencies,
  currencyNames,
  destinations,
  readableZone,
} from "../../../../shared/travel-options";
import { useId, useState } from "react";
import { ChoiceField } from "./choice-field";
export function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  maxLength = 500,
  min,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
  min?: string;
  placeholder?: string;
}) {
  const id = useId();
  const [error, setError] = useState("");
  return (
    <label>
      {label}
      <input
        aria-label={label}
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        min={min}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? id : undefined}
        onInvalid={(e) => {
          const input = e.currentTarget;
          const message = input.validity.rangeUnderflow
            ? `${label}不能早于 ${min}`
            : `请填写有效的${label}`;
          input.setCustomValidity(message);
          setError(message);
        }}
        onChange={(e) => {
          e.target.setCustomValidity("");
          setError("");
          onChange(e.target.value);
        }}
      />
      {error && (
        <small id={id} className="error-message" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
export function ZoneField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const zones = [
    ...new Set([
      ...destinations.map((d) => d.timezone),
      value,
      "UTC",
      ...Intl.supportedValuesOf("timeZone"),
    ]),
  ];
  return (
    <ChoiceField
      label={label}
      value={value}
      onChange={onChange}
      options={zones.map((z) => ({
        value: z,
        label: readableZone(z),
        search: z,
      }))}
    />
  );
}
export function CurrencyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ChoiceField
      label={label}
      value={value}
      onChange={onChange}
      options={currencies.map((c) => ({
        value: c,
        label: currencyNames[c],
        search: c,
      }))}
    />
  );
}
