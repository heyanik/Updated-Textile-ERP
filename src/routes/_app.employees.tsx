import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { gas, type Employee } from "@/lib/gas";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Banknote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { optimisticAppend, optimisticRemove, optimisticUpdate, tempId } from "@/lib/optimistic";

export const Route = createFileRoute("/_app/employees")({
  head: () => ({ meta: [{ title: "Employees — Textile ERP" }] }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => gas<Employee[]>("listEmployees"),
  });
  const [open, setOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState<Employee | null>(null);
  const [form, setForm] = useState({ name: "", role: "", base_salary: "" });
  const [advAmount, setAdvAmount] = useState("");

  const addMut = useMutation({
    mutationFn: (input: { name: string; role: string; base_salary: number }) =>
      gas("addEmployee", input),
    onMutate: async (input) => {
      const optimistic: Employee = {
        emp_id: tempId("EMP"),
        name: input.name,
        role: input.role,
        base_salary: input.base_salary || 0,
        total_advance_given: 0,
        total_advance_deducted: 0,
      };
      setOpen(false);
      setForm({ name: "", role: "", base_salary: "" });
      toast.success("Employee added");
      return await optimisticAppend<Employee>(qc, ["employees"], optimistic);
    },
    onError: (e: any, _v, ctx) => {
      qc.setQueryData(["employees"], ctx?.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
  const advMut = useMutation({
    mutationFn: (input: { emp_id: string; amount: number }) => gas("addEmployeeAdvance", input),
    onMutate: async (input) => {
      const emp = data.find((row) => row.emp_id === input.emp_id);
      if (!emp) return;
      const amt = input.amount || 0;
      setAdvOpen(null);
      setAdvAmount("");
      toast.success("Advance recorded");
      return await optimisticUpdate<Employee>(qc, ["employees"], "emp_id", emp.emp_id, {
        total_advance_given: Number(emp.total_advance_given || 0) + amt,
      });
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["employees"], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
  const delMut = useMutation({
    mutationFn: (emp_id: string) => gas("deleteEmployee", { emp_id }),
    onMutate: async (emp_id: string) => {
      toast.success("Removed");
      return await optimisticRemove<Employee>(qc, ["employees"], "emp_id", emp_id);
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["employees"], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  return (
    <>
      <PageHeader
        title="Employees"
        description="Manage staff, roles, salaries, and advances."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Employee</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Input
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="Printer, Operator, etc."
                  />
                </div>
                <div>
                  <Label>Base Salary (monthly)</Label>
                  <Input
                    type="number"
                    value={form.base_salary}
                    onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() =>
                    addMut.mutate({
                      name: form.name,
                      role: form.role,
                      base_salary: Number(form.base_salary) || 0,
                    })
                  }
                  disabled={!form.name || addMut.isPending}
                >
                  {addMut.isPending ? "Saving…" : "Save"}
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
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Base Salary</TableHead>
                <TableHead className="text-right">Adv. Given</TableHead>
                <TableHead className="text-right">Adv. Deducted</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
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
                    No employees yet.
                  </TableCell>
                </TableRow>
              )}
              {data.map((e) => {
                const outstanding =
                  Number(e.total_advance_given || 0) - Number(e.total_advance_deducted || 0);
                return (
                  <TableRow key={e.emp_id}>
                    <TableCell className="font-mono text-xs">{e.emp_id}</TableCell>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>{e.role}</TableCell>
                    <TableCell className="text-right">
                      {Number(e.base_salary).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(e.total_advance_given).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(e.total_advance_deducted).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {outstanding.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setAdvOpen(e)}>
                        <Banknote className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete ${e.name}?`)) delMut.mutate(e.emp_id);
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!advOpen} onOpenChange={(o) => !o && setAdvOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Give Advance — {advOpen?.name}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Amount</Label>
            <Input type="number" value={advAmount} onChange={(e) => setAdvAmount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                advOpen && advMut.mutate({ emp_id: advOpen.emp_id, amount: Number(advAmount) || 0 })
              }
              disabled={!advAmount || advMut.isPending}
            >
              {advMut.isPending ? "Saving…" : "Record Advance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
