// ==================== MAIN APP ====================

async function init() {
    // Load localStorage immediately so page renders fast
    await loadAllData();
    loadPage('dashboard');
    updateDateTime();
    setInterval(updateDateTime, 1000);
    setupNavigation();

    // Ensure splash shows for at least 5 seconds
    const splashStart = window._splashStart || Date.now();
    const elapsed = Date.now() - splashStart;
    const remaining = Math.max(0, 3000 - elapsed);
    setTimeout(() => {
        if (typeof window._dismissSplash === 'function') window._dismissSplash();
    }, remaining);

    // Check server in background — if it has data, reload the page
    const serverUp = await checkSyncServer();
    if (serverUp) {
        const loaded = await loadFromServer();
        if (loaded) {
            const activePage = document.querySelector('.nav-btn.active')?.getAttribute('data-page') || 'dashboard';
            loadPage(activePage);
        }
    }
}

function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const page = btn.getAttribute('data-page');
            loadPage(page);
        });
    });
}

function loadPage(pageName) {
    const titles = {
        'dashboard': 'Dashboard',
        'customers': 'Customer Management',
        'new-bill': 'New Bill',
        'new-estimate': 'New Estimate',
        'payment-slip': 'Payment Slip',
        'payment-history': 'Payment History',
        'bills': 'Bill History',
        'estimates': 'Estimate History',
        'settings': 'Settings',
        'analysis': 'Analysis',
        'analysis': 'Analysis'
    };
    document.getElementById('pageTitle').innerText = titles[pageName] || pageName;

    // Animate out
    const content = document.getElementById('pageContent');
    content.style.opacity = '0';
    content.style.transform = 'translateY(8px)';

    setTimeout(() => {
        switch (pageName) {
            case 'dashboard': renderDashboard(); break;
            case 'customers': renderCustomerPage(); break;
            case 'new-bill': renderNewBillPage(); break;
            case 'new-estimate': renderNewEstimatePage(); break;
            case 'payment-slip': renderPaymentSlipPage(); break;
            case 'payment-history': renderPaymentHistoryPage(); break;
            case 'bills': renderBillsPage(); break;
            case 'estimates': renderEstimatesPage(); break;
            case 'settings': renderSettingsPage(); break;
            case 'analysis': renderAnalysisPage(); break;
        }
        content.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
    }, 80);
}

// ── Dashboard ──
function renderDashboard() {
    const totalCustomers = customers.length;
    const totalBills = bills.length;
    const totalRevenue = bills.reduce((sum, bill) => sum + bill.total, 0);
    const today = new Date().toDateString();
    const todayBills = bills.filter(bill => new Date(bill.date).toDateString() === today);
    const todayRevenue = todayBills.reduce((sum, bill) => sum + bill.total, 0);
    const todayPaid    = todayBills.filter(b => b.paid).reduce((sum, b) => sum + b.total, 0);
    const todayUnpaid  = todayRevenue - todayPaid;

    // ── Recent 3 Bills ──
    const recentBillsRows = bills.slice(-3).reverse().map(bill => {
        const idx  = bills.indexOf(bill);
        const paid = bill.paid || false;
        const type = (bill.billType || 'cash') === 'cash'
            ? '<span class="badge" style="background:#DCFCE7;color:#16A34A;font-size:10px;">💵 Cash</span>'
            : '<span class="badge" style="background:#EDE9FE;color:#7C3AED;font-size:10px;">💳 Credit</span>';
        const paidBadge = paid
            ? '<span class="badge" style="background:#DCFCE7;color:#16A34A;font-size:10px;">✓ Paid</span>'
            : '<span class="badge" style="background:#FEE2E2;color:#DC2626;font-size:10px;">Unpaid</span>';
        const slip = [...paymentSlips].reverse().find(s => s.refBill === bill.billNo);
        const methodBadge = slip
            ? `<span class="badge badge-gray" style="font-size:10px;">${slip.method}</span>`
            : '<span style="font-size:11px;color:var(--text-muted);">—</span>';
        return `
        <tr>
            <td><span class="badge badge-blue">${bill.billNo}</span><div style="margin-top:3px;">${type}</div></td>
            <td><strong>${bill.customerName}</strong><div style="font-size:11px;color:var(--text-muted);">${bill.vehicleNo || ''}</div></td>
            <td class="td-muted">${new Date(bill.date).toLocaleDateString()}</td>
            <td><strong style="color:${paid ? '#16A34A' : 'var(--primary)'}">Rs. ${fmtN(bill.total)}</strong></td>
            <td>${paidBadge}</td>
            <td>${methodBadge}</td>
            <td>
                <div style="display:flex;gap:5px;">
                    <button class="btn btn-sm btn-secondary" onclick="editBill(${idx})" title="Edit"><span class="material-symbols-rounded" style="font-size:13px;">edit</span></button>
                    <button class="btn btn-sm btn-success" onclick="downloadBill(${idx})" title="Download"><span class="material-symbols-rounded" style="font-size:13px;">download</span></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteBill(${idx})" title="Delete"><span class="material-symbols-rounded" style="font-size:13px;">delete</span></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    // ── Recent 3 Estimates ──
    const recentEstRows = estimates.slice(-3).reverse().map(est => {
        const idx = estimates.indexOf(est);
        return `
        <tr>
            <td><span class="badge" style="background:#EDE9FE;color:#7C3AED;">${est.estNo}</span></td>
            <td><strong>${est.customerName}</strong><div style="font-size:11px;color:var(--text-muted);">${est.vehicleNo || ''}</div></td>
            <td class="td-muted">${new Date(est.date).toLocaleDateString()}</td>
            <td><strong style="color:#7C3AED;">Rs. ${fmtN(est.total)}</strong></td>
            <td>
                <div style="display:flex;gap:5px;">
                    <button class="btn btn-sm btn-secondary" onclick="editEstimate(${idx})" title="Edit"><span class="material-symbols-rounded" style="font-size:13px;">edit</span></button>
                    <button class="btn btn-sm btn-secondary" onclick="printEstimateRecord(${idx})" title="Print"><span class="material-symbols-rounded" style="font-size:13px;">print</span></button>
                    <button class="btn btn-sm btn-success" onclick="downloadEstimate(${idx})" title="Download"><span class="material-symbols-rounded" style="font-size:13px;">download</span></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    const html = `
        <!-- Stats Grid -->
        <div class="stats-grid">
            <div class="stat-card blue">
                <div class="stat-card-icon"><span class="material-symbols-rounded">people</span></div>
                <h3>Total Customers</h3>
                <div class="number">${totalCustomers}</div>
                <div class="change" style="color:var(--primary)"><span class="material-symbols-rounded" style="font-size:14px;">person</span> Active accounts</div>
            </div>
            <div class="stat-card green">
                <div class="stat-card-icon"><span class="material-symbols-rounded">receipt_long</span></div>
                <h3>Total Bills</h3>
                <div class="number">${totalBills}</div>
                <div class="change" style="color:var(--accent)"><span class="material-symbols-rounded" style="font-size:14px;">check_circle</span> Bills issued</div>
            </div>
            <div class="stat-card purple">
                <div class="stat-card-icon"><span class="material-symbols-rounded">today</span></div>
                <h3>Today's Revenue</h3>
                <div class="number" style="font-size:${todayRevenue > 99999 ? '20px' : '28px'}">Rs. ${fmtN(todayRevenue, 0)}</div>
                <div class="change" style="color:#7C3AED"><span class="material-symbols-rounded" style="font-size:14px;">trending_up</span> ${todayBills.length} bill${todayBills.length !== 1 ? 's' : ''} today</div>
                <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                    <span style="font-size:11px;font-weight:600;background:#DCFCE7;color:#16A34A;padding:2px 8px;border-radius:20px;">✓ Paid: Rs. ${fmtN(todayPaid, 0)}</span>
                    <span style="font-size:11px;font-weight:600;background:#FEE2E2;color:#DC2626;padding:2px 8px;border-radius:20px;">Unpaid: Rs. ${fmtN(todayUnpaid, 0)}</span>
                </div>
            </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:20px;">

            <!-- Recent Bills -->
            <div class="bill-card">
                <div class="bill-card-header">
                    <h3><span class="material-symbols-rounded" style="color:var(--primary)">receipt_long</span> Recent Bills</h3>
                    <button class="btn btn-sm btn-secondary" onclick="document.querySelector('[data-page=bills]').click()">
                        View All <span class="material-symbols-rounded" style="font-size:14px;">arrow_forward</span>
                    </button>
                </div>
                <div class="table-container" style="border:none;border-radius:0;">
                    <table>
                        <thead>
                            <tr>
                                <th>Bill No</th>
                                <th>Customer</th>
                                <th>Date</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Method</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${bills.length > 0 ? recentBillsRows : `
                                <tr><td colspan="7">
                                    <div class="empty-state" style="padding:24px">
                                        <div class="empty-state-icon">📋</div>
                                        <h4>No bills yet</h4>
                                        <button class="btn btn-primary btn-sm" onclick="document.querySelector('[data-page=new-bill]').click()">
                                            <span class="material-symbols-rounded" style="font-size:14px;">add</span> Create Bill
                                        </button>
                                    </div>
                                </td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Recent Estimates -->
            <div class="bill-card">
                <div class="bill-card-header">
                    <h3><span class="material-symbols-rounded" style="color:#7C3AED">request_quote</span> Recent Estimates</h3>
                    <button class="btn btn-sm btn-secondary" onclick="document.querySelector('[data-page=estimates]').click()">
                        View All <span class="material-symbols-rounded" style="font-size:14px;">arrow_forward</span>
                    </button>
                </div>
                <div class="table-container" style="border:none;border-radius:0;">
                    <table>
                        <thead>
                            <tr>
                                <th>Est No</th>
                                <th>Customer</th>
                                <th>Date</th>
                                <th>Amount</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${estimates.length > 0 ? recentEstRows : `
                                <tr><td colspan="5">
                                    <div class="empty-state" style="padding:24px">
                                        <div class="empty-state-icon">📝</div>
                                        <h4>No estimates yet</h4>
                                        <button class="btn btn-primary btn-sm" onclick="document.querySelector('[data-page=new-estimate]').click()">
                                            <span class="material-symbols-rounded" style="font-size:14px;">add</span> New Estimate
                                        </button>
                                    </div>
                                </td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    `;

    document.getElementById('pageContent').innerHTML = html;

    // Show unpaid bills notification on dashboard load
    showUnpaidNotification();
}

function showUnpaidNotification() {
    const unpaidCash   = bills.filter(b => !b.paid && (b.billType||'cash') === 'cash');
    const unpaidCredit = bills.filter(b => !b.paid && b.billType === 'credit');
    if (unpaidCash.length === 0 && unpaidCredit.length === 0) return;

    document.getElementById('unpaidNotif')?.remove();

    const grandTotal = [...unpaidCash, ...unpaidCredit].reduce((s,b) => s+b.total, 0);

    const buildRows = (list) => list.map(b => `
        <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border);">
                <span class="badge badge-blue">${b.billNo}</span>
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border);color:var(--text-secondary);font-size:13px;">
                ${b.customerName}
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text-muted);">
                ${new Date(b.date).toLocaleDateString()}
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border);text-align:right;">
                <strong style="color:#DC2626;">Rs. ${fmtN(b.total,0)}</strong>
            </td>
        </tr>`).join('');

    const cashRows   = buildRows(unpaidCash);
    const creditRows = buildRows(unpaidCredit);

    const notif = document.createElement('div');
    notif.id = 'unpaidNotif';
    notif.style.cssText = `
        position:fixed;top:0;left:0;right:0;bottom:0;
        background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);
        z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;`;

    notif.innerHTML = `
        <div style="background:var(--surface);border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,0.2);
            width:100%;max-width:640px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;
            animation:slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1);">

            <!-- Header -->
            <div style="padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:40px;height:40px;border-radius:10px;background:#FEE2E2;display:flex;align-items:center;justify-content:center;">
                        <span class="material-symbols-rounded" style="color:#DC2626;font-size:22px;">warning</span>
                    </div>
                    <div>
                        <div style="font-size:16px;font-weight:700;color:var(--text-primary);">Unpaid Bills</div>
                        <div style="font-size:12px;color:var(--text-muted);">${unpaidCash.length + unpaidCredit.length} bills · Total Outstanding: <strong style="color:#DC2626;">Rs. ${fmtN(grandTotal,0)}</strong></div>
                    </div>
                </div>
                <button onclick="document.getElementById('unpaidNotif').remove()"
                    style="background:var(--surface-3);border:1px solid var(--border);border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);">✕</button>
            </div>

            <!-- Body -->
            <div style="overflow-y:auto;flex:1;padding:16px 24px;">

                ${unpaidCash.length ? `
                <div style="margin-bottom:20px;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                        <span class="badge" style="background:#DCFCE7;color:#16A34A;font-size:12px;padding:4px 10px;">💵 Cash Bills</span>
                        <span style="font-size:12px;color:var(--text-muted);">${unpaidCash.length} unpaid · Rs. ${fmtN(unpaidCash.reduce((s,b)=>s+b.total,0),0)}</span>
                    </div>
                    <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;">
                        <table style="width:100%;border-collapse:collapse;">
                            <thead><tr style="background:var(--surface-3);">
                                <th style="padding:8px 12px;font-size:11px;font-weight:700;color:var(--text-muted);text-align:left;text-transform:uppercase;">Bill No</th>
                                <th style="padding:8px 12px;font-size:11px;font-weight:700;color:var(--text-muted);text-align:left;text-transform:uppercase;">Customer</th>
                                <th style="padding:8px 12px;font-size:11px;font-weight:700;color:var(--text-muted);text-align:left;text-transform:uppercase;">Date</th>
                                <th style="padding:8px 12px;font-size:11px;font-weight:700;color:var(--text-muted);text-align:right;text-transform:uppercase;">Amount</th>
                            </tr></thead>
                            <tbody>${cashRows}</tbody>
                        </table>
                    </div>
                </div>` : ''}

                ${unpaidCredit.length ? `
                <div style="margin-bottom:20px;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                        <span class="badge" style="background:#EDE9FE;color:#7C3AED;font-size:12px;padding:4px 10px;">💳 Credit Bills</span>
                        <span style="font-size:12px;color:var(--text-muted);">${unpaidCredit.length} unpaid · Rs. ${fmtN(unpaidCredit.reduce((s,b)=>s+b.total,0),0)}</span>
                    </div>
                    <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;">
                        <table style="width:100%;border-collapse:collapse;">
                            <thead><tr style="background:var(--surface-3);">
                                <th style="padding:8px 12px;font-size:11px;font-weight:700;color:var(--text-muted);text-align:left;text-transform:uppercase;">Bill No</th>
                                <th style="padding:8px 12px;font-size:11px;font-weight:700;color:var(--text-muted);text-align:left;text-transform:uppercase;">Customer</th>
                                <th style="padding:8px 12px;font-size:11px;font-weight:700;color:var(--text-muted);text-align:left;text-transform:uppercase;">Date</th>
                                <th style="padding:8px 12px;font-size:11px;font-weight:700;color:var(--text-muted);text-align:right;text-transform:uppercase;">Amount</th>
                            </tr></thead>
                            <tbody>${creditRows}</tbody>
                        </table>
                    </div>
                </div>` : ''}

            </div>

            <!-- Footer -->
            <div style="padding:16px 24px;border-top:1px solid var(--border);display:flex;gap:10px;flex-shrink:0;">
                <button onclick="document.querySelector('[data-page=bills]').click();document.getElementById('unpaidNotif').remove();"
                    class="btn btn-danger" style="flex:1;">
                    <span class="material-symbols-rounded" style="font-size:15px;">visibility</span> View in Bill History
                </button>
                <button onclick="document.getElementById('unpaidNotif').remove()"
                    class="btn btn-secondary">
                    Dismiss
                </button>
            </div>
        </div>`;

    document.body.appendChild(notif);

    // Close on backdrop click
    notif.addEventListener('click', e => { if (e.target === notif) notif.remove(); });

    // Close on any key press
    const keyHandler = () => {
        notif.remove();
        document.removeEventListener('keydown', keyHandler);
    };
    document.addEventListener('keydown', keyHandler);
}
function renderCustomerPage() {
    const html = `
        <div class="page-header">
            <div class="page-header-left">
                <div class="page-title">Customers</div>
                <div class="page-subtitle">${customers.length} registered customer${customers.length !== 1 ? 's' : ''}</div>
            </div>
            <div class="page-header-actions">
                <button class="btn btn-secondary" onclick="exportCustomersToPDF()">
                    <span class="material-symbols-rounded">picture_as_pdf</span> Export PDF
                </button>
                <button class="btn btn-primary" onclick="openCustomerModal()">
                    <span class="material-symbols-rounded">person_add</span> Add Customer
                </button>
            </div>
        </div>

        <!-- Search & Filter -->
        <div class="search-section">
            <div class="filter-row">
                <select id="filterType" onchange="renderCustomersTable()" style="padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13.5px;color:var(--text-primary);background:var(--surface);outline:none;cursor:pointer;">
                    <option value="name">Filter by Name</option>
                    <option value="vehicleNo">Filter by Vehicle No</option>
                    <option value="model">Filter by Model</option>
                    <option value="brand">Filter by Brand</option>
                    <option value="phone">Filter by Phone</option>
                </select>
                <div class="search-input-wrapper">
                    <span class="search-icon material-symbols-rounded">search</span>
                    <input type="text" id="filterValue" placeholder="Search customers..." onkeyup="renderCustomersTable()">
                </div>
                <button class="btn btn-secondary" onclick="clearFilters()">
                    <span class="material-symbols-rounded">filter_list_off</span> Clear
                </button>
            </div>
            <div class="button-group">
                <span id="filterCount" class="filter-count"></span>
            </div>
        </div>

        <!-- Table -->
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Customer</th>
                        <th>Contact</th>
                        <th>Vehicle No</th>
                        <th>Model / Brand</th>
                        <th>Note</th>
                        <th>Bills</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="customersTableBody"></tbody>
            </table>
        </div>
    `;

    document.getElementById('pageContent').innerHTML = html;
    renderCustomersTable();
}

// ── New Bill Page ──
function renderNewBillPage() {
    _editingBillIndex = null;
    window._convertingEstimateIndex = null;

    // Derive next numbers from max existing — never goes down after delete
    const maxCash   = bills.filter(b => (b.billType||'cash')==='cash').map(b => parseInt(b.billNo.replace('CH-',''))||0).reduce((m,n)=>Math.max(m,n),0);
    const maxCredit = bills.filter(b => b.billType==='credit').map(b => parseInt(b.billNo.replace('CR-',''))||0).reduce((m,n)=>Math.max(m,n),0);
    const cashNo   = 'CH-' + String(maxCash + 1).padStart(3, '0');
    const creditNo = 'CR-' + String(maxCredit + 1).padStart(3, '0');    const todayStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '/');

    const html = `
        <div class="invoice-builder">

            <!-- Customer Selection -->
            <div class="form-section">
                <div class="form-section-header">
                    <h4>
                        <div class="section-icon green"><span class="material-symbols-rounded" style="color:#16A34A;font-size:15px;">person</span></div>
                        Customer Details
                    </h4>
                </div>

                <div style="position:relative;">
                    <div style="position:relative;margin-bottom:8px;">
                        <span class="search-icon material-symbols-rounded" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:15px;cursor:pointer;" onclick="document.getElementById('billCustSearch').focus();filterBillCustomers();">search</span>
                        <input type="text" id="billCustSearch" placeholder="Search by name, vehicle no, or phone..."
                            oninput="filterBillCustomers()" onfocus="filterBillCustomers()"
                            autocomplete="off"
                            style="width:100%;padding:10px 36px 10px 38px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-family:inherit;color:var(--text-primary);background:var(--surface-3);outline:none;transition:all 0.2s;">
                        <button type="button" id="billCustClear" onclick="clearBillCustSearch()"
                            style="display:none;position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;line-height:1;padding:2px 4px;border-radius:4px;"
                            title="Clear">✕</button>
                    </div>
                    <div id="billCustDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1.5px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:200;max-height:220px;overflow-y:auto;"></div>
                </div>

                <!-- Hidden selects kept for compatibility with existing save/load logic -->
                <select id="billCustomer" style="display:none;" onchange="loadBillCustomerDetails()">
                    <option value="">— Select Customer —</option>
                </select>
                <select id="billRegNo" style="display:none;">
                    <option value="">— Select Registration —</option>
                </select>

                <div id="billCustomerDetails"></div>
            </div>

            <!-- Bill Meta -->
            <div class="form-section">
                <div class="form-section-header">
                    <h4>
                        <div class="section-icon blue"><span class="material-symbols-rounded" style="color:#2563EB;font-size:15px;">receipt</span></div>
                        Bill Details
                    </h4>
                </div>

                <!-- Bill Type -->
                <div style="display:flex;gap:12px;margin-bottom:18px;">
                    <label onclick="updateBillType()" style="flex:1;cursor:pointer;border:2px solid var(--border);border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:10px;transition:all 0.2s;" id="typeCashLabel">
                        <input type="radio" name="billType" value="cash" checked onchange="updateBillType()" style="accent-color:#16A34A;width:16px;height:16px;">
                        <div>
                            <div style="font-weight:700;font-size:14px;color:#16A34A;">💵 Cash</div>
                            <div style="font-size:11px;color:var(--text-muted);">Prefix: CH-001</div>
                        </div>
                    </label>
                    <label onclick="updateBillType()" style="flex:1;cursor:pointer;border:2px solid var(--border);border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:10px;transition:all 0.2s;" id="typeCreditLabel">
                        <input type="radio" name="billType" value="credit" onchange="updateBillType()" style="accent-color:#7C3AED;width:16px;height:16px;">
                        <div>
                            <div style="font-weight:700;font-size:14px;color:#7C3AED;">💳 Credit</div>
                            <div style="font-size:11px;color:var(--text-muted);">Prefix: CR-001</div>
                        </div>
                    </label>
                </div>

                <div class="invoice-meta-grid">
                    <!-- Bill No -->
                    <div class="meta-box">
                        <label>Bill Number</label>
                        <div class="radio-group" style="margin-bottom:8px;">
                            <label class="radio-option">
                                <input type="radio" name="invType" id="invTypeAuto" value="auto" checked onchange="toggleInvNo()"> Auto
                            </label>
                            <label class="radio-option">
                                <input type="radio" name="invType" id="invTypeManual" value="manual" onchange="toggleInvNo()"> Manual
                            </label>
                        </div>
                        <input type="text" id="invoiceNo" value="${cashNo}" readonly style="border:none;background:transparent;font-weight:700;color:#16A34A;font-size:13px;width:100%;outline:none;padding:0;">
                    </div>

                    <!-- Bill Date -->
                    <div class="meta-box">
                        <label>Bill Date</label>
                        <div class="radio-group" style="margin-bottom:8px;">
                            <label class="radio-option">
                                <input type="radio" name="invDate" value="auto" checked onchange="toggleInvDate()"> Auto
                            </label>
                            <label class="radio-option">
                                <input type="radio" name="invDate" value="manual" onchange="toggleInvDate()"> Manual
                            </label>
                        </div>
                        <input type="text" id="invoiceDate" value="${todayStr}" readonly style="border:none;background:transparent;font-weight:600;font-size:13px;width:100%;outline:none;padding:0;color:var(--text-primary);">
                    </div>

                    <!-- Mileage -->
                    <div class="meta-box">
                        <label>Mileage (KM)</label>
                        <input type="number" id="mileage" placeholder="Enter current mileage..."
                            style="border:none;background:transparent;font-weight:600;font-size:13px;width:100%;outline:none;padding:4px 0 0;color:var(--text-primary);">
                    </div>
                </div>
            </div>

            <!-- Bank Details -->
            <div class="form-section">
                <div class="form-section-header">
                    <h4>
                        <div class="section-icon purple"><span class="material-symbols-rounded" style="color:#7C3AED;font-size:15px;">account_balance</span></div>
                        Bank Details on Bill
                    </h4>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label>Show bank account on Bill (optional)</label>
                    <select id="bankDetails">
                        <option value="">None — No bank details</option>
                    </select>
                </div>
            </div>

            <!-- Labor Section -->
            <div class="form-section">
                <div class="form-section-header">
                    <h4>
                        <div class="section-icon orange"><span class="material-symbols-rounded" style="color:#D97706;font-size:15px;">build</span></div>
                        🔧 Labor / Repair
                    </h4>
                    <button class="btn btn-sm btn-warning" onclick="addRepairRow()" style="background:linear-gradient(135deg,#F59E0B,#D97706);">
                        <span class="material-symbols-rounded" style="font-size:14px;">add</span> Add Labor
                    </button>
                </div>
                <div id="repairRows">
                    <div class="item-row">
                        <textarea placeholder="Description of labor work..." class="repair-desc" rows="2"></textarea>
                        <input type="text" inputmode="decimal" placeholder="Amount (Rs.)" class="repair-amt" oninput="fmtAmtInput(this);recalcTotal()">
                        <button onclick="removeRow(this)" class="remove-btn">✕</button>
                    </div>
                </div>
            </div>

            <!-- Parts Section -->
            <div class="form-section">
                <div class="form-section-header">
                    <h4>
                        <div class="section-icon green"><span class="material-symbols-rounded" style="color:#16A34A;font-size:15px;">settings</span></div>
                        ⚙️ Spare Parts
                    </h4>
                    <button class="btn btn-sm btn-success" onclick="addPartRow()">
                        <span class="material-symbols-rounded" style="font-size:14px;">add</span> Add Part
                    </button>
                </div>
                <div id="partRows">
                    <div class="part-row-header">
                        <span>Description</span>
                        <span>Qty</span>
                        <span>Unit Price</span>
                        <span></span>
                    </div>
                    <div class="item-row-part">
                        <textarea placeholder="Part name or description..." class="part-desc" rows="2"></textarea>
                        <input type="number" placeholder="1" class="part-qty" min="1" value="1" oninput="calcPartAmt(this);recalcTotal()" onfocus="if(this.value==='1')this.value=''" onblur="if(!this.value||this.value==='0')this.value='1'">
                        <input type="text" inputmode="decimal" placeholder="Unit Price (Rs.)" class="part-amt" oninput="fmtAmtInput(this);calcPartTotal(this);recalcTotal()">
                        <button onclick="removeRow(this)" class="remove-btn">✕</button>
                    </div>
                </div>
            </div>

            <!-- Grand Total -->
            <div class="grand-total-box" style="margin-bottom:12px;flex-direction:column;align-items:stretch;gap:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="grand-total-label">Grand Total</span>
                    <span id="grandTotal" class="grand-total-amount">Rs. 0.00</span>
                </div>
                <div id="advanceRow" style="display:none;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px dashed rgba(37,99,235,0.3);">
                    <span style="font-size:14px;font-weight:600;color:#D97706;">− Advance</span>
                    <span id="advanceDisplay" style="font-size:16px;font-weight:700;color:#D97706;">Rs. 0.00</span>
                </div>
                <div id="balanceRow" style="display:none;justify-content:space-between;align-items:center;padding-top:8px;border-top:2px solid rgba(37,99,235,0.2);">
                    <span style="font-size:15px;font-weight:700;color:#16A34A;">Balance Due</span>
                    <span id="balanceDue" style="font-size:26px;font-weight:800;color:#16A34A;letter-spacing:-0.5px;">Rs. 0.00</span>
                </div>
            </div>

            <!-- Advance & Balance -->
            <div class="form-section" style="margin-bottom:18px;padding:16px 20px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:end;">
                    <div>
                        <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:6px;">Advance (Rs.)</label>
                        <input type="text" inputmode="decimal" id="advanceAmount" placeholder="0.00" value="0"
                            oninput="fmtAmtInput(this);recalcBalance()"
                            onfocus="if(this.value==='0')this.value=''"
                            onblur="if(this.value==='')this.value='0'"
                            style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:14px;font-weight:700;color:#D97706;background:var(--surface-3);outline:none;">
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:6px;">Payment Status</label>
                        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface-3);">
                            <input type="checkbox" id="billPaidCheck" onchange="recalcBalance()"
                                style="width:18px;height:18px;accent-color:#16A34A;cursor:pointer;">
                            <span id="billPaidLabel" style="font-size:13.5px;font-weight:700;color:var(--text-muted);">Mark as Paid</span>
                        </label>
                    </div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div style="display:flex;gap:12px;">
                <button class="btn btn-secondary btn-lg" style="flex:1;" onclick="previewInvoice()">
                    <span class="material-symbols-rounded">visibility</span> Preview Bill
                </button>
                <button class="btn btn-primary btn-lg" style="flex:2;" onclick="saveBill()">
                    <span class="material-symbols-rounded">check_circle</span> Create Bill
                </button>
            </div>
        </div>
    `;

    document.getElementById('pageContent').innerHTML = html;
    loadCustomerSelect();
    loadRegNoSelect();
    loadBankDetailsSelect();
    updateBillType();
    // Attach suggestions to default rows
    document.querySelectorAll('#repairRows .item-row').forEach(r => _attachToNewRow && _attachToNewRow(r, 'labor'));
    document.querySelectorAll('#partRows .item-row-part').forEach(r => _attachToNewRow && _attachToNewRow(r, 'spareParts'));
}

function updateBillType() {
    const type   = document.querySelector('input[name="billType"]:checked')?.value || 'cash';
    const isCash = type === 'cash';
    const maxCash   = bills.filter(b => (b.billType||'cash')==='cash').map(b => parseInt(b.billNo.replace('CH-',''))||0).reduce((m,n)=>Math.max(m,n),0);
    const maxCredit = bills.filter(b => b.billType==='credit').map(b => parseInt(b.billNo.replace('CR-',''))||0).reduce((m,n)=>Math.max(m,n),0);
    const no    = isCash ? 'CH-' + String(maxCash + 1).padStart(3, '0')
                         : 'CR-' + String(maxCredit + 1).padStart(3, '0');
    const color = isCash ? '#16A34A' : '#7C3AED';

    const inp = document.getElementById('invoiceNo');
    if (inp) {
        // Always assign a fresh next number for the selected type
        // (never reuse the old number from the other type)
        if (document.getElementById('invTypeAuto')?.checked) {
            inp.value = no;
        } else {
            // Even in manual/edit mode — generate new number when type changes
            inp.value = no;
            // Switch back to auto so the new number is shown correctly
            const autoRadio = document.getElementById('invTypeAuto');
            if (autoRadio) { autoRadio.checked = true; toggleInvNo(); }
        }
        inp.style.color = color;
    }

    // Highlight selected type card
    const cashLabel   = document.getElementById('typeCashLabel');
    const creditLabel = document.getElementById('typeCreditLabel');
    if (cashLabel)   cashLabel.style.borderColor   = isCash  ? '#16A34A' : 'var(--border)';
    if (creditLabel) creditLabel.style.borderColor = !isCash ? '#7C3AED' : 'var(--border)';
    if (cashLabel)   cashLabel.style.background    = isCash  ? '#F0FDF4' : 'var(--surface)';
    if (creditLabel) creditLabel.style.background  = !isCash ? '#F5F3FF' : 'var(--surface)';
}

function filterBillCustomers() {
    const q        = (document.getElementById('billCustSearch')?.value || '').toLowerCase();
    const dropdown = document.getElementById('billCustDropdown');
    const clearBtn = document.getElementById('billCustClear');
    if (!dropdown) return;

    // Show/hide clear button
    if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

    const matches = customers.filter(c =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.vehicleNo    || '').toLowerCase().includes(q) ||
        (c.contacts     || '').toLowerCase().includes(q) ||
        (c.vehicleModel || '').toLowerCase().includes(q) ||
        (c.brand        || '').toLowerCase().includes(q)
    );

    if (matches.length === 0) {
        dropdown.innerHTML = `<div style="padding:12px 16px;color:var(--text-muted);font-size:13px;">No customers found</div>`;
    } else {
        dropdown.innerHTML = matches.map(c => `
            <div onclick="selectBillCustomer(${c.id})"
                style="padding:10px 16px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;transition:background 0.15s;"
                onmouseover="this.style.background='var(--surface-3)'" onmouseout="this.style.background=''">
                <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#2563EB,#7C3AED);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0;">
                    ${c.name.charAt(0).toUpperCase()}
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;font-size:13.5px;color:var(--text-primary);">${c.name}</div>
                    <div style="font-size:11.5px;color:var(--text-muted);">${c.vehicleNo || ''}${c.vehicleModel ? ' · ' + c.vehicleModel : ''}${c.brand ? ' · ' + c.brand : ''}${c.contacts ? ' · ' + c.contacts : ''}${c.address ? ' · 📝 ' + c.address : ''}</div>
                </div>
                <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${c.isCompany ? '#EDE9FE' : '#DCFCE7'};" title="${c.isCompany ? 'Company' : 'Individual'}">
                    ${c.isCompany ? '🏢' : '👤'}
                </div>
            </div>`).join('');
    }
    dropdown.style.display = 'block';
}

function selectBillCustomer(id) {
    const c = customers.find(x => x.id == id);
    if (!c) return;
    const searchInput = document.getElementById('billCustSearch');
    if (searchInput) searchInput.value = c.name + (c.vehicleNo ? '  —  ' + c.vehicleNo : '');
    const clearBtn = document.getElementById('billCustClear');
    if (clearBtn) clearBtn.style.display = 'block';
    document.getElementById('billCustDropdown').style.display = 'none';
    const sel = document.getElementById('billCustomer');
    if (sel) { sel.value = id; loadBillCustomerDetails(); }
}

function clearBillCustSearch() {
    const input = document.getElementById('billCustSearch');
    if (input) { input.value = ''; input.focus(); }
    const clearBtn = document.getElementById('billCustClear');
    if (clearBtn) clearBtn.style.display = 'none';
    const sel = document.getElementById('billCustomer');
    if (sel) sel.value = '';
    const details = document.getElementById('billCustomerDetails');
    if (details) details.innerHTML = '';
    // Show full list after clearing
    filterBillCustomers();
}

// Close dropdown when clicking outside
document.addEventListener('click', e => {
    if (!e.target.closest('#billCustSearch') && !e.target.closest('#billCustDropdown')) {
        const d = document.getElementById('billCustDropdown');
        if (d) d.style.display = 'none';
    }
});

// ── Shared customer dropdown renderer ──
function _custDropdownHTML(matches, selectFn) {
    if (matches.length === 0) return `<div style="padding:12px 16px;color:var(--text-muted);font-size:13px;">No customers found</div>`;
    return matches.map(c => `
        <div onclick="${selectFn}(${c.id})"
            style="padding:10px 16px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;transition:background 0.15s;"
            onmouseover="this.style.background='var(--surface-3)'" onmouseout="this.style.background=''">
            <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#2563EB,#7C3AED);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0;">
                ${c.name.charAt(0).toUpperCase()}
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:13.5px;color:var(--text-primary);">${c.name}</div>
                <div style="font-size:11.5px;color:var(--text-muted);">${c.vehicleNo || ''}${c.vehicleModel ? ' · ' + c.vehicleModel : ''}${c.brand ? ' · ' + c.brand : ''}${c.contacts ? ' · ' + c.contacts : ''}${c.address ? ' · 📝 ' + c.address : ''}</div>
            </div>
            <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${c.isCompany ? '#EDE9FE' : '#DCFCE7'};">
                ${c.isCompany ? '🏢' : '👤'}
            </div>
        </div>`).join('');
}

function _custFilter(q) {
    return customers.filter(c =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.vehicleNo    || '').toLowerCase().includes(q) ||
        (c.contacts     || '').toLowerCase().includes(q) ||
        (c.vehicleModel || '').toLowerCase().includes(q) ||
        (c.brand        || '').toLowerCase().includes(q)
    );
}

// ── Estimate customer search ──
function filterEstCustomers() {
    const q   = (document.getElementById('estCustSearch')?.value || '').toLowerCase();
    const dd  = document.getElementById('estCustDropdown');
    const clr = document.getElementById('estCustClear');
    if (!dd) return;
    if (clr) clr.style.display = q ? 'block' : 'none';
    dd.innerHTML = _custDropdownHTML(_custFilter(q), 'selectEstCustomer');
    dd.style.display = 'block';
}

function selectEstCustomer(id) {
    const c = customers.find(x => x.id == id);
    if (!c) return;
    const si = document.getElementById('estCustSearch');
    if (si) si.value = c.name + (c.vehicleNo ? '  —  ' + c.vehicleNo : '');
    const clr = document.getElementById('estCustClear');
    if (clr) clr.style.display = 'block';
    document.getElementById('estCustDropdown').style.display = 'none';
    const sel = document.getElementById('estCustomer');
    if (sel) { sel.value = id; loadEstCustomerDetails(); }
}

function clearEstCustSearch() {
    const input = document.getElementById('estCustSearch');
    if (input) { input.value = ''; input.focus(); }
    const clr = document.getElementById('estCustClear');
    if (clr) clr.style.display = 'none';
    const sel = document.getElementById('estCustomer');
    if (sel) sel.value = '';
    const det = document.getElementById('estCustomerDetails');
    if (det) det.innerHTML = '';
    filterEstCustomers();
}

document.addEventListener('click', e => {
    if (!e.target.closest('#estCustSearch') && !e.target.closest('#estCustDropdown')) {
        const d = document.getElementById('estCustDropdown');
        if (d) d.style.display = 'none';
    }
    if (!e.target.closest('#payCustSearch') && !e.target.closest('#payCustDropdown')) {
        const d = document.getElementById('payCustDropdown');
        if (d) d.style.display = 'none';
    }
});

// ── Payment slip customer search ──
function filterPayCustomers() {
    const q   = (document.getElementById('payCustSearch')?.value || '').toLowerCase();
    const dd  = document.getElementById('payCustDropdown');
    const clr = document.getElementById('payCustClear');
    if (!dd) return;
    if (clr) clr.style.display = q ? 'block' : 'none';
    dd.innerHTML = _custDropdownHTML(_custFilter(q), 'selectPayCustomer');
    dd.style.display = 'block';
}

function selectPayCustomer(id) {
    const c = customers.find(x => x.id == id);
    if (!c) return;
    const si = document.getElementById('payCustSearch');
    if (si) si.value = c.name + (c.vehicleNo ? '  —  ' + c.vehicleNo : '');
    const clr = document.getElementById('payCustClear');
    if (clr) clr.style.display = 'block';
    document.getElementById('payCustDropdown').style.display = 'none';
    const sel = document.getElementById('payCustomer');
    if (sel) { sel.value = id; loadPayCustomerDetails(); }
}

function clearPayCustSearch() {
    const input = document.getElementById('payCustSearch');
    if (input) { input.value = ''; input.focus(); }
    const clr = document.getElementById('payCustClear');
    if (clr) clr.style.display = 'none';
    const sel = document.getElementById('payCustomer');
    if (sel) sel.value = '';
    const det = document.getElementById('payCustomerDetails');
    if (det) det.innerHTML = '';
    // Reset bill dropdown
    const refSelect = document.getElementById('slipRefBill');
    if (refSelect) refSelect.innerHTML = '<option value="">— Select Bill (optional) —</option>';
    filterPayCustomers();
}

function loadBankDetailsSelect() {
    const select = document.getElementById('bankDetails');
    if (!select) return;
    select.innerHTML = '<option value="">None — No bank details</option>';
    bankAccounts.forEach((bank, i) => {
        select.innerHTML += `<option value="${i}">${bank.bankName} | ${bank.accountNo}${bank.branch ? ' | ' + bank.branch : ''}</option>`;
    });
}

// ── Bills Page ──
function renderBillsPage() {
    const html = `
        <div class="page-header">
            <div class="page-header-left">
                <div class="page-title">Bill History</div>
                <div class="page-subtitle">${bills.length} bill${bills.length !== 1 ? 's' : ''} in total</div>
            </div>
            <div class="page-header-actions">
                <button class="btn btn-success" onclick="exportBillsToExcel()">
                    <span class="material-symbols-rounded">table_chart</span> Export Excel
                </button>
                <button class="btn btn-primary" onclick="exportFilteredBillsToPDF()">
                    <span class="material-symbols-rounded">picture_as_pdf</span> Export PDF
                </button>
            </div>
        </div>

        <div class="search-section">
            <div style="display:grid;grid-template-columns:1fr 130px 130px 120px 120px auto;gap:12px;align-items:end;">
                <div class="search-input-wrapper">
                    <span class="search-icon material-symbols-rounded">search</span>
                    <input type="text" id="billSearch" placeholder="Search by Bill No, Customer or Vehicle No..." onkeyup="loadBillsTable()">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:5px;">From</label>
                    <input type="date" id="billDateFrom" onchange="loadBillsTable()" style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;color:var(--text-primary);background:var(--surface);outline:none;">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:5px;">To</label>
                    <input type="date" id="billDateTo" onchange="loadBillsTable()" style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;color:var(--text-primary);background:var(--surface);outline:none;">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:5px;">Type</label>
                    <select id="billTypeFilter" onchange="loadBillsTable()" style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;color:var(--text-primary);background:var(--surface);outline:none;cursor:pointer;">
                        <option value="">All</option>
                        <option value="cash">💵 Cash</option>
                        <option value="credit">💳 Credit</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:5px;">Status</label>
                    <select id="billPaidFilter" onchange="loadBillsTable()" style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;color:var(--text-primary);background:var(--surface);outline:none;cursor:pointer;">
                        <option value="">All</option>
                        <option value="paid">Paid</option>
                        <option value="unpaid">Unpaid</option>
                    </select>
                </div>
                <button class="btn btn-secondary" onclick="document.getElementById('billSearch').value='';document.getElementById('billDateFrom').value='';document.getElementById('billDateTo').value='';document.getElementById('billTypeFilter').value='';document.getElementById('billPaidFilter').value='';loadBillsTable();" style="align-self:end;">
                    <span class="material-symbols-rounded">filter_list_off</span> Clear
                </button>
            </div>
        </div>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width:36px;"></th>
                        <th>Bill No</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Vehicle</th>
                        <th>Type</th>
                        <th>Total</th>
                        <th>Advance</th>
                        <th>Balance</th>
                        <th>Paid</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="billsTableBody"></tbody>
            </table>
        </div>
    `;

    document.getElementById('pageContent').innerHTML = html;
    loadBillsTable();
}

// ── Settings Page ──
function renderSettingsPage(tab) {
    tab = tab || 'info';
    const dbSize = Math.round(JSON.stringify({ customers, bills, estimates, paymentSlips }).length / 1024);

    const tabs = [
        { id: 'info',   icon: 'info',            label: 'System Info' },
        { id: 'data',   icon: 'backup',           label: 'Data' },
        { id: 'bank',   icon: 'account_balance',  label: 'Bank Accounts' },
        { id: 'cloud',  icon: 'cloud',            label: 'Cloud' },
    ];

    const tabBar = tabs.map(t => `
        <button onclick="renderSettingsPage('${t.id}')"
            style="display:flex;align-items:center;gap:7px;padding:10px 20px;border:none;border-bottom:3px solid ${tab === t.id ? 'var(--primary)' : 'transparent'};background:none;font-family:inherit;font-size:13.5px;font-weight:${tab === t.id ? '700' : '500'};color:${tab === t.id ? 'var(--primary)' : 'var(--text-muted)'};cursor:pointer;transition:all 0.2s;white-space:nowrap;">
            <span class="material-symbols-rounded" style="font-size:16px;">${t.icon}</span>${t.label}
        </button>`).join('');

    const infoTab = `
        <div class="settings-card" style="max-width:480px;">
            <h3><span class="material-symbols-rounded" style="color:var(--primary)">info</span> System Information</h3>
            <div class="settings-stat-row"><span class="stat-label">Total Customers</span><span class="stat-value badge badge-blue">${customers.length}</span></div>
            <div class="settings-stat-row"><span class="stat-label">Total Bills</span><span class="stat-value badge badge-green">${bills.length}</span></div>
            <div class="settings-stat-row"><span class="stat-label">Total Estimates</span><span class="stat-value badge badge-gray">${estimates.length}</span></div>
            <div class="settings-stat-row"><span class="stat-label">Payment Slips</span><span class="stat-value badge badge-gray">${paymentSlips.length}</span></div>
            <div class="settings-stat-row"><span class="stat-label">Bank Accounts</span><span class="stat-value badge badge-gray">${bankAccounts.length}</span></div>
            <div class="settings-stat-row"><span class="stat-label">Database Size</span><span class="stat-value">${dbSize} KB</span></div>
            <div class="settings-stat-row"><span class="stat-label">Version</span><span class="stat-value">Siriman Motor Works v2.0</span></div>
        </div>`;

    const dataTab = `
        <div class="settings-card" style="max-width:480px;">
            <h3><span class="material-symbols-rounded" style="color:var(--accent)">backup</span> Data Management</h3>
            <div style="display:flex;flex-direction:column;gap:10px;">
                <button class="btn btn-primary w-full" onclick="backupData()">
                    <span class="material-symbols-rounded">download</span> Backup to File
                </button>
                <button class="btn btn-secondary w-full" onclick="restoreData()">
                    <span class="material-symbols-rounded">upload</span> Restore from File
                </button>
                <button class="btn btn-secondary w-full" onclick="clearSuggestions('labor');clearSuggestions('spareParts');showToast('🗑 Suggestions cleared');">
                    <span class="material-symbols-rounded">auto_delete</span> Clear All Suggestions
                </button>
            </div>
            <div class="danger-zone" style="margin-top:16px;">
                <h4><span class="material-symbols-rounded" style="font-size:16px;">warning</span> Danger Zone</h4>
                <p>This will permanently delete all customers, bills, and settings. This action cannot be undone.</p>
                <button class="btn btn-danger btn-sm" onclick="clearAllData()">
                    <span class="material-symbols-rounded" style="font-size:14px;">delete_forever</span> Clear All Data
                </button>
            </div>
        </div>`;

    const bankTab = `
        <div class="bill-card">
            <div class="bill-card-header">
                <h3><span class="material-symbols-rounded" style="color:#7C3AED">account_balance</span> Bank Accounts</h3>
                <button class="btn btn-primary btn-sm" onclick="openBankModal()">
                    <span class="material-symbols-rounded" style="font-size:14px;">add</span> Add Account
                </button>
            </div>
            <div class="table-container" style="border:none;border-radius:0;">
                <table id="bankAccountsTable">
                    <thead>
                        <tr>
                            <th>Bank Name</th>
                            <th>Account Name</th>
                            <th>Account Number</th>
                            <th>Branch</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="bankAccountsBody"></tbody>
                </table>
            </div>
        </div>`;

    const savedGDrive = localStorage.getItem('cloud_gdrive') || '';
    const savedMega   = localStorage.getItem('cloud_mega')   || '';

    const cloudTab = `
        <div class="settings-card" style="max-width:560px;">
            <h3><span class="material-symbols-rounded" style="color:#2563EB">cloud</span> Cloud Storage Paths</h3>
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px;">Save your Google Drive and Mega Drive folder links here for quick access.</p>

            <div class="form-group">
                <label style="display:flex;align-items:center;gap:8px;">
                    <img src="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png" style="width:18px;height:18px;object-fit:contain;" onerror="this.style.display='none'">
                    Google Drive Path / Link
                </label>
                <div style="display:flex;gap:8px;">
                    <input type="text" id="gdriveInput" value="${savedGDrive}" placeholder="https://drive.google.com/drive/folders/..."
                        style="flex:1;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13.5px;color:var(--text-primary);background:var(--surface-3);outline:none;">
                    <button class="btn btn-secondary" onclick="if(document.getElementById('gdriveInput').value) window.open(document.getElementById('gdriveInput').value,'_blank')" title="Open">
                        <span class="material-symbols-rounded" style="font-size:16px;">open_in_new</span>
                    </button>
                </div>
            </div>

            <div class="form-group" style="margin-top:16px;">
                <label style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:16px;">🗂️</span>
                    Mega Drive Path / Link
                </label>
                <div style="display:flex;gap:8px;">
                    <input type="text" id="megaInput" value="${savedMega}" placeholder="https://mega.nz/folder/..."
                        style="flex:1;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13.5px;color:var(--text-primary);background:var(--surface-3);outline:none;">
                    <button class="btn btn-secondary" onclick="if(document.getElementById('megaInput').value) window.open(document.getElementById('megaInput').value,'_blank')" title="Open">
                        <span class="material-symbols-rounded" style="font-size:16px;">open_in_new</span>
                    </button>
                </div>
            </div>

            <div style="margin-top:20px;display:flex;gap:10px;">
                <button class="btn btn-primary" onclick="saveCloudPaths()">
                    <span class="material-symbols-rounded">save</span> Save Paths
                </button>
                <button class="btn btn-secondary" onclick="clearCloudPaths()">
                    <span class="material-symbols-rounded">delete</span> Clear
                </button>
            </div>
        </div>

        <div class="settings-card" style="max-width:560px;margin-top:20px;">
            <h3><span class="material-symbols-rounded" style="color:#7C3AED">sync</span> Sync Server</h3>
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
                The sync server runs locally on your PC and backs up data to Mega automatically.
                You must start it before opening the app.
            </p>

            <div id="syncServerStatusBox" style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:10px;background:var(--surface-3);border:1.5px solid var(--border);margin-bottom:16px;">
                <span id="syncStatusDot" style="width:10px;height:10px;border-radius:50%;background:#94A3B8;flex-shrink:0;"></span>
                <span id="syncStatusText" style="font-size:13px;color:var(--text-secondary);">Checking...</span>
                <button onclick="refreshSyncStatus()" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px;" title="Refresh">
                    <span class="material-symbols-rounded" style="font-size:16px;">refresh</span>
                </button>
            </div>

            <div style="background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:10px;padding:14px 16px;font-size:12.5px;color:#166534;line-height:2;">
                <strong>How to start the sync server:</strong><br>
                1. Open a terminal / command prompt<br>
                2. Run: <code style="background:#DCFCE7;padding:1px 6px;border-radius:4px;font-family:monospace;">cd sync-server &amp;&amp; npm start</code><br>
                3. Keep that window open while using the app
            </div>

            <button class="btn btn-primary" style="margin-top:14px;" onclick="recheckAndSync()">
                <span class="material-symbols-rounded">sync</span> Recheck &amp; Sync Now
            </button>
        </div>`;


    const content = tab === 'info' ? infoTab : tab === 'data' ? dataTab : tab === 'bank' ? bankTab : cloudTab;

    const html = `
        <div class="page-header">
            <div class="page-header-left">
                <div class="page-title">Settings</div>
                <div class="page-subtitle">Manage system data and configuration</div>
            </div>
        </div>

        <!-- Tab Bar -->
        <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:24px;background:var(--surface);border-radius:var(--radius) var(--radius) 0 0;overflow-x:auto;">
            ${tabBar}
        </div>

        ${content}
    `;

    document.getElementById('pageContent').innerHTML = html;
    if (tab === 'bank') renderBankAccountsTable();
    if (tab === 'cloud') refreshSyncStatus();
}

function saveCloudPaths() {
    const gdrive = document.getElementById('gdriveInput')?.value.trim() || '';
    const mega   = document.getElementById('megaInput')?.value.trim()   || '';
    localStorage.setItem('cloud_gdrive', gdrive);
    localStorage.setItem('cloud_mega',   mega);
    showToast('✅ Cloud paths saved');
}

function clearCloudPaths() {
    localStorage.removeItem('cloud_gdrive');
    localStorage.removeItem('cloud_mega');
    renderSettingsPage('cloud');
    showToast('🗑 Cloud paths cleared');
}

async function refreshSyncStatus() {
    const dot  = document.getElementById('syncStatusDot');
    const text = document.getElementById('syncStatusText');
    if (!dot || !text) return;
    text.textContent = 'Checking...';
    dot.style.background = '#94A3B8';
    const status = await checkSyncServer();
    if (status) {
        dot.style.background  = '#22C55E';
        text.textContent = `Online — v${status.version} · last sync: ${status.lastSync ? new Date(status.lastSync).toLocaleTimeString() : 'never'} · Mega: ${status.cloudConfigured?.mega ? '✓' : '✗'}`;
    } else {
        dot.style.background  = '#EF4444';
        text.textContent = 'Offline — server not running';
    }
}

async function recheckAndSync() {
    await refreshSyncStatus();
    if (syncOnline) {
        await syncNow();
    } else {
        showToast('❌ Sync server is not running. Start it first.', 'error');
    }
}

function renderBankAccountsTable() {
    const tbody = document.getElementById('bankAccountsBody');
    if (!tbody) return;
    if (bankAccounts.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="5">
                <div class="empty-state" style="padding:32px;">
                    <div class="empty-state-icon">🏦</div>
                    <h4>No bank accounts added</h4>
                    <p>Add bank accounts to display them on bills.</p>
                </div>
            </td></tr>
        `;
        return;
    }
    tbody.innerHTML = '';
    bankAccounts.forEach((bank, i) => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${bank.bankName}</strong></td>
                <td>${bank.accountName || '—'}</td>
                <td><span class="badge badge-gray">${bank.accountNo}</span></td>
                <td class="td-muted">${bank.branch || '—'}</td>
                <td>
                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-sm btn-secondary" onclick="editBankAccount(${i})">
                            <span class="material-symbols-rounded" style="font-size:14px;">edit</span>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteBankAccount(${i})">
                            <span class="material-symbols-rounded" style="font-size:14px;">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function openBankModal(editIndex) {
    window.editBankIndex = (editIndex !== undefined) ? editIndex : null;
    const bank = (editIndex !== undefined) ? bankAccounts[editIndex] : {};
    document.getElementById('bankModalTitle').innerText = (editIndex !== undefined) ? 'Edit Bank Account' : 'Add Bank Account';
    document.getElementById('bankName').value        = bank.bankName    || '';
    document.getElementById('bankAccountName').value = bank.accountName || '';
    document.getElementById('bankAccountNo').value   = bank.accountNo   || '';
    document.getElementById('bankBranch').value      = bank.branch      || '';
    document.getElementById('bankModal').style.display = 'flex';
}

function closeBankModal() {
    document.getElementById('bankModal').style.display = 'none';
}

function saveBankAccount(event) {
    event.preventDefault();
    const bankName    = document.getElementById('bankName').value.trim();
    const accountName = document.getElementById('bankAccountName').value.trim();
    const accountNo   = document.getElementById('bankAccountNo').value.trim();
    const branch      = document.getElementById('bankBranch').value.trim();

    if (!bankName || !accountNo) {
        alert('Bank Name and Account Number are required');
        return;
    }

    const entry = { bankName, accountName, accountNo, branch };

    if (window.editBankIndex !== null) {
        bankAccounts[window.editBankIndex] = entry;
        showToast('✅ Bank account updated');
    } else {
        bankAccounts.push(entry);
        showToast('✅ Bank account added');
    }

    saveAllData();
    closeBankModal();
    renderBankAccountsTable();
}

function editBankAccount(i) { openBankModal(i); }

function deleteBankAccount(i) {
    if (!confirm('Delete this bank account?')) return;
    bankAccounts.splice(i, 1);
    saveAllData();
    renderBankAccountsTable();
    showToast('🗑 Bank account deleted');
}

function updateDashboard() {
    if (document.querySelector('.nav-btn.active')?.getAttribute('data-page') === 'dashboard') {
        renderDashboard();
    }
}

// ── New Estimate Page ──
function renderNewEstimatePage() {
    _editingEstimateIndex = null;
    const todayStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '/');
    const now    = new Date();
    const ym     = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0');
    const maxEst = estimates.map(e => parseInt(e.estNo.split('-')[2]) || 0).reduce((m,n) => Math.max(m,n), 99);
    const estNo  = 'EST-' + ym + '-' + String(maxEst + 1).padStart(3, '0');

    const html = `
        <div class="invoice-builder">
            <div class="form-section">
                <div class="form-section-header">
                    <h4>
                        <div class="section-icon green"><span class="material-symbols-rounded" style="color:#16A34A;font-size:15px;">person</span></div>
                        Customer Details
                    </h4>
                </div>
                <div style="position:relative;">
                    <div style="position:relative;margin-bottom:8px;">
                        <span class="material-symbols-rounded" onclick="document.getElementById('estCustSearch').focus();filterEstCustomers();" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:15px;cursor:pointer;">search</span>
                        <input type="text" id="estCustSearch" placeholder="Search by name, vehicle no, or phone..."
                            oninput="filterEstCustomers()" onfocus="filterEstCustomers()"
                            autocomplete="off"
                            style="width:100%;padding:10px 36px 10px 38px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-family:inherit;color:var(--text-primary);background:var(--surface-3);outline:none;transition:all 0.2s;">
                        <button type="button" id="estCustClear" onclick="clearEstCustSearch()"
                            style="display:none;position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;line-height:1;padding:2px 4px;border-radius:4px;" title="Clear">✕</button>
                    </div>
                    <div id="estCustDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1.5px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:200;max-height:220px;overflow-y:auto;"></div>
                </div>
                <select id="estCustomer" style="display:none;" onchange="loadEstCustomerDetails()">
                    <option value="">— Select Customer —</option>
                </select>
                <select id="estRegNo" style="display:none;">
                    <option value="">— Select Registration —</option>
                </select>
                <div id="estCustomerDetails"></div>
            </div>

            <div class="form-section">
                <div class="form-section-header">
                    <h4>
                        <div class="section-icon blue"><span class="material-symbols-rounded" style="color:#2563EB;font-size:15px;">request_quote</span></div>
                        Estimate Details
                    </h4>
                </div>
                <div class="invoice-meta-grid">
                    <div class="meta-box">
                        <label>Estimate Number</label>
                        <div class="radio-group" style="margin-bottom:8px;">
                            <label class="radio-option">
                                <input type="radio" name="estNoType" value="auto" checked onchange="toggleEstNo()"> Auto
                            </label>
                            <label class="radio-option">
                                <input type="radio" name="estNoType" value="manual" onchange="toggleEstNo()"> Manual
                            </label>
                        </div>
                        <input type="text" id="estimateNo" value="${estNo}" readonly style="border:none;background:transparent;font-weight:700;color:var(--primary);font-size:13px;width:100%;outline:none;padding:0;">
                    </div>
                    <div class="meta-box">
                        <label>Estimate Date</label>
                        <div class="radio-group" style="margin-bottom:8px;">
                            <label class="radio-option">
                                <input type="radio" name="estDateType" value="auto" checked onchange="toggleEstDate()"> Auto
                            </label>
                            <label class="radio-option">
                                <input type="radio" name="estDateType" value="manual" onchange="toggleEstDate()"> Manual
                            </label>
                        </div>
                        <input type="text" id="estimateDate" value="${todayStr}" readonly style="border:none;background:transparent;font-weight:600;font-size:13px;width:100%;outline:none;padding:0;color:var(--text-primary);">
                    </div>
                        <textarea id="estimateTo" rows="3" placeholder="Recipient name, address..." style="border:none;background:transparent;font-weight:600;font-size:13px;width:100%;outline:none;padding:4px 0 0;color:var(--text-primary);resize:none;font-family:inherit;"></textarea>
                    </div>
                </div>
            </div>

            <div class="form-section">
                <div class="form-section-header">
                    <h4>
                        <div class="section-icon orange"><span class="material-symbols-rounded" style="color:#D97706;font-size:15px;">build</span></div>
                        🔧 Labor / Repair
                    </h4>
                    <button class="btn btn-sm btn-warning" onclick="addEstRepairRow()" style="background:linear-gradient(135deg,#F59E0B,#D97706);">
                        <span class="material-symbols-rounded" style="font-size:14px;">add</span> Add Labor
                    </button>
                </div>
                <div id="estRepairRows">
                    <div class="item-row">
                        <textarea placeholder="Description of labor work..." class="repair-desc" rows="2"></textarea>
                        <input type="text" inputmode="decimal" placeholder="Amount (Rs.)" class="repair-amt" oninput="fmtAmtInput(this);recalcEstTotal()">
                        <button onclick="removeRow(this)" class="remove-btn">✕</button>
                    </div>
                </div>
            </div>

            <div class="form-section">
                <div class="form-section-header">
                    <h4>
                        <div class="section-icon green"><span class="material-symbols-rounded" style="color:#16A34A;font-size:15px;">settings</span></div>
                        ⚙️ Spare Parts
                    </h4>
                    <button class="btn btn-sm btn-success" onclick="addEstPartRow()">
                        <span class="material-symbols-rounded" style="font-size:14px;">add</span> Add Part
                    </button>
                </div>
                <div id="estPartRows">
                    <div class="part-row-header">
                        <span>Description</span>
                        <span>Qty</span>
                        <span>Unit Price</span>
                        <span></span>
                    </div>
                    <div class="item-row-part">
                        <textarea placeholder="Part name or description..." class="part-desc" rows="2"></textarea>
                        <input type="number" placeholder="1" class="part-qty" min="1" value="1" oninput="calcPartAmt(this);recalcEstTotal()" onfocus="if(this.value==='1')this.value=''" onblur="if(!this.value||this.value==='0')this.value='1'">
                        <input type="text" inputmode="decimal" placeholder="Unit Price (Rs.)" class="part-amt" oninput="fmtAmtInput(this);calcPartTotal(this);recalcEstTotal()">
                        <button onclick="removeRow(this)" class="remove-btn">✕</button>
                    </div>
                </div>
            </div>

            <div class="grand-total-box" style="margin-bottom:18px;">
                <span class="grand-total-label">Estimated Total</span>
                <span id="estGrandTotal" class="grand-total-amount">Rs. 0.00</span>
            </div>

            <div class="form-section">
                <div class="form-section-header">
                    <h4>
                        <div class="section-icon blue"><span class="material-symbols-rounded" style="color:#2563EB;font-size:15px;">notes</span></div>
                        Notes
                    </h4>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <textarea id="estimateNotes" rows="3" placeholder="Additional notes or terms for this estimate..."></textarea>
                </div>
            </div>

            <div style="display:flex;gap:12px;">
                <button class="btn btn-secondary btn-lg" style="flex:1;" onclick="saveEstimate('print')">
                    <span class="material-symbols-rounded">print</span> Save &amp; Print
                </button>
                <button class="btn btn-primary btn-lg" style="flex:2;" onclick="saveEstimate()">
                    <span class="material-symbols-rounded">check_circle</span> Save Estimate
                </button>
            </div>
        </div>
    `;

    document.getElementById('pageContent').innerHTML = html;

    const nameSelect = document.getElementById('estCustomer');
    const regSelect  = document.getElementById('estRegNo');
    customers.forEach(c => {
        nameSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        regSelect.innerHTML  += `<option value="${c.id}">${c.vehicleNo} — ${c.name}</option>`;
    });
    // Attach suggestions to default rows
    document.querySelectorAll('#estRepairRows .item-row').forEach(r => typeof _attachToNewRow === 'function' && _attachToNewRow(r, 'labor'));
    document.querySelectorAll('#estPartRows .item-row-part').forEach(r => typeof _attachToNewRow === 'function' && _attachToNewRow(r, 'spareParts'));
}

function loadEstCustomerDetails() {
    const id = document.getElementById('estCustomer').value;
    document.getElementById('estRegNo').value = id;
    _showEstCustomer(id);
}

function loadEstCustomerByReg() {
    const id = document.getElementById('estRegNo').value;
    document.getElementById('estCustomer').value = id;
    _showEstCustomer(id);
}

function _showEstCustomer(id) {
    const box = document.getElementById('estCustomerDetails');
    if (!id) { box.innerHTML = ''; return; }
    const c = customers.find(x => x.id == id);
    if (!c) return;
    box.innerHTML = `
        <div class="customer-info-strip" style="margin-top:12px;">
            <div class="avatar">${c.isCompany ? '🏢' : c.name.charAt(0).toUpperCase()}</div>
            <div class="info">
                <div class="name">${c.name}</div>
                <div class="details">
                    📞 ${c.contacts || '—'} &nbsp;·&nbsp; 🚗 ${c.vehicleNo || '—'}
                    ${c.vehicleModel ? ` &nbsp;·&nbsp; ${c.vehicleModel} ${c.brand || ''}` : ''}
                    ${c.address ? `<br>📝 ${c.address}` : ''}
                </div>
            </div>
        </div>`;
}

function addEstRepairRow() {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
        <textarea placeholder="Description of labor work..." class="repair-desc" rows="2"></textarea>
        <input type="text" inputmode="decimal" placeholder="Amount (Rs.)" class="repair-amt" oninput="fmtAmtInput(this);recalcEstTotal()">
        <button onclick="removeRow(this)" class="remove-btn">✕</button>`;
    document.getElementById('estRepairRows').appendChild(row);
    if (typeof _attachToNewRow === 'function') _attachToNewRow(row, 'labor');
}

function addEstPartRow() {
    const row = document.createElement('div');
    row.className = 'item-row-part';
    row.innerHTML = `
        <textarea placeholder="Part name or description..." class="part-desc" rows="2"></textarea>
        <input type="number" placeholder="1" class="part-qty" min="1" value="1" oninput="calcPartAmt(this);recalcEstTotal()" onfocus="if(this.value==='1')this.value=''" onblur="if(!this.value||this.value==='0')this.value='1'">
        <input type="text" inputmode="decimal" placeholder="Unit Price (Rs.)" class="part-amt" oninput="fmtAmtInput(this);calcPartTotal(this);recalcEstTotal()">
        <button onclick="removeRow(this)" class="remove-btn">✕</button>`;
    document.getElementById('estPartRows').appendChild(row);
    if (typeof _attachToNewRow === 'function') _attachToNewRow(row, 'spareParts');
}

function toggleEstNo() {
    const isManual = document.querySelector('input[name="estNoType"]:checked').value === 'manual';
    const input = document.getElementById('estimateNo');
    input.readOnly = !isManual;
    input.style.background = isManual ? 'var(--surface)' : 'transparent';
    input.style.border = isManual ? '1.5px solid var(--border)' : 'none';
    input.style.borderRadius = isManual ? '6px' : '0';
    input.style.padding = isManual ? '6px 8px' : '0';
    if (isManual) input.focus();
}

function toggleEstDate() {
    const isManual = document.querySelector('input[name="estDateType"]:checked').value === 'manual';
    const input = document.getElementById('estimateDate');
    input.readOnly = !isManual;
    input.style.background = isManual ? 'var(--surface)' : 'transparent';
    input.style.border = isManual ? '1.5px solid var(--border)' : 'none';
    input.style.borderRadius = isManual ? '6px' : '0';
    input.style.padding = isManual ? '6px 8px' : '0';
    if (isManual) { input.type = 'date'; input.focus(); }
    else { input.type = 'text'; input.value = new Date().toLocaleDateString('en-GB').replace(/\//g, '/'); }
}

function toggleSlipDate() {
    const isManual = document.querySelector('input[name="slipDateType"]:checked').value === 'manual';
    const input = document.getElementById('slipDate');
    input.readOnly = !isManual;
    input.style.background = isManual ? 'var(--surface)' : 'transparent';
    input.style.border = isManual ? '1.5px solid var(--border)' : 'none';
    input.style.borderRadius = isManual ? '6px' : '0';
    input.style.padding = isManual ? '6px 8px' : '0';
    if (isManual) { input.type = 'date'; input.focus(); }
    else { input.type = 'text'; input.value = new Date().toLocaleDateString('en-GB').replace(/\//g, '/'); }
}

function recalcEstTotal() {
    let total = 0;
    document.querySelectorAll('#estRepairRows .repair-amt').forEach(el => { total += getRaw(el); });
    document.querySelectorAll('#estPartRows .part-amt').forEach(el => {
        const row = el.closest('.item-row-part');
        const qty = row ? (parseFloat(row.querySelector('.part-qty').value) || 1) : 1;
        total += getRaw(el) * qty;
    });
    document.getElementById('estGrandTotal').textContent = 'Rs. ' + fmtN(total);
}

// ── Save Estimate ──
function saveEstimate(action) {
    const customerId = document.getElementById('estCustomer').value;
    if (!customerId) { showToast('⚠️ Please select a customer', 'error'); return; }

    const repairDescs = document.querySelectorAll('#estRepairRows .repair-desc');
    const repairAmts  = document.querySelectorAll('#estRepairRows .repair-amt');
    const partDescs   = document.querySelectorAll('#estPartRows .part-desc');
    const partAmts    = document.querySelectorAll('#estPartRows .part-amt');

    const items = [];
    let total = 0;

    repairDescs.forEach((el, i) => {
        const desc = el.value.trim();
        const amt  = getRaw(repairAmts[i]);
        if (desc || amt) { items.push({ type: 'Labor', desc: desc || 'Labor', price: amt, total: amt }); total += amt; }
    });
    partDescs.forEach((el, i) => {
        const desc      = el.value.trim();
        const row       = el.closest('.item-row-part');
        const qty       = row ? (parseFloat(row.querySelector('.part-qty').value) || 1) : 1;
        const unitPrice = getRaw(partAmts[i]);
        const amt       = unitPrice * qty;
        if (desc || amt) { items.push({ type: 'Part', desc: desc || 'Part', price: unitPrice, qty, total: amt }); total += amt; }
    });

    if (items.length === 0) { showToast('⚠️ Please add at least one item', 'error'); return; }

    const customer = customers.find(c => c.id == customerId);

    // Recalculate at save time if Auto — never goes down after delete
    let estNoFinal = document.getElementById('estimateNo').value.trim();
    if (document.querySelector('input[name="estNoType"]:checked')?.value === 'auto' && _editingEstimateIndex === null) {
        const now2   = new Date();
        const ym2    = now2.getFullYear().toString() + String(now2.getMonth() + 1).padStart(2, '0');
        const maxEst2 = estimates.map(e => parseInt(e.estNo.split('-')[2]) || 0).reduce((m,n) => Math.max(m,n), 99);
        estNoFinal   = 'EST-' + ym2 + '-' + String(maxEst2 + 1).padStart(3, '0');
    }

    const estimate = {
        estNo:         estNoFinal,
        customerId:    customer.id,
        customerName:  customer.name,
        customerPhone: customer.contacts,
        isCompany:     customer.isCompany || false,
        companyAddress: customer.companyAddress || '',
        vehicleNo:     customer.vehicleNo,
        vehicleModel:  customer.vehicleModel || '',
        brand:         customer.brand        || '',
        engineNo:      customer.engineNo     || '',
        to:            document.getElementById('estimateTo').value.trim(),
        notes:         document.getElementById('estimateNotes').value.trim(),
        items,
        total,
        date: (() => {
            const isManual = document.querySelector('input[name="estDateType"][value="manual"]')?.checked;
            const estDate = document.getElementById('estimateDate')?.value;
            if (isManual && estDate) {
                const parts = estDate.includes('/') ? estDate.split('/') : estDate.split('-');
                if (parts.length === 3) {
                    const d = estDate.includes('-') && parts[0].length === 4
                        ? new Date(estDate)
                        : new Date(parts[2], parts[1]-1, parts[0]);
                    if (!isNaN(d)) return d.toISOString();
                }
            }
            return new Date().toISOString();
        })()
    };

    if (_editingEstimateIndex !== null && estimates[_editingEstimateIndex]) {
        const isManual = document.querySelector('input[name="estDateType"][value="manual"]')?.checked;
        if (!isManual) estimate.date = estimates[_editingEstimateIndex].date;
        estimates[_editingEstimateIndex] = estimate;
        showToast(`✅ Estimate ${estimate.estNo} updated!`);
    } else {
        estimates.push(estimate);
        currentEstimateNumber++;
        showToast(`✅ Estimate ${estimate.estNo} saved!`);
        window._lastSavedEstNo = estimate.estNo;
    }
    _editingEstimateIndex = null;
    if (typeof learnFromForm === 'function') learnFromForm();
    saveAllData();

    if (action === 'print') {
        printEstimateRecord(estimates.length - 1);
    } else {
        setTimeout(() => document.querySelector('.nav-btn[data-page="estimates"]').click(), 400);
    }
}

// ── Estimate History Page ──
function renderEstimatesPage() {
    const html = `
        <div class="page-header">
            <div class="page-header-left">
                <div class="page-title">Estimate History</div>
                <div class="page-subtitle">${estimates.length} estimate${estimates.length !== 1 ? 's' : ''} in total</div>
            </div>
            <div class="page-header-actions">
                <button class="btn btn-primary" onclick="exportFilteredEstimatesToPDF()">
                    <span class="material-symbols-rounded">picture_as_pdf</span> Export PDF
                </button>
            </div>
        </div>

        <div class="search-section">
            <div style="display:grid;grid-template-columns:1fr 150px 150px auto;gap:12px;align-items:end;">
                <div class="search-input-wrapper">
                    <span class="search-icon material-symbols-rounded">search</span>
                    <input type="text" id="estSearch" placeholder="Search by Estimate No, Customer or Vehicle No..." onkeyup="loadEstimatesTable()">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:5px;">From</label>
                    <input type="date" id="estDateFrom" onchange="loadEstimatesTable()" style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;color:var(--text-primary);background:var(--surface);outline:none;">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:5px;">To</label>
                    <input type="date" id="estDateTo" onchange="loadEstimatesTable()" style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;color:var(--text-primary);background:var(--surface);outline:none;">
                </div>
                <button class="btn btn-secondary" onclick="document.getElementById('estSearch').value='';document.getElementById('estDateFrom').value='';document.getElementById('estDateTo').value='';loadEstimatesTable();" style="align-self:end;">
                    <span class="material-symbols-rounded">filter_list_off</span> Clear
                </button>
            </div>
        </div>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width:36px;"></th>
                        <th>Est No</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Vehicle</th>
                        <th>Total</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="estimatesTableBody"></tbody>
            </table>
        </div>
    `;
    document.getElementById('pageContent').innerHTML = html;
    loadEstimatesTable();
}

function loadEstimatesTable() {
    const searchTerm = (document.getElementById('estSearch')?.value || '').toLowerCase();
    const dateFrom   = document.getElementById('estDateFrom')?.value;
    const dateTo     = document.getElementById('estDateTo')?.value;

    const filtered = estimates.filter(e => {
        const matchText = e.estNo.toLowerCase().includes(searchTerm) ||
                          e.customerName.toLowerCase().includes(searchTerm) ||
                          (e.vehicleNo || '').toLowerCase().includes(searchTerm);
        const estDate   = new Date(e.date);
        const matchFrom = dateFrom ? estDate >= new Date(dateFrom) : true;
        const matchTo   = dateTo   ? estDate <= new Date(dateTo + 'T23:59:59') : true;
        return matchText && matchFrom && matchTo;
    });

    const tbody = document.getElementById('estimatesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7">
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h4>${searchTerm ? 'No results found' : 'No estimates yet'}</h4>
                    <p>${searchTerm ? 'Try a different search term.' : 'Create your first estimate to see it here.'}</p>
                    ${!searchTerm ? `<button class="btn btn-primary btn-sm" onclick="document.querySelector('[data-page=new-estimate]').click()">
                        <span class="material-symbols-rounded" style="font-size:14px;">add</span> New Estimate
                    </button>` : ''}
                </div>
            </td></tr>`;
        return;
    }

    // Sort: starred first, then by date desc
    const sorted = [...filtered].sort((a, b) => {
        if ((b.starred ? 1 : 0) !== (a.starred ? 1 : 0)) return (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
        return new Date(b.date) - new Date(a.date);
    });

    let estHtml = '';
    sorted.forEach(est => {
        const idx     = estimates.indexOf(est);
        const starred = est.starred || false;
        const isNew   = window._lastSavedEstNo && est.estNo === window._lastSavedEstNo;

        estHtml += `
            <tr class="clickable-row" onclick="printEstimateRecord(${idx})" style="${isNew ? 'background:linear-gradient(90deg,#DCFCE7,var(--surface));border-left:3px solid #16A34A;' : ''}${starred ? 'background:linear-gradient(90deg,#FFFBEB,var(--surface));' : ''}">
                <td style="text-align:center;padding:0 4px;">
                    <button onclick="event.stopPropagation(); toggleEstStar(${idx})" title="${starred ? 'Unstar' : 'Star'}"
                        style="background:none;border:none;cursor:pointer;font-size:18px;line-height:1;padding:4px;">
                        ${starred ? '⭐' : '☆'}
                    </button>
                </td>
                <td>
                    <span class="badge badge-blue">${est.estNo}</span>
                    ${isNew ? ' <span class="badge" style="background:#DCFCE7;color:#16A34A;font-size:10px;">✦ New</span>' : ''}
                </td>
                <td class="td-muted">${new Date(est.date).toLocaleDateString()}</td>
                <td>
                    <div style="font-weight:700;">${est.customerName}</div>
                    <div style="font-size:12px;color:var(--text-muted);">${est.vehicleNo}</div>
                </td>
                <td class="td-muted">${est.vehicleNo}</td>
                <td><strong style="color:var(--primary);font-size:14px;">Rs. ${fmtN(est.total)}</strong></td>
                <td>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${est.convertedToBill ? '' : `<button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); convertEstimateToBill(${idx})" title="Convert to Bill" style="background:linear-gradient(135deg,#16A34A,#15803D);box-shadow:0 3px 8px rgba(22,163,74,0.3);">
                            <span class="material-symbols-rounded" style="font-size:14px;">receipt_long</span> To Bill
                        </button>`}
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); editEstimate(${idx})" title="Edit estimate">
                            <span class="material-symbols-rounded" style="font-size:14px;">edit</span>
                        </button>
                        <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); downloadEstimate(${idx})" title="Download PDF">
                            <span class="material-symbols-rounded" style="font-size:14px;">download</span>
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); printEstimateRecord(${idx})" title="Print">
                            <span class="material-symbols-rounded" style="font-size:14px;">print</span>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteEstimate(${idx})" title="Delete estimate">
                            <span class="material-symbols-rounded" style="font-size:14px;">delete</span>
                        </button>
                    </div>
                </td>
            </tr>`;
    });
    tbody.innerHTML = estHtml;
}

function convertEstimateToBill(index) {
    const est = estimates[index];
    if (!est) return;

    // Navigate to New Bill page
    document.querySelector('.nav-btn[data-page="new-bill"]').click();

    setTimeout(() => {
        window._convertingEstimateIndex = index;
        // Set customer
        const custSelect = document.getElementById('billCustomer');
        if (custSelect) {
            custSelect.value = est.customerId;
            loadBillCustomerDetails();
        }

        // Keep Bill Number on Auto — updateBillType() already set the correct CH/CR number
        // Just ensure auto is selected and type cards are highlighted
        document.getElementById('invTypeAuto').checked = true;
        toggleInvNo();
        updateBillType(); // applies correct CH/CR number based on selected type

        // Clear default rows
        document.getElementById('repairRows').innerHTML = '';
        document.getElementById('partRows').innerHTML   = `
            <div class="part-row-header">
                <span>Description</span>
                <span>Qty</span>
                <span>Unit Price</span>
                <span></span>
            </div>`;

        // Re-populate labor rows
        est.items.filter(i => i.type === 'Labor').forEach(item => {
            addRepairRow();
            const rows = document.querySelectorAll('#repairRows .item-row');
            const last = rows[rows.length - 1];
            last.querySelector('.repair-desc').value = item.desc;
            const raInput = last.querySelector('.repair-amt');
            raInput.value = item.price;
            fmtAmtInput(raInput);
        });

        // Re-populate part rows
        est.items.filter(i => i.type === 'Part').forEach(item => {
            addPartRow();
            const rows = document.querySelectorAll('#partRows .item-row-part');
            const last = rows[rows.length - 1];
            last.querySelector('.part-desc').value = item.desc;
            last.querySelector('.part-qty').value  = item.qty || 1;
            const paInput = last.querySelector('.part-amt');
            paInput.value = item.price;
            fmtAmtInput(paInput);
        });

        recalcTotal();
        showToast('📋 Estimate converted — select Cash or Credit then save');
    }, 150);
}

function toggleEstStar(index) {
    if (!estimates[index]) return;
    estimates[index].starred = !estimates[index].starred;
    saveAllData();
    loadEstimatesTable();
}

function printEstimateRecord(index) {
    const est = estimates[index];
    if (!est) return;

    const model      = [est.brand, est.vehicleModel].filter(Boolean).join(' ') || '—';
    const dateStr    = new Date(est.date).toLocaleDateString('en-GB');
    const laborItems = est.items.filter(i => i.type === 'Labor');
    const partItems  = est.items.filter(i => i.type === 'Part');
    const fmtDesc    = d => { if (!d) return ''; d = d.trim(); d = d.charAt(0).toUpperCase()+d.slice(1); if (!d.endsWith('.')) d+='.'; return d; };

    const laborRows = laborItems.map((item, i) => `
        <tr style="background:${i%2===0?'#fff':'#f9f9f9'};">
            <td style="padding:11px 14px;border-bottom:1px solid #e8ecf0;color:#555;width:40px;">${i+1}</td>
            <td style="padding:11px 14px;border-bottom:1px solid #e8ecf0;">${fmtDesc(item.desc)}</td>
            <td style="padding:11px 14px;border-bottom:1px solid #e8ecf0;text-align:right;font-weight:500;white-space:nowrap;">${fmtN(item.total)}</td>
        </tr>`).join('');

    const partRows = partItems.map((item, i) => `
        <tr style="background:${i%2===0?'#fff':'#f9f9f9'};">
            <td style="padding:11px 14px;border-bottom:1px solid #e8ecf0;color:#555;width:40px;">${i+1}</td>
            <td style="padding:11px 14px;border-bottom:1px solid #e8ecf0;">${fmtDesc(item.desc)}${item.qty>1?' <span style="color:#888;font-size:12px;">×'+item.qty+'</span>':''}</td>
            <td style="padding:11px 14px;border-bottom:1px solid #e8ecf0;text-align:right;font-weight:500;white-space:nowrap;">${fmtN(item.total)}</td>
        </tr>`).join('');

    const billToHtml = est.isCompany
        ? `${est.companyAddress ? `<div class="cust-name" style="font-size:15px;font-weight:700;">${est.companyAddress}</div>` : ''}
           ${est.customerPhone ? `<div class="cust-phone">${est.customerPhone}</div>` : ''}`
        : `<div class="cust-name">${est.customerName}</div>
           ${est.customerPhone ? `<div class="cust-phone">${est.customerPhone}</div>` : ''}`;

    const win = window.open('', '_blank', 'width=800,height=950');
    win.document.write(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Estimate ${est.estNo}</title>
<style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:Arial,sans-serif;background:#fff;color:#000;font-size:13px;min-height:100vh;display:flex;flex-direction:column;}
    .page{background:#fff;max-width:760px;margin:20px auto;flex:1;display:flex;flex-direction:column;width:100%;}
    .content{flex:1;}
    .bottom{margin-top:auto;}
    .header{border:1.5px solid #000;padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0;}
    .company-name{font-size:22px;font-weight:700;color:#000;}
    .company-sub{font-size:11px;line-height:1.8;color:#000;}
    .invoice-meta{text-align:right;}
    .invoice-title{font-size:22px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;color:#000;}
    .invoice-meta p{font-size:12px;line-height:1.9;color:#000;}
    .body{padding:16px 0;}
    .cust-section{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #000;}
    .cust-name{font-size:14px;font-weight:700;color:#000;margin-bottom:3px;}
    .cust-phone{font-size:12px;color:#000;}
    .section-title{font-size:11px;font-weight:700;color:#000;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;}
    .vehicle-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid #000;margin-bottom:16px;}
    .vehicle-cell{padding:8px 10px;border-right:1px solid #000;}
    .vehicle-cell:last-child{border-right:none;}
    .vehicle-cell .label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;color:#000;}
    .vehicle-cell .value{font-size:12.5px;font-weight:600;color:#000;}
    table{width:100%;border-collapse:collapse;margin-bottom:0;}
    .tbl-wrap{border:1px solid #000;margin-bottom:16px;}
    thead tr{background:#fff;}
    thead th{padding:8px 10px;font-size:11px;font-weight:700;color:#000;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #000;}
    thead th:last-child{text-align:right;}
    .section-row td{background:#e0e0e0;color:#000;font-weight:700;font-size:12px;padding:7px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .total-row td{background:#fff;font-weight:700;font-size:14px;padding:10px 10px;color:#000;border-top:2px solid #000;}
    .total-row td:last-child{text-align:right;font-size:15px;}
    .footer{text-align:center;padding:14px 0;border-top:1px solid #000;font-size:12px;color:#000;line-height:2;margin-top:8px;}
    .sig-section{display:flex;justify-content:space-between;padding:20px 0 8px;}
    .sig-line{border-top:1px solid #000;padding-top:6px;font-size:11px;color:#000;text-align:center;width:180px;}
    .print-btn{display:inline-block;margin:20px 8px 0;padding:10px 24px;background:#000;color:#fff;border:none;font-size:13px;font-weight:600;cursor:pointer;font-family:Arial,sans-serif;}
    .btn-row{text-align:center;}
    @media print{.btn-row{display:none;}body{background:#fff;margin:0;min-height:100vh;}.page{margin:0;max-width:100%;min-height:100vh;}}
</style></head><body>
<div class="page">
    <div class="header">
        <div>
            <div class="company-name">Siriman Motor Works</div>
            <div class="company-sub">
                <em>Since 1958</em><br>
                Daluwakotuwa, Kochchikade.<br>
                Tel: 031 227 7371 &nbsp;|&nbsp; 074 255 7371<br>
                Email: sirimanmortors58@gmail.com
            </div>
        </div>
        <div class="invoice-meta">
            <div class="invoice-title">Estimate</div>
            <p><strong>No:</strong> ${est.estNo}</p>
            <p><strong>Date:</strong> ${dateStr}</p>
        </div>
    </div>

    <div class="content"><div class="body">
        <div class="cust-section" style="margin-top:20px;padding-top:8px;">
            <div>
                <div class="section-title">${est.isCompany ? 'Invoice To (Company)' : 'Bill To'}</div>
                ${billToHtml}
            </div>
        </div>

        <div class="section-title" style="margin-bottom:8px;margin-top:20px;">Vehicle Details</div>
        <div class="vehicle-grid" style="margin-bottom:16px;">
            <div class="vehicle-cell"><div class="label">Model</div><div class="value">${model}</div></div>
            <div class="vehicle-cell"><div class="label">Reg. No</div><div class="value">${est.vehicleNo||'—'}</div></div>
            <div class="vehicle-cell"><div class="label">Mileage</div><div class="value">—</div></div>
        </div>

        ${est.to ? `<div style="border:1px solid #000;padding:10px 14px;margin-bottom:16px;"><div class="section-title" style="margin-bottom:4px;">To</div><div style="font-size:13px;">${est.to}</div></div>` : ''}

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
                    <td colspan="2">Estimated Total</td>
                    <td>Rs. ${fmtN(est.total)}</td>
                </tr>
            </tbody>
        </table>
        </div>

        ${est.notes ? `<div style="border:1px solid #ccc;padding:10px 14px;margin-bottom:16px;font-size:12px;"><strong>Notes:</strong> ${est.notes}</div>` : ''}
    </div></div>

    <div class="bottom">
        <div class="sig-section">
            <div class="sig-line">Customer Signature</div>
            <div class="sig-line">Authorized Signature</div>
        </div>
        <div class="footer">
            We specialize in all types of Japanese and European vehicle repairing.<br>
            <strong>Thank you.</strong>
        </div>
    </div>
</div>
<div class="btn-row">
    <button class="print-btn" onclick="window.print()">🖨 Print Estimate</button>
</div>
</body></html>`);
    win.document.close();
}

let _editingEstimateIndex = null;

function editEstimate(index) {
    const est = estimates[index];
    if (!est) return;

    document.querySelector('.nav-btn[data-page="new-estimate"]').click();

    setTimeout(() => {
        _editingEstimateIndex = index;
        const custSelect = document.getElementById('estCustomer');
        if (custSelect) {
            custSelect.value = est.customerId;
            loadEstCustomerDetails();
            const c = customers.find(x => x.id == est.customerId);
            if (c) {
                const si = document.getElementById('estCustSearch');
                if (si) si.value = c.name + (c.vehicleNo ? '  —  ' + c.vehicleNo : '');
                const clr = document.getElementById('estCustClear');
                if (clr) clr.style.display = 'block';
            }
        }

        document.querySelector('input[name="estNoType"][value="manual"]').checked = true;
        toggleEstNo();
        document.getElementById('estimateNo').value = est.estNo;

        document.querySelector('input[name="estDateType"][value="manual"]').checked = true;
        toggleEstDate();
        document.getElementById('estimateDate').value = new Date(est.date).toLocaleDateString('en-GB').replace(/\//g, '/');

        if (est.to)    document.getElementById('estimateTo').value    = est.to;
        if (est.notes) document.getElementById('estimateNotes').value = est.notes;

        document.getElementById('estRepairRows').innerHTML = '';
        document.getElementById('estPartRows').innerHTML   = `
            <div class="part-row-header">
                <span>Description</span><span>Qty</span><span>Unit Price</span><span></span>
            </div>`;

        est.items.forEach(item => {
            if (item.type === 'Labor') {
                addEstRepairRow();
                const rows = document.querySelectorAll('#estRepairRows .item-row');
                const last = rows[rows.length - 1];
                last.querySelector('.repair-desc').value = item.desc;
                const raInput = last.querySelector('.repair-amt');
                raInput.value = item.price; fmtAmtInput(raInput);
            } else {
                addEstPartRow();
                const rows = document.querySelectorAll('#estPartRows .item-row-part');
                const last = rows[rows.length - 1];
                last.querySelector('.part-desc').value = item.desc;
                last.querySelector('.part-qty').value  = item.qty || 1;
                const paInput = last.querySelector('.part-amt');
                paInput.value = item.price; fmtAmtInput(paInput);
            }
        });
        recalcEstTotal();
        showToast('✏️ Editing estimate — save when done');
    }, 150);
}

function downloadEstimate(index) {
    const est = estimates[index];
    if (!est) return;
    if (!window.jspdf) { showToast('⚠️ PDF library not loaded', 'error'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','mm','a4');
    const pw = 210, margin = 14, cw = pw - margin*2;
    let y = 14;

    const model = [est.brand, est.vehicleModel].filter(Boolean).join(' ') || '—';
    const dateStr = new Date(est.date).toLocaleDateString('en-GB');
    const laborItems = est.items.filter(i => i.type === 'Labor');
    const partItems  = est.items.filter(i => i.type === 'Part');
    const fmtDesc = d => { if (!d) return ''; d = d.trim(); d = d.charAt(0).toUpperCase()+d.slice(1); if (!d.endsWith('.')) d+='.'; return d; };

    // Header
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
    doc.text('ESTIMATE', pw-margin-3, y+9, {align:'right'});
    doc.setFont('helvetica','normal'); doc.setFontSize(11);
    doc.text(`No: ${est.estNo}`, pw-margin-3, y+18, {align:'right'});
    doc.text(`Date: ${dateStr}`, pw-margin-3, y+24, {align:'right'});
    y += 32;

    // To / Customer
    y += 6;
    if (est.to) {
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(100);
        doc.text('TO', margin, y); y += 5;
        doc.setFont('helvetica','normal'); doc.setFontSize(12); doc.setTextColor(0);
        doc.text(est.to, margin, y, {maxWidth: cw}); y += 9;
    }
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(100);
    doc.text('CUSTOMER', margin, y); y += 5;
    doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.setTextColor(0);
    if (est.isCompany) {
        if (est.companyAddress) { doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.text(est.companyAddress, margin, y, {maxWidth:cw}); y += 7; doc.setFont('helvetica','normal'); doc.setFontSize(11); }
        if (est.customerPhone)  { doc.text(est.customerPhone, margin, y); y += 6; }
    } else {
        doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.text(est.customerName, margin, y); y += 6;
        doc.setFont('helvetica','normal'); doc.setFontSize(11);
        if (est.customerPhone) { doc.text(est.customerPhone, margin, y); y += 6; }
    }
    y += 2;

    // Vehicle
    y += 6;
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(100);
    doc.text('VEHICLE DETAILS', margin, y); y += 3;
    const c3 = cw/3;
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.rect(margin, y, cw, 14);
    doc.line(margin+c3, y, margin+c3, y+14); doc.line(margin+c3*2, y, margin+c3*2, y+14);
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(0);
    doc.text('MODEL', margin+2, y+5); doc.text('REG. NO', margin+c3+2, y+5); doc.text('MILEAGE', margin+c3*2+2, y+5);
    doc.setFont('helvetica','normal'); doc.setFontSize(11);
    doc.text(model, margin+2, y+11); doc.text(est.vehicleNo||'—', margin+c3+2, y+11); doc.text('—', margin+c3*2+2, y+11);
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
    doc.text('Estimated Total', margin+2, y+6.5); doc.text('Rs. '+fmtN(est.total), pw-margin-2, y+6.5, {align:'right'});
    y += 9;

    // Notes
    if (est.notes) {
        y += 4; doc.setFont('helvetica','italic'); doc.setFontSize(10.5); doc.setTextColor(80);
        doc.text('Notes: '+est.notes, margin, y, {maxWidth:cw}); y += 9;
    }

    // Signatures
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.line(margin, 253, margin+55, 253); doc.line(pw-margin-55, 255, pw-margin, 255);
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(0);
    doc.text('Customer Signature', margin, 258); doc.text('Authorized Signature', pw-margin-55, 258);

    // Footer
    doc.setFont('helvetica','italic'); doc.setFontSize(10); doc.setTextColor(80);
    doc.text('We specialize in all types of Japanese and European vehicle repairing.', pw/2, 267, {align:'center'});
    doc.setFont('helvetica','bold'); doc.setTextColor(0);
    doc.text('Thank you.', pw/2, 273, {align:'center'});

    const sv = (est.vehicleNo||'').replace(/[^a-zA-Z0-9\-]/g,'');
    const sn = (est.customerName||'').replace(/[^a-zA-Z0-9 \-]/g,'').trim();
    const sd = new Date(est.date).toLocaleDateString('en-GB').replace(/\//g,'-');
    doc.save(`EST_${sv}_${sn}_${sd}.pdf`);
    showToast('📄 Estimate PDF downloaded');
}

// ── Export Filtered Estimates to PDF ──
function exportFilteredEstimatesToPDF() {
    if (!window.jspdf) { showToast('⚠️ PDF library not loaded', 'error'); return; }

    const searchTerm = (document.getElementById('estSearch')?.value || '').toLowerCase();
    const dateFrom   = document.getElementById('estDateFrom')?.value;
    const dateTo     = document.getElementById('estDateTo')?.value;

    const filtered = estimates.filter(e => {
        const matchText = e.estNo.toLowerCase().includes(searchTerm) ||
                          e.customerName.toLowerCase().includes(searchTerm) ||
                          (e.vehicleNo || '').toLowerCase().includes(searchTerm);
        const estDate   = new Date(e.date);
        const matchFrom = dateFrom ? estDate >= new Date(dateFrom) : true;
        const matchTo   = dateTo   ? estDate <= new Date(dateTo + 'T23:59:59') : true;
        return matchText && matchFrom && matchTo;
    });

    if (filtered.length === 0) { showToast('⚠️ No estimates to export', 'error'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');

    // Header
    doc.setFillColor(15, 45, 74);
    doc.rect(0, 0, 297, 22, 'F');
    doc.setTextColor(201, 168, 76);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Siriman Motor Works', 14, 10);
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('Estimate History Report', 14, 17);

    // Filter summary
    const parts = [];
    if (searchTerm) parts.push(`Search: "${searchTerm}"`);
    if (dateFrom)   parts.push(`From: ${dateFrom}`);
    if (dateTo)     parts.push(`To: ${dateTo}`);
    if (parts.length) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('Filters: ' + parts.join('  |  '), 14, 28);
    }

    // Table
    const startY = parts.length ? 33 : 28;
    const cols   = ['Estimate No', 'Date', 'Customer', 'Vehicle No', 'To', 'Total (Rs.)'];
    const colW   = [35, 28, 55, 35, 60, 38];
    let x = 14, y = startY;

    // Table header
    doc.setFillColor(30, 41, 59);
    doc.rect(14, y, 269, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    cols.forEach((col, i) => {
        doc.text(col, x + 2, y + 5.5);
        x += colW[i];
    });
    y += 8;

    // Rows
    doc.setFont('helvetica', 'normal');
    [...filtered].reverse().forEach((est, ri) => {
        if (y > 185) {
            doc.addPage();
            y = 14;
        }
        doc.setFillColor(ri % 2 === 0 ? 248 : 255, ri % 2 === 0 ? 250 : 255, ri % 2 === 0 ? 252 : 255);
        doc.rect(14, y, 269, 7, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        x = 14;
        const row = [
            est.estNo,
            new Date(est.date).toLocaleDateString(),
            est.customerName,
            est.vehicleNo || '—',
            est.to || '—',
            'Rs. ' + fmtN(est.total)
        ];
        row.forEach((val, i) => {
            doc.text(String(val).substring(0, 30), x + 2, y + 4.8);
            x += colW[i];
        });
        doc.setDrawColor(226, 232, 240);
        doc.line(14, y + 7, 283, y + 7);
        y += 7;
    });

    // Summary row
    const totalAmt = filtered.reduce((s, e) => s + e.total, 0);
    y += 4;
    doc.setFillColor(245, 243, 255);
    doc.rect(14, y, 269, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(124, 58, 237);
    doc.text(`${filtered.length} estimate${filtered.length !== 1 ? 's' : ''}`, 16, y + 6.5);
    doc.text(`Total Estimated: Rs. ${fmtN(totalAmt)}`, 90, y + 6.5);

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 205);

    doc.save(`estimates_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('📄 PDF exported successfully');
}

function deleteEstimate(index) {
    openDeleteModal(() => {
        estimates.splice(index, 1);
        saveAllData();
        loadEstimatesTable();
        showToast('🗑 Estimate deleted');
    });
}

// ── Payment Slip Page ──
function renderPaymentSlipPage() {
    _editingSlipIndex = null;
    const todayStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '/');
    const now    = new Date();
    const ym     = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0');
    const maxSlip = paymentSlips.map(s => parseInt(s.slipNo.split('-')[2]) || 0).reduce((m,n) => Math.max(m,n), 99);
    const slipNo = 'PAY-' + ym + '-' + String(maxSlip + 1).padStart(3, '0');

    const html = `
        <div class="invoice-builder">

            <!-- Customer Selection -->
            <div class="form-section">
                <div class="form-section-header">
                    <h4>
                        <div class="section-icon green"><span class="material-symbols-rounded" style="color:#16A34A;font-size:15px;">person</span></div>
                        Customer Details
                    </h4>
                </div>
                <div style="position:relative;">
                    <div style="position:relative;margin-bottom:8px;">
                        <span class="material-symbols-rounded" onclick="document.getElementById('payCustSearch').focus();filterPayCustomers();" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:15px;cursor:pointer;">search</span>
                        <input type="text" id="payCustSearch" placeholder="Search by name, vehicle no, or phone..."
                            oninput="filterPayCustomers()" onfocus="filterPayCustomers()"
                            autocomplete="off"
                            style="width:100%;padding:10px 36px 10px 38px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;font-family:inherit;color:var(--text-primary);background:var(--surface-3);outline:none;transition:all 0.2s;">
                        <button type="button" id="payCustClear" onclick="clearPayCustSearch()"
                            style="display:none;position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;line-height:1;padding:2px 4px;border-radius:4px;" title="Clear">✕</button>
                    </div>
                    <div id="payCustDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1.5px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:200;max-height:220px;overflow-y:auto;"></div>
                </div>
                <select id="payCustomer" style="display:none;" onchange="loadPayCustomerDetails()">
                    <option value="">— Select Customer —</option>
                </select>
                <select id="payRegNo" style="display:none;">
                    <option value="">— Select Registration —</option>
                </select>
                <div id="payCustomerDetails"></div>
            </div>

            <!-- Slip Details -->
            <div class="form-section">
                <div class="form-section-header">
                    <h4>
                        <div class="section-icon blue"><span class="material-symbols-rounded" style="color:#2563EB;font-size:15px;">payments</span></div>
                        Payment Details
                    </h4>
                </div>
                <div class="invoice-meta-grid">
                    <div class="meta-box">
                        <label>Slip Number</label>
                        <input type="text" id="slipNo" value="${slipNo}" style="border:none;background:transparent;font-weight:700;color:var(--primary);font-size:13px;width:100%;outline:none;padding:0;">
                    </div>
                    <div class="meta-box">
                        <label>Date</label>
                        <div class="radio-group" style="margin-bottom:8px;">
                            <label class="radio-option">
                                <input type="radio" name="slipDateType" value="auto" checked onchange="toggleSlipDate()"> Auto
                            </label>
                            <label class="radio-option">
                                <input type="radio" name="slipDateType" value="manual" onchange="toggleSlipDate()"> Manual
                            </label>
                        </div>
                        <input type="text" id="slipDate" value="${todayStr}" readonly style="border:none;background:transparent;font-weight:600;font-size:13px;width:100%;outline:none;padding:0;color:var(--text-primary);">
                    </div>
                    <div class="meta-box">
                        <label>Reference Bill No</label>
                        <select id="slipRefBill" onchange="loadSlipFromBill()" style="border:none;background:transparent;font-weight:600;font-size:13px;width:100%;outline:none;padding:4px 0 0;color:var(--text-primary);cursor:pointer;">
                            <option value="">— Select Bill (optional) —</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Payment Info -->
            <div class="form-section">
                <div class="form-section-header">
                    <h4>
                        <div class="section-icon orange"><span class="material-symbols-rounded" style="color:#D97706;font-size:15px;">account_balance_wallet</span></div>
                        Payment Info
                    </h4>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Amount Received (Rs.)</label>
                        <input type="text" inputmode="decimal" id="slipAmount" placeholder="0.00"
                            oninput="fmtAmtInput(this)"
                            style="font-size:22px;font-weight:800;color:#16A34A;border:1.5px solid var(--border);border-radius:8px;padding:12px 14px;width:100%;outline:none;background:var(--surface-3);">
                    </div>
                    <div class="form-group">
                        <label>Payment Method</label>
                        <select id="slipMethod" style="padding:12px 14px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:14px;color:var(--text-primary);background:var(--surface-3);outline:none;width:100%;">
                            <option value="Cash">Cash</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Card">Card</option>
                            <option value="Online">Online</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Notes (optional)</label>
                    <textarea id="slipNotes" rows="2" placeholder="Any additional notes..."></textarea>
                </div>
            </div>

            <!-- Actions -->
            <div style="display:flex;gap:12px;">
                <button class="btn btn-secondary btn-lg" style="flex:1;" onclick="printPaymentSlip()">
                    <span class="material-symbols-rounded">print</span> Print Slip
                </button>
                <button class="btn btn-primary btn-lg" style="flex:2;" onclick="printPaymentSlip('save')">
                    <span class="material-symbols-rounded">check_circle</span> Save &amp; Print
                </button>
            </div>
        </div>
    `;

    document.getElementById('pageContent').innerHTML = html;

    const nameSelect = document.getElementById('payCustomer');
    const regSelect  = document.getElementById('payRegNo');
    customers.forEach(c => {
        nameSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        regSelect.innerHTML  += `<option value="${c.id}">${c.vehicleNo} — ${c.name}</option>`;
    });
}

function loadPayCustomerDetails() {
    const id = document.getElementById('payCustomer').value;
    document.getElementById('payRegNo').value = id;
    _showPayCustomer(id);
}

function loadPayCustomerByReg() {
    const id = document.getElementById('payRegNo').value;
    document.getElementById('payCustomer').value = id;
    _showPayCustomer(id);
}

function _showPayCustomer(id) {
    const box = document.getElementById('payCustomerDetails');
    if (!id) { box.innerHTML = ''; return; }
    const c = customers.find(x => x.id == id);
    if (!c) return;
    box.innerHTML = `
        <div class="customer-info-strip" style="margin-top:12px;">
            <div class="avatar">${c.isCompany ? '🏢' : c.name.charAt(0).toUpperCase()}</div>
            <div class="info">
                <div class="name">${c.name}</div>
                <div class="details">
                    📞 ${c.contacts || '—'} &nbsp;·&nbsp; 🚗 ${c.vehicleNo || '—'}
                    ${c.vehicleModel ? ` &nbsp;·&nbsp; ${c.vehicleModel} ${c.brand || ''}` : ''}
                    ${c.address ? `<br>📝 ${c.address}` : ''}
                </div>
            </div>
        </div>`;

    // Populate bill dropdown for this customer
    const refSelect = document.getElementById('slipRefBill');
    if (!refSelect) return;
    refSelect.innerHTML = '<option value="">— Select Bill (optional) —</option>';
    const custBills = bills.filter(b => b.customerId == id);
    custBills.forEach((b, i) => {
        const globalIdx = bills.indexOf(b);
        const paidLabel = b.paid ? ' ✓ Paid' : ' · Unpaid';
        refSelect.innerHTML += `<option value="${globalIdx}">${b.billNo} — Rs. ${fmtN(b.total)}${paidLabel} (${new Date(b.date).toLocaleDateString()})</option>`;
    });
    if (custBills.length === 0) {
        refSelect.innerHTML += `<option disabled>No bills found for this customer</option>`;
    }
}

function loadSlipFromBill() {
    const refSelect = document.getElementById('slipRefBill');
    const idx = refSelect.value;
    if (idx === '') return;
    const bill = bills[parseInt(idx)];
    if (!bill) return;

    // Auto-fill amount with bill total
    const amtInput = document.getElementById('slipAmount');
    amtInput.value = bill.total;
    fmtAmtInput(amtInput);

    showToast(`📋 Loaded bill ${bill.billNo}`);
}

function printPaymentSlip(action) {
    const custId = document.getElementById('payCustomer').value;
    if (!custId) { showToast('⚠️ Please select a customer', 'error'); return; }

    const amtRaw = getRaw(document.getElementById('slipAmount'));
    if (!amtRaw) { showToast('⚠️ Please enter an amount', 'error'); return; }

    const c       = customers.find(x => x.id == custId);
    // Recalculate at save time if new slip — never goes down after delete
    let slipNo = document.getElementById('slipNo').value.trim();
    if (action === 'save' && _editingSlipIndex === null) {
        const now2     = new Date();
        const ym2      = now2.getFullYear().toString() + String(now2.getMonth() + 1).padStart(2, '0');
        const maxSlip2 = paymentSlips.map(s => parseInt(s.slipNo.split('-')[2]) || 0).reduce((m,n) => Math.max(m,n), 99);
        slipNo = 'PAY-' + ym2 + '-' + String(maxSlip2 + 1).padStart(3, '0');
        document.getElementById('slipNo').value = slipNo;
    }
    const date    = (() => {
        const el = document.getElementById('slipDate');
        if (el.type === 'date' && el.value) {
            const d = new Date(el.value);
            return d.toLocaleDateString('en-GB').replace(/\//g, '/');
        }
        return el.value;
    })();
    const refSelect = document.getElementById('slipRefBill');
    const refBill   = refSelect.value !== '' ? bills[parseInt(refSelect.value)]?.billNo || '' : '';
    const method  = document.getElementById('slipMethod').value;
    const notes   = document.getElementById('slipNotes').value.trim();

    if (action === 'save') {
        const slipEntry = {
            slipNo,
            customerId:    c.id,
            customerName:  c.name,
            customerPhone: c.contacts,
            vehicleNo:     c.vehicleNo,
            refBill,
            amount:  amtRaw,
            method,
            notes,
            date: (() => {
                const isManual = document.querySelector('input[name="slipDateType"][value="manual"]')?.checked;
                const sDate = document.getElementById('slipDate')?.value;
                if (isManual && sDate) {
                    const parts = sDate.includes('/') ? sDate.split('/') : sDate.split('-');
                    if (parts.length === 3) {
                        const d = sDate.includes('-') && parts[0].length === 4
                            ? new Date(sDate)
                            : new Date(parts[2], parts[1]-1, parts[0]);
                        if (!isNaN(d)) return d.toISOString();
                    }
                }
                return new Date().toISOString();
            })()
        };

        if (_editingSlipIndex !== null && paymentSlips[_editingSlipIndex]) {
            const isManual = document.querySelector('input[name="slipDateType"][value="manual"]')?.checked;
            if (!isManual) slipEntry.date = paymentSlips[_editingSlipIndex].date;
            paymentSlips[_editingSlipIndex] = slipEntry;
            showToast(`✅ Payment slip ${slipNo} updated!`);
        } else {
            paymentSlips.push(slipEntry);
            currentSlipNumber++;
            showToast(`✅ Payment slip ${slipNo} saved!`);
            window._lastSavedSlipNo = slipNo;
        }
        _editingSlipIndex = null;
        saveAllData();
    }

    const win = window.open('', '_blank', 'width=480,height=680');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Payment Slip ${slipNo}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Inter',Arial,sans-serif;background:#F8FAFC;padding:24px;color:#0F172A;}
        .slip{background:#fff;max-width:400px;margin:0 auto;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.1);overflow:hidden;}
        .slip-header{background:linear-gradient(135deg,#0F2D4A,#1E4D8C);color:#fff;padding:20px 24px 16px;text-align:center;}
        .slip-header h1{font-size:16px;font-weight:800;color:#C9A84C;letter-spacing:0.5px;}
        .slip-header .sub{font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px;text-transform:uppercase;letter-spacing:1px;}
        .slip-body{padding:20px 24px;}
        .slip-no{text-align:center;background:#F1F5F9;border-radius:8px;padding:10px;margin-bottom:16px;}
        .slip-no .label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;font-weight:600;}
        .slip-no .value{font-size:15px;font-weight:800;color:#2563EB;margin-top:2px;}
        .amount-box{background:linear-gradient(135deg,#F0FDF4,#DCFCE7);border:2px solid #86EFAC;border-radius:12px;padding:16px;text-align:center;margin-bottom:16px;}
        .amount-box .label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#16A34A;font-weight:700;}
        .amount-box .value{font-size:32px;font-weight:800;color:#15803D;letter-spacing:-1px;margin-top:4px;}
        .info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13px;}
        .info-row:last-child{border-bottom:none;}
        .info-row .lbl{color:#94A3B8;font-weight:500;}
        .info-row .val{font-weight:700;color:#0F172A;text-align:right;}
        .method-badge{background:#DBEAFE;color:#1D4ED8;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;}
        .notes-box{background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:10px 12px;font-size:12px;color:#92400E;margin-top:12px;}
        .slip-footer{text-align:center;padding:14px 24px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8;}
        .print-btn{display:block;margin:16px auto 0;padding:10px 28px;background:#0F2D4A;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;}
        @media print{.print-btn{display:none;}body{background:white;padding:0;}.slip{box-shadow:none;border-radius:0;}}
    </style></head><body>
    <div class="slip">
        <div class="slip-header">
            <h1>Siriman Motor Works</h1>
            <div class="sub" style="font-style:italic;margin-top:2px;">Since 1958</div>
            <div class="sub">Payment Receipt</div>
        </div>
        <div class="slip-body">
            <div class="slip-no">
                <div class="label">Slip No</div>
                <div class="value">${slipNo}</div>
            </div>
            <div class="amount-box">
                <div class="label">Amount Received</div>
                <div class="value">Rs. ${fmtN(amtRaw)}</div>
            </div>
            <div class="info-row"><span class="lbl">Date</span><span class="val">${date}</span></div>
            <div class="info-row"><span class="lbl">Customer</span><span class="val">${c.name}</span></div>
            <div class="info-row"><span class="lbl">Vehicle</span><span class="val">${c.vehicleNo || '—'}</span></div>
            <div class="info-row"><span class="lbl">Contact</span><span class="val">${c.contacts || '—'}</span></div>
            ${refBill ? `<div class="info-row"><span class="lbl">Ref. Bill</span><span class="val">${refBill}</span></div>` : ''}
            <div class="info-row"><span class="lbl">Payment Method</span><span class="val"><span class="method-badge">${method}</span></span></div>
            ${notes ? `<div class="notes-box">📝 ${notes}</div>` : ''}
        </div>
        <div class="slip-footer">Thank you for your payment 🙏 · Siriman Motor Works</div>
    </div>
    <button class="print-btn" onclick="window.print()">🖨 Print Slip</button>
    </body></html>`);
    win.document.close();
}

// ── Payment History Page ──
function renderPaymentHistoryPage() {
    const html = `
        <div class="page-header">
            <div class="page-header-left">
                <div class="page-title">Payment History</div>
                <div class="page-subtitle">${paymentSlips.length} slip${paymentSlips.length !== 1 ? 's' : ''} in total</div>
            </div>
            <div class="page-header-actions">
                <button class="btn btn-primary" onclick="exportPaymentsToPDF()">
                    <span class="material-symbols-rounded">picture_as_pdf</span> Export PDF
                </button>
            </div>
        </div>

        <div class="search-section">
            <div style="display:grid;grid-template-columns:1fr 150px 150px auto;gap:12px;align-items:end;">
                <div class="search-input-wrapper">
                    <span class="search-icon material-symbols-rounded">search</span>
                    <input type="text" id="paySearch" placeholder="Search by Slip No, Customer or Vehicle No..." onkeyup="loadPaymentHistoryTable()">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:5px;">From</label>
                    <input type="date" id="payDateFrom" onchange="loadPaymentHistoryTable()" style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;color:var(--text-primary);background:var(--surface);outline:none;">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:5px;">To</label>
                    <input type="date" id="payDateTo" onchange="loadPaymentHistoryTable()" style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;color:var(--text-primary);background:var(--surface);outline:none;">
                </div>
                <button class="btn btn-secondary" onclick="document.getElementById('paySearch').value='';document.getElementById('payDateFrom').value='';document.getElementById('payDateTo').value='';loadPaymentHistoryTable();" style="align-self:end;">
                    <span class="material-symbols-rounded">filter_list_off</span> Clear
                </button>
            </div>
        </div>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Slip No</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Vehicle</th>
                        <th>Ref Bill</th>
                        <th>Method</th>
                        <th>Amount</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="paymentHistoryBody"></tbody>
            </table>
        </div>
    `;
    document.getElementById('pageContent').innerHTML = html;
    loadPaymentHistoryTable();
}

function loadPaymentHistoryTable() {
    const searchTerm = (document.getElementById('paySearch')?.value || '').toLowerCase();
    const dateFrom   = document.getElementById('payDateFrom')?.value;
    const dateTo     = document.getElementById('payDateTo')?.value;

    const filtered = paymentSlips.filter(s => {
        const matchText = s.slipNo.toLowerCase().includes(searchTerm) ||
                          s.customerName.toLowerCase().includes(searchTerm) ||
                          (s.vehicleNo || '').toLowerCase().includes(searchTerm);
        const d         = new Date(s.date);
        const matchFrom = dateFrom ? d >= new Date(dateFrom) : true;
        const matchTo   = dateTo   ? d <= new Date(dateTo + 'T23:59:59') : true;
        return matchText && matchFrom && matchTo;
    });

    const tbody = document.getElementById('paymentHistoryBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="8">
                <div class="empty-state">
                    <div class="empty-state-icon">💳</div>
                    <h4>${searchTerm ? 'No results found' : 'No payment slips yet'}</h4>
                    <p>${searchTerm ? 'Try a different search term.' : 'Save a payment slip to see it here.'}</p>
                    ${!searchTerm ? `<button class="btn btn-primary btn-sm" onclick="document.querySelector('[data-page=payment-slip]').click()">
                        <span class="material-symbols-rounded" style="font-size:14px;">add</span> New Payment Slip
                    </button>` : ''}
                </div>
            </td></tr>`;
        return;
    }

    const methodColors = { Cash:'#16A34A', 'Bank Transfer':'#2563EB', Cheque:'#D97706', Card:'#7C3AED', Online:'#0891B2' };

    let slipHtml = '';
    [...filtered].reverse().forEach(slip => {
        const idx   = paymentSlips.indexOf(slip);
        const color = methodColors[slip.method] || '#64748B';
        const isNew = window._lastSavedSlipNo && slip.slipNo === window._lastSavedSlipNo;
        slipHtml += `
            <tr class="clickable-row" onclick="viewSlipReceipt(${idx})" style="${isNew ? 'background:linear-gradient(90deg,#DCFCE7,var(--surface));border-left:3px solid #16A34A;' : ''}">
                <td>
                    <span class="badge badge-blue">${slip.slipNo}</span>
                    ${isNew ? ' <span class="badge" style="background:#DCFCE7;color:#16A34A;font-size:10px;">✦ New</span>' : ''}
                </td>
                <td class="td-muted">${new Date(slip.date).toLocaleDateString()}</td>
                <td>
                    <div style="font-weight:700;">${slip.customerName}</div>
                    <div style="font-size:12px;color:var(--text-muted);">${slip.customerPhone || ''}</div>
                </td>
                <td class="td-muted">${slip.vehicleNo || '—'}</td>
                <td class="td-muted">${slip.refBill || '—'}</td>
                <td><span class="badge" style="background:${color}22;color:${color};">${slip.method}</span></td>
                <td><strong style="color:#16A34A;font-size:14px;">Rs. ${fmtN(slip.amount)}</strong></td>
                <td>
                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); editPaymentSlip(${idx})" title="Edit slip">
                            <span class="material-symbols-rounded" style="font-size:14px;">edit</span>
                        </button>
                        <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); downloadSlipPDF(${idx})" title="Download PDF">
                            <span class="material-symbols-rounded" style="font-size:14px;">download</span>
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); printSlipRecord(${idx})" title="Print">
                            <span class="material-symbols-rounded" style="font-size:14px;">print</span>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deletePaymentSlip(${idx})" title="Delete">
                            <span class="material-symbols-rounded" style="font-size:14px;">delete</span>
                        </button>
                    </div>
                </td>
            </tr>`;
    });

    // Total row
    const total = filtered.reduce((s, x) => s + x.amount, 0);
    slipHtml += `
        <tr style="background:var(--surface-3);">
            <td colspan="6" style="text-align:right;font-weight:700;color:var(--text-secondary);font-size:13px;">Total Received (${filtered.length} slip${filtered.length !== 1 ? 's' : ''})</td>
            <td colspan="2"><strong style="color:#16A34A;font-size:15px;">Rs. ${fmtN(total)}</strong></td>
        </tr>`;
    tbody.innerHTML = slipHtml;
}

let _editingSlipIndex = null;

function editPaymentSlip(index) {
    const slip = paymentSlips[index];
    if (!slip) return;

    document.querySelector('.nav-btn[data-page="payment-slip"]').click();

    setTimeout(() => {
        _editingSlipIndex = index;
        const custSelect = document.getElementById('payCustomer');
        if (custSelect) {
            custSelect.value = slip.customerId;
            loadPayCustomerDetails();
            const c = customers.find(x => x.id == slip.customerId);
            if (c) {
                const si = document.getElementById('payCustSearch');
                if (si) si.value = c.name + (c.vehicleNo ? '  —  ' + c.vehicleNo : '');
                const clr = document.getElementById('payCustClear');
                if (clr) clr.style.display = 'block';
            }
        }

        setTimeout(() => {
            const refSelect = document.getElementById('slipRefBill');
            if (refSelect && slip.refBill) {
                const billIdx = bills.findIndex(b => b.billNo === slip.refBill);
                if (billIdx !== -1) refSelect.value = billIdx;
            }

            document.getElementById('slipNo').value   = slip.slipNo;
            document.getElementById('slipDate').value = new Date(slip.date).toLocaleDateString('en-GB').replace(/\//g, '/');

            const amtInput = document.getElementById('slipAmount');
            amtInput.value = slip.amount; fmtAmtInput(amtInput);

            document.getElementById('slipMethod').value = slip.method;
            document.getElementById('slipNotes').value  = slip.notes || '';

            showToast('✏️ Editing payment slip — save when done');
        }, 200);
    }, 150);
}

function viewSlipReceipt(index) {
    const slip = paymentSlips[index];
    if (!slip) return;
    
    const dateStr = new Date(slip.date).toLocaleDateString('en-GB').replace(/\//g, '/');
    const win = window.open('', '_blank', 'width=480,height=680');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Payment Slip ${slip.slipNo}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:'Inter',Arial,sans-serif;background:#F8FAFC;padding:24px;color:#0F172A;}
        .slip{background:#fff;max-width:400px;margin:0 auto;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.1);overflow:hidden;}
        .slip-header{background:linear-gradient(135deg,#0F2D4A,#1E4D8C);color:#fff;padding:20px 24px 16px;text-align:center;}
        .slip-header h1{font-size:16px;font-weight:800;color:#C9A84C;letter-spacing:0.5px;}
        .slip-header .sub{font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px;text-transform:uppercase;letter-spacing:1px;}
        .slip-body{padding:20px 24px;}
        .slip-no{text-align:center;background:#F1F5F9;border-radius:8px;padding:10px;margin-bottom:16px;}
        .slip-no .label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;font-weight:600;}
        .slip-no .value{font-size:15px;font-weight:800;color:#2563EB;margin-top:2px;}
        .amount-box{background:linear-gradient(135deg,#F0FDF4,#DCFCE7);border:2px solid #86EFAC;border-radius:12px;padding:16px;text-align:center;margin-bottom:16px;}
        .amount-box .label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#16A34A;font-weight:700;}
        .amount-box .value{font-size:32px;font-weight:800;color:#15803D;letter-spacing:-1px;margin-top:4px;}
        .info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13px;}
        .info-row:last-child{border-bottom:none;}
        .info-row .lbl{color:#94A3B8;font-weight:500;}
        .info-row .val{font-weight:700;color:#0F172A;text-align:right;}
        .method-badge{background:#DBEAFE;color:#1D4ED8;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;}
        .notes-box{background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:10px 12px;font-size:12px;color:#92400E;margin-top:12px;}
        .slip-footer{text-align:center;padding:14px 24px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8;}
        .print-btn{display:block;margin:16px auto 0;padding:10px 28px;background:#0F2D4A;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;}
        @media print{.print-btn{display:none;}body{background:white;padding:0;}.slip{box-shadow:none;border-radius:0;}}
    </style></head><body>
    <div class="slip">
        <div class="slip-header">
            <h1>Siriman Motor Works</h1>
            <div class="sub" style="font-style:italic;margin-top:2px;">Since 1958</div>
            <div class="sub">Payment Receipt</div>
        </div>
        <div class="slip-body">
            <div class="slip-no">
                <div class="label">Slip No</div>
                <div class="value">${slip.slipNo}</div>
            </div>
            <div class="amount-box">
                <div class="label">Amount Received</div>
                <div class="value">Rs. ${fmtN(slip.amount)}</div>
            </div>
            <div class="info-row"><span class="lbl">Date</span><span class="val">${dateStr}</span></div>
            <div class="info-row"><span class="lbl">Customer</span><span class="val">${slip.customerName}</span></div>
            <div class="info-row"><span class="lbl">Vehicle</span><span class="val">${slip.vehicleNo || '—'}</span></div>
            <div class="info-row"><span class="lbl">Contact</span><span class="val">${slip.customerPhone || '—'}</span></div>
            ${slip.refBill ? `<div class="info-row"><span class="lbl">Ref. Bill</span><span class="val">${slip.refBill}</span></div>` : ''}
            <div class="info-row"><span class="lbl">Payment Method</span><span class="val"><span class="method-badge">${slip.method}</span></span></div>
            ${slip.notes ? `<div class="notes-box">📝 ${slip.notes}</div>` : ''}
        </div>
        <div class="slip-footer">Thank you for your payment 🙏 · Siriman Motor Works</div>
    </div>
    <div style="text-align:center;">
        <button class="print-btn" onclick="window.print()" style="display:inline-block;">🖨 Print Slip</button>
        <button class="print-btn" onclick="window.close()" style="display:inline-block;background:#64748B;">Close</button>
    </div>
    </body></html>`);
    win.document.close();
}

function downloadSlipPDF(index) {
    const slip = paymentSlips[index];
    if (!slip) return;
    if (!window.jspdf) { showToast('⚠️ PDF library not loaded', 'error'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','mm','a4');
    const pw = 210, margin = 40, cw = pw - margin*2;
    let y = 20;

    // Header
    doc.setDrawColor(0); doc.setLineWidth(0.4);
    doc.rect(margin, y, cw, 26);
    doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(0);
    doc.text('Siriman Motor Works', margin+3, y+7);
    doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(100);
    doc.text('Since 1958', margin+3, y+12);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(0);
    doc.text('Daluwakotuwa, Kochchikade.', margin+3, y+16);
    doc.text('Tel: 031 227 7371  |  074 255 7371', margin+3, y+20);
    doc.text('Email: sirimanmortors58@gmail.com', margin+3, y+24);
    doc.setFont('helvetica','bold'); doc.setFontSize(16);
    doc.text('PAYMENT RECEIPT', pw-margin-3, y+8, {align:'right'});
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text(`Slip No: ${slip.slipNo}`, pw-margin-3, y+16, {align:'right'});
    doc.text(`Date: ${new Date(slip.date).toLocaleDateString('en-GB')}`, pw-margin-3, y+22, {align:'right'});
    y += 32;

    // Amount box
    doc.setFillColor(240,253,244); doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.rect(margin, y, cw, 18, 'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(0);
    doc.text('AMOUNT RECEIVED', pw/2, y+7, {align:'center'});
    doc.setFontSize(20);
    doc.text('Rs. '+fmtN(slip.amount), pw/2, y+15, {align:'center'});
    y += 24;

    // Info rows
    const rows = [
        ['Customer', slip.customerName],
        ['Vehicle', slip.vehicleNo || '—'],
        ['Contact', slip.customerPhone || '—'],
        ['Ref. Bill', slip.refBill || '—'],
        ['Payment Method', slip.method],
    ];
    doc.setLineWidth(0.2);
    rows.forEach(([lbl, val]) => {
        doc.setDrawColor(200); doc.line(margin, y, margin+cw, y);
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(120);
        doc.text(lbl, margin+2, y+5);
        doc.setFont('helvetica','bold'); doc.setTextColor(0);
        doc.text(val, margin+cw-2, y+5, {align:'right'});
        y += 9;
    });
    doc.setDrawColor(200); doc.line(margin, y, margin+cw, y);

    if (slip.notes) {
        y += 6; doc.setFont('helvetica','italic'); doc.setFontSize(8.5); doc.setTextColor(80);
        doc.text('Notes: '+slip.notes, margin, y, {maxWidth:cw});
        y += 8;
    }

    // Footer
    doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(80);
    doc.text('Thank you for your payment.', pw/2, 268, {align:'center'});
    doc.setFont('helvetica','bold'); doc.setTextColor(0);
    doc.text('Siriman Motor Works', pw/2, 273, {align:'center'});

    const sv = (slip.vehicleNo||'').replace(/[^a-zA-Z0-9\-]/g,'');
    const sn = (slip.customerName||'').replace(/[^a-zA-Z0-9 \-]/g,'').trim();
    const sd = new Date(slip.date).toLocaleDateString('en-GB').replace(/\//g,'-');
    doc.save(`PAY_${sv}_${sn}_${sd}.pdf`);
    showToast('📄 Payment slip PDF downloaded');
}

// ── Print Payment Slip ──
function printSlipRecord(index) {
    const slip = paymentSlips[index];
    if (!slip) return;
    const w = window.open('', '_blank', 'width=700,height=800');
    const date = new Date(slip.date).toLocaleDateString('en-GB');
    w.document.write(`<!DOCTYPE html><html><head><title>Payment Receipt ${slip.slipNo}</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:Arial,sans-serif;padding:32px;color:#000;font-size:15px;}
        .header{border:1.5px solid #000;padding:16px 20px;margin-bottom:20px;}
        .company{font-size:20px;font-weight:700;margin-bottom:4px;}
        .sub{font-size:13px;line-height:1.8;}
        .title{font-size:22px;font-weight:700;text-align:right;letter-spacing:2px;}
        .meta{text-align:right;font-size:13px;line-height:1.9;margin-top:4px;}
        .amount-box{border:1.5px solid #000;padding:16px 20px;text-align:center;margin:20px 0;}
        .amount-label{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
        .amount-val{font-size:28px;font-weight:800;}
        table{width:100%;border-collapse:collapse;margin-top:16px;}
        td{padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:14px;}
        td:first-child{color:#555;width:40%;}
        td:last-child{font-weight:600;}
        .footer{text-align:center;margin-top:28px;padding-top:14px;border-top:1px solid #000;font-size:13px;line-height:2;}
        .print-btn{display:block;margin:20px auto 0;padding:10px 28px;background:#000;color:#fff;border:none;font-size:14px;cursor:pointer;font-family:Arial;}
        @media print{.print-btn{display:none;}}
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;" class="header">
        <div>
            <div class="company">Siriman Motor Works</div>
            <div class="sub"><em>Since 1958</em><br>Daluwakotuwa, Kochchikade.<br>Tel: 031 227 7371 | 074 255 7371</div>
        </div>
        <div>
            <div class="title">PAYMENT RECEIPT</div>
            <div class="meta">Slip No: <strong>${slip.slipNo}</strong><br>Date: ${date}</div>
        </div>
    </div>
    <div class="amount-box">
        <div class="amount-label">Amount Received</div>
        <div class="amount-val">Rs. ${fmtN(slip.amount)}</div>
    </div>
    <table>
        <tr><td>Customer</td><td>${slip.customerName}</td></tr>
        <tr><td>Vehicle No</td><td>${slip.vehicleNo || '—'}</td></tr>
        <tr><td>Contact</td><td>${slip.customerPhone || '—'}</td></tr>
        <tr><td>Payment Method</td><td>${slip.method}</td></tr>
        <tr><td>Reference Bill</td><td>${slip.refBill || '—'}</td></tr>
    </table>
    <div class="footer">
        Thank you for your payment.<br>
        <strong>Siriman Motor Works</strong>
    </div>
    <button class="print-btn" onclick="window.print()">🖨 Print</button>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
}

function deletePaymentSlip(index) {
    openDeleteModal(() => {
        paymentSlips.splice(index, 1);
        saveAllData();
        loadPaymentHistoryTable();
        showToast('🗑 Payment slip deleted');
    });
}

function exportPaymentsToPDF() {
    if (!window.jspdf) { showToast('⚠️ PDF library not loaded', 'error'); return; }
    const searchTerm = (document.getElementById('paySearch')?.value || '').toLowerCase();
    const dateFrom   = document.getElementById('payDateFrom')?.value;
    const dateTo     = document.getElementById('payDateTo')?.value;

    const filtered = paymentSlips.filter(s => {
        const matchText = s.slipNo.toLowerCase().includes(searchTerm) ||
                          s.customerName.toLowerCase().includes(searchTerm) ||
                          (s.vehicleNo || '').toLowerCase().includes(searchTerm);
        const d         = new Date(s.date);
        const matchFrom = dateFrom ? d >= new Date(dateFrom) : true;
        const matchTo   = dateTo   ? d <= new Date(dateTo + 'T23:59:59') : true;
        return matchText && matchFrom && matchTo;
    });

    if (filtered.length === 0) { showToast('⚠️ No slips to export', 'error'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');

    doc.setFillColor(15, 45, 74);
    doc.rect(0, 0, 297, 22, 'F');
    doc.setTextColor(201, 168, 76);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Siriman Motor Works', 14, 10);
    doc.setFontSize(9); doc.setTextColor(255, 255, 255);
    doc.text('Payment History Report', 14, 17);

    const parts = [];
    if (searchTerm) parts.push(`Search: "${searchTerm}"`);
    if (dateFrom)   parts.push(`From: ${dateFrom}`);
    if (dateTo)     parts.push(`To: ${dateTo}`);
    if (parts.length) {
        doc.setFontSize(8); doc.setTextColor(100, 100, 100);
        doc.text('Filters: ' + parts.join('  |  '), 14, 28);
    }

    const startY = parts.length ? 33 : 28;
    const cols   = ['Slip No', 'Date', 'Customer', 'Vehicle', 'Ref Bill', 'Method', 'Amount (Rs.)'];
    const colW   = [32, 26, 55, 30, 35, 28, 38];
    let x = 14, y = startY;

    doc.setFillColor(30, 41, 59);
    doc.rect(14, y, 269, 8, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    cols.forEach((col, i) => { doc.text(col, x + 2, y + 5.5); x += colW[i]; });
    y += 8;

    doc.setFont('helvetica', 'normal');
    [...filtered].reverse().forEach((slip, ri) => {
        if (y > 185) { doc.addPage(); y = 14; }
        doc.setFillColor(ri % 2 === 0 ? 248 : 255, ri % 2 === 0 ? 250 : 255, ri % 2 === 0 ? 252 : 255);
        doc.rect(14, y, 269, 7, 'F');
        doc.setTextColor(15, 23, 42); doc.setFontSize(7.5);
        x = 14;
        [slip.slipNo, new Date(slip.date).toLocaleDateString(), slip.customerName,
         slip.vehicleNo || '—', slip.refBill || '—', slip.method, 'Rs. ' + fmtN(slip.amount)
        ].forEach((val, i) => { doc.text(String(val), x + 2, y + 4.8); x += colW[i]; });
        doc.setDrawColor(226, 232, 240);
        doc.line(14, y + 7, 283, y + 7);
        y += 7;
    });

    const total = filtered.reduce((s, x) => s + x.amount, 0);
    y += 4;
    doc.setFillColor(240, 253, 244); doc.rect(14, y, 269, 10, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(22, 163, 74);
    doc.text(`${filtered.length} slip${filtered.length !== 1 ? 's' : ''}  |  Total Received: Rs. ${fmtN(total)}`, 16, y + 6.5);

    doc.setFontSize(7); doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal');
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 205);
    doc.save(`payments_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('📄 PDF exported successfully');
}

// ── Delete Modal ──
let _deleteCallback = null;

function openDeleteModal(callback, msg) {
    _deleteCallback = callback;
    const msgEl = document.querySelector('#deleteModal .modal-body p');
    if (msgEl) msgEl.innerHTML = (msg || 'Are you sure you want to delete this record?') + ' This action <strong>cannot be undone</strong>.';
    document.getElementById('deletePassword').value = '';
    document.getElementById('deletePasswordError').style.display = 'none';
    document.getElementById('deleteModal').style.display = 'flex';
    setTimeout(() => document.getElementById('deletePassword').focus(), 100);
}

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    _deleteCallback = null;
    // Reset confirm button back to danger style
    const confirmBtn = document.querySelector('#deleteModal .btn-danger');
    if (confirmBtn) {
        confirmBtn.innerHTML = '<span class="material-symbols-rounded">delete_forever</span> Delete';
        confirmBtn.style.background = '';
        confirmBtn.style.boxShadow  = '';
    }
}

function confirmDelete() {
    const pwd = document.getElementById('deletePassword').value;
    const errEl = document.getElementById('deletePasswordError');
    if (pwd !== '123') {
        errEl.style.display = 'block';
        document.getElementById('deletePassword').value = '';
        document.getElementById('deletePassword').focus();
        return;
    }
    const cb = _deleteCallback;
    closeDeleteModal();
    if (cb) cb();
}

// ── System Info Panel ──
function toggleSysInfo() {
    const panel = document.getElementById('sysInfoPanel');
    if (!panel) return;

    if (panel.style.display !== 'none') {
        panel.style.display = 'none';
        return;
    }

    const dbSize = Math.round(JSON.stringify({ customers, bills, estimates, paymentSlips, bankAccounts }).length / 1024);
    const paidTotal   = bills.filter(b => b.paid).reduce((s, b) => s + b.total, 0);
    const unpaidTotal = bills.filter(b => !b.paid).reduce((s, b) => s + b.total, 0);
    const dbIndicator = document.getElementById('dbIndicator');
    const dbStatus    = dbIndicator ? dbIndicator.textContent.trim() : 'Unknown';

    document.getElementById('sysInfoContent').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;">
            <span style="color:rgba(255,255,255,0.5);">Customers</span>
            <span style="font-weight:600;">${customers.length}</span>
            <span style="color:rgba(255,255,255,0.5);">Total Bills</span>
            <span style="font-weight:600;">${bills.length}</span>
            <span style="color:rgba(255,255,255,0.5);">Cash Bills</span>
            <span style="font-weight:600;">${bills.filter(b=>(b.billType||'cash')==='cash').length}</span>
            <span style="color:rgba(255,255,255,0.5);">Credit Bills</span>
            <span style="font-weight:600;">${bills.filter(b=>b.billType==='credit').length}</span>
            <span style="color:rgba(255,255,255,0.5);">Estimates</span>
            <span style="font-weight:600;">${estimates.length}</span>
            <span style="color:rgba(255,255,255,0.5);">Payment Slips</span>
            <span style="font-weight:600;">${paymentSlips.length}</span>
            <span style="color:rgba(255,255,255,0.5);">Bank Accounts</span>
            <span style="font-weight:600;">${bankAccounts.length}</span>
            <span style="color:rgba(255,255,255,0.5);">DB Size</span>
            <span style="font-weight:600;">${dbSize} KB</span>
            <span style="color:rgba(255,255,255,0.5);">Storage</span>
            <span style="font-weight:600;">${dbStatus}</span>
            <span style="color:rgba(255,255,255,0.5);">Version</span>
            <span style="font-weight:600;">v2.0</span>
        </div>
    `;

    panel.style.display = 'block';
}

// Close sys info when clicking outside
document.addEventListener('click', e => {
    const panel = document.getElementById('sysInfoPanel');
    if (!panel) return;
    if (!e.target.closest('#sysInfoPanel') && !e.target.closest('[onclick="toggleSysInfo()"]')) {
        panel.style.display = 'none';
    }
});

// Start the application
init();
