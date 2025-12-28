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
    // CONTROL DEL BOT
    // ==========================================

    /**
     * Busca automáticamente la carpeta del bot
     * @returns {Promise<string>} Ruta encontrada
     */
    findBot: () => ipcRenderer.invoke('find-bot'),

    /**
     * Inicia el proceso del bot
     * @returns {Promise<object>} Resultado del inicio
     */
    startBot: () => ipcRenderer.invoke('start-bot'),

    /**
     * Detiene el proceso del bot
     * @returns {Promise<object>} Resultado de la detención
     */
    stopBot: () => ipcRenderer.invoke('stop-bot'),

    /**
     * Reinicia el proceso del bot
     * @returns {Promise<object>} Resultado del reinicio
     */
    restartBot: () => ipcRenderer.invoke('restart-bot'),

    /**
     * Obtiene el estado actual del bot
     * @returns {Promise<string>} 'ejecutando' o 'detenido'
     */
    getStatus: () => ipcRenderer.invoke('get-status'),

    // ==========================================
    // UTILIDADES Y SISTEMA
    // ==========================================

    /**
     * Abre la carpeta del bot en el explorador de archivos
     * @returns {Promise<string>} Ruta de la carpeta
     */
    openBotFolder: () => ipcRenderer.invoke('open-bot-folder'),

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
    // El contexto está cargado, no hacer nada especial
});
