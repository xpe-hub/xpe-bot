import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';
import os from 'os';
import crypto from 'crypto';
import { machineIdSync } from 'node-machine-id';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración global del proceso del bot
let botProcess = null;
let botLogs = [];
const MAX_LOGS = 100;

// Licencia y base de datos
let mainWindow;
let isLicenseValidated = false;
let licenseData = null;

const LICENSE_DIR = path.join(app.getPath('userData'), 'licenses');
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const APP_VERSION = '1.0.0';

let db = { admins: [], vips: [], stats: { messages: 0, commands: 0, users: new Set(), dailyStats: {} } };

// Archivo de configuración para guardar la ruta del bot
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

// Constantes para archivos seguros y sistemas
const PROTECTED_PATTERNS = [
  /\.env$/i,
  /package-lock\.json$/i,
  /node_modules/i,
  /\.git/i,
  /\.DS_Store$/i
];

const SENSITIVE_PATTERNS = [
  /api_key/i,
  /apikey/i,
  /password/i,
  /secret/i,
  /token/i,
  /auth/i
];

// ========== FUNCIONES DE BASE DE DATOS ==========

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
  const machineId = machineIdSync({ original: true });
  const hash = crypto.createHash('sha256').update(machineId + 'XPE-SALT-2025').digest('hex');
  return 'XPE-' + hash.substring(0, 16).toUpperCase();
}

// ========== FUNCIONES DE LICENCIA ==========

function validateLicense(key) {
  const cleanKey = key.trim().toUpperCase();
  const licenses = {
    'XPE-ADMIN-MASTER-2025': { type: 'ADMIN', permissions: ['*'], days: -1 },
    'XPE-SELLER-PRO-2025': { type: 'SELLER', permissions: ['bot', 'panel'], days: 30 }
  };

  if (licenses[cleanKey]) {
    const lic = licenses[cleanKey];
    return { valid: true, type: lic.type, permissions: lic.permissions, message: `Licencia ${lic.type} activada` };
  }

  const licenseFile = path.join(LICENSE_DIR, `${cleanKey}.json`);
  if (fs.existsSync(licenseFile)) {
    const savedLic = JSON.parse(fs.readFileSync(licenseFile, 'utf8'));
    if (new Date() > new Date(savedLic.expires)) {
      return { valid: false, error: 'Licencia vencida' };
    }
    return { valid: true, type: savedLic.type, permissions: savedLic.permissions, message: `Licencia ${savedLic.type} activada` };
  }

  return { valid: false, error: 'Licencia inválida' };
}

// ========== FUNCIONES DEL BOT ==========

// Función para cargar la configuración
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return { botPath: '', openaiKey: '' };
}

// Función para guardar la configuración
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

// Función para añadir logs
function addLog(type, message) {
  const timestamp = new Date().toLocaleString('es-ES');
  const logEntry = { type, message, timestamp };
  botLogs.push(logEntry);

  if (botLogs.length > MAX_LOGS) {
    botLogs = botLogs.slice(-MAX_LOGS);
  }

  if (mainWindow) {
    mainWindow.webContents.send('bot:log', logEntry);
  }
}

// Función para verificar si un archivo está protegido
function isProtectedFile(filePath) {
  return PROTECTED_PATTERNS.some(pattern => pattern.test(filePath));
}

// Función para verificar si contiene contenido sensible
function containsSensitiveContent(content) {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(content));
}

// Función para crear respaldo antes de escribir
function createBackup(filePath, botPath) {
  try {
    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const relativePath = path.relative(botPath, filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${timestamp}_${relativePath.replace(/[/\\]/g, '_')}.bak`;
    const backupPath = path.join(backupDir, backupFileName);

    fs.copyFileSync(filePath, backupPath);
    addLog('info', `Respaldo creado: ${backupFileName}`);
    return backupPath;
  } catch (error) {
    addLog('error', `Error al crear respaldo: ${error.message}`);
    return null;
  }
}

// Función para obtener estructura de archivos recursivamente
function getFileTree(dir, basePath = '') {
  const result = {
    name: path.basename(dir),
    path: dir,
    relativePath: basePath,
    type: 'directory',
    children: []
  };

  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      if (item.name.startsWith('.') || isProtectedFile(item.name)) {
        continue;
      }

      const fullPath = path.join(dir, item.name);
      const relativePath = basePath ? path.join(basePath, item.name) : item.name;

      if (item.isDirectory()) {
        result.children.push(getFileTree(fullPath, relativePath));
      } else {
        const ext = path.extname(item.name).toLowerCase();
        if (['.js', '.json', '.ts', '.txt', '.md', '.html', '.css'].includes(ext)) {
          result.children.push({
            name: item.name,
            path: fullPath,
            relativePath: relativePath,
            type: 'file',
            extension: ext
          });
        }
      }
    }

    result.children.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });
  } catch (error) {
    addLog('error', `Error al leer directorio ${dir}: ${error.message}`);
  }

  return result;
}

// ========== VENTANA PRINCIPAL ==========

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    backgroundColor: '#1a1a2e',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    if (botProcess) {
      botProcess.kill();
    }
    mainWindow = null;
  });

  return mainWindow;
}

// ========== INICIALIZACIÓN ==========

app.whenReady().then(() => {
  ensureDirectories();
  loadDatabase();
  mainWindow = createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (botProcess) {
    botProcess.kill('SIGTERM');
    botProcess = null;
  }
});

// ========== IPC HANDLERS - LICENCIA ==========

ipcMain.handle('get-hwid', () => {
  return generateSecureHWID();
});

ipcMain.handle('activate-license', (event, key) => {
  const result = validateLicense(key);
  if (result.valid) {
    isLicenseValidated = true;
    licenseData = result;
  }
  return result;
});

ipcMain.handle('check-saved-license', () => {
  return { valid: isLicenseValidated, type: licenseData?.type || null };
});

ipcMain.handle('get-app-version', () => {
  return APP_VERSION;
});

// ========== IPC HANDLERS - BASE DE DATOS ==========

ipcMain.handle('admins-get', () => {
  return db.admins;
});

ipcMain.handle('admins-add', (event, data) => {
  db.admins.push(data);
  saveDatabase();
  return { success: true };
});

ipcMain.handle('admins-remove', (event, jid) => {
  db.admins = db.admins.filter(a => a.jid !== jid);
  saveDatabase();
  return { success: true };
});

ipcMain.handle('vips-get', () => {
  return db.vips;
});

ipcMain.handle('vips-add', (event, data) => {
  db.vips.push(data);
  saveDatabase();
  return { success: true };
});

ipcMain.handle('vips-remove', (event, jid) => {
  db.vips = db.vips.filter(v => v.jid !== jid);
  saveDatabase();
  return { success: true };
});

ipcMain.handle('stats-get', () => {
  return {
    totalMessages: db.stats.messages,
    totalCommands: db.stats.commands,
    totalUsers: db.stats.users.size,
    uptime: process.uptime()
  };
});

// ========== IPC HANDLERS - BOT EXTERNO ==========

ipcMain.handle('bot:save-path', async (event, botPath) => {
  const config = loadConfig();
  config.botPath = botPath;
  const success = saveConfig(config);

  if (success) {
    addLog('success', `Ruta del bot guardada: ${botPath}`);
    return { success: true, message: 'Ruta guardada correctamente' };
  } else {
    return { success: false, message: 'Error al guardar la ruta' };
  }
});

ipcMain.handle('bot:load-path', async () => {
  const config = loadConfig();
  return { path: config.botPath };
});

ipcMain.handle('bot:verify-path', async (event, botPath) => {
  const pathExists = fs.existsSync(botPath);
  const hasPackageJson = fs.existsSync(path.join(botPath, 'package.json'));
  const hasNodeModules = fs.existsSync(path.join(botPath, 'node_modules'));

  return {
    exists: pathExists,
    hasPackageJson,
    hasNodeModules,
    status: pathExists ? (hasPackageJson ? 'valid' : 'missing-package') : 'not-found'
  };
});

ipcMain.handle('dialog:select-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return { path: result.filePaths[0] };
  }
  return { path: null };
});

ipcMain.handle('bot:start-external', async (event, botPath) => {
  if (botProcess) {
    return { success: false, message: 'El bot ya está ejecutándose' };
  }

  if (!fs.existsSync(botPath)) {
    return { success: false, message: 'La ruta del bot no existe' };
  }

  const packagePath = path.join(botPath, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return { success: false, message: 'No se encontró package.json en la ruta especificada' };
  }

  try {
    addLog('info', 'Iniciando bot externo...');
    addLog('info', `Ruta: ${botPath}`);

    botProcess = spawn('node', ['index.js'], {
      cwd: botPath,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    botProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        addLog('info', message);
      }
    });

    botProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        addLog('error', message);
      }
    });

    botProcess.on('close', (code) => {
      if (botProcess) {
        addLog('warning', `El proceso del bot se cerró con código: ${code}`);
        botProcess = null;

        if (mainWindow) {
          mainWindow.webContents.send('bot:stopped', { code });
        }
      }
    });

    botProcess.on('error', (error) => {
      addLog('error', `Error al ejecutar el bot: ${error.message}`);
      botProcess = null;

      if (mainWindow) {
        mainWindow.webContents.send('bot:error', { message: error.message });
      }
    });

    addLog('success', 'Bot iniciado correctamente');
    return { success: true, message: 'Bot iniciado correctamente' };

  } catch (error) {
    addLog('error', `Error al iniciar el bot: ${error.message}`);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('bot:stop-external', async () => {
  if (!botProcess) {
    return { success: false, message: 'No hay ningún bot ejecutándose' };
  }

  try {
    addLog('warning', 'Deteniendo bot...');
    botProcess.kill('SIGTERM');

    const timeout = setTimeout(() => {
      if (botProcess) {
        addLog('error', 'Forzando cierre del bot...');
        botProcess.kill('SIGKILL');
      }
    }, 5000);

    return { success: true, message: 'Señal de detención enviada' };

  } catch (error) {
    addLog('error', `Error al detener el bot: ${error.message}`);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('bot:restart-external', async (event, botPath) => {
  if (botProcess) {
    await ipcMain.handle('bot:stop-external', async () => {
      return { success: true };
    });
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  return await ipcMain.handle('bot:start-external', async () => {
    return { success: true };
  });
});

ipcMain.handle('bot:get-status', async () => {
  return {
    running: botProcess !== null,
    pid: botProcess ? botProcess.pid : null,
    logs: botLogs
  };
});

ipcMain.handle('get-logs', () => {
  return botLogs;
});

ipcMain.handle('clear-logs', () => {
  botLogs = [];
  return { success: true };
});

// ========== IPC HANDLERS - EDITOR DE ARCHIVOS ==========

ipcMain.handle('bot:list-files', async (event, botPath) => {
  if (!fs.existsSync(botPath)) {
    return { success: false, message: 'La ruta del bot no existe', tree: null };
  }

  try {
    const tree = getFileTree(botPath);
    return { success: true, tree };
  } catch (error) {
    addLog('error', `Error al listar archivos: ${error.message}`);
    return { success: false, message: error.message, tree: null };
  }
});

ipcMain.handle('bot:read-file', async (event, filePath) => {
  if (!fs.existsSync(filePath)) {
    return { success: false, message: 'El archivo no existe', content: null };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const isProtected = isProtectedFile(filePath);
    return {
      success: true,
      content,
      fileName: path.basename(filePath),
      isProtected
    };
  } catch (error) {
    addLog('error', `Error al leer archivo: ${error.message}`);
    return { success: false, message: error.message, content: null };
  }
});

ipcMain.handle('bot:write-file', async (event, filePath, content, botPath) => {
  if (!fs.existsSync(filePath)) {
    return { success: false, message: 'El archivo no existe' };
  }

  if (isProtectedFile(filePath)) {
    return {
      success: false,
      message: 'Este archivo está protegido y no puede ser modificado'
    };
  }

  if (containsSensitiveContent(content)) {
    addLog('warning', 'Intento de escribir contenido potencialmente sensible');
  }

  try {
    createBackup(filePath, botPath);
    fs.writeFileSync(filePath, content, 'utf8');
    addLog('success', `Archivo guardado: ${path.basename(filePath)}`);
    return { success: true, message: 'Archivo guardado correctamente' };
  } catch (error) {
    addLog('error', `Error al guardar archivo: ${error.message}`);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('bot:create-file', async (event, botPath, fileName, content) => {
  const filePath = path.join(botPath, fileName);

  if (fs.existsSync(filePath)) {
    return { success: false, message: 'El archivo ya existe' };
  }

  try {
    fs.writeFileSync(filePath, content || '', 'utf8');
    addLog('success', `Archivo creado: ${fileName}`);
    return { success: true, message: 'Archivo creado correctamente', filePath };
  } catch (error) {
    addLog('error', `Error al crear archivo: ${error.message}`);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('bot:delete-file', async (event, filePath, botPath) => {
  if (!fs.existsSync(filePath)) {
    return { success: false, message: 'El archivo no existe' };
  }

  if (isProtectedFile(filePath)) {
    return { success: false, message: 'No se puede eliminar archivos protegidos' };
  }

  try {
    createBackup(filePath, botPath);
    fs.unlinkSync(filePath);
    addLog('warning', `Archivo eliminado: ${path.basename(filePath)}`);
    return { success: true, message: 'Archivo eliminado correctamente' };
  } catch (error) {
    addLog('error', `Error al eliminar archivo: ${error.message}`);
    return { success: false, message: error.message };
  }
});

// ========== IPC HANDLERS - RESPALDOS ==========

ipcMain.handle('bot:list-backups', async () => {
  const backupDir = path.join(__dirname, '..', 'backups');

  if (!fs.existsSync(backupDir)) {
    return { success: true, backups: [] };
  }

  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.bak'))
      .map(f => {
        const fullPath = path.join(backupDir, f);
        const stats = fs.statSync(fullPath);
        return {
          name: f,
          path: fullPath,
          size: stats.size,
          created: stats.birthtime
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    return { success: true, backups: files };
  } catch (error) {
    return { success: false, message: error.message, backups: [] };
  }
});

ipcMain.handle('bot:restore-backup', async (event, backupPath, targetPath) => {
  if (!fs.existsSync(backupPath)) {
    return { success: false, message: 'El respaldo no existe' };
  }

  try {
    const content = fs.readFileSync(backupPath, 'utf8');
    fs.writeFileSync(targetPath, content, 'utf8');
    addLog('success', `Respaldo restaurado: ${path.basename(backupPath)}`);
    return { success: true, message: 'Respaldo restaurado correctamente' };
  } catch (error) {
    addLog('error', `Error al restaurar respaldo: ${error.message}`);
    return { success: false, message: error.message };
  }
});

// ========== IPC HANDLERS - IA ==========

ipcMain.handle('bot:save-api-key', async (event, apiKey) => {
  const config = loadConfig();
  config.openaiKey = apiKey;
  const success = saveConfig(config);

  if (success) {
    addLog('success', 'Clave de API de OpenAI guardada');
    return { success: true, message: 'Clave guardada correctamente' };
  } else {
    return { success: false, message: 'Error al guardar la clave' };
  }
});

ipcMain.handle('bot:load-api-key', async () => {
  const config = loadConfig();
  return { apiKey: config.openaiKey || '' };
});

ipcMain.handle('bot:ai-modify', async (event, filePath, currentContent, instruction) => {
  const config = loadConfig();

  if (!config.openaiKey) {
    return { success: false, message: 'No hay clave de API de OpenAI configurada' };
  }

  try {
    addLog('info', 'IA analizando código...');

    const ext = path.extname(filePath).toLowerCase();
    let languageContext = 'JavaScript';

    if (ext === '.json') languageContext = 'JSON';
    else if (ext === '.ts') languageContext = 'TypeScript';
    else if (ext === '.html') languageContext = 'HTML';
    else if (ext === '.css') languageContext = 'CSS';

    let botContext = 'Node.js';
    if (currentContent.includes('whatsapp-web.js') || currentContent.includes('WWebJS')) {
      botContext = 'whatsapp-web.js';
    } else if (currentContent.includes('baileys') || currentContent.includes('Baileys')) {
      botContext = '@whiskeysockets/baileys';
    }

    const systemPrompt = `Eres un desarrollador senior de Node.js especializado en bots de WhatsApp.

Contexto del proyecto:
- Tipo de bot: ${botContext}
- Lenguaje principal: ${languageContext}

Reglas importantes:
1. Devuelve ÚNICAMENTE el código modificado, sin explicaciones previas ni posteriores
2. Mantén el estilo y formato original del código
3. Si la instrucción no es clara, haz lo mejor que puedas interpretándola
4. No agregues comentarios innecesarios
5. El código debe ser funcional y sintácticamente correcto
6. Si es un archivo JSON, devuélvelo como JSON válido sin markdown

Input actual del archivo:
\`\`\`${languageContext}
${currentContent}
\`\`\`

Instrucción del usuario: "${instruction}"`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: instruction }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Error en la API de OpenAI');
    }

    const data = await response.json();
    const modifiedCode = data.choices[0].message.content;

    let cleanedCode = modifiedCode.trim();
    if (cleanedCode.startsWith('```')) {
      const lines = cleanedCode.split('\n');
      lines.shift();
      if (lines[0]?.startsWith(languageContext.toLowerCase())) {
        lines.shift();
      }
      if (lines[lines.length - 1] === '```') {
        lines.pop();
      }
      cleanedCode = lines.join('\n');
    }

    addLog('success', 'IA generó código modificado');
    return {
      success: true,
      modifiedCode: cleanedCode,
      message: 'Código modificado correctamente'
    };

  } catch (error) {
    addLog('error', `Error con IA: ${error.message}`);
    return { success: false, message: error.message };
  }
});

// ========== IPC HANDLERS - SISTEMA ==========

ipcMain.handle('system:info', async () => {
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
    freeMemory: (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  };
});

ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
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
  mainWindow?.close();
});

ipcMain.handle('send-message', async (event, data) => {
  return { success: false, error: 'Envío directo no disponible en modo externo' };
});

// ========== LISTENERS ==========

ipcMain.on('bot:log', (event, logEntry) => {
  if (mainWindow) {
    mainWindow.webContents.send('bot:log', logEntry);
  }
});

ipcMain.on('bot-qr', (event, qr) => {
  if (mainWindow) {
    mainWindow.webContents.send('bot-qr', qr);
  }
});

ipcMain.on('bot-status', (event, data) => {
  if (mainWindow) {
    mainWindow.webContents.send('bot-status', data);
  }
});

export { loadConfig, saveConfig, addLog };
