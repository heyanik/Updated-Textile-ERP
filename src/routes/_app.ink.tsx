import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { gas, type InkPurchase, type InkUsage } from "@/lib/gas";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet, FileText, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { COMPANY_NAME, autoTable, drawWatermark, loadLogoDataUrl, newDoc } from "@/lib/pdf";
import { downloadBlob } from "@/lib/download";
import { toast } from "sonner";
import { optimisticAppend, optimisticRemove, tempId } from "@/lib/optimistic";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_app/ink")({
  head: () => ({ meta: [{ title: "Ink — Textile ERP" }] }),
  component: InkPage,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}
function ym(s: string) {
  return (s || "").slice(0, 7);
}

const PRESET_COLORS = [
  "Cyan",
  "Magenta",
  "Yellow",
  "Black",
  "Red",
  "Orange",
  "Green",
];
const COLOR_SWATCH: Record<string, string> = {
  Cyan: "#06b6d4",
  Magenta: "#d946ef",
  Yellow: "#eab308",
  Black: "#171717",
  Red: "#dc2626",
  Orange: "#f97316",
  Green: "#22c55e",
};
function swatch(c?: string) {
  const color = COLOR_SWATCH[c || ""] || "#94a3b8";
  return <span className="inline-block size-3 rounded-full border" style={{ background: color }} />;
}

function InkPage() {
  const qc = useQueryClient();
  const { data: purchases = [] } = useQuery({
    queryKey: ["ink-purchases"],
    queryFn: () => gas<InkPurchase[]>("listInkPurchases"),
  });
  const { data: usage = [] } = useQuery({
    queryKey: ["ink-usage"],
    queryFn: () => gas<InkUsage[]>("listInkUsage"),
  });

  const totalPurchasedMl = purchases.reduce((s, r) => s + Number(r.quantity_ml || 0), 0);
  const totalPurchasedCost = purchases.reduce((s, r) => s + Number(r.total_cost || 0), 0);
  const totalUsedMl = usage.reduce((s, r) => s + Number(r.quantity_ml || 0), 0);
  const avgRate = totalPurchasedMl ? totalPurchasedCost / totalPurchasedMl : 0;

  const purchasedColors = useMemo(
    () => Array.from(new Set(purchases.map((p) => p.color).filter(Boolean) as string[])).sort(),
    [purchases],
  );

  const perColor = useMemo(() => {
    const map: Record<
      string,
      { color: string; purchased: number; used: number; remaining: number }
    > = {};
    const ensure = (c: string) => (map[c] ||= { color: c, purchased: 0, used: 0, remaining: 0 });
    purchases.forEach((p) => {
      ensure(p.color || "Unspecified").purchased += Number(p.quantity_ml || 0);
    });
    usage.forEach((u) => {
      ensure(u.color || "Unspecified").used += Number(u.quantity_ml || 0);
    });
    Object.values(map).forEach((r) => {
      r.remaining = r.purchased - r.used;
    });
    return Object.values(map).sort((a, b) => a.color.localeCompare(b.color));
  }, [purchases, usage]);

  const monthlyUsage = useMemo(() => {
    const m: Record<string, number> = {};
    usage.forEach((u) => {
      m[ym(u.date)] = (m[ym(u.date)] || 0) + Number(u.quantity_ml || 0);
    });
    return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0]));
  }, [usage]);

  const [pForm, setPForm] = useState({
    date: today(),
    color: "",
    color_other: "",
    quantity_ml: "",
    rate_per_ml: "",
    supplier: "",
  });
  const [uForm, setUForm] = useState({ date: today(), color: "", quantity_ml: "", note: "" });
  const [usageColorFilter, setUsageColorFilter] = useState<string>("__all__");
  const [purchaseMonthFilterOpen, setPurchaseMonthFilterOpen] = useState(false);
  const [purchaseYear, setPurchaseYear] = useState(String(new Date().getFullYear()));
  const [purchaseMonth, setPurchaseMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [usageMonthFilterOpen, setUsageMonthFilterOpen] = useState(false);
  const [usageYear, setUsageYear] = useState(String(new Date().getFullYear()));
  const [usageMonth, setUsageMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));

  const purchaseMut = useMutation({
    mutationFn: (input: {
      date: string;
      color: string;
      quantity_ml: number;
      rate_per_ml: number;
      supplier: string;
    }) => gas("addInkPurchase", input),
    onMutate: async (input) => {
      const qty = Number(input.quantity_ml) || 0;
      const rate = Number(input.rate_per_ml) || 0;
      const optimistic: InkPurchase = {
        purchase_id: tempId("INKP"),
        date: input.date,
        color: input.color,
        quantity_ml: qty,
        rate_per_ml: rate,
        total_cost: qty * rate,
        supplier: input.supplier,
      };
      setPForm({
        date: today(),
        color: "",
        color_other: "",
        quantity_ml: "",
        rate_per_ml: "",
        supplier: "",
      });
      toast.success("Ink purchase recorded");
      return await optimisticAppend<InkPurchase>(qc, ["ink-purchases"], optimistic);
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["ink-purchases"], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["ink-purchases"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const usageMut = useMutation({
    mutationFn: (input: { date: string; color: string; quantity_ml: number; note: string }) =>
      gas("addInkUsage", input),
    onMutate: async (input) => {
      const optimistic: InkUsage = {
        usage_id: tempId("INKU"),
        date: input.date,
        color: input.color,
        quantity_ml: Number(input.quantity_ml) || 0,
        note: input.note,
      };
      setUForm({ date: today(), color: "", quantity_ml: "", note: "" });
      toast.success("Ink usage recorded");
      return await optimisticAppend<InkUsage>(qc, ["ink-usage"], optimistic);
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["ink-usage"], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["ink-usage"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const delPurchaseMut = useMutation({
    mutationFn: (purchase_id: string) => gas("deleteInkPurchase", { purchase_id }),
    onMutate: async (id: string) => {
      toast.success("Removed");
      return await optimisticRemove<InkPurchase>(qc, ["ink-purchases"], "purchase_id", id);
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["ink-purchases"], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["ink-purchases"] }),
  });
  const delUsageMut = useMutation({
    mutationFn: (usage_id: string) => gas("deleteInkUsage", { usage_id }),
    onMutate: async (id: string) => {
      toast.success("Removed");
      return await optimisticRemove<InkUsage>(qc, ["ink-usage"], "usage_id", id);
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["ink-usage"], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["ink-usage"] }),
  });

  const filteredUsage =
    usageColorFilter === "__all__"
      ? usage
      : usage.filter((u) => (u.color || "") === usageColorFilter);

  const purchaseYearOptions = Array.from(
    new Set(purchases.map((p) => (p.date || "").slice(0, 4)).filter(Boolean)),
  ).sort((a, b) => Number(b) - Number(a));
  const usageYearOptions = Array.from(
    new Set(usage.map((u) => (u.date || "").slice(0, 4)).filter(Boolean)),
  ).sort((a, b) => Number(b) - Number(a));

  const selectedPurchaseMonthKey = `${purchaseYear}-${purchaseMonth}`;
  const filteredPurchaseRows = purchases.filter((p) => ym(p.date) === selectedPurchaseMonthKey);
  const selectedPurchaseSummary = filteredPurchaseRows.reduce(
    (acc, p) => ({
      totalQty: acc.totalQty + Number(p.quantity_ml || 0),
      totalCost: acc.totalCost + Number(p.total_cost || 0),
    }),
    { totalQty: 0, totalCost: 0 },
  );

  const selectedUsageMonthKey = `${usageYear}-${usageMonth}`;
  const filteredUsageRows = usage.filter((u) => ym(u.date) === selectedUsageMonthKey);
  const selectedUsageSummary = filteredUsageRows.reduce(
    (acc, u) => ({
      totalQty: acc.totalQty + Number(u.quantity_ml || 0),
      totalCost: acc.totalCost + Number(u.quantity_ml || 0) * avgRate,
    }),
    { totalQty: 0, totalCost: 0 },
  );

  const purchaseDownloadRows = filteredPurchaseRows.map((p) => ({
    Date: p.date,
    Color: p.color || "—",
    Supplier: p.supplier || "—",
    "Quantity (ltr)": Number(p.quantity_ml || 0),
    "Rate / ltr": Number(p.rate_per_ml || 0),
    Cost: Number(p.total_cost || 0),
  }));
  const usageDownloadRows = filteredUsageRows.map((u) => ({
    Date: u.date,
    Color: u.color || "—",
    "Quantity (ltr)": Number(u.quantity_ml || 0),
    Note: u.note || "—",
  }));

  async function exportInkReport(format: "excel" | "pdf", kind: "purchase" | "usage") {
    const rows = kind === "purchase" ? purchaseDownloadRows : usageDownloadRows;
    if (!rows.length) return;

    const fileNameBase = `${kind}-${kind === "purchase" ? selectedPurchaseMonthKey : selectedUsageMonthKey}`;
    const title = kind === "purchase" ? "Ink Purchase Report" : "Ink Usage Report";
    const columns = kind === "purchase"
      ? [
          ["Date", "Color", "Supplier", "Quantity (ltr)", "Rate / ltr", "Cost"],
        ]
      : [["Date", "Color", "Quantity (ltr)", "Note"]];

    if (format === "excel") {
      const worksheet = XLSX.utils.aoa_to_sheet([
        [title],
        ["Issue Date", new Date().toLocaleDateString()],
        [],
        ...columns,
        ...rows.map((row) =>
          kind === "purchase"
            ? [
                row.Date,
                row.Color,
                row.Supplier,
                row["Quantity (ltr)"],
                row["Rate / ltr"],
                row.Cost,
              ]
            : [row.Date, row.Color, row["Quantity (ltr)"], row.Note],
        ),
      ]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, title);
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const excelBlob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      await downloadBlob(`${fileNameBase}.xlsx`, excelBlob);
      return;
    }

    const doc = newDoc();
    const logo = await loadLogoDataUrl();
    drawWatermark(doc, logo);
    doc.addImage(logo, "PNG", 40, 30, 60, 60);
    doc.setFontSize(18);
    doc.text(COMPANY_NAME, 110, 55);
    doc.setFontSize(10);
    doc.text("Ink Report", 110, 72);
    doc.setFontSize(12);
    doc.text(title, 40, 120);
    doc.text(`Issue Date: ${new Date().toLocaleDateString()}`, 420, 120);

    autoTable(doc, {
      startY: 150,
      head: columns,
      body: rows.map((row) =>
        kind === "purchase"
          ? [
              row.Date,
              row.Color,
              row.Supplier,
              String(row["Quantity (ltr)"]),
              String(row["Rate / ltr"]),
              String(row.Cost),
            ]
          : [row.Date, row.Color, String(row["Quantity (ltr)"]), String(row.Note)],
      ),
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 9, cellPadding: 6 },
    });

    const pdfBlob = doc.output("blob");
    await downloadBlob(`${fileNameBase}.pdf`, pdfBlob);
  }

  return (
    <>
      <PageHeader title="Ink" description="Track ink purchases and consumption." />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {perColor.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="pt-6 text-sm text-muted-foreground text-center">
                No ink data yet — add a purchase below.
              </CardContent>
            </Card>
          )}
          {perColor.map((c) => (
            <Card key={c.color}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {swatch(c.color)} {c.color}
                </div>
                <div className="text-lg font-semibold mt-2">
                  {c.remaining.toLocaleString()} ltr left
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Buy {c.purchased.toLocaleString()} · Used {c.used.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="purchase">
          <TabsList>
            <TabsTrigger value="purchase">Add Ink</TabsTrigger>
            <TabsTrigger value="usage">Ink Usage</TabsTrigger>
          </TabsList>

          <TabsContent value="purchase" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                Review purchase totals by month and export the selected month’s list.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPurchaseMonthFilterOpen((v) => !v)}>
                  {purchaseMonthFilterOpen ? "Hide month filter" : "Show month filter"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportInkReport("excel", "purchase")}
                  disabled={purchaseMonthFilterOpen ? purchaseDownloadRows.length === 0 : purchases.length === 0}
                >
                  <FileSpreadsheet className="mr-2 size-4" /> Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportInkReport("pdf", "purchase")}
                  disabled={purchaseMonthFilterOpen ? purchaseDownloadRows.length === 0 : purchases.length === 0}
                >
                  <FileText className="mr-2 size-4" /> PDF
                </Button>
              </div>
            </div>

            {purchaseMonthFilterOpen && (
              <Card>
                <CardContent className="pt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                    <div>
                      <Label>Year</Label>
                      <Select value={purchaseYear} onValueChange={setPurchaseYear}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {purchaseYearOptions.map((year) => (
                            <SelectItem key={year} value={year}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Month</Label>
                      <Select value={purchaseMonth} onValueChange={setPurchaseMonth}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((month) => (
                            <SelectItem key={month} value={month}>
                              {new Date(2000, Number(month) - 1, 1).toLocaleString("en", { month: "long" })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/30 px-4 py-3 min-w-56">
                    <div className="text-xs text-muted-foreground">Selected month total</div>
                    <div className="text-xl font-semibold mt-1">
                      {selectedPurchaseSummary.totalQty.toLocaleString()} ltr
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Cost: {selectedPurchaseSummary.totalCost.toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={pForm.date}
                    onChange={(e) => setPForm({ ...pForm, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <Select
                    value={pForm.color}
                    onValueChange={(v) => setPForm({ ...pForm, color: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESET_COLORS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                      <SelectItem value="Other">Other…</SelectItem>
                    </SelectContent>
                  </Select>
                  {pForm.color === "Other" && (
                    <Input
                      className="mt-2"
                      placeholder="Custom color"
                      value={pForm.color_other}
                      onChange={(e) => setPForm({ ...pForm, color_other: e.target.value })}
                    />
                  )}
                </div>
                <div>
                  <Label>Quantity (l)</Label>
                  <Input
                    type="number"
                    value={pForm.quantity_ml}
                    onChange={(e) => setPForm({ ...pForm, quantity_ml: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Rate / l</Label>
                  <Input
                    type="number"
                    value={pForm.rate_per_ml}
                    onChange={(e) => setPForm({ ...pForm, rate_per_ml: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Supplier</Label>
                  <Input
                    value={pForm.supplier}
                    onChange={(e) => setPForm({ ...pForm, supplier: e.target.value })}
                  />
                </div>
                <Button
                  onClick={() =>
                    purchaseMut.mutate({
                      date: pForm.date,
                      color: pForm.color === "Other" ? pForm.color_other : pForm.color,
                      quantity_ml: Number(pForm.quantity_ml) || 0,
                      rate_per_ml: Number(pForm.rate_per_ml) || 0,
                      supplier: pForm.supplier,
                    })
                  }
                  disabled={
                    !pForm.quantity_ml ||
                    !pForm.rate_per_ml ||
                    !pForm.color ||
                    (pForm.color === "Other" && !pForm.color_other) ||
                    purchaseMut.isPending
                  }
                >
                  {purchaseMut.isPending ? "Saving…" : "Add Purchase"}
                </Button>
              </CardContent>
            </Card>
            <div className="rounded-md border bg-card max-h-[70vh] overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:bg-card [&_thead]:z-10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Qty (l)</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(purchaseMonthFilterOpen ? filteredPurchaseRows : purchases).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        {purchaseMonthFilterOpen ? "No purchases found for the selected month." : "No purchases yet."}
                      </TableCell>
                    </TableRow>
                  )}
                  {(purchaseMonthFilterOpen ? filteredPurchaseRows : purchases)
                    .slice()
                    .reverse()
                    .map((p) => (
                      <TableRow key={p.purchase_id}>
                        <TableCell className="font-mono text-xs">{p.purchase_id}</TableCell>
                        <TableCell>{p.date}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-2">
                            {swatch(p.color)} {p.color || "—"}
                          </span>
                        </TableCell>
                        <TableCell>{p.supplier || "—"}</TableCell>
                        <TableCell className="text-right">
                          {Number(p.quantity_ml).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(p.rate_per_ml).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {Number(p.total_cost).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Delete this purchase?"))
                                delPurchaseMut.mutate(p.purchase_id);
                            }}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="usage" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                Review usage totals by month and export the selected month’s records.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setUsageMonthFilterOpen((v) => !v)}>
                  {usageMonthFilterOpen ? "Hide month filter" : "Show month filter"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportInkReport("excel", "usage")}
                  disabled={usageMonthFilterOpen ? usageDownloadRows.length === 0 : usage.length === 0}
                >
                  <FileSpreadsheet className="mr-2 size-4" /> Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportInkReport("pdf", "usage")}
                  disabled={usageMonthFilterOpen ? usageDownloadRows.length === 0 : usage.length === 0}
                >
                  <FileText className="mr-2 size-4" /> PDF
                </Button>
              </div>
            </div>

            {usageMonthFilterOpen && (
              <Card>
                <CardContent className="pt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                    <div>
                      <Label>Year</Label>
                      <Select value={usageYear} onValueChange={setUsageYear}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {usageYearOptions.map((year) => (
                            <SelectItem key={year} value={year}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Month</Label>
                      <Select value={usageMonth} onValueChange={setUsageMonth}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((month) => (
                            <SelectItem key={month} value={month}>
                              {new Date(2000, Number(month) - 1, 1).toLocaleString("en", { month: "long" })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/30 px-4 py-3 min-w-56">
                    <div className="text-xs text-muted-foreground">Selected month total</div>
                    <div className="text-xl font-semibold mt-1">
                      {selectedUsageSummary.totalQty.toLocaleString()} ltr
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Est. cost: {selectedUsageSummary.totalCost.toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={uForm.date}
                    onChange={(e) => setUForm({ ...uForm, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <Select
                    value={uForm.color}
                    onValueChange={(v) => setUForm({ ...uForm, color: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick" />
                    </SelectTrigger>
                    <SelectContent>
                      {purchasedColors.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          Add a purchase first
                        </div>
                      )}
                      {purchasedColors.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantity Used (l)</Label>
                  <Input
                    type="number"
                    value={uForm.quantity_ml}
                    onChange={(e) => setUForm({ ...uForm, quantity_ml: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Note</Label>
                  <Input
                    value={uForm.note}
                    onChange={(e) => setUForm({ ...uForm, note: e.target.value })}
                  />
                </div>
                <Button
                  onClick={() =>
                    usageMut.mutate({
                      date: uForm.date,
                      color: uForm.color,
                      quantity_ml: Number(uForm.quantity_ml) || 0,
                      note: uForm.note,
                    })
                  }
                  disabled={!uForm.quantity_ml || !uForm.color || usageMut.isPending}
                >
                  {usageMut.isPending ? "Saving…" : "Add Usage"}
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-md border bg-card max-h-[70vh] overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:bg-card [&_thead]:z-10">
                <div className="px-4 py-3 border-b text-sm font-medium">
                  Monthly Cost (using avg rate {avgRate.toFixed(2)}/l)
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Used (l)</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyUsage.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          No usage yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {monthlyUsage.map(([m, qty]) => (
                      <TableRow key={m}>
                        <TableCell>{m}</TableCell>
                        <TableCell className="text-right">{qty.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {Math.round(qty * avgRate).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="rounded-md border bg-card max-h-[70vh] overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:bg-card [&_thead]:z-10">
                <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between gap-3">
                  <span>Recent Usage</span>
                  <Select value={usageColorFilter} onValueChange={setUsageColorFilter}>
                    <SelectTrigger className="w-40 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All colors</SelectItem>
                      {purchasedColors.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsage.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No usage yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredUsage
                      .slice()
                      .reverse()
                      .slice(0, 50)
                      .map((u) => (
                        <TableRow key={u.usage_id}>
                          <TableCell>{u.date}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2">
                              {swatch(u.color)} {u.color || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(u.quantity_ml).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{u.note}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm("Delete this entry?")) delUsageMut.mutate(u.usage_id);
                              }}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium mb-4">Ink by Color (l)</div>
            <div className="w-full h-72">
              {perColor.length === 0 ? (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">
                  No data to chart.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perColor}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="color" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 6,
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="purchased"
                      name="Purchased"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar dataKey="used" name="Used" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar
                      dataKey="remaining"
                      name="Remaining"
                      fill="#22c55e"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card> */}
      </div>
    </>
  );
}
