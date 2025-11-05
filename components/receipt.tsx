"use client";
import React, { useEffect, useMemo } from "react";

export type ReceiptProps = {
  // Layout width in millimeters (e.g., 80 for thermal, 210 for A4 portrait)
  widthMm?: number;
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
};

export function Receipt({
  widthMm = 80,
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
}: ReceiptProps) {
  const clampedWidth = useMemo(() => {
    const w = Number(widthMm);
    if (!isFinite(w) || w <= 0) return 80;
    return Math.min(Math.max(w, 40), 210);
  }, [widthMm]);

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
      style={{ ["--receipt-width-mm" as any]: `${clampedWidth}mm` }}
    >
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
    </div>
  );
}

export default Receipt;
