const { app, BrowserWindow, ipcMain, shell, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const childProcess = require('child_process');

// Importar motores del bot
const { createBotInstance, botInstances, messageHandlers } = require('./src/bot-engine');

let mainWindow;
let isLicenseValidated = false;
let licenseData = null;

// Constantes de seguridad
const LICENSE_DIR = path.join(app.getPath('userData'), 'licenses');
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const HWID_CACHE_FILE = path.join(app.getPath('userData'), 'hwid.json');
const APP_VERSION = '2.0.0';

// Base de datos local
let db = {
    admins: [],
    vips: [],
    stats: {
        messages: 0,
        commands: 0,
        users: new Set(),
        dailyStats: {}
    }
};

// ==========================================
// SISTEMA DE BASE DE DATOS LOCAL
// ==========================================

function ensureDirectories() {
    const dirs = [LICENSE_DIR, DATA_DIR, path.join(DATA_DIR, 'sessions')];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

function loadDatabase() {
    try {
        const adminsFile = path.join(DATA_DIR, 'admins.json');
        const vipsFile = path.join(DATA_DIR, 'vips.json');
        const statsFile = path.join(DATA_DIR, 'stats.json');

        if (fs.existsSync(adminsFile)) {
            db.admins = JSON.parse(fs.readFileSync(adminsFile, 'utf8'));
        }
        if (fs.existsSync(vipsFile)) {
            db.vips = JSON.parse(fs.readFileSync(vipsFile, 'utf8'));
        }
        if (fs.existsSync(statsFile)) {
            const stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
            db.stats = { ...db.stats, ...stats, users: new Set(stats.users || []) };
        }

        console.log('[Panel] Base de datos cargada');
    } catch (error) {
        console.error('[Panel] Error cargando base de datos:', error);
    }
}

function saveDatabase() {
    try {
        fs.writeFileSync(
            path.join(DATA_DIR, 'admins.json'),
            JSON.stringify(db.admins, null, 2)
        );
        fs.writeFileSync(
            path.join(DATA_DIR, 'vips.json'),
            JSON.stringify(db.vips, null, 2)
        );
        fs.writeFileSync(
            path.join(DATA_DIR, 'stats.json'),
            JSON.stringify({
                ...db.stats,
                users: Array.from(db.stats.users)
            }, null, 2)
        );
    } catch (error) {
        console.error('[Panel] Error guardando base de datos:', error);
    }
}

// ==========================================
// SISTEMA DE SEGURIDAD HWID
// ==========================================

function generateSecureHWID() {
    try {
        const { machineIdSync } = require('node-machine-id');
        const os = require('os');

        const machineId = machineIdSync(true);
        const systemInfo = {
            platform: process.platform,
            hostname: os.hostname(),
            totalMemory: os.totalmem(),
            cpus: os.cpus().length
        };

        const combinedString = `${machineId}-${JSON.stringify(systemInfo)}`;
        const hwidHash = crypto.createHash('sha256')
            .update(combinedString)
            .digest('hex')
            .toUpperCase();

        return `XPE-${hwidHash.substring(0, 16)}-${hwidHash.substring(16, 24)}`;
    } catch (error) {
        return `XPE-ERROR-${Date.now()}`;
    }
}

function cacheHWID(hwid) {
    const cacheData = {
        hwid: hwid,
        timestamp: Date.now(),
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000)
    };
    fs.writeFileSync(HWID_CACHE_FILE, JSON.stringify(cacheData, null, 2));
}

function getCachedHWID() {
    try {
        if (fs.existsSync(HWID_CACHE_FILE)) {
            const cacheData = JSON.parse(fs.readFileSync(HWID_CACHE_FILE, 'utf8'));
            if (cacheData.expiresAt > Date.now()) {
                return cacheData.hwid;
            }
        }
    } catch (error) {}
    return null;
}

// ==========================================
// SISTEMA DE LICENCIAS
// ==========================================

function ensureLicenseDirectory() {
    if (!fs.existsSync(LICENSE_DIR)) {
        fs.mkdirSync(LICENSE_DIR, { recursive: true });
    }
}

function saveLicense(licenseKey, hwid, type, permissions) {
    ensureLicenseDirectory();
    const licenseFile = path.join(LICENSE_DIR, 'current.lic');

    const licenseRecord = {
        licenseKey: licenseKey,
        hwid: hwid,
        type: type,
        permissions: permissions,
        activatedAt: Date.now(),
        lastCheck: Date.now(),
        version: APP_VERSION
    };

    fs.writeFileSync(licenseFile, JSON.stringify(licenseRecord, null, 2));
    return licenseRecord;
}

function loadSavedLicense() {
    try {
        const licenseFile = path.join(LICENSE_DIR, 'current.lic');
        if (fs.existsSync(licenseFile)) {
            return JSON.parse(fs.readFileSync(licenseFile, 'utf8'));
        }
    } catch (error) {}
    return null;
}

function validateLicense(licenseKey, currentHWID) {
    // Licencias de demostración
    const demoLicenses = {
        'XPE-ADMIN-MASTER-2025': {
            type: 'admin',
            permissions: ['full', 'license', 'bot', 'subbots', 'admins', 'vips', 'broadcast', 'ai', 'stats'],
            hwid: null
        },
        'XPE-SELLER-PRO-2025': {
            type: 'seller',
            permissions: ['bot', 'subbots', 'stats', 'vips'],
            hwid: null
        },
        'XPE-TESTER-DEMO-2025': {
            type: 'tester',
            permissions: ['bot', 'stats'],
            hwid: null
        }
    };

    const license = demoLicenses[licenseKey];
    if (!license) {
        return { valid: false, error: 'LICENCIA NO RECONOCIDA', hint: 'Verifica la licencia con XPE-TEAM' };
    }

    return {
        valid: true,
        type: license.type,
        permissions: license.permissions,
        message: 'Licencia activada correctamente'
    };
}

function generateActivationCode(targetHWID) {
    const timestamp = Date.now();
    const signature = crypto
        .createHash('sha256')
        .update(`${targetHWID}-${timestamp}-XPE-SECRET-KEY`)
        .digest('hex')
        .substring(0, 12)
        .toUpperCase();

    return `ACT-${targetHWID.substring(4, 12)}-${signature}-${APP_VERSION}`;
}

// ==========================================
// MOTOR DEL BOT INTEGRADO
// ==========================================

let mainBotInstance = null;

async function initializeMainBot() {
    try {
        mainBotInstance = await createBotInstance('main', (data) => {
            // Enviar logs al panel
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-log', data);
                mainWindow.webContents.send('bot-message', data);
            }
        });

        console.log('[Panel] Bot principal inicializado');
        return { success: true };
    } catch (error) {
        console.error('[Panel] Error inicializando bot:', error);
        return { success: false, error: error.message };
    }
}

function getAllBotInstances() {
    const instances = [];

    if (mainBotInstance) {
        instances.push({
            id: 'main',
            name: 'Bot Principal',
            status: mainBotInstance.status || 'desconectado',
            phone: mainBotInstance.phone || 'No conectado',
            sessions: 1
        });
    }

    Object.keys(botInstances).forEach(botId => {
        if (botId !== 'main' && botInstances[botId]) {
            instances.push({
                id: botId,
                name: `Sub-bot ${botId}`,
                status: botInstances[botId].status || 'desconectado',
                phone: botInstances[botId].phone || 'No conectado',
                sessions: 1
            });
        }
    });

    return instances;
}

// ==========================================
// VENTANA PRINCIPAL
// ==========================================

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        frame: false,
        transparent: false,
        backgroundColor: '#0a0a0f',
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'src', 'preload.js'),
            webSecurity: true
        },
        icon: path.join(__dirname, 'assets', 'icon.svg')
    });

    mainWindow.loadFile('index.html');

    mainWindow.webContents.on('devtools-opened', () => {
        mainWindow.webContents.closeDevTools();
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        // Cerrar todos los bots
        Object.keys(botInstances).forEach(botId => {
            if (botInstances[botId] && botInstances[botId].socket) {
                botInstances[botId].socket.close();
            }
        });
        mainWindow = null;
    });

    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window-state', 'maximized');
    });

    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window-state', 'normal');
    });
}

// ==========================================
// IPC HANDLERS - LICENCIAS
// ==========================================

ipcMain.handle('get-hwid', async () => {
    let hwid = getCachedHWID();
    if (!hwid) {
        hwid = generateSecureHWID();
        cacheHWID(hwid);
    }
    return hwid;
});

ipcMain.handle('generate-activation', (event, targetHWID) => {
    if (!isLicenseValidated || !licenseData?.permissions?.includes('license')) {
        return { success: false, error: 'Solo administradores pueden generar activaciones' };
    }
    return { success: true, code: generateActivationCode(targetHWID), hwid: targetHWID };
});

ipcMain.handle('activate-license', async (event, licenseKey) => {
    const currentHWID = await ipcMain.invoke('get-hwid');
    const validation = validateLicense(licenseKey, currentHWID);

    if (!validation.valid) {
        return validation;
    }

    licenseData = saveLicense(licenseKey, currentHWID, validation.type, validation.permissions);
    isLicenseValidated = true;

    return {
        valid: true,
        type: validation.type,
        permissions: validation.permissions,
        message: validation.message
    };
});

ipcMain.handle('check-saved-license', async () => {
    const saved = loadSavedLicense();
    if (!saved) {
        return { valid: false, message: 'No hay licencia guardada' };
    }

    const currentHWID = await ipcMain.invoke('get-hwid');

    if (saved.hwid && saved.hwid !== currentHWID) {
        return { valid: false, error: 'Licencia no válida para este equipo', hint: 'Contacta a soporte' };
    }

    isLicenseValidated = true;
    licenseData = saved;

    return {
        valid: true,
        type: saved.type,
        permissions: saved.permissions,
        message: 'Licencia cargada correctamente'
    };
});

// ==========================================
// IPC HANDLERS - BOTS
// ==========================================

ipcMain.handle('bot-init', async () => {
    if (!isLicenseValidated) {
        return { success: false, error: 'Licencia no validada' };
    }
    return await initializeMainBot();
});

ipcMain.handle('bot-get-status', () => {
    if (!mainBotInstance) {
        return { status: 'no_inicializado', bots: [] };
    }
    return {
        status: mainBotInstance.status,
        bots: getAllBotInstances()
    };
});

ipcMain.handle('bot-send-message', async (event, { to, message, botId = 'main' }) => {
    if (!isLicenseValidated) {
        return { success: false, error: 'Licencia no validada' };
    }

    try {
        const targetBot = botId === 'main' ? mainBotInstance : botInstances[botId];
        if (!targetBot || !targetBot.socket) {
            return { success: false, error: 'Bot no disponible' };
        }

        await targetBot.socket.sendMessage(to, { text: message });
        return { success: true, message: 'Mensaje enviado' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('bot-create-subbot', async () => {
    if (!isLicenseValidated) {
        return { success: false, error: 'Licencia no validada' };
    }

    try {
        const subbotId = `subbot_${Date.now()}`;
        const subbot = await createBotInstance(subbotId, (data) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-log', `[${subbotId}] ${data}`);
                mainWindow.webContents.send('bot-message', { botId: subbotId, ...data });
            }
        });

        return {
            success: true,
            botId: subbotId,
            qr: subbot.qrCode
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('bot-stop-subbot', async (event, botId) => {
    if (botInstances[botId]) {
        if (botInstances[botId].socket) {
            botInstances[botId].socket.close();
        }
        delete botInstances[botId];
        return { success: true };
    }
    return { success: false, error: 'Sub-bot no encontrado' };
});

// ==========================================
// IPC HANDLERS - ADMINISTRADORES
// ==========================================

ipcMain.handle('admins-get', () => {
    return db.admins;
});

ipcMain.handle('admins-add', (event, { jid, name, role = 'mod' }) => {
    if (!isLicenseValidated || !licenseData?.permissions?.includes('admins')) {
        return { success: false, error: 'Sin permisos' };
    }

    if (db.admins.find(a => a.jid === jid)) {
        return { success: false, error: 'Administrador ya existe' };
    }

    const newAdmin = {
        jid,
        name,
        role,
        addedAt: Date.now(),
        addedBy: licenseData.licenseKey
    };

    db.admins.push(newAdmin);
    saveDatabase();

    return { success: true, admin: newAdmin };
});

ipcMain.handle('admins-remove', (event, jid) => {
    if (!isLicenseValidated || !licenseData?.permissions?.includes('admins')) {
        return { success: false, error: 'Sin permisos' };
    }

    const index = db.admins.findIndex(a => a.jid === jid);
    if (index === -1) {
        return { success: false, error: 'Administrador no encontrado' };
    }

    db.admins.splice(index, 1);
    saveDatabase();

    return { success: true };
});

// ==========================================
// IPC HANDLERS - VIPs
// ==========================================

ipcMain.handle('vips-get', () => {
    return db.vips;
});

ipcMain.handle('vips-add', (event, { jid, name, days = 30, plan = 'premium' }) => {
    if (!isLicenseValidated || !licenseData?.permissions?.includes('vips')) {
        return { success: false, error: 'Sin permisos' };
    }

    const existingIndex = db.vips.findIndex(v => v.jid === jid);
    const expirationDate = Date.now() + (days * 24 * 60 * 60 * 1000);

    if (existingIndex !== -1) {
        // Actualizar existente
        db.vips[existingIndex].expirationDate = expirationDate;
        db.vips[existingIndex].plan = plan;
        db.vips[existingIndex].updatedAt = Date.now();
    } else {
        // Nuevo VIP
        db.vips.push({
            jid,
            name,
            plan,
            expirationDate,
            activatedAt: Date.now(),
            usageCount: 0,
            status: 'active'
        });
    }

    saveDatabase();
    return { success: true };
});

ipcMain.handle('vips-remove', (event, jid) => {
    if (!isLicenseValidated || !licenseData?.permissions?.includes('vips')) {
        return { success: false, error: 'Sin permisos' };
    }

    const index = db.vips.findIndex(v => v.jid === jid);
    if (index === -1) {
        return { success: false, error: 'VIP no encontrado' };
    }

    db.vips.splice(index, 1);
    saveDatabase();

    return { success: true };
});

ipcMain.handle('vips-check', (event, jid) => {
    const vip = db.vips.find(v => v.jid === jid);
    if (!vip) {
        return { isVip: false, reason: 'No es VIP' };
    }

    if (vip.expirationDate < Date.now()) {
        return { isVip: false, reason: 'Suscripción vencida', expiredAt: vip.expirationDate };
    }

    return { isVip: true, plan: vip.plan, expiresAt: vip.expirationDate };
});

// ==========================================
// IPC HANDLERS - MENSAJES Y MONITOREO
// ==========================================

ipcMain.handle('messages-get-recent', () => {
    return messageHandlers.getRecentMessages ? messageHandlers.getRecentMessages(50) : [];
});

ipcMain.handle('messages-clear', () => {
    if (messageHandlers.clearMessages) {
        messageHandlers.clearMessages();
        return { success: true };
    }
    return { success: false };
});

ipcMain.handle('messages-filter', (event, criteria) => {
    // criteria: { type: 'text|image|audio', from: string, botId: string }
    return messageHandlers.filterMessages ? messageHandlers.filterMessages(criteria) : [];
});

// ==========================================
// IPC HANDLERS - ESTADÍSTICAS
// ==========================================

ipcMain.handle('stats-get', () => {
    const today = new Date().toISOString().split('T')[0];

    return {
        totalMessages: db.stats.messages,
        totalCommands: db.stats.commands,
        totalUsers: db.stats.users.size,
        dailyStats: db.stats.dailyStats[today] || { messages: 0, commands: 0 },
        uptime: process.uptime(),
        botStatus: mainBotInstance ? mainBotInstance.status : 'detenido'
    };
});

ipcMain.handle('stats-record-message', (event, data) => {
    db.stats.messages++;
    const today = new Date().toISOString().split('T')[0];

    if (!db.stats.dailyStats[today]) {
        db.stats.dailyStats[today] = { messages: 0, commands: 0 };
    }
    db.stats.dailyStats[today].messages++;

    if (data.from) {
        db.stats.users.add(data.from);
    }

    saveDatabase();
});

ipcMain.handle('stats-record-command', (event, command) => {
    db.stats.commands++;
    const today = new Date().toISOString().split('T')[0];

    if (!db.stats.dailyStats[today]) {
        db.stats.dailyStats[today] = { messages: 0, commands: 0 };
    }
    db.stats.dailyStats[today].commands++;

    saveDatabase();
});

// ==========================================
// IPC HANDLERS - IA
// ==========================================

ipcMain.handle('ai-suggest-reply', async (event, { message, context = '' }) => {
    // Integración básica de IA (simulada)
    // En producción, conectar con OpenAI o servicio local
    const responses = [
        `Entiendo tu mensaje sobre "${message.substring(0, 30)}...". ¿Cómo puedo ayudarte mejor?`,
        `Gracias por escribirnos. Un agente te atenderá pronto.`,
        `¡Hola! He recibido tu mensaje y estoy procesando tu solicitud.`,
        `En breve te respondemos. ¿Hay algo más en lo que pueda ayudarte?`
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    const sentiment = analyzeSentiment(message);

    return {
        success: true,
        suggestion: randomResponse,
        sentiment: sentiment,
        confidence: 0.85
    };
});

function analyzeSentiment(text) {
    const positive = ['gracias', 'excelente', 'genial', 'perfecto', 'amo', 'feliz'];
    const negative = ['problema', 'error', 'fallo', 'pesimo', 'odio', 'urgente'];

    const lowerText = text.toLowerCase();

    if (positive.some(w => lowerText.includes(w))) return 'positive';
    if (negative.some(w => lowerText.includes(w))) return 'negative';
    return 'neutral';
}

// ==========================================
// IPC HANDLERS - UTILIDADES
// ==========================================

ipcMain.handle('get-app-version', () => APP_VERSION);

ipcMain.handle('open-external', (event, url) => {
    shell.openExternal(url);
});

ipcMain.handle('open-folder', async (event, folderPath) => {
    if (!folderPath) {
        folderPath = path.join(app.getPath('userData'), 'data');
    }
    shell.openPath(folderPath);
    return folderPath;
});

// ==========================================
// IPC HANDLERS - VENTANA
// ==========================================

ipcMain.handle('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.handle('window-close', () => {
    if (mainWindow) {
        mainWindow.close();
    }
});

// ==========================================
// INICIALIZACIÓN
// ==========================================

app.whenReady().then(() => {
    // Registrar atajos globales
    globalShortcut.register('CommandOrControl+Shift+K', () => {
        if (mainWindow) {
            mainWindow.webContents.toggleDevTools();
        }
    });

    ensureDirectories();
    loadDatabase();
    console.log('[Panel] XPE-BOT Control Panel v' + APP_VERSION + ' iniciado');
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Guardar base de datos periódicamente
setInterval(saveDatabase, 60000);

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
    console.error('[Panel] Error no capturado:', error);
});
