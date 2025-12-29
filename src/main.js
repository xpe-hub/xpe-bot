import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración global del proceso del bot
let botProcess = null;
let botLogs = [];
const MAX_LOGS = 100;

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

  // Mantener solo los últimos 100 logs
  if (botLogs.length > MAX_LOGS) {
    botLogs = botLogs.slice(-MAX_LOGS);
  }

  // Enviar el nuevo log al renderer si hay una ventana activa
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
      // Ignorar carpetas y archivos protegidos
      if (item.name.startsWith('.') || isProtectedFile(item.name)) {
        continue;
      }

      const fullPath = path.join(dir, item.name);
      const relativePath = basePath ? path.join(basePath, item.name) : item.name;

      if (item.isDirectory()) {
        result.children.push(getFileTree(fullPath, relativePath));
      } else {
        // Solo incluir archivos de código fuente
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

    // Ordenar: carpetas primero, luego archivos alfabéticamente
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

let mainWindow;

app.whenReady().then(() => {
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

// IPC: Guardar ruta del bot
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

// IPC: Cargar ruta del bot
ipcMain.handle('bot:load-path', async () => {
  const config = loadConfig();
  return { path: config.botPath };
});

// IPC: Verificar si la ruta existe
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

// IPC: Obtener árbol de archivos del bot
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

// IPC: Leer contenido de un archivo
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

// IPC: Escribir contenido a un archivo
ipcMain.handle('bot:write-file', async (event, filePath, content, botPath) => {
  if (!fs.existsSync(filePath)) {
    return { success: false, message: 'El archivo no existe' };
  }

  // Verificar si está protegido
  if (isProtectedFile(filePath)) {
    return {
      success: false,
      message: 'Este archivo está protegido y no puede ser modificado'
    };
  }

  // Verificar contenido sensible
  if (containsSensitiveContent(content)) {
    addLog('warning', 'Intento de escribir contenido potencialmente sensible');
  }

  try {
    // Crear respaldo antes de modificar
    createBackup(filePath, botPath);

    fs.writeFileSync(filePath, content, 'utf8');
    addLog('success', `Archivo guardado: ${path.basename(filePath)}`);
    return { success: true, message: 'Archivo guardado correctamente' };
  } catch (error) {
    addLog('error', `Error al guardar archivo: ${error.message}`);
    return { success: false, message: error.message };
  }
});

// IPC: Crear nuevo archivo
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

// IPC: Eliminar archivo
ipcMain.handle('bot:delete-file', async (event, filePath, botPath) => {
  if (!fs.existsSync(filePath)) {
    return { success: false, message: 'El archivo no existe' };
  }

  if (isProtectedFile(filePath)) {
    return { success: false, message: 'No se puede eliminar archivos protegidos' };
  }

  try {
    // Crear respaldo antes de eliminar
    createBackup(filePath, botPath);
    fs.unlinkSync(filePath);
    addLog('warning', `Archivo eliminado: ${path.basename(filePath)}`);
    return { success: true, message: 'Archivo eliminado correctamente' };
  } catch (error) {
    addLog('error', `Error al eliminar archivo: ${error.message}`);
    return { success: false, message: error.message };
  }
});

// IPC: Obtener respaldos disponibles
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

// IPC: Restaurar respaldo
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

// IPC: Guardar clave de OpenAI
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

// IPC: Cargar clave de OpenAI
ipcMain.handle('bot:load-api-key', async () => {
  const config = loadConfig();
  return { apiKey: config.openaiKey || '' };
});

// IPC: Modificar código con IA
ipcMain.handle('bot:ai-modify', async (event, filePath, currentContent, instruction) => {
  const config = loadConfig();

  if (!config.openaiKey) {
    return { success: false, message: 'No hay clave de API de OpenAI configurada' };
  }

  try {
    addLog('info', 'IA analizando código...');

    // Determinar tipo de archivo para el sistema prompt
    const ext = path.extname(filePath).toLowerCase();
    let languageContext = 'JavaScript';

    if (ext === '.json') languageContext = 'JSON';
    else if (ext === '.ts') languageContext = 'TypeScript';
    else if (ext === '.html') languageContext = 'HTML';
    else if (ext === '.css') languageContext = 'CSS';

    // Intentar detectar qué biblioteca usa el bot
    let botContext = 'Node.js';
    if (currentContent.includes('whatsapp-web.js') || currentContent.includes('WWebJS')) {
      botContext = 'whatsapp-web.js';
    } else if (currentContent.includes('baileys') || currentContent.includes('Baileys')) {
      botContext = '@whiskeysockets/baileys';
    } else if (currentContent.includes('MDD')) {
      botContext = 'Multi-Device';
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

    // Limpiar el código de posible markdown
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

// IPC: Iniciar bot externo
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

// IPC: Detener bot externo
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

// IPC: Reiniciar bot externo
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

// IPC: Obtener estado del bot
ipcMain.handle('bot:get-status', async () => {
  return {
    running: botProcess !== null,
    pid: botProcess ? botProcess.pid : null,
    logs: botLogs
  };
});

// IPC: Obtener logs
ipcMain.handle('bot:get-logs', async () => {
  return botLogs;
});

// IPC: Limpiar logs
ipcMain.handle('bot:clear-logs', async () => {
  botLogs = [];
  return { success: true };
});

// IPC: Seleccionar carpeta
ipcMain.handle('dialog:select-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return { path: result.filePaths[0] };
  }
  return { path: null };
});

// IPC: Información del sistema
ipcMain.handle('system:info', async () => {
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
    freeMemory: (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  };
});

// Exportar para uso en otros módulos
export { loadConfig, saveConfig, addLog };
