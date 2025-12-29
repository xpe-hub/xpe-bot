import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Licencias
    getHWID: () => ipcRenderer.invoke('get-hwid'),
    activateLicense: (licenseKey) => ipcRenderer.invoke('activate-license', licenseKey),
    checkSavedLicense: () => ipcRenderer.invoke('check-saved-license'),
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

    // Database
    adminsGet: () => ipcRenderer.invoke('admins-get'),
    adminsAdd: (data) => ipcRenderer.invoke('admins-add', data),
    adminsRemove: (jid) => ipcRenderer.invoke('admins-remove', jid),
    vipsGet: () => ipcRenderer.invoke('vips-get'),
    vipsAdd: (data) => ipcRenderer.invoke('vips-add', data),
    vipsRemove: (jid) => ipcRenderer.invoke('vips-remove', jid),
    statsGet: () => ipcRenderer.invoke('stats-get'),
    aiSuggestReply: (data) => ipcRenderer.invoke('ai-suggest-reply', data),

    // Window
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close'),

    // Listeners
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
    }
});
