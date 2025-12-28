// XPE-BOT Control Panel - Lógica de la Interfaz
// ==========================================

// Estado de la aplicación
let appState = {
    isLicensed: false,
    licenseType: null,
    hwid: null,
    botStatus: 'detenido',
    botPath: null,
    logs: []
};

// Elementos del DOM
const elements = {
    loginScreen: null,
    sidebar: null,
    dashboard: null,
    licenseKey: null,
    botStatus: null,
    statusIndicator: null,
    botPath: null,
    logsBox: null,
    startBtn: null,
    stopBtn: null,
    notification: null
};

// ==========================================
// INICIALIZACIÓN
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Renderer] Inicializando XPE-BOT Control Panel...');

    // Obtener elementos del DOM
    initializeElements();

    // Configurar event listeners
    setupEventListeners();

    // Verificar licencia guardada
    await checkSavedLicense();

    // Obtener versión de la app
    const version = await window.electronAPI.getAppVersion();
    console.log('[Renderer] Versión de la app:', version);
});

// Inicializar referencias a elementos
function initializeElements() {
    elements.loginScreen = document.getElementById('loginScreen');
    elements.sidebar = document.getElementById('sidebar');
    elements.dashboard = document.getElementById('dashboard');
    elements.licenseKey = document.getElementById('licenseKey');
    elements.botStatus = document.getElementById('botStatus');
    elements.statusIndicator = document.getElementById('statusIndicator');
    elements.botPath = document.getElementById('botPath');
    elements.logsBox = document.getElementById('logsBox');
    elements.startBtn = document.getElementById('startBtn');
    elements.stopBtn = document.getElementById('stopBtn');
    elements.notification = document.getElementById('notification');

    // Escuchar Enter en el campo de licencia
    if (elements.licenseKey) {
        elements.licenseKey.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') login();
        });
    }
}

// Configurar event listeners para IPC
function setupEventListeners() {
    // Logs del bot en tiempo real
    window.electronAPI.onBotLog((data) => {
        addLog(data);
    });

    // Cambios de estado del bot
    window.electronAPI.onBotStatus((status) => {
        updateBotStatus(status);
    });
}

// ==========================================
// SISTEMA DE LICENCIAS
// ==========================================

// Verificar licencia guardada al inicio
async function checkSavedLicense() {
    try {
        const result = await window.electronAPI.checkSavedLicense();

        if (result.valid) {
            appState.isLicensed = true;
            appState.licenseType = result.type;
            showNotification('Licencia restaurada correctamente', 'success');
            showDashboard();
        } else {
            console.log('[Renderer] No hay licencia válida, mostrando pantalla de login');
            showLogin();
        }
    } catch (error) {
        console.error('[Renderer] Error verificando licencia:', error);
        showLogin();
    }
}

// Iniciar sesión con licencia
async function login() {
    const licenseKey = elements.licenseKey.value.trim();

    if (!licenseKey) {
        showNotification('Por favor ingresa tu licencia', 'warning');
        return;
    }

    try {
        showNotification('Validando licencia...', 'info');
        const result = await window.electronAPI.activateLicense(licenseKey);

        if (result.valid) {
            appState.isLicensed = true;
            appState.licenseType = result.type;
            showNotification(result.message, 'success');
            showDashboard();
        } else {
            showNotification(result.error || 'Licencia inválida', 'error');
            if (result.hint) {
                showNotification(result.hint, 'warning');
            }
        }
    } catch (error) {
        console.error('[Renderer] Error activando licencia:', error);
        showNotification('Error al validar licencia', 'error');
    }
}

// Cerrar sesión
function logout() {
    appState.isLicensed = false;
    appState.licenseType = null;
    showLogin();
}

// ==========================================
// NAVEGACIÓN
// ==========================================

function showLogin() {
    if (elements.loginScreen) elements.loginScreen.style.display = 'flex';
    if (elements.sidebar) elements.sidebar.style.display = 'none';
    hideAllDashboards();
}

function showDashboard() {
    if (elements.loginScreen) elements.loginScreen.style.display = 'none';
    if (elements.sidebar) elements.sidebar.style.display = 'flex';

    // Inicializar dashboard
    initializeDashboard();
}

function hideAllDashboards() {
    const dashboards = document.querySelectorAll('.dashboard');
    dashboards.forEach(d => d.classList.remove('active'));
}

function showView(viewName) {
    hideAllDashboards();
    const target = document.getElementById(viewName);
    if (target) {
        target.classList.add('active');
    }

    // Actualizar navegación
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    event.target.closest('.nav-item').classList.add('active');

    // Inicializar vista específica
    if (viewName === 'dashboard') {
        initializeDashboard();
    } else if (viewName === 'generator') {
        initializeGenerator();
    }
}

// ==========================================
// DASHBOARD
// ==========================================

async function initializeDashboard() {
    // Obtener HWID
    appState.hwid = await window.electronAPI.getHWID();
    console.log('[Renderer] HWID:', appState.hwid);

    // Buscar bot
    appState.botPath = await window.electronAPI.findBot();
    if (elements.botPath) {
        elements.botPath.textContent = appState.botPath;
    }

    // Verificar estado actual del bot
    const status = await window.electronAPI.getStatus();
    updateBotStatus(status);
}

function updateBotStatus(status) {
    appState.botStatus = status;

    if (elements.botStatus) {
        elements.botStatus.textContent = status === 'ejecutando' ? 'Ejecutando' : 'Detenido';
        elements.botStatus.className = 'value ' + (status === 'ejecutando' ? 'success' : 'danger');
    }

    if (elements.statusIndicator) {
        elements.statusIndicator.className = 'status-indicator ' + (status === 'ejecutando' ? 'running' : '');
    }

    if (elements.startBtn) elements.startBtn.disabled = status === 'ejecutando';
    if (elements.stopBtn) elements.stopBtn.disabled = status !== 'ejecutando';
}

// ==========================================
// CONTROL DEL BOT
// ==========================================

async function startBot() {
    try {
        showNotification('Iniciando bot...', 'info');
        const result = await window.electronAPI.startBot();

        if (result.success) {
            showNotification(result.message, 'success');
            if (elements.botPath && result.path) {
                elements.botPath.textContent = result.path;
            }
            addLog('[Panel] Bot iniciándose...');
        } else {
            showNotification(result.message, 'error');
            if (result.hint) {
                showNotification(result.hint, 'warning');
            }
        }
    } catch (error) {
        console.error('[Renderer] Error iniciando bot:', error);
        showNotification('Error al iniciar el bot', 'error');
    }
}

async function stopBot() {
    try {
        showNotification('Deteniendo bot...', 'info');
        const result = await window.electronAPI.stopBot();

        if (result.success) {
            showNotification(result.message, 'success');
            addLog('[Panel] Bot detenido');
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        console.error('[Renderer] Error deteniendo bot:', error);
        showNotification('Error al detener el bot', 'error');
    }
}

async function restartBot() {
    try {
        showNotification('Reiniciando bot...', 'info');
        addLog('[Panel] Reiniciando bot...');

        const result = await window.electronAPI.restartBot();

        if (result.success) {
            showNotification(result.message, 'success');
            addLog('[Panel] Bot reiniciado');
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        console.error('[Renderer] Error reiniciando bot:', error);
        showNotification('Error al reiniciar el bot', 'error');
    }
}

function openBotFolder() {
    window.electronAPI.openBotFolder();
}

// ==========================================
// GENERADOR DE LICENCIAS (ADMIN)
// ==========================================

async function initializeGenerator() {
    if (appState.licenseType !== 'admin' && appState.licenseType !== 'tester') {
        showNotification('Solo administradores pueden generar licencias', 'warning');
        showView('dashboard');
        return;
    }

    // El generador ya está en el HTML, solo necesitamos inicializar
    console.log('[Renderer] Generador de licencias inicializado');
}

// ==========================================
// LOGS
// ==========================================

function addLog(text) {
    if (!elements.logsBox) return;

    const timestamp = new Date().toLocaleTimeString('es-ES');
    const logLine = document.createElement('div');
    logLine.className = 'log-line';

    // Determinar tipo de log
    let logType = 'info';
    let displayText = text;

    if (text.includes('[ERROR]') || text.includes('[FATAL]')) {
        logType = 'error';
        displayText = text.replace('[ERROR]', '').replace('[FATAL]', '');
    } else if (text.includes('[Bot cerrado') || text.includes('cerrado')) {
        logType = 'warning';
    } else if (text.includes('[Panel]')) {
        logType = 'success';
        displayText = text;
    }

    logLine.classList.add(logType);
    logLine.innerHTML = `<span class="log-time">[${timestamp}]</span>${displayText.trim()}`;

    elements.logsBox.appendChild(logLine);

    // Auto-scroll
    elements.logsBox.scrollTop = elements.logsBox.scrollHeight;

    // Limitar número de logs
    const maxLogs = 500;
    while (elements.logsBox.children.length > maxLogs) {
        elements.logsBox.removeChild(elements.logsBox.firstChild);
    }
}

// ==========================================
// NOTIFICACIONES
// ==========================================

function showNotification(message, type = 'info') {
    if (!elements.notification) return;

    elements.notification.textContent = message;
    elements.notification.className = 'notification ' + type;
    elements.notification.classList.add('show');

    // Ocultar después de 4 segundos
    setTimeout(() => {
        elements.notification.classList.remove('show');
    }, 4000);
}

// ==========================================
// CONTROLES DE VENTANA
// ==========================================

function minimizeWindow() {
    window.electronAPI.minimize();
}

function maximizeWindow() {
    window.electronAPI.maximize();
}

function closeWindow() {
    window.electronAPI.close();
}

// ==========================================
// UTILIDADES
// ==========================================

// Prevenir clic derecho en producción
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Prevenir atajos de desarrollo
document.addEventListener('keydown', (e) => {
    // F12 - Developer Tools
    if (e.key === 'F12') {
        e.preventDefault();
    }

    // Ctrl+Shift+I - Developer Tools
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
    }

    // Ctrl+U - View Source
    if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
    }

    // Ctrl+S - Save
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
    }
});
