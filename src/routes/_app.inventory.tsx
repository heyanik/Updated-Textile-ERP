import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { gas, type Fabric2 } from "@/lib/gas";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { optimisticAppend, optimisticRemove, optimisticUpdate, tempId } from "@/lib/optimistic";

export const Route = createFileRoute("/_app/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Textile ERP" }] }),
  component: InventoryPage,
});

const MONTHS = [
  "All",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function InventoryPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(0); // 0 = All
  const [clientFilter, setClientFilter] = useState<string>("__all__");
  const params = { year, ...(month ? { month } : {}) };

  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ["inventory", year, month],
    queryFn: () => gas<Fabric2[]>("listInventory", params),
  });

  const clients = useMemo(
    () => Array.from(new Set(rawData.map((f) => f.client_name).filter(Boolean))).sort(),
    [rawData],
  );
  const data =
    clientFilter === "__all__" ? rawData : rawData.filter((f) => f.client_name === clientFilter);

  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<Fabric2 | null>(null);
  const [form, setForm] = useState({
    client_name: "",
    fabric_type: "White",
    total_yards_received: "",
    total_yards_printed: "0",
    received_date: today(),
  });

  const addMut = useMutation({
    mutationFn: (input: {
      client_name: string;
      fabric_type: string;
      received_date: string;
      total_yards_received: number;
      total_yards_printed: number;
    }) => gas("addFabric", input),
    onMutate: async (input) => {
      const rec = Number(input.total_yards_received) || 0;
      const pr = Number(input.total_yards_printed) || 0;
      const optimistic: Fabric2 = {
        fabric_id: tempId("FAB"),
        client_name: input.client_name,
        fabric_type: input.fabric_type,
        received_date: input.received_date,
        total_yards_received: rec,
        total_yards_printed: pr,
        current_stock_yards: rec - pr,
        cost_per_yard: 0,
      };
      setOpen(false);
      setForm({
        client_name: "",
        fabric_type: "White",
        total_yards_received: "",
        total_yards_printed: "0",
        received_date: today(),
      });
      toast.success("Fabric added");
      return await optimisticAppend<Fabric2>(qc, ["inventory", year, month], optimistic);
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["inventory", year, month], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory-all"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const editMut = useMutation({
    mutationFn: (input: {
      fabric_id: string;
      client_name: string;
      fabric_type: string;
      received_date: string;
      total_yards_received: number;
      total_yards_printed: number;
    }) => gas("updateFabric", input),
    onMutate: async (input) => {
      const rec = Number(input.total_yards_received) || 0;
      const pr = Number(input.total_yards_printed) || 0;
      const patch: Partial<Fabric2> = {
        client_name: input.client_name,
        fabric_type: input.fabric_type,
        received_date: input.received_date,
        total_yards_received: rec,
        total_yards_printed: pr,
        current_stock_yards: rec - pr,
      };
      const id = input.fabric_id;
      setEditRow(null);
      toast.success("Updated");
      return await optimisticUpdate<Fabric2>(
        qc,
        ["inventory", year, month],
        "fabric_id",
        id,
        patch,
      );
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["inventory", year, month], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory-all"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const delMut = useMutation({
    mutationFn: (fabric_id: string) => gas("deleteFabric", { fabric_id }),
    onMutate: async (id: string) => {
      toast.success("Removed");
      return await optimisticRemove<Fabric2>(qc, ["inventory", year, month], "fabric_id", id);
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["inventory", year, month], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory-all"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Fabric received per client. Edit a row to update printed yards as work completes."
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
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((n, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Client</Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All clients</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" /> Add Client / Fabric
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Fabric Lot</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Client Name</Label>
                    <Input
                      value={form.client_name}
                      onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Type of Fabric</Label>
                    <Input
                      value={form.fabric_type}
                      onChange={(e) => setForm({ ...form, fabric_type: e.target.value })}
                      placeholder="White, Gray, etc."
                    />
                  </div>
                  <div>
                    <Label>Received Date</Label>
                    <Input
                      type="date"
                      value={form.received_date}
                      onChange={(e) => setForm({ ...form, received_date: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Received Yards</Label>
                      <Input
                        type="number"
                        value={form.total_yards_received}
                        onChange={(e) => setForm({ ...form, total_yards_received: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Printed (start)</Label>
                      <Input
                        type="number"
                        value={form.total_yards_printed}
                        onChange={(e) => setForm({ ...form, total_yards_printed: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() =>
                      addMut.mutate({
                        client_name: form.client_name,
                        fabric_type: form.fabric_type,
                        received_date: form.received_date,
                        total_yards_received: Number(form.total_yards_received) || 0,
                        total_yards_printed: Number(form.total_yards_printed) || 0,
                      })
                    }
                    disabled={!form.client_name || !form.total_yards_received || addMut.isPending}
                  >
                    {addMut.isPending ? "Saving…" : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <div className="p-8">
        <div className="rounded-md border bg-card max-h-[70vh] overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:bg-card [&_thead]:z-10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Received On</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Printed</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No fabric lots for this period.
                  </TableCell>
                </TableRow>
              )}
              {data.map((f) => (
                <TableRow key={f.fabric_id}>
                  <TableCell className="font-mono text-xs">{f.fabric_id}</TableCell>
                  <TableCell className="font-medium">{f.client_name}</TableCell>
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
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditRow({ ...f })}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete fabric ${f.fabric_id}?`)) delMut.mutate(f.fabric_id);
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

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Fabric — {editRow?.fabric_id}</DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="space-y-3">
              <div>
                <Label>Client</Label>
                <Input
                  value={editRow.client_name}
                  onChange={(e) => setEditRow({ ...editRow, client_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Type</Label>
                <Input
                  value={editRow.fabric_type}
                  onChange={(e) => setEditRow({ ...editRow, fabric_type: e.target.value })}
                />
              </div>
              <div>
                <Label>Received Date</Label>
                <Input
                  type="date"
                  value={editRow.received_date}
                  onChange={(e) => setEditRow({ ...editRow, received_date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Received Yards</Label>
                  <Input
                    type="number"
                    value={editRow.total_yards_received}
                    onChange={(e) =>
                      setEditRow({ ...editRow, total_yards_received: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label>Printed Yards</Label>
                  <Input
                    type="number"
                    value={editRow.total_yards_printed}
                    onChange={(e) =>
                      setEditRow({ ...editRow, total_yards_printed: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() =>
                editRow &&
                editMut.mutate({
                  fabric_id: editRow.fabric_id,
                  client_name: editRow.client_name,
                  fabric_type: editRow.fabric_type,
                  received_date: editRow.received_date,
                  total_yards_received: Number(editRow.total_yards_received) || 0,
                  total_yards_printed: Number(editRow.total_yards_printed) || 0,
                })
              }
              disabled={editMut.isPending}
            >
              {editMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
