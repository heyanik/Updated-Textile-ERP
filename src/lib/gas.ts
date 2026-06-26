const STORAGE_KEY = "gas_web_app_url";

export function getGasUrl(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setGasUrl(url: string) {
  localStorage.setItem(STORAGE_KEY, url);
}

export function clearGasUrl() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function gas<T = any>(action: string, payload: Record<string, any> = {}): Promise<T> {
  const url = getGasUrl();
  if (!url) throw new Error("Google Apps Script URL not configured. Go to /setup.");
  // Send as application/x-www-form-urlencoded with a single `payload` field.
  // This survives Apps Script's POST→302 redirect (the body is preserved as
  // query-string-style params via e.parameter), where a JSON request body
  // can be silently dropped by the browser on the redirected GET.
  const body = new URLSearchParams({ payload: JSON.stringify({ action, ...payload }) });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Network error ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Unknown error");
  return json.data as T;
}

export type Employee = {
  emp_id: string;
  name: string;
  role: string;
  base_salary: number;
  total_advance_given: number;
  total_advance_deducted: number;
};

export type AttendanceRow = {
  date: string;
  emp_id: string;
  status: "Present" | "Absent" | "Half-Day" | "Overtime" | string;
  remarks: string;
};

export type PayrollRow = {
  payroll_id: string;
  month_year: string;
  emp_id: string;
  days_worked: number;
  gross_salary: number;
  advance_deduction: number;
  net_salary: number;
  payment_status: "Pending" | "Paid" | string;
};

export type Fabric = {
  fabric_id: string;
  client_name: string;
  fabric_type: string;
  total_yards_received: number;
  total_yards_printed: number;
  current_stock_yards: number;
  cost_per_yard: number;
};

export type Job = {
  job_id: string;
  date: string;
  fabric_id: string;
  client_name: string;
  yards_printed: number;
  ink_used_ml: number;
  ink_cost_per_ml: number;
  total_ink_cost: number;
};

export type DashboardStats = {
  employees_total: number;
  total_stock_yards: number;
  ink_used_month_ml: number;
  ink_remaining_ml: number;
};

export type Fabric2 = Fabric & { received_date: string };

export type Invoice = {
  invoice_id: string;
  date: string;
  client_name: string;
  phone_number?: string;
  address?: string;
  fabric_id: string;
  yards_printed: number;
  total_amount: number;
  notes?: string;
};

export type InkPurchase = {
  purchase_id: string;
  date: string;
  color?: string;
  quantity_ml: number;
  rate_per_ml: number;
  total_cost: number;
  supplier?: string;
};

export type InkUsage = {
  usage_id: string;
  date: string;
  color?: string;
  quantity_ml: number;
  note?: string;
};

export type PayrollPreviewRow = {
  emp_id: string;
  name: string;
  role: string;
  base_salary: number;
  days_worked: number;
  gross_salary: number;
  advance_deduction: number;
  net_salary: number;
  outstanding_advance: number;
  payment_status: string;
  payroll_id: string;
};
