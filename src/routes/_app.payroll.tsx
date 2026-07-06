import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { gas, type PayrollPreviewRow } from "@/lib/gas";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { COMPANY_NAME, autoTable, loadLogoDataUrl, newDoc } from "@/lib/pdf";
import { downloadBlob } from "@/lib/download";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_app/payroll")({
  head: () => ({ meta: [{ title: "Payroll — Textile ERP" }] }),
  component: PayrollPage,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function PayrollPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const monthYear = `${year}-${String(month).padStart(2, "0")}`;

  const [rows, setRows] = useState<PayrollPreviewRow[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  const previewMut = useMutation({
    mutationFn: () => gas<PayrollPreviewRow[]>("previewPayroll", { month_year: monthYear }),
    onSuccess: (d) => {
      setRows(d);
      setHasLoaded(true);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Unable to preview payroll."),
  });

  useEffect(() => {
    setHasLoaded(false);
    setRows([]);
  }, [monthYear]);

  const saveMut = useMutation({
    mutationFn: (input: {
      month_year: string;
      rows: Pick<
        PayrollPreviewRow,
        "emp_id" | "days_worked" | "gross_salary" | "advance_deduction" | "net_salary"
      >[];
    }) => gas("savePayroll", input),
    onSuccess: () => {
      toast.success("Payroll saved");
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Unable to save payroll."),
  });

  function updateRow(i: number, patch: Partial<PayrollPreviewRow>) {
    setRows((rs) =>
      rs.map((r, idx) => {
        if (idx !== i) return r;
        const merged = { ...r, ...patch };
        merged.net_salary = Math.max(
          0,
          Number(merged.gross_salary || 0) - Number(merged.advance_deduction || 0),
        );
        return merged;
      }),
    );
  }

  async function printPdf() {
    if (!rows.length) return;
    const doc = newDoc();
    const logo = await loadLogoDataUrl();
    doc.addImage(logo, "PNG", 40, 30, 50, 50);
    doc.setFontSize(16);
    doc.text(COMPANY_NAME, 100, 50);
    doc.setFontSize(11);
    doc.text(`Payroll — ${MONTHS[month - 1]} ${year}`, 100, 68);

    autoTable(doc, {
      startY: 100,
      head: [["ID", "Name", "Role", "Days", "Gross", "Advance", "Net", "Signature"]],
      body: rows.map((r) => [
        r.emp_id,
        r.name,
        r.role,
        String(r.days_worked),
        Number(r.gross_salary).toLocaleString(),
        Number(r.advance_deduction).toLocaleString(),
        Number(r.net_salary).toLocaleString(),
        "",
      ]),
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [30, 41, 59] },
      columnStyles: { 7: { cellWidth: 100 } },
    });
    const pdfBlob = doc.output("blob");
    downloadBlob(`Payroll-${monthYear}.pdf`, pdfBlob);
  }

  function exportExcel() {
    const data = rows.map((r) => ({
      ID: r.emp_id,
      Name: r.name,
      Role: r.role,
      Days: r.days_worked,
      Gross: r.gross_salary,
      Advance: r.advance_deduction,
      Net: r.net_salary,
      Signature: "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const excelBlob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(`Payroll-${monthYear}.xlsx`, excelBlob);
  }

  const totalGross = rows.reduce((s, r) => s + Number(r.gross_salary || 0), 0);
  const totalAdv = rows.reduce((s, r) => s + Number(r.advance_deduction || 0), 0);
  const totalNet = rows.reduce((s, r) => s + Number(r.net_salary || 0), 0);

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Pick year & month, process to load employees, then enter advance deductions and print."
        action={
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <Label className="text-xs">Year</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-28"
              />
            </div>
            <div>
              <Label className="text-xs">Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((n, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => previewMut.mutate()} disabled={previewMut.isPending}>
              {previewMut.isPending ? "Loading…" : "Process Payroll"}
            </Button>
          </div>
        }
      />
      <div className="p-8 space-y-4">
        {!hasLoaded && (
          <div className="text-sm text-muted-foreground">
            Click "Process Payroll" to load employee rows for {MONTHS[month - 1]} {year}.
          </div>
        )}
        {hasLoaded && (
          <>
            <div className="rounded-md border bg-card max-h-[70vh] overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:bg-card [&_thead]:z-10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right w-40">Advance Deduction</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Signature</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No employees.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((r, i) => (
                    <TableRow key={r.emp_id}>
                      <TableCell className="font-mono text-xs">{r.emp_id}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.role}</TableCell>
                      <TableCell className="text-right">
                        {Number(r.base_salary).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={r.days_worked}
                          onChange={(e) =>
                            updateRow(i, {
                              days_worked: Number(e.target.value),
                              gross_salary: Math.round(
                                (r.base_salary / 30) * Number(e.target.value),
                              ),
                            })
                          }
                          className="w-20 ml-auto text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(r.gross_salary).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={r.advance_deduction}
                          onChange={(e) =>
                            updateRow(i, { advance_deduction: Number(e.target.value) })
                          }
                          className="w-28 ml-auto text-right"
                        />
                        {r.outstanding_advance > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            Owed: {r.outstanding_advance.toLocaleString()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {Number(r.net_salary).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground italic text-xs">
                        __________
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm text-muted-foreground">
                Totals — Gross: <b>{totalGross.toLocaleString()}</b> · Advance:{" "}
                <b>{totalAdv.toLocaleString()}</b> · Net:{" "}
                <b className="text-foreground">{totalNet.toLocaleString()}</b>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={exportExcel} disabled={!rows.length}>
                  Export Excel
                </Button>
                <Button variant="outline" onClick={printPdf} disabled={!rows.length}>
                  Print PDF
                </Button>
                <Button
                  onClick={() =>
                    saveMut.mutate({
                      month_year: monthYear,
                      rows: rows.map((r) => ({
                        emp_id: r.emp_id,
                        days_worked: r.days_worked,
                        gross_salary: r.gross_salary,
                        advance_deduction: r.advance_deduction,
                        net_salary: r.net_salary,
                      })),
                    })
                  }
                  disabled={!rows.length || saveMut.isPending}
                >
                  {saveMut.isPending ? "Saving…" : "Save Payroll"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
