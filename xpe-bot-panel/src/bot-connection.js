/**
 * XPE Panel - Sistema de Conexión con Bot
 * Maneja la conexión WebSocket al servidor del bot
 */

// Estado de la conexión del bot
let botConnection = {
    socket: null,
    connected: false,
    status: 'offline',
    metrics: {
        ram: 0,
        cpu: 0,
        uptime: 0
    },
    pendingUpdates: 0,
    restartPending: false
};

// ========== CONEXIÓN AL SERVIDOR DEL BOT ==========

async function initBotConnection() {
    try {
        // Obtener la URL del servidor del bot
        const botUrl = await getBotServerUrl();
        
        if (!botUrl) {
            console.log('[Bot] No se encontró servidor del bot');
            return;
        }

        // Conectar al WebSocket
        connectToBot(botUrl);
    } catch (error) {
        console.error('[Bot] Error inicializando conexión:', error);
    }
}

async function getBotServerUrl() {
    // Intentar obtener del IPC o usar configuración local
    try {
        const result = await window.electronAPI?.getBotServerUrl?.();
        if (result?.url) return result.url;
    } catch (e) {
        // Ignorar errores
    }
    
    // Por defecto, asumir localhost:3000
    return 'http://localhost:3000';
}

function connectToBot(url) {
    console.log('[Bot] Conectando a:', url);
    
    try {
        // Conectar al Socket.io
        botConnection.socket = io(url, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        // Eventos de conexión
        botConnection.socket.on('connect', () => {
            console.log('[Bot] Conectado al servidor');
            botConnection.connected = true;
            updateBotStatusUI('connected');
            addBotLog('✅ Conectado al servidor del bot');
            showNotification('Conexión establecida', 'success');
        });

        botConnection.socket.on('disconnect', (reason) => {
            console.log('[Bot] Desconectado:', reason);
            botConnection.connected = false;
            botConnection.status = 'offline';
            updateBotStatusUI('disconnected');
            addBotLog('❌ Desconectado del servidor');
        });

        botConnection.socket.on('connect_error', (error) => {
            console.error('[Bot] Error de conexión:', error.message);
            updateBotStatusUI('error');
        });

        // Eventos del bot
        botConnection.socket.on('bot:status', (data) => {
            handleBotStatus(data);
        });

        botConnection.socket.on('metrics:update', (data) => {
            handleMetricsUpdate(data);
        });

        botConnection.socket.on('bot:log', (data) => {
            handleBotLog(data);
        });

        botConnection.socket.on('update:pending', (data) => {
            handlePendingUpdates(data);
        });

        botConnection.socket.on('bot:messageSent', (data) => {
            if (data.success) {
                showNotification('Mensaje enviado al grupo', 'success');
                addBotLog('📨 Mensaje enviado correctamente');
            } else {
                showNotification('Error enviando mensaje: ' + data.error, 'error');
                addBotLog('❌ Error enviando mensaje: ' + data.error);
            }
        });

        botConnection.socket.on('update:started', (data) => {
            showNotification('Actualizando sistema...', 'info');
            addBotLog('🔄 Iniciando actualización...');
            botConnection.restartPending = true;
        });

        botConnection.socket.on('update:completed', (data) => {
            showNotification('Actualización completada', 'success');
            addBotLog('✅ Sistema actualizado correctamente');
            botConnection.restartPending = false;
        });

        botConnection.socket.on('update:error', (data) => {
            showNotification('Error en actualización: ' + data.error, 'error');
            addBotLog('❌ Error en actualización: ' + data.error);
            botConnection.restartPending = false;
        });

        botConnection.socket.on('bot:shouldRestart', () => {
            addBotLog('🔄 Reiniciando bot...');
            setTimeout(() => {
                botConnection.socket.disconnect();
                setTimeout(() => initBotConnection(), 5000);
            }, 2000);
        });

    } catch (error) {
        console.error('[Bot] Error conectando:', error);
        updateBotStatusUI('error');
    }
}

// ========== MANEJO DE EVENTOS ==========

function handleBotStatus(data) {
    botConnection.status = data.connected ? 'connected' : 'disconnected';
    
    // Actualizar QR si existe
    if (data.qr) {
        showQRCode(data.qr);
    }

    updateBotStatusUI(botConnection.status);
    addBotLog(data.connected ? '✅ Bot conectado a WhatsApp' : '❌ Bot desconectado');
}

function handleMetricsUpdate(data) {
    if (data.memory) {
        botConnection.metrics.ram = data.memory;
        document.getElementById('botRam')?.textContent = `${data.memory}MB`;
    }
    
    if (data.uptime) {
        botConnection.metrics.uptime = data.uptime;
        document.getElementById('botUptime')?.textContent = formatSeconds(data.uptime);
    }

    // Actualizar métricas generales
    if (data.process?.cpu) {
        document.getElementById('botCpu')?.textContent = `${Math.round(data.process.cpu / 1000000)}s`;
    }
}

function handleBotLog(data) {
    addBotLog(data.message);
}

function handlePendingUpdates(data) {
    botConnection.pendingUpdates = data.count;
    
    const updateBadge = document.getElementById('updateBadge');
    const updateText = document.getElementById('updateStatusText');
    
    if (data.count > 0) {
        if (updateBadge) {
            updateBadge.style.display = 'flex';
            updateBadge.textContent = data.count;
        }
        if (updateText) {
            updateText.textContent = `${data.count} actualización(es) pendiente(s)`;
            updateText.style.color = 'var(--warning)';
        }
        addBotLog(`⚠️ ${data.count} actualizaciones disponibles`);
    } else {
        if (updateBadge) updateBadge.style.display = 'none';
        if (updateText) {
            updateText.textContent = 'Sistema actualizado';
            updateText.style.color = 'var(--success)';
        }
    }
}

// ========== ACTUALIZACIÓN DE UI ==========

function updateBotStatusUI(status) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const statusIndicator = document.querySelector('#botStatus .status-indicator');
    const connectionBadge = document.getElementById('connectionBadge');
    
    if (statusDot) {
        statusDot.style.display = status === 'connected' ? 'block' : 'none';
        statusDot.style.background = status === 'connected' ? 'var(--success)' : 'var(--danger)';
    }
    
    if (statusText) {
        switch (status) {
            case 'connected':
                statusText.textContent = 'Conectado';
                statusText.style.color = 'var(--success)';
                break;
            case 'disconnected':
                statusText.textContent = 'Desconectado';
                statusText.style.color = 'var(--danger)';
                break;
            case 'error':
                statusText.textContent = 'Error de conexión';
                statusText.style.color = 'var(--warning)';
                break;
            default:
                statusText.textContent = 'Sin conectar';
        }
    }
    
    if (statusIndicator) {
        statusIndicator.className = `status-indicator ${status === 'connected' ? 'running' : 'stopped'}`;
    }
    
    if (connectionBadge) {
        connectionBadge.textContent = status === 'connected' ? '🟢 Online' : '🔴 Offline';
        connectionBadge.className = status === 'connected' ? 'badge badge-success' : 'badge badge-danger';
    }
}

function showQRCode(qr) {
    // Mostrar modal con QR
    let qrModal = document.getElementById('qrModal');
    if (!qrModal) {
        qrModal = document.createElement('div');
        qrModal.id = 'qrModal';
        qrModal.className = 'modal-overlay';
        qrModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📱 Escanea el Código QR</h3>
                    <button class="modal-close" onclick="closeQRModal()">×</button>
                </div>
                <div class="modal-body" style="text-align: center;">
                    <img id="qrImage" src="" alt="QR Code" style="max-width: 250px; margin: 20px auto;">
                    <p>Escanea este código con WhatsApp para conectar el bot</p>
                </div>
            </div>
        `;
        document.body.appendChild(qrModal);
    }
    
    document.getElementById('qrImage').src = qr;
    qrModal.style.display = 'flex';
}

function closeQRModal() {
    const qrModal = document.getElementById('qrModal');
    if (qrModal) qrModal.style.display = 'none';
}

function addBotLog(message, type = 'info') {
    const logsBox = document.getElementById('botLogsBox') || document.getElementById('logsBox');
    if (logsBox) {
        const timestamp = new Date().toLocaleTimeString('es-ES');
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
        const logHtml = `<div class="log-line ${type}"><span class="log-time">[${timestamp}]</span> ${icon} ${message}</div>`;
        logsBox.insertAdjacentHTML('afterbegin', logHtml);
    }
}

// ========== CONTROL DEL BOT ==========

async function restartBot() {
    if (!botConnection.socket?.connected) {
        showNotification('Bot no conectado', 'warning');
        return;
    }

    // Doble confirmación
    if (!confirm('¿Estás seguro de que quieres reiniciar el bot?')) {
        addBotLog('Reinicio cancelado');
        return;
    }

    addBotLog('🔄 Reiniciando bot...', 'warning');
    botConnection.socket.emit('bot:restart');
}

async function updateBot() {
    if (!botConnection.socket?.connected) {
        showNotification('Bot no conectado', 'warning');
        return;
    }

    // Doble confirmación para actualización
    if (!confirm('¿Estás seguro de que quieres actualizar el sistema?\nEsto reiniciará el bot.')) {
        addBotLog('Actualización cancelada');
        return;
    }

    addBotLog('🔄 Solicitando actualización...', 'warning');
    botConnection.socket.emit('bot:update');
}

async function sendToOwnersGroup(message) {
    if (!botConnection.socket?.connected) {
        showNotification('Bot no conectado', 'warning');
        return false;
    }

    try {
        botConnection.socket.emit('assistant:sendMessage', { message });
        return true;
    } catch (error) {
        showNotification('Error enviando mensaje', 'error');
        return false;
    }
}

function formatSeconds(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

// ========== INICIALIZACIÓN ==========

// Exportar funciones al objeto window para uso global
window.botConnection = botConnection;
window.initBotConnection = initBotConnection;
window.restartBot = restartBot;
window.updateBot = updateBot;
window.sendToOwnersGroup = sendToOwnersGroup;
window.showQRCode = showQRCode;
window.closeQRModal = closeQRModal;
window.addBotLog = addBotLog;
