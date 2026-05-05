// ==================== CUSTOMER MODULE ====================

function renderCustomersTable() {
    const filterType  = document.getElementById('filterType')?.value  || 'name';
    const filterValue = document.getElementById('filterValue')?.value.toLowerCase() || '';

    let filtered = [...customers];

    if (filterValue) {
        filtered = customers.filter(c => {
            switch (filterType) {
                case 'name':      return c.name.toLowerCase().includes(filterValue);
                case 'vehicleNo': return c.vehicleNo.toLowerCase().includes(filterValue);
                case 'model':     return (c.vehicleModel || '').toLowerCase().includes(filterValue);
                case 'brand':     return (c.brand || '').toLowerCase().includes(filterValue);
                case 'phone':     return c.contacts.toLowerCase().includes(filterValue);
                default:          return true;
            }
        });
    }

    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7">
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <h4>No customers found</h4>
                    <p>${filterValue ? 'Try a different search term.' : 'Add your first customer to get started.'}</p>
                    ${!filterValue ? `<button class="btn btn-primary btn-sm" onclick="openCustomerModal()">
                        <span class="material-symbols-rounded" style="font-size:14px;">person_add</span> Add Customer
                    </button>` : ''}
                </div>
            </td></tr>
        `;
    } else {
        filtered.forEach(customer => {
            const billCount = bills.filter(b => b.customerId === customer.id).length;
            const initials  = customer.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#2563EB,#7C3AED);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0;">
                            ${initials}
                        </div>
                        <div>
                            <div style="font-weight:700;color:var(--text-primary);font-size:13.5px;">${customer.name} ${customer.isCompany ? '<span class="badge" style="background:#EDE9FE;color:#7C3AED;font-size:10px;">🏢 Company</span>' : ''}</div>
                            <div style="font-size:11.5px;color:var(--text-muted);">${customer.address || ''}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="font-size:13px;color:var(--text-secondary);white-space:pre-line;">${customer.contacts}</div>
                </td>
                <td><span class="badge badge-blue">${customer.vehicleNo}</span></td>
                <td>
                    <div style="font-size:13px;font-weight:600;">${customer.vehicleModel || '—'}</div>
                    <div style="font-size:12px;color:var(--text-muted);">${customer.brand || ''}</div>
                </td>
                <td class="td-muted">${customer.address || '—'}</td>
                <td>
                    <span class="badge ${billCount > 0 ? 'badge-green' : 'badge-gray'}" 
                        style="${billCount > 0 ? 'cursor:pointer;' : ''}"
                        onclick="${billCount > 0 ? `viewCustomerBills(${customer.id})` : ''}"
                        title="${billCount > 0 ? 'Click to view bills' : 'No bills'}">
                        ${billCount} bill${billCount !== 1 ? 's' : ''}
                        ${billCount > 0 ? ' <span style="font-size:10px;">↗</span>' : ''}
                    </span>
                </td>
                <td>
                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-sm btn-secondary" onclick="editCustomer(${customer.id})" title="Edit customer">
                            <span class="material-symbols-rounded" style="font-size:14px;">edit</span>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${customer.id})" title="Delete customer">
                            <span class="material-symbols-rounded" style="font-size:14px;">delete</span>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    const countSpan = document.getElementById('filterCount');
    if (countSpan) {
        countSpan.innerHTML = filtered.length > 0
            ? `<span class="material-symbols-rounded" style="font-size:14px;vertical-align:middle;color:var(--accent)">check_circle</span> ${filtered.length} customer${filtered.length !== 1 ? 's' : ''} found`
            : '';
    }
}

function setCustomerType(type) {
    const isPerson = type === 'person';
    document.querySelector('input[name="customerType"][value="person"]').checked = isPerson;
    document.querySelector('input[name="customerType"][value="company"]').checked = !isPerson;

    document.getElementById('personFields').style.display  = isPerson ? '' : 'none';
    document.getElementById('companyFields').style.display = isPerson ? 'none' : '';

    const personLabel  = document.getElementById('typePersonLabel');
    const companyLabel = document.getElementById('typeCompanyLabel');
    personLabel.style.borderColor  = isPerson  ? '#2563EB' : 'var(--border)';
    personLabel.style.background   = isPerson  ? '#EFF6FF' : 'var(--surface)';
    companyLabel.style.borderColor = !isPerson ? '#7C3AED' : 'var(--border)';
    companyLabel.style.background  = !isPerson ? '#F5F3FF' : 'var(--surface)';

    document.getElementById('modalTitle').innerText = isPerson ? (window.editCustomerId ? 'Edit Customer' : 'Add Customer') : (window.editCustomerId ? 'Edit Company' : 'Add Company');
    document.getElementById('modalIcon').textContent = isPerson ? 'person_add' : 'business';
    document.getElementById('saveCustomerBtn').innerHTML = `<span class="material-symbols-rounded">save</span> Save ${isPerson ? 'Customer' : 'Company'}`;
}

function openCustomerModal() {
    window.editCustomerId = null;
    document.getElementById('customerForm').reset();
    setCustomerType('person');
    document.getElementById('customerTypeSelector').style.display = 'grid';
    document.getElementById('customerModal').style.display = 'flex';
    setTimeout(() => document.getElementById('custName')?.focus(), 250);
}

function closeCustomerModal() {
    document.getElementById('customerModal').style.display = 'none';
}

// ── Propagate customer data changes to all bills, estimates & payment slips ──
function propagateCustomerData(customerId) {
    const c = customers.find(x => x.id == customerId);
    if (!c) return;

    let count = 0;

    // Update all Bills referencing this customer
    bills.forEach(bill => {
        if (bill.customerId == customerId) {
            bill.customerName  = c.name;
            bill.customerPhone = c.contacts;
            bill.vehicleNo     = c.vehicleNo;
            bill.vehicleModel  = c.vehicleModel || '';
            bill.brand         = c.brand        || '';
            bill.engineNo      = c.engineNo     || '';
            bill.isCompany     = c.isCompany    || false;
            bill.companyAddress = c.companyAddress || '';
            count++;
        }
    });

    // Update all Estimates referencing this customer
    estimates.forEach(est => {
        if (est.customerId == customerId) {
            est.customerName  = c.name;
            est.customerPhone = c.contacts;
            est.vehicleNo     = c.vehicleNo;
            est.vehicleModel  = c.vehicleModel || '';
            est.brand         = c.brand        || '';
            est.engineNo      = c.engineNo     || '';
            est.isCompany     = c.isCompany    || false;
            est.companyAddress = c.companyAddress || '';
            count++;
        }
    });

    // Update all Payment Slips referencing this customer
    paymentSlips.forEach(slip => {
        if (slip.customerId == customerId) {
            slip.customerName  = c.name;
            slip.customerPhone = c.contacts;
            slip.vehicleNo     = c.vehicleNo;
            count++;
        }
    });

    if (count > 0) {
        console.log(`[Propagate] Updated ${count} document(s) for customer ID ${customerId}`);
    }
}

function saveCustomer(event) {
    event.preventDefault();
    const type = document.querySelector('input[name="customerType"]:checked')?.value || 'person';

    if (type === 'company') {
        const name      = document.getElementById('companyName').value.trim();
        const vehicleNo = document.getElementById('companyVehicleNo').value.trim().toUpperCase();
        const contacts  = document.getElementById('companyContacts').value.trim();
        const companyAddress = document.getElementById('companyAddress').value.trim();
        const address   = document.getElementById('companyNote').value.trim();

        if (!name)      { showToast('⚠️ Please enter company name', 'error'); return; }
        if (!vehicleNo) { showToast('⚠️ Please enter vehicle number', 'error'); return; }

        const entry = { id: window.editCustomerId || Date.now(), name, contacts, vehicleNo, vehicleModel: '', brand: '', companyAddress, address, isCompany: true, createdAt: new Date().toISOString() };

        if (window.editCustomerId) {
            const i = customers.findIndex(c => c.id === window.editCustomerId);
            if (i !== -1) { entry.createdAt = customers[i].createdAt; entry.updatedAt = new Date().toISOString(); customers[i] = entry; }
            propagateCustomerData(window.editCustomerId);
            showToast('✅ Company updated — all documents synced');
        } else {
            customers.push(entry);
            showToast('✅ Company added successfully');
        }
    } else {
        const name         = document.getElementById('custName').value.trim();
        const contacts     = document.getElementById('custContacts').value.trim();
        const vehicleNo    = document.getElementById('vehicleNo').value.trim().toUpperCase();
        const vehicleModel = document.getElementById('vehicleModel').value.trim();
        const brand        = document.getElementById('brand').value.trim();
        const address      = document.getElementById('address').value.trim();

        if (!name)      { showToast('⚠️ Please enter customer name', 'error');  return; }
        if (!vehicleNo) { showToast('⚠️ Please enter vehicle number', 'error'); return; }

        if (window.editCustomerId) {
            for (let i = 0; i < customers.length; i++) {
                if (customers[i].id === window.editCustomerId) {
                    customers[i] = { id: customers[i].id, name, contacts, vehicleNo, vehicleModel, brand, address, isCompany: false, createdAt: customers[i].createdAt, updatedAt: new Date().toISOString() };
                    break;
                }
            }
            propagateCustomerData(window.editCustomerId);
            showToast('✅ Customer updated — all documents synced');
        } else {
            customers.push({ id: Date.now(), name, contacts, vehicleNo, vehicleModel, brand, address, isCompany: false, createdAt: new Date().toISOString() });
            showToast('✅ Customer added successfully');
        }
    }

    saveAllData();
    closeCustomerModal();
    renderCustomersTable();
    loadCustomerSelect();
    if (typeof updateDashboard === 'function') updateDashboard();
}

function editCustomer(id) {
    const customer = customers.find(c => c.id === id);
    if (!customer) return;

    window.editCustomerId = id;
    document.getElementById('customerTypeSelector').style.display = 'none'; // hide type selector on edit
    document.getElementById('customerModal').style.display = 'flex';

    if (customer.isCompany) {
        setCustomerType('company');
        document.getElementById('companyName').value      = customer.name;
        document.getElementById('companyVehicleNo').value = customer.vehicleNo;
        document.getElementById('companyContacts').value  = customer.contacts || '';
        document.getElementById('companyAddress').value   = customer.companyAddress || '';
        document.getElementById('companyNote').value      = customer.address  || '';
    } else {
        setCustomerType('person');
        document.getElementById('custName').value     = customer.name;
        document.getElementById('custContacts').value = customer.contacts;
        document.getElementById('vehicleNo').value    = customer.vehicleNo;
        document.getElementById('vehicleModel').value = customer.vehicleModel || '';
        document.getElementById('brand').value        = customer.brand        || '';
        document.getElementById('address').value      = customer.address      || '';
    }
    setTimeout(() => document.getElementById(customer.isCompany ? 'companyName' : 'custName')?.focus(), 250);
}

function deleteCustomer(id) {
    const billCount = bills.filter(b => b.customerId === id).length;
    const msg = billCount > 0
        ? `This customer has ${billCount} bill${billCount !== 1 ? 's' : ''}. Are you sure you want to delete?`
        : 'Are you sure you want to delete this customer?';

    openDeleteModal(() => {
        customers = customers.filter(c => c.id !== id);
        saveAllData();
        renderCustomersTable();
        loadCustomerSelect();
        if (typeof updateDashboard === 'function') updateDashboard();
        showToast('🗑 Customer deleted');
    }, msg);
}

function clearFilters() {
    const ft = document.getElementById('filterType');
    const fv = document.getElementById('filterValue');
    if (ft) ft.value = 'name';
    if (fv) fv.value = '';
    renderCustomersTable();
}

function exportCustomersToPDF() {
    if (!window.jspdf) { showToast('⚠️ PDF library not loaded', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.setTextColor(37, 99, 235);
    doc.text('GaragePro — Customer Report', 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
    doc.text(`Total Customers: ${customers.length}`, 14, 32);

    let y = 44;
    const cols = ['Name', 'Contact', 'Vehicle No', 'Model', 'Brand', 'Engine'];
    const colW = [50, 45, 35, 35, 35, 40];

    // Header
    doc.setFillColor(37, 99, 235);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    let x = 14;
    cols.forEach((col, i) => {
        doc.rect(x, y, colW[i], 8, 'F');
        doc.text(col, x + 3, y + 5.5);
        x += colW[i];
    });

    doc.setTextColor(15, 23, 42);
    y += 10;

    customers.forEach((c, rowIdx) => {
        if (y > 190) { doc.addPage(); y = 20; }
        if (rowIdx % 2 === 0) {
            doc.setFillColor(241, 245, 249);
            doc.rect(14, y - 1, colW.reduce((a, b) => a + b, 0), 8, 'F');
        }
        x = 14;
        const vals = [
            c.name.substring(0, 20),
            c.contacts.substring(0, 18),
            c.vehicleNo,
            (c.vehicleModel || '—').substring(0, 12),
            (c.brand || '—').substring(0, 12),
            (c.engineNo || '—').substring(0, 14)
        ];
        doc.setFontSize(9);
        vals.forEach((val, i) => {
            doc.text(val, x + 3, y + 5);
            x += colW[i];
        });
        y += 8;
    });

    doc.save(`customers_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('📄 PDF exported successfully');
}

function loadCustomerSelect() {
    const select = document.getElementById('billCustomer');
    if (!select) return;
    select.innerHTML = '<option value="">— Select Customer —</option>';
    customers.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name} · ${c.vehicleNo}</option>`;
    });
}

function loadBillCustomerDetails() {
    const id        = document.getElementById('billCustomer').value;
    const container = document.getElementById('billCustomerDetails');
    if (!container) return;

    if (id) {
        const customer = customers.find(c => c.id == id);
        if (customer) {
            const initials = customer.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
            container.innerHTML = `
                <div class="customer-info-strip">
                    <div class="avatar">${customer.isCompany ? '🏢' : initials}</div>
                    <div class="info">
                        <div class="name">${customer.name}${customer.isCompany ? ' <span style="font-size:11px;background:#EDE9FE;color:#7C3AED;padding:1px 7px;border-radius:10px;font-weight:600;">Company</span>' : ''}</div>
                        <div class="details">
                            📞 ${customer.contacts || '—'} &nbsp;·&nbsp;
                            🚗 ${customer.vehicleNo}
                            ${customer.vehicleModel ? ` &nbsp;·&nbsp; ${customer.vehicleModel} ${customer.brand || ''}` : ''}
                            ${customer.address ? `<br>📝 ${customer.address}` : ''}
                        </div>
                    </div>
                </div>
            `;
            const regSelect = document.getElementById('billRegNo');
            if (regSelect) regSelect.value = id;
            return;
        }
    }
    container.innerHTML = '';
}

// ── Toast Notification ──
function showToast(message, type = 'success') {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'all 0.3s ease';
        toast.style.opacity    = '0';
        toast.style.transform  = 'translateX(20px)';
        setTimeout(() => toast.remove(), 320);
    }, 2200);
}

function viewCustomerBills(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const custBills = bills.filter(b => b.customerId === customerId).slice().reverse();
    const totalAmt  = custBills.reduce((s, b) => s + b.total, 0);
    const paidAmt   = custBills.filter(b => b.paid).reduce((s, b) => s + b.total, 0);
    const unpaidAmt = totalAmt - paidAmt;

    const rows = custBills.map(b => {
        const idx = bills.indexOf(b);
        return `<tr>
            <td><span class="badge badge-blue">${b.billNo}</span>
                ${b.paid ? '<span class="badge" style="background:#DCFCE7;color:#16A34A;font-size:10px;margin-left:4px;">✓ Paid</span>' : '<span class="badge" style="background:#FEE2E2;color:#DC2626;font-size:10px;margin-left:4px;">Unpaid</span>'}
            </td>
            <td class="td-muted">${new Date(b.date).toLocaleDateString()}</td>
            <td>${(b.billType||'cash')==='cash'
                ? '<span class="badge" style="background:#DCFCE7;color:#16A34A;font-size:10px;">💵 Cash</span>'
                : '<span class="badge" style="background:#EDE9FE;color:#7C3AED;font-size:10px;">💳 Credit</span>'}</td>
            <td><strong style="color:${b.paid?'#16A34A':'var(--primary)'}">Rs. ${fmtN(b.total)}</strong></td>
            <td><strong style="color:${(b.balance===0||b.paid)?'#16A34A':'#DC2626'}">Rs. ${fmtN(b.balance||0)}</strong></td>
            <td>
                <div style="display:flex;gap:5px;">
                    <button class="btn btn-sm btn-secondary" onclick="printBill(${idx})" title="Print">
                        <span class="material-symbols-rounded" style="font-size:13px;">print</span>
                    </button>
                    <button class="btn btn-sm btn-success" onclick="downloadBill(${idx})" title="Download">
                        <span class="material-symbols-rounded" style="font-size:13px;">download</span>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');

    // Build modal content
    const modal = document.getElementById('customerBillsModal');
    document.getElementById('customerBillsTitle').textContent = `${customer.name} — Bills`;
    document.getElementById('customerBillsSubtitle').innerHTML = `
        <span class="badge badge-blue" style="margin-right:6px;">${custBills.length} bill${custBills.length!==1?'s':''}</span>
        <span style="color:#16A34A;font-weight:600;">Paid: Rs. ${fmtN(paidAmt,0)}</span>
        &nbsp;·&nbsp;
        <span style="color:#DC2626;font-weight:600;">Unpaid: Rs. ${fmtN(unpaidAmt,0)}</span>
        &nbsp;·&nbsp;
        <span style="font-weight:600;">Total: Rs. ${fmtN(totalAmt,0)}</span>
    `;
    document.getElementById('customerBillsBody').innerHTML = rows ||
        '<tr><td colspan="6"><div class="empty-state" style="padding:20px"><p>No bills found</p></div></td></tr>';
    modal.style.display = 'flex';
}

function closeCustomerBillsModal() {
    document.getElementById('customerBillsModal').style.display = 'none';
}
