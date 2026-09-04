const numberFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCount(value: number): string {
  return numberFormatter.format(Math.round(value));
}

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatCurrencyCompact(value: number): string {
  return compactCurrencyFormatter.format(value);
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatCellValue(key: string, value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "number") {
    return /amount|total|spent|value|revenue/i.test(key) ? formatCurrency(value) : formatCount(value);
  }
  if (typeof value === "string" && /date/i.test(key)) {
    return formatDate(value);
  }
  return String(value);
}
