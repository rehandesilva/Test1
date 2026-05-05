const fs   = require('fs');
const path = require('path');

const BACKUP_DIR  = path.join(__dirname, 'backups');
const MAX_BACKUPS = 20;

function createBackup(data) {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

    const ts       = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${ts}.json`;
    const filepath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

    // Prune old backups — keep only MAX_BACKUPS
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup_'))
        .sort();

    if (files.length > MAX_BACKUPS) {
        files.slice(0, files.length - MAX_BACKUPS).forEach(f => {
            fs.unlinkSync(path.join(BACKUP_DIR, f));
        });
    }

    return filename;
}

function listBackups() {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    return fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup_'))
        .sort()
        .reverse()
        .map(f => ({
            filename: f,
            timestamp: f.replace('backup_', '').replace('.json', '').replace(/-/g, (m, o) => o < 19 ? '-' : ':'),
            size: Math.round(fs.statSync(path.join(BACKUP_DIR, f)).size / 1024) + ' KB'
        }));
}

function restoreBackup(filename) {
    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath)) throw new Error('Backup file not found');
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

module.exports = { createBackup, listBackups, restoreBackup };
