"use client";
import React, { useMemo } from "react";
import { splitInclusive, round2 } from "@/lib/tax";

// Normalized line shape shared by the final receipt and the pre-checkout preview.
export type ReceiptLine = {
  name: string;
  qty: number;
  sp: number; // selling price per unit (tax-inclusive)
  mrp?: number; // MRP per unit; absent on invoices saved before MRP was recorded
  lineDiscount?: number; // per-item discount given by the cashier during billing (absolute)
  taxRatePct?: number;
};

type ComputedLine = ReceiptLine & {
  mrpUnit: number; // effective MRP per unit (never below SP)
  hasMrp: boolean;
  mrpGross: number; // mrpUnit * qty (shown for reference only)
  spGross: number; // sp * qty
  discount: number; // per-item billing discount only; MRP vs SP is not a discount
  net: number; // spGross - discount
};

function computeLine(l: ReceiptLine): ComputedLine {
  const qty = Number(l.qty) || 0;
  const sp = Number(l.sp) || 0;
  const rawMrp = Number(l.mrp);
  const hasMrp = Number.isFinite(rawMrp) && rawMrp > 0;
  // MRP is always above SP; anything else is bad data, so fall back to SP.
  const mrpUnit = hasMrp ? Math.max(rawMrp, sp) : sp;
  const discount = Number(l.lineDiscount || 0);
  const spGross = sp * qty;
  return { ...l, qty, sp, mrpUnit, hasMrp, mrpGross: mrpUnit * qty, spGross, discount, net: spGross - discount };
}

const fmt = (n: number) => n.toFixed(2);

export function ReceiptItems({ lines }: { lines: ReceiptLine[] }) {
  const rows = useMemo(() => lines.map(computeLine), [lines]);
  return (
    <>
      <div className="flex justify-between text-xs font-bold uppercase mb-2">
        <span>Item Description</span>
        <span>Amount</span>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((it, idx) => (
          <div key={idx} className="flex flex-col">
            <div className="font-bold text-sm leading-tight mb-0.5">{it.name}</div>

            {/* SP sits directly above MRP. The amount column is SP-based;
                MRP is printed for reference only. */}
            <div className="flex justify-between text-xs text-gray-700">
              <span>SP&nbsp;&nbsp;: {it.qty} x {fmt(it.sp)}</span>
              <span>{fmt(it.spGross)}</span>
            </div>
            {it.hasMrp && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>MRP: {it.qty} x {fmt(it.mrpUnit)}</span>
                <span>({fmt(it.mrpGross)})</span>
              </div>
            )}

            {it.discount > 0.004 && (
              <div className="flex justify-between text-xs text-gray-500 italic">
                <span>Item Disc.</span>
                <span>- {fmt(it.discount)}</span>
              </div>
            )}

            <div className="flex justify-between items-end mt-0.5">
              <span className="text-[10px] text-gray-400">
                {it.taxRatePct ? `(GST ${it.taxRatePct}%)` : ""}
              </span>
              <span className="font-bold text-sm">{fmt(it.net)}</span>
            </div>
            <div className="border-b border-dashed border-gray-300 mt-2" />
          </div>
        ))}
      </div>
    </>
  );
}

export function ReceiptTotals({
  lines,
  billDiscount,
  billDiscountLabel = "Bill Discount",
  billDiscountIsSaving = true,
  redeemedPoints,
  redeemedValue,
  grandTotal,
  showTax = true,
}: {
  lines: ReceiptLine[];
  billDiscount?: number;
  billDiscountLabel?: string;
  // false for exchange credit, which is not a discount the customer received
  billDiscountIsSaving?: boolean;
  redeemedPoints?: number;
  redeemedValue?: number;
  grandTotal: number;
  showTax?: boolean;
}) {
  const t = useMemo(() => {
    let mrp = 0, sp = 0, itemDisc = 0, base = 0, gst = 0;
    for (const l of lines.map(computeLine)) {
      mrp += l.mrpGross;
      sp += l.spGross;
      itemDisc += l.discount;
      const split = splitInclusive(l.sp, Number(l.taxRatePct || 0));
      base += split.base * l.qty;
      gst += split.gst * l.qty;
    }
    const bill = Number(billDiscount || 0);
    return {
      mrp: round2(mrp),
      sp: round2(sp),
      itemDisc: round2(itemDisc),
      bill: round2(bill),
      totalDisc: round2(itemDisc + (billDiscountIsSaving ? bill : 0)),
      base: round2(base),
      gst: round2(gst),
    };
  }, [lines, billDiscount, billDiscountIsSaving]);

  return (
    <div className="mt-2 text-xs flex flex-col gap-1">
      {t.mrp > t.sp && (
        <div className="flex justify-between text-gray-500">
          <span>Total MRP</span>
          <span>({fmt(t.mrp)})</span>
        </div>
      )}
      <div className="flex justify-between text-gray-600">
        <span>Subtotal (SP)</span>
        <span>{fmt(t.sp)}</span>
      </div>

      {t.itemDisc > 0 && (
        <div className="flex justify-between text-gray-600">
          <span>Item Discounts</span>
          <span>- {fmt(t.itemDisc)}</span>
        </div>
      )}

      {t.bill > 0 && (
        <div className="flex justify-between text-gray-600">
          <span>{billDiscountLabel}</span>
          <span>- {fmt(t.bill)}</span>
        </div>
      )}

      {redeemedPoints && redeemedPoints > 0 ? (
        <>
          <div className="flex justify-between text-gray-600">
            <span>Points Redeemed</span>
            <span>{redeemedPoints}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Loyalty Discount</span>
            <span>- {fmt(Number(redeemedValue || 0))}</span>
          </div>
        </>
      ) : null}

      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>Ex-Tax Value</span>
        <span>{fmt(t.base)}</span>
      </div>
      {showTax && (
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>Total GST</span>
          <span>{fmt(t.gst)}</span>
        </div>
      )}

      <div className="border-b-2 border-black my-1" />
      <div className="flex justify-between text-base font-extrabold uppercase">
        <span>Grand Total</span>
        <span>₹{fmt(grandTotal)}</span>
      </div>
      <div className="border-b-2 border-black mb-1" />

      {t.totalDisc > 0 && (
        <div className="flex justify-between text-sm font-bold border border-dashed border-gray-500 px-2 py-1 mt-1">
          <span>Total Discount</span>
          <span>₹{fmt(t.totalDisc)}</span>
        </div>
      )}
    </div>
  );
}
