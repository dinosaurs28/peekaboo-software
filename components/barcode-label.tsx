"use client";
import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { categoryCode } from "@/lib/models";
import type { CategoryDoc, ProductDoc } from "@/lib/models";

// Single source of truth for the 50 x 25 mm product label.
// Used by both the Settings preview and the print page so they always match.

export const LABEL_W_MM = 50;
export const LABEL_H_MM = 25;
const PAD_TOP_MM = 1.2;
const PAD_X_MM = 1.5;
const PAD_BOTTOM_MM = 0.8;
const CONTENT_W_MM = LABEL_W_MM - PAD_X_MM * 2; // 47
const CONTENT_H_MM = LABEL_H_MM - PAD_TOP_MM - PAD_BOTTOM_MM; // 23

// Vertical budget inside the 23 mm content box (rows + gaps sum to CONTENT_H_MM).
const ROW_GAP_MM = 0.4;
const NAME_ROW_MM = 2.8; // 7pt bold
const MRP_ROW_MM = 3.6; // 10pt bold
const FOOTER_ROW_MM = 2.2; // SP + code
const BARCODE_ROW_MM = CONTENT_H_MM - NAME_ROW_MM - MRP_ROW_MM - FOOTER_ROW_MM - ROW_GAP_MM * 3; // 13.2

// Code 128 needs a quiet zone of 10 modules on each side.
const QUIET_ZONE_MODULES = 10;

// Per-printer calibration: moves the printed content without changing its size.
const OFFSET_KEY = "labels.printOffsetMm";
export type LabelOffset = { x: number; y: number };

export function loadLabelOffset(): LabelOffset {
  try {
    const raw = localStorage.getItem(OFFSET_KEY);
    if (!raw) return { x: 0, y: 0 };
    const v = JSON.parse(raw);
    const clamp = (n: unknown) => Math.max(-5, Math.min(5, Number(n) || 0));
    return { x: clamp(v?.x), y: clamp(v?.y) };
  } catch {
    return { x: 0, y: 0 };
  }
}

export function saveLabelOffset(o: LabelOffset) {
  try { localStorage.setItem(OFFSET_KEY, JSON.stringify(o)); } catch { /* ignore */ }
}

export function encodeBarcode(p: ProductDoc, categories: CategoryDoc[]): string {
  const catName = p.category;
  let code = categoryCode(catName);
  if (catName) {
    const match = categories.find((c) => c.active && c.name.toLowerCase() === catName.toLowerCase());
    if (match?.code) code = match.code.toUpperCase();
  }
  return `PB|${code}|${p.sku}`;
}

// Draw at 1 unit per module, then let the SVG fill the exact mm box via its viewBox.
// Quiet zones are part of the drawing, so they stay inside the 47 mm width.
function drawBarcode(el: SVGSVGElement, code: string) {
  JsBarcode(el, code, {
    format: "CODE128B",
    displayValue: false,
    width: 1,
    height: 100,
    margin: 0, // marginTop/marginBottom: 0 alone is ignored (falsy) and falls back to the default 10
    marginTop: 0,
    marginBottom: 0,
    marginLeft: QUIET_ZONE_MODULES,
    marginRight: QUIET_ZONE_MODULES,
  });
  el.setAttribute("width", "100%");
  el.setAttribute("height", "100%");
  el.setAttribute("preserveAspectRatio", "none");
}

export function BarcodeLabel({
  product,
  code,
  offset,
  onDrawn,
  className,
}: {
  product: ProductDoc;
  code: string;
  offset?: LabelOffset; // print calibration only
  onDrawn?: () => void;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !code) return;
    try {
      drawBarcode(svgRef.current, code);
      onDrawn?.();
    } catch (e) {
      console.error("Barcode render failed", e);
    }
  }, [code, onDrawn]);

  const mrp = product.mrp ?? product.unitPrice;
  const sp = product.unitPrice;

  return (
    <div
      className={("label " + (className || "")).trim()}
      style={{
        width: `${LABEL_W_MM}mm`,
        height: `${LABEL_H_MM}mm`,
        padding: `${PAD_TOP_MM}mm ${PAD_X_MM}mm ${PAD_BOTTOM_MM}mm`,
        boxSizing: "border-box",
        overflow: "hidden",
        background: "#fff",
        color: "#000",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          width: `${CONTENT_W_MM}mm`,
          height: `${CONTENT_H_MM}mm`,
          display: "grid",
          gridTemplateRows: `${NAME_ROW_MM}mm ${MRP_ROW_MM}mm ${BARCODE_ROW_MM}mm ${FOOTER_ROW_MM}mm`,
          rowGap: `${ROW_GAP_MM}mm`,
          overflow: "hidden",
          transform: offset && (offset.x || offset.y) ? `translate(${offset.x}mm, ${offset.y}mm)` : undefined,
        }}
      >
        {/* 1. Name */}
        <div style={{
          fontSize: "7pt",
          fontWeight: 700,
          lineHeight: `${NAME_ROW_MM}mm`,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textAlign: "center",
        }}>
          {product.name}
        </div>

        {/* 2. MRP (bold) */}
        <div style={{
          fontSize: "10pt",
          fontWeight: 800,
          lineHeight: `${MRP_ROW_MM}mm`,
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}>
          MRP - ₹{mrp.toFixed(0)}
        </div>

        {/* 3. Barcode: fills the full 47 x 13.2 mm box, quiet zones included */}
        <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
          <svg ref={svgRef} style={{ width: "100%", height: "100%", display: "block" }} />
        </div>

        {/* 4. SP & code */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "2mm",
          fontSize: "6pt",
          lineHeight: `${FOOTER_ROW_MM}mm`,
          overflow: "hidden",
        }}>
          <span style={{ flexShrink: 0, whiteSpace: "nowrap", fontSize: "7pt", fontWeight: 800 }}>
            SP - ₹{sp.toFixed(0)}
          </span>
          <span style={{
            minWidth: 0,
            fontFamily: "monospace",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {code}
          </span>
        </div>
      </div>
    </div>
  );
}
