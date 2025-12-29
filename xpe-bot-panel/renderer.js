// XPE-BOT Control Panel - Lógica de la Interfaz Completa
// ==========================================

// Estado de la aplicación
let appState = {
    isLicensed: false,
    licenseType: null,
    permissions: [],
    hwid: null,
    currentView: 'dashboard',
    bots: [],
    selectedBot: 'main',
    messages: [],
    filteredMessages: [],
    stats: {
        totalMessages: 0,
        totalCommands: 0,
        totalUsers: 0,
        dailyMessages: 0,
        dailyCommands: 0,
        uptime: 0
    },
    admins: [],
    vips: [],
    aiSuggestion: null
};

// Elementos del DOM cacheados
const elements = {};

// Configuración de filtros
let messageFilters = {
    type: 'all',
    botId: 'all',
    search: ''
};

// ==========================================
// INICIALIZACIÓN
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Renderer] Inicializando XPE-BOT Control Panel v2.0...');

    cacheElements();
    setupEventListeners();
    setupKeyboardShortcuts();

    // Verificar licencia guardada
    await checkSavedLicense();

    // Obtener versión de la app
    const version = await window.electronAPI.getAppVersion();
    console.log('[Renderer] Versión de la app:', version);
});

function cacheElements() {
    elements.loginScreen = document.getElementById('loginScreen');
    elements.mainContainer = document.getElementById('mainContainer');
    elements.sidebar = document.getElementById('sidebar');
    elements.licenseInput = document.getElementById('licenseInput');
    elements.notification = document.getElementById('notification');
    elements.botStatus = document.getElementById('botStatus');
    elements.statusIndicator = document.getElementById('statusIndicator');
    elements.botsList = document.getElementById('botsList');
    elements.messagesContainer = document.getElementById('messagesContainer');
    elements.logsBox = document.getElementById('logsBox');
    elements.messageInput = document.getElementById('messageInput');
    elements.sendMessageBtn = document.getElementById('sendMessageBtn');
    elements.statsCards = document.getElementById('statsCards');
    elements.adminsList = document.getElementById('adminsList');
    elements.vipsList = document.getElementById('vipsList');
    elements.aiSuggestion = document.getElementById('aiSuggestion');
}

function setupEventListeners() {
    // Licencia - Enter key
    if (elements.licenseInput) {
        elements.licenseInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') login();
        });
    }

    // Mensajes - Enviar con Enter
    if (elements.messageInput) {
        elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendQuickMessage();
            }
        });
    }

    // Botones de acción del bot
    document.getElementById('initBotBtn')?.addEventListener('click', initBot);
    document.getElementById('startBotBtn')?.addEventListener('click', () => startBot('main'));
    document.getElementById('stopBotBtn')?.addEventListener('click', () => stopBot('main'));
    document.getElementById('restartBotBtn')?.addEventListener('click', () => restartBot('main'));

    // Botones de administración
    document.getElementById('addAdminBtn')?.addEventListener('click', showAddAdminModal);
    document.getElementById('addVipBtn')?.addEventListener('click', showAddVipModal);

    // Filtros de mensajes
    document.getElementById('filterType')?.addEventListener('change', applyMessageFilters);
    document.getElementById('filterBot')?.addEventListener('change', applyMessageFilters);
    document.getElementById('messageSearch')?.addEventListener('input', applyMessageFilters);

    // AI
    document.getElementById('aiGenerateBtn')?.addEventListener('click', generateAISuggestion);
    document.getElementById('aiApplyBtn')?.addEventListener('click', applyAISuggestion);
    document.getElementById('aiDismissBtn')?.addEventListener('click', dismissAISuggestion);

    // Broadcast
    document.getElementById('broadcastSendBtn')?.addEventListener('click', sendBroadcast);
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter para enviar mensaje
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            sendQuickMessage();
        }

        // Escape para cerrar modales
        if (e.key === 'Escape') {
            closeAllModals();
        }

        // F5 para actualizar datos
        if (e.key === 'F5' && appState.currentView !== 'login') {
            e.preventDefault();
            refreshCurrentView();
        }
    });
}

// ==========================================
// SISTEMA DE LICENCIAS
// ==========================================

async function checkSavedLicense() {
    try {
        const result = await window.electronAPI.checkSavedLicense();

        if (result.valid) {
            appState.isLicensed = true;
            appState.licenseType = result.type;
            appState.permissions = result.permissions || [];
            showNotification('Licencia restaurada: ' + result.type, 'success');
            showMainInterface();
        } else {
            showLoginScreen();
        }
    } catch (error) {
        console.error('[Renderer] Error verificando licencia:', error);
        showLoginScreen();
    }
}

async function login() {
    const licenseKey = elements.licenseInput?.value.trim();

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
            appState.permissions = result.permissions || [];
            showNotification(result.message, 'success');
            showMainInterface();
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

function showLoginScreen() {
    if (elements.loginScreen) elements.loginScreen.style.display = 'flex';
    if (elements.mainContainer) elements.mainContainer.style.display = 'none';
}

function showMainInterface() {
    if (elements.loginScreen) elements.loginScreen.style.display = 'none';
    if (elements.mainContainer) elements.mainContainer.style.display = 'flex';

    // Inicializar interfaz
    initializeDashboard();
    loadInitialData();
}

// ==========================================
// NAVEGACIÓN
// ==========================================

function navigateTo(viewName) {
    // Actualizar navegación
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');

    // Actualizar vistas
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`view-${viewName}`)?.classList.add('active');

    appState.currentView = viewName;

    // Refrescar según vista
    if (viewName === 'dashboard') {
        refreshDashboard();
    } else if (viewName === 'bots') {
        refreshBotsView();
    } else if (viewName === 'messages') {
        refreshMessagesView();
    } else if (viewName === 'admins') {
        refreshAdminsView();
    } else if (viewName === 'vips') {
        refreshVipsView();
    } else if (viewName === 'broadcast') {
        refreshBroadcastView();
    } else if (viewName === 'stats') {
        refreshStatsView();
    }
}

function refreshCurrentView() {
    navigateTo(appState.currentView);
}

// ==========================================
// DASHBOARD
// ==========================================

async function initializeDashboard() {
    // Obtener HWID
    appState.hwid = await window.electronAPI.getHWID();
    console.log('[Renderer] HWID:', appState.hwid);

    // Inicializar listeners
    window.electronAPI.onBotLog((data) => {
        addLog(data);
    });

    window.electronAPI.onBotStatus((status) => {
        updateBotStatus(status);
    });

    window.electronAPI.onBotMessage((data) => {
        addMessageToList(data);
    });

    // Cargar datos iniciales
    await loadInitialData();
    updateStatsDisplay();
}

async function loadInitialData() {
    try {
        const [bots, stats, admins, vips] = await Promise.all([
            window.electronAPI.botGetStatus(),
            window.electronAPI.statsGet(),
            window.electronAPI.adminsGet(),
            window.electronAPI.vipsGet()
        ]);

        appState.bots = bots.bots || [];
        appState.stats = stats;
        appState.admins = admins || [];
        appState.vips = vips || [];

        updateBotsList();
        updateStatsDisplay();
        updateAdminsList();
        updateVipsList();
    } catch (error) {
        console.error('[Renderer] Error cargando datos:', error);
    }
}

function refreshDashboard() {
    updateBotsList();
    updateStatsDisplay();
}

async function updateStatsDisplay() {
    try {
        const stats = await window.electronAPI.statsGet();
        appState.stats = stats;

        // Actualizar elementos
        document.getElementById('statMessages')?.textContent = formatNumber(stats.totalMessages || 0);
        document.getElementById('statCommands')?.textContent = formatNumber(stats.totalCommands || 0);
        document.getElementById('statUsers')?.textContent = formatNumber(stats.totalUsers || 0);
        document.getElementById('statUptime')?.textContent = formatUptime(stats.uptime || 0);

        // Actualizar estado del bot
        document.getElementById('botStatus')?.textContent = stats.botStatus === 'conectado' ? 'Conectado' : 'Desconectado';
        document.getElementById('botStatus')?.className = 'value ' + (stats.botStatus === 'conectado' ? 'success' : 'danger');
    } catch (error) {
        console.error('[Renderer] Error actualizando estadísticas:', error);
    }
}

// ==========================================
// GESTIÓN DE BOTS
// ==========================================

async function initBot() {
    try {
        showNotification('Inicializando bot principal...', 'info');
        const result = await window.electronAPI.botInit();

        if (result.success) {
            showNotification('Bot inicializado. Esperando conexión...', 'success');
            addLog('[Panel] Bot inicializado. Escanea el QR cuando aparezca.');
        } else {
            showNotification(result.error || 'Error inicializando bot', 'error');
        }
    } catch (error) {
        console.error('[Renderer] Error inicializando bot:', error);
        showNotification('Error al inicializar el bot', 'error');
    }
}

async function startBot(botId) {
    try {
        showNotification(`Iniciando ${botId}...`, 'info');
        const result = await window.electronAPI.botStartSubbot(botId);

        if (result.success) {
            showNotification('Bot iniciado correctamente', 'success');
            addLog(`[Panel] ${botId} iniciado`);
        } else {
            showNotification(result.error || 'Error al iniciar', 'error');
        }
    } catch (error) {
        console.error('[Renderer] Error iniciando bot:', error);
    }
}

async function stopBot(botId) {
    try {
        showNotification(`Deteniendo ${botId}...`, 'info');
        const result = await window.electronAPI.botStopSubbot(botId);

        if (result.success) {
            showNotification('Bot detenido correctamente', 'success');
            addLog(`[Panel] ${botId} detenido`);
        } else {
            showNotification(result.error || 'Error al detener', 'error');
        }
    } catch (error) {
        console.error('[Renderer] Error deteniendo bot:', error);
    }
}

async function restartBot(botId) {
    try {
        showNotification(`Reiniciando ${botId}...`, 'info');
        addLog(`[Panel] Reiniciando ${botId}...`);

        await stopBot(botId);
        await new Promise(r => setTimeout(r, 2000));
        await startBot(botId);
    } catch (error) {
        console.error('[Renderer] Error reiniciando bot:', error);
    }
}

async function createSubBot() {
    try {
        showNotification('Creando sub-bot...', 'info');
        const result = await window.electronAPI.botCreateSubbot();

        if (result.success) {
            showNotification('Sub-bot creado. Escanéa el QR.', 'success');
            addLog(`[Panel] Sub-bot ${result.botId} creado. QR generado.`);

            // Mostrar QR en modal
            showQRModal(result.qr, result.botId);
        } else {
            showNotification(result.error || 'Error al crear sub-bot', 'error');
        }
    } catch (error) {
        console.error('[Renderer] Error creando sub-bot:', error);
        showNotification('Error al crear sub-bot', 'error');
    }
}

function updateBotsList() {
    if (!elements.botsList) return;

    const bots = appState.bots;
    elements.botsList.innerHTML = bots.map(bot => `
        <div class="bot-card ${bot.status === 'conectado' ? 'connected' : ''}" data-bot-id="${bot.id}">
            <div class="bot-header">
                <div class="bot-status-dot ${bot.status === 'conectado' ? 'online' : 'offline'}"></div>
                <span class="bot-name">${bot.name}</span>
                <span class="bot-phone">${bot.phone}</span>
            </div>
            <div class="bot-info">
                <span class="status-text">${getStatusText(bot.status)}</span>
            </div>
            <div class="bot-actions">
                ${bot.status === 'conectado' ?
                    `<button class="btn btn-sm btn-danger" onclick="stopBot('${bot.id}')">Detener</button>` :
                    `<button class="btn btn-sm btn-success" onclick="startBot('${bot.id}')">Iniciar</button>`
                }
                <button class="btn btn-sm btn-secondary" onclick="showBotQR('${bot.id}')">QR</button>
            </div>
        </div>
    `).join('');
}

function getStatusText(status) {
    const statusMap = {
        'conectado': 'En línea',
        'conectando': 'Conectando...',
        'esperando_qr': 'Esperando QR',
        'desconectado': 'Desconectado',
        'sesion_expirada': 'Sesión expirada',
        'no_inicializado': 'No inicializado'
    };
    return statusMap[status] || status;
}

// ==========================================
// MONITOREO DE MENSAJES
// ==========================================

function addMessageToList(data) {
    appState.messages.unshift(data);

    // Mantener límite
    if (appState.messages.length > 200) {
        appState.messages = appState.messages.slice(0, 200);
    }

    // Actualizar vista si está activa
    if (appState.currentView === 'messages') {
        applyMessageFilters();
    }
}

function applyMessageFilters() {
    let filtered = [...appState.messages];

    // Filtrar por tipo
    const filterType = document.getElementById('filterType')?.value || 'all';
    if (filterType !== 'all') {
        if (filterType === 'text') {
            filtered = filtered.filter(m => m.type === 'text' || m.type === 'command');
        } else if (filterType === 'image') {
            filtered = filtered.filter(m => m.type === 'image' || m.type === 'sticker');
        } else if (filterType === 'system') {
            filtered = filtered.filter(m => m.type === 'system');
        }
    }

    // Filtrar por bot
    const filterBot = document.getElementById('filterBot')?.value || 'all';
    if (filterBot !== 'all') {
        filtered = filtered.filter(m => m.botId === filterBot);
    }

    // Filtrar por búsqueda
    const searchTerm = document.getElementById('messageSearch')?.value.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(m =>
            m.content?.toLowerCase().includes(searchTerm) ||
            m.sender?.toLowerCase().includes(searchTerm) ||
            m.senderName?.toLowerCase().includes(searchTerm)
        );
    }

    appState.filteredMessages = filtered;
    renderMessagesList();
}

function renderMessagesList() {
    if (!elements.messagesContainer) return;

    const messages = appState.filteredMessages;

    if (messages.length === 0) {
        elements.messagesContainer.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">💬</span>
                <p>No hay mensajes que mostrar</p>
                <p class="text-muted">Los mensajes aparecerán aquí cuando el bot reciba actividad</p>
            </div>
        `;
        return;
    }

    elements.messagesContainer.innerHTML = messages.map(msg => `
        <div class="message-item ${msg.type}" data-id="${msg.id || Date.now()}">
            <div class="message-header">
                <span class="message-type">${getMessageTypeIcon(msg.type)}</span>
                <span class="message-sender">${msg.senderName || msg.sender}</span>
                <span class="message-bot">[${msg.botId || 'main'}]</span>
                <span class="message-time">${formatTime(msg.timestamp || Date.now())}</span>
            </div>
            <div class="message-content">${escapeHtml(msg.content || msg.body || '')}</div>
        </div>
    `).join('');
}

function getMessageTypeIcon(type) {
    const icons = {
        'text': '💬',
        'image': '🖼️',
        'video': '🎬',
        'audio': '🎵',
        'sticker': '⭐',
        'document': '📄',
        'command': '⚡',
        'system': '🔧',
        'contact': '👤',
        'location': '📍'
    };
    return icons[type] || '📱';
}

function refreshMessagesView() {
    applyMessageFilters();
}

async function clearMessages() {
    await window.electronAPI.messagesClear();
    appState.messages = [];
    appState.filteredMessages = [];
    renderMessagesList();
    showNotification('Mensajes清除ados', 'success');
}

// ==========================================
// ENVÍO DE MENSAJES
// ==========================================

async function sendQuickMessage() {
    const to = document.getElementById('quickJid')?.value.trim();
    const message = elements.messageInput?.value.trim();

    if (!to) {
        showNotification('Ingresa el número destino', 'warning');
        return;
    }

    if (!message) {
        showNotification('Ingresa el mensaje', 'warning');
        return;
    }

    try {
        const result = await window.electronAPI.botSendMessage({
            to: to.includes('@') ? to : `${to}@s.whatsapp.net`,
            message: message,
            botId: appState.selectedBot
        });

        if (result.success) {
            showNotification('Mensaje enviado', 'success');
            elements.messageInput.value = '';

            // Agregar al log
            addLog(`[Enviado a ${to}] ${message}`);
        } else {
            showNotification(result.error || 'Error al enviar', 'error');
        }
    } catch (error) {
        console.error('[Renderer] Error enviando mensaje:', error);
        showNotification('Error al enviar mensaje', 'error');
    }
}

// ==========================================
// ADMINISTRADORES
// ==========================================

async function refreshAdminsView() {
    try {
        const admins = await window.electronAPI.adminsGet();
        appState.admins = admins || [];
        updateAdminsList();
    } catch (error) {
        console.error('[Renderer] Error cargando administradores:', error);
    }
}

function updateAdminsList() {
    if (!elements.adminsList) return;

    const admins = appState.admins;

    if (admins.length === 0) {
        elements.adminsList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">👥</span>
                <p>No hay administradores</p>
                <button class="btn btn-primary mt-2" onclick="showAddAdminModal()">Agregar Admin</button>
            </div>
        `;
        return;
    }

    elements.adminsList.innerHTML = admins.map(admin => `
        <div class="admin-card">
            <div class="admin-info">
                <span class="admin-name">${escapeHtml(admin.name)}</span>
                <span class="admin-jid">${admin.jid}</span>
                <span class="admin-role badge badge-${admin.role}">${admin.role}</span>
            </div>
            <div class="admin-actions">
                <button class="btn btn-sm btn-danger" onclick="removeAdmin('${admin.jid}')">Eliminar</button>
            </div>
        </div>
    `).join('');
}

async function showAddAdminModal() {
    const jid = prompt('Ingresa el JID del administrador (ej: 54911xxxxx@s.whatsapp.net):');
    if (!jid) return;

    const name = prompt('Ingresa el nombre del administrador:');
    if (!name) return;

    try {
        const result = await window.electronAPI.adminsAdd({ jid, name, role: 'mod' });

        if (result.success) {
            showNotification('Administrador agregado', 'success');
            refreshAdminsView();
        } else {
            showNotification(result.error || 'Error al agregar', 'error');
        }
    } catch (error) {
        console.error('[Renderer] Error agregando admin:', error);
    }
}

async function removeAdmin(jid) {
    if (!confirm('¿Estás seguro de eliminar este administrador?')) return;

    try {
        const result = await window.electronAPI.adminsRemove(jid);

        if (result.success) {
            showNotification('Administrador eliminado', 'success');
            refreshAdminsView();
        } else {
            showNotification(result.error || 'Error al eliminar', 'error');
        }
    } catch (error) {
        console.error('[Renderer] Error eliminando admin:', error);
    }
}

// ==========================================
// VIPs
// ==========================================

async function refreshVipsView() {
    try {
        const vips = await window.electronAPI.vipsGet();
        appState.vips = vips || [];
        updateVipsList();
    } catch (error) {
        console.error('[Renderer] Error cargando VIPs:', error);
    }
}

function updateVipsList() {
    if (!elements.vipsList) return;

    const vips = appState.vips;

    if (vips.length === 0) {
        elements.vipsList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⭐</span>
                <p>No hay usuarios VIP</p>
                <button class="btn btn-primary mt-2" onclick="showAddVipModal()">Agregar VIP</button>
            </div>
        `;
        return;
    }

    elements.vipsList.innerHTML = vips.map(vip => `
        <div class="vip-card">
            <div class="vip-info">
                <span class="vip-name">${escapeHtml(vip.name)}</span>
                <span class="vip-jid">${vip.jid}</span>
                <div class="vip-details">
                    <span class="badge badge-${vip.plan}">${vip.plan}</span>
                    <span class="vip-expiry">Expira: ${formatDate(vip.expirationDate)}</span>
                </div>
            </div>
            <div class="vip-actions">
                <button class="btn btn-sm btn-danger" onclick="removeVip('${vip.jid}')">Eliminar</button>
            </div>
        </div>
    `).join('');
}

async function showAddVipModal() {
    const jid = prompt('Ingresa el JID del usuario VIP:');
    if (!jid) return;

    const name = prompt('Ingresa el nombre del usuario:');
    if (!name) return;

    const days = parseInt(prompt('Días de membresía (default 30):') || '30');

    try {
        const result = await window.electronAPI.vipsAdd({ jid, name, days, plan: 'premium' });

        if (result.success) {
            showNotification('VIP agregado correctamente', 'success');
            refreshVipsView();
        } else {
            showNotification(result.error || 'Error al agregar', 'error');
        }
    } catch (error) {
        console.error('[Renderer] Error agregando VIP:', error);
    }
}

async function removeVip(jid) {
    if (!confirm('¿Estás seguro de eliminar este usuario VIP?')) return;

    try {
        const result = await window.electronAPI.vipsRemove(jid);

        if (result.success) {
            showNotification('VIP eliminado', 'success');
            refreshVipsView();
        } else {
            showNotification(result.error || 'Error al eliminar', 'error');
        }
    } catch (error) {
        console.error('[Renderer] Error eliminando VIP:', error);
    }
}

// ==========================================
// IA
// ==========================================

async function generateAISuggestion() {
    const lastMessages = appState.messages
        .filter(m => m.type === 'text')
        .slice(0, 5);

    const context = lastMessages.map(m => `${m.senderName}: ${m.content}`).join('\n');

    try {
        showNotification('IA analizando...', 'info');
        const result = await window.electronAPI.aiSuggestReply({
            message: context || 'Hola, necesito información',
            context: context
        });

        if (result.success) {
            appState.aiSuggestion = result.suggestion;

            if (elements.aiSuggestion) {
                elements.aiSuggestion.innerHTML = `
                    <div class="ai-result">
                        <div class="ai-header">
                            <span class="ai-icon">🤖</span>
                            <span class="ai-sentiment badge badge-${result.sentiment}">${result.sentiment}</span>
                        </div>
                        <p class="ai-suggestion-text">${escapeHtml(result.suggestion)}</p>
                        <div class="ai-actions">
                            <button class="btn btn-sm btn-primary" id="aiApplyBtn">Usar</button>
                            <button class="btn btn-sm btn-secondary" id="aiDismissBtn">Descartar</button>
                        </div>
                    </div>
                `;
                elements.aiSuggestion.style.display = 'block';

                document.getElementById('aiApplyBtn')?.addEventListener('click', applyAISuggestion);
                document.getElementById('aiDismissBtn')?.addEventListener('click', dismissAISuggestion);
            }
        } else {
            showNotification(result.error || 'Error de IA', 'error');
        }
    } catch (error) {
        console.error('[Renderer] Error en IA:', error);
        showNotification('Error generando sugerencia', 'error');
    }
}

function applyAISuggestion() {
    if (appState.aiSuggestion && elements.messageInput) {
        elements.messageInput.value = appState.aiSuggestion;
        dismissAISuggestion();
    }
}

function dismissAISuggestion() {
    appState.aiSuggestion = null;
    if (elements.aiSuggestion) {
        elements.aiSuggestion.style.display = 'none';
    }
}

// ==========================================
// BROADCAST
// ==========================================

async function refreshBroadcastView() {
    // Poblar lista de destinatarios
    const recipientsList = document.getElementById('broadcastRecipients');
    if (recipientsList && appState.vips.length > 0) {
        recipientsList.innerHTML = appState.vips.map(vip => `
            <label class="recipient-item">
                <input type="checkbox" value="${vip.jid}" checked>
                <span>${escapeHtml(vip.name)} (${vip.plan})</span>
            </label>
        `).join('');
    }
}

async function sendBroadcast() {
    const message = document.getElementById('broadcastMessage')?.value.trim();
    if (!message) {
        showNotification('Ingresa el mensaje', 'warning');
        return;
    }

    const checkboxes = document.querySelectorAll('#broadcastRecipients input:checked');
    const recipients = Array.from(checkboxes).map(cb => cb.value);

    if (recipients.length === 0) {
        showNotification('Selecciona destinatarios', 'warning');
        return;
    }

    try {
        showNotification(`Enviando a ${recipients.length} destinatarios...`, 'info');

        for (const recipient of recipients) {
            await window.electronAPI.botSendMessage({
                to: recipient,
                message: message,
                botId: appState.selectedBot
            });

            // Pequeña pausa entre mensajes
            await new Promise(r => setTimeout(r, 500));
        }

        showNotification(`Mensaje enviado a ${recipients.length} destinatarios`, 'success');
        document.getElementById('broadcastMessage').value = '';
    } catch (error) {
        console.error('[Renderer] Error en broadcast:', error);
        showNotification('Error en envío masivo', 'error');
    }
}

// ==========================================
// ESTADÍSTICAS
// ==========================================

async function refreshStatsView() {
    try {
        const stats = await window.electronAPI.statsGet();

        // Gráfico de mensajes por día (simulado)
        const chartContainer = document.getElementById('statsChart');
        if (chartContainer) {
            const dailyData = Object.entries(stats.dailyStats || {}).slice(-7);
            chartContainer.innerHTML = `
                <div class="chart-placeholder">
                    <h3>Mensajes últimos 7 días</h3>
                    <div class="chart-bars">
                        ${dailyData.map(([date, data]) => `
                            <div class="chart-bar">
                                <div class="bar-value" style="height: ${Math.min((data.messages / 100) * 100, 100)}%">
                                    ${data.messages}
                                </div>
                                <div class="bar-label">${formatShortDate(date)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Actualizar KPIs
        document.getElementById('statTotalMessages')?.textContent = formatNumber(stats.totalMessages || 0);
        document.getElementById('statTotalCommands')?.textContent = formatNumber(stats.totalCommands || 0);
        document.getElementById('statTotalUsers')?.textContent = formatNumber(stats.totalUsers || 0);
        document.getElementById('statDailyMessages')?.textContent = formatNumber(stats.dailyStats?.messages || 0);
        document.getElementById('statBotUptime')?.textContent = formatUptime(stats.uptime || 0);

    } catch (error) {
        console.error('[Renderer] Error cargando estadísticas:', error);
    }
}

// ==========================================
// LOGS
// ==========================================

function addLog(text) {
    if (!elements.logsBox) return;

    const timestamp = new Date().toLocaleTimeString('es-ES');
    const logLine = document.createElement('div');
    logLine.className = 'log-line';

    let logType = 'info';
    let displayText = text;

    if (text.includes('[ERROR]') || text.includes('[FATAL]')) {
        logType = 'error';
        displayText = text.replace('[ERROR]', '').replace('[FATAL]', '');
    } else if (text.includes('[Panel]')) {
        logType = 'success';
    } else if (text.includes('[Bot cerrado')) {
        logType = 'warning';
    }

    logLine.classList.add(logType);
    logLine.innerHTML = `<span class="log-time">[${timestamp}]</span>${displayText.trim()}`;

    elements.logsBox.appendChild(logLine);
    elements.logsBox.scrollTop = elements.logsBox.scrollHeight;

    // Limitar logs
    while (elements.logsBox.children.length > 500) {
        elements.logsBox.removeChild(elements.logsBox.firstChild);
    }
}

// ==========================================
// MODALES Y UI
// ==========================================

function showQRModal(qrCode, botId) {
    const modal = document.getElementById('qrModal');
    const qrContainer = document.getElementById('qrContainer');

    if (modal && qrContainer) {
        // Generar QR code (usando API externa o canvas)
        qrContainer.innerHTML = `
            <div class="qr-placeholder">
                <p>QR Code para ${botId}</p>
                <p class="text-muted">Escanea con WhatsApp</p>
            </div>
        `;
        modal.style.display = 'flex';
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// ==========================================
// UTILIDADES
// ==========================================

function showNotification(message, type = 'info') {
    if (!elements.notification) return;

    elements.notification.textContent = message;
    elements.notification.className = `notification ${type} show`;

    setTimeout(() => {
        elements.notification.classList.remove('show');
    }, 4000);
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

function formatTime(timestamp) {
    return new Date(timestamp * 1000).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('es-ES');
}

function formatShortDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getDate()}/${date.getMonth() + 1}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Window controls
function minimizeWindow() {
    window.electronAPI.minimize();
}

function maximizeWindow() {
    window.electronAPI.maximize();
}

function closeWindow() {
    window.electronAPI.close();
}

// Make functions available globally
window.minimizeWindow = minimizeWindow;
window.maximizeWindow = maximizeWindow;
window.closeWindow = closeWindow;
window.navigateTo = navigateTo;
window.initBot = initBot;
window.startBot = startBot;
window.stopBot = stopBot;
window.restartBot = restartBot;
window.createSubBot = createSubBot;
window.sendQuickMessage = sendQuickMessage;
window.showAddAdminModal = showAddAdminModal;
window.removeAdmin = removeAdmin;
window.showAddVipModal = showAddVipModal;
window.removeVip = removeVip;
window.generateAISuggestion = generateAISuggestion;
window.applyAISuggestion = applyAISuggestion;
window.dismissAISuggestion = dismissAISuggestion;
window.sendBroadcast = sendBroadcast;
window.clearMessages = clearMessages;
window.showBotQR = (botId) => showQRModal(null, botId);
window.refreshCurrentView = refreshCurrentView;

// Prevenir clic derecho en producción
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Prevenir atajos de desarrollo
document.addEventListener('keydown', (e) => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.key === 'u') || (e.ctrlKey && e.key === 's')) {
        e.preventDefault();
    }
});
