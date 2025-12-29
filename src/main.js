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
  return { botPath: '' };
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

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
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
    // Cerrar el proceso del bot si está corriendo
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
  // Cerrar el proceso del bot antes de salir
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

// IPC: Iniciar bot externo
ipcMain.handle('bot:start-external', async (event, botPath) => {
  if (botProcess) {
    return { success: false, message: 'El bot ya está ejecutándose' };
  }

  // Verificar que la ruta existe
  if (!fs.existsSync(botPath)) {
    return { success: false, message: 'La ruta del bot no existe' };
  }

  // Verificar package.json
  const packagePath = path.join(botPath, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return { success: false, message: 'No se encontró package.json en la ruta especificada' };
  }

  try {
    addLog('info', 'Iniciando bot externo...');
    addLog('info', `Ruta: ${botPath}`);

    // Crear el proceso hijo
    botProcess = spawn('node', ['index.js'], {
      cwd: botPath,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Manejar stdout
    botProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        addLog('info', message);
      }
    });

    // Manejar stderr
    botProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        addLog('error', message);
      }
    });

    // Manejar cierre del proceso
    botProcess.on('close', (code) => {
      if (botProcess) {
        addLog('warning', `El proceso del bot se cerró con código: ${code}`);
        botProcess = null;

        if (mainWindow) {
          mainWindow.webContents.send('bot:stopped', { code });
        }
      }
    });

    // Manejar errores del proceso
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

    // Enviar señal de terminación graceful
    botProcess.kill('SIGTERM');

    // Dar tiempo para que termine gracefully
    const timeout = setTimeout(() => {
      if (botProcess) {
        addLog('error', 'Forzando cierre del bot...');
        botProcess.kill('SIGKILL');
      }
    }, 5000);

    // El proceso se cerrará en el evento 'close'
    return { success: true, message: 'Señal de detención enviada' };

  } catch (error) {
    addLog('error', `Error al detener el bot: ${error.message}`);
    return { success: false, message: error.message };
  }
});

// IPC: Reiniciar bot externo
ipcMain.handle('bot:restart-external', async (event, botPath) => {
  // Primero detener si está corriendo
  if (botProcess) {
    await ipcMain.handle('bot:stop-external', async () => {
      return { success: true };
    });
  }

  // Pequeña pausa antes de reiniciar
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Iniciar nuevamente
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
