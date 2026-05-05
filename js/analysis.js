let _charts = {};

function renderAnalysisPage(period, tab) {
    tab    = tab    || localStorage.getItem('analysisTab') || 'analysis';
    period = period || 'month';
    localStorage.setItem('analysisTab', tab);

    if (tab === 'accounts') {
        renderAccountsTab(period);
        return;
    }
    _renderAnalysisTab(period);
}

function _renderAnalysisTab(period) {
    const now        = new Date();
    const todayStr   = now.toDateString();
    const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);

    function inPeriod(dateStr) {
        const d = new Date(dateStr);
        if (period === 'today') return d.toDateString() === todayStr;
        if (period === 'week')  return d >= weekStart;
        if (period === 'month') return d >= monthStart;
        if (period === 'year')  return d >= yearStart;
        return true;
    }

    const fb       = bills.filter(b => inPeriod(b.date));
    const cashB    = fb.filter(b => (b.billType||'cash') === 'cash');
    const creditB  = fb.filter(b => b.billType === 'credit');
    const paidB    = fb.filter(b => b.paid);
    const unpaidB  = fb.filter(b => !b.paid);
    const fe       = estimates.filter(e => inPeriod(e.date));
    const fp       = paymentSlips.filter(p => inPeriod(p.date));

    const totalIncome  = paidB.reduce((s,b) => s+b.total, 0);
    const totalPending = unpaidB.reduce((s,b) => s+b.total, 0);
    const cashTotal    = cashB.reduce((s,b) => s+b.total, 0);
    const creditTotal  = creditB.reduce((s,b) => s+b.total, 0);
    const estTotal     = fe.reduce((s,e) => s+e.total, 0);
    const payTotal     = fp.reduce((s,p) => s+p.amount, 0);

    // Daily chart — last 14 days
    const days = Array.from({length:14},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(13-i)); return d; });
    const dayLabels  = days.map(d=>d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}));
    const dayIncome  = days.map(d=>bills.filter(b=>new Date(b.date).toDateString()===d.toDateString()&&b.paid).reduce((s,b)=>s+b.total,0));
    const dayPending = days.map(d=>bills.filter(b=>new Date(b.date).toDateString()===d.toDateString()&&!b.paid).reduce((s,b)=>s+b.total,0));

    // Monthly chart — last 6 months
    const months = Array.from({length:6},(_,i)=>{ const d=new Date(); d.setMonth(d.getMonth()-(5-i)); return d; });
    const monthLabels = months.map(d=>d.toLocaleDateString('en-GB',{month:'short',year:'2-digit'}));
    const monthIncome = months.map(d=>bills.filter(b=>{ const bd=new Date(b.date); return bd.getMonth()===d.getMonth()&&bd.getFullYear()===d.getFullYear()&&b.paid; }).reduce((s,b)=>s+b.total,0));
    const monthEst    = months.map(d=>estimates.filter(e=>{ const ed=new Date(e.date); return ed.getMonth()===d.getMonth()&&ed.getFullYear()===d.getFullYear(); }).reduce((s,e)=>s+e.total,0));

    // Alerts
    let alerts = '';
    if (totalPending > 50000) alerts += `<div style="background:#FEF2F2;border-left:4px solid #DC2626;border-radius:8px;padding:12px 16px;margin-bottom:12px;display:flex;align-items:center;gap:10px;font-size:13.5px;color:#DC2626;"><span class="material-symbols-rounded">warning</span><strong>High Pending Credits:</strong>&nbsp;Rs. ${fmtN(totalPending)} outstanding — follow up required.</div>`;
    const lowDays = days.filter((d,i)=>dayIncome[i]===0&&d.getDay()!==0).length;
    if (lowDays > 5) alerts += `<div style="background:#FFFBEB;border-left:4px solid #D97706;border-radius:8px;padding:12px 16px;margin-bottom:12px;display:flex;align-items:center;gap:10px;font-size:13.5px;color:#D97706;"><span class="material-symbols-rounded">trending_down</span><strong>Low Income Days:</strong>&nbsp;${lowDays} days with no income in the last 2 weeks.</div>`;

    // Top customers
    const custMap = {};
    fb.forEach(b=>{ if(!custMap[b.customerName]) custMap[b.customerName]={count:0,total:0,vehicle:b.vehicleNo}; custMap[b.customerName].count++; custMap[b.customerName].total+=b.total; });
    const topCusts = Object.entries(custMap).sort((a,b)=>b[1].total-a[1].total).slice(0,5);

    const periodBtns = ['today','week','month','year','all'].map(p=>`
        <button onclick="renderAnalysisPage('${p}')" class="btn btn-sm ${period===p?'btn-primary':'btn-secondary'}">
            ${p==='today'?'Today':p==='week'?'This Week':p==='month'?'This Month':p==='year'?'This Year':'All Time'}
        </button>`).join('');

    const tabBar = `
        <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:24px;background:var(--surface);border-radius:var(--radius) var(--radius) 0 0;overflow-x:auto;">
            <button onclick="renderAnalysisPage('${period}','analysis')"
                style="padding:12px 22px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:600;color:var(--primary);border-bottom:2px solid var(--primary);white-space:nowrap;">
                <span class="material-symbols-rounded" style="font-size:15px;vertical-align:-3px;margin-right:5px;">analytics</span>Analysis
            </button>
            <button onclick="renderAnalysisPage('${period}','accounts')"
                style="padding:12px 22px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:600;color:var(--text-muted);border-bottom:2px solid transparent;white-space:nowrap;">
                <span class="material-symbols-rounded" style="font-size:15px;vertical-align:-3px;margin-right:5px;">account_balance</span>Accounts
            </button>
        </div>`;

    const html = `
        ${tabBar}
        <!-- Period + Export -->
        <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">
            ${periodBtns}
            <div style="margin-left:auto;display:flex;gap:8px;">
                <button class="btn btn-sm btn-secondary" onclick="printAnalysisReport('${period}')">
                    <span class="material-symbols-rounded" style="font-size:14px;">print</span> Print
                </button>
                <button class="btn btn-sm btn-success" onclick="exportAnalysisPDF('${period}')">
                    <span class="material-symbols-rounded" style="font-size:14px;">picture_as_pdf</span> PDF
                </button>
                <button class="btn btn-sm btn-secondary" onclick="exportAnalysisCSV('${period}')">
                    <span class="material-symbols-rounded" style="font-size:14px;">table_chart</span> CSV
                </button>
                <button class="btn btn-sm btn-secondary" onclick="exportAllData()">
                    <span class="material-symbols-rounded" style="font-size:14px;">download</span> Export All
                </button>
            </div>
        </div>

        ${alerts}

        <!-- Summary Cards -->
        <div class="stats-grid" style="margin-bottom:20px;">
            <div class="stat-card green" style="cursor:pointer;" onclick="showAnalysisDetail('paid','${period}')">
                <div class="stat-card-icon"><span class="material-symbols-rounded">payments</span></div>
                <h3>Total Income</h3>
                <div class="number" style="font-size:${totalIncome>999999?'18px':'26px'}">Rs. ${fmtN(totalIncome,0)}</div>
                <div class="change" style="color:#16A34A"><span class="material-symbols-rounded" style="font-size:13px;">check_circle</span> ${paidB.length} paid bills · Click to view</div>
            </div>
            <div class="stat-card" style="border-left:4px solid #EF4444;cursor:pointer;" onclick="showAnalysisDetail('unpaid','${period}')">
                <div class="stat-card-icon" style="background:#FEE2E2;"><span class="material-symbols-rounded" style="color:#DC2626;">pending</span></div>
                <h3>Pending Credits</h3>
                <div class="number" style="font-size:${totalPending>999999?'18px':'26px'};color:#DC2626;">Rs. ${fmtN(totalPending,0)}</div>
                <div class="change" style="color:#DC2626"><span class="material-symbols-rounded" style="font-size:13px;">warning</span> ${unpaidB.length} unpaid · Click to view</div>
            </div>
            <div class="stat-card blue" style="cursor:pointer;" onclick="showAnalysisDetail('cash','${period}')">
                <div class="stat-card-icon"><span class="material-symbols-rounded">point_of_sale</span></div>
                <h3>Cash Bills</h3>
                <div class="number" style="font-size:${cashTotal>999999?'18px':'26px'}">Rs. ${fmtN(cashTotal,0)}</div>
                <div class="change" style="color:var(--primary)"><span class="material-symbols-rounded" style="font-size:13px;">receipt_long</span> ${cashB.length} bills · Click to view</div>
            </div>
            <div class="stat-card purple" style="cursor:pointer;" onclick="showAnalysisDetail('credit','${period}')">
                <div class="stat-card-icon"><span class="material-symbols-rounded">credit_card</span></div>
                <h3>Credit Bills</h3>
                <div class="number" style="font-size:${creditTotal>999999?'18px':'26px'};color:#7C3AED;">Rs. ${fmtN(creditTotal,0)}</div>
                <div class="change" style="color:#7C3AED"><span class="material-symbols-rounded" style="font-size:13px;">credit_score</span> ${creditB.length} bills · Click to view</div>
            </div>
            <div class="stat-card orange" style="cursor:pointer;" onclick="showAnalysisDetail('estimates','${period}')">
                <div class="stat-card-icon"><span class="material-symbols-rounded">request_quote</span></div>
                <h3>Estimates Value</h3>
                <div class="number" style="font-size:${estTotal>999999?'18px':'26px'}">Rs. ${fmtN(estTotal,0)}</div>
                <div class="change" style="color:#D97706"><span class="material-symbols-rounded" style="font-size:13px;">description</span> ${fe.length} estimates · Click to view</div>
            </div>
            <div class="stat-card green" style="cursor:pointer;" onclick="showAnalysisDetail('payments','${period}')">
                <div class="stat-card-icon" style="background:#DCFCE7;"><span class="material-symbols-rounded" style="color:#16A34A;">account_balance_wallet</span></div>
                <h3>Payments Received</h3>
                <div class="number" style="font-size:${payTotal>999999?'18px':'26px'}">Rs. ${fmtN(payTotal,0)}</div>
                <div class="change" style="color:#16A34A"><span class="material-symbols-rounded" style="font-size:13px;">payments</span> ${fp.length} slips · Click to view</div>
            </div>
        </div>

        <!-- Charts -->
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:20px;">
            <div class="bill-card" style="padding:20px;">
                <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
                    <span class="material-symbols-rounded" style="color:var(--primary)">bar_chart</span> Daily Income — Last 14 Days
                </div>
                <canvas id="dailyChart" height="110"></canvas>
            </div>
            <div class="bill-card" style="padding:20px;">
                <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
                    <span class="material-symbols-rounded" style="color:#7C3AED">donut_large</span> Cash vs Credit
                </div>
                <canvas id="typeChart" height="140"></canvas>
            </div>
        </div>

        <div class="bill-card" style="padding:20px;margin-bottom:20px;">
            <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
                <span class="material-symbols-rounded" style="color:#16A34A">show_chart</span> Monthly Revenue vs Estimates — Last 6 Months
            </div>
            <canvas id="monthlyChart" height="70"></canvas>
        </div>

        <!-- Top Customers + Pending -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
            <div class="bill-card">
                <div class="bill-card-header"><h3><span class="material-symbols-rounded" style="color:var(--primary)">people</span> Top Customers</h3></div>
                <div class="table-container" style="border:none;border-radius:0;">
                    <table><thead><tr><th>Customer</th><th>Vehicle</th><th>Bills</th><th>Total</th></tr></thead>
                    <tbody>${topCusts.length ? topCusts.map(([name,d])=>`<tr>
                        <td><strong>${name}</strong></td>
                        <td class="td-muted">${d.vehicle||'—'}</td>
                        <td class="td-muted">${d.count}</td>
                        <td><strong style="color:var(--primary)">Rs. ${fmtN(d.total,0)}</strong></td>
                    </tr>`).join('') : '<tr><td colspan="4"><div class="empty-state" style="padding:16px"><p>No data</p></div></td></tr>'}</tbody>
                    </table>
                </div>
            </div>
            <div class="bill-card">
                <div class="bill-card-header"><h3><span class="material-symbols-rounded" style="color:#DC2626">pending</span> Pending Credits</h3></div>
                <div class="table-container" style="border:none;border-radius:0;">
                    <table><thead><tr><th>Bill No</th><th>Customer</th><th>Amount</th></tr></thead>
                    <tbody>${unpaidB.length ? unpaidB.slice(0,5).map(b=>`<tr>
                        <td><span class="badge badge-blue">${b.billNo}</span></td>
                        <td>${b.customerName}</td>
                        <td><strong style="color:#DC2626">Rs. ${fmtN(b.total,0)}</strong></td>
                    </tr>`).join('') : '<tr><td colspan="3"><div class="empty-state" style="padding:16px"><p>No pending credits 🎉</p></div></td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Detail Panel -->
        <div id="analysisDetailPanel" style="display:none;margin-bottom:20px;">
            <div class="bill-card">
                <div class="bill-card-header">
                    <h3 id="analysisDetailTitle" style="display:flex;align-items:center;gap:8px;"></h3>
                    <div style="display:flex;gap:8px;">
                        <input type="text" id="analysisSearch" placeholder="Search..." onkeyup="filterAnalysisDetail()"
                            style="padding:7px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;color:var(--text-primary);background:var(--surface-3);outline:none;width:200px;">
                        <button class="btn btn-sm btn-secondary" onclick="document.getElementById('analysisDetailPanel').style.display='none'">
                            <span class="material-symbols-rounded" style="font-size:14px;">close</span>
                        </button>
                    </div>
                </div>
                <div class="table-container" style="border:none;border-radius:0;max-height:400px;overflow-y:auto;">
                    <table id="analysisDetailTable"><tbody id="analysisDetailBody"></tbody></table>
                </div>
            </div>
        </div>
    `;

    document.getElementById('pageContent').innerHTML = html;

    // Destroy old charts
    Object.values(_charts).forEach(c => { try { c.destroy(); } catch(e){} });
    _charts = {};

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gc = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const tc = isDark ? '#94A3B8' : '#64748B';

    if (window.Chart) {
        _charts.daily = new Chart(document.getElementById('dailyChart'), {
            type: 'bar',
            data: { labels: dayLabels, datasets: [
                { label:'Paid', data:dayIncome,  backgroundColor:'rgba(34,197,94,0.75)', borderRadius:4 },
                { label:'Unpaid', data:dayPending, backgroundColor:'rgba(239,68,68,0.5)',  borderRadius:4 }
            ]},
            options: { responsive:true, plugins:{legend:{labels:{color:tc}}},
                scales:{ x:{stacked:true,ticks:{color:tc},grid:{color:gc}}, y:{stacked:true,ticks:{color:tc,callback:v=>'Rs.'+fmtN(v,0)},grid:{color:gc}} } }
        });

        _charts.type = new Chart(document.getElementById('typeChart'), {
            type: 'doughnut',
            data: { labels:['Cash','Credit'], datasets:[{data:[cashTotal,creditTotal],backgroundColor:['#22C55E','#7C3AED'],borderWidth:0}] },
            options: { responsive:true, cutout:'65%',
                plugins:{ legend:{position:'bottom',labels:{color:tc}}, tooltip:{callbacks:{label:ctx=>' Rs. '+fmtN(ctx.raw,0)}} } }
        });

        _charts.monthly = new Chart(document.getElementById('monthlyChart'), {
            type: 'line',
            data: { labels:monthLabels, datasets:[
                { label:'Revenue', data:monthIncome, borderColor:'#2563EB', backgroundColor:'rgba(37,99,235,0.1)', fill:true, tension:0.4, pointBackgroundColor:'#2563EB', pointRadius:5 },
                { label:'Estimates', data:monthEst, borderColor:'#D97706', backgroundColor:'rgba(217,119,6,0.08)', fill:true, tension:0.4, pointBackgroundColor:'#D97706', pointRadius:4, borderDash:[4,4] }
            ]},
            options: { responsive:true, plugins:{legend:{labels:{color:tc}}},
                scales:{ x:{ticks:{color:tc},grid:{color:gc}}, y:{ticks:{color:tc,callback:v=>'Rs.'+fmtN(v,0)},grid:{color:gc}} } }
        });
    }
}

// ── Accounts Tab ─────────────────────────────────────────
function renderAccountsTab(period) {
    period = period || localStorage.getItem('acctPeriod') || 'all';
    const billTab = localStorage.getItem('acctBillTab') || 'cash';
    localStorage.setItem('acctPeriod', period);

    const now        = new Date();
    const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);

    function inPeriod(d) {
        const dt = new Date(d);
        if (period === 'today') return dt.toDateString() === now.toDateString();
        if (period === 'week')  return dt >= weekStart;
        if (period === 'month') return dt >= monthStart;
        if (period === 'year')  return dt >= yearStart;
        return true;
    }

    const cashBills   = bills.filter(b => (b.billType||'cash') === 'cash'   && inPeriod(b.date));
    const creditBills = bills.filter(b => b.billType === 'credit'            && inPeriod(b.date));
    const cashTotal   = cashBills.reduce((s,b)   => s + b.total, 0);
    const creditTotal = creditBills.reduce((s,b) => s + b.total, 0);
    const creditUnpaid = creditBills.filter(b => !b.paid).reduce((s,b) => s + (b.balance ?? b.total), 0);

    const periodBtns = ['today','week','month','year','all'].map(p =>
        `<button onclick="renderAccountsTab('${p}')" class="btn btn-sm ${period===p?'btn-primary':'btn-secondary'}" style="font-size:12px;">
            ${p==='today'?'Today':p==='week'?'Week':p==='month'?'Month':p==='year'?'Year':'All'}
        </button>`).join('');

    const tabBar = `
        <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:24px;background:var(--surface);border-radius:var(--radius) var(--radius) 0 0;overflow-x:auto;">
            <button onclick="renderAnalysisPage(null,'analysis')"
                style="padding:12px 22px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:600;color:var(--text-muted);border-bottom:2px solid transparent;white-space:nowrap;">
                <span class="material-symbols-rounded" style="font-size:15px;vertical-align:-3px;margin-right:5px;">analytics</span>Analysis
            </button>
            <button onclick="renderAnalysisPage(null,'accounts')"
                style="padding:12px 22px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:600;color:var(--primary);border-bottom:2px solid var(--primary);white-space:nowrap;">
                <span class="material-symbols-rounded" style="font-size:15px;vertical-align:-3px;margin-right:5px;">account_balance</span>Accounts
            </button>
        </div>`;

    document.getElementById('pageContent').innerHTML = `
        ${tabBar}

        <!-- Header -->
        <div class="page-header" style="margin-bottom:20px;">
            <div class="page-header-left">
                <div class="page-title">Accounts</div>
                <div class="page-subtitle">Bill records by payment type</div>
            </div>
            <div class="page-header-actions">
                <button class="btn btn-secondary" onclick="_acctPrintAll('${period}')">
                    <span class="material-symbols-rounded">print</span> Print All
                </button>
                <button class="btn btn-success" onclick="_acctExportPDF('${period}')">
                    <span class="material-symbols-rounded">picture_as_pdf</span> Export PDF
                </button>
            </div>
        </div>

        <!-- Summary Cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
            <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:18px 20px;border-left:4px solid #16A34A;">
                <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Cash Bills</div>
                <div style="font-size:22px;font-weight:800;color:#16A34A;">Rs. ${fmtN(cashTotal,0)}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${cashBills.length} bill${cashBills.length!==1?'s':''}</div>
            </div>
            <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:18px 20px;border-left:4px solid #7C3AED;">
                <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Credit Bills</div>
                <div style="font-size:22px;font-weight:800;color:#7C3AED;">Rs. ${fmtN(creditTotal,0)}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${creditBills.length} bill${creditBills.length!==1?'s':''}</div>
            </div>
            <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:18px 20px;border-left:4px solid #DC2626;">
                <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Outstanding Balance</div>
                <div style="font-size:22px;font-weight:800;color:#DC2626;">Rs. ${fmtN(creditUnpaid,0)}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${creditBills.filter(b=>!b.paid).length} unpaid credit bills</div>
            </div>
            <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:18px 20px;border-left:4px solid #2563EB;">
                <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Total Billed</div>
                <div style="font-size:22px;font-weight:800;color:#2563EB;">Rs. ${fmtN(cashTotal+creditTotal,0)}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${cashBills.length+creditBills.length} total bills</div>
            </div>
        </div>

        <!-- Filters -->
        <div class="bill-card" style="padding:16px 20px;margin-bottom:20px;">
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
                <div style="display:flex;gap:6px;flex-wrap:wrap;">${periodBtns}</div>
                <div style="display:flex;gap:8px;margin-left:auto;flex-wrap:wrap;align-items:center;">
                    <select id="acctPaidFilter" onchange="_acctRender()"
                        style="padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;color:var(--text-primary);background:var(--surface-3);outline:none;cursor:pointer;">
                        <option value="">All Status</option>
                        <option value="paid">✓ Paid</option>
                        <option value="unpaid">Unpaid</option>
                    </select>
                    <input type="date" id="acctFrom" onchange="_acctRender()" style="padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;color:var(--text-primary);background:var(--surface-3);outline:none;">
                    <span style="color:var(--text-muted);font-size:13px;">to</span>
                    <input type="date" id="acctTo" onchange="_acctRender()" style="padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;color:var(--text-primary);background:var(--surface-3);outline:none;">
                    <div style="position:relative;">
                        <span class="material-symbols-rounded" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:16px;pointer-events:none;">search</span>
                        <input type="text" id="acctSearch" placeholder="Search bills..." oninput="_acctRender()"
                            style="padding:8px 12px 8px 34px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;color:var(--text-primary);background:var(--surface-3);outline:none;width:200px;">
                    </div>
                    <button class="btn btn-sm btn-secondary" onclick="document.getElementById('acctFrom').value='';document.getElementById('acctTo').value='';document.getElementById('acctSearch').value='';document.getElementById('acctPaidFilter').value='';_acctRender();">
                        <span class="material-symbols-rounded" style="font-size:14px;">filter_list_off</span> Clear
                    </button>
                </div>
            </div>
        </div>

        <!-- Bill Type Tabs -->
        <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:0;">
            <button id="acctTabCash" onclick="_acctSetTab('cash')"
                style="padding:11px 24px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:700;color:${billTab==='cash'?'#16A34A':'var(--text-muted)'};border-bottom:${billTab==='cash'?'2px solid #16A34A':'2px solid transparent'};margin-bottom:-2px;display:flex;align-items:center;gap:7px;">
                <span class="material-symbols-rounded" style="font-size:16px;">point_of_sale</span> Cash Bills
                <span style="background:${billTab==='cash'?'#DCFCE7':'var(--surface-3)'};color:${billTab==='cash'?'#16A34A':'var(--text-muted)'};font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">${cashBills.length}</span>
            </button>
            <button id="acctTabCredit" onclick="_acctSetTab('credit')"
                style="padding:11px 24px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:700;color:${billTab==='credit'?'#7C3AED':'var(--text-muted)'};border-bottom:${billTab==='credit'?'2px solid #7C3AED':'2px solid transparent'};margin-bottom:-2px;display:flex;align-items:center;gap:7px;">
                <span class="material-symbols-rounded" style="font-size:16px;">credit_card</span> Credit Bills
                <span style="background:${billTab==='credit'?'#EDE9FE':'var(--surface-3)'};color:${billTab==='credit'?'#7C3AED':'var(--text-muted)'};font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">${creditBills.length}</span>
            </button>
        </div>

        <!-- Table -->
        <div class="bill-card" style="border-radius:0 0 var(--radius) var(--radius);margin-bottom:20px;">
            <div class="table-container" style="border:none;border-radius:0;" id="acctTableWrap">
            </div>
        </div>
    `;

    // Store period for re-renders
    window._acctPeriod = period;
    _acctRender();
}

function _acctSetTab(tab) {
    localStorage.setItem('acctBillTab', tab);

    // Update tab button styles
    const cashBtn   = document.getElementById('acctTabCash');
    const creditBtn = document.getElementById('acctTabCredit');
    if (cashBtn) {
        cashBtn.style.color       = tab === 'cash' ? '#16A34A' : 'var(--text-muted)';
        cashBtn.style.borderBottom = tab === 'cash' ? '2px solid #16A34A' : '2px solid transparent';
        const badge = cashBtn.querySelector('span:last-child');
        if (badge) { badge.style.background = tab==='cash'?'#DCFCE7':'var(--surface-3)'; badge.style.color = tab==='cash'?'#16A34A':'var(--text-muted)'; }
    }
    if (creditBtn) {
        creditBtn.style.color       = tab === 'credit' ? '#7C3AED' : 'var(--text-muted)';
        creditBtn.style.borderBottom = tab === 'credit' ? '2px solid #7C3AED' : '2px solid transparent';
        const badge = creditBtn.querySelector('span:last-child');
        if (badge) { badge.style.background = tab==='credit'?'#EDE9FE':'var(--surface-3)'; badge.style.color = tab==='credit'?'#7C3AED':'var(--text-muted)'; }
    }

    _acctRender();
}

function _acctRender() {
    const tab        = localStorage.getItem('acctBillTab') || 'cash';
    const period     = window._acctPeriod || 'all';
    const search     = (document.getElementById('acctSearch')?.value || '').toLowerCase();
    const fromVal    = document.getElementById('acctFrom')?.value;
    const toVal      = document.getElementById('acctTo')?.value;
    const paidFilter = document.getElementById('acctPaidFilter')?.value || '';
    const fromDate   = fromVal ? new Date(fromVal) : null;
    const toDate     = toVal   ? new Date(toVal + 'T23:59:59') : null;

    const now        = new Date();
    const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);

    function inPeriod(d) {
        const dt = new Date(d);
        if (period === 'today') return dt.toDateString() === now.toDateString();
        if (period === 'week')  return dt >= weekStart;
        if (period === 'month') return dt >= monthStart;
        if (period === 'year')  return dt >= yearStart;
        return true;
    }

    let data = bills.filter(b => {
        const isType = tab === 'cash' ? (b.billType||'cash') === 'cash' : b.billType === 'credit';
        if (!isType) return false;
        if (!inPeriod(b.date)) return false;
        const dt = new Date(b.date);
        if (fromDate && dt < fromDate) return false;
        if (toDate   && dt > toDate)   return false;
        if (paidFilter === 'paid'   && !b.paid) return false;
        if (paidFilter === 'unpaid' &&  b.paid) return false;
        if (search && !(b.billNo+b.customerName+(b.vehicleNo||'')).toLowerCase().includes(search)) return false;
        return true;
    }).slice().reverse();

    // Store filtered indices for bulk actions
    window._acctFilteredIndices = data.map(b => bills.indexOf(b));
    // Store filtered bills for export/print
    window._acctFilteredBills = data;

    const subtotal = data.reduce((s,b) => s+b.total, 0);
    const color    = tab === 'cash' ? '#16A34A' : '#7C3AED';
    const wrap     = document.getElementById('acctTableWrap');
    if (!wrap) return;

    if (data.length === 0) {
        wrap.innerHTML = `<div class="empty-state" style="padding:40px"><div class="empty-state-icon">${tab==='cash'?'💵':'💳'}</div><h4>No ${tab} bills found</h4><p>Try adjusting your filters.</p></div>`;
        _acctUpdateBulkBar();
        return;
    }

    const rows = data.map((b, ri) => {
        const idx = bills.indexOf(b);
        const bal = b.paid ? 0 : (b.balance ?? b.total);
        const paidBadge = b.paid
            ? `<span class="badge" style="background:#DCFCE7;color:#16A34A;font-size:10px;">✓ Paid</span>`
            : `<span class="badge" style="background:#FEE2E2;color:#DC2626;font-size:10px;">Unpaid</span>`;
        const rowStyle = (!b.paid && tab==='credit') ? 'background:rgba(220,38,38,0.03);' : '';
        return `<tr style="${rowStyle}" id="acctRow_${idx}">
            <td style="width:36px;text-align:center;">
                <input type="checkbox" class="acct-chk" data-idx="${idx}"
                    onchange="_acctUpdateBulkBar()"
                    style="width:15px;height:15px;cursor:pointer;accent-color:${color};">
            </td>
            <td><span class="badge" style="background:${tab==='cash'?'#DCFCE7':'#EDE9FE'};color:${color};">${b.billNo}</span></td>
            <td><strong>${b.customerName}</strong><div style="font-size:11px;color:var(--text-muted);">${b.vehicleNo||''}</div></td>
            <td class="td-muted">${new Date(b.date).toLocaleDateString('en-GB')}</td>
            <td><strong>Rs. ${fmtN(b.total,0)}</strong></td>
            <td>${b.advance>0?`<span style="color:#D97706;">Rs. ${fmtN(b.advance,0)}</span>`:'—'}</td>
            <td><strong style="color:${bal>0?'#DC2626':'#16A34A'};">Rs. ${fmtN(bal,0)}</strong></td>
            <td>${paidBadge}</td>
        </tr>`;
    }).join('');

    wrap.innerHTML = `
        <!-- Bulk action bar -->
        <div id="acctBulkBar" style="display:none;padding:10px 16px;background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border-bottom:1.5px solid #BFDBFE;align-items:center;gap:12px;flex-wrap:wrap;">
            <span id="acctBulkCount" style="font-size:13px;font-weight:600;color:#1D4ED8;"></span>
            <button onclick="_acctBulkDownload()" class="btn btn-primary btn-sm">
                <span class="material-symbols-rounded" style="font-size:14px;">download</span> Download Selected PDFs
            </button>
            <button onclick="_acctBulkPrint()" class="btn btn-secondary btn-sm">
                <span class="material-symbols-rounded" style="font-size:14px;">print</span> Print Selected
            </button>
            <button onclick="_acctClearSelection()" style="margin-left:auto;background:none;border:none;cursor:pointer;color:#64748B;font-size:12px;font-family:inherit;">
                ✕ Clear selection
            </button>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width:36px;text-align:center;">
                        <input type="checkbox" id="acctSelectAll" onchange="_acctToggleAll(this)"
                            style="width:15px;height:15px;cursor:pointer;accent-color:${color};" title="Select all">
                    </th>
                    <th>Bill No</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Advance</th>
                    <th>Balance</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
                <tr style="background:var(--surface-3);">
                    <td></td>
                    <td colspan="3" style="font-weight:700;color:var(--text-secondary);font-size:13px;padding:10px 14px;">
                        ${data.length} bill${data.length!==1?'s':''}
                    </td>
                    <td colspan="4" style="text-align:right;padding:10px 14px;">
                        <strong style="color:${color};font-size:15px;">Total: Rs. ${fmtN(subtotal,0)}</strong>
                        ${tab==='credit' ? `&nbsp;&nbsp;<strong style="color:#DC2626;font-size:13px;">Outstanding: Rs. ${fmtN(data.filter(b=>!b.paid).reduce((s,b)=>s+(b.balance??b.total),0),0)}</strong>` : ''}
                    </td>
                </tr>
            </tfoot>
        </table>`;

    _acctUpdateBulkBar();
}

function _acctToggleAll(chk) {
    document.querySelectorAll('.acct-chk').forEach(c => c.checked = chk.checked);
    _acctUpdateBulkBar();
}

function _acctClearSelection() {
    document.querySelectorAll('.acct-chk').forEach(c => c.checked = false);
    const all = document.getElementById('acctSelectAll');
    if (all) all.checked = false;
    _acctUpdateBulkBar();
}

function _acctGetSelected() {
    return [...document.querySelectorAll('.acct-chk:checked')].map(c => parseInt(c.dataset.idx));
}

function _acctUpdateBulkBar() {
    const selected = _acctGetSelected();
    const bar   = document.getElementById('acctBulkBar');
    const count = document.getElementById('acctBulkCount');
    if (!bar) return;
    if (selected.length > 0) {
        bar.style.display = 'flex';
        if (count) count.textContent = `${selected.length} bill${selected.length!==1?'s':''} selected`;
    } else {
        bar.style.display = 'none';
    }
    // Update select-all checkbox state
    const all   = document.getElementById('acctSelectAll');
    const total = document.querySelectorAll('.acct-chk').length;
    if (all) {
        all.checked       = selected.length === total && total > 0;
        all.indeterminate = selected.length > 0 && selected.length < total;
    }
}

async function _acctBulkDownload() {
    const indices = _acctGetSelected();
    if (!indices.length) return;
    if (!window.jspdf) { showToast('PDF library not loaded', 'error'); return; }

    showToast(`📥 Downloading ${indices.length} PDF${indices.length!==1?'s':''}...`);

    // Download each bill PDF one by one with a small delay
    for (let i = 0; i < indices.length; i++) {
        await new Promise(resolve => {
            setTimeout(() => {
                downloadBill(indices[i]);
                resolve();
            }, i * 400); // stagger to avoid browser blocking
        });
    }
    showToast(`✅ ${indices.length} PDF${indices.length!==1?'s':''} downloaded`);
}

function _acctBulkPrint() {
    const indices = _acctGetSelected();
    if (!indices.length) return;
    const selectedBills = indices.map(i => bills[i]).filter(Boolean);

    // Build a single print page with all selected bills
    const pages = selectedBills.map(b => {
        const laborItems = b.items.filter(i => i.type === 'Labor');
        const partItems  = b.items.filter(i => i.type === 'Part');
        return _buildBillHTML({
            billNo: b.billNo, billDate: new Date(b.date).toLocaleDateString('en-GB'),
            customerName: b.customerName, customerPhone: b.customerPhone||'',
            isCompany: b.isCompany||false, companyAddress: b.companyAddress||'',
            vehicleNo: b.vehicleNo, vehicleModel: b.vehicleModel||'', brand: b.brand||'',
            mileage: b.mileage||'', laborItems, partItems,
            total: b.total, advance: b.advance||0,
            balance: b.paid ? 0 : (b.balance ?? b.total),
            bankDetails: b.bankDetails||null, paid: b.paid||false
        });
    });

    // Extract just the body content from each bill HTML and combine
    const w = window.open('', '_blank', 'width=800,height=900');
    w.document.write(`<!DOCTYPE html><html><head><title>Bulk Print — ${selectedBills.length} Bills</title>
        <style>
            @media print { .page-break { page-break-after: always; } .no-print { display:none; } }
            body { margin: 0; }
        </style>
    </head><body>`);

    selectedBills.forEach((b, i) => {
        const laborItems = b.items.filter(it => it.type === 'Labor');
        const partItems  = b.items.filter(it => it.type === 'Part');
        const html = _buildBillHTML({
            billNo: b.billNo, billDate: new Date(b.date).toLocaleDateString('en-GB'),
            customerName: b.customerName, customerPhone: b.customerPhone||'',
            isCompany: b.isCompany||false, companyAddress: b.companyAddress||'',
            vehicleNo: b.vehicleNo, vehicleModel: b.vehicleModel||'', brand: b.brand||'',
            mileage: b.mileage||'', laborItems, partItems,
            total: b.total, advance: b.advance||0,
            balance: b.paid ? 0 : (b.balance ?? b.total),
            bankDetails: b.bankDetails||null, paid: b.paid||false
        });
        // Extract body content only
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        const content = bodyMatch ? bodyMatch[1] : html;
        w.document.write(`<div style="page-break-after:${i < selectedBills.length-1 ? 'always' : 'avoid'}">${content}</div>`);
    });

    w.document.write(`<div class="no-print" style="text-align:center;padding:20px;">
        <button onclick="window.print()" style="padding:12px 32px;background:#1D4ED8;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;">
            🖨 Print All ${selectedBills.length} Bills
        </button>
    </div></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
}

function _acctPrintOne(index) {
    const bill = bills[index];
    if (!bill) return;
    const w = window.open('', '_blank', 'width=750,height=950');
    w.document.write(_buildBillHTML({
        billNo: bill.billNo, billDate: new Date(bill.date).toLocaleDateString('en-GB'),
        customerName: bill.customerName, customerPhone: bill.customerPhone||'',
        isCompany: bill.isCompany||false, companyAddress: bill.companyAddress||'',
        vehicleNo: bill.vehicleNo, vehicleModel: bill.vehicleModel||'', brand: bill.brand||'',
        mileage: bill.mileage||'',
        laborItems: bill.items.filter(i=>i.type==='Labor'),
        partItems:  bill.items.filter(i=>i.type==='Part'),
        total: bill.total, advance: bill.advance||0, balance: bill.paid?0:(bill.balance??bill.total),
        bankDetails: bill.bankDetails||null, paid: bill.paid||false
    }));
    w.document.close();
    setTimeout(() => w.print(), 500);
}

function _acctDateRangeLabel(period) {
    const now        = new Date();
    const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);
    const fmt = d => d.toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

    // Check if custom date range is active
    const fromVal = document.getElementById('acctFrom')?.value;
    const toVal   = document.getElementById('acctTo')?.value;
    if (fromVal || toVal) {
        const from = fromVal ? fmt(new Date(fromVal)) : '—';
        const to   = toVal   ? fmt(new Date(toVal))   : '—';
        return `${from}  to  ${to}`;
    }

    if (period === 'today') return fmt(now);
    if (period === 'week')  return `${fmt(weekStart)}  to  ${fmt(now)}`;
    if (period === 'month') return `${fmt(monthStart)}  to  ${fmt(now)}`;
    if (period === 'year')  return `${fmt(yearStart)}  to  ${fmt(now)}`;
    return 'All Time';
}

function _acctPrintAll(period) {
    const tab  = localStorage.getItem('acctBillTab') || 'cash';
    const data = window._acctFilteredBills || [];
    if (!data.length) { showToast('No bills to print', 'error'); return; }

    const now        = new Date();
    const color      = tab==='cash' ? '#16A34A' : '#7C3AED';
    const typeLabel  = tab==='cash' ? '💵 Cash' : '💳 Credit';
    const dateRange  = _acctDateRangeLabel(period);
    const paidFilter = document.getElementById('acctPaidFilter')?.value || '';
    const statusLabel = paidFilter === 'paid' ? 'Paid' : paidFilter === 'unpaid' ? 'Unpaid' : '';
    const total      = data.reduce((s,b)=>s+b.total,0);
    const paidTotal  = data.filter(b=>b.paid).reduce((s,b)=>s+b.total,0);
    const outstanding = data.filter(b=>!b.paid).reduce((s,b)=>s+(b.balance??b.total),0);

    const rows = data.slice().reverse().map(b => {
        const bal = b.paid ? 0 : (b.balance ?? b.total);
        return `<tr style="${!b.paid&&tab==='credit'?'background:#fff5f5':''}">
            <td>${b.billNo}</td>
            <td>${b.customerName}</td>
            <td>${b.vehicleNo||'—'}</td>
            <td>${new Date(b.date).toLocaleDateString('en-GB')}</td>
            <td style="text-align:right;">Rs. ${fmtN(b.total,0)}</td>
            <td style="text-align:right;color:${bal>0?'#DC2626':'#16A34A'};">Rs. ${fmtN(bal,0)}</td>
            ${!statusLabel ? `<td style="color:${b.paid?'#16A34A':'#DC2626'};font-weight:600;">${b.paid?'Paid':'Unpaid'}</td>` : ''}
        </tr>`;
    }).join('');

    const thAlign = `th:last-child,th:nth-child(5),th:nth-child(6){text-align:right;}`;
    const tdAlign = `td:last-child,td:nth-child(5),td:nth-child(6){text-align:right;}`;

    const w = window.open('','_blank','width=900,height=700');
    w.document.write(`<!DOCTYPE html><html><head>
    <title>${typeLabel} Bills Report</title>
    <style>
        body{font-family:Arial,sans-serif;padding:28px 32px;color:#000;font-size:13px;}
        .header{border-bottom:2px solid #000;background:#ddd;padding:14px 0 14px;margin-bottom:18px;}
        .company{font-size:20px;font-weight:800;color:#000;margin-bottom:2px;}
        .report-title{font-size:15px;font-weight:700;color:#000;margin-bottom:4px;}
        .date-range{font-size:13px;color:#333;margin-bottom:2px;}
        .meta{font-size:11.5px;color:#666;}
        .summary{display:flex;gap:24px;margin-bottom:18px;flex-wrap:wrap;}
        .sum-box{border:1.5px solid #000;border-radius:4px;padding:10px 16px;min-width:140px;}
        .sum-label{font-size:10px;font-weight:700;text-transform:uppercase;color:#555;margin-bottom:3px;}
        .sum-val{font-size:16px;font-weight:800;color:#000;}
        table{width:100%;border-collapse:collapse;margin-top:4px;}
        th{background:#000;color:#fff;padding:8px 10px;text-align:left;font-size:11px;font-weight:700;}
        ${thAlign}
        td{padding:7px 10px;border-bottom:1px solid #ccc;font-size:12px;vertical-align:middle;color:#000;}
        ${tdAlign}
        tr:nth-child(even) td{background:#f5f5f5;}
        tfoot td{font-weight:700;background:#eee;border-top:2px solid #000;font-size:12.5px;color:#000;}
        @media print{.no-print{display:none!important;} body{padding:16px;} * {-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
    </style></head><body>
    <div class="header">
        <div class="company">Siriman Motor Works</div>
        <div class="report-title">${typeLabel} Bills Report</div>
        <div class="date-range">Period: ${dateRange}</div>
        ${statusLabel ? `<div class="date-range">Status: <strong>${statusLabel}</strong></div>` : ''}
        <div class="meta">Generated: ${now.toLocaleString()}</div>
    </div>
    <div class="summary">
        <div class="sum-box">
            <div class="sum-label">Total Bills</div>
            <div class="sum-val" style="color:${color};">${data.length}</div>
        </div>
        <div class="sum-box">
            <div class="sum-label">Total Amount</div>
            <div class="sum-val" style="color:#1D4ED8;">Rs. ${fmtN(total,0)}</div>
        </div>
        <div class="sum-box">
            <div class="sum-label">Paid</div>
            <div class="sum-val" style="color:#16A34A;">Rs. ${fmtN(paidTotal,0)}</div>
        </div>
        ${outstanding>0?`<div class="sum-box">
            <div class="sum-label">Outstanding</div>
            <div class="sum-val" style="color:#DC2626;">Rs. ${fmtN(outstanding,0)}</div>
        </div>`:''}
    </div>
    <table>
        <thead><tr>
            <th>Bill No</th><th>Customer</th><th>Vehicle</th><th>Date</th>
            <th>Total</th><th>Balance</th>
            ${!statusLabel ? '<th>Status</th>' : ''}
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
            <td colspan="4">${data.length} bill${data.length!==1?'s':''}</td>
            <td>Rs. ${fmtN(total,0)}</td>
            <td style="color:${outstanding>0?'#DC2626':'#16A34A'};">Rs. ${fmtN(outstanding,0)}</td>
            ${!statusLabel ? '<td></td>' : ''}
        </tr></tfoot>
    </table>
    <br>
    <button class="no-print" onclick="window.print()" style="padding:10px 28px;background:${color};color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;font-family:Arial;">🖨 Print</button>
    </body></html>`);
    w.document.close();
}

function _acctExportPDF(period) {
    if (!window.jspdf) { showToast('PDF library not loaded', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const tab  = localStorage.getItem('acctBillTab') || 'cash';
    const now  = new Date();
    const data = window._acctFilteredBills || [];
    if (!data.length) { showToast('No bills to export', 'error'); return; }

    const paidFilter  = document.getElementById('acctPaidFilter')?.value || '';
    const statusLabel = paidFilter === 'paid' ? 'Paid' : paidFilter === 'unpaid' ? 'Unpaid' : '';

    const doc = new jsPDF('portrait');
    const PW=210, M=14, CW=PW-M*2;

    // ── Header (light gray) ─────────────────────────────────
    doc.setFillColor(220,220,220); doc.rect(0,0,PW,34,'F');
    doc.setTextColor(0,0,0); doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text('Siriman Motor Works', M, 12);
    doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(`${tab==='cash'?'Cash':'Credit'} Bills Report`, M, 21);
    doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60);
    const periodLine = `Period: ${_acctDateRangeLabel(period)}${statusLabel ? '   |   Status: ' + statusLabel : ''}`;
    doc.text(periodLine, M, 28);
    doc.setFontSize(7.5); doc.setTextColor(100,100,100);
    doc.text(`Generated: ${now.toLocaleString()}`, PW-M, 28, { align:'right' });

    // ── Table header (dark gray) ────────────────────────────
    const cols = statusLabel ? ['Date', 'Bill No', 'Total'] : ['Date', 'Bill No', 'Total', 'Status'];
    const colW = statusLabel ? [62, 62, 58]                 : [52, 52, 50, 28];
    const ROW_H = 10;
    let y = 40, x = M;

    doc.setFillColor(50,50,50); doc.rect(M,y,CW,9,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
    cols.forEach((c,i)=>{ doc.text(c,x+3,y+6); x+=colW[i]; }); y+=9;

    // ── Rows ────────────────────────────────────────────────
    data.forEach((b,ri)=>{
        if (y>275) {
            doc.addPage();
            y=14;
            // Repeat header on new page
            x=M;
            doc.setFillColor(50,50,50); doc.rect(M,y,CW,9,'F');
            doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
            cols.forEach((c,i)=>{ doc.text(c,x+3,y+6); x+=colW[i]; }); y+=9;
        }
        // Alternating: white / very light gray
        doc.setFillColor(ri%2===0?245:255, ri%2===0?245:255, ri%2===0?245:255);
        doc.rect(M,y,CW,ROW_H,'F');
        doc.setFontSize(9); x=M;
        const row = statusLabel
            ? [new Date(b.date).toLocaleDateString('en-GB'), b.billNo, 'Rs. '+fmtN(b.total,0)]
            : [new Date(b.date).toLocaleDateString('en-GB'), b.billNo, 'Rs. '+fmtN(b.total,0), b.paid?'Paid':'Unpaid'];
        row.forEach((v,i)=>{
            // Status column: bold for paid/unpaid distinction
            if (!statusLabel && i===3) {
                doc.setFont('helvetica','bold');
                doc.setTextColor(b.paid ? 0 : 80, b.paid ? 0 : 80, b.paid ? 0 : 80);
            } else {
                doc.setFont('helvetica', i===1?'bold':'normal');
                doc.setTextColor(0,0,0);
            }
            doc.text(String(v), x+3, y+6.5); x+=colW[i];
        });
        // Row border
        doc.setDrawColor(180,180,180); doc.setLineWidth(0.2);
        doc.line(M,y+ROW_H,M+CW,y+ROW_H); y+=ROW_H;
    });

    // ── Summary row ─────────────────────────────────────────
    const total       = data.reduce((s,b)=>s+b.total,0);
    const outstanding = data.filter(b=>!b.paid).reduce((s,b)=>s+(b.balance??b.total),0);
    y+=4;
    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.line(M,y,M+CW,y); y+=2;
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(0,0,0);
    doc.text(`${data.length} bill${data.length!==1?'s':''}`, M+3, y+7);
    doc.text(`Total: Rs. ${fmtN(total,0)}`, M+70, y+7);
    if (outstanding>0) {
        doc.setFont('helvetica','bold'); doc.setFontSize(9);
        doc.text(`Outstanding: Rs. ${fmtN(outstanding,0)}`, M+3, y+16);
    }
    y += outstanding>0 ? 20 : 12;
    doc.setLineWidth(0.5); doc.line(M,y,M+CW,y);

    doc.save(`${tab}_bills_${now.toISOString().slice(0,10)}.pdf`);
    showToast(`PDF exported`);
}


function showAnalysisDetail(type, period) {
    const panel  = document.getElementById('analysisDetailPanel');
    const title  = document.getElementById('analysisDetailTitle');
    const table  = document.getElementById('analysisDetailTable');
    if (!panel) return;

    panel.style.display = 'block';
    panel.scrollIntoView({ behavior:'smooth', block:'nearest' });

    const icons = { paid:'check_circle', unpaid:'pending', cash:'point_of_sale', credit:'credit_card', estimates:'request_quote', payments:'account_balance_wallet' };
    const labels = { paid:'Paid Bills', unpaid:'Pending Credits', cash:'Cash Bills', credit:'Credit Bills', estimates:'Estimates', payments:'Payment Slips' };
    const colors = { paid:'#16A34A', unpaid:'#DC2626', cash:'#2563EB', credit:'#7C3AED', estimates:'#D97706', payments:'#16A34A' };

    title.innerHTML = `<span class="material-symbols-rounded" style="color:${colors[type]}">${icons[type]}</span> ${labels[type]}`;
    panel.dataset.type = type;
    panel.dataset.period = period;

    _renderDetailTable(type, period, '');
}

function filterAnalysisDetail() {
    const q = document.getElementById('analysisSearch')?.value || '';
    const panel = document.getElementById('analysisDetailPanel');
    if (!panel) return;
    _renderDetailTable(panel.dataset.type, panel.dataset.period, q);
}

function _renderDetailTable(type, period, q) {
    const table = document.getElementById('analysisDetailTable');
    if (!table) return;
    q = q.toLowerCase();

    const now = new Date();
    const weekStart  = new Date(now); weekStart.setDate(now.getDate()-now.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);
    function inP(dateStr) {
        const d = new Date(dateStr);
        if (period==='today') return d.toDateString()===now.toDateString();
        if (period==='week')  return d>=weekStart;
        if (period==='month') return d>=monthStart;
        if (period==='year')  return d>=yearStart;
        return true;
    }

    if (type === 'estimates') {
        const data = estimates.filter(e=>inP(e.date)&&(!q||(e.estNo+e.customerName+(e.vehicleNo||'')).toLowerCase().includes(q)));
        table.innerHTML = `<thead><tr><th>Est No</th><th>Date</th><th>Customer</th><th>Vehicle</th><th>Total</th></tr></thead>
        <tbody>${data.length ? data.slice().reverse().map(e=>`<tr>
            <td><span class="badge" style="background:#EDE9FE;color:#7C3AED;">${e.estNo}</span></td>
            <td class="td-muted">${new Date(e.date).toLocaleDateString()}</td>
            <td><strong>${e.customerName}</strong></td>
            <td class="td-muted">${e.vehicleNo||'—'}</td>
            <td><strong style="color:#D97706">Rs. ${fmtN(e.total,0)}</strong></td>
        </tr>`).join('') : '<tr><td colspan="5"><div class="empty-state" style="padding:16px"><p>No records</p></div></td></tr>'}</tbody>`;
        return;
    }

    if (type === 'payments') {
        const data = paymentSlips.filter(s=>inP(s.date)&&(!q||(s.slipNo+s.customerName+(s.vehicleNo||'')).toLowerCase().includes(q)));
        table.innerHTML = `<thead><tr><th>Slip No</th><th>Date</th><th>Customer</th><th>Vehicle</th><th>Method</th><th>Amount</th></tr></thead>
        <tbody>${data.length ? data.slice().reverse().map(s=>`<tr>
            <td><span class="badge badge-blue">${s.slipNo}</span></td>
            <td class="td-muted">${new Date(s.date).toLocaleDateString()}</td>
            <td><strong>${s.customerName}</strong></td>
            <td class="td-muted">${s.vehicleNo||'—'}</td>
            <td><span class="badge badge-gray">${s.method}</span></td>
            <td><strong style="color:#16A34A">Rs. ${fmtN(s.amount,0)}</strong></td>
        </tr>`).join('') : '<tr><td colspan="6"><div class="empty-state" style="padding:16px"><p>No records</p></div></td></tr>'}</tbody>`;
        return;
    }

    let data = bills.filter(b=>inP(b.date));
    if (type==='paid')   data = data.filter(b=>b.paid);
    if (type==='unpaid') data = data.filter(b=>!b.paid);
    if (type==='cash')   data = data.filter(b=>(b.billType||'cash')==='cash');
    if (type==='credit') data = data.filter(b=>b.billType==='credit');
    if (q) data = data.filter(b=>(b.billNo+b.customerName+(b.vehicleNo||'')).toLowerCase().includes(q));

    table.innerHTML = `<thead><tr><th>Bill No</th><th>Date</th><th>Customer</th><th>Vehicle</th><th>Type</th><th>Labor</th><th>Parts</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead>
    <tbody>${data.length ? data.slice().reverse().map(b=>{
        const labor = b.items.filter(i=>i.type==='Labor').reduce((s,i)=>s+i.total,0);
        const parts = b.items.filter(i=>i.type==='Part').reduce((s,i)=>s+i.total,0);
        return `<tr>
            <td><span class="badge badge-blue">${b.billNo}</span></td>
            <td class="td-muted">${new Date(b.date).toLocaleDateString()}</td>
            <td><strong>${b.customerName}</strong><div style="font-size:11px;color:var(--text-muted)">${b.vehicleNo||''}</div></td>
            <td class="td-muted">${b.vehicleNo||'—'}</td>
            <td>${(b.billType||'cash')==='cash'?'<span class="badge" style="background:#DCFCE7;color:#16A34A;font-size:10px;">💵 Cash</span>':'<span class="badge" style="background:#EDE9FE;color:#7C3AED;font-size:10px;">💳 Credit</span>'}</td>
            <td class="td-muted">Rs. ${fmtN(labor,0)}</td>
            <td class="td-muted">Rs. ${fmtN(parts,0)}</td>
            <td><strong>Rs. ${fmtN(b.total,0)}</strong></td>
            <td><strong style="color:${(b.balance===0||b.paid)?'#16A34A':'#DC2626'}">Rs. ${fmtN(b.balance||0,0)}</strong></td>
            <td>${b.paid?'<span class="badge" style="background:#DCFCE7;color:#16A34A;font-size:10px;">✓ Paid</span>':'<span class="badge" style="background:#FEE2E2;color:#DC2626;font-size:10px;">Unpaid</span>'}</td>
        </tr>`;
    }).join('') : '<tr><td colspan="10"><div class="empty-state" style="padding:16px"><p>No records</p></div></td></tr>'}</tbody>`;
}

function printAnalysisReport(period) {
    window.print();
}

function exportAnalysisPDF(period) {
    if (!window.jspdf) { showToast('⚠️ PDF library not loaded', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    const now = new Date();
    const weekStart  = new Date(now); weekStart.setDate(now.getDate()-now.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);
    function inP(dateStr) {
        const d = new Date(dateStr);
        if (period==='today') return d.toDateString()===now.toDateString();
        if (period==='week')  return d>=weekStart;
        if (period==='month') return d>=monthStart;
        if (period==='year')  return d>=yearStart;
        return true;
    }
    const fb = bills.filter(b=>inP(b.date));
    const totalIncome  = fb.filter(b=>b.paid).reduce((s,b)=>s+b.total,0);
    const totalPending = fb.filter(b=>!b.paid).reduce((s,b)=>s+b.total,0);

    doc.setFillColor(15,45,74); doc.rect(0,0,297,22,'F');
    doc.setTextColor(201,168,76); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text('Siriman Motor Works', 14, 10);
    doc.setTextColor(255,255,255); doc.setFontSize(9);
    doc.text(`Analysis Report — ${period.charAt(0).toUpperCase()+period.slice(1)} · ${now.toLocaleString()}`, 14, 17);

    let y = 30;
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(15,23,42);
    doc.text('SUMMARY', 14, y); y += 6;
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.setTextColor(22,163,74);  doc.text(`Total Income:    Rs. ${fmtN(totalIncome,0)}`, 14, y); y += 5;
    doc.setTextColor(239,68,68);  doc.text(`Pending Credits: Rs. ${fmtN(totalPending,0)}`, 14, y); y += 5;
    doc.setTextColor(37,99,235);  doc.text(`Total Bills: ${fb.length}  |  Paid: ${fb.filter(b=>b.paid).length}  |  Unpaid: ${fb.filter(b=>!b.paid).length}`, 14, y); y += 10;

    const cols = ['Bill No','Date','Customer','Vehicle','Type','Labor','Parts','Total','Balance','Status'];
    const colW = [25,22,48,28,18,22,22,26,24,18];
    let x = 14;
    doc.setFillColor(30,41,59); doc.rect(14,y,269,8,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(7.5); doc.setFont('helvetica','bold');
    cols.forEach((c,i)=>{ doc.text(c,x+2,y+5.5); x+=colW[i]; }); y+=8;

    doc.setFont('helvetica','normal');
    fb.slice().reverse().forEach((b,ri)=>{
        if (y>185) { doc.addPage(); y=14; }
        doc.setFillColor(ri%2===0?248:255,ri%2===0?250:255,ri%2===0?252:255);
        doc.rect(14,y,269,7,'F');
        const labor=b.items.filter(i=>i.type==='Labor').reduce((s,i)=>s+i.total,0);
        const parts=b.items.filter(i=>i.type==='Part').reduce((s,i)=>s+i.total,0);
        const row=[b.billNo,new Date(b.date).toLocaleDateString(),b.customerName,b.vehicleNo||'—',(b.billType||'cash').toUpperCase(),'Rs.'+fmtN(labor,0),'Rs.'+fmtN(parts,0),'Rs.'+fmtN(b.total,0),'Rs.'+fmtN(b.balance||0,0),b.paid?'Paid':'Unpaid'];
        x=14; doc.setTextColor(15,23,42); doc.setFontSize(7);
        row.forEach((v,i)=>{ if(i===9){doc.setTextColor(b.paid?22:239,b.paid?163:68,b.paid?74:68);}else{doc.setTextColor(15,23,42);} doc.text(String(v).substring(0,16),x+2,y+4.8); x+=colW[i]; });
        doc.setDrawColor(226,232,240); doc.line(14,y+7,283,y+7); y+=7;
    });

    const tot=fb.reduce((s,b)=>s+b.total,0);
    y+=4; doc.setFillColor(239,246,255); doc.rect(14,y,269,10,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(37,99,235);
    doc.text(`${fb.length} bills  |  Total: Rs. ${fmtN(tot,0)}`, 16, y+6.5);
    doc.setTextColor(22,163,74); doc.text(`Paid: Rs. ${fmtN(totalIncome,0)}`, 120, y+6.5);
    doc.setTextColor(239,68,68); doc.text(`Pending: Rs. ${fmtN(totalPending,0)}`, 190, y+6.5);
    doc.setFontSize(7); doc.setTextColor(148,163,184); doc.setFont('helvetica','normal');
    doc.text(`Generated: ${now.toLocaleString()}`, 14, 205);
    doc.save(`analysis_${period}_${now.toISOString().slice(0,10)}.pdf`);
    showToast('📄 Analysis PDF exported');
}

function exportAnalysisCSV(period) {
    const now = new Date();
    const weekStart  = new Date(now); weekStart.setDate(now.getDate()-now.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);
    function inP(dateStr) {
        const d = new Date(dateStr);
        if (period==='today') return d.toDateString()===now.toDateString();
        if (period==='week')  return d>=weekStart;
        if (period==='month') return d>=monthStart;
        if (period==='year')  return d>=yearStart;
        return true;
    }
    const rows = [['Bill No','Date','Customer','Vehicle','Type','Labor','Parts','Total','Balance','Status']];
    bills.filter(b=>inP(b.date)).forEach(b=>{
        const labor=b.items.filter(i=>i.type==='Labor').reduce((s,i)=>s+i.total,0);
        const parts=b.items.filter(i=>i.type==='Part').reduce((s,i)=>s+i.total,0);
        rows.push([b.billNo,new Date(b.date).toLocaleDateString(),b.customerName,b.vehicleNo||'',(b.billType||'cash').toUpperCase(),labor.toFixed(2),parts.toFixed(2),b.total.toFixed(2),(b.balance||0).toFixed(2),b.paid?'Paid':'Unpaid']);
    });
    const csv=rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`analysis_${period}_${now.toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
    showToast('📊 Analysis CSV exported');
}

function exportAllData() {
    const data = { customers, bills, estimates, paymentSlips, bankAccounts, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download=`siriman_all_data_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
    showToast('📦 All data exported');
}
