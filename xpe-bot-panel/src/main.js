import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { machineIdSync } from 'node-machine-id';
import { fileURLToPath } from 'url';
import botEngine from './bot-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let isLicenseValidated = false;
let licenseData = null;

const LICENSE_DIR = path.join(app.getPath('userData'), 'licenses');
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const APP_VERSION = '1.0.0';

let db = { admins: [], vips: [], stats: { messages: 0, commands: 0, users: new Set(), dailyStats: {} } };
let botLogs = [];

function ensureDirectories() {
    if (!fs.existsSync(LICENSE_DIR)) fs.mkdirSync(LICENSE_DIR, { recursive: true });
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadDatabase() {
    try {
        const adminsFile = path.join(DATA_DIR, 'admins.json');
        const vipsFile = path.join(DATA_DIR, 'vips.json');
        const statsFile = path.join(DATA_DIR, 'stats.json');
        if (fs.existsSync(adminsFile)) db.admins = JSON.parse(fs.readFileSync(adminsFile, 'utf8'));
        if (fs.existsSync(vipsFile)) db.vips = JSON.parse(fs.readFileSync(vipsFile, 'utf8'));
        if (fs.existsSync(statsFile)) {
            const stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
            db.stats = { ...db.stats, ...stats, users: new Set(stats.users || []) };
        }
    } catch (error) { console.error('Error cargando DB:', error); }
}

function saveDatabase() {
    try {
        fs.writeFileSync(path.join(DATA_DIR, 'admins.json'), JSON.stringify(db.admins, null, 2));
        fs.writeFileSync(path.join(DATA_DIR, 'vips.json'), JSON.stringify(db.vips, null, 2));
        fs.writeFileSync(path.join(DATA_DIR, 'stats.json'), JSON.stringify({ ...db.stats, users: Array.from(db.stats.users) }, null, 2));
    } catch (error) { console.error('Error guardando DB:', error); }
}

function generateSecureHWID() {
    try {
        const machineId = machineIdSync(true);
        const os = await import('os');
        const combinedString = `${machineId}-${os.hostname()}-${os.totalmem()}`;
        const hwidHash = crypto.createHash('sha256').update(combinedString).digest('hex').toUpperCase();
        return `XPE-${hwidHash.substring(0, 16)}-${hwidHash.substring(16, 24)}`;
    } catch (error) { return `XPE-ERROR-${Date.now()}`; }
}

function validateLicense(licenseKey) {
    const demoLicenses = {
        'XPE-ADMIN-MASTER-2025': { type: 'admin', permissions: ['full', 'license', 'bot', 'admins', 'vips', 'broadcast', 'stats'] },
        'XPE-SELLER-PRO-2025': { type: 'seller', permissions: ['bot', 'stats', 'vips'] },
        'XPE-ADMIN-2025': { type: 'admin', permissions: ['full', 'license', 'bot', 'admins', 'vips', 'broadcast', 'stats'] },
        'XPE-SELLER-2025': { type: 'seller', permissions: ['bot', 'stats', 'vips'] },
        'XPE-TEST-2025': { type: 'tester', permissions: ['bot', 'stats'] }
    };
    const license = demoLicenses[licenseKey];
    if (!license) return { valid: false, error: 'LICENCIA NO RECONOCIDA' };
    return { valid: true, type: license.type, permissions: license.permissions, message: 'Licencia activada' };
}

function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    botLogs.push({ time: timestamp, message, type });
    if (botLogs.length > 100) botLogs.shift();
    if (mainWindow) {
        mainWindow.webContents.send('log-update', { logs: botLogs });
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200, height: 750,
        minWidth: 900, minHeight: 600,
        frame: false, backgroundColor: '#0a0a0f',
        show: false,
        webPreferences: {
            nodeIntegration: false, contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.svg')
    });
    mainWindow.loadFile('index.html');
    mainWindow.webContents.on('devtools-opened', () => mainWindow.webContents.closeDevTools());
    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.on('closed', () => { mainWindow = null; app.quit(); });

    // Configurar callbacks del bot
    botEngine.on('qr', (qr) => {
        if (mainWindow) mainWindow.webContents.send('bot-qr', qr);
    });
    
    botEngine.on('status', (status, message) => {
        addLog(message, status === 'connected' ? 'success' : 'info');
        if (mainWindow) mainWindow.webContents.send('bot-status', { status, message });
    });
    
    botEngine.on('message', (msg) => {
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || 'Media';
        const jid = msg.key.remoteJid;
        addLog(`Mensaje de ${jid}: ${text}`, 'info');
        if (mainWindow) mainWindow.webContents.send('bot-message', { jid, text, time: new Date().toLocaleTimeString() });
    });
}

// Handlers IPC
ipcMain.handle('get-hwid', async () => generateSecureHWID());

ipcMain.handle('activate-license', async (event, licenseKey) => {
    const validation = validateLicense(licenseKey);
    if (!validation.valid) return validation;
    isLicenseValidated = true;
    licenseData = { ...validation, hwid: await ipcMain.invoke('get-hwid'), licenseKey };
    fs.writeFileSync(path.join(LICENSE_DIR, 'current.lic'), JSON.stringify(licenseData, null, 2));
    return validation;
});

ipcMain.handle('check-saved-license', async () => {
    try {
        const licenseFile = path.join(LICENSE_DIR, 'current.lic');
        if (!fs.existsSync(licenseFile)) return { valid: false };
        const saved = JSON.parse(fs.readFileSync(licenseFile, 'utf8'));
        isLicenseValidated = true;
        licenseData = saved;
        return { valid: true, type: saved.type, permissions: saved.permissions };
    } catch (error) { return { valid: false }; }
});

ipcMain.handle('get-app-version', () => APP_VERSION);

// Bot Handlers
ipcMain.handle('init-bot', async () => {
    try {
        addLog('Inicializando bot...', 'info');
        await botEngine.start();
        return { success: true, message: 'Bot inicializado' };
    } catch (error) {
        addLog(`Error: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
});

ipcMain.handle('start-bot', async () => {
    try {
        if (botEngine.getStatus() === 'connected') {
            return { success: true, message: 'Bot ya conectado', status: 'connected' };
        }
        await botEngine.start();
        return { success: true, message: 'Conectando...', status: 'connecting' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('stop-bot', async () => {
    botEngine.stop();
    addLog('Bot detenido', 'warning');
    return { success: true, message: 'Bot detenido' };
});

ipcMain.handle('restart-bot', async () => {
    botEngine.stop();
    setTimeout(async () => {
        await botEngine.start();
    }, 1000);
    addLog('Reiniciando bot...', 'info');
    return { success: true, message: 'Reiniciando...' };
});

ipcMain.handle('create-subbot', async () => {
    addLog('Generando QR para sub-bot...', 'info');
    return { success: true, message: 'QR generado' };
});

ipcMain.handle('send-message', async (event, data) => {
    const { jid, message } = data;
    try {
        await botEngine.sendMessage(jid, message);
        addLog(`Enviado a ${jid}: ${message}`, 'success');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-logs', async () => ({ logs: botLogs }));
ipcMain.handle('clear-logs', async () => { botLogs = []; return { success: true }; });

// Database Handlers
ipcMain.handle('admins-get', () => db.admins);
ipcMain.handle('admins-add', (event, data) => {
    if (db.admins.find(a => a.jid === data.jid)) return { success: false, error: 'Ya existe' };
    db.admins.push({ ...data, addedAt: Date.now() });
    saveDatabase();
    return { success: true };
});
ipcMain.handle('admins-remove', (event, jid) => {
    db.admins = db.admins.filter(a => a.jid !== jid);
    saveDatabase();
    return { success: true };
});

ipcMain.handle('vips-get', () => db.vips);
ipcMain.handle('vips-add', (event, data) => {
    const expirationDate = Date.now() + (data.days * 86400000);
    const existingIndex = db.vips.findIndex(v => v.jid === data.jid);
    if (existingIndex !== -1) {
        db.vips[existingIndex] = { ...db.vips[existingIndex], ...data, expirationDate, updatedAt: Date.now() };
    } else {
        db.vips.push({ ...data, expirationDate, activatedAt: Date.now(), status: 'active' });
    }
    saveDatabase();
    return { success: true };
});
ipcMain.handle('vips-remove', (event, jid) => {
    db.vips = db.vips.filter(v => v.jid !== jid);
    saveDatabase();
    return { success: true };
});

ipcMain.handle('stats-get', () => {
    const today = new Date().toISOString().split('T')[0];
    return { totalMessages: db.stats.messages, totalCommands: db.stats.commands, totalUsers: db.stats.users.size, dailyMessages: db.stats.dailyStats[today]?.messages || 0, uptime: process.uptime() };
});

ipcMain.handle('ai-suggest-reply', async (event, data) => {
    const responses = [`Entiendo tu mensaje. ¿Cómo puedo ayudarte mejor?`, `¡Hola! He recibido tu mensaje.`, `Gracias por escribirnos. Un agente te atenderá.`];
    return { success: true, suggestion: responses[Math.floor(Math.random() * responses.length)], sentiment: 'neutral' };
});

ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize(); });
ipcMain.handle('window-close', () => mainWindow?.close());

app.whenReady().then(() => { ensureDirectories(); loadDatabase(); createWindow(); addLog('Panel iniciado', 'info'); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
setInterval(saveDatabase, 60000);
