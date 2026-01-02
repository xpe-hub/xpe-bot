const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');
const { machineIdSync } = require('node-machine-id');

// Usar process.cwd() como替代 de __dirname en CommonJS
const PROJECT_ROOT = process.cwd();

// Configuración global del proceso del bot
let botProcess = null;
let botLogs = [];
const MAX_LOGS = 100;

// Usuario actual
let currentUser = null;

const DATA_DIR = path.join(app.getPath('userData'), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const APP_VERSION = '0.0.1';

let db = { admins: [], vips: [], stats: { messages: 0, commands: 0, users: new Set(), dailyStats: {} } };

// Archivo de configuración para guardar la ruta del bot
const CONFIG_FILE = path.join(PROJECT_ROOT, 'config.json');

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

// ========== FUNCIONES DEL BOT ==========

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

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

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

function isProtectedFile(filePath) {
  return PROTECTED_PATTERNS.some(pattern => pattern.test(filePath));
}

function containsSensitiveContent(content) {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(content));
}

function createBackup(filePath, botPath) {
  try {
    const backupDir = path.join(PROJECT_ROOT, 'backups');
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
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#1a1a2e',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();

    // Pedir ruta del bot al inicio
    setTimeout(async () => {
      const config = loadConfig();
      if (!config.botPath) {
        const result = await dialog.showOpenDialog(mainWindow, {
          title: 'Seleccionar Carpeta del Bot',
          message: 'Por favor selecciona la carpeta donde está tu bot de WhatsApp',
          properties: ['openDirectory']
        });

        if (!result.canceled && result.filePaths.length > 0) {
          const botPath = result.filePaths[0];
          config.botPath = botPath;
          saveConfig(config);
          addLog('success', `Ruta configurada: ${botPath}`);
          mainWindow.webContents.send('bot:path-configured', botPath);
        }
      }
    }, 500);
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

// ========== IPC HANDLERS - USUARIOS ==========

ipcMain.handle('user:login', (event, username) => {
  const cleanUsername = username.trim();
  
  if (!cleanUsername || cleanUsername.length < 2) {
    return { success: false, error: 'El nombre debe tener al menos 2 caracteres' };
  }
  
  try {
    // Cargar usuarios existentes o crear nuevo
    let users = {};
    if (fs.existsSync(USERS_FILE)) {
      try {
        users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      } catch (e) {
        users = {};
      }
    }
    
    // Crear o actualizar usuario
    const now = new Date().toISOString();
    if (!users[cleanUsername]) {
      users[cleanUsername] = {
        username: cleanUsername,
        createdAt: now,
        lastLogin: now,
        loginCount: 1
      };
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } else {
      users[cleanUsername].lastLogin = now;
      users[cleanUsername].loginCount = (users[cleanUsername].loginCount || 0) + 1;
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    }
    
    currentUser = users[cleanUsername];
    
    addLog('success', `Usuario '${cleanUsername}' ha iniciado sesión`);
    return { 
      success: true, 
      user: currentUser,
      message: `¡Bienvenido, ${cleanUsername}!` 
    };
    
  } catch (error) {
    addLog('error', `Error en login: ${error.message}`);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('user:get-current', () => {
  return { user: currentUser };
});

ipcMain.handle('user:get-all', () => {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      return { success: true, users: [] };
    }
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const userList = Object.values(users);
    return { success: true, users: userList };
  } catch (error) {
    return { success: false, error: error.message, users: [] };
  }
});

ipcMain.handle('user:logout', () => {
  currentUser = null;
  return { success: true };
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
  const backupDir = path.join(PROJECT_ROOT, 'backups');

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

// ========== IPC HANDLERS - XPE ASSISTANT (NUEVOS) ==========

ipcMain.handle('ai:chat', async (event, userPrompt, systemPrompt, library) => {
  const config = loadConfig();

  if (!config.openaiKey) {
    return { success: false, message: 'No hay clave de API de OpenAI configurada' };
  }

  try {
    addLog('info', 'XPE Assistant procesando...');

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
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Error en la API de OpenAI');
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    addLog('success', 'XPE Assistant respondió');
    return { success: true, response: aiResponse };

  } catch (error) {
    addLog('error', `Error con XPE Assistant: ${error.message}`);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('ai:generate-code', async (event, request, library, context) => {
  const config = loadConfig();

  if (!config.openaiKey) {
    return { success: false, message: 'No hay clave de API de OpenAI configurada' };
  }

  try {
    addLog('info', 'XPE Assistant generando código...');

    const advancedPrompt = `Eres XPE Assistant, un EXPERTO en bots de WhatsApp especializado en ${library}.

CONTEXTO DEL PROYECTO:
${context || 'Sin contexto adicional'}

PETICIÓN DEL USUARIO:
${request}

REGLAS ESTRICTAS:
1. Genera código COMPLETO y FUNCIONAL
2. Usa sintaxis correcta para ${library}
3. Incluye manejo de errores (try/catch)
4. Añade comentarios en español
5. Si es código nuevo, incluye todo (imports, exports, etc.)
6. Usa async/await correctamente
7. Evita código deprecated
8. Sugiere cómo integrar el código

FORMATO DE RESPUESTA:
- Si hay código, usa bloques \`\`\`javascript ... \`\`\`
- Explica brevemente qué hace el código
- Sugiere dónde colocar el código`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: advancedPrompt },
          { role: 'user', content: request }
        ],
        temperature: 0.5,
        max_tokens: 6000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Error en la API de OpenAI');
    }

    const data = await response.json();
    const generatedCode = data.choices[0].message.content;

    addLog('success', 'Código generado por XPE Assistant');
    return { success: true, response: generatedCode };

  } catch (error) {
    addLog('error', `Error generando código: ${error.message}`);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('ai:analyze-code', async (event, code, library) => {
  const config = loadConfig();

  if (!config.openaiKey) {
    return { success: false, message: 'No hay clave de API de OpenAI configurada' };
  }

  try {
    addLog('info', 'XPE Assistant analizando código...');

    const analyzePrompt = `Analiza el siguiente código de un bot de WhatsApp hecho con ${library}.

CÓDIGO A ANALIZAR:
\`\`\`javascript
${code}
\`\`\`

PROPORCIONA:
1. 📊 RESUMEN: ¿Qué hace este código?
2. ✅ FORTALEZAS: Puntos fuertes del código
3. ⚠️ PROBLEMAS: Errores o mejoras posibles
4. 🔧 OPTIMIZACIONES: Sugerencias específicas
5. 💡 MEJORAS: Ideas para expandir funcionalidad
6. 🔒 SEGURIDAD: Revisa vulnerabilidades

Sé específico y proporciona ejemplos cuando sea posible.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Eres un experto en análisis de código de bots de WhatsApp.' },
          { role: 'user', content: analyzePrompt }
        ],
        temperature: 0.4,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Error en la API de OpenAI');
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    addLog('success', 'Análisis completado');
    return { success: true, response: analysis };

  } catch (error) {
    addLog('error', `Error analizando código: ${error.message}`);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('ai:suggest-command', async (event, commandName, library) => {
  const config = loadConfig();

  if (!config.openaiKey) {
    return { success: false, message: 'No hay clave de API de OpenAI configurada' };
  }

  try {
    addLog('info', `XPE Assistant sugiriendo comando: ${commandName}`);

    const suggestPrompt = `Crea un comando completo para un bot de WhatsApp usando ${library}.

NOMBRE DEL COMANDO: ${commandName}

INCLUYE:
1. ✅ Código completo del comando
2. 📝 Descripción de qué hace
3. 🔧 Uso: cómo se invoca (ej: !${commandName})
4. 📋 Args requeridos/opcionales
5. ⚡ Lógica del comando
6. 💬 Respuestas de ejemplo
7. 🔒 Permisos necesarios (si aplica)
8. 📦 Dependencias externas (si aplica)

Genera TODO el código necesario, listo para copiar y pegar.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Eres un experto en crear comandos para bots de WhatsApp.' },
          { role: 'user', content: suggestPrompt }
        ],
        temperature: 0.5,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Error en la API de OpenAI');
    }

    const data = await response.json();
    const suggestion = data.choices[0].message.content;

    addLog('success', `Sugerencia generada para: ${commandName}`);
    return { success: true, response: suggestion };

  } catch (error) {
    addLog('error', `Error sugiriendo comando: ${error.message}`);
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

// ========== HANDLERS FALTANTES ==========

ipcMain.handle('get-bot-server-url', async () => {
  // Obtener URL del servidor del bot (si existe integración con suki-bot)
  const config = loadConfig();
  if (config.botServerUrl) {
    return { url: config.botServerUrl };
  }
  // Por defecto, asumir que el bot corre en el mismo servidor
  return { url: 'http://localhost:3000' };
});

ipcMain.handle('set-bot-server-url', async (event, url) => {
  const config = loadConfig();
  config.botServerUrl = url;
  const success = saveConfig(config);
  return { success, url };
});

ipcMain.handle('init-bot', async () => {
  return { success: true, message: 'Bot inicializado' };
});

ipcMain.handle('start-bot', async (event, botId) => {
  return { success: true, message: 'Bot iniciado', botId };
});

ipcMain.handle('stop-bot', async (event, botId) => {
  return { success: true, message: 'Bot detenido', botId };
});

ipcMain.handle('restart-bot', async (event, botId) => {
  return { success: true, message: 'Bot reiniciado', botId };
});

ipcMain.handle('create-subbot', async () => {
  return { success: true, message: 'Subbot creado', botId: 'subbot-' + Date.now() };
});

ipcMain.handle('get-bots-status', async () => {
  return {
    running: botProcess !== null,
    pid: botProcess ? botProcess.pid : null,
    status: botProcess ? 'connected' : 'disconnected'
  };
});

ipcMain.handle('ai-suggest-reply', async (event, data) => {
  return { success: true, suggestion: 'Sugerencia de IA: ¡Hola! ¿Cómo puedo ayudarte?' };
});

ipcMain.handle('log-update', async () => {
  return { logs: botLogs };
});

// ========== SISTEMA DE ACTUALIZACIONES ==========

ipcMain.handle('update:check', async () => {
  // Placeholder para checking de actualizaciones
  // En la version completa, esto consultara un servidor o archivo compartido
  return {
    success: true,
    hasUpdate: false,
    currentVersion: APP_VERSION,
    latestVersion: APP_VERSION,
    downloadUrl: null,
    releaseNotes: null
  };
});

ipcMain.handle('update:download', async () => {
  // Placeholder para descargar actualizaciones
  return { success: false, message: 'Sistema de actualizaciones en desarrollo' };
});

ipcMain.handle('update:apply', async () => {
  // Placeholder para aplicar actualizaciones
  return { success: false, message: 'Sistema de actualizaciones en desarrollo' };
});

ipcMain.handle('update:get-config', async () => {
  // Obtener configuracion de actualizaciones
  const updateConfigFile = path.join(DATA_DIR, 'update-config.json');
  try {
    if (fs.existsSync(updateConfigFile)) {
      const config = JSON.parse(fs.readFileSync(updateConfigFile, 'utf8'));
      return { success: true, config };
    }
  } catch (error) { console.error('Error cargando config de actualizaciones:', error); }
  return { success: true, config: { autoCheck: true, channel: 'beta' } };
});

ipcMain.handle('update:save-config', async (event, config) => {
  // Guardar configuracion de actualizaciones
  const updateConfigFile = path.join(DATA_DIR, 'update-config.json');
  try {
    fs.writeFileSync(updateConfigFile, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (error) { console.error('Error guardando config de actualizaciones:', error); }
  return { success: false, error: error.message };
});

// ========== SISTEMA DE NOTIFICACIONES ==========

ipcMain.handle('notification:send', async (event, data) => {
  // Enviar notificacion a todos los usuarios conectados
  // En la version completa, esto se integrara con el bot de WhatsApp
  addLog('info', `Notificacion preparada: ${data.title} - ${data.message}`);
  
  if (mainWindow) {
    mainWindow.webContents.send('notification:received', data);
  }
  
  return { success: true, message: 'Notificacion enviada' };
});

ipcMain.handle('notification:get-history', async () => {
  // Obtener historial de notificaciones
  const notificationsFile = path.join(DATA_DIR, 'notifications.json');
  try {
    if (fs.existsSync(notificationsFile)) {
      const notifications = JSON.parse(fs.readFileSync(notificationsFile, 'utf8'));
      return { success: true, notifications };
    }
  } catch (error) { console.error('Error cargando notificaciones:', error); }
  return { success: true, notifications: [] };
});

ipcMain.handle('notification:mark-read', async (event, notificationId) => {
  // Marcar notificacion como leida
  return { success: true };
});

ipcMain.handle('notification:get-owners', async () => {
  // Obtener lista de owners para notificaciones
  const ownersFile = path.join(DATA_DIR, 'owners.json');
  try {
    if (fs.existsSync(ownersFile)) {
      const owners = JSON.parse(fs.readFileSync(ownersFile, 'utf8'));
      return { success: true, owners };
    }
  } catch (error) { console.error('Error cargando owners:', error); }
  return { success: true, owners: [] };
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

ipcMain.on('bot-message', (event, data) => {
  if (mainWindow) {
    mainWindow.webContents.send('bot-message', data);
  }
});

ipcMain.on('notification:received', (event, data) => {
  if (mainWindow) {
    mainWindow.webContents.send('notification:received', data);
  }
});
