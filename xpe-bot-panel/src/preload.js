const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Usuarios
    loginUser: (username) => ipcRenderer.invoke('user:login', username),
    getCurrentUser: () => ipcRenderer.invoke('user:get-current'),
    getAllUsers: () => ipcRenderer.invoke('user:get-all'),
    logoutUser: () => ipcRenderer.invoke('user:logout'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // Bot Controls
    initBot: () => ipcRenderer.invoke('init-bot'),
    startBot: (botId) => ipcRenderer.invoke('start-bot', botId),
    stopBot: (botId) => ipcRenderer.invoke('stop-bot', botId),
    restartBot: (botId) => ipcRenderer.invoke('restart-bot', botId),
    createSubbot: () => ipcRenderer.invoke('create-subbot'),
    sendMessage: (data) => ipcRenderer.invoke('send-message', data),
    getLogs: () => ipcRenderer.invoke('get-logs'),
    clearLogs: () => ipcRenderer.invoke('clear-logs'),
    getBotsStatus: () => ipcRenderer.invoke('get-bots-status'),

    // Bot Externo (ruta y proceso)
    saveBotPath: (botPath) => ipcRenderer.invoke('bot:save-path', botPath),
    getBotPath: () => ipcRenderer.invoke('bot:load-path'),
    selectBotFolder: () => ipcRenderer.invoke('dialog:select-path'),
    verifyBotPath: (botPath) => ipcRenderer.invoke('bot:verify-path', botPath),
    startExternalBot: (botPath) => ipcRenderer.invoke('bot:start-external', botPath),
    stopExternalBot: () => ipcRenderer.invoke('bot:stop-external'),
    restartExternalBot: (botPath) => ipcRenderer.invoke('bot:restart-external', botPath),
    getBotStatus: () => ipcRenderer.invoke('bot:get-status'),

    // Editor de archivos
    listBotFiles: (botPath) => ipcRenderer.invoke('bot:list-files', botPath),
    readFile: (filePath) => ipcRenderer.invoke('bot:read-file', filePath),
    writeFile: (filePath, content, botPath) => ipcRenderer.invoke('bot:write-file', filePath, content, botPath),
    createFile: (botPath, fileName, content) => ipcRenderer.invoke('bot:create-file', botPath, fileName, content),
    deleteFile: (filePath, botPath) => ipcRenderer.invoke('bot:delete-file', filePath, botPath),

    // IA
    modifyWithAI: (filePath, currentContent, instruction) => ipcRenderer.invoke('bot:ai-modify', filePath, currentContent, instruction),
    saveApiKey: (apiKey) => ipcRenderer.invoke('bot:save-api-key', apiKey),
    loadApiKey: () => ipcRenderer.invoke('bot:load-api-key'),

    // Respaldos
    listBackups: () => ipcRenderer.invoke('bot:list-backups'),
    restoreBackup: (backupPath, targetPath) => ipcRenderer.invoke('bot:restore-backup', backupPath, targetPath),

    // Database
    adminsGet: () => ipcRenderer.invoke('admins-get'),
    adminsAdd: (data) => ipcRenderer.invoke('admins-add', data),
    adminsRemove: (jid) => ipcRenderer.invoke('admins-remove', jid),
    vipsGet: () => ipcRenderer.invoke('vips-get'),
    vipsAdd: (data) => ipcRenderer.invoke('vips-add', data),
    vipsRemove: (jid) => ipcRenderer.invoke('vips-remove', jid),
    statsGet: () => ipcRenderer.invoke('stats-get'),
    aiSuggestReply: (data) => ipcRenderer.invoke('ai-suggest-reply', data),

    // Sistema
    systemInfo: () => ipcRenderer.invoke('system:info'),

    // Actualizaciones
    checkForUpdates: () => ipcRenderer.invoke('update:check'),
    downloadUpdate: () => ipcRenderer.invoke('update:download'),
    applyUpdate: () => ipcRenderer.invoke('update:apply'),
    getUpdateConfig: () => ipcRenderer.invoke('update:get-config'),
    saveUpdateConfig: (config) => ipcRenderer.invoke('update:save-config', config),

    // Notificaciones
    sendNotification: (data) => ipcRenderer.invoke('notification:send', data),
    getNotificationHistory: () => ipcRenderer.invoke('notification:get-history'),
    markNotificationRead: (notificationId) => ipcRenderer.invoke('notification:mark-read', notificationId),
    getOwners: () => ipcRenderer.invoke('notification:get-owners'),

    // Window
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close'),

    // Listeners
    onBotLog: (callback) => {
        ipcRenderer.removeAllListeners('bot:log');
        ipcRenderer.on('bot:log', (event, data) => callback(data));
    },
    onBotPathConfigured: (callback) => {
        ipcRenderer.removeAllListeners('bot:path-configured');
        ipcRenderer.on('bot:path-configured', (event, botPath) => callback(botPath));
    },
    onBotQR: (callback) => {
        ipcRenderer.removeAllListeners('bot-qr');
        ipcRenderer.on('bot-qr', (event, qr) => callback(qr));
    },
    onBotStatus: (callback) => {
        ipcRenderer.removeAllListeners('bot-status');
        ipcRenderer.on('bot-status', (event, data) => callback(data));
    },
    onBotMessage: (callback) => {
        ipcRenderer.removeAllListeners('bot-message');
        ipcRenderer.on('bot-message', (event, data) => callback(data));
    },
    onLogUpdate: (callback) => {
        ipcRenderer.removeAllListeners('log-update');
        ipcRenderer.on('log-update', (event, data) => callback(data));
    },
    onNotificationReceived: (callback) => {
        ipcRenderer.removeAllListeners('notification:received');
        ipcRenderer.on('notification:received', (event, data) => callback(data));
    }
});
