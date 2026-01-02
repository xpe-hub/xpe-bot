/**
 * Configuración del Panel XPE
 * Copia este archivo como .env y completa los valores
 */

export default {
    // === Panel Server ===
    PANEL_PORT: 3000,
    PANEL_AUTH_TOKEN: 'xpe-secret-token-2024',

    // === Grupo de Owners (ID de WhatsApp) ===
    // Formato: número@us.ag o número@s.whatsapp.net
    OWNER_GROUP_ID: 'tu-grupo-id@g.us',

    // === Configuración de IA ===
    OPENAI_API_KEY: 'tu-api-key-de-openai',
    AI_MODEL: 'gpt-4',

    // === Notificaciones ===
    NOTIFY_ON_START: true,
    NOTIFY_ON_UPDATE: true,
    UPDATE_CHECK_INTERVAL_MINUTES: 30,

    // === Logs ===
    LOG_LEVEL: 'info',
    MAX_LOG_SIZE: '10m'
}
