require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const FILENAME  = 'garage_data.json';

// ── Check if Google Drive is configured ──────────────────
function isGoogleConfigured() {
    return !!(
        process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_REFRESH_TOKEN &&
        process.env.GOOGLE_DRIVE_FOLDER_ID &&
        process.env.GOOGLE_CLIENT_ID !== 'your_client_id_here'
    );
}

// ── Check if Mega is configured ──────────────────────────
function isMegaConfigured() {
    return !!(
        process.env.MEGA_EMAIL &&
        process.env.MEGA_PASSWORD &&
        process.env.MEGA_EMAIL !== 'your_mega_email@example.com'
    );
}

// ── Google Drive ──────────────────────────────────────────
async function uploadToGoogleDrive(data) {
    if (!isGoogleConfigured()) {
        return { success: false, provider: 'google', error: 'Not configured' };
    }
    try {
        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            'urn:ietf:wg:oauth:2.0:oob'
        );
        oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const content  = JSON.stringify(data, null, 2);
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        const res = await drive.files.list({
            q: `name='${FILENAME}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id, name)'
        });

        const fileMetadata = { name: FILENAME, parents: [folderId] };
        const media = { mimeType: 'application/json', body: content };

        if (res.data.files.length > 0) {
            await drive.files.update({ fileId: res.data.files[0].id, media, fields: 'id' });
        } else {
            await drive.files.create({ resource: fileMetadata, media, fields: 'id' });
        }
        return { success: true, provider: 'google' };
    } catch (err) {
        return { success: false, provider: 'google', error: err.message };
    }
}

async function downloadFromGoogleDrive() {
    if (!isGoogleConfigured()) {
        return { success: false, provider: 'google', error: 'Not configured' };
    }
    try {
        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            'urn:ietf:wg:oauth:2.0:oob'
        );
        oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        const res = await drive.files.list({
            q: `name='${FILENAME}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id, name, modifiedTime)'
        });

        if (res.data.files.length === 0) return { success: false, provider: 'google', error: 'File not found' };

        const fileId = res.data.files[0].id;
        const file   = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' });
        return { success: true, provider: 'google', data: JSON.parse(file.data) };
    } catch (err) {
        return { success: false, provider: 'google', error: err.message };
    }
}

// ── Mega Drive ────────────────────────────────────────────
async function uploadToMega(data) {
    if (!isMegaConfigured()) {
        return { success: false, provider: 'mega', error: 'Not configured' };
    }
    try {
        const { Storage } = require('megajs');
        const storage = new Storage({
            email:    process.env.MEGA_EMAIL,
            password: process.env.MEGA_PASSWORD
        });
        await storage.ready;

        const content = Buffer.from(JSON.stringify(data, null, 2));
        let folder = storage.root.children?.find(n => n.name === process.env.MEGA_FOLDER_NAME);
        if (!folder) folder = await storage.root.mkdir(process.env.MEGA_FOLDER_NAME);

        const existing = folder.children?.find(n => n.name === FILENAME);
        if (existing) await existing.delete(true);

        await folder.upload({ name: FILENAME, size: content.length }, content).complete;
        await storage.close();
        return { success: true, provider: 'mega' };
    } catch (err) {
        return { success: false, provider: 'mega', error: err.message };
    }
}

async function downloadFromMega() {
    if (!isMegaConfigured()) {
        return { success: false, provider: 'mega', error: 'Not configured' };
    }
    try {
        const { Storage } = require('megajs');
        const storage = new Storage({
            email:    process.env.MEGA_EMAIL,
            password: process.env.MEGA_PASSWORD
        });
        await storage.ready;

        const folder = storage.root.children?.find(n => n.name === process.env.MEGA_FOLDER_NAME);
        if (!folder) return { success: false, provider: 'mega', error: 'Folder not found' };

        const file = folder.children?.find(n => n.name === FILENAME);
        if (!file) return { success: false, provider: 'mega', error: 'File not found' };

        const buffer = await file.downloadBuffer();
        await storage.close();
        return { success: true, provider: 'mega', data: JSON.parse(buffer.toString()) };
    } catch (err) {
        return { success: false, provider: 'mega', error: err.message };
    }
}

// ── Sync Logic ────────────────────────────────────────────
async function syncToCloud(data) {
    const [gResult, mResult] = await Promise.allSettled([
        uploadToGoogleDrive(data),
        uploadToMega(data)
    ]);
    return {
        google: gResult.status === 'fulfilled' ? gResult.value : { success: false, error: gResult.reason?.message },
        mega:   mResult.status === 'fulfilled' ? mResult.value : { success: false, error: mResult.reason?.message }
    };
}

async function fetchLatestFromCloud() {
    const [gResult, mResult] = await Promise.allSettled([
        downloadFromGoogleDrive(),
        downloadFromMega()
    ]);

    const gData = gResult.status === 'fulfilled' && gResult.value.success ? gResult.value.data : null;
    const mData = mResult.status === 'fulfilled' && mResult.value.success ? mResult.value.data : null;

    if (!gData && !mData) return null;
    if (!gData) return mData;
    if (!mData) return gData;

    const gTime = gData.lastSync ? new Date(gData.lastSync).getTime() : 0;
    const mTime = mData.lastSync ? new Date(mData.lastSync).getTime() : 0;
    return gTime >= mTime ? gData : mData;
}

module.exports = {
    syncToCloud,
    fetchLatestFromCloud,
    uploadToGoogleDrive,
    uploadToMega,
    isGoogleConfigured,
    isMegaConfigured
};
