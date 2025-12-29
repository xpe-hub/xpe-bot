const { contextBridge, ipcRenderer } = require('electron');

/**
 * Puente seguro entre el proceso de renderizado y el proceso principal
 * Expone solo las APIs necesarias para la interfaz de usuario
 */
contextBridge.exposeInMainWorld('electronAPI', {
    // ==========================================
    // SISTEMA DE SEGURIDAD Y LICENCIAS
    // ==========================================

    /**
     * Obtiene el identificador de hardware único del equipo
     * @returns {Promise<string>} HWID del dispositivo
     */
    getHWID: () => ipcRenderer.invoke('get-hwid'),

    /**
     * Genera un código de activación para un HWID específico
     * Solo disponible para administradores
     * @param {string} targetHWID - HWID del dispositivo destino
     * @returns {Promise<object>} Resultado con el código de activación
     */
    generateActivation: (targetHWID) => ipcRenderer.invoke('generate-activation', targetHWID),

    /**
     * Activa una licencia con la clave proporcionada
     * @param {string} licenseKey - Clave de licencia
     * @returns {Promise<object>} Resultado de la activación
     */
    activateLicense: (licenseKey) => ipcRenderer.invoke('activate-license', licenseKey),

    /**
     * Verifica si existe una licencia guardada y si es válida
     * @returns {Promise<object>} Estado de la licencia guardada
     */
    checkSavedLicense: () => ipcRenderer.invoke('check-saved-license'),

    // ==========================================
    // CONTROL DEL BOT (PROCESO)
    // ==========================================

    /**
     * Busca automáticamente la carpeta del bot
     * @returns {Promise<string>} Ruta encontrada
     */
    findBot: () => ipcRenderer.invoke('find-bot'),

    /**
     * Inicia el proceso del bot (legacy)
     * @returns {Promise<object>} Resultado del inicio
     */
    startBot: () => ipcRenderer.invoke('start-bot'),

    /**
     * Detiene el proceso del bot (legacy)
     * @returns {Promise<object>} Resultado de la detención
     */
    stopBot: () => ipcRenderer.invoke('stop-bot'),

    /**
     * Reinicia el proceso del bot (legacy)
     * @returns {Promise<object>} Resultado del reinicio
     */
    restartBot: () => ipcRenderer.invoke('restart-bot'),

    /**
     * Obtiene el estado actual del bot (legacy)
     * @returns {Promise<string>} 'ejecutando' o 'detenido'
     */
    getStatus: () => ipcRenderer.invoke('get-status'),

    // ==========================================
    // CONTROL DEL BOT (NUEVO SISTEMA)
    // ==========================================

    /**
     * Inicializa el bot principal
     * @returns {Promise<object>} Resultado de la inicialización
     */
    botInit: () => ipcRenderer.invoke('bot-init'),

    /**
     * Obtiene el estado de todos los bots
     * @returns {Promise<object>} Estado de bots
     */
    botGetStatus: () => ipcRenderer.invoke('bot-get-status'),

    /**
     * Envía un mensaje usando un bot específico
     * @param {object} data - Datos del mensaje { to, message, botId }
     * @returns {Promise<object>} Resultado del envío
     */
    botSendMessage: (data) => ipcRenderer.invoke('bot-send-message', data),

    /**
     * Crea un nuevo sub-bot
     * @returns {Promise<object>} Resultado con el ID y QR del nuevo sub-bot
     */
    botCreateSubbot: () => ipcRenderer.invoke('bot-create-subbot'),

    /**
     * Inicia un sub-bot específico
     * @param {string} botId - ID del sub-bot
     * @returns {Promise<object>} Resultado del inicio
     */
    botStartSubbot: (botId) => ipcRenderer.invoke('bot-start-subbot', botId),

    /**
     * Detiene un sub-bot específico
     * @param {string} botId - ID del sub-bot
     * @returns {Promise<object>} Resultado de la detención
     */
    botStopSubbot: (botId) => ipcRenderer.invoke('bot-stop-subbot', botId),

    // ==========================================
    // ADMINISTRADORES
    // ==========================================

    /**
     * Obtiene la lista de administradores
     * @returns {Promise<Array>} Lista de administradores
     */
    adminsGet: () => ipcRenderer.invoke('admins-get'),

    /**
     * Agrega un nuevo administrador
     * @param {object} data - Datos del admin { jid, name, role }
     * @returns {Promise<object>} Resultado de la operación
     */
    adminsAdd: (data) => ipcRenderer.invoke('admins-add', data),

    /**
     * Elimina un administrador
     * @param {string} jid - JID del administrador a eliminar
     * @returns {Promise<object>} Resultado de la operación
     */
    adminsRemove: (jid) => ipcRenderer.invoke('admins-remove', jid),

    // ==========================================
    // USUARIOS VIP
    // ==========================================

    /**
     * Obtiene la lista de usuarios VIP
     * @returns {Promise<Array>} Lista de VIPs
     */
    vipsGet: () => ipcRenderer.invoke('vips-get'),

    /**
     * Agrega o actualiza un usuario VIP
     * @param {object} data - Datos del VIP { jid, name, days, plan }
     * @returns {Promise<object>} Resultado de la operación
     */
    vipsAdd: (data) => ipcRenderer.invoke('vips-add', data),

    /**
     * Elimina un usuario VIP
     * @param {string} jid - JID del VIP a eliminar
     * @returns {Promise<object>} Resultado de la operación
     */
    vipsRemove: (jid) => ipcRenderer.invoke('vips-remove', jid),

    /**
     * Verifica el estado VIP de un usuario
     * @param {string} jid - JID del usuario a verificar
     * @returns {Promise<object>} Estado VIP
     */
    vipsCheck: (jid) => ipcRenderer.invoke('vips-check', jid),

    // ==========================================
    // MENSAJES
    // ==========================================

    /**
     * Obtiene mensajes recientes
     * @returns {Promise<Array>} Lista de mensajes recientes
     */
    messagesGetRecent: () => ipcRenderer.invoke('messages-get-recent'),

    /**
     * Limpia todos los mensajes
     * @returns {Promise<object>} Resultado de la operación
     */
    messagesClear: () => ipcRenderer.invoke('messages-clear'),

    /**
     * Filtra mensajes por criterios
     * @param {object} criteria - Criterios de filtrado { type, from, botId }
     * @returns {Promise<Array>} Mensajes filtrados
     */
    messagesFilter: (criteria) => ipcRenderer.invoke('messages-filter', criteria),

    // ==========================================
    // ESTADÍSTICAS
    // ==========================================

    /**
     * Obtiene estadísticas del sistema
     * @returns {Promise<object>} Estadísticas
     */
    statsGet: () => ipcRenderer.invoke('stats-get'),

    /**
     * Registra un nuevo mensaje en las estadísticas
     * @param {object} data - Datos del mensaje
     * @returns {void}
     */
    statsRecordMessage: (data) => ipcRenderer.invoke('stats-record-message', data),

    /**
     * Registra un nuevo comando en las estadísticas
     * @param {string} command - Nombre del comando
     * @returns {void}
     */
    statsRecordCommand: (command) => ipcRenderer.invoke('stats-record-command', command),

    // ==========================================
    // INTELIGENCIA ARTIFICIAL
    // ==========================================

    /**
     * Genera una sugerencia de respuesta usando IA
     * @param {object} data - Datos para la IA { message, context }
     * @returns {Promise<object>} Sugerencia de la IA
     */
    aiSuggestReply: (data) => ipcRenderer.invoke('ai-suggest-reply', data),

    // ==========================================
    // UTILIDADES Y SISTEMA
    // ==========================================

    /**
     * Abre la carpeta del bot en el explorador de archivos
     * @returns {Promise<string>} Ruta de la carpeta
     */
    openBotFolder: () => ipcRenderer.invoke('open-folder', null),

    /**
     * Abre una carpeta específica en el explorador de archivos
     * @param {string} folderPath - Ruta de la carpeta
     * @returns {Promise<string>} Ruta de la carpeta
     */
    openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),

    /**
     * Abre la carpeta de logs en el explorador de archivos
     * @returns {Promise<string>} Ruta de la carpeta de logs
     */
    openLogsFolder: () => ipcRenderer.invoke('open-logs-folder'),

    /**
     * Obtiene la versión de la aplicación
     * @returns {Promise<string>} Versión actual
     */
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    /**
     * Abre un enlace externo en el navegador predeterminado
     * @param {string} url - URL a abrir
     */
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // ==========================================
    // LISTENERS EN TIEMPO REAL
    // ==========================================

    /**
     * Suscribe un callback para recibir logs del bot en tiempo real
     * @param {function} callback - Función a ejecutar con cada log
     */
    onBotLog: (callback) => {
        ipcRenderer.removeAllListeners('bot-log');
        ipcRenderer.on('bot-log', (event, data) => callback(data));
    },

    /**
     * Suscribe un callback para recibir cambios de estado del bot
     * @param {function} callback - Función a ejecutar con el nuevo estado
     */
    onBotStatus: (callback) => {
        ipcRenderer.removeAllListeners('bot-status');
        ipcRenderer.on('bot-status', (event, status) => callback(status));
    },

    /**
     * Suscribe un callback para recibir mensajes del bot en tiempo real
     * @param {function} callback - Función a ejecutar con cada mensaje
     */
    onBotMessage: (callback) => {
        ipcRenderer.removeAllListeners('bot-message');
        ipcRenderer.on('bot-message', (event, data) => callback(data));
    },

    // ==========================================
    // CONTROLES DE VENTANA
    // ==========================================

    /**
     * Minimiza la ventana
     */
    minimize: () => ipcRenderer.invoke('window-minimize'),

    /**
     * Alterna entre maximizar y restaurar la ventana
     */
    maximize: () => ipcRenderer.invoke('window-maximize'),

    /**
     * Cierra la ventana (y el bot si está activo)
     */
    close: () => ipcRenderer.invoke('window-close')
});

// ==========================================
// MANEJO DE ERRORES IPC
// ==========================================

/**
 * Maneja errores en la comunicación IPC
 */
ipcRenderer.on('ipc-error', (event, error) => {
    console.error('[Preload] Error IPC:', error);
});

// Prevenir modificaciones al contexto
process.once('loaded', () => {
    // El contexto está cargado
});
