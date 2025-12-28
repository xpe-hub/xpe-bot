# XPE-BOT Control Panel

Panel de control visual y seguro para XPE-BOT, diseñado para la administración remota de bots de WhatsApp con protección contra uso no autorizado.

## Características Principales

- **Interfaz Visual Moderna**: Diseño profesional con temática XPE-BOT
- **Protección HWID**: Cada licencia está vinculada al hardware del equipo
- **Control Seguro**: Gestión remota del bot con validación de permisos
- **Distribución Facil**: Empaquetado profesional para Windows

## Requisitos del Sistema

- Windows 10/11 (64-bit)
- Node.js 18.0 o superior
- 4GB de RAM mínimo
- 500MB de espacio en disco

## Instalación para Usuarios Finales

### Método 1: Instalador (Recomendado)

1. Descarga el archivo `XPE-BOT-Panel-Setup-{version}.exe`
2. Ejecuta el instalador como administrador
3. Sigue las instrucciones del asistente de instalación
4. Inicia la aplicación desde el menú de inicio

### Método 2: Versión Portátil

1. Descarga `XPE-BOT-Panel-Portable-{version}.exe`
2. Extrae el contenido en la ubicación deseada
3. Ejecuta `XPE-BOT Control Panel.exe`

## Configuración Inicial

### Para el Administrador (Tú)

1. **Generar Licencias**:
   - Abre el panel de control
   - Ve a la sección "Licencias"
   - Genera una nueva licencia con el HWID del cliente
   - Envía la licencia junto con el instalador

2. **Configurar el Bot**:
   - Verifica que la carpeta del bot esté en la ruta correcta
   - Configura los permisos en `global.owner`
   - Reinicia el panel después de cambios

### Para los Vendedores

1. **Primer Inicio**:
   - Instala la aplicación
   - Al abrir, se mostrará el mensaje de activación
   - Envía su HWID a ti para generar su licencia

2. **Activación**:
   - Copia la licencia recibida
   - Pégala en el campo de activación
   - El panel se activará automáticamente

## Construir el Instalador

### Preparación

```bash
# Instalar dependencias
npm install

# Construir para Windows
npm run build:win
```

### Salida

Los archivos generados estarán en la carpeta `dist/`:
- `XPE-BOT-Panel-Setup-1.0.0.exe` - Instalador
- `XPE-BOT-Panel-Portable-1.0.0.exe` - Versión portable

## Estructura de Archivos

```
xpe-bot-panel/
├── assets/
│   ├── icon.ico          # Icono de la aplicación
│   ├── LICENSE.txt       # Archivo de licencia
│   ├── background.jpg    # Fondo de la interfaz
│   └── spinner.gif       # Animación de carga
├── src/
│   ├── main.js           # Proceso principal de Electron
│   └── preload.js        # Puente seguro entre procesos
├── dist/                 # Carpeta de salida (después de build)
├── index.html            # Interfaz de usuario
├── package.json          # Configuración del proyecto
└── README.md             # Este archivo
```

## Solución de Problemas

### El panel no se inicia

1. Verifica que Node.js esté instalado correctamente
2. Ejecuta como administrador
3. Revisa los logs en la consola de desarrollo (F12)

### Error de HWID

1. Verifica que la licencia corresponda al HWID actual
2. Regenera la licencia si el hardware cambió
3. Contacta al soporte para restablecer la licencia

### El bot no responde

1. Verifica que el bot esté en la carpeta correcta
2. Confirma que el bot esté ejecutándose
3. Revisa la conexión de red

## Seguridad

### Protección HWID

El sistema genera un identificador único basado en:
- Identificador de volumen del disco
- Información de la placa base
- Dirección MAC de red
- Procesador

### Licencias

Cada licencia contiene:
- HWID autorizado
- Fecha de emisión
- Fecha de expiración (si aplica)
- Nivel de permisos

## Soporte

Para problemas técnicos o consultas sobre licencias:
- Contacta al equipo de XPE-TEAM
- Proporciona el HWID y el código de error

## Actualizaciones

Para actualizar el panel:
1. Descarga la nueva versión
2. Ejecuta el instalador (detectará la instalación previa)
3. Las configuraciones se mantendrán intactas

---

**XPE-TEAM** - Automatización de WhatsApp de Próxima Generación
