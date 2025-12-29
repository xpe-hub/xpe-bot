/**
 * XPE-BOT Engine - Motor de Bots de WhatsApp
 * Gestiona múltiples instancias de bots usando @whiskeysockets/baileys
 */

const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

// Almacenamiento de instancias de bots
const botInstances = {};

// Almacenamiento de mensajes recientes
const messageHistory = {
    messages: [],
    maxSize: 500
};

// Handlers de mensajes para el panel
const messageHandlers = {
    handlers: [],

    onMessage(callback) {
        this.handlers.push(callback);
    },

    emitMessage(data) {
        // Agregar al historial
        messageHistory.messages.unshift({
            ...data,
            timestamp: Date.now()
        });

        // Mantener tamaño máximo
        if (messageHistory.messages.length > messageHistory.maxSize) {
            messageHistory.messages = messageHistory.messages.slice(0, messageHistory.maxSize);
        }

        // Notificar a todos los handlers
        this.handlers.forEach(handler => handler(data));
    },

    getRecentMessages(limit = 50) {
        return messageHistory.messages.slice(0, limit);
    },

    filterMessages(criteria) {
        return messageHistory.messages.filter(msg => {
            if (criteria.type && msg.type !== criteria.type) return false;
            if (criteria.from && !msg.from.includes(criteria.from)) return false;
            if (criteria.botId && msg.botId !== criteria.botId) return false;
            return true;
        });
    },

    clearMessages() {
        messageHistory.messages = [];
    }
};

/**
 * Crea una nueva instancia de bot
 * @param {string} botId - Identificador único del bot
 * @param {function} onLog - Callback para logs
 * @returns {Promise<object>} Instancia del bot
 */
async function createBotInstance(botId, onLog = console.log) {
    const sessionsDir = path.join(__dirname, '..', 'data', 'sessions', botId);

    // Crear directorio de sesión si no existe
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }

    // Estado de autenticación
    const { state, saveCreds } = await useMultiFileAuthState(sessionsDir);

    // Obtener versión de Baileys
    const { version } = await fetchLatestBaileysVersion();

    // Crear socket
    const socket = makeWASocket({
        auth: state,
        version: version,
        printQRInTerminal: false,
        logger: {
            level: 'silent'
        },
        shouldIgnoreJid: (jid) => {
            return jid?.includes('@newsletter') || jid?.includes('@broadcast');
        }
    });

    // Objeto de instancia del bot
    const botInstance = {
        id: botId,
        socket: socket,
        status: 'conectando',
        qrCode: null,
        phone: null,
        connectedAt: null,
        onLog: onLog,
        handlers: {
            connection: [],
            messages: [],
            contacts: []
        }
    };

    // Manejador de eventos de conexión
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            botInstance.qrCode = qr;
            botInstance.status = 'esperando_qr';
            onLog(`[${botId}] QR Code generado. Escanear para conectar.`);
            messageHandlers.emitMessage({
                type: 'system',
                botId: botId,
                content: 'QR Code generado',
                status: 'waiting_qr'
            });
        }

        if (connection === 'open') {
            botInstance.status = 'conectado';
            botInstance.connectedAt = Date.now();
            botInstance.phone = socket.user?.id?.split(':')[0] || 'Unknown';

            onLog(`[${botId}] Conectado como ${botInstance.phone}`);
            messageHandlers.emitMessage({
                type: 'system',
                botId: botId,
                content: `Conectado como ${botInstance.phone}`,
                status: 'connected'
            });

            // Guardar credenciales
            await saveCreds();
        }

        if (connection === 'close') {
            const wasCleanDisconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            botInstance.status = wasCleanDisconnect ? 'desconectado' : 'sesion_expirada';

            onLog(`[${botId}] Desconectado. Estado: ${botInstance.status}`);
            messageHandlers.emitMessage({
                type: 'system',
                botId: botId,
                content: 'Conexión cerrada',
                status: 'disconnected'
            });

            if (!wasCleanDisconnect) {
                // Sesión expirada, eliminar credenciales
                onLog(`[${botId}] Sesión expirada. Escanea el QR nuevamente.`);
            }
        }

        // Notificar handlers de conexión
        botInstance.handlers.connection.forEach(handler => {
            handler(update);
        });
    });

    // Manejador de mensajes
    socket.ev.on('messages.upsert', async (m) => {
        if (!m.messages || m.messages.length === 0) return;

        for (const msg of m.messages) {
            if (msg.key?.fromMe) continue; // Ignorar mensajes propios

            const messageData = parseMessage(msg, botId);
            onLog(`[${botId}] Mensaje de ${messageData.sender}: ${messageData.body.substring(0, 50)}...`);

            // Emitir mensaje al panel
            messageHandlers.emitMessage(messageData);

            // Notificar handlers
            botInstance.handlers.messages.forEach(handler => {
                handler(messageData);
            });

            // Procesar comandos si es un mensaje de texto
            if (messageData.type === 'text' && messageData.body.startsWith('.')) {
                await processCommand(messageData, socket, botInstance);
            }
        }
    });

    // Manejador de contactos
    socket.ev.on('contacts.update', (contacts) => {
        contacts.forEach(contact => {
            const contactData = {
                id: contact.id,
                name: contact.name || contact.notify,
                botId: botId
            };

            botInstance.handlers.contacts.forEach(handler => {
                handler(contactData);
            });
        });
    });

    // Guardar credenciales cuando cambian
    socket.ev.on('creds.update', async () => {
        await saveCreds();
    });

    // Almacenar instancia
    botInstances[botId] = botInstance;

    return botInstance;
}

/**
 * Analiza un mensaje de WhatsApp y lo estructura
 * @param {object} msg - Mensaje raw de Baileys
 * @param {string} botId - ID del bot que recibió el mensaje
 * @returns {object} Mensaje estructurado
 */
function parseMessage(msg, botId) {
    const key = msg.key;
    const message = msg.message;

    // Extraer información del remitente
    const sender = key.participant || key.remoteJid;
    const remoteJid = key.remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');

    // Determinar tipo de mensaje
    let type = 'unknown';
    let body = '';

    if (message?.conversation) {
        type = 'text';
        body = message.conversation;
    } else if (message?.extendedTextMessage) {
        type = 'text';
        body = message.extendedTextMessage.text || '';
    } else if (message?.imageMessage) {
        type = 'image';
        body = message.imageMessage.caption || '[Imagen]';
    } else if (message?.videoMessage) {
        type = 'video';
        body = message.videoMessage.caption || '[Video]';
    } else if (message?.audioMessage) {
        type = 'audio';
        body = '[Audio]';
    } else if (message?.documentMessage) {
        type = 'document';
        body = `[Archivo: ${message.documentMessage.fileName || 'documento'}]`;
    } else if (message?.stickerMessage) {
        type = 'sticker';
        body = '[Sticker]';
    } else if (message?.locationMessage) {
        type = 'location';
        body = `[Ubicación: ${message.locationMessage.latitude}, ${message.locationMessage.longitude}]`;
    } else if (message?.contactsArrayMessage) {
        type = 'contact';
        body = '[Contacto compartido]';
    } else if (message?.listMessage) {
        type = 'list';
        body = '[Lista interactiva]';
    } else if (message?.buttonsMessage) {
        type = 'buttons';
        body = message.buttonsMessage.contentText || '[Botones]';
    }

    // Extraer nombre del remitente
    const senderName = msg.pushName || sender.split('@')[0];

    return {
        id: key.id,
        botId: botId,
        remoteJid: remoteJid,
        sender: sender,
        senderName: senderName,
        isGroup: isGroup,
        groupJid: isGroup ? remoteJid : null,
        type: type,
        body: body,
        timestamp: msg.messageTimestamp,
        messageObj: message,
        isForwarded: message?.extendedTextMessage?.isForwarded || false,
        isReply: !!message?.extendedTextMessage?.contextInfo?.quotedMessage
    };
}

/**
 * Procesa comandos del bot
 * @param {object} messageData - Mensaje estructurado
 * @param {object} socket - Socket de Baileys
 * @param {object} botInstance - Instancia del bot
 */
async function processCommand(messageData, socket, botInstance) {
    const commandText = messageData.body;
    const args = commandText.slice(1).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    // Comandos del sistema
    const systemCommands = {
        'ping': () => sendResponse(socket, messageData.remoteJid, '🏓 Pong!'),
        'alive': () => sendResponse(socket, messageData.remoteJid, '✅ XPE-BOT está activo y funcionando.\n\n🤖 Versión: 2.2.5\n📅 Fecha: ' + new Date().toLocaleDateString()),
        'menu': () => {
            const menuText = `╔════════════════════════════╗
║     🔷 XPE-BOT MENÚ 🔷      ║
╠════════════════════════════╣
║  .ping    - Verificar       ║
║  .menu    - Este menú       ║
║  .info    - Información     ║
║  .uptime  - Tiempo activo   ║
║  .serbot  - Crear sub-bot   ║
╚════════════════════════════╝`;
            sendResponse(socket, messageData.remoteJid, menuText);
        },
        'uptime': () => {
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            sendResponse(socket, messageData.remoteJid, `⏱️ Tiempo activo: ${hours}h ${minutes}m`);
        },
        'info': () => {
            const infoText = `╔══════════════════════════════╗
║    🔷 XPE-BOT INFO 🔷       ║
╠══════════════════════════════╣
║  • Desarrollado por XPE     ║
║  • WhatsApp Bot v2.2.5      ║
║  • Baileys Multi-device     ║
║  • Soporte 24/7             ║
╚══════════════════════════════╝`;
            sendResponse(socket, messageData.remoteJid, infoText);
        }
    };

    // Verificar comandos del sistema
    if (systemCommands[command]) {
        systemCommands[command]();
        messageHandlers.emitMessage({
            type: 'command',
            botId: botInstance.id,
            from: messageData.sender,
            command: command,
            timestamp: Date.now()
        });
        return;
    }

    // Aquí se pueden agregar más comandos personalizados
    // Comandos de ejemplo para funcionalidad extendida

    const extendedCommands = {
        'sticker': async () => {
            if (messageData.type === 'image') {
                // Convertir imagen a sticker
                await socket.sendMessage(messageData.remoteJid, {
                    sticker: { url: messageData.messageObj?.imageMessage?.url },
                    mimetype: 'image/webp'
                });
            } else {
                sendResponse(socket, messageData.remoteJid, ' Responde a una imagen con .sticker para convertirla.');
            }
        },
        'play': async () => {
            if (args.length > 0) {
                const query = args.join(' ');
                sendResponse(socket, messageData.remoteJid, `🔍 Buscando: "${query}"\n\n⏳ Próximamente disponible...`);
            } else {
                sendResponse(socket, messageData.remoteJid, ' Usa .play [nombre de canción] para buscar.');
            }
        },
        'kick': async () => {
            if (messageData.isGroup) {
                sendResponse(socket, messageData.remoteJid, ' ℹ️ Función de expulsar disponible. Usa el panel de administración.');
            } else {
                sendResponse(socket, messageData.remoteJid, ' Este comando solo funciona en grupos.');
            }
        },
        'tagall': async () => {
            if (messageData.isGroup) {
                sendResponse(socket, messageData.remoteJid, { text: ' Mentionando a todos los miembros...\n(Requiere configuración adicional)' });
            } else {
                sendResponse(socket, messageData.remoteJid, ' Este comando solo funciona en grupos.');
            }
        }
    };

    if (extendedCommands[command]) {
        try {
            await extendedCommands[command]();
        } catch (error) {
            sendResponse(socket, messageData.remoteJid, ` ❌ Error ejecutando comando: ${error.message}`);
        }
    } else {
        // Comando no reconocido
        sendResponse(socket, messageData.remoteJid, ` ❓ Comando "${command}" no reconocido.\nUsa .menu para ver los comandos disponibles.`);
    }
}

/**
 * Envía una respuesta de texto
 * @param {object} socket - Socket de Baileys
 * @param {string} jid - JID del destinatario
 * @param {string|object} content - Contenido del mensaje
 */
async function sendResponse(socket, jid, content) {
    try {
        await socket.sendMessage(jid, typeof content === 'string' ? { text: content } : content);
    } catch (error) {
        console.error('Error enviando mensaje:', error);
    }
}

/**
 * Detiene una instancia de bot
 * @param {string} botId - ID del bot a detener
 */
async function stopBotInstance(botId) {
    if (botInstances[botId]) {
        const instance = botInstances[botId];
        if (instance.socket) {
            try {
                instance.socket.close();
            } catch (error) {
                console.error(`Error cerrando bot ${botId}:`, error);
            }
        }
        delete botInstances[botId];
        return true;
    }
    return false;
}

/**
 * Obtiene estado de todas las instancias
 * @returns {Array} Lista de instancias con su estado
 */
function getAllBotStatus() {
    return Object.keys(botInstances).map(botId => {
        const instance = botInstances[botId];
        return {
            id: botId,
            status: instance.status,
            phone: instance.phone,
            connectedAt: instance.connectedAt,
            qrCode: instance.qrCode
        };
    });
}

/**
 * Obtiene el QR code de un bot
 * @param {string} botId - ID del bot
 * @returns {string|null} QR code o null
 */
function getBotQR(botId) {
    if (botInstances[botId]) {
        return botInstances[botId].qrCode;
    }
    return null;
}

/**
 * Verifica si un bot está conectado
 * @param {string} botId - ID del bot
 * @returns {boolean}
 */
function isBotConnected(botId) {
    return botInstances[botId]?.status === 'conectado';
}

/**
 * Obtiene información de un bot específico
 * @param {string} botId - ID del bot
 * @returns {object|null}
 */
function getBotInfo(botId) {
    if (!botInstances[botId]) return null;

    const instance = botInstances[botId];
    return {
        id: botId,
        status: instance.status,
        phone: instance.phone,
        connectedAt: instance.connectedAt,
        user: instance.socket?.user
    };
}

// Exportar funciones y objetos
module.exports = {
    createBotInstance,
    stopBotInstance,
    getAllBotStatus,
    getBotQR,
    isBotConnected,
    getBotInfo,
    botInstances,
    messageHandlers
};
