// XPE-BOT Panel - Lógica de la Interfaz

let appState = {
    currentUser: null,
    stats: { totalMessages: 0, totalCommands: 0, totalUsers: 0 },
    botPath: '',
    currentFile: null,
    fileTree: null,
    editorContent: '',
    modifiedContent: ''
};

// Elementos
const elements = {
    loginScreen: null,
    mainContent: null,
    usernameInput: null,
    notification: null,
    fileExplorer: null,
    codeEditor: null,
    aiPrompt: null,
    aiResponse: null
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Panel] XPE-BOT Panel iniciado');

    // Cache elementos
    elements.loginScreen = document.getElementById('loginScreen');
    elements.mainContent = document.getElementById('mainContent');
    elements.usernameInput = document.getElementById('usernameInput');
    elements.notification = document.getElementById('notification');
    elements.fileExplorer = document.getElementById('fileExplorer');
    elements.codeEditor = document.getElementById('codeEditor');
    elements.aiPrompt = document.getElementById('aiPrompt');
    elements.aiResponse = document.getElementById('aiResponse');

    // Enter en nombre de usuario
    if (elements.usernameInput) {
        elements.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') login();
        });
    }

    // Verificar usuario guardado
    await checkSavedUser();

    // Cargar ruta guardada del bot
    await loadSavedBotPath();

    // Cargar clave de API
    await loadApiKey();

    // Configurar editor de texto
    setupTextEditor();

    // Escuchar cuando se configure la ruta del bot
    window.electronAPI.onBotPathConfigured((botPath) => {
        if (botPath) {
            appState.botPath = botPath;
            const botPathInput = document.getElementById('botPath');
            const botsViewPath = document.getElementById('botsViewPath');
            if (botPathInput) botPathInput.value = botPath;
            if (botsViewPath) botsViewPath.value = botPath;
            showNotification('Ruta del bot configurada', 'success');
            addLogToBox(`Ruta: ${botPath}`, 'info');
        }
    });

    // Obtener versión
    const version = await window.electronAPI.getAppVersion();
    console.log('[Panel] Version:', version);
});

async function checkSavedUser() {
    try {
        const result = await window.electronAPI.getCurrentUser();
        if (result.user) {
            appState.currentUser = result.user;
            showNotification('¡Bienvenido de nuevo, ' + result.user.username + '!', 'success');
            showMainInterface();
        }
    } catch (error) {
        console.error('[Panel] Error usuario:', error);
    }
}

async function login() {
    const username = elements.usernameInput?.value.trim();

    if (!username) {
        showNotification('Ingresa tu nombre de usuario', 'warning');
        return;
    }

    try {
        showNotification('Iniciando sesión...', 'info');
        const result = await window.electronAPI.loginUser(username);

        if (result.success) {
            appState.currentUser = result.user;
            showNotification(result.message, 'success');
            showMainInterface();
        } else {
            showNotification(result.error || 'Error al iniciar sesión', 'error');
        }
    } catch (error) {
        console.error('[Panel] Error login:', error);
        showNotification('Error al iniciar sesión', 'error');
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
    if (viewName === 'bots') loadBotFiles();
    if (viewName === 'editor') {
        loadBotFiles();
        showEditorEmptyState();
    }
}

// ========== CONFIGURACIÓN DEL BOT EXTERNO ==========

async function loadSavedBotPath() {
    try {
        const result = await window.electronAPI.getBotPath();
        if (result.path) {
            appState.botPath = result.path;
            const botPathInput = document.getElementById('botPath');
            const botsViewPath = document.getElementById('botsViewPath');
            if (botPathInput) botPathInput.value = result.path;
            if (botsViewPath) botsViewPath.value = result.path;
        }
    } catch (error) {
        console.error('[Panel] Error cargando ruta:', error);
    }
}

async function selectBotFolder() {
    try {
        const result = await window.electronAPI.selectBotFolder();
        if (result.path) {
            const botPathInput = document.getElementById('botPath');
            const botsViewPath = document.getElementById('botsViewPath');
            if (botPathInput) botPathInput.value = result.path;
            if (botsViewPath) botsViewPath.value = result.path;
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
            const botPathInput = document.getElementById('botPath');
            if (botPathInput) botPathInput.value = path;
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

// ========== EDITOR DE ARCHIVOS Y IA ==========

async function loadBotFiles() {
    const botPath = appState.botPath || document.getElementById('botsViewPath')?.value.trim();

    if (!botPath) {
        showNotification('Primero configura la ruta del bot', 'warning');
        return;
    }

    try {
        const result = await window.electronAPI.listBotFiles(botPath);

        if (result.success) {
            appState.fileTree = result.tree;
            renderFileTree(result.tree, elements.fileExplorer);
        } else {
            showNotification(result.message || 'Error cargando archivos', 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

function renderFileTree(tree, container) {
    if (!container) return;

    container.innerHTML = '';

    const rootElement = document.createElement('div');
    rootElement.className = 'file-tree-root';
    rootElement.innerHTML = `<div class="tree-toggle expanded">▼</div><span class="tree-folder-name">${tree.name}</span>`;

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';

    if (tree.children && tree.children.length > 0) {
        tree.children.forEach(child => {
            if (child.type === 'directory') {
                childrenContainer.appendChild(createFolderElement(child));
            } else {
                childrenContainer.appendChild(createFileElement(child));
            }
        });
    } else {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'tree-empty';
        emptyMsg.textContent = 'Carpeta vacía';
        childrenContainer.appendChild(emptyMsg);
    }

    rootElement.appendChild(childrenContainer);
    container.appendChild(rootElement);
}

function createFolderElement(folder) {
    const element = document.createElement('div');
    element.className = 'tree-folder';

    const toggle = document.createElement('span');
    toggle.className = 'tree-toggle';
    toggle.textContent = '▶';
    toggle.onclick = (e) => {
        e.stopPropagation();
        toggle.classList.toggle('expanded');
        element.querySelector('.tree-children').style.display =
            toggle.classList.contains('expanded') ? 'block' : 'none';
    };

    const name = document.createElement('span');
    name.className = 'tree-folder-name';
    name.textContent = folder.name;
    name.onclick = () => {
        toggle.click();
    };

    const children = document.createElement('div');
    children.className = 'tree-children';
    children.style.display = 'none';

    if (folder.children && folder.children.length > 0) {
        folder.children.forEach(child => {
            if (child.type === 'directory') {
                children.appendChild(createFolderElement(child));
            } else {
                children.appendChild(createFileElement(child));
            }
        });
    }

    element.appendChild(toggle);
    element.appendChild(name);
    element.appendChild(children);

    return element;
}

function createFileElement(file) {
    const element = document.createElement('div');
    element.className = 'tree-file';
    element.dataset.path = file.path;
    element.dataset.relativePath = file.relativePath;

    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = getFileIcon(file.extension);

    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = file.name;

    element.appendChild(icon);
    element.appendChild(name);

    element.onclick = () => {
        document.querySelectorAll('.tree-file').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        openFileInEditor(file.path, file.relativePath);
    };

    return element;
}

function getFileIcon(extension) {
    const icons = {
        '.js': '📜',
        '.json': '📋',
        '.ts': '📘',
        '.html': '🌐',
        '.css': '🎨',
        '.md': '📝',
        '.txt': '📄'
    };
    return icons[extension] || '📄';
}

async function openFileInEditor(filePath, relativePath) {
    try {
        const result = await window.electronAPI.readFile(filePath);

        if (result.success) {
            appState.currentFile = {
                path: filePath,
                relativePath: relativePath,
                originalContent: result.content,
                isProtected: result.isProtected || false
            };

            appState.editorContent = result.content;
            appState.modifiedContent = result.content;

            showEditorContent(result.content, result.fileName);
            showAIPanel();
            updateEditorStatus();
        } else {
            showNotification(result.message || 'Error leyendo archivo', 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

function setupTextEditor() {
    const editor = elements.codeEditor;
    if (!editor) return;

    editor.addEventListener('input', (e) => {
        appState.modifiedContent = e.target.value;
        updateEditorStatus();
    });

    editor.addEventListener('keydown', (e) => {
        // Ctrl+S para guardar
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveCurrentFile();
        }
        // Tab para indentación
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
            editor.selectionStart = editor.selectionEnd = start + 4;
            appState.modifiedContent = editor.value;
            updateEditorStatus();
        }
    });
}

function showEditorContent(content, fileName) {
    const editor = elements.codeEditor;
    const fileNameDisplay = document.getElementById('currentFileName');

    if (editor) {
        editor.value = content;
        editor.style.display = 'block';
    }

    if (fileNameDisplay) {
        fileNameDisplay.textContent = fileName || 'Sin archivo abierto';
    }

    const emptyState = document.getElementById('editorEmptyState');
    if (emptyState) {
        emptyState.style.display = 'none';
    }
}

function showEditorEmptyState() {
    const editor = elements.codeEditor;
    const fileNameDisplay = document.getElementById('currentFileName');
    const emptyState = document.getElementById('editorEmptyState');

    if (editor) {
        editor.value = '';
        editor.style.display = 'none';
    }

    if (fileNameDisplay) {
        fileNameDisplay.textContent = 'Sin archivo abierto';
    }

    if (emptyState) {
        emptyState.style.display = 'flex';
    }
}

function updateEditorStatus() {
    const statusEl = document.getElementById('editorStatus');
    const saveBtn = document.getElementById('saveFileBtn');

    if (!appState.currentFile) {
        if (statusEl) statusEl.textContent = 'Sin archivo';
        return;
    }

    const isModified = appState.modifiedContent !== appState.editorContent;
    const isProtected = appState.currentFile.isProtected;

    if (statusEl) {
        if (isProtected) {
            statusEl.textContent = 'Solo lectura';
            statusEl.className = 'editor-status protected';
        } else if (isModified) {
            statusEl.textContent = 'Modificado';
            statusEl.className = 'editor-status modified';
        } else {
            statusEl.textContent = 'Guardado';
            statusEl.className = 'editor-status saved';
        }
    }

    if (saveBtn) {
        saveBtn.disabled = isProtected || !isModified;
    }
}

async function saveCurrentFile() {
    if (!appState.currentFile) {
        showNotification('No hay archivo abierto', 'warning');
        return;
    }

    if (appState.currentFile.isProtected) {
        showNotification('Este archivo está protegido', 'error');
        return;
    }

    if (appState.modifiedContent === appState.editorContent) {
        showNotification('No hay cambios que guardar', 'info');
        return;
    }

    try {
        const result = await window.electronAPI.writeFile(
            appState.currentFile.path,
            appState.modifiedContent,
            appState.botPath
        );

        if (result.success) {
            appState.editorContent = appState.modifiedContent;
            updateEditorStatus();
            showNotification('Archivo guardado correctamente', 'success');
        } else {
            showNotification(result.message || 'Error guardando', 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function createNewFile() {
    const fileName = prompt('Nombre del nuevo archivo:', 'nuevo-archivo.js');

    if (!fileName) return;

    const botPath = appState.botPath;
    if (!botPath) {
        showNotification('Primero configura la ruta del bot', 'warning');
        return;
    }

    try {
        const result = await window.electronAPI.createFile(botPath, fileName, '// Nuevo archivo\n');

        if (result.success) {
            showNotification('Archivo creado', 'success');
            loadBotFiles();
            openFileInEditor(result.filePath, fileName);
        } else {
            showNotification(result.message || 'Error creando archivo', 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function deleteCurrentFile() {
    if (!appState.currentFile) {
        showNotification('No hay archivo seleccionado', 'warning');
        return;
    }

    if (appState.currentFile.isProtected) {
        showNotification('No puedes eliminar archivos protegidos', 'error');
        return;
    }

    const confirmDelete = confirm(`¿Eliminar ${appState.currentFile.relativePath}?`);

    if (!confirmDelete) return;

    try {
        const result = await window.electronAPI.deleteFile(
            appState.currentFile.path,
            appState.botPath
        );

        if (result.success) {
            showNotification('Archivo eliminado', 'success');
            appState.currentFile = null;
            showEditorEmptyState();
            loadBotFiles();
        } else {
            showNotification(result.message || 'Error eliminando', 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

async function discardChanges() {
    if (!appState.currentFile) return;

    appState.modifiedContent = appState.editorContent;
    elements.codeEditor.value = appState.editorContent;
    updateEditorStatus();
    showNotification('Cambios descartados', 'info');
}

// ========== PANEL DE IA ==========

function showAIPanel() {
    const aiPanel = document.getElementById('aiPanel');
    const editorSection = document.getElementById('editorSection');

    if (aiPanel) aiPanel.style.display = 'flex';
    if (editorSection) {
        editorSection.style.display = 'grid';
        editorSection.style.gridTemplateColumns = '1fr 350px';
    }
}

function hideAIPanel() {
    const aiPanel = document.getElementById('aiPanel');
    const editorSection = document.getElementById('editorSection');

    if (aiPanel) aiPanel.style.display = 'none';
    if (editorSection) {
        editorSection.style.display = 'block';
    }
}

async function sendToAI() {
    const prompt = elements.aiPrompt?.value.trim();

    if (!prompt) {
        showNotification('Escribe una instrucción', 'warning');
        return;
    }

    if (!appState.currentFile) {
        showNotification('Primero abre un archivo', 'warning');
        return;
    }

    const currentContent = appState.modifiedContent;
    const loadingEl = document.getElementById('aiLoading');
    const responseEl = elements.aiResponse;

    if (loadingEl) loadingEl.style.display = 'flex';
    if (responseEl) responseEl.innerHTML = '';

    try {
        const result = await window.electronAPI.modifyWithAI(
            appState.currentFile.path,
            currentContent,
            prompt
        );

        if (loadingEl) loadingEl.style.display = 'none';

        if (result.success) {
            // Mostrar preview del código
            if (responseEl) {
                responseEl.innerHTML = `
                    <div class="ai-result-header">
                        <span class="ai-status success">✓ Código generado</span>
                        <button class="btn-apply" onclick="applyAIChanges()">Aplicar cambios</button>
                    </div>
                    <div class="ai-code-preview">${escapeHtml(result.modifiedCode)}</div>
                `;
            }
            appState.aiGeneratedCode = result.modifiedCode;
        } else {
            if (responseEl) {
                responseEl.innerHTML = `
                    <div class="ai-result-header">
                        <span class="ai-status error">✗ Error</span>
                    </div>
                    <div class="ai-error">${result.message}</div>
                `;
            }
            showNotification(result.message || 'Error con IA', 'error');
        }
    } catch (error) {
        if (loadingEl) loadingEl.style.display = 'none';
        showNotification('Error: ' + error.message, 'error');
    }
}

function applyAIChanges() {
    if (appState.aiGeneratedCode) {
        appState.modifiedContent = appState.aiGeneratedCode;
        elements.codeEditor.value = appState.aiGeneratedCode;
        updateEditorStatus();

        const responseEl = elements.aiResponse;
        if (responseEl) {
            responseEl.innerHTML = `
                <div class="ai-result-header">
                    <span class="ai-status success">✓ Cambios aplicados</span>
                </div>
                <p class="ai-info">Presiona Ctrl+S para guardar o revisa los cambios antes de guardar.</p>
            `;
        }

        showNotification('Cambios aplicados al editor', 'success');
    }
}

function clearAIPrompt() {
    if (elements.aiPrompt) elements.aiPrompt.value = '';
}

// ========== CONFIGURACIÓN DE API ==========

async function loadApiKey() {
    try {
        const result = await window.electronAPI.loadApiKey();
        const apiKeyInput = document.getElementById('openaiApiKey');

        if (apiKeyInput && result.apiKey) {
            apiKeyInput.value = result.apiKey;
        }
    } catch (error) {
        console.error('[Panel] Error cargando API key:', error);
    }
}

async function saveApiKey() {
    const apiKey = document.getElementById('openaiApiKey')?.value.trim();

    if (!apiKey) {
        showNotification('Ingresa la clave de API', 'warning');
        return;
    }

    try {
        const result = await window.electronAPI.saveApiKey(apiKey);

        if (result.success) {
            showNotification('Clave de API guardada', 'success');
        } else {
            showNotification('Error guardando clave', 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

// ========== RESPALDOS ==========

async function loadBackups() {
    try {
        const result = await window.electronAPI.listBackups();

        if (result.success && result.backups) {
            renderBackupList(result.backups);
        }
    } catch (error) {
        console.error('[Panel] Error cargando respaldos:', error);
    }
}

function renderBackupList(backups) {
    const container = document.getElementById('backupList');

    if (!container) return;

    if (backups.length === 0) {
        container.innerHTML = '<p class="empty-message">No hay respaldos disponibles</p>';
        return;
    }

    container.innerHTML = backups.map(backup => `
        <div class="backup-item" data-path="${backup.path}">
            <div class="backup-info">
                <span class="backup-name">${backup.name}</span>
                <span class="backup-date">${new Date(backup.created).toLocaleString('es-ES')}</span>
            </div>
            <button class="btn-restore" onclick="restoreBackup('${backup.path.replace(/\\/g, '\\\\')}')">Restaurar</button>
        </div>
    `).join('');
}

async function restoreBackup(backupPath) {
    if (!appState.currentFile) {
        showNotification('Primero abre el archivo a restaurar', 'warning');
        return;
    }

    const confirmRestore = confirm('¿Restaurar este respaldo? Se sobrescribirá el archivo actual.');

    if (!confirmRestore) return;

    try {
        const result = await window.electronAPI.restoreBackup(backupPath, appState.currentFile.path);

        if (result.success) {
            showNotification('Respaldo restaurado', 'success');
            openFileInEditor(appState.currentFile.path, appState.currentFile.relativePath);
        } else {
            showNotification(result.message || 'Error restaurando', 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
            const messageInput = document.getElementById('messageInput');
            if (messageInput) messageInput.value = '';
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
window.saveCurrentFile = saveCurrentFile;
window.createNewFile = createNewFile;
window.deleteCurrentFile = deleteCurrentFile;
window.discardChanges = discardChanges;
window.sendToAI = sendToAI;
window.clearAIPrompt = clearAIPrompt;
window.restoreBackup = restoreBackup;
window.saveApiKey = saveApiKey;
window.loadBackups = loadBackups;

// Prevenir menú contextual
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) e.preventDefault();
});
