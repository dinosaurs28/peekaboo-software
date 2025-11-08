"use client";
import React, { useEffect, useMemo } from "react";

export type ReceiptProps = {
  // Layout width in millimeters (e.g., 80 for thermal, 210 for A4 portrait)
  widthMm?: number; // legacy: used for both paper and content when specific values not provided
  paperWidthMm?: number; // page @page size (paper roll width)
  contentWidthMm?: number; // inner receipt content width (for gutters)
  safePaddingMm?: number; // optional horizontal safe padding inside content to avoid printer clipping
  // Header
  logoUrl?: string | null;
  businessName?: string | null;
  addressLines?: string[];
  gstin?: string | null;
  // Footer
  footerNote?: string | null;
  showReviewLink?: boolean;
  reviewUrl?: string | null;
  // Behavior
  autoPrint?: boolean;
  className?: string;
  children?: React.ReactNode;
  termsConditions?: string | null; // printed disclaimer below footer
};

export function Receipt({
  widthMm = 80,
  paperWidthMm,
  contentWidthMm,
  safePaddingMm,
  logoUrl,
  businessName,
  addressLines = [],
  gstin,
  footerNote,
  showReviewLink = false,
  reviewUrl,
  autoPrint = false,
  className,
  children,
  termsConditions,
}: ReceiptProps) {
  const paper = useMemo(() => {
    const w = Number(paperWidthMm ?? widthMm);
    if (!isFinite(w) || w <= 0) return 80;
    return Math.min(Math.max(w, 40), 210);
  }, [paperWidthMm, widthMm]);

  const content = useMemo(() => {
    const fallback = Number(widthMm);
    const cw = Number(contentWidthMm ?? fallback);
    const safe = (!isFinite(cw) || cw <= 0) ? 80 : Math.min(Math.max(cw, 40), 210);
    // Ensure content does not exceed paper width
    return Math.min(safe, paper);
  }, [contentWidthMm, widthMm, paper]);

  useEffect(() => {
    // Limit print to receipt content only on this page
    document.body.classList.add("receipt-print");
    let id: any;
    if (autoPrint) {
      id = setTimeout(() => window.print(), 300);
    }
    return () => {
      document.body.classList.remove("receipt-print");
      if (id) clearTimeout(id);
    };
  }, [autoPrint]);

  const hasAddress = (addressLines?.filter((l) => !!l && l.trim().length > 0).length || 0) > 0;

  return (
    <div
      id="receipt"
      className={("receipt " + (className || "")).trim()}
      style={{
        ["--receipt-paper-width-mm" as any]: `${paper}mm`,
        ["--receipt-content-width-mm" as any]: `${content}mm`,
        ["--receipt-safe-pad-mm" as any]: safePaddingMm && safePaddingMm > 0 ? `${safePaddingMm}mm` : undefined,
      }}
    >
      <div className="receipt-inner">
        {/* Header */}
        <div className="header">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="logo" />
          ) : null}
          {businessName ? <h2>{businessName}</h2> : null}
          {hasAddress && (
            <div>
              {addressLines!.map((line, i) => (
                <p className="address" key={i}>{line}</p>
              ))}
            </div>
          )}
          {gstin ? <p className="address">GSTIN: {gstin}</p> : null}
        </div>

        <div className="separator" />

        {/* Dynamic content from caller (items, totals, etc.) */}
        <div>{children}</div>

        <div className="separator" />

        {/* Footer */}
        <div className="footer">
          {showReviewLink && reviewUrl ? (
            <div className="break-all">
              <div className="mb-1">Review us:</div>
              <div className="underline">{reviewUrl}</div>
            </div>
          ) : null}
          {footerNote ? <div className="mt-1">{footerNote}</div> : null}
        </div>

        {termsConditions ? (
          <div className="terms" style={{ marginTop: '5mm', fontSize: 10, textAlign: 'center', whiteSpace: 'pre-wrap' }}>
            {termsConditions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Receipt;
