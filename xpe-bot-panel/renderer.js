// XPE-BOT Panel - Lógica de la Interfaz

let appState = {
    isLicensed: false,
    licenseType: null,
    permissions: [],
    hwid: null,
    stats: { totalMessages: 0, totalCommands: 0, totalUsers: 0 },
    botPath: ''
};

// Elementos
const elements = {
    loginScreen: null,
    mainContent: null,
    licenseInput: null,
    notification: null
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Panel] XPE-BOT Panel iniciado');

    // Cache elementos
    elements.loginScreen = document.getElementById('loginScreen');
    elements.mainContent = document.getElementById('mainContent');
    elements.licenseInput = document.getElementById('licenseInput');
    elements.notification = document.getElementById('notification');

    // Enter en licencia
    if (elements.licenseInput) {
        elements.licenseInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') login();
        });
    }

    // Verificar licencia guardada
    await checkSavedLicense();

    // Cargar ruta guardada del bot
    await loadSavedBotPath();

    // Obtener versión
    const version = await window.electronAPI.getAppVersion();
    console.log('[Panel] Version:', version);
});

async function checkSavedLicense() {
    try {
        const result = await window.electronAPI.checkSavedLicense();
        if (result.valid) {
            appState.isLicensed = true;
            appState.licenseType = result.type;
            showNotification('Licencia: ' + result.type, 'success');
            showMainInterface();
        }
    } catch (error) {
        console.error('[Panel] Error licencia:', error);
    }
}

async function login() {
    const licenseKey = elements.licenseInput?.value.trim();

    if (!licenseKey) {
        showNotification('Ingresa la licencia', 'warning');
        return;
    }

    try {
        showNotification('Validando...', 'info');
        const result = await window.electronAPI.activateLicense(licenseKey);

        if (result.valid) {
            appState.isLicensed = true;
            appState.licenseType = result.type;
            appState.permissions = result.permissions || [];
            showNotification(result.message, 'success');
            showMainInterface();
        } else {
            showNotification(result.error || 'Licencia inválida', 'error');
        }
    } catch (error) {
        console.error('[Panel] Error login:', error);
        showNotification('Error validando', 'error');
    }
}

function showMainInterface() {
    if (elements.loginScreen) elements.loginScreen.style.display = 'none';
    if (elements.mainContent) elements.mainContent.style.display = 'flex';
    loadDashboardData();
}

async function loadDashboardData() {
    try {
        const stats = await window.electronAPI.statsGet();
        appState.stats = stats;

        document.getElementById('statMessages')?.textContent = stats.totalMessages || 0;
        document.getElementById('statCommands')?.textContent = stats.totalCommands || 0;
        document.getElementById('statUsers')?.textContent = stats.totalUsers || 0;
        document.getElementById('statUptime')?.textContent = formatUptime(stats.uptime || 0);
    } catch (error) {
        console.error('[Panel] Error stats:', error);
    }
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

// Navegación
function navigateTo(viewName) {
    document.querySelectorAll('.main-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const target = document.getElementById('view-' + viewName);
    if (target) {
        target.style.display = 'block';
        target.classList.add('active');
    }

    const navItem = document.querySelector(`[data-view="${viewName}"]`);
    if (navItem) navItem.classList.add('active');

    appState.currentView = viewName;

    if (viewName === 'dashboard') loadDashboardData();
}

// ========== CONFIGURACIÓN DEL BOT EXTERNO ==========

async function loadSavedBotPath() {
    try {
        const result = await window.electronAPI.getBotPath();
        if (result.path) {
            appState.botPath = result.path;
            document.getElementById('botPath').value = result.path;
            document.getElementById('botsViewPath').value = result.path;
        }
    } catch (error) {
        console.error('[Panel] Error cargando ruta:', error);
    }
}

async function selectBotFolder() {
    try {
        const result = await window.electronAPI.selectBotFolder();
        if (result.path) {
            document.getElementById('botPath').value = result.path;
            document.getElementById('botsViewPath').value = result.path;
        }
    } catch (error) {
        console.error('[Panel] Error seleccionando carpeta:', error);
    }
}

async function selectBotFolderFromView() {
    await selectBotFolder();
}

async function saveBotPath() {
    const path = document.getElementById('botPath')?.value.trim();
    if (!path) {
        showNotification('Ingresa la ruta del bot', 'warning');
        return;
    }
    
    try {
        const result = await window.electronAPI.saveBotPath(path);
        if (result.success) {
            appState.botPath = path;
            showNotification('Ruta guardada correctamente', 'success');
        } else {
            showNotification('Error guardando ruta', 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function saveBotPathFromView() {
    const path = document.getElementById('botsViewPath')?.value.trim();
    if (!path) {
        showNotification('Ingresa la ruta del bot', 'warning');
        return;
    }
    
    try {
        const result = await window.electronAPI.saveBotPath(path);
        if (result.success) {
            appState.botPath = path;
            document.getElementById('botPath').value = path;
            showNotification('Ruta guardada correctamente', 'success');
        } else {
            showNotification('Error guardando ruta', 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function startExternalBot() {
    const botPath = appState.botPath || document.getElementById('botPath')?.value.trim();
    
    if (!botPath) {
        showNotification('Primero configura la ruta del bot', 'warning');
        navigateTo('bots');
        return;
    }
    
    try {
        showNotification('Iniciando bot...', 'info');
        const result = await window.electronAPI.startExternalBot(botPath);
        
        if (result.success) {
            showNotification('Bot iniciado correctamente', 'success');
            updateStatusIndicator('running');
            addLogToBox(`Bot iniciado desde: ${botPath}`, 'success');
        } else {
            showNotification(result.error || 'Error iniciando bot', 'error');
            addLogToBox(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
        addLogToBox(`Error: ${error.message}`, 'error');
    }
}

async function stopExternalBot() {
    try {
        const result = await window.electronAPI.stopExternalBot();
        if (result.success) {
            showNotification('Bot detenido', 'warning');
            updateStatusIndicator('stopped');
            addLogToBox('Bot detenido', 'warning');
        } else {
            showNotification('Error deteniendo bot', 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

function addLogToBox(message, type = 'info') {
    const logsBox = document.getElementById('logsBox');
    if (logsBox) {
        const timestamp = new Date().toLocaleTimeString('es-ES');
        const logHtml = `<div class="log-line ${type}"><span class="log-time">[${timestamp}]</span>${message}</div>`;
        logsBox.insertAdjacentHTML('afterbegin', logHtml);
    }
}

// ========== ENVÍO DE MENSAJES ==========

async function sendQuickMessage() {
    const jid = document.getElementById('quickJid')?.value;
    const message = document.getElementById('messageInput')?.value;
    
    if (!jid || !message) {
        showNotification('Completa destinatario y mensaje', 'warning');
        return;
    }
    
    try {
        const result = await window.electronAPI.sendMessage({ jid, message });
        if (result.success) {
            showNotification('Mensaje enviado', 'success');
            document.getElementById('messageInput').value = '';
        } else {
            showNotification(result.error || 'Error', 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

function updateStatusIndicator(status) {
    const indicator = document.getElementById('statusIndicator');
    if (indicator) {
        indicator.className = 'status-indicator';
        if (status === 'running' || status === 'connected') indicator.classList.add('running');
        else if (status === 'connecting') indicator.classList.add('connecting');
        else indicator.classList.remove('running', 'connecting');
    }
}

// Notificaciones
function showNotification(message, type = 'info') {
    if (!elements.notification) return;
    elements.notification.textContent = message;
    elements.notification.className = `notification ${type} show`;
    setTimeout(() => elements.notification.classList.remove('show'), 4000);
}

// Window controls
function minimizeWindow() { window.electronAPI.minimize(); }
function maximizeWindow() { window.electronAPI.maximize(); }
function closeWindow() { window.electronAPI.close(); }

// Escuchar eventos del bot
window.electronAPI.onBotLog((data) => {
    addLogToBox(data.message, data.type || 'info');
});

window.electronAPI.onBotStatus((data) => {
    updateStatusIndicator(data.status);
    showNotification(data.message, data.status === 'connected' ? 'success' : 'info');
});

// Funciones globales
window.navigateTo = navigateTo;
window.selectBotFolder = selectBotFolder;
window.selectBotFolderFromView = selectBotFolderFromView;
window.saveBotPath = saveBotPath;
window.saveBotPathFromView = saveBotPathFromView;
window.startExternalBot = startExternalBot;
window.stopExternalBot = stopExternalBot;
window.sendQuickMessage = sendQuickMessage;
window.minimizeWindow = minimizeWindow;
window.maximizeWindow = maximizeWindow;
window.closeWindow = closeWindow;
window.refreshCurrentView = () => { loadDashboardData(); };

// Prevenir menú contextual
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) e.preventDefault();
});
