"use client";
export const currencyOptions = [
  "CNY",
  "NZD",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "CAD",
  "SGD",
  "HKD",
];
export const timezones = [
  "Asia/Shanghai",
  "Pacific/Auckland",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];
export function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  maxLength = 500,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label>
      {label}
      <input
        aria-label={label}
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
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
  return (
    <label>
      {label}
      <input
        aria-label={label}
        list="timezones"
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id="timezones">
        {timezones.map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>
    </label>
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
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {currencyOptions.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
    </label>
  );
}
