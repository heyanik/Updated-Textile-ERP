import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { gas, type Employee, type AttendanceRow } from "@/lib/gas";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/attendance")({
  head: () => ({ meta: [{ title: "Attendance — Textile ERP" }] }),
  component: AttendancePage,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STATUSES = ["", "Present", "Absent", "Half-Day", "Overtime"] as const;
type Status = (typeof STATUSES)[number];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

const STATUS_STYLE: Record<string, string> = {
  "": "bg-background text-muted-foreground",
  Present: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  Absent: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/40",
  "Half-Day": "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40",
  Overtime: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40",
};
const STATUS_LABEL: Record<string, string> = {
  "": "—",
  Present: "P",
  Absent: "A",
  "Half-Day": "H",
  Overtime: "O",
};

function nextStatus(s: Status): Status {
  const i = STATUSES.indexOf(s);
  return STATUSES[(i + 1) % STATUSES.length];
}

function AttendancePage() {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthByEmp, setMonthByEmp] = useState<Record<string, number>>({});
  const [openEmp, setOpenEmp] = useState<Employee | null>(null);
  const [openMonth, setOpenMonth] = useState(now.getMonth() + 1);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => gas<Employee[]>("listEmployees"),
  });
  const { data: yearRows = [] } = useQuery({
    queryKey: ["attendance-year", year],
    queryFn: () => gas<AttendanceRow[]>("listAttendance", { year }),
  });

  // pre-populate month dropdown defaults
  useEffect(() => {
    if (!employees.length) return;
    setMonthByEmp((prev) => {
      const next = { ...prev };
      employees.forEach((e) => {
        if (!next[e.emp_id]) next[e.emp_id] = now.getMonth() + 1;
      });
      return next;
    });
  }, [employees]);

  const summary = useMemo(() => {
    const m: Record<string, Record<number, { p: number; a: number; h: number; o: number }>> = {};
    yearRows.forEach((r) => {
      const month = Number(r.date.slice(5, 7));
      const key = String(r.emp_id);
      m[key] ||= {};
      m[key][month] ||= { p: 0, a: 0, h: 0, o: 0 };
      if (r.status === "Present") m[key][month].p++;
      else if (r.status === "Absent") m[key][month].a++;
      else if (r.status === "Half-Day") m[key][month].h++;
      else if (r.status === "Overtime") m[key][month].o++;
    });
    return m;
  }, [yearRows]);

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Pick a year, then open any employee's monthly calendar to mark attendance."
        action={
          <div>
            <Label className="text-xs">Year</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-32"
            />
          </div>
        }
      />
      <div className="p-8">
        {employees.length === 0 ? (
          <div className="text-sm text-muted-foreground">Add employees first.</div>
        ) : (
          <div className="rounded-md border bg-card max-h-[70vh] overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:bg-card [&_thead]:z-10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-48">Month</TableHead>
                  <TableHead>This Month (P/A/H/O)</TableHead>
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => {
                  const m = monthByEmp[emp.emp_id] || now.getMonth() + 1;
                  const s = summary[emp.emp_id]?.[m];
                  return (
                    <TableRow key={emp.emp_id}>
                      <TableCell className="font-mono text-xs">{emp.emp_id}</TableCell>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>{emp.role}</TableCell>
                      <TableCell>
                        <Select
                          value={String(m)}
                          onValueChange={(v) =>
                            setMonthByEmp((d) => ({ ...d, [emp.emp_id]: Number(v) }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MONTHS.map((name, i) => (
                              <SelectItem key={i} value={String(i + 1)}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s ? `${s.p} / ${s.a} / ${s.h} / ${s.o}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            setOpenEmp(emp);
                            setOpenMonth(m);
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CalendarDialog
        open={!!openEmp}
        onClose={() => setOpenEmp(null)}
        employee={openEmp}
        year={year}
        month={openMonth}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["attendance-year", year] });
          qc.invalidateQueries({ queryKey: ["dashboard"] });
        }}
      />
    </>
  );
}

function CalendarDialog({
  open,
  onClose,
  employee,
  year,
  month,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
  year: number;
  month: number;
  onSaved: () => void;
}) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["attendance-emp", employee?.emp_id, year, month],
    queryFn: () =>
      gas<AttendanceRow[]>("listAttendance", { emp_id: employee!.emp_id, year, month }),
    enabled: open && !!employee,
  });

  const [cells, setCells] = useState<Record<string, Status>>({});
  useEffect(() => {
    if (!open || !employee) return;
    const next: Record<string, Status> = {};
    const total = daysInMonth(year, month);
    for (let d = 1; d <= total; d++) next[`${year}-${pad(month)}-${pad(d)}`] = "";
    rows.forEach((r) => {
      next[r.date] = (r.status as Status) || "";
    });
    setCells(next);
  }, [open, employee, year, month, rows]);

  const saveMut = useMutation({
    mutationFn: (entries: { date: string; emp_id: string; status: Status; remarks: string }[]) =>
      gas("bulkAddAttendance", { entries }),
    onMutate: () => {
      toast.success("Attendance saved");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!employee) return null;
  const total = daysInMonth(year, month);
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const blanks = Array.from({ length: firstWeekday });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {employee.name} — {MONTHS[month - 1]} {year}
          </DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
          <span>Click a day to cycle: — → Present → Absent → Half-Day → Overtime</span>
        </div>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5 select-none">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-[10px] uppercase text-muted-foreground text-center py-1">
                {d}
              </div>
            ))}
            {blanks.map((_, i) => (
              <div key={`b${i}`} />
            ))}
            {Array.from({ length: total }, (_, i) => i + 1).map((d) => {
              const key = `${year}-${pad(month)}-${pad(d)}`;
              const s = cells[key] || "";
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCells((c) => ({ ...c, [key]: nextStatus(s) }))}
                  className={cn(
                    "rounded-md border h-16 flex flex-col items-center justify-center text-sm transition",
                    STATUS_STYLE[s],
                  )}
                >
                  <span className="font-semibold">{d}</span>
                  <span className="text-xs">{STATUS_LABEL[s]}</span>
                </button>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              saveMut.mutate(
                Object.entries(cells)
                  .filter(([, s]) => s !== "")
                  .map(([date, status]) => ({
                    date,
                    emp_id: employee.emp_id,
                    status,
                    remarks: "",
                  })),
              )
            }
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? "Saving…" : "Save Attendance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
