const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { machineIdSync } = require('node-machine-id');
const crypto = require('crypto');
const childProcess = require('child_process');

let mainWindow;
let botProcess = null;
let botPath = null;
let isLicenseValidated = false;
let licenseData = null;

// Constantes de seguridad
const LICENSE_DIR = path.join(app.getPath('userData'), 'licenses');
const HWID_CACHE_FILE = path.join(app.getPath('userData'), 'hwid.json');
const APP_VERSION = '1.0.0';

// ==========================================
// SISTEMA DE SEGURIDAD HWID
// ==========================================

/**
 * Genera un identificador de hardware único y seguro
 * Combina múltiples fuentes para mayor seguridad
 */
function generateSecureHWID() {
    try {
        // Obtener machine ID base
        const machineId = machineIdSync(true);

        // Información adicional del sistema
        const systemInfo = {
            platform: process.platform,
            arch: process.arch,
            hostname: require('os').hostname(),
            totalMemory: require('os').totalmem(),
            cpus: require('os').cpus().length
        };

        // Crear hash combinado
        const combinedString = `${machineId}-${JSON.stringify(systemInfo)}`;
        const hwidHash = crypto.createHash('sha256')
            .update(combinedString)
            .digest('hex')
            .toUpperCase();

        // Formato: XPE-{HASH}
        return `XPE-${hwidHash.substring(0, 16)}-${hwidHash.substring(16, 24)}`;
    } catch (error) {
        console.error('Error generando HWID:', error);
        return `XPE-ERROR-${Date.now()}`;
    }
}

/**
 * Cachea el HWID para uso offline
 */
function cacheHWID(hwid) {
    try {
        const cacheData = {
            hwid: hwid,
            timestamp: Date.now(),
            expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 días
        };
        fs.writeFileSync(HWID_CACHE_FILE, JSON.stringify(cacheData, null, 2));
    } catch (error) {
        console.error('Error cacheando HWID:', error);
    }
}

/**
 * Recupera el HWID cacheado
 */
function getCachedHWID() {
    try {
        if (fs.existsSync(HWID_CACHE_FILE)) {
            const cacheData = JSON.parse(fs.readFileSync(HWID_CACHE_FILE, 'utf8'));
            if (cacheData.expiresAt > Date.now()) {
                return cacheData.hwid;
            }
        }
    } catch (error) {
        console.error('Error leyendo HWID cacheado:', error);
    }
    return null;
}

// ==========================================
// SISTEMA DE LICENCIAS
// ==========================================

/**
 * Asegura que existe el directorio de licencias
 */
function ensureLicenseDirectory() {
    if (!fs.existsSync(LICENSE_DIR)) {
        fs.mkdirSync(LICENSE_DIR, { recursive: true });
    }
}

/**
 * Guarda una licencia validada localmente
 */
function saveLicense(licenseKey, hwid, type) {
    ensureLicenseDirectory();
    const licenseFile = path.join(LICENSE_DIR, 'current.lic');

    const licenseRecord = {
        licenseKey: licenseKey,
        hwid: hwid,
        type: type,
        activatedAt: Date.now(),
        lastCheck: Date.now(),
        version: APP_VERSION
    };

    fs.writeFileSync(licenseFile, JSON.stringify(licenseRecord, null, 2));
    return licenseRecord;
}

/**
 * Carga la licencia guardada localmente
 */
function loadSavedLicense() {
    try {
        const licenseFile = path.join(LICENSE_DIR, 'current.lic');
        if (fs.existsSync(licenseFile)) {
            return JSON.parse(fs.readFileSync(licenseFile, 'utf8'));
        }
    } catch (error) {
        console.error('Error cargando licencia:', error);
    }
    return null;
}

/**
 * Genera un código de activación para un HWID específico
 * En producción, esto vendría de tu servidor
 */
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

/**
 * Valida una licencia con el HWID del equipo
 */
function validateLicense(licenseKey, currentHWID) {
    // Licencias de demostración (en producción, validar contra servidor)
    const demoLicenses = {
        'XPE-ADMIN-MASTER-2025': {
            type: 'admin',
            permissions: ['full', 'license', 'bot', 'config'],
            hwid: null
        },
        'XPE-SELLER-PRO-2025': {
            type: 'seller',
            permissions: ['bot', 'stats'],
            hwid: null
        },
        'XPE-TESTER-DEMO-2025': {
            type: 'tester',
            permissions: ['bot'],
            hwid: null
        }
    };

    const license = demoLicenses[licenseKey];

    if (!license) {
        return {
            valid: false,
            error: ' LICENCIA NO RECONOCIDA',
            hint: 'Verifica que hayas escrito la licencia correctamente'
        };
    }

    // Si la licencia tiene HWID绑定, verificar coincidencia
    if (license.hwid && license.hwid !== currentHWID) {
        return {
            valid: false,
            error: 'LICENCIA NO VÁLIDA PARA ESTE EQUIPO',
            hint: `Esta licencia está registrada para otro dispositivo`
        };
    }

    return {
        valid: true,
        type: license.type,
        permissions: license.permissions,
        message: 'Licencia activada correctamente'
    };
}

// ==========================================
// DETECCIÓN AUTOMÁTICA DEL BOT
// ==========================================

/**
 * Busca automáticamente la carpeta del bot
 */
function findBotPath() {
    const desktop = require('os').homedir();
    const possiblePaths = [
        path.join(desktop, 'Desktop', 'bot-xpe-nett-completo-v3-WORKING', 'bot-xpe-nett-completo'),
        path.join(desktop, 'Desktop', 'bot-xpe-nett-completo'),
        path.join(desktop, 'Desktop', 'bot-xpe'),
        path.join(__dirname, '..', '..', 'bot-xpe-nett-completo'),
        path.join(__dirname, '..', 'bot'),
        path.join(process.cwd()),
        '.'
    ];

    for (const p of possiblePaths) {
        try {
            const fullPath = path.resolve(p);
            const indexPath = path.join(fullPath, 'index.js');

            if (fs.existsSync(indexPath)) {
                console.log(`[Panel] Bot encontrado en: ${fullPath}`);
                return fullPath;
            }
        } catch (error) {
            continue;
        }
    }

    const fallbackPath = path.join(desktop, 'Desktop', 'bot-xpe-nett-completo');
    if (!fs.existsSync(path.join(fallbackPath, 'index.js'))) {
        fs.mkdirSync(fallbackPath, { recursive: true });
    }

    console.log(`[Panel] Usando ruta por defecto: ${fallbackPath}`);
    return fallbackPath;
}

// ==========================================
// CONTROL DEL BOT
// ==========================================

/**
 * Inicia el proceso del bot
 */
async function startBot() {
    if (botProcess) {
        return { success: false, message: 'El bot ya está ejecutándose' };
    }

    try {
        botPath = findBotPath();

        if (!fs.existsSync(path.join(botPath, 'index.js'))) {
            return {
                success: false,
                message: 'No se encontró index.js en la carpeta del bot',
                hint: 'Verifica la ubicación del bot o reinstala'
            };
        }

        // Usar node directamente para mejor control
        botProcess = childProcess.spawn('node', ['index.js'], {
            cwd: botPath,
            env: { ...process.env, NODE_ENV: 'production' },
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false
        });

        let logBuffer = '';

        botProcess.stdout.on('data', (data) => {
            const logText = data.toString();
            logBuffer += logText;

            // Limitar buffer
            if (logBuffer.length > 10000) {
                logBuffer = logBuffer.substring(logBuffer.length - 5000);
            }

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-log', logText);
                mainWindow.webContents.send('bot-status', 'ejecutando');
            }
        });

        botProcess.stderr.on('data', (data) => {
            const errorText = `[ERROR] ${data.toString()}`;
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-log', errorText);
            }
        });

        botProcess.on('error', (error) => {
            const errorText = `[FATAL] Error al iniciar bot: ${error.message}`;
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-log', errorText);
                mainWindow.webContents.send('bot-status', 'error');
            }
            botProcess = null;
        });

        botProcess.on('close', (code) => {
            const closeText = `[Bot cerrado con código: ${code}]`;
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-log', closeText);
                mainWindow.webContents.send('bot-status', 'detenido');
            }
            botProcess = null;
        });

        console.log(`[Panel] Bot iniciado desde: ${botPath}`);
        return {
            success: true,
            message: 'Bot iniciado correctamente',
            path: botPath
        };

    } catch (error) {
        console.error('[Panel] Error iniciando bot:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Detiene el proceso del bot
 */
function stopBot() {
    if (!botProcess) {
        return { success: false, message: 'El bot no está ejecutándose' };
    }

    try {
        // Intentar apagado graceful primero
        botProcess.kill('SIGTERM');

        // Forzar cierre después de 5 segundos
        setTimeout(() => {
            if (botProcess && !botProcess.killed) {
                botProcess.kill('SIGKILL');
            }
        }, 5000);

        botProcess = null;
        return { success: true, message: 'Bot detenido correctamente' };
    } catch (error) {
        botProcess = null;
        return { success: false, message: error.message };
    }
}

/**
 * Reinicia el bot
 */
async function restartBot() {
    stopBot();
    await new Promise(resolve => setTimeout(resolve, 3000));
    return startBot();
}

// ==========================================
// VENTANA PRINCIPAL
// ==========================================

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 750,
        minWidth: 900,
        minHeight: 650,
        frame: false,
        transparent: false,
        backgroundColor: '#0a0a0f',
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true,
            allowRunningInsecureContent: false
        },
        icon: path.join(__dirname, '..', 'assets', 'icon.svg')
    });

    // Cargar HTML
    mainWindow.loadFile('index.html');

    // Ocultar DevTools en producción
    mainWindow.webContents.on('devtools-opened', () => {
        mainWindow.webContents.closeDevTools();
    });

    // Mostrar ventana cuando esté lista
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Manejar cierre
    mainWindow.on('closed', () => {
        if (botProcess) {
            stopBot();
        }
        mainWindow = null;
    });

    // Prevenir navegación externa
    mainWindow.webContents.on('will-navigate', (event) => {
        event.preventDefault();
    });
}

// ==========================================
// IPC HANDLERS - SEGURIDAD
// ==========================================

// Obtener HWID del equipo
ipcMain.handle('get-hwid', async () => {
    let hwid = getCachedHWID();

    if (!hwid) {
        hwid = generateSecureHWID();
        cacheHWID(hwid);
    }

    return hwid;
});

// Generar código de activación para un HWID
ipcMain.handle('generate-activation', (event, targetHWID) => {
    if (!isLicenseValidated || licenseData?.type !== 'admin') {
        return { success: false, error: 'Solo administradores pueden generar activaciones' };
    }

    const activationCode = generateActivationCode(targetHWID);
    return { success: true, code: activationCode, hwid: targetHWID };
});

// ==========================================
// IPC HANDLERS - LICENCIAS
// ==========================================

// Verificar y activar licencia
ipcMain.handle('activate-license', async (event, licenseKey) => {
    try {
        const currentHWID = await ipcMain.invoke('get-hwid');
        const validation = validateLicense(licenseKey, currentHWID);

        if (!validation.valid) {
            return validation;
        }

        // Guardar licencia
        licenseData = saveLicense(licenseKey, currentHWID, validation.type);
        isLicenseValidated = true;

        return {
            valid: true,
            type: validation.type,
            permissions: validation.permissions,
            message: validation.message
        };

    } catch (error) {
        return { valid: false, error: error.message };
    }
});

// Verificar licencia guardada
ipcMain.handle('check-saved-license', async () => {
    const saved = loadSavedLicense();
    if (!saved) {
        return { valid: false, message: 'No hay licencia guardada' };
    }

    const currentHWID = await ipcMain.invoke('get-hwid');

    // Verificar que el HWID coincida
    if (saved.hwid && saved.hwid !== currentHWID) {
        return {
            valid: false,
            error: 'Licencia no válida para este equipo',
            hint: 'Contacta a soporte para reactivar'
        };
    }

    isLicenseValidated = true;
    licenseData = saved;

    return {
        valid: true,
        type: saved.type,
        permissions: ['full', 'bot', 'stats'],
        message: 'Licencia cargada correctamente'
    };
});

// ==========================================
// IPC HANDLERS - BOT
// ==========================================

// Detectar ruta del bot
ipcMain.handle('find-bot', () => {
    botPath = findBotPath();
    return botPath;
});

// Iniciar bot
ipcMain.handle('start-bot', async () => {
    if (!isLicenseValidated) {
        return { success: false, error: 'Licencia no validada', hint: 'Activa tu licencia primero' };
    }
    return await startBot();
});

// Detener bot
ipcMain.handle('stop-bot', async () => {
    return stopBot();
});

// Reiniciar bot
ipcMain.handle('restart-bot', async () => {
    if (!isLicenseValidated) {
        return { success: false, error: 'Licencia no validada' };
    }
    return await restartBot();
});

// Obtener estado del bot
ipcMain.handle('get-status', () => {
    if (!botProcess) {
        return 'detenido';
    }

    // Verificar si el proceso sigue vivo
    try {
        process.kill(botProcess.pid, 0);
        return 'ejecutando';
    } catch (error) {
        botProcess = null;
        return 'detenido';
    }
});

// ==========================================
// IPC HANDLERS - UTILIDADES
// ==========================================

// Abrir carpeta del bot
ipcMain.handle('open-bot-folder', async () => {
    const folderPath = findBotPath();
    shell.openPath(folderPath);
    return folderPath;
});

// Abrir carpeta de logs
ipcMain.handle('open-logs-folder', async () => {
    const logsPath = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logsPath)) {
        fs.mkdirSync(logsPath, { recursive: true });
    }
    shell.openPath(logsPath);
    return logsPath;
});

// Obtener versión de la app
ipcMain.handle('get-app-version', () => {
    return APP_VERSION;
});

// Abrir enlace externo
ipcMain.handle('open-external', async (event, url) => {
    shell.openExternal(url);
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
    if (botProcess) {
        stopBot();
    }
    if (mainWindow) {
        mainWindow.close();
    }
});

// ==========================================
// INICIALIZACIÓN
// ==========================================

app.whenReady().then(() => {
    console.log('[Panel] XPE-BOT Control Panel iniciado');
    console.log('[Panel] Versión:', APP_VERSION);
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

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
    console.error('[Panel] Error no capturado:', error);
});
