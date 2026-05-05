// ==================== BILLING MODULE ====================

let currentBillItems = [];

// ── Amount input live formatter ──
function fmtAmtInput(el) {
    // Strip everything except digits and one dot
    let raw = el.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    el.value = parts.length > 1 ? parts[0] + '.' + parts[1] : parts[0];
    el.dataset.raw = raw;
}

function getRaw(el) {
    return parseFloat((el.dataset.raw || el.value).replace(/,/g, '')) || 0;
}

// Recalc a part row's total when qty changes
function calcPartAmt(qtyEl) {
    const row      = qtyEl.closest('.item-row-part');
    if (!row) return;
    const amtEl    = row.querySelector('.part-amt');
    const unitPrice = getRaw(amtEl);
    const qty       = parseFloat(qtyEl.value) || 1;
    amtEl.dataset.unitPrice = unitPrice;
    amtEl.dataset.qty       = qty;
}

// Recalc a part row's stored total when unit price changes
function calcPartTotal(amtEl) {
    const row = amtEl.closest('.item-row-part');
    if (!row) return;
    const qty = parseFloat(row.querySelector('.part-qty').value) || 1;
    amtEl.dataset.qty = qty;
}

// ── Recalculate totals ──
function recalcTotal() {
    let total = 0;
    document.querySelectorAll('.repair-amt').forEach(el => { total += getRaw(el); });
    document.querySelectorAll('.part-amt').forEach(el => {
        const row = el.closest('.item-row-part');
        const qty = row ? (parseFloat(row.querySelector('.part-qty').value) || 1) : 1;
        total += getRaw(el) * qty;
    });
    const el = document.getElementById('grandTotal');
    if (el) {
        el.textContent = 'Rs. ' + fmtN(total);
        el.dataset.raw = total;
        el.style.transform = 'scale(1.04)';
        setTimeout(() => { el.style.transform = 'scale(1)'; el.style.transition = 'transform 0.15s ease'; }, 150);
    }
    recalcBalance();
}

function recalcBalance() {
    const totalEl     = document.getElementById('grandTotal');
    const advanceEl   = document.getElementById('advanceAmount');
    const balanceEl   = document.getElementById('balanceDue');
    const advanceDisp = document.getElementById('advanceDisplay');
    const advanceRow  = document.getElementById('advanceRow');
    const balanceRow  = document.getElementById('balanceRow');
    const paidCheck   = document.getElementById('billPaidCheck');
    const paidLabel   = document.getElementById('billPaidLabel');
    if (!totalEl || !balanceEl) return;

    // Use stored raw value for accuracy
    const total   = parseFloat(totalEl.dataset.raw) || 0;
    const advance  = getRaw(advanceEl) || 0;
    const balance  = Math.max(0, total - advance);

    if (advance > 0) {
        if (advanceDisp) advanceDisp.textContent = 'Rs. ' + fmtN(advance);
        if (advanceRow)  advanceRow.style.display = 'flex';
        balanceEl.textContent = 'Rs. ' + fmtN(balance);
        if (balanceRow)  balanceRow.style.display = 'flex';
    } else {
        if (advanceRow)  advanceRow.style.display = 'none';
        if (balanceRow)  balanceRow.style.display = 'none';
    }

    if (paidCheck && paidLabel) {
        const isPaid = paidCheck.checked;
        paidLabel.textContent = isPaid ? '✓ Paid' : 'Mark as Paid';
        paidLabel.style.color = isPaid ? '#16A34A' : 'var(--text-muted)';
    }
}

// ── Add a Labor row ──
function addRepairRow() {
    const container = document.getElementById('repairRows');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
        <textarea placeholder="Description of labor work..." class="repair-desc" rows="2"></textarea>
        <input type="text" inputmode="decimal" placeholder="Amount (Rs.)" class="repair-amt" oninput="fmtAmtInput(this);recalcTotal()">
        <button onclick="removeRow(this)" class="remove-btn" title="Remove row">✕</button>
    `;
    container.appendChild(row);
    row.querySelector('textarea').focus();
    if (typeof _attachToNewRow === 'function') _attachToNewRow(row, 'labor');
}

// ── Add a Part row ──
function addPartRow() {
    const container = document.getElementById('partRows');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'item-row-part';
    row.innerHTML = `
        <textarea placeholder="Part name or description..." class="part-desc" rows="2"></textarea>
        <input type="number" placeholder="1" class="part-qty" min="1" value="1" oninput="calcPartAmt(this);recalcTotal()" onfocus="if(this.value==='1')this.value=''" onblur="if(!this.value||this.value==='0')this.value='1'">
        <input type="text" inputmode="decimal" placeholder="Unit Price (Rs.)" class="part-amt" oninput="fmtAmtInput(this);calcPartTotal(this);recalcTotal()">
        <button onclick="removeRow(this)" class="remove-btn" title="Remove row">✕</button>
    `;
    container.appendChild(row);
    row.querySelector('textarea').focus();
    if (typeof _attachToNewRow === 'function') _attachToNewRow(row, 'spareParts');
}

// ── Remove any item row ──
function removeRow(btn) {
    const row = btn.closest('.item-row') || btn.closest('.item-row-part');
    if (!row) return;
    row.style.transition = 'all 0.15s ease';
    row.style.opacity    = '0';
    row.style.transform  = 'translateX(-10px)';
    setTimeout(() => { row.remove(); recalcTotal(); recalcEstTotal(); }, 160);
}

// ── Toggle Bill Number field ──
function toggleInvNo() {
    const isManual = document.getElementById('invTypeManual').checked;
    const input    = document.getElementById('invoiceNo');
    if (!input) return;
    input.readOnly       = !isManual;
    input.style.color    = isManual ? 'var(--text-primary)' : 'var(--primary)';
    input.style.cursor   = isManual ? 'text' : 'default';
    if (isManual) input.focus();
}

// ── Toggle Bill Date field ──
function toggleInvDate() {
    const radios   = document.querySelectorAll('input[name="invDate"]');
    let isManual   = false;
    radios.forEach(r => { if (r.value === 'manual' && r.checked) isManual = true; });
    const input    = document.getElementById('invoiceDate');
    if (!input) return;
    input.readOnly = !isManual;
    input.style.color = isManual ? 'var(--text-primary)' : 'var(--text-secondary)';
    if (isManual) {
        input.type  = 'date';
        input.focus();
    } else {
        input.type  = 'text';
        input.value = new Date().toLocaleDateString('en-GB').replace(/\//g, '/');
    }
}

// ── Load registration number select ──
function loadRegNoSelect() {
    const select = document.getElementById('billRegNo');
    if (!select) return;
    select.innerHTML = '<option value="">— Select Registration —</option>';
    customers.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.vehicleNo} — ${c.name}</option>`;
    });
}

// ── Sync customer by registration ──
function loadBillCustomerByReg() {
    const id = document.getElementById('billRegNo').value;
    if (!id) return;
    const nameSelect = document.getElementById('billCustomer');
    if (nameSelect) nameSelect.value = id;
    loadBillCustomerDetails();
}

// ── Collect items from the form ──
function collectItems() {
    const repairDescs = document.querySelectorAll('.repair-desc');
    const repairAmts  = document.querySelectorAll('.repair-amt');
    const partDescs   = document.querySelectorAll('.part-desc');
    const partAmts    = document.querySelectorAll('.part-amt');

    const items = [];
    let total   = 0;

    repairDescs.forEach((el, i) => {
        const desc = el.value.trim();
        const amt  = getRaw(repairAmts[i]);
        if (desc || amt) {
            items.push({ type: 'Labor', desc: desc || 'Labor', price: amt, qty: 1, total: amt });
            total += amt;
        }
    });

    partDescs.forEach((el, i) => {
        const desc      = el.value.trim();
        const row       = el.closest('.item-row-part');
        const qty       = row ? (parseFloat(row.querySelector('.part-qty').value) || 1) : 1;
        const unitPrice = getRaw(partAmts[i]);
        const amt       = unitPrice * qty;
        if (desc || amt) {
            items.push({ type: 'Part', desc: desc || 'Part', price: unitPrice, qty, total: amt });
            total += amt;
        }
    });

    return { items, total };
}

// ── Save Bill ──
function saveBill() {
    const customerId = document.getElementById('billCustomer').value;
    if (!customerId) { showToast('⚠️ Please select a customer', 'error'); return; }

    const { items, total } = collectItems();
    if (items.length === 0) { showToast('⚠️ Please add at least one item', 'error'); return; }

    const customer    = customers.find(c => c.id == customerId);
    const billType    = document.querySelector('input[name="billType"]:checked')?.value || 'cash';

    // Recalculate bill number at save time if Auto mode to avoid duplicates
    let invoiceNo = document.getElementById('invoiceNo').value.trim();
    if (document.getElementById('invTypeAuto')?.checked && _editingBillIndex === null) {
        // Find highest existing number for this type and increment — never goes down after delete
        const prefix = billType === 'cash' ? 'CH-' : 'CR-';
        const maxNo  = bills
            .filter(b => (b.billType || 'cash') === billType)
            .map(b => parseInt(b.billNo.replace(prefix, '')) || 0)
            .reduce((max, n) => Math.max(max, n), 0);
        invoiceNo = prefix + String(maxNo + 1).padStart(3, '0');
    }

    const invoiceDate = document.getElementById('invoiceDate').value.trim();
    const mileage     = document.getElementById('mileage').value.trim();
    const bankIdx     = document.getElementById('bankDetails').value;
    const bankDetails = (bankIdx !== '') ? bankAccounts[parseInt(bankIdx)] : null;
    const advance     = getRaw(document.getElementById('advanceAmount')) || 0;
    const isPaid      = document.getElementById('billPaidCheck')?.checked || false;

    const bill = {
        billNo:        invoiceNo,
        billType:      billType,
        customerId:    customer.id,
        customerName:  customer.name,
        customerPhone: customer.contacts,
        isCompany:     customer.isCompany || false,
        companyAddress: customer.companyAddress || '',
        vehicleNo:     customer.vehicleNo,
        vehicleModel:  customer.vehicleModel || '',
        brand:         customer.brand        || '',
        engineNo:      customer.engineNo     || '',
        items,
        subtotal:      total,
        tax:           0,
        total,
        advance,
        balance:       isPaid ? 0 : Math.max(0, total - advance),
        paid:          isPaid,
        mileage,
        bankDetails,
        date: (() => {
            // Use manual date if selected, otherwise today
            const isManual = document.querySelector('input[name="invDate"][value="manual"]')?.checked;
            if (isManual && invoiceDate) {
                // invoiceDate may be dd/mm/yyyy or yyyy-mm-dd
                const parts = invoiceDate.includes('/') ? invoiceDate.split('/') : invoiceDate.split('-');
                if (parts.length === 3) {
                    // dd/mm/yyyy → new Date(yyyy, mm-1, dd)
                    const d = invoiceDate.includes('-') && parts[0].length === 4
                        ? new Date(invoiceDate)
                        : new Date(parts[2], parts[1]-1, parts[0]);
                    if (!isNaN(d)) return d.toISOString();
                }
            }
            return new Date().toISOString();
        })()
    };

    if (_editingBillIndex !== null && bills[_editingBillIndex]) {
        // Replace existing record
        bill.date = bills[_editingBillIndex].date; // preserve original date
        bills[_editingBillIndex] = bill;
    } else {
        bills.push(bill);
        currentBillNumber++;
        if (bill.billType === 'cash') currentCashNumber++;
        else currentCreditNumber++;
    }

    if (typeof window._convertingEstimateIndex !== 'undefined' && window._convertingEstimateIndex !== null) {
        if (estimates[window._convertingEstimateIndex]) {
            estimates[window._convertingEstimateIndex].convertedToBill = true;
        }
        window._convertingEstimateIndex = null;
    }

    if (typeof learnFromForm === 'function') learnFromForm();
    saveAllData();
    updateDashboard();
    showToast(`✅ Bill ${bill.billNo} ${_editingBillIndex !== null ? 'updated' : 'saved'}!`);
    window._lastSavedBillNo = bill.billNo;
    _editingBillIndex = null;
    setTimeout(() => {
        document.querySelector('.nav-btn[data-page="bills"]').click();
    }, 400);
}

// ── Shared bill HTML template (professional Siriman Motor Works design) ──
function _buildBillHTML(data) {
    const { billNo, billDate, customerName, customerPhone, isCompany, companyAddress, vehicleNo, vehicleModel, brand,
            mileage, laborItems, partItems, total, advance, balance, bankDetails } = data;

    const model = [brand, vehicleModel].filter(Boolean).join(' ') || '—';

    // Format description: capitalize first letter, end with period
    const fmtDesc = d => {
        if (!d) return d;
        d = d.trim();
        d = d.charAt(0).toUpperCase() + d.slice(1);
        if (!d.endsWith('.')) d += '.';
        return d;
    };

    const laborRows = laborItems.map((item, i) => `
        <tr style="background:${i%2===0?'#fff':'#f9f9f9'};">
            <td style="padding:11px 14px;border-bottom:1px solid #e8ecf0;color:#555;width:40px;">${i+1}</td>
            <td style="padding:11px 14px;border-bottom:1px solid #e8ecf0;">${fmtDesc(item.desc)}</td>
            <td style="padding:11px 14px;border-bottom:1px solid #e8ecf0;text-align:right;font-weight:500;white-space:nowrap;">${fmtN(item.total)}</td>
        </tr>`).join('');

    const partRows = partItems.map((item, i) => `
        <tr style="background:${i%2===0?'#fff':'#f9f9f9'};">
            <td style="padding:11px 14px;border-bottom:1px solid #e8ecf0;color:#555;width:40px;">${i+1}</td>
            <td style="padding:11px 14px;border-bottom:1px solid #e8ecf0;">${fmtDesc(item.desc)}${item.qty>1?' <span style="color:#888;font-size:14px;">×'+item.qty+'</span>':''}</td>
            <td style="padding:11px 14px;border-bottom:1px solid #e8ecf0;text-align:right;font-weight:500;white-space:nowrap;">${fmtN(item.total)}</td>
        </tr>`).join('');

    const bankHtml = bankDetails ? `
        <div style="margin-top:24px;border:1.5px solid #d0d7e3;border-radius:10px;padding:16px 20px;background:#f8faff;">
            <p style="font-size:13px;font-weight:600;color:#1f3c88;margin-bottom:8px;text-decoration:underline;">For bank transfers / deposits:</p>
            <p style="font-size:15px;line-height:2;color:#333;">
                Bank: ${bankDetails.bankName}${bankDetails.branch ? ' &nbsp;|&nbsp; Branch: '+bankDetails.branch : ''}<br>
                ${bankDetails.accountName ? 'Account holder: '+bankDetails.accountName+'<br>' : ''}
                Account number: ${bankDetails.accountNo}
            </p>
        </div>` : '';

    const advanceHtml = advance > 0 ? `
        <tr>
            <td colspan="2" style="padding:10px 14px;border-bottom:1px solid #e8ecf0;font-weight:500;color:#555;">Advance Paid</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e8ecf0;text-align:right;color:#555;">− ${fmtN(advance)}</td>
        </tr>
        <tr style="background:#e8f5e9;">
            <td colspan="2" style="padding:12px 14px;font-weight:700;font-size:17px;color:#1b5e20;">Balance Due</td>
            <td style="padding:12px 14px;text-align:right;font-weight:700;font-size:18px;color:#1b5e20;">${fmtN(balance)}</td>
        </tr>` : '';

    const dateStr    = billDate.replace(/\//g, '-');
    const safeName   = customerName.replace(/[^a-zA-Z0-9 \-]/g, '').trim();
    const safeVehicle = (vehicleNo || '').replace(/[^a-zA-Z0-9\-]/g, '');
    const pageTitle  = `${safeVehicle}_${safeName}_${dateStr}`;

    return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${pageTitle}</title>

<style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;background:#fff;color:#000;font-size:15px;min-height:100vh;display:flex;flex-direction:column;}
    .page{background:#fff;max-width:760px;margin:20px auto;flex:1;display:flex;flex-direction:column;width:100%;}
    .content{flex:1;}
    .bottom{margin-top:auto;}
    .header{border:1.5px solid #000;padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0;}
    .company-name{font-size:24px;font-weight:700;letter-spacing:0.3px;margin-bottom:3px;color:#000;}
    .company-sub{font-size:13px;line-height:1.8;color:#000;}
    .invoice-meta{text-align:right;}
    .invoice-title{font-size:24px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;color:#000;}
    .invoice-meta p{font-size:14px;line-height:1.9;color:#000;}
    .body{padding:16px 0;}
    .cust-section{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #000;}
    .cust-name{font-size:16px;font-weight:700;color:#000;margin-bottom:3px;}
    .cust-phone{font-size:14px;color:#000;}
    .section-title{font-size:13px;font-weight:700;color:#000;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;}
    .vehicle-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid #000;margin-bottom:16px;}
    .vehicle-cell{padding:8px 10px;border-right:1px solid #000;}
    .vehicle-cell:last-child{border-right:none;}
    .vehicle-cell .label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;color:#000;}
    .vehicle-cell .value{font-size:14.5px;font-weight:600;color:#000;}
    .vehicle-header{background:#fff;}
    table{width:100%;border-collapse:collapse;margin-bottom:0;}
    .tbl-wrap{border:1px solid #000;margin-bottom:16px;}
    thead tr{background:#fff;}
    thead th{padding:8px 10px;font-size:13px;font-weight:700;color:#000;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #000;}
    thead th:last-child{text-align:right;}
    .section-row td{background:#e0e0e0;color:#000;font-weight:700;font-size:14px;padding:7px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .total-row td{background:#fff;font-weight:700;font-size:16px;padding:10px 10px;color:#000;border-top:2px solid #000;}
    .total-row td:last-child{text-align:right;font-size:17px;}
    .footer{text-align:center;padding:14px 0;border-top:1px solid #000;font-size:14px;color:#000;line-height:2;margin-top:8px;}
    .sig-section{display:flex;justify-content:space-between;padding:20px 0 8px;}
    .sig-box{text-align:center;width:180px;}
    .sig-line{border-top:1px solid #000;padding-top:6px;font-size:13px;color:#000;}
    .print-btn{display:inline-block;margin:20px 8px 0;padding:10px 24px;background:#000;color:#fff;border:none;font-size:15px;font-weight:600;cursor:pointer;font-family:Arial,sans-serif;}
    .btn-row{text-align:center;}
    @media print{
        .btn-row{display:none;}
        body{background:#fff;margin:0;min-height:100vh;}
        .page{margin:0;max-width:100%;min-height:100vh;}
        .content{flex:1;}
    }
</style></head><body>
<div class="page">

    <!-- Header -->
    <div class="header">
        <div>
            <div class="company-name">Siriman Motor Works</div>
            <div class="company-sub">
                <em>Since 1958</em><br>
                Daluwakotuwa, Kochchikade.<br>
                Tel: 031 227 7371 &nbsp;|&nbsp; 074 255 7371<br>
                Email: sirimanmortors58@gmail.com
            </div>
            <p><strong>No:</strong> ${billNo}</p>
            <p><strong>Date:</strong> ${billDate}</p>
        </div>
    </div>

    <!-- Main content grows to fill space -->
    <div class="content">
    <div class="body">

        <!-- Customer -->
        <div class="cust-section" style="margin-top:20px;padding-top:8px;">
            <div>
                <div class="section-title">${isCompany ? 'Invoice To (Company)' : 'Bill To'}</div>
                ${isCompany ? `
                    ${companyAddress ? `<div class="cust-name" style="font-size:15px;font-weight:700;">${companyAddress}</div>` : ''}
                    ${customerPhone ? `<div class="cust-phone">${customerPhone}</div>` : ''}
                ` : `
                    <div class="cust-name">${customerName}</div>
                    ${customerPhone ? `<div class="cust-phone">${customerPhone}</div>` : ''}
                `}
            </div>
        </div>

        <!-- Vehicle Details -->
        <div class="section-title" style="margin-bottom:8px;margin-top:20px;">Vehicle Details</div>
        <div class="vehicle-grid" style="margin-bottom:24px;grid-template-columns:repeat(3,1fr);">
            <div class="vehicle-cell vehicle-header"><div class="label">Model</div><div class="value">${model}</div></div>
            <div class="vehicle-cell vehicle-header"><div class="label">Reg. No</div><div class="value">${vehicleNo||'—'}</div></div>
            <div class="vehicle-cell vehicle-header"><div class="label">Mileage</div><div class="value">${mileage?mileage+' km':'—'}</div></div>
        </div>

        <!-- Items Table -->
        <div class="tbl-wrap">
        <table>
            <thead><tr>
                <th style="width:40px;">No</th>
                <th style="text-align:left;">Description</th>
                <th style="width:140px;">Amount (Rs.)</th>
            </tr></thead>
            <tbody>
                ${laborRows ? `<tr class="section-row"><td colspan="3">Repair / Service Charges</td></tr>${laborRows}` : ''}
                ${partRows  ? `<tr class="section-row"><td colspan="3">Parts / Replacements</td></tr>${partRows}` : ''}
                <tr class="total-row">
                    <td colspan="2">Total</td>
                    <td>Rs. ${fmtN(total)}</td>
                </tr>
                ${advanceHtml}
            </tbody>
        </table>
        </div>

        ${bankHtml}

    </div>
    </div><!-- end .content -->

    <!-- Always at bottom -->
    <div class="bottom">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;padding:28px 0 10px;">
            <div style="text-align:center;width:200px;">
                <div style="height:40px;"></div>
                <div style="border-top:1px solid #000;padding-top:6px;font-size:13px;color:#000;">Customer Signature</div>
            </div>
            ${data.paid ? `
            <div style="text-align:center;width:120px;margin-bottom:10px;">
                <div style="border:3px solid #000;border-radius:50%;width:90px;height:90px;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto;transform:rotate(-12deg);position:relative;">
                    <div style="position:absolute;top:0;left:0;right:0;bottom:0;border:1.5px solid #000;border-radius:50%;margin:6px;"></div>
                    <div style="font-size:9px;font-weight:700;letter-spacing:0.5px;margin-bottom:2px;">SIRIMAN MOTOR WORKS</div>
                    <div style="font-size:22px;font-weight:900;letter-spacing:1px;line-height:1;">PAID</div>
                    <div style="font-size:9px;font-weight:700;letter-spacing:0.5px;margin-top:2px;">★ THANK YOU ★</div>
                </div>
            </div>` : '<div style="width:120px;"></div>'}
            <div style="text-align:center;width:200px;">
                <div style="height:40px;"></div>
                <div style="border-top:1px solid #000;padding-top:6px;font-size:13px;color:#000;">Authorized Signature</div>
            </div>
        </div>
        <div class="footer">
            We specialize in all types of Japanese and European vehicle repairing.<br>
            <strong>Thank you.</strong>
        </div>
    </div>

</div>
<div class="btn-row">
<button class="print-btn" onclick="window.print()">🖨 Print / Download PDF</button>

</div>
<script>
function printBW(){
    var page=document.querySelector('.page');
    var header=document.querySelector('.header');
    var sRows=document.querySelectorAll('.section-row td');
    var tRows=document.querySelectorAll('.total-row td');
    var vCells=document.querySelectorAll('.vehicle-cell');
    page.style.filter='grayscale(100%)';
    header.style.background='#000';
    sRows.forEach(function(el){el.style.background='#000';});
    tRows.forEach(function(el){el.style.background='#ddd';el.style.color='#000';});
    vCells.forEach(function(el){el.style.background='#f0f0f0';});
    window.print();
    setTimeout(function(){
        page.style.filter='';
        header.style.background='';
        sRows.forEach(function(el){el.style.background='';});
        tRows.forEach(function(el){el.style.background='';el.style.color='';});
        vCells.forEach(function(el){el.style.background='';});
    },1500);
}
<\/script>
</body></html>`;
}

// ── Preview Bill ──
function previewInvoice() {
    const customerId = document.getElementById('billCustomer').value;
    if (!customerId) { showToast('⚠️ Please select a customer first', 'error'); return; }

    const customer  = customers.find(c => c.id == customerId);
    const bankIdx   = document.getElementById('bankDetails').value;
    const bankDetails = bankIdx !== '' ? bankAccounts[parseInt(bankIdx)] : null;
    const advance   = getRaw(document.getElementById('advanceAmount')) || 0;

    const laborItems = [], partItems = [];
    let total = 0;
    document.querySelectorAll('.repair-desc').forEach((el, i) => {
        const desc = el.value.trim(); const amt = getRaw(document.querySelectorAll('.repair-amt')[i]);
        if (desc || amt) { laborItems.push({ desc: desc||'Labor', total: amt }); total += amt; }
    });
    document.querySelectorAll('.part-desc').forEach((el, i) => {
        const desc = el.value.trim();
        const row  = el.closest('.item-row-part');
        const qty  = row ? (parseFloat(row.querySelector('.part-qty').value)||1) : 1;
        const unit = getRaw(document.querySelectorAll('.part-amt')[i]);
        const amt  = unit * qty;
        if (desc || amt) { partItems.push({ desc: desc||'Part', qty, total: amt }); total += amt; }
    });

    const win = window.open('', '_blank', 'width=750,height=950');
    win.document.write(_buildBillHTML({
        billNo:       document.getElementById('invoiceNo').value,
        billDate:     document.getElementById('invoiceDate').value,
        customerName: customer.name,
        customerPhone:customer.contacts || '',
        isCompany:    customer.isCompany || false,
        companyAddress: customer.companyAddress || '',
        vehicleNo:    customer.vehicleNo,
        vehicleModel: customer.vehicleModel || '',
        brand:        customer.brand || '',
        mileage:      document.getElementById('mileage').value || '',
        laborItems, partItems, total,
        advance,
        balance: Math.max(0, total - advance),
        bankDetails,
        paid: document.getElementById('billPaidCheck')?.checked || false
    }));
    win.document.close();
}

// ── Load Bills Table ──
function loadBillsTable() {
    const searchTerm  = (document.getElementById('billSearch')?.value || '').toLowerCase();
    const dateFrom    = document.getElementById('billDateFrom')?.value;
    const dateTo      = document.getElementById('billDateTo')?.value;
    const paidFilter  = document.getElementById('billPaidFilter')?.value;
    const typeFilter  = document.getElementById('billTypeFilter')?.value;

    const filtered = bills.filter(bill => {
        const matchText = bill.billNo.toLowerCase().includes(searchTerm) ||
                          bill.customerName.toLowerCase().includes(searchTerm) ||
                          (bill.vehicleNo || '').toLowerCase().includes(searchTerm);
        const billDate  = new Date(bill.date);
        const matchFrom = dateFrom ? billDate >= new Date(dateFrom) : true;
        const matchTo   = dateTo   ? billDate <= new Date(dateTo + 'T23:59:59') : true;
        const matchPaid = paidFilter === 'paid'   ? bill.paid === true :
                          paidFilter === 'unpaid' ? !bill.paid          : true;
        const matchType = typeFilter ? (bill.billType || 'cash') === typeFilter : true;
        return matchText && matchFrom && matchTo && matchPaid && matchType;
    });

    const tbody = document.getElementById('billsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="11">
                <div class="empty-state">
                    <div class="empty-state-icon">🧾</div>
                    <h4>${searchTerm ? 'No results found' : 'No bills yet'}</h4>
                    <p>${searchTerm ? 'Try a different search term.' : 'Create your first Bill to see it here.'}</p>
                    ${!searchTerm ? `<button class="btn btn-primary btn-sm" onclick="document.querySelector('[data-page=new-bill]').click()">
                        <span class="material-symbols-rounded" style="font-size:14px;">add</span> New Bill
                    </button>` : ''}
                </div>
            </td></tr>
        `;
        return;
    }

    // Sort: starred first, then by date desc
    const sorted = [...filtered].sort((a, b) => {
        if ((b.starred ? 1 : 0) !== (a.starred ? 1 : 0)) return (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
        return new Date(b.date) - new Date(a.date);
    });

    let html = '';
    sorted.forEach(bill => {
        const idx     = bills.indexOf(bill);
        const paid    = bill.paid || false;
        const starred = bill.starred || false;
        const isNew   = window._lastSavedBillNo && bill.billNo === window._lastSavedBillNo;

        html += `
            <tr class="clickable-row" onclick="printBill(${idx})" style="${isNew ? 'background:linear-gradient(90deg,#DCFCE7,var(--surface));border-left:3px solid #16A34A;' : ''}${paid ? 'opacity:0.75;' : ''}${starred ? 'background:linear-gradient(90deg,#FFFBEB,var(--surface));' : ''}">
                <td style="text-align:center;padding:0 4px;">
                    <button onclick="event.stopPropagation(); toggleBillStar(${idx})" title="${starred ? 'Unstar' : 'Star'}"
                        style="background:none;border:none;cursor:pointer;font-size:18px;line-height:1;padding:4px;">
                        ${starred ? '⭐' : '☆'}
                    </button>
                </td>
                <td>
                    <span class="badge badge-blue">${bill.billNo}</span>
                    ${isNew ? ' <span class="badge" style="background:#DCFCE7;color:#16A34A;font-size:10px;">✦ New</span>' : ''}
                </td>
                <td class="td-muted">${new Date(bill.date).toLocaleDateString()}</td>
                <td>
                    <div style="font-weight:700;">${bill.customerName}</div>
                    <div style="font-size:12px;color:var(--text-muted);">${bill.vehicleNo}</div>
                </td>
                <td class="td-muted">${bill.vehicleNo}</td>
                <td>
                    ${(bill.billType || 'cash') === 'cash'
                        ? '<span class="badge" style="background:#DCFCE7;color:#16A34A;">💵 Cash</span>'
                        : '<span class="badge" style="background:#EDE9FE;color:#7C3AED;">💳 Credit</span>'}
                </td>
                <td><strong style="color:${paid ? '#16A34A' : 'var(--primary)'};font-size:14px;">${paid ? '✓ ' : ''}Rs. ${fmtN(bill.total)}</strong></td>
                <td class="td-muted">${bill.advance > 0 ? 'Rs. ' + fmtN(bill.advance) : '—'}</td>
                <td><strong style="color:${(bill.balance === 0 || paid) ? '#16A34A' : '#DC2626'};font-size:14px;">Rs. ${fmtN(bill.balance || 0)}</strong></td>
                <td>
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="event.stopPropagation()">
                        <input type="checkbox" ${paid ? 'checked' : ''} onchange="toggleBillPaid(${idx}, this.checked)"
                            style="width:18px;height:18px;accent-color:#16A34A;cursor:pointer;">
                        <span style="font-size:12.5px;font-weight:600;color:${paid ? '#16A34A' : 'var(--text-muted)'};">
                            ${paid ? 'Paid' : 'Unpaid'}
                        </span>
                    </label>
                </td>
                <td>
                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); editBill(${idx})" title="Edit bill">
                            <span class="material-symbols-rounded" style="font-size:14px;">edit</span>
                        </button>
                        <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); downloadBill(${idx})" title="Download PDF">
                            <span class="material-symbols-rounded" style="font-size:14px;">download</span>
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); printBillRecord(${idx})" title="Print">
                            <span class="material-symbols-rounded" style="font-size:14px;">print</span>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteBill(${idx})" title="Delete bill">
                            <span class="material-symbols-rounded" style="font-size:14px;">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ── Toggle Bill Star ──
function toggleBillStar(index) {
    if (!bills[index]) return;
    bills[index].starred = !bills[index].starred;
    saveAllData();
    loadBillsTable();
}

// ── Toggle Bill Paid Status ──
function toggleBillPaid(index, isPaid) {
    if (!bills[index]) return;
    const bill = bills[index];

    const msg    = isPaid
        ? `Mark bill <strong>${bill.billNo}</strong> (Rs. ${fmtN(bill.total)}) as <strong style="color:#16A34A;">Paid</strong>?`
        : `Mark bill <strong>${bill.billNo}</strong> (Rs. ${fmtN(bill.total)}) as <strong style="color:#EF4444;">Unpaid</strong>?`;
    const color  = isPaid ? 'linear-gradient(135deg,#22C55E,#16A34A)' : 'linear-gradient(135deg,#EF4444,#DC2626)';
    const shadow = isPaid ? '0 4px 12px rgba(34,197,94,0.3)' : '0 4px 12px rgba(239,68,68,0.3)';
    const label  = isPaid ? '✅ Confirm Paid' : '🔄 Confirm Unpaid';

    openDeleteModal(() => {
        bill.paid = isPaid;
        // When marking paid, clear the balance; when unpaid, restore it
        bill.balance = isPaid ? 0 : Math.max(0, bill.total - (bill.advance || 0));
        saveAllData();
        showToast(isPaid ? `✅ Bill ${bill.billNo} marked as Paid` : `🔄 Bill ${bill.billNo} marked as Unpaid`);
        loadBillsTable();
    }, msg);

    // Style the confirm button
    const confirmBtn = document.querySelector('#deleteModal .btn-danger');
    if (confirmBtn) {
        confirmBtn.innerHTML = `<span class="material-symbols-rounded">check_circle</span> ${label}`;
        confirmBtn.style.background = color;
        confirmBtn.style.boxShadow  = shadow;
    }

    // Cancel restores checkbox state
    const cancelBtn = document.querySelector('#deleteModal .btn-secondary');
    if (cancelBtn) {
        cancelBtn.onclick = () => { closeDeleteModal(); loadBillsTable(); };
    }
}


// ── Edit Bill ──
// Track which bill index is being edited (null = new bill)
let _editingBillIndex = null;

function editBill(index) {
    const bill = bills[index];
    if (!bill) return;

    // Navigate first, then set index AFTER page renders (renderNewBillPage resets it)
    document.querySelector('.nav-btn[data-page="new-bill"]').click();

    setTimeout(() => {
        // Set editing index AFTER renderNewBillPage has run and reset it
        _editingBillIndex = index;
        const custSelect = document.getElementById('billCustomer');
        if (custSelect) {
            custSelect.value = bill.customerId;
            loadBillCustomerDetails();
            const c = customers.find(x => x.id == bill.customerId);
            if (c) {
                const si = document.getElementById('billCustSearch');
                if (si) si.value = c.name + (c.vehicleNo ? '  —  ' + c.vehicleNo : '');
            }
        }

        // Bill type
        const typeRadio = document.querySelector(`input[name="billType"][value="${bill.billType || 'cash'}"]`);
        if (typeRadio) { typeRadio.checked = true; updateBillType(); }

        document.getElementById('invTypeManual').checked = true;
        toggleInvNo();
        document.getElementById('invoiceNo').value = bill.billNo;

        document.querySelector('input[name="invDate"][value="manual"]').checked = true;
        toggleInvDate();
        document.getElementById('invoiceDate').value = new Date(bill.date).toLocaleDateString('en-GB').replace(/\//g, '/');

        if (bill.mileage) document.getElementById('mileage').value = bill.mileage;

        // Advance & paid
        if (bill.advance) {
            const adv = document.getElementById('advanceAmount');
            if (adv) { adv.value = bill.advance; fmtAmtInput(adv); }
        }
        const paidCheck = document.getElementById('billPaidCheck');
        if (paidCheck) paidCheck.checked = bill.paid || false;

        document.getElementById('repairRows').innerHTML = '';
        document.getElementById('partRows').innerHTML   = `
            <div class="part-row-header">
                <span>Description</span><span>Qty</span><span>Unit Price</span><span></span>
            </div>`;

        bill.items.forEach(item => {
            if (item.type === 'Labor') {
                addRepairRow();
                const rows = document.querySelectorAll('#repairRows .item-row');
                const last = rows[rows.length - 1];
                last.querySelector('.repair-desc').value = item.desc;
                const raInput = last.querySelector('.repair-amt');
                raInput.value = item.price; fmtAmtInput(raInput);
            } else {
                addPartRow();
                const rows = document.querySelectorAll('#partRows .item-row-part');
                const last = rows[rows.length - 1];
                last.querySelector('.part-desc').value = item.desc;
                last.querySelector('.part-qty').value  = item.qty || 1;
                const paInput = last.querySelector('.part-amt');
                paInput.value = item.price; fmtAmtInput(paInput);
            }
        });
        recalcTotal();
        recalcBalance();

        // Show editing banner
        showToast('✏️ Editing bill — save when done');
    }, 150);
}

// ── Print saved bill ──
function printBill(index) {
    const bill = bills[index];
    if (!bill) return;
    const win = window.open('', '_blank', 'width=750,height=950');
    win.document.write(_buildBillHTML({
        billNo:        bill.billNo,
        billDate:      new Date(bill.date).toLocaleDateString('en-GB'),
        customerName:  bill.customerName,
        customerPhone: bill.customerPhone || '',
        isCompany:     bill.isCompany || false,
        companyAddress: bill.companyAddress || '',
        vehicleNo:     bill.vehicleNo,
        vehicleModel:  bill.vehicleModel || '',
        brand:         bill.brand || '',
        mileage:       bill.mileage || '',
        laborItems:    bill.items.filter(i => i.type === 'Labor'),
        partItems:     bill.items.filter(i => i.type === 'Part'),
        total:         bill.total,
        advance:       bill.advance || 0,
        balance:       bill.balance || 0,
        bankDetails:   bill.bankDetails || null,
        paid:          bill.paid || false
    }));
    win.document.close();
}

// ── Download Bill as PDF ──
// ── Download Bill as PDF (direct download using jsPDF) ──
function downloadBill(index) {
    const bill = bills[index];
    if (!bill) return;
    if (!window.jspdf) { showToast('⚠️ PDF library not loaded', 'error'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pw = 210, margin = 14, cw = pw - margin * 2;
    let y = 14;

    const model = [bill.brand, bill.vehicleModel].filter(Boolean).join(' ') || '—';
    const dateStr = new Date(bill.date).toLocaleDateString('en-GB');
    const laborItems = bill.items.filter(i => i.type === 'Labor');
    const partItems  = bill.items.filter(i => i.type === 'Part');
    const fmtDesc = d => { if (!d) return ''; d = d.trim(); d = d.charAt(0).toUpperCase() + d.slice(1); if (!d.endsWith('.')) d += '.'; return d; };

    // Header box
    doc.setDrawColor(0); doc.setLineWidth(0.4);
    doc.rect(margin, y, cw, 28);
    doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(0);
    doc.text('Siriman Motor Works', margin+3, y+8);
    doc.setFont('helvetica','italic'); doc.setFontSize(10); doc.setTextColor(100);
    doc.text('Since 1958', margin+3, y+13);
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(0);
    doc.text('Daluwakotuwa, Kochchikade.', margin+3, y+18);
    doc.text('Tel: 031 227 7371  |  074 255 7371', margin+3, y+22);
    doc.text('Email: sirimanmortors58@gmail.com', margin+3, y+26);
    doc.setFont('helvetica','bold'); doc.setFontSize(20);
    doc.text('INVOICE', pw-margin-3, y+9, {align:'right'});
    doc.setFont('helvetica','normal'); doc.setFontSize(11);
    doc.text(`No: ${bill.billNo}`, pw-margin-3, y+18, {align:'right'});
    doc.text(`Date: ${dateStr}`, pw-margin-3, y+24, {align:'right'});
    y += 32;

    // Bill To
    y += 6;
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(100);
    doc.text('BILL TO', margin, y); y += 5;
    doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.setTextColor(0);
    if (bill.isCompany) {
        if (bill.companyAddress) { doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.text(bill.companyAddress, margin, y, {maxWidth:cw}); y += 7; doc.setFont('helvetica','normal'); doc.setFontSize(11); }
        if (bill.customerPhone)  { doc.text(bill.customerPhone, margin, y); y += 6; }
    } else {
        doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.text(bill.customerName, margin, y); y += 6;
        doc.setFont('helvetica','normal'); doc.setFontSize(11);
        if (bill.customerPhone) { doc.text(bill.customerPhone, margin, y); y += 6; }
    }
    y += 2;

    // Vehicle grid
    y += 6;
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(100);
    doc.text('VEHICLE DETAILS', margin, y); y += 3;
    const c3 = cw/3;
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.rect(margin, y, cw, 14);
    doc.line(margin+c3, y, margin+c3, y+14);
    doc.line(margin+c3*2, y, margin+c3*2, y+14);
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(0);
    doc.text('MODEL', margin+2, y+5); doc.text('REG. NO', margin+c3+2, y+5); doc.text('MILEAGE', margin+c3*2+2, y+5);
    doc.setFont('helvetica','normal'); doc.setFontSize(11);
    doc.text(model, margin+2, y+11); doc.text(bill.vehicleNo||'—', margin+c3+2, y+11); doc.text(bill.mileage?bill.mileage+' km':'—', margin+c3*2+2, y+11);
    y += 18;

    // Table header
    doc.setFillColor(220,220,220); doc.rect(margin, y, cw, 8, 'F');
    doc.setDrawColor(0); doc.rect(margin, y, cw, 8);
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(0);
    doc.text('NO', margin+2, y+5.5); doc.text('DESCRIPTION', margin+12, y+5.5); doc.text('AMOUNT (RS.)', pw-margin-2, y+5.5, {align:'right'});
    y += 8;

    const drawSection = (label, items) => {
        if (!items.length) return;
        doc.setFillColor(235,235,235); doc.rect(margin, y, cw, 7, 'F');
        doc.setDrawColor(0); doc.rect(margin, y, cw, 7);
        doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor(0);
        doc.text(label, margin+2, y+5); y += 7;
        items.forEach((item, i) => {
            if (y+9 > 258) { doc.addPage(); y = 14; }
            doc.setFillColor(i%2===0?255:248, i%2===0?255:248, i%2===0?255:248);
            doc.rect(margin, y, cw, 9, 'F');
            doc.setDrawColor(180); doc.rect(margin, y, cw, 9);
            doc.setFont('helvetica','normal'); doc.setFontSize(10.5); doc.setTextColor(0);
            doc.text(String(i+1), margin+2, y+6);
            doc.text(fmtDesc(item.desc)+(item.qty>1?` x${item.qty}`:''), margin+12, y+6, {maxWidth:cw-50});
            doc.text(fmtN(item.total), pw-margin-2, y+6, {align:'right'});
            y += 9;
        });
    };

    drawSection('Repair / Service Charges', laborItems);
    drawSection('Parts / Replacements', partItems);

    // Total
    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.rect(margin, y, cw, 9);
    doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(0);
    doc.text('Total', margin+2, y+6.5); doc.text('Rs. '+fmtN(bill.total), pw-margin-2, y+6.5, {align:'right'});
    y += 9;

    if (bill.advance > 0) {
        doc.setFont('helvetica','normal'); doc.setFontSize(11);
        doc.rect(margin, y, cw, 8); doc.text('Advance Paid', margin+2, y+5.5); doc.text('Rs. '+fmtN(bill.advance), pw-margin-2, y+5.5, {align:'right'}); y += 8;
        doc.setFont('helvetica','bold'); doc.rect(margin, y, cw, 9); doc.text('Balance Due', margin+2, y+6.5); doc.text('Rs. '+fmtN(bill.balance||0), pw-margin-2, y+6.5, {align:'right'}); y += 9;
    }

    // Bank details
    if (bill.bankDetails) {
        y += 4; doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(margin, y, cw, 20);
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.text('For bank transfers / deposits:', margin+3, y+6);
        doc.setFont('helvetica','normal'); doc.setFontSize(10);
        doc.text(`Bank: ${bill.bankDetails.bankName}${bill.bankDetails.branch?' | Branch: '+bill.bankDetails.branch:''}`, margin+3, y+12);
        if (bill.bankDetails.accountName) doc.text(`Account holder: ${bill.bankDetails.accountName}`, margin+3, y+16);
        doc.text(`Account number: ${bill.bankDetails.accountNo}`, margin+3, y+(bill.bankDetails.accountName?20:16));
        y += 24;
    }

    // Signatures
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.line(margin, 253, margin+55, 253); doc.line(pw-margin-55, 253, pw-margin, 253);
    doc.setFont('helvetica','normal'); doc.setFontSize(10);
    doc.text('Customer Signature', margin, 258); doc.text('Authorized Signature', pw-margin-55, 258);

    // Footer
    doc.setFont('helvetica','italic'); doc.setFontSize(10); doc.setTextColor(80);
    doc.text('We specialize in all types of Japanese and European vehicle repairing.', pw/2, 267, {align:'center'});
    doc.setFont('helvetica','bold'); doc.setTextColor(0);
    doc.text('Thank you.', pw/2, 273, {align:'center'});

    const sv = (bill.vehicleNo||'').replace(/[^a-zA-Z0-9\-]/g,'');
    const sn = (bill.customerName||'').replace(/[^a-zA-Z0-9 \-]/g,'').trim();
    const sd = new Date(bill.date).toLocaleDateString('en-GB').replace(/\//g,'-');
    doc.save(`${sv}_${sn}_${sd}.pdf`);
    showToast('📄 PDF downloaded');
}

// ── Print Bill ──
function printBillRecord(index) {
    const bill = bills[index];
    if (!bill) return;
    const laborItems = bill.items.filter(i => i.type === 'Labor');
    const partItems  = bill.items.filter(i => i.type === 'Part');
    const win = window.open('', '_blank', 'width=800,height=950');
    win.document.write(_buildBillHTML({
        billNo: bill.billNo,
        billDate: new Date(bill.date).toLocaleDateString('en-GB'),
        customerName: bill.customerName,
        customerPhone: bill.customerPhone || '',
        isCompany: bill.isCompany || false,
        companyAddress: bill.companyAddress || '',
        vehicleNo: bill.vehicleNo,
        vehicleModel: bill.vehicleModel || '',
        brand: bill.brand || '',
        mileage: bill.mileage || '',
        laborItems, partItems,
        total: bill.total,
        advance: bill.advance || 0,
        balance: bill.paid ? 0 : (bill.balance ?? bill.total),
        bankDetails: bill.bankDetails || null,
        paid: bill.paid || false
    }));
    win.document.close();
    setTimeout(() => win.print(), 500);
}

// ── Delete Bill ──
function deleteBill(index) {
    openDeleteModal(() => {
        bills.splice(index, 1);
        saveAllData();
        loadBillsTable();
        updateDashboard();
        showToast('🗑 Bill deleted');
    });
}

// ── Export Filtered Bills to PDF ──
function exportFilteredBillsToPDF() {
    if (!window.jspdf) { showToast('⚠️ PDF library not loaded', 'error'); return; }

    const searchTerm = (document.getElementById('billSearch')?.value || '').toLowerCase();
    const dateFrom   = document.getElementById('billDateFrom')?.value;
    const dateTo     = document.getElementById('billDateTo')?.value;
    const paidFilter = document.getElementById('billPaidFilter')?.value;

    const typeFilter  = document.getElementById('billTypeFilter')?.value;

    const filtered = bills.filter(bill => {
        const matchText = bill.billNo.toLowerCase().includes(searchTerm) ||
                          bill.customerName.toLowerCase().includes(searchTerm) ||
                          (bill.vehicleNo || '').toLowerCase().includes(searchTerm);
        const billDate  = new Date(bill.date);
        const matchFrom = dateFrom ? billDate >= new Date(dateFrom) : true;
        const matchTo   = dateTo   ? billDate <= new Date(dateTo + 'T23:59:59') : true;
        const matchPaid = paidFilter === 'paid'   ? bill.paid === true :
                          paidFilter === 'unpaid' ? !bill.paid          : true;
        const matchType = typeFilter ? (bill.billType || 'cash') === typeFilter : true;
        return matchText && matchFrom && matchTo && matchPaid && matchType;
    });

    if (filtered.length === 0) { showToast('⚠️ No bills to export', 'error'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('portrait');
    const PW = 210, M = 14, CW = PW - M * 2; // 182mm usable width

    // Header
    doc.setFillColor(15, 45, 74);
    doc.rect(0, 0, PW, 22, 'F');
    doc.setTextColor(201, 168, 76);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Siriman Motor Works', M, 10);
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('Bill History Report', M, 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(new Date().toLocaleString(), PW - M, 17, { align: 'right' });

    // Filter summary
    const parts = [];
    if (searchTerm)  parts.push(`Search: "${searchTerm}"`);
    if (dateFrom)    parts.push(`From: ${dateFrom}`);
    if (dateTo)      parts.push(`To: ${dateTo}`);
    if (paidFilter)  parts.push(`Status: ${paidFilter.charAt(0).toUpperCase() + paidFilter.slice(1)}`);
    if (parts.length) {
        doc.setFontSize(7.5);
        doc.setTextColor(100, 100, 100);
        doc.text('Filters: ' + parts.join('  |  '), M, 28);
    }

    // Table — portrait 182mm split across 8 cols
    const startY = parts.length ? 33 : 27;
    const cols   = ['Bill No', 'Date', 'Customer', 'Vehicle', 'Total', 'Advance', 'Balance', 'Status'];
    const colW   = [22, 22, 44, 26, 24, 22, 24, 18]; // sum = 202 — fits with small font
    let x = M, y = startY;

    // Table header
    doc.setFillColor(30, 41, 59);
    doc.rect(M, y, CW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    cols.forEach((col, i) => {
        doc.text(col, x + 1.5, y + 4.8);
        x += colW[i];
    });
    y += 7;

    // Rows
    doc.setFont('helvetica', 'normal');
    [...filtered].reverse().forEach((bill, ri) => {
        if (y > 268) {
            doc.addPage();
            y = 14;
            // Repeat header on new page
            x = M;
            doc.setFillColor(30, 41, 59);
            doc.rect(M, y, CW, 7, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            cols.forEach((col, i) => { doc.text(col, x + 1.5, y + 4.8); x += colW[i]; });
            y += 7;
        }
        doc.setFillColor(ri % 2 === 0 ? 248 : 255, ri % 2 === 0 ? 250 : 255, ri % 2 === 0 ? 252 : 255);
        doc.rect(M, y, CW, 7, 'F');
        doc.setFontSize(7);
        x = M;
        const advance = bill.advance > 0 ? fmtN(bill.advance) : '—';
        const balance = bill.paid ? '0.00' : fmtN(bill.balance ?? bill.total);
        const row = [
            bill.billNo,
            new Date(bill.date).toLocaleDateString('en-GB'),
            bill.customerName.length > 18 ? bill.customerName.substring(0, 17) + '…' : bill.customerName,
            bill.vehicleNo || '—',
            fmtN(bill.total),
            advance,
            balance,
            bill.paid ? 'Paid' : 'Unpaid'
        ];
        row.forEach((val, i) => {
            if (i === 7) {
                doc.setTextColor(bill.paid ? 22 : 239, bill.paid ? 163 : 68, bill.paid ? 74 : 68);
                doc.setFont('helvetica', 'bold');
            } else if (i === 6 && !bill.paid) {
                doc.setTextColor(239, 68, 68);
                doc.setFont('helvetica', 'bold');
            } else {
                doc.setTextColor(15, 23, 42);
                doc.setFont('helvetica', 'normal');
            }
            doc.text(String(val), x + 1.5, y + 4.8);
            x += colW[i];
        });
        doc.setDrawColor(226, 232, 240);
        doc.line(M, y + 7, M + CW, y + 7);
        y += 7;
    });

    // Summary
    const totalAmt = filtered.reduce((s, b) => s + b.total, 0);
    const paidAmt  = filtered.filter(b => b.paid).reduce((s, b) => s + b.total, 0);
    const totalAdv = filtered.reduce((s, b) => s + (b.advance || 0), 0);
    const totalBal = filtered.reduce((s, b) => s + (b.paid ? 0 : (b.balance ?? b.total)), 0);

    y += 4;
    doc.setFillColor(239, 246, 255);
    doc.rect(M, y, CW, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(37, 99, 235);
    doc.text(`${filtered.length} bill${filtered.length !== 1 ? 's' : ''}`, M + 2, y + 6.5);
    doc.text(`Total: Rs. ${fmtN(totalAmt)}`, M + 50, y + 6.5);
    doc.setTextColor(22, 163, 74);
    doc.text(`Paid: Rs. ${fmtN(paidAmt)}`, M + 115, y + 6.5);

    if (totalBal > 0) {
        y += 12;
        doc.setFillColor(254, 226, 226);
        doc.rect(M, y, CW, 9, 'F');
        doc.setDrawColor(239, 68, 68);
        doc.setLineWidth(0.5);
        doc.rect(M, y, CW, 9);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(185, 28, 28);
        doc.text('Total Balance Due:', M + 2, y + 6);
        doc.text(`Rs. ${fmtN(totalBal)}`, PW - M - 2, y + 6, { align: 'right' });
        if (totalAdv > 0) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(120, 53, 15);
            doc.text(`Advance Paid: Rs. ${fmtN(totalAdv)}`, M + 70, y + 6);
        }
    }

    doc.save(`bills_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('📄 PDF exported successfully');
}

// ── Export Bills to Excel ──
function exportBillsToExcel() {
    if (bills.length === 0) { showToast('⚠️ No bills to export', 'error'); return; }

    const rows = [['Bill No', 'Date', 'Customer', 'Vehicle', 'Items', 'Total (Rs.)']];
    bills.forEach(b => {
        rows.push([
            b.billNo,
            new Date(b.date).toLocaleDateString(),
            b.customerName,
            b.vehicleNo,
            b.items.length,
            fmtN(b.total)
        ]);
    });

    const csvContent = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `bills_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📊 Bills exported to CSV');
}