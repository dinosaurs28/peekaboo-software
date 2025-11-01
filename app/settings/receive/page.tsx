"use client";
import React from "react";

export default function ReceiveStockPage() {
  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto border rounded-lg bg-white p-6">
        <h1 className="text-xl font-semibold">Receive Stock</h1>
        <p className="text-sm text-muted-foreground mt-2">
          This feature has been removed. Please use alternative workflows for stock adjustments. A new solution will be provided later.
        </p>
        <div className="mt-4">
          <a href="/settings" className="inline-block h-9 px-4 rounded-md border text-sm hover:bg-gray-50">Back to Settings</a>
        </div>
      </div>
    </div>
  );
}
