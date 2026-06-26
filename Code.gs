/**
 * Textile ERP — Apps Script Backend (v2)
 *
 * Deploy:
 *   1. Open your Google Sheet → Extensions → Apps Script
 *   2. Replace the contents of Code.gs with this file
 *   3. Deploy → Manage deployments → Edit → New version → Deploy
 *   4. Re-test from the ERP "Setup" page (the /exec URL stays the same
 *      when you create a new version of an existing deployment).
 */

const SHEETS = {
  Employees:       ['emp_id','name','role','base_salary','total_advance_given','total_advance_deducted'],
  Attendance:      ['date','emp_id','status','remarks'],
  Payroll:         ['payroll_id','month_year','emp_id','days_worked','base_salary','gross_salary','advance_deduction','net_salary','payment_status','processed_at'],
  Inventory_Master:['fabric_id','client_name','fabric_type','received_date','total_yards_received','total_yards_printed','current_stock_yards','cost_per_yard'],
  Printing_Jobs:   ['job_id','date','fabric_id','client_name','yards_printed','ink_used_ml','ink_cost_per_ml','total_ink_cost'],
  Invoices:        ['invoice_id','date','client_name','phone_number','address','fabric_id','yards_printed','total_amount','notes'],
  Ink_Purchases:   ['purchase_id','date','color','quantity_ml','rate_per_ml','total_cost','supplier'],
  Ink_Usage:       ['usage_id','date','color','quantity_ml','note'],
  Users:           ['username','password_hash','role','created_at'],
};

function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    var headers = SHEETS[name];
    var firstRow = sh.getRange(1,1,1,headers.length).getValues()[0];
    var needs = headers.some(function (h,i) { return firstRow[i] !== h; });
    if (needs) sh.getRange(1,1,1,headers.length).setValues([headers]);
  });
}

function sheet_(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }

function rows_(name) {
  var sh = sheet_(name);
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data.shift();
  return data.map(function (r) {
    var o = {}; headers.forEach(function (h,i) { o[h] = r[i]; }); return o;
  });
}

function appendRow_(name, obj) {
  var sh = sheet_(name);
  var headers = SHEETS[name];
  sh.appendRow(headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; }));
}

function nextId_(name, prefix, idCol) {
  var sh = sheet_(name);
  var headers = SHEETS[name];
  var col = headers.indexOf(idCol) + 1;
  var last = sh.getLastRow();
  var max = 0;
  if (last >= 2) {
    var ids = sh.getRange(2,col,last-1,1).getValues();
    ids.forEach(function (r) {
      var v = String(r[0]||''); var m = v.match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1],10));
    });
  }
  return prefix + String(max+1).padStart(4,'0');
}

function updateRowById_(name, idCol, idVal, patch) {
  var sh = sheet_(name);
  var headers = SHEETS[name];
  var idIdx = headers.indexOf(idCol);
  var data = sh.getDataRange().getValues();
  for (var r=1; r<data.length; r++) {
    if (String(data[r][idIdx]) === String(idVal)) {
      headers.forEach(function (h,i) {
        if (Object.prototype.hasOwnProperty.call(patch,h)) data[r][i] = patch[h];
      });
      sh.getRange(r+1,1,1,headers.length).setValues([data[r]]);
      return true;
    }
  }
  return false;
}

function deleteRowById_(name, idCol, idVal) {
  var sh = sheet_(name);
  var headers = SHEETS[name];
  var idIdx = headers.indexOf(idCol);
  var data = sh.getDataRange().getValues();
  for (var r=1; r<data.length; r++) {
    if (String(data[r][idIdx]) === String(idVal)) { sh.deleteRow(r+1); return true; }
  }
  return false;
}

function ymd_(d) {
  if (!d) return '';
  if (d instanceof Date) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(d).slice(0,10);
}
function ym_(d) {
  var s = ymd_(d); return s ? s.slice(0,7) : '';
}

// ============================ ACTIONS ============================

const ACTIONS = {

  init: function () { ensureSheets_(); return { ok:true }; },

  // ---------------- Employees ----------------
  listEmployees: function () { return rows_('Employees'); },
  addEmployee: function (p) {
    var emp_id = nextId_('Employees','EMP','emp_id');
    appendRow_('Employees', { emp_id: emp_id, name:p.name, role:p.role||'', base_salary:Number(p.base_salary)||0, total_advance_given:0, total_advance_deducted:0 });
    return { emp_id: emp_id };
  },
  deleteEmployee: function (p) { deleteRowById_('Employees','emp_id',p.emp_id); return { ok:true }; },
  addEmployeeAdvance: function (p) {
    var emp = rows_('Employees').find(function (e) { return e.emp_id===p.emp_id; });
    if (!emp) throw new Error('Employee not found');
    updateRowById_('Employees','emp_id',p.emp_id,{ total_advance_given: Number(emp.total_advance_given||0)+Number(p.amount) });
    return { ok:true };
  },

  // ---------------- Attendance ----------------
  // listAttendance({ date }) | ({ emp_id, year, month }) | ({ year })
  listAttendance: function (p) {
    var all = rows_('Attendance').map(function (r) { return { date: ymd_(r.date), emp_id: String(r.emp_id), status: r.status, remarks: r.remarks }; });
    if (p.date) return all.filter(function (r) { return r.date === p.date; });
    if (p.emp_id && p.year && p.month) {
      var prefix = p.year + '-' + String(p.month).padStart(2,'0');
      return all.filter(function (r) { return r.emp_id===String(p.emp_id) && r.date.indexOf(prefix)===0; });
    }
    if (p.year) return all.filter(function (r) { return r.date.indexOf(String(p.year))===0; });
    return all;
  },
  // bulkAddAttendance({ entries:[{date,emp_id,status,remarks}] })
  // Upserts by (date,emp_id).
  bulkAddAttendance: function (p) {
    var entries = p.entries || [];
    if (!entries.length) return { ok:true, count:0 };
    var sh = sheet_('Attendance');
    var headers = SHEETS.Attendance;
    var data = sh.getDataRange().getValues();
    var dateI = headers.indexOf('date'), empI = headers.indexOf('emp_id');
    var indexed = {};
    for (var r=1; r<data.length; r++) {
      var key = ymd_(data[r][dateI]) + '|' + String(data[r][empI]);
      indexed[key] = r;
    }
    var toAppend = [];
    entries.forEach(function (e) {
      var key = e.date + '|' + String(e.emp_id);
      var row = [e.date, String(e.emp_id), e.status||'Absent', e.remarks||''];
      if (indexed[key] != null) {
        sh.getRange(indexed[key]+1,1,1,headers.length).setValues([row]);
      } else {
        toAppend.push(row);
      }
    });
    if (toAppend.length) sh.getRange(sh.getLastRow()+1,1,toAppend.length,headers.length).setValues(toAppend);
    return { ok:true, count: entries.length };
  },

  // ---------------- Payroll ----------------
  // previewPayroll({ month_year }) => rows with days_worked + gross
  previewPayroll: function (p) {
    var month = p.month_year; // yyyy-MM
    var emps = rows_('Employees');
    var att = rows_('Attendance').map(function (r) { return { date:ymd_(r.date), emp_id:String(r.emp_id), status:r.status }; });
    var saved = rows_('Payroll').filter(function (r) { return r.month_year === month; });
    var savedMap = {}; saved.forEach(function (r) { savedMap[String(r.emp_id)] = r; });
    return emps.map(function (e) {
      var rows = att.filter(function (r) { return r.emp_id===String(e.emp_id) && r.date.indexOf(month)===0; });
      var days = 0;
      rows.forEach(function (r) {
        if (r.status==='Present' || r.status==='Overtime') days += 1;
        else if (r.status==='Half-Day') days += 0.5;
      });
      var base = Number(e.base_salary)||0;
      var gross = (base/30) * days;
      var outstanding = Number(e.total_advance_given||0) - Number(e.total_advance_deducted||0);
      var existing = savedMap[String(e.emp_id)];
      return {
        emp_id: e.emp_id, name: e.name, role: e.role, base_salary: base,
        days_worked: existing ? Number(existing.days_worked) : days,
        gross_salary: existing ? Number(existing.gross_salary) : Math.round(gross),
        advance_deduction: existing ? Number(existing.advance_deduction) : 0,
        net_salary: existing ? Number(existing.net_salary) : Math.round(gross),
        outstanding_advance: outstanding,
        payment_status: existing ? existing.payment_status : 'Pending',
        payroll_id: existing ? existing.payroll_id : '',
      };
    });
  },
  // savePayroll({ month_year, rows:[{emp_id, days_worked, gross_salary, advance_deduction, net_salary}] })
  savePayroll: function (p) {
    var month = p.month_year;
    var sh = sheet_('Payroll');
    var headers = SHEETS.Payroll;
    var data = sh.getDataRange().getValues();
    // remove existing for this month
    for (var r=data.length-1; r>=1; r--) {
      if (String(data[r][headers.indexOf('month_year')]) === month) sh.deleteRow(r+1);
    }
    // recompute advance ledger deltas: replace any previous deductions for this month
    var emps = rows_('Employees');
    var empMap = {}; emps.forEach(function (e) { empMap[String(e.emp_id)] = e; });
    var prevDeductions = rows_('Payroll').filter(function (x) { return x.month_year === month; });
    var prevByEmp = {}; prevDeductions.forEach(function (x) { prevByEmp[String(x.emp_id)] = Number(x.advance_deduction)||0; });

    var created = 0;
    (p.rows || []).forEach(function (row) {
      var payroll_id = nextId_('Payroll','PAY','payroll_id');
      appendRow_('Payroll', {
        payroll_id: payroll_id,
        month_year: month,
        emp_id: row.emp_id,
        days_worked: Number(row.days_worked)||0,
        base_salary: Number((empMap[row.emp_id]||{}).base_salary)||0,
        gross_salary: Number(row.gross_salary)||0,
        advance_deduction: Number(row.advance_deduction)||0,
        net_salary: Number(row.net_salary)||0,
        payment_status: 'Pending',
        processed_at: new Date(),
      });
      // adjust advance ledger
      var emp = empMap[row.emp_id];
      if (emp) {
        var prev = Number(prevByEmp[row.emp_id]||0);
        var newDeducted = Number(emp.total_advance_deducted||0) - prev + (Number(row.advance_deduction)||0);
        updateRowById_('Employees','emp_id',row.emp_id,{ total_advance_deducted: newDeducted });
        emp.total_advance_deducted = newDeducted;
      }
      created++;
    });
    return { ok:true, created: created };
  },
  listPayroll: function (p) {
    var month = p.month_year;
    return rows_('Payroll').filter(function (r) { return !month || r.month_year===month; });
  },
  markPayrollPaid: function (p) { updateRowById_('Payroll','payroll_id',p.payroll_id,{ payment_status:'Paid' }); return { ok:true }; },

  // ---------------- Inventory ----------------
  // listInventory({ year?, month? })  filter by received_date
  listInventory: function (p) {
    var all = rows_('Inventory_Master').map(function (r) {
      return {
        fabric_id: r.fabric_id, client_name: r.client_name, fabric_type: r.fabric_type,
        received_date: ymd_(r.received_date),
        total_yards_received: Number(r.total_yards_received)||0,
        total_yards_printed: Number(r.total_yards_printed)||0,
        current_stock_yards: Number(r.current_stock_yards)||0,
        cost_per_yard: Number(r.cost_per_yard)||0,
      };
    });
    if (p && p.year) {
      var prefix = String(p.year) + (p.month ? '-' + String(p.month).padStart(2,'0') : '');
      all = all.filter(function (r) { return (r.received_date||'').indexOf(prefix)===0; });
    }
    return all;
  },
  addFabric: function (p) {
    var fabric_id = nextId_('Inventory_Master','FAB','fabric_id');
    var rec = Number(p.total_yards_received)||0;
    var printed = Number(p.total_yards_printed)||0;
    appendRow_('Inventory_Master', {
      fabric_id: fabric_id,
      client_name: p.client_name, fabric_type: p.fabric_type||'',
      received_date: p.received_date || ymd_(new Date()),
      total_yards_received: rec,
      total_yards_printed: printed,
      current_stock_yards: rec - printed,
      cost_per_yard: Number(p.cost_per_yard)||0,
    });
    return { fabric_id: fabric_id };
  },
  updateFabric: function (p) {
    var rows = rows_('Inventory_Master');
    var cur = rows.find(function (r) { return r.fabric_id === p.fabric_id; });
    if (!cur) throw new Error('Fabric not found');
    var patch = {};
    ['client_name','fabric_type','received_date'].forEach(function (k) { if (p[k] !== undefined) patch[k]=p[k]; });
    if (p.total_yards_received !== undefined) patch.total_yards_received = Number(p.total_yards_received);
    if (p.total_yards_printed !== undefined) patch.total_yards_printed = Number(p.total_yards_printed);
    var rec = patch.total_yards_received !== undefined ? patch.total_yards_received : Number(cur.total_yards_received);
    var pr  = patch.total_yards_printed  !== undefined ? patch.total_yards_printed  : Number(cur.total_yards_printed);
    patch.current_stock_yards = rec - pr;
    updateRowById_('Inventory_Master','fabric_id',p.fabric_id, patch);
    return { ok:true };
  },
  addFabricStock: function (p) {
    var rows = rows_('Inventory_Master');
    var cur = rows.find(function (r) { return r.fabric_id === p.fabric_id; });
    if (!cur) throw new Error('Fabric not found');
    var rec = Number(cur.total_yards_received||0) + Number(p.yards||0);
    updateRowById_('Inventory_Master','fabric_id',p.fabric_id,{
      total_yards_received: rec,
      current_stock_yards: rec - Number(cur.total_yards_printed||0),
    });
    return { ok:true };
  },

  // ---------------- Invoices ----------------
  listInvoices: function (p) {
    var all = rows_('Invoices').map(function (r) { return Object.assign({}, r, { date: ymd_(r.date) }); });
    if (p && p.year) {
      var prefix = String(p.year) + (p.month ? '-' + String(p.month).padStart(2,'0') : '');
      all = all.filter(function (r) { return (r.date||'').indexOf(prefix)===0; });
    }
    return all;
  },
  addInvoice: function (p) {
    var invoice_id = nextId_('Invoices','INV','invoice_id');
    var yards = Number(p.yards_printed)||0;
    // Deduct from fabric stock if fabric_id provided
    if (p.fabric_id) {
      var f = rows_('Inventory_Master').find(function (r) { return r.fabric_id===p.fabric_id; });
      if (f) {
        var printed = Number(f.total_yards_printed||0) + yards;
        var rec = Number(f.total_yards_received||0);
        updateRowById_('Inventory_Master','fabric_id',p.fabric_id,{
          total_yards_printed: printed,
          current_stock_yards: rec - printed,
        });
      }
    }
    appendRow_('Invoices', {
      invoice_id: invoice_id,
      date: p.date || ymd_(new Date()),
      client_name: p.client_name,
      phone_number: p.phone_number||'',
      address: p.address||'',
      fabric_id: p.fabric_id||'',
      yards_printed: yards,
      total_amount: Number(p.total_amount)||0,
      notes: p.notes||'',
    });
    return { invoice_id: invoice_id };
  },

  // ---------------- Ink ----------------
  listInkPurchases: function () {
    return rows_('Ink_Purchases').map(function (r) { return Object.assign({}, r, { date: ymd_(r.date) }); });
  },
  addInkPurchase: function (p) {
    var purchase_id = nextId_('Ink_Purchases','INKP','purchase_id');
    var qty = Number(p.quantity_ml)||0;
    var rate = Number(p.rate_per_ml)||0;
    appendRow_('Ink_Purchases', {
      purchase_id: purchase_id,
      date: p.date || ymd_(new Date()),
      color: p.color || '',
      quantity_ml: qty, rate_per_ml: rate,
      total_cost: qty*rate,
      supplier: p.supplier||'',
    });
    return { purchase_id: purchase_id };
  },
  listInkUsage: function () {
    return rows_('Ink_Usage').map(function (r) { return Object.assign({}, r, { date: ymd_(r.date) }); });
  },
  addInkUsage: function (p) {
    var usage_id = nextId_('Ink_Usage','INKU','usage_id');
    appendRow_('Ink_Usage', {
      usage_id: usage_id,
      date: p.date || ymd_(new Date()),
      color: p.color || '',
      quantity_ml: Number(p.quantity_ml)||0,
      note: p.note||'',
    });
    return { usage_id: usage_id };
  },
  deleteInkPurchase: function (p) { deleteRowById_('Ink_Purchases','purchase_id',p.purchase_id); return { ok:true }; },
  deleteInkUsage:    function (p) { deleteRowById_('Ink_Usage','usage_id',p.usage_id); return { ok:true }; },
  deleteFabric:      function (p) { deleteRowById_('Inventory_Master','fabric_id',p.fabric_id); return { ok:true }; },
  deleteInvoice:     function (p) { deleteRowById_('Invoices','invoice_id',p.invoice_id); return { ok:true }; },

  listUsers: function () {
    return rows_('Users').map(function (u) { return { username: u.username, role: u.role || 'user', created_at: ymd_(u.created_at) }; });
  },
  registerUser: function (p) {
    if (!p.username || !p.password) throw new Error('Username and password required');
    var existing = rows_('Users');
    if (existing.some(function (u) { return String(u.username).toLowerCase() === String(p.username).toLowerCase(); })) {
      throw new Error('Username already exists');
    }
    var role = existing.length === 0 ? 'admin' : (p.role || 'user');
    appendRow_('Users', { username: p.username, password_hash: sha256_(p.password), role: role, created_at: new Date() });
    return { ok:true, username: p.username, role: role };
  },
  loginUser: function (p) {
    var users = rows_('Users');
    if (users.length === 0) throw new Error('No users registered. Create the first user in Setup.');
    var u = users.find(function (x) { return String(x.username).toLowerCase() === String(p.username||'').toLowerCase(); });
    if (!u) throw new Error('Invalid username or password');
    if (String(u.password_hash) !== sha256_(p.password||'')) throw new Error('Invalid username or password');
    return { ok:true, username: u.username, role: u.role || 'user', token: sha256_(u.username + '|' + u.password_hash) };
  },
  deleteUser: function (p) { deleteRowById_('Users','username',p.username); return { ok:true }; },

  // ---------------- Dashboard ----------------
  dashboard: function () {
    var emps = rows_('Employees');
    var inv  = rows_('Inventory_Master');
    var purchases = rows_('Ink_Purchases');
    var usage = rows_('Ink_Usage');
    var month = ym_(new Date());
    var ink_purchased_total = purchases.reduce(function (s,r) { return s + Number(r.quantity_ml||0); }, 0);
    var ink_used_total      = usage.reduce(function (s,r) { return s + Number(r.quantity_ml||0); }, 0);
    var ink_used_month      = usage.filter(function (r) { return ym_(r.date)===month; })
                                   .reduce(function (s,r) { return s + Number(r.quantity_ml||0); }, 0);
    var stock = inv.reduce(function (s,r) { return s + Number(r.current_stock_yards||0); }, 0);
    return {
      employees_total: emps.length,
      total_stock_yards: stock,
      ink_used_month_ml: ink_used_month,
      ink_remaining_ml: ink_purchased_total - ink_used_total,
    };
  },

};

// ============================ HTTP ============================
function doGet(e)  { ensureSheets_(); return handle_('GET', e); }
function doPost(e) { ensureSheets_(); return handle_('POST', e); }

function handle_(method, e) {
  try {
    var payload = {};
    // Preferred transport: form-encoded `payload=<json>` (survives the
    // POST→302 redirect that Apps Script issues; some browsers drop the
    // raw JSON body during that redirect).
    if (e && e.parameter && e.parameter.payload) {
      try { payload = JSON.parse(e.parameter.payload); } catch(_) { payload = {}; }
    } else if (e && e.postData && e.postData.contents) {
      try { payload = JSON.parse(e.postData.contents); } catch(_) { payload = {}; }
    }
    // Merge any remaining query params (without clobbering parsed payload keys).
    if (e && e.parameter) Object.keys(e.parameter).forEach(function (k) {
      if (k !== 'payload' && payload[k] === undefined) payload[k] = e.parameter[k];
    });
    var action = payload.action;
    if (!action || !ACTIONS[action]) throw new Error('Unknown action: '+action);
    var data = ACTIONS[action](payload);
    return jsonOut_({ ok:true, data: data });
  } catch (err) {
    return jsonOut_({ ok:false, error: err && err.message ? err.message : String(err) });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sha256_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var v = (b<0?b+256:b).toString(16); return v.length===1?'0'+v:v; }).join('');
}