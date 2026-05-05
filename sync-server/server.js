require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const cron     = require('node-cron');
const { syncToCloud, fetchLatestFromCloud, isGoogleConfigured, isMegaConfigured } = require('./sync');
const { createBackup, listBackups, restoreBackup } = require('./backup');

const app      = express();
const PORT     = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Sync log (in-memory) ──────────────────────────────────
const syncLog = [];
function addLog(msg, type = 'info') {
    const entry = { time: new Date().toISOString(), msg, type };
    syncLog.unshift(entry);
    if (syncLog.length > 100) syncLog.pop();
    console.log(`[${type.toUpperCase()}] ${msg}`);
}

// ── Read / Write local JSON ───────────────────────────────
function readDB() {
    if (!fs.existsSync(DATA_FILE)) {
        const init = { lastSync: null, version: 1, data: {} };
        fs.writeFileSync(DATA_FILE, JSON.stringify(init, null, 2));
        return init;
    }
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
        addLog(`⚠️ data.json corrupted, resetting: ${err.message}`, 'warn');
        const init = { lastSync: null, version: 1, data: {} };
        fs.writeFileSync(DATA_FILE, JSON.stringify(init, null, 2));
        return init;
    }
}

function writeDB(db) {
    db.lastSync = new Date().toISOString();
    db.version  = (db.version || 0) + 1;
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    return db;
}

// ── Startup sync (non-blocking, won't crash server) ──────
async function startupSync() {
    if (!isGoogleConfigured() && !isMegaConfigured()) {
        addLog('⚠️ No cloud credentials configured — running in local-only mode', 'warn');
        return;
    }

    addLog('Starting up — fetching latest data from cloud...', 'info');
    try {
        const cloudData = await fetchLatestFromCloud();
        if (cloudData) {
            const local = readDB();
            const localTime = local.lastSync ? new Date(local.lastSync).getTime() : 0;
            const cloudTime = cloudData.lastSync ? new Date(cloudData.lastSync).getTime() : 0;

            if (cloudTime > localTime) {
                createBackup(local);
                fs.writeFileSync(DATA_FILE, JSON.stringify(cloudData, null, 2));
                addLog('✅ Loaded newer data from cloud', 'success');
            } else {
                addLog('✅ Local data is up to date', 'success');
            }
        } else {
            addLog('⚠️ No cloud data found — using local', 'warn');
        }
    } catch (err) {
        addLog(`⚠️ Startup sync failed (non-fatal): ${err.message}`, 'warn');
    }
}

// ── Auto sync every 5 minutes (only if cloud is configured) ──
cron.schedule('*/5 * * * *', async () => {
    if (!isGoogleConfigured() && !isMegaConfigured()) return;
    addLog('⏰ Auto sync triggered', 'info');
    try {
        const db = readDB();
        const result = await syncToCloud(db);
        if (result.google.success || result.mega.success) {
            addLog(`✅ Auto sync complete — Google: ${result.google.success ? 'OK' : 'FAIL'}, Mega: ${result.mega.success ? 'OK' : 'FAIL'}`, 'success');
        } else {
            addLog('❌ Auto sync failed — working offline', 'error');
        }
    } catch (err) {
        addLog(`❌ Auto sync error: ${err.message}`, 'error');
    }
});

// ═══════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════

// GET /api/status — health check (always responds)
app.get('/api/status', (req, res) => {
    try {
        const db = readDB();
        res.json({
            status: 'online',
            lastSync: db.lastSync,
            version: db.version,
            cloudConfigured: {
                google: isGoogleConfigured(),
                mega:   isMegaConfigured()
            },
            records: {
                customers:    (db.data?.customers    || []).length,
                bills:        (db.data?.bills        || []).length,
                estimates:    (db.data?.estimates    || []).length,
                paymentSlips: (db.data?.paymentSlips || []).length,
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});

// GET /api/data — return full database
app.get('/api/data', (req, res) => {
    try {
        res.json(readDB());
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/data — replace full database (from frontend save)
app.post('/api/data', async (req, res) => {
    try {
        const incoming = req.body;
        const current  = readDB();
        createBackup(current);

        const db = writeDB({ ...current, data: incoming.data || incoming });
        addLog('💾 Data saved to data.json', 'info');

        // Respond immediately — don't block on cloud sync
        let megaSync = false;
        res.json({ success: true, lastSync: db.lastSync, version: db.version, megaSync });

        // Cloud sync in background
        if (isGoogleConfigured() || isMegaConfigured()) {
            syncToCloud(db).then(result => {
                const ok = result.google.success || result.mega.success;
                addLog(ok
                    ? `☁️ Cloud sync OK — G:${result.google.success ? '✓' : '✗'} M:${result.mega.success ? '✓' : '✗'}`
                    : '❌ Cloud sync failed — retrying next cycle', ok ? 'success' : 'error');
            }).catch(err => addLog(`❌ Cloud sync error: ${err.message}`, 'error'));
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/sync — manual sync now
app.post('/api/sync', async (req, res) => {
    if (!isGoogleConfigured() && !isMegaConfigured()) {
        return res.json({ success: false, action: 'none', error: 'No cloud credentials configured' });
    }

    addLog('🔄 Manual sync triggered', 'info');
    try {
        const cloudData = await fetchLatestFromCloud();
        const local = readDB();

        if (cloudData) {
            const localTime = local.lastSync ? new Date(local.lastSync).getTime() : 0;
            const cloudTime = cloudData.lastSync ? new Date(cloudData.lastSync).getTime() : 0;
            if (cloudTime > localTime) {
                createBackup(local);
                fs.writeFileSync(DATA_FILE, JSON.stringify(cloudData, null, 2));
                addLog('⬇️ Pulled newer data from cloud', 'success');
                return res.json({ success: true, action: 'pulled', data: cloudData });
            }
        }

        const result = await syncToCloud(local);
        const ok = result.google.success || result.mega.success;
        addLog(ok ? '⬆️ Pushed local data to cloud' : '❌ Push failed', ok ? 'success' : 'error');
        res.json({ success: ok, action: 'pushed', result });
    } catch (err) {
        addLog(`❌ Manual sync error: ${err.message}`, 'error');
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/backups — list backups
app.get('/api/backups', (req, res) => {
    try {
        res.json(listBackups());
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/backups/restore — restore a backup
app.post('/api/backups/restore', async (req, res) => {
    try {
        const { filename } = req.body;
        const backup  = restoreBackup(filename);
        const current = readDB();
        createBackup(current);
        fs.writeFileSync(DATA_FILE, JSON.stringify(backup, null, 2));
        addLog(`♻️ Restored backup: ${filename}`, 'success');

        if (isGoogleConfigured() || isMegaConfigured()) {
            syncToCloud(backup)
                .then(() => addLog('☁️ Restored data synced to cloud', 'success'))
                .catch(err => addLog(`❌ Post-restore sync error: ${err.message}`, 'error'));
        }

        res.json({ success: true, data: backup });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/logs — sync log history
app.get('/api/logs', (req, res) => {
    res.json(syncLog);
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, async () => {
    console.log(`\n🚀 Garage Sync Server running on http://localhost:${PORT}\n`);
    // Run startup sync in background — server is already accepting requests
    startupSync().catch(err => addLog(`Startup error: ${err.message}`, 'error'));
});
