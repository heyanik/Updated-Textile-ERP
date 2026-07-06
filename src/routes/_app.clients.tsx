import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { gas, type Fabric2 } from "@/lib/gas";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, Printer, FileSpreadsheet } from "lucide-react";
import { COMPANY_NAME, autoTable, drawWatermark, loadLogoDataUrl, newDoc } from "@/lib/pdf";
import { downloadBlob } from "@/lib/download";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_app/clients")({
  head: () => ({ meta: [{ title: "Clients — Textile ERP" }] }),
  component: ClientsPage,
});

type ClientSummary = {
  client_name: string;
  fabrics: Fabric2[];
  total_received: number;
  total_printed: number;
  total_stock: number;
};

function ClientsPage() {
  const { data: fabrics = [], isLoading } = useQuery({
    queryKey: ["inventory-all"],
    queryFn: () => gas<Fabric2[]>("listInventory"),
  });

  const summaries = useMemo<ClientSummary[]>(() => {
    const map = new Map<string, ClientSummary>();
    for (const f of fabrics) {
      if (!f.client_name) continue;
      const s = map.get(f.client_name) ?? {
        client_name: f.client_name,
        fabrics: [],
        total_received: 0,
        total_printed: 0,
        total_stock: 0,
      };
      s.fabrics.push(f);
      s.total_received += Number(f.total_yards_received) || 0;
      s.total_printed += Number(f.total_yards_printed) || 0;
      s.total_stock += Number(f.current_stock_yards) || 0;
      map.set(f.client_name, s);
    }
    return Array.from(map.values()).sort((a, b) => a.client_name.localeCompare(b.client_name));
  }, [fabrics]);

  const [active, setActive] = useState<ClientSummary | null>(null);

  async function printPdf(s: ClientSummary) {
    const doc = newDoc();
    const logo = await loadLogoDataUrl();
    drawWatermark(doc, logo);
    doc.addImage(logo, "PNG", 40, 30, 60, 60);
    doc.setFontSize(18);
    doc.text(COMPANY_NAME, 110, 55);
    doc.setFontSize(10);
    doc.text("Fabric Status Report", 110, 72);

    doc.setFontSize(14);
    doc.text("FABRIC STATUS", 430, 50);
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 430, 70);

    doc.setFontSize(12);
    doc.text(`Client: ${s.client_name}`, 40, 140);

    autoTable(doc, {
      startY: 160,
      head: [["Fabric ID", "Type", "Received On", "Received", "Printed", "Stock"]],
      body: s.fabrics.map((f) => [
        f.fabric_id,
        f.fabric_type,
        f.received_date,
        String(f.total_yards_received),
        String(f.total_yards_printed),
        String(f.current_stock_yards),
      ]),
      foot: [
        [
          "",
          "",
          "Totals",
          String(s.total_received),
          String(s.total_printed),
          String(s.total_stock),
        ],
      ],
      headStyles: { fillColor: [30, 41, 59] },
      footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 6 },
    });

    const sigY = doc.internal.pageSize.getHeight() - 120;
    doc.setDrawColor(120);
    doc.line(60, sigY, 240, sigY);
    doc.line(340, sigY, 520, sigY);
    doc.setFontSize(10);
    doc.text("Client Signature", 60, sigY + 16);
    doc.text("Manager Signature", 340, sigY + 16);

    const pdfBlob = doc.output("blob");
    downloadBlob(`Fabric-Status-${s.client_name}.pdf`, pdfBlob);
  }

  function exportExcel(s: ClientSummary) {
    const rows = s.fabrics.map((f) => ({
      "Fabric ID": f.fabric_id,
      Type: f.fabric_type,
      "Received On": f.received_date,
      Received: Number(f.total_yards_received) || 0,
      Printed: Number(f.total_yards_printed) || 0,
      Stock: Number(f.current_stock_yards) || 0,
    }));
    rows.push({
      "Fabric ID": "",
      Type: "",
      "Received On": "TOTALS",
      Received: s.total_received,
      Printed: s.total_printed,
      Stock: s.total_stock,
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, s.client_name.slice(0, 28) || "Client");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const excelBlob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(`Fabric-Status-${s.client_name}.xlsx`, excelBlob);
  }

  return (
    <>
      <PageHeader
        title="Clients"
        description="Tap a client to see their fabric history and totals."
      />
      <div className="p-8">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {!isLoading && summaries.length === 0 && (
          <p className="text-muted-foreground">No clients yet — add a fabric lot in Inventory.</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {summaries.map((s) => (
            <button
              key={s.client_name}
              onClick={() => setActive(s)}
              className="group rounded-lg border bg-card hover:border-primary hover:shadow-sm transition text-left p-4"
            >
              <div className="flex items-center gap-2 text-primary">
                <Building2 className="size-4" />
                <span className="font-semibold truncate">{s.client_name}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 text-xs">
                <div>
                  <div className="text-muted-foreground">Received</div>
                  <div className="font-medium">{s.total_received.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Printed</div>
                  <div className="font-medium">{s.total_printed.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Stock</div>
                  <div className="font-semibold text-foreground">
                    {s.total_stock.toLocaleString()}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{active?.client_name} — Fabric Status</DialogTitle>
          </DialogHeader>
          {active && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Total Received</div>
                  <div className="text-lg font-semibold">
                    {active.total_received.toLocaleString()} yd
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Total Printed</div>
                  <div className="text-lg font-semibold">
                    {active.total_printed.toLocaleString()} yd
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">In Stock</div>
                  <div className="text-lg font-semibold">
                    {active.total_stock.toLocaleString()} yd
                  </div>
                </div>
              </div>
              <div className="rounded-md border max-h-[50vh] overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:bg-card [&_thead]:z-10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fabric ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Received On</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Printed</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.fabrics.map((f) => (
                      <TableRow key={f.fabric_id}>
                        <TableCell className="font-mono text-xs">{f.fabric_id}</TableCell>
                        <TableCell>{f.fabric_type}</TableCell>
                        <TableCell className="text-xs">{f.received_date}</TableCell>
                        <TableCell className="text-right">
                          {Number(f.total_yards_received).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(f.total_yards_printed).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {Number(f.current_stock_yards).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => exportExcel(active)}>
                  <FileSpreadsheet className="size-4" /> Excel
                </Button>
                <Button onClick={() => printPdf(active)}>
                  <Printer className="size-4" /> Print PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
