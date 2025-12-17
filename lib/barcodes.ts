// Helpers for encoding/decoding our barcodes
// Current format: PB|CAT|SKU  (e.g., PB|CLO|TSH-M-BLUE)

export type DecodedBarcode = {
  type: 'pos';
  category?: string;
  sku: string;
};

export function decodeBarcode(input: string): DecodedBarcode | null {
  if (!input) return null;
  
  // Fix Code 128 character set issue: equals signs should be hyphens
  const normalized = input.replace(/=/g, '-').trim();
  
  // Try PB|CAT|SKU pattern
  const parts = normalized.split('|');
  if (parts.length === 3 && parts[0] === 'PB') {
    const [, cat, sku] = parts;
    if (sku) return { type: 'pos', category: cat || undefined, sku };
  }
  
  // Fallback: assume the entire input is the SKU
  return { type: 'pos', sku: normalized };
}
