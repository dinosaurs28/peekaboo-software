import * as XLSX from "xlsx";
import {
  buildGstr1B2bCsv,
  buildGstr1B2clCsv,
  buildGstr1B2csCsv,
  buildGstr1HsnCsv,
} from "@/lib/reports";

function csvToSheet(csv: string): XLSX.WorkSheet {
  const rows = csv.split("\n").map(row => row.split(","));
  return XLSX.utils.aoa_to_sheet(rows);
  // const wb = XLSX.read(csv, { type: "string" });
  // return wb.Sheets[wb.SheetNames[0]];
}

export async function buildGstr1Excel(
  fromIso: string,
  toIso: string
): Promise<Blob> {
  const workbook = XLSX.utils.book_new();

  const [b2b, b2cl, b2bcs, hsn] = await Promise.all([
    buildGstr1B2bCsv(fromIso, toIso),
    buildGstr1B2clCsv(fromIso, toIso),
    buildGstr1B2csCsv(fromIso, toIso),
    buildGstr1HsnCsv(fromIso, toIso),
  ]);

  XLSX.utils.book_append_sheet(workbook, csvToSheet(b2b), "b2b");
  XLSX.utils.book_append_sheet(workbook, csvToSheet(b2cl), "b2cl");
  XLSX.utils.book_append_sheet(workbook, csvToSheet(b2bcs), "b2bcs");
  XLSX.utils.book_append_sheet(workbook, csvToSheet(hsn), "hsn");

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
