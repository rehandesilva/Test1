// ==================== UTILITIES ====================

// Note: showToast is defined in customers.js with the modern styled version.
// This file provides utility functions that don't override it.

// ── Number Formatter ──
// Usage: fmtN(123000)    → "123,000.00"
//        fmtN(123000, 0) → "123,000"
const _numFmt2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const _numFmt0 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function fmtN(value, decimals = 2) {
    const n = Number(value) || 0;
    return decimals === 0 ? _numFmt0.format(n) : _numFmt2.format(n);
}

function updateDateTime() {
    const now  = new Date();
    const elem = document.getElementById('dateTime');
    if (!elem) return;

    const opts  = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    const date  = now.toLocaleDateString('en-US', opts);
    const time  = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    elem.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px;vertical-align:middle;margin-right:4px;">schedule</span>${date} · ${time}`;
}

function backupData() {
    const data = {
        customers,
        bills,
        estimates,
        paymentSlips,
        bankAccounts,
        currentBillNumber,
        currentEstimateNumber,
        currentCashNumber,
        currentCreditNumber,
        currentSlipNumber,
        backupDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `siriman_backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('💾 Backup file downloaded');
}

function restoreData() {
    const input  = document.createElement('input');
    input.type   = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file   = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                customers             = data.customers             || [];
                bills                 = data.bills                 || [];
                estimates             = data.estimates             || [];
                paymentSlips          = data.paymentSlips          || [];
                bankAccounts          = data.bankAccounts          || [];
                currentBillNumber     = data.currentBillNumber     || 1;
                currentEstimateNumber = data.currentEstimateNumber || 1;
                currentCashNumber     = data.currentCashNumber     || 1;
                currentCreditNumber   = data.currentCreditNumber   || 1;
                currentSlipNumber     = data.currentSlipNumber     || 1;

                // Write directly to localStorage to guarantee all data is persisted
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

                showToast('✅ Data restored successfully');
                setTimeout(() => location.reload(), 600);
            } catch (err) {
                showToast('⚠️ Invalid backup file', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function clearAllData() {
    openDeleteModal(() => {
        localStorage.clear();
        customers             = [];
        bills                 = [];
        estimates             = [];
        paymentSlips          = [];
        bankAccounts          = [];
        currentBillNumber     = 1;
        currentEstimateNumber = 1;
        currentCashNumber     = 1;
        currentCreditNumber   = 1;
        currentSlipNumber     = 1;
        saveAllData();
        showToast('🗑 All data has been cleared');
        setTimeout(() => location.reload(), 800);
    }, '⚠️ <strong style="color:#DC2626;">WARNING:</strong> This will permanently delete <strong>ALL</strong> customers, bills, estimates, payment slips and bank accounts. This action <strong>cannot be undone</strong>.');

    // Style confirm button as danger
    const confirmBtn = document.querySelector('#deleteModal .btn-danger');
    if (confirmBtn) {
        confirmBtn.innerHTML = '<span class="material-symbols-rounded">delete_forever</span> Yes, Delete Everything';
    }
}