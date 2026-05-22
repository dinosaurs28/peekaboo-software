// Helpers for encoding/decoding our barcodes
// Current format: PB|CAT|SKU  (e.g., PB|CLO|TSH-M-BLUE)

export type DecodedBarcode = {
  type: 'pos';
  category?: string;
  sku: string;
};

export function decodeBarcode(input: string): DecodedBarcode | null {
  if (!input) return null;

  // Fix Code 128 character set issue: equals signs should be hyphens.
  // Also trim whitespace and drop common line endings.
  const normalized = input.replace(/=/g, '-').replace(/[\r\n]+/g, '').trim();

  const parts = normalized.split('|').map((part) => part.trim());
  if (parts.length === 3 && parts[0].toUpperCase() === 'PB') {
    const [, cat, sku] = parts;
    if (sku) return { type: 'pos', category: cat || undefined, sku };
  }

  return { type: 'pos', sku: normalized };
}
