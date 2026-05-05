// ==================== STORAGE MODULE ====================
// Save flow:  in-memory → localStorage → sync-server (data.json) → Mega cloud
// Load flow:  sync-server (data.json) → localStorage → in-memory

let customers = [];
let bills = [];
let estimates = [];
let paymentSlips = [];
let bankAccounts = [];
let currentBillNumber = 1;
let currentEstimateNumber = 1;
let currentCashNumber = 1;
let currentCreditNumber = 1;
let currentSlipNumber = 1;

// ── Apply a DB object to all in-memory variables ──────────
function _applyDB(db) {
    if (!db) return;
    customers             = db.customers             || [];
    bills                 = db.bills                 || [];
    estimates             = db.estimates             || [];
    paymentSlips          = db.paymentSlips          || [];
    bankAccounts          = db.bankAccounts          || [];
    currentBillNumber     = db.currentBillNumber     || 1;
    currentEstimateNumber = db.currentEstimateNumber || 1;
    currentCashNumber     = db.currentCashNumber     || 1;
    currentCreditNumber   = db.currentCreditNumber   || 1;
    currentSlipNumber     = db.currentSlipNumber     || 1;
}

// ── Build snapshot of current in-memory state ─────────────
function _buildDB() {
    return {
        customers, bills, estimates, paymentSlips, bankAccounts,
        currentBillNumber, currentEstimateNumber,
        currentCashNumber, currentCreditNumber, currentSlipNumber
    };
}

// ── Save to localStorage ──────────────────────────────────
function _saveToLocalStorage() {
    localStorage.setItem('garage_customers',      JSON.stringify(customers));
    localStorage.setItem('garage_bills',          JSON.stringify(bills));
    localStorage.setItem('garage_estimates',      JSON.stringify(estimates));
    localStorage.setItem('garage_paymentSlips',   JSON.stringify(paymentSlips));
    localStorage.setItem('garage_bankAccounts',   JSON.stringify(bankAccounts));
    localStorage.setItem('garage_billNumber',     currentBillNumber);
    localStorage.setItem('garage_estimateNumber', currentEstimateNumber);
    localStorage.setItem('garage_cashNumber',     currentCashNumber);
    localStorage.setItem('garage_creditNumber',   currentCreditNumber);
    localStorage.setItem('garage_slipNumber',     currentSlipNumber);
}

// ── Load from localStorage ────────────────────────────────
function _loadFromLocalStorage() {
    const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
    customers             = get('garage_customers')    || [];
    bills                 = get('garage_bills')        || [];
    estimates             = get('garage_estimates')    || [];
    paymentSlips          = get('garage_paymentSlips') || [];
    bankAccounts          = get('garage_bankAccounts') || [];
    currentBillNumber     = parseInt(localStorage.getItem('garage_billNumber'))     || 1;
    currentEstimateNumber = parseInt(localStorage.getItem('garage_estimateNumber')) || 1;
    currentCashNumber     = parseInt(localStorage.getItem('garage_cashNumber'))     || 1;
    currentCreditNumber   = parseInt(localStorage.getItem('garage_creditNumber'))   || 1;
    currentSlipNumber     = parseInt(localStorage.getItem('garage_slipNumber'))     || 1;
}

// ── Load all data on app start ────────────────────────────
async function loadAllData() {
    _loadFromLocalStorage();
    _updateDBIndicator();
}

// ── Save all data after every change ─────────────────────
function saveAllData() {
    // 1. Save to localStorage immediately (instant)
    _saveToLocalStorage();
    _updateDBIndicator();

    // 2. Push to sync server → which saves to data.json + Mega cloud
    if (typeof pushToServer === 'function') pushToServer();
}

// ── Apply server data to memory + localStorage ───────────
function applyServerData(data) {
    if (!data) return;
    _applyDB(data);
    _saveToLocalStorage();
    _updateDBIndicator();
}

// ── DB indicator in top bar ───────────────────────────────
function _updateDBIndicator() {
    const el = document.getElementById('dbIndicator');
    if (!el) return;
    const count = bills.length + customers.length + estimates.length + paymentSlips.length;
    el.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:#22C55E;display:inline-block;margin-right:4px;"></span>${count} records`;
    el.title = `${customers.length} customers · ${bills.length} bills · ${estimates.length} estimates · ${paymentSlips.length} slips`;
}
