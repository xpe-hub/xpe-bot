# XPE Panel - Integración con Suki Bot MD

## Descripción

Este módulo proporciona la integración completa entre el **XPE Panel** (interfaz web de administración) y el **Suki Bot MD** (bot de WhatsApp usando Baileys).

## Características

- **Panel de Control Web**: Monitoreo en tiempo real del estado del bot
- **Notificaciones Automáticas**: Alerta al grupo de owners cuando hay actualizaciones pendientes
- **XPE Assistant**: Envía mensajes directamente al grupo de owners desde el panel
- **Métricas en Vivo**: RAM, CPU, uptime y estado de Git
- **Control Remoto**: Reinicio y actualización desde el panel

## Estructura de Archivos

```
suki-bot/
├── lib/
│   ├── panel-server.js      # Servidor WebSocket + Express
│   └── xpe-integration.js   # Módulo principal de integración
├── src/
│   └── monitor.js           # Monitoreo del sistema
├── plugins/
│   └── system-updater.js    # Sistema de actualizaciones
├── config-panel.js          # Configuración del panel
└── README.md                # Este archivo
```

## Instalación

### 1. Instalar dependencias adicionales

```bash
cd suki-bot
npm install express socket.io node-cache
```

### 2. Configurar el panel

Copia el archivo de configuración y completa los valores:

```bash
cp config-panel.js .env
# Edita .env con tus valores
```

### 3. Integrar con el bot principal

En tu archivo `index.js` principal, agrega la integración:

```javascript
import XPEIntegration from './lib/xpe-integration.js';
import config from './config-panel.js';

// Después de inicializar la conexión de Baileys
const xpeIntegration = new XPEIntegration(conn, config);
await xpeIntegration.initialize();

// Para detener gracefully
process.on('SIGINT', async () => {
    await xpeIntegration.shutdown();
    process.exit(0);
});
```

## Configuración

Edita `config-panel.js` o las variables de entorno:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PANEL_PORT` | Puerto del servidor web | `3000` |
| `PANEL_AUTH_TOKEN` | Token de autenticación | `tu-token-secreto` |
| `OWNER_GROUP_ID` | ID del grupo de owners | `123456789@g.us` |
| `OPENAI_API_KEY` | Clave de API de OpenAI | `sk-...` |
| `NOTIFY_ON_START` | Notificar al iniciar | `true` |
| `NOTIFY_ON_UPDATE` | Notificar actualizaciones | `true` |
| `UPDATE_CHECK_INTERVAL` | Minutos entre verificaciones | `30` |

## Uso del Panel

### Acceso

Abre tu navegador en: `http://localhost:3000/panel`

### Panel de Control

El panel muestra:

- **Estado del Bot**: Conectado/Desconectado
- **Código QR**: Si el bot necesita autenticación
- **Métricas**: RAM, CPU, Uptime
- **Notificaciones**: Actualizaciones pendientes
- **Logs**: Actividad en tiempo real

### XPE Assistant

Desde la sección de XPE Assistant, puedes:

1. Escribir un mensaje para el grupo de owners
2. Revisar el mensaje
3. Confirmar envío (doble confirmación)
4. El mensaje se envía automáticamente

## Eventos del Socket

### El Bot emite:

| Evento | Descripción |
|--------|-------------|
| `bot:status` | Estado de conexión del bot |
| `metrics:update` | Métricas del sistema |
| `bot:log` | Nueva línea de log |
| `update:pending` | Actualizaciones disponibles |
| `bot:qr` | Nuevo código QR |

### El Panel emite:

| Evento | Descripción |
|--------|-------------|
| `bot:restart` | Solicitar reinicio |
| `bot:update` | Solicitar actualización |
| `bot:sendMessage` | Enviar mensaje |
| `assistant:sendMessage` | Mensaje desde IA |

## API REST

### GET /api/status

Obtiene el estado actual del bot:

```json
{
  "connected": true,
  "uptime": 3600,
  "memory": 256,
  "pendingUpdates": 3
}
```

### GET /api/metrics

Obtiene métricas del sistema:

```json
{
  "ram": 256,
  "cpu": 5000,
  "uptime": 3600
}
```

### POST /api/action

Ejecuta acciones de control:

```json
{
  "action": "restart"
}
```

## Solución de Problemas

### El panel no conecta

Verifica que el servidor esté ejecutándose:
```bash
node lib/panel-server.js
```

### No llegan notificaciones

- Verifica que `OWNER_GROUP_ID` sea correcto
- Asegúrate de que el bot tenga permisos para enviar mensajes

### Error de autenticación

Genera un nuevo token:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Seguridad

- **No expongas** el panel a internet sin autenticación
- Usa un **token fuerte** en producción
- Considera usar **HTTPS** con un proxy reverso (Nginx/Caddy)

## Licencia

Este proyecto es parte de XPE Bot y está bajo licencia MIT.
