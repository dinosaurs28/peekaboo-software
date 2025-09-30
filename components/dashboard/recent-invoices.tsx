import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface InvoiceRow {
  customerName: string;
  invoiceId: string;
  amount: string;
  status: 'Paid' | 'Pending';
}

const data: InvoiceRow[] = [
  { customerName: 'Sophia Carter', invoiceId: '#INV-001', amount: '$1,200', status: 'Paid' },
  { customerName: 'Ethan Bennett', invoiceId: '#INV-002', amount: '$850', status: 'Pending' },
  { customerName: 'Olivia Hayes', invoiceId: '#INV-003', amount: '$500', status: 'Paid' },
];

export function RecentInvoices() {
  return (
    <Card className="p-0">
      <div className="px-6 pt-6 pb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold">Recent Invoices</h2>
        <div className="flex gap-2">
          <button className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Create Invoice</button>
          <button className="h-9 px-4 rounded-md border text-sm font-medium hover:bg-muted">Add Customer</button>
        </div>
      </div>
      <div className="px-6 pb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Customer Name</TableHead>
              <TableHead>Invoice ID</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.invoiceId}>
                <TableCell>{row.customerName}</TableCell>
                <TableCell>{row.invoiceId}</TableCell>
                <TableCell>{row.amount}</TableCell>
                <TableCell className="text-right">
                  {row.status === 'Paid' ? (
                    <Badge variant="success">Paid</Badge>
                  ) : (
                    <Badge variant="warning">Pending</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
