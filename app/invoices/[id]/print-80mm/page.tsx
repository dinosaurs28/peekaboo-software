"use client";
import { notFound } from "next/navigation";

export default function LegacyPrint80Removed() {
  // Route removed in favor of unified /invoices/receipt/[id]
  notFound();
  return null;
}
