// ==================== SYNC CLIENT ====================
// Handles all communication with the local sync server (localhost:3001)
// Save flow: saveAllData() → pushToServer() → server saves data.json → uploads to Mega
// Load flow: app start → loadFromServer() → applyServerData() → in-memory + localStorage

const SYNC_SERVER = 'http://localhost:3001';
let syncOnline = false;

// ── Check if sync server is running ──────────────────────
async function checkSyncServer() {
    try {
        const res    = await fetch(`${SYNC_SERVER}/api/status`, { signal: AbortSignal.timeout(1500) });
        const status = await res.json();
        syncOnline   = true;
        const cloud  = status.cloudConfigured?.mega ? '☁️ Mega' : '⚠️ No cloud';
        updateSyncIndicator(true, `v${status.version} · ${status.lastSync ? new Date(status.lastSync).toLocaleTimeString() : 'never synced'} · ${cloud}`);
        return status;
    } catch {
        syncOnline = false;
        updateSyncIndicator(false, 'Server offline');
        return null;
    }
}

// ── Load data from server into memory + localStorage ─────
async function loadFromServer() {
    try {
        const res = await fetch(`${SYNC_SERVER}/api/data`, { signal: AbortSignal.timeout(3000) });
        const db  = await res.json();
        if (db && db.data) {
            const d = db.data;
            const hasData = (d.customers?.length || 0) + (d.bills?.length || 0) +
                            (d.estimates?.length || 0) + (d.paymentSlips?.length || 0) > 0;
            applyServerData(d); // always apply — even empty is valid
            if (hasData) showToast('☁️ Data loaded from server');
            return true;
        }
    } catch {
        // Server not available — already using localStorage
    }
    return false;
}

// ── Push current in-memory data to server ────────────────
async function pushToServer() {
    if (!syncOnline) return;
    try {
        const payload = { data: _buildDB() };   // uses live in-memory variables
        const res = await fetch(`${SYNC_SERVER}/api/data`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
            signal:  AbortSignal.timeout(5000)
        });
        const result = await res.json();
        if (result.success) {
            const cloud = result.megaSync ? '☁️ Mega' : '⚠️ No cloud';
            updateSyncIndicator(true, `v${result.version} · ${new Date(result.lastSync).toLocaleTimeString()} · ${cloud}`);
        }
    } catch {
        syncOnline = false;
        updateSyncIndicator(false, 'Save failed — click to reconnect');
    }
}

// ── Manual sync now (pull from cloud if newer) ───────────
async function syncNow() {
    if (!syncOnline) {
        launchSyncServer();
        return;
    }
    showToast('🔄 Syncing with cloud...', 'info');
    try {
        const res    = await fetch(`${SYNC_SERVER}/api/sync`, { method: 'POST', signal: AbortSignal.timeout(30000) });
        const result = await res.json();
        if (result.success) {
            if (result.action === 'pulled' && result.data) {
                applyServerData(result.data.data || result.data);
                const page = document.querySelector('.nav-btn.active')?.getAttribute('data-page') || 'dashboard';
                loadPage(page);
                showToast('⬇️ Pulled latest data from cloud');
            } else {
                showToast('⬆️ Data pushed to cloud successfully');
            }
            checkSyncServer();
        } else {
            showToast(`⚠️ Sync: ${result.error || 'No cloud configured'}`, 'error');
        }
    } catch {
        syncOnline = false;
        updateSyncIndicator(false, 'Offline — click to start server');
        showToast('❌ Sync server not reachable', 'error');
    }
}

// ── Sync indicator in top bar ─────────────────────────────
function updateSyncIndicator(online, label) {
    const el = document.getElementById('syncIndicator');
    if (!el) return;
    el.innerHTML = `
        <span style="width:8px;height:8px;border-radius:50%;background:${online ? '#22C55E' : '#EF4444'};display:inline-block;margin-right:5px;flex-shrink:0;"></span>
        ${label}`;
    el.title   = online ? 'Click to sync now' : 'Click to start sync server';
    el.onclick = online ? syncNow : launchSyncServer;
}

// ── Launch sync server via registered protocol ────────────
function launchSyncServer() {
    document.getElementById('syncLaunchPopup')?.remove();
    const popup = document.createElement('div');
    popup.id = 'syncLaunchPopup';
    popup.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--surface);border:1.5px solid var(--border);border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,0.25);z-index:9999;padding:28px 32px;width:380px;`;
    popup.innerHTML = `
        <div style="text-align:center;margin-bottom:20px;">
            <div style="width:52px;height:52px;border-radius:14px;background:#FEF3C7;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">
                <span class="material-symbols-rounded" style="color:#D97706;font-size:28px;">cloud_off</span>
            </div>
            <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:6px;">Sync Server Offline</div>
            <div style="font-size:13px;color:var(--text-muted);">Your data is safe in localStorage.<br>Start the server to enable cloud backup.</div>
        </div>

        <div id="syncLaunchStatus" style="display:none;padding:10px 14px;border-radius:8px;background:var(--surface-3);font-size:13px;color:var(--text-secondary);margin-bottom:16px;text-align:center;">
            <span id="syncLaunchMsg">Waiting...</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
            <button onclick="_tryLaunchProtocol()" style="background:linear-gradient(135deg,#2563EB,#1D4ED8);color:#fff;border:none;border-radius:10px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;">
                <span class="material-symbols-rounded" style="font-size:18px;">play_circle</span> Start Server Now
            </button>
            <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:12px 14px;font-size:12px;color:#166534;line-height:1.9;">
                <strong>💡 Fix permanently (run once):</strong><br>
                Double-click <strong>install-autostart.bat</strong><br>
                → Server starts automatically with Windows.<br>
                → You'll never see this message again.
            </div>
            <button onclick="document.getElementById('syncLaunchPopup').remove()" style="background:var(--surface-3);border:1px solid var(--border);border-radius:10px;padding:10px;font-size:13px;cursor:pointer;font-family:inherit;color:var(--text-secondary);">
                Continue Offline
            </button>
        </div>
    `;
    document.body.appendChild(popup);
    popup.addEventListener('click', e => e.stopPropagation());
}

function _tryLaunchProtocol() {
    const statusBox = document.getElementById('syncLaunchStatus');
    const msgEl     = document.getElementById('syncLaunchMsg');
    if (statusBox) statusBox.style.display = 'block';
    if (msgEl) msgEl.textContent = '🚀 Starting server...';

    window.location.href = 'garagesync://start';

    let attempts = 0;
    const poll = setInterval(async () => {
        attempts++;
        const status = await checkSyncServer();
        if (status) {
            clearInterval(poll);
            if (msgEl) msgEl.textContent = '✅ Connected! Loading data...';
            await loadFromServer();
            const page = document.querySelector('.nav-btn.active')?.getAttribute('data-page') || 'dashboard';
            loadPage(page);
            setTimeout(() => document.getElementById('syncLaunchPopup')?.remove(), 1500);
        } else if (attempts >= 15) {
            clearInterval(poll);
            if (msgEl) msgEl.innerHTML = `❌ Not responding. Run <strong>install-autostart.bat</strong> to fix this permanently, or double-click <strong>start-server.bat</strong> manually.`;
        } else {
            if (msgEl) msgEl.textContent = `Waiting... (${attempts * 2}s)`;
        }
    }, 2000);
}

// ── Auto-check every 30s — reconnect if server comes back ─
setInterval(async () => {
    const wasOnline = syncOnline;
    const ok = await checkSyncServer();
    if (ok && !wasOnline) {
        // Server just came back online — push latest data immediately
        pushToServer();
    }
}, 30000);
