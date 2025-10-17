"use client";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { observeInvoices, type InvoiceFilters } from "@/lib/invoices";
import type { InvoiceDoc } from "@/lib/models";
import { useAuth } from "@/components/auth/auth-provider";
import Link from "next/link";

export function RecentInvoices() {
  const { user, role } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);

  const filters: InvoiceFilters | undefined = useMemo(() => {
    if (!user) return undefined;
    if (role === "cashier") return { cashierUserId: user.uid };
    // Admin: limit to last 20 by date without extra filters
    return {};
  }, [user, role]);

  useEffect(() => {
    if (!user) return;
    const unsub = observeInvoices((list) => {
      // Sort desc by issuedAt and take top 20 for display
      const sorted = [...list].sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1)).slice(0, 20);
      setInvoices(sorted);
    }, filters);
    return () => { try { unsub(); } catch { } };
  }, [user, filters]);

  return (
    <Card className="p-0">
      <div className="px-6 pt-6 pb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold">Recent Invoices</h2>
        <div className="flex gap-2">
          <Link href="/invoices" className="h-9 px-4 rounded-md border text-sm font-medium flex items-center hover:bg-muted">View all</Link>
        </div>
      </div>
      <div className="px-6 pb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Issued</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground text-xs">{new Date(inv.issuedAt).toLocaleString()}</TableCell>
                <TableCell className="font-medium">
                  <Link href={`/invoices/${inv.id}`} className="hover:underline">{inv.invoiceNumber || inv.id}</Link>
                </TableCell>
                <TableCell className="text-sm">{inv.cashierName || inv.cashierUserId}</TableCell>
                <TableCell className="text-right">₹{inv.grandTotal.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  {inv.status === "paid" ? (
                    <Badge variant="success">Paid</Badge>
                  ) : inv.status === "partial" ? (
                    <Badge variant="warning">Partial</Badge>
                  ) : inv.status === "unpaid" ? (
                    <Badge variant="warning">Unpaid</Badge>
                  ) : (
                    <Badge variant="destructive">Void</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">No invoices yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
