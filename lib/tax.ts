"use client";

// Split a tax-inclusive unit price into base (ex-tax) and GST parts.
// Uses the mathematically correct inclusive split: base * (1 + r) = price
// where r = taxPct/100. Returns rounded to 2 decimals at the caller when needed.
export function splitInclusive(price: number, taxPct: number) {
  const p = Number(price) || 0;
  const r = (Number(taxPct) || 0) / 100;
  if (r <= 0) return { base: p, gst: 0 };
  const base = p / (1 + r);
  const gst = p - base;
  return { base, gst };
}

export function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
