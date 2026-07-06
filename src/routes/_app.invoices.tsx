import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { gas, type Invoice, type Fabric2 } from "@/lib/gas";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { COMPANY_NAME, autoTable, drawWatermark, loadLogoDataUrl, newDoc } from "@/lib/pdf";
import { downloadBlob } from "@/lib/download";
import { optimisticAppend, optimisticRemove, tempId } from "@/lib/optimistic";

export const Route = createFileRoute("/_app/invoices")({
  head: () => ({ meta: [{ title: "Invoices — Textile ERP" }] }),
  component: InvoicesPage,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function InvoicesPage() {
  const qc = useQueryClient();
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => gas<Invoice[]>("listInvoices"),
  });
  const { data: fabrics = [] } = useQuery({
    queryKey: ["inventory-all"],
    queryFn: () => gas<Fabric2[]>("listInventory"),
  });

  const clients = useMemo(() => {
    const set = new Set(fabrics.map((f) => f.client_name).filter(Boolean));
    return Array.from(set);
  }, [fabrics]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    date: today(),
    client_name: "",
    phone_number: "",
    address: "",
    fabric_id: "",
    yards_printed: "",
    total_amount: "",
    notes: "",
  });

  const clientFabrics = fabrics.filter((f) => f.client_name === form.client_name);

  const addMut = useMutation({
    mutationFn: (input: Omit<Invoice, "invoice_id">) =>
      gas<{ invoice_id: string }>("addInvoice", input),
    onMutate: async (input) => {
      const optimistic: Invoice = {
        invoice_id: tempId("INV"),
        date: input.date,
        client_name: input.client_name,
        phone_number: input.phone_number,
        address: input.address,
        fabric_id: input.fabric_id,
        yards_printed: Number(input.yards_printed) || 0,
        total_amount: Number(input.total_amount) || 0,
        notes: input.notes,
      };
      toast.success("Invoice created");
      return await optimisticAppend<Invoice>(qc, ["invoices"], optimistic);
    },
    onSuccess: async (d, input) => {
      toast.success(`Invoice ${d.invoice_id} created`);
      const inv: Invoice = {
        invoice_id: d.invoice_id,
        date: input.date,
        client_name: input.client_name,
        phone_number: input.phone_number,
        address: input.address,
        fabric_id: input.fabric_id,
        yards_printed: Number(input.yards_printed),
        total_amount: Number(input.total_amount),
        notes: input.notes,
      };
      await printInvoicePdf(inv);
      setOpen(false);
      setForm({
        date: today(),
        client_name: "",
        phone_number: "",
        address: "",
        fabric_id: "",
        yards_printed: "",
        total_amount: "",
        notes: "",
      });
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["invoices"], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory-all"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const delMut = useMutation({
    mutationFn: (invoice_id: string) => gas("deleteInvoice", { invoice_id }),
    onMutate: async (id: string) => {
      toast.success("Removed");
      return await optimisticRemove<Invoice>(qc, ["invoices"], "invoice_id", id);
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["invoices"], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });

  async function printInvoicePdf(inv: Invoice) {
    const doc = newDoc();
    const logo = await loadLogoDataUrl();
    drawWatermark(doc, logo);
    doc.addImage(logo, "PNG", 40, 30, 60, 60);
    doc.setFontSize(18);
    doc.text(COMPANY_NAME, 110, 55);
    doc.setFontSize(10);
    doc.text("Textile Printing Services", 110, 72);

    doc.setFontSize(14);
    doc.text("INVOICE", 480, 50);
    doc.setFontSize(10);
    doc.text(`Invoice #: ${inv.invoice_id}`, 420, 70);
    doc.text(`Date: ${inv.date}`, 420, 85);
    doc.text(`Created: ${new Date().toLocaleString()}`, 420, 100);

    doc.setFontSize(11);
    doc.text(`Bill To: ${inv.client_name}`, 40, 140);
    doc.setFontSize(10);
    let yCursor = 156;
    if (inv.phone_number) {
      doc.text(`Phone: ${inv.phone_number}`, 40, yCursor);
      yCursor += 14;
    }
    if (inv.address) {
      const lines = doc.splitTextToSize(`Address: ${inv.address}`, 360);
      doc.text(lines, 40, yCursor);
      yCursor += lines.length * 12;
    }

    autoTable(doc, {
      startY: Math.max(170, yCursor + 10),
      head: [["Description", "Yards", "Amount"]],
      body: [
        [
          `Textile printing — Fabric ${inv.fabric_id || "—"}`,
          String(inv.yards_printed),
          Number(inv.total_amount).toLocaleString(),
        ],
      ],
      foot: [["", "Total", Number(inv.total_amount).toLocaleString()]],
      headStyles: { fillColor: [30, 41, 59] },
      footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 8 },
    });

    const sigY = doc.internal.pageSize.getHeight() - 120;
    doc.setDrawColor(120);
    doc.line(60, sigY, 240, sigY);
    doc.line(340, sigY, 520, sigY);
    doc.setFontSize(10);
    doc.text("Client Signature", 60, sigY + 16);
    doc.text("Manager Signature", 340, sigY + 16);

    const pdfBlob = doc.output("blob");
    downloadBlob(`Invoice-${inv.invoice_id}.pdf`, pdfBlob);
  }

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Issue an invoice per print job. Auto-deducts from client's fabric stock."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> New Invoice
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Invoice</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Client / Party</Label>
                  <Select
                    value={form.client_name}
                    onValueChange={(v) => setForm({ ...form, client_name: v, fabric_id: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          No clients yet — add a fabric lot first.
                        </div>
                      )}
                      {clients.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Phone Number</Label>
                    <Input
                      value={form.phone_number}
                      onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                </div>
                {form.client_name && (
                  <div>
                    <Label>Fabric Lot (optional — deducts stock)</Label>
                    <Select
                      value={form.fabric_id}
                      onValueChange={(v) => setForm({ ...form, fabric_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientFabrics.map((f) => (
                          <SelectItem key={f.fabric_id} value={f.fabric_id}>
                            {f.fabric_id} · {f.fabric_type} ({f.current_stock_yards} yd left)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Yards Printed</Label>
                    <Input
                      type="number"
                      value={form.yards_printed}
                      onChange={(e) => setForm({ ...form, yards_printed: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Price (Total)</Label>
                    <Input
                      type="number"
                      value={form.total_amount}
                      onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() =>
                    addMut.mutate({
                      date: form.date,
                      client_name: form.client_name,
                      phone_number: form.phone_number,
                      address: form.address,
                      fabric_id: form.fabric_id,
                      yards_printed: Number(form.yards_printed) || 0,
                      total_amount: Number(form.total_amount) || 0,
                      notes: form.notes,
                    })
                  }
                  disabled={
                    !form.client_name ||
                    !form.yards_printed ||
                    !form.total_amount ||
                    addMut.isPending
                  }
                >
                  {addMut.isPending ? "Saving…" : "Save & Print Invoice"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="p-8">
        <div className="rounded-md border bg-card max-h-[70vh] overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:bg-card [&_thead]:z-10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Fabric</TableHead>
                <TableHead className="text-right">Yards</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No invoices yet.
                  </TableCell>
                </TableRow>
              )}
              {invoices
                .slice()
                .reverse()
                .map((inv) => (
                  <TableRow key={inv.invoice_id}>
                    <TableCell className="font-mono text-xs">{inv.invoice_id}</TableCell>
                    <TableCell>{inv.date}</TableCell>
                    <TableCell className="font-medium">{inv.client_name}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.fabric_id || "—"}</TableCell>
                    <TableCell className="text-right">
                      {Number(inv.yards_printed).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {Number(inv.total_amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => printInvoicePdf(inv)}>
                        <Printer className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete invoice ${inv.invoice_id}?`))
                            delMut.mutate(inv.invoice_id);
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
    </>
  );
}
